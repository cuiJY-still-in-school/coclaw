const crypto = require("crypto");
const { cli } = require("./cli");

/**
 * 令牌管理器
 * 管理文件传输和 API 访问令牌
 */
class TokenManager {
  constructor(config) {
    this.config = config;
    this.tokens = new Map(); // token -> tokenInfo
    this.cleanupInterval = null;
  }

  /**
   * 生成令牌
   */
  generateToken(type, data = {}, expiresIn = 3600000) {
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + expiresIn;

    const tokenInfo = {
      token,
      type,
      data,
      createdAt: Date.now(),
      expiresAt,
      used: false,
    };

    this.tokens.set(token, tokenInfo);
    cli.debug(`生成 ${type} 令牌: ${token.substring(0, 8)}...`);

    return token;
  }

  /**
   * 验证令牌
   */
  validateToken(token, type = null) {
    const tokenInfo = this.tokens.get(token);

    if (!tokenInfo) {
      return { valid: false, error: "令牌不存在" };
    }

    // 检查令牌类型
    if (type && tokenInfo.type !== type) {
      return {
        valid: false,
        error: `令牌类型不匹配: 期望 ${type}, 实际 ${tokenInfo.type}`,
      };
    }

    // 检查是否已使用
    if (tokenInfo.used) {
      return { valid: false, error: "令牌已使用" };
    }

    // 检查是否过期
    if (Date.now() > tokenInfo.expiresAt) {
      this.tokens.delete(token);
      return { valid: false, error: "令牌已过期" };
    }

    return {
      valid: true,
      tokenInfo,
    };
  }

  /**
   * 使用令牌
   */
  useToken(token) {
    const tokenInfo = this.tokens.get(token);
    if (!tokenInfo) {
      return false;
    }

    tokenInfo.used = true;
    tokenInfo.usedAt = Date.now();
    this.tokens.set(token, tokenInfo);

    cli.debug(`使用令牌: ${token.substring(0, 8)}...`);
    return true;
  }

  /**
   * 生成文件上传令牌
   */
  generateFileUploadToken(fromAgentId, toAgentId, filename, size) {
    return this.generateToken(
      "file_upload",
      {
        fromAgentId,
        toAgentId,
        filename,
        size,
        timestamp: Date.now(),
      },
      300000, // 5分钟有效期
    );
  }

  /**
   * 生成文件下载令牌
   */
  generateFileDownloadToken(fileId, agentId) {
    return this.generateToken(
      "file_download",
      {
        fileId,
        agentId,
        timestamp: Date.now(),
      },
      3600000, // 1小时有效期
    );
  }

  /**
   * 生成 API 访问令牌
   */
  generateApiToken(agentId, permissions = []) {
    return this.generateToken(
      "api_access",
      {
        agentId,
        permissions,
        timestamp: Date.now(),
      },
      86400000, // 24小时有效期
    );
  }

  /**
   * 验证文件上传令牌
   */
  validateFileUploadToken(token, fromAgentId, toAgentId) {
    const result = this.validateToken(token, "file_upload");
    if (!result.valid) {
      return result;
    }

    const { data } = result.tokenInfo;

    // 验证发送者和接收者
    if (data.fromAgentId !== fromAgentId) {
      return { valid: false, error: "发送者不匹配" };
    }

    if (data.toAgentId !== toAgentId) {
      return { valid: false, error: "接收者不匹配" };
    }

    return result;
  }

  /**
   * 验证文件下载令牌
   */
  validateFileDownloadToken(token, fileId, agentId) {
    const result = this.validateToken(token, "file_download");
    if (!result.valid) {
      return result;
    }

    const { data } = result.tokenInfo;

    // 验证文件 ID 和 Agent ID
    if (data.fileId !== fileId) {
      return { valid: false, error: "文件 ID 不匹配" };
    }

    if (data.agentId !== agentId) {
      return { valid: false, error: "Agent ID 不匹配" };
    }

    return result;
  }

  /**
   * 启动令牌清理
   */
  startCleanup() {
    // 每小时清理一次过期令牌
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens();
    }, 3600000);

    // 立即清理一次
    this.cleanupExpiredTokens();
  }

  /**
   * 清理过期令牌
   */
  cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;

    for (const [token, tokenInfo] of this.tokens.entries()) {
      if (now > tokenInfo.expiresAt) {
        this.tokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      cli.debug(`清理了 ${cleaned} 个过期令牌`);
    }
  }

  /**
   * 停止令牌清理
   */
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取令牌统计
   */
  getStats() {
    const now = Date.now();
    const stats = {
      total: this.tokens.size,
      byType: {},
      expired: 0,
      used: 0,
      active: 0,
    };

    for (const tokenInfo of this.tokens.values()) {
      // 按类型统计
      stats.byType[tokenInfo.type] = (stats.byType[tokenInfo.type] || 0) + 1;

      // 统计状态
      if (now > tokenInfo.expiresAt) {
        stats.expired++;
      } else if (tokenInfo.used) {
        stats.used++;
      } else {
        stats.active++;
      }
    }

    return stats;
  }
}

module.exports = TokenManager;
