const fs = require("fs-extra");
const path = require("path");
const { cli } = require("./cli");

/**
 * 关系权限管理器
 * 管理 Agent 之间的关系和通信权限
 */
class RelationshipManager {
  constructor(config) {
    this.config = config;
    this.relationships = new Map(); // agentId -> relationshipConfig
    this.permissionCache = new Map(); // cacheKey -> permissionResult
    this.loadRelationships();
  }

  /**
   * 加载关系配置
   */
  async loadRelationships() {
    try {
      const relationshipsFile = path.join(
        this.config.configDir,
        "relationships.json",
      );

      if (await fs.pathExists(relationshipsFile)) {
        const content = await fs.readFile(relationshipsFile, "utf8");
        const data = JSON.parse(content);

        // 转换为 Map
        for (const [agentId, config] of Object.entries(data)) {
          this.relationships.set(agentId, config);
        }

        cli.debug(`加载了 ${this.relationships.size} 个 Agent 的关系配置`);
      } else {
        cli.debug("关系配置文件不存在，使用空配置");
      }
    } catch (error) {
      cli.warn(`加载关系配置失败: ${error.message}`);
      // 使用空配置继续
    }
  }

  /**
   * 保存关系配置
   */
  async saveRelationships() {
    try {
      const relationshipsFile = path.join(
        this.config.configDir,
        "relationships.json",
      );

      // 转换为普通对象
      const data = {};
      for (const [agentId, config] of this.relationships.entries()) {
        data[agentId] = config;
      }

      await fs.writeFile(relationshipsFile, JSON.stringify(data, null, 2));
      cli.debug("关系配置已保存");
    } catch (error) {
      cli.error(`保存关系配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 设置 Agent 关系配置
   */
  async setRelationship(agentId, relationshipConfig) {
    // 验证配置
    this.validateRelationshipConfig(relationshipConfig);

    // 更新配置
    this.relationships.set(agentId, relationshipConfig);

    // 清除相关缓存
    this.clearPermissionCache(agentId);

    // 保存到文件
    await this.saveRelationships();

    cli.info(`更新 Agent ${agentId} 的关系配置`);
    return true;
  }

  /**
   * 获取 Agent 关系配置
   */
  getRelationship(agentId) {
    return this.relationships.get(agentId) || this.getDefaultRelationship();
  }

  /**
   * 获取默认关系配置
   */
  getDefaultRelationship() {
    return {
      // 默认权限
      defaultPermissions: {
        sendMessage: true,
        receiveMessage: true,
        sendFile: true,
        receiveFile: true,
        executeCommand: false,
        accessFiles: false,
      },

      // 特定 Agent 的权限覆盖
      agentOverrides: {},

      // 组权限
      groupPermissions: {},

      // 信任级别 (0-10)
      trustLevel: 5,

      // 自动接受消息
      autoAcceptMessages: true,

      // 自动接受文件
      autoAcceptFiles: false,

      // 最大文件大小 (字节)
      maxFileSize: 10 * 1024 * 1024, // 10MB

      // 允许的文件类型
      allowedFileTypes: ["*"], // * 表示所有类型

      // 阻止列表
      blockList: [],
    };
  }

  /**
   * 验证关系配置
   */
  validateRelationshipConfig(config) {
    const requiredFields = ["defaultPermissions"];

    for (const field of requiredFields) {
      if (!config[field]) {
        throw new Error(`缺少必要字段: ${field}`);
      }
    }

    // 验证权限字段
    const requiredPermissions = [
      "sendMessage",
      "receiveMessage",
      "sendFile",
      "receiveFile",
      "executeCommand",
      "accessFiles",
    ];

    for (const perm of requiredPermissions) {
      if (typeof config.defaultPermissions[perm] !== "boolean") {
        throw new Error(`权限 ${perm} 必须是布尔值`);
      }
    }

    // 验证信任级别
    if (config.trustLevel !== undefined) {
      if (
        typeof config.trustLevel !== "number" ||
        config.trustLevel < 0 ||
        config.trustLevel > 10
      ) {
        throw new Error("信任级别必须是 0-10 之间的数字");
      }
    }

    return true;
  }

  /**
   * 检查权限
   */
  checkPermission(fromAgentId, toAgentId, permission, context = {}) {
    const cacheKey = `${fromAgentId}:${toAgentId}:${permission}:${JSON.stringify(context)}`;

    // 检查缓存
    if (this.permissionCache.has(cacheKey)) {
      return this.permissionCache.get(cacheKey);
    }

    // 获取双方的关系配置
    const fromConfig = this.getRelationship(fromAgentId);
    const toConfig = this.getRelationship(toAgentId);

    let hasPermission = false;
    let reason = "";

    // 1. 检查阻止列表
    if (fromConfig.blockList && fromConfig.blockList.includes(toAgentId)) {
      hasPermission = false;
      reason = `${fromAgentId} 阻止了 ${toAgentId}`;
    } else if (toConfig.blockList && toConfig.blockList.includes(fromAgentId)) {
      hasPermission = false;
      reason = `${toAgentId} 阻止了 ${fromAgentId}`;
    }
    // 2. 检查特定 Agent 的权限覆盖
    else if (
      fromConfig.agentOverrides &&
      fromConfig.agentOverrides[toAgentId]
    ) {
      const override = fromConfig.agentOverrides[toAgentId];
      if (override[permission] !== undefined) {
        hasPermission = override[permission];
        reason = `特定 Agent 权限覆盖: ${hasPermission ? "允许" : "拒绝"}`;
      }
    }
    // 3. 检查接收者的默认权限
    else if (toConfig.defaultPermissions[permission] !== undefined) {
      hasPermission = toConfig.defaultPermissions[permission];
      reason = `默认权限: ${hasPermission ? "允许" : "拒绝"}`;
    }
    // 4. 使用发送者的默认权限作为后备
    else {
      hasPermission = fromConfig.defaultPermissions[permission] || false;
      reason = `发送者默认权限: ${hasPermission ? "允许" : "拒绝"}`;
    }

    // 5. 根据信任级别调整权限
    if (hasPermission && context.requiresTrust) {
      const requiredTrust = context.requiresTrust || 5;
      const actualTrust = Math.min(
        fromConfig.trustLevel || 5,
        toConfig.trustLevel || 5,
      );

      if (actualTrust < requiredTrust) {
        hasPermission = false;
        reason = `信任级别不足: ${actualTrust} < ${requiredTrust}`;
      }
    }

    // 6. 文件类型检查（如果是文件传输）
    if (hasPermission && permission.includes("File") && context.fileType) {
      const allowedTypes = toConfig.allowedFileTypes || ["*"];

      if (
        !allowedTypes.includes("*") &&
        !allowedTypes.includes(context.fileType)
      ) {
        hasPermission = false;
        reason = `文件类型不被允许: ${context.fileType}`;
      }
    }

    // 7. 文件大小检查（如果是文件传输）
    if (hasPermission && permission.includes("File") && context.fileSize) {
      const maxSize = toConfig.maxFileSize || 10 * 1024 * 1024;

      if (context.fileSize > maxSize) {
        hasPermission = false;
        reason = `文件大小超过限制: ${context.fileSize} > ${maxSize}`;
      }
    }

    const result = {
      hasPermission,
      reason,
      fromAgentId,
      toAgentId,
      permission,
      context,
    };

    // 缓存结果（5分钟）
    this.permissionCache.set(cacheKey, result);
    setTimeout(
      () => {
        this.permissionCache.delete(cacheKey);
      },
      5 * 60 * 1000,
    );

    return result;
  }

  /**
   * 检查消息发送权限
   */
  checkMessagePermission(fromAgentId, toAgentId, messageType = "text") {
    return this.checkPermission(fromAgentId, toAgentId, "sendMessage", {
      messageType,
      requiresTrust: messageType === "command" ? 7 : 3,
    });
  }

  /**
   * 检查文件发送权限
   */
  checkFilePermission(fromAgentId, toAgentId, fileInfo = {}) {
    return this.checkPermission(fromAgentId, toAgentId, "sendFile", {
      fileType: fileInfo.type || "unknown",
      fileSize: fileInfo.size || 0,
      requiresTrust: 5,
    });
  }

  /**
   * 检查命令执行权限
   */
  checkCommandPermission(fromAgentId, toAgentId, command) {
    return this.checkPermission(fromAgentId, toAgentId, "executeCommand", {
      command,
      requiresTrust: 8,
    });
  }

  /**
   * 添加 Agent 到阻止列表
   */
  async blockAgent(agentId, blockedAgentId) {
    const config = this.getRelationship(agentId);

    if (!config.blockList) {
      config.blockList = [];
    }

    if (!config.blockList.includes(blockedAgentId)) {
      config.blockList.push(blockedAgentId);
      await this.setRelationship(agentId, config);
    }

    cli.info(`${agentId} 阻止了 ${blockedAgentId}`);
    return true;
  }

  /**
   * 从阻止列表移除 Agent
   */
  async unblockAgent(agentId, blockedAgentId) {
    const config = this.getRelationship(agentId);

    if (config.blockList && config.blockList.includes(blockedAgentId)) {
      config.blockList = config.blockList.filter((id) => id !== blockedAgentId);
      await this.setRelationship(agentId, config);
    }

    cli.info(`${agentId} 取消阻止 ${blockedAgentId}`);
    return true;
  }

  /**
   * 设置特定 Agent 的权限
   */
  async setAgentOverride(agentId, targetAgentId, permissions) {
    const config = this.getRelationship(agentId);

    if (!config.agentOverrides) {
      config.agentOverrides = {};
    }

    config.agentOverrides[targetAgentId] = {
      ...(config.agentOverrides[targetAgentId] || {}),
      ...permissions,
    };

    await this.setRelationship(agentId, config);

    cli.info(
      `设置 ${agentId} 对 ${targetAgentId} 的权限: ${JSON.stringify(permissions)}`,
    );
    return true;
  }

  /**
   * 设置信任级别
   */
  async setTrustLevel(agentId, trustLevel) {
    const config = this.getRelationship(agentId);
    config.trustLevel = trustLevel;

    await this.setRelationship(agentId, config);

    cli.info(`设置 ${agentId} 的信任级别: ${trustLevel}`);
    return true;
  }

  /**
   * 清除权限缓存
   */
  clearPermissionCache(agentId = null) {
    if (agentId) {
      // 清除与特定 Agent 相关的缓存
      for (const [key] of this.permissionCache.entries()) {
        if (key.includes(agentId)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      // 清除所有缓存
      this.permissionCache.clear();
    }

    cli.debug(`清除权限缓存${agentId ? ` (${agentId})` : ""}`);
  }

  /**
   * 获取关系统计
   */
  getStats() {
    const stats = {
      totalAgents: this.relationships.size,
      totalOverrides: 0,
      totalBlocked: 0,
      permissionCacheSize: this.permissionCache.size,
    };

    for (const config of this.relationships.values()) {
      if (config.agentOverrides) {
        stats.totalOverrides += Object.keys(config.agentOverrides).length;
      }

      if (config.blockList) {
        stats.totalBlocked += config.blockList.length;
      }
    }

    return stats;
  }

  /**
   * 导出关系配置
   */
  exportRelationships() {
    const data = {};

    for (const [agentId, config] of this.relationships.entries()) {
      data[agentId] = config;
    }

    return data;
  }

  /**
   * 导入关系配置
   */
  async importRelationships(data) {
    // 验证数据
    if (typeof data !== "object" || data === null) {
      throw new Error("导入数据必须是对象");
    }

    // 清空现有关系
    this.relationships.clear();
    this.permissionCache.clear();

    // 导入新关系
    for (const [agentId, config] of Object.entries(data)) {
      try {
        this.validateRelationshipConfig(config);
        this.relationships.set(agentId, config);
      } catch (error) {
        cli.warn(`跳过无效的 Agent ${agentId} 配置: ${error.message}`);
      }
    }

    // 保存到文件
    await this.saveRelationships();

    cli.info(`导入了 ${this.relationships.size} 个 Agent 的关系配置`);
    return this.relationships.size;
  }
}

module.exports = RelationshipManager;
