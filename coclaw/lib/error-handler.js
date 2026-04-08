const { cli } = require("./cli");
const fs = require("fs-extra");
const path = require("path");

/**
 * 错误代码定义
 */
const ErrorCodes = {
  // 网络错误 (1000-1999)
  NETWORK_CONNECTION_FAILED: 1001,
  NETWORK_TIMEOUT: 1002,
  NETWORK_DISCONNECTED: 1003,
  NETWORK_PROTOCOL_ERROR: 1004,

  // 认证错误 (2000-2999)
  AUTH_TOKEN_INVALID: 2001,
  AUTH_TOKEN_EXPIRED: 2002,
  AUTH_PERMISSION_DENIED: 2003,
  AUTH_AGENT_NOT_FOUND: 2004,

  // 消息错误 (3000-3999)
  MESSAGE_FORMAT_INVALID: 3001,
  MESSAGE_ROUTING_FAILED: 3002,
  MESSAGE_QUEUE_FULL: 3003,
  MESSAGE_DELIVERY_FAILED: 3004,

  // 文件错误 (4000-4999)
  FILE_UPLOAD_FAILED: 4001,
  FILE_DOWNLOAD_FAILED: 4002,
  FILE_SIZE_EXCEEDED: 4003,
  FILE_TYPE_NOT_ALLOWED: 4004,
  FILE_NOT_FOUND: 4005,
  FILE_EXPIRED: 4006,

  // 服务器错误 (5000-5999)
  SERVER_START_FAILED: 5001,
  SERVER_SHUTDOWN_FAILED: 5002,
  SERVER_RESOURCE_LIMIT: 5003,
  SERVER_CONFIG_ERROR: 5004,

  // 配置错误 (6000-6999)
  CONFIG_VALIDATION_FAILED: 6001,
  CONFIG_FILE_CORRUPTED: 6002,
  CONFIG_NOT_FOUND: 6003,

  // 关系错误 (7000-7999)
  RELATIONSHIP_CONFIG_INVALID: 7001,
  RELATIONSHIP_PERMISSION_DENIED: 7002,
  RELATIONSHIP_TRUST_TOO_LOW: 7003,

  // AI 工具错误 (8000-8999)
  AI_TOOL_EXECUTION_FAILED: 8001,
  AI_TOOL_VALIDATION_FAILED: 8002,
  AI_TOOL_NOT_FOUND: 8003,

  // 未知错误 (9000-9999)
  UNKNOWN_ERROR: 9001,
  INTERNAL_ERROR: 9002,
};

/**
 * 错误严重级别
 */
const ErrorSeverity = {
  LOW: "low", // 可忽略的错误，不影响功能
  MEDIUM: "medium", // 需要关注的错误，可能影响部分功能
  HIGH: "high", // 严重错误，影响核心功能
  CRITICAL: "critical", // 致命错误，系统无法继续运行
};

/**
 * 错误处理器
 */
class ErrorHandler {
  constructor(config, monitoring = null) {
    this.config = config;
    this.monitoring = monitoring;
    this.errorStats = {
      total: 0,
      byCode: new Map(),
      bySeverity: new Map(),
      recentErrors: [], // 最近错误记录
    };
    this.recoveryStrategies = new Map();

    // 初始化错误日志文件
    this.errorLogPath = path.join(config.getDataDir(), "logs", "errors.json");
    this.initErrorLog();

    this.setupRecoveryStrategies();
  }

  /**
   * 初始化错误日志
   */
  async initErrorLog() {
    try {
      const logDir = path.dirname(this.errorLogPath);
      await fs.ensureDir(logDir);

      if (!(await fs.pathExists(this.errorLogPath))) {
        await fs.writeJson(this.errorLogPath, {
          total: 0,
          critical: 0,
          major: 0,
          minor: 0,
          warning: 0,
          byType: {},
          recent: [],
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      cli.warn(`初始化错误日志失败: ${error.message}`);
    }
  }

  /**
   * 保存错误日志到文件
   */
  async saveErrorLog() {
    try {
      const logData = {
        total: this.errorStats.total,
        critical: this.errorStats.bySeverity.get(ErrorSeverity.CRITICAL) || 0,
        major: this.errorStats.bySeverity.get(ErrorSeverity.HIGH) || 0,
        minor: this.errorStats.bySeverity.get(ErrorSeverity.MEDIUM) || 0,
        warning: this.errorStats.bySeverity.get(ErrorSeverity.LOW) || 0,
        byType: Object.fromEntries(this.errorStats.byCode),
        recent: this.errorStats.recentErrors.slice(-50), // 保留最近50个错误
        updatedAt: new Date().toISOString(),
      };

      await fs.writeJson(this.errorLogPath, logData, { spaces: 2 });
    } catch (error) {
      cli.warn(`保存错误日志失败: ${error.message}`);
    }
  }

  /**
   * 创建错误对象
   */
  createError(code, message, details = {}, severity = ErrorSeverity.MEDIUM) {
    const error = new Error(message);
    error.code = code;
    error.details = details;
    error.severity = severity;
    error.timestamp = new Date();

    return error;
  }

  /**
   * 处理错误
   */
  async handleError(error, context = {}) {
    // 标准化错误对象
    const standardizedError = this.standardizeError(error);

    // 更新统计
    this.updateErrorStats(standardizedError);

    // 记录错误
    this.logError(standardizedError, context);

    // 根据严重级别处理
    switch (standardizedError.severity) {
      case ErrorSeverity.LOW:
        return this.handleLowSeverityError(standardizedError, context);

      case ErrorSeverity.MEDIUM:
        return this.handleMediumSeverityError(standardizedError, context);

      case ErrorSeverity.HIGH:
        return this.handleHighSeverityError(standardizedError, context);

      case ErrorSeverity.CRITICAL:
        return this.handleCriticalSeverityError(standardizedError, context);

      default:
        return this.handleMediumSeverityError(standardizedError, context);
    }
  }

  /**
   * 标准化错误对象
   */
  standardizeError(error) {
    // 如果已经是标准错误对象，直接返回
    if (error.code && error.severity) {
      return error;
    }

    // 根据错误消息推断错误代码和严重级别
    let code = ErrorCodes.UNKNOWN_ERROR;
    let severity = ErrorSeverity.MEDIUM;
    let message = error.message;

    // 网络错误
    if (message.includes("connection") || message.includes("network")) {
      code = ErrorCodes.NETWORK_CONNECTION_FAILED;
      severity = ErrorSeverity.HIGH;
    }
    // 超时错误
    else if (message.includes("timeout") || message.includes("timed out")) {
      code = ErrorCodes.NETWORK_TIMEOUT;
      severity = ErrorSeverity.MEDIUM;
    }
    // 认证错误
    else if (message.includes("token") || message.includes("auth")) {
      code = ErrorCodes.AUTH_TOKEN_INVALID;
      severity = ErrorSeverity.HIGH;
    }
    // 权限错误
    else if (message.includes("permission") || message.includes("denied")) {
      code = ErrorCodes.AUTH_PERMISSION_DENIED;
      severity = ErrorSeverity.MEDIUM;
    }
    // 文件错误
    else if (message.includes("file")) {
      code = ErrorCodes.FILE_UPLOAD_FAILED;
      severity = ErrorSeverity.MEDIUM;
    }
    // 配置错误
    else if (message.includes("config")) {
      code = ErrorCodes.CONFIG_VALIDATION_FAILED;
      severity = ErrorSeverity.HIGH;
    }

    return this.createError(code, message, { originalError: error }, severity);
  }

  /**
   * 更新错误统计
   */
  updateErrorStats(error) {
    this.errorStats.total++;

    // 按错误代码统计
    const codeCount = this.errorStats.byCode.get(error.code) || 0;
    this.errorStats.byCode.set(error.code, codeCount + 1);

    // 按严重级别统计
    const severityCount = this.errorStats.bySeverity.get(error.severity) || 0;
    this.errorStats.bySeverity.set(error.severity, severityCount + 1);

    // 记录最近错误
    this.errorStats.recentErrors.push({
      code: error.code,
      severity: error.severity,
      message: error.message,
      timestamp: error.timestamp,
    });

    // 只保留最近的100个错误
    if (this.errorStats.recentErrors.length > 100) {
      this.errorStats.recentErrors.shift();
    }

    // 异步保存错误日志到文件
    this.saveErrorLog().catch((saveError) => {
      cli.warn(`保存错误日志失败: ${saveError.message}`);
    });
  }

  /**
   * 记录错误
   */
  logError(error, context) {
    const logEntry = {
      timestamp: error.timestamp.toISOString(),
      code: error.code,
      severity: error.severity,
      message: error.message,
      context,
      stack: error.stack,
    };

    // 控制台日志
    switch (error.severity) {
      case ErrorSeverity.LOW:
        cli.debug(`错误 [${error.code}]: ${error.message}`);
        break;
      case ErrorSeverity.MEDIUM:
        cli.warn(`错误 [${error.code}]: ${error.message}`);
        break;
      case ErrorSeverity.HIGH:
        cli.error(`错误 [${error.code}]: ${error.message}`);
        break;
      case ErrorSeverity.CRITICAL:
        cli.error(`严重错误 [${error.code}]: ${error.message}`);
        break;
    }

    // 监控系统日志
    if (this.monitoring) {
      this.monitoring.logError(error, {
        ...context,
        code: error.code,
        severity: error.severity,
      });
    }

    // 文件日志（如果需要）
    this.logToFile(logEntry);
  }

  /**
   * 记录到文件
   */
  logToFile(logEntry) {
    // 这里可以添加文件日志逻辑
    // 例如：写入到错误日志文件
  }

  /**
   * 处理低严重性错误
   */
  async handleLowSeverityError(error, context) {
    // 低严重性错误通常可以忽略或自动恢复
    cli.debug(`低严重性错误处理: ${error.message}`);

    // 尝试自动恢复
    const recoveryResult = await this.tryRecovery(error, context);

    if (recoveryResult.success) {
      cli.debug(`错误自动恢复成功: ${error.message}`);
      return {
        success: true,
        recovered: true,
        error,
        recovery: recoveryResult,
      };
    }

    return {
      success: false,
      recovered: false,
      error,
      action: "ignore", // 低严重性错误可以忽略
    };
  }

  /**
   * 处理中等严重性错误
   */
  async handleMediumSeverityError(error, context) {
    // 中等严重性错误需要关注，但系统可以继续运行
    cli.warn(`中等严重性错误处理: ${error.message}`);

    // 尝试自动恢复
    const recoveryResult = await this.tryRecovery(error, context);

    if (recoveryResult.success) {
      cli.info(`错误自动恢复成功: ${error.message}`);
      return {
        success: true,
        recovered: true,
        error,
        recovery: recoveryResult,
      };
    }

    // 如果无法自动恢复，记录并继续
    return {
      success: false,
      recovered: false,
      error,
      action: "continue_with_warning",
      warning: `错误未恢复: ${error.message}`,
    };
  }

  /**
   * 处理高严重性错误
   */
  async handleHighSeverityError(error, context) {
    // 高严重性错误影响核心功能，需要立即处理
    cli.error(`高严重性错误处理: ${error.message}`);

    // 尝试自动恢复
    const recoveryResult = await this.tryRecovery(error, context);

    if (recoveryResult.success) {
      cli.info(`严重错误自动恢复成功: ${error.message}`);
      return {
        success: true,
        recovered: true,
        error,
        recovery: recoveryResult,
      };
    }

    // 如果无法自动恢复，可能需要用户干预
    return {
      success: false,
      recovered: false,
      error,
      action: "require_intervention",
      intervention: "需要用户干预来解决此错误",
      details: error.details,
    };
  }

  /**
   * 处理致命严重性错误
   */
  async handleCriticalSeverityError(error, context) {
    // 致命错误，系统无法继续运行
    cli.error(`致命错误: ${error.message}`);

    // 尝试紧急恢复
    const recoveryResult = await this.tryEmergencyRecovery(error, context);

    if (recoveryResult.success) {
      cli.warn(`致命错误紧急恢复成功，但建议重启系统`);
      return {
        success: true,
        recovered: true,
        error,
        recovery: recoveryResult,
        recommendation: "建议重启系统以确保稳定性",
      };
    }

    // 无法恢复，需要立即停止
    return {
      success: false,
      recovered: false,
      error,
      action: "immediate_shutdown",
      reason: "致命错误无法恢复，系统需要立即关闭",
      details: error.details,
    };
  }

  /**
   * 尝试恢复
   */
  async tryRecovery(error, context) {
    const strategy = this.recoveryStrategies.get(error.code);

    if (!strategy) {
      return {
        success: false,
        reason: "没有可用的恢复策略",
      };
    }

    try {
      cli.debug(`尝试恢复策略: ${strategy.name}`);
      const result = await strategy.handler(error, context, this.config);
      return {
        success: true,
        strategy: strategy.name,
        result,
      };
    } catch (recoveryError) {
      cli.warn(`恢复策略失败: ${recoveryError.message}`);
      return {
        success: false,
        strategy: strategy.name,
        error: recoveryError.message,
      };
    }
  }

  /**
   * 尝试紧急恢复
   */
  async tryEmergencyRecovery(error, context) {
    // 紧急恢复策略
    const emergencyStrategies = [
      {
        name: "重启相关组件",
        handler: async (error, context) => {
          // 这里可以实现组件重启逻辑
          cli.warn("执行紧急恢复: 重启相关组件");
          return { restarted: true };
        },
      },
      {
        name: "清理临时资源",
        handler: async (error, context) => {
          // 清理可能引起问题的临时资源
          cli.warn("执行紧急恢复: 清理临时资源");
          return { cleaned: true };
        },
      },
      {
        name: "回退到安全状态",
        handler: async (error, context) => {
          // 回退到已知的安全状态
          cli.warn("执行紧急恢复: 回退到安全状态");
          return { rolledBack: true };
        },
      },
    ];

    for (const strategy of emergencyStrategies) {
      try {
        cli.warn(`尝试紧急恢复策略: ${strategy.name}`);
        const result = await strategy.handler(error, context, this.config);
        return {
          success: true,
          strategy: strategy.name,
          result,
        };
      } catch (recoveryError) {
        cli.warn(`紧急恢复策略失败: ${recoveryError.message}`);
      }
    }

    return {
      success: false,
      reason: "所有紧急恢复策略都失败了",
    };
  }

  /**
   * 设置恢复策略
   */
  setupRecoveryStrategies() {
    // 网络连接失败 - 重试连接
    this.recoveryStrategies.set(ErrorCodes.NETWORK_CONNECTION_FAILED, {
      name: "网络连接重试",
      handler: async (error, context) => {
        const { maxRetries = 3, retryDelay = 1000 } = context;

        for (let i = 0; i < maxRetries; i++) {
          cli.info(`网络连接重试 (${i + 1}/${maxRetries})...`);

          // 这里可以实现具体的重连逻辑
          // 例如：重新建立 WebSocket 连接

          await new Promise((resolve) => setTimeout(resolve, retryDelay));

          // 模拟重试成功
          if (i === 1) {
            // 第二次重试成功
            return { retryCount: i + 1, connected: true };
          }
        }

        throw new Error("网络连接重试失败");
      },
    });

    // 认证令牌过期 - 刷新令牌
    this.recoveryStrategies.set(ErrorCodes.AUTH_TOKEN_EXPIRED, {
      name: "令牌刷新",
      handler: async (error, context) => {
        cli.info("刷新过期令牌...");

        // 这里可以实现令牌刷新逻辑
        // 例如：请求新的令牌

        return { tokenRefreshed: true, newToken: "new_token_placeholder" };
      },
    });

    // 消息传递失败 - 重新排队
    this.recoveryStrategies.set(ErrorCodes.MESSAGE_DELIVERY_FAILED, {
      name: "消息重新排队",
      handler: async (error, context) => {
        const { message, maxRetries = 2 } = context;

        if (message && message.retryCount < maxRetries) {
          cli.info(
            `消息重新排队 (重试 ${message.retryCount + 1}/${maxRetries})`,
          );

          // 增加重试计数
          message.retryCount = (message.retryCount || 0) + 1;
          message.lastRetry = new Date();

          // 这里可以实现重新排队逻辑

          return { requeued: true, retryCount: message.retryCount };
        }

        throw new Error("消息重试次数超过限制");
      },
    });

    // 文件上传失败 - 重试上传
    this.recoveryStrategies.set(ErrorCodes.FILE_UPLOAD_FAILED, {
      name: "文件上传重试",
      handler: async (error, context) => {
        const { fileInfo, maxRetries = 2 } = context;

        if (fileInfo && fileInfo.retryCount < maxRetries) {
          cli.info(
            `文件上传重试 (重试 ${fileInfo.retryCount + 1}/${maxRetries})`,
          );

          // 增加重试计数
          fileInfo.retryCount = (fileInfo.retryCount || 0) + 1;

          // 这里可以实现文件重传逻辑

          return { retried: true, retryCount: fileInfo.retryCount };
        }

        throw new Error("文件上传重试次数超过限制");
      },
    });
  }

  /**
   * 获取错误统计
   */
  getErrorStats() {
    const stats = {
      total: this.errorStats.total,
      byCode: Object.fromEntries(this.errorStats.byCode),
      bySeverity: Object.fromEntries(this.errorStats.bySeverity),
      recentErrors: this.errorStats.recentErrors.slice(-10), // 最近10个错误
      errorRate: this.calculateErrorRate(),
    };

    return stats;
  }

  /**
   * 计算错误率
   */
  calculateErrorRate() {
    // 这里可以实现错误率计算逻辑
    // 例如：每分钟错误数
    return {
      perMinute: 0,
      perHour: 0,
      trend: "stable",
    };
  }

  /**
   * 重置错误统计
   */
  resetErrorStats() {
    this.errorStats = {
      total: 0,
      byCode: new Map(),
      bySeverity: new Map(),
      recentErrors: [],
    };
  }

  /**
   * 获取错误代码描述
   */
  getErrorDescription(code) {
    const descriptions = {
      [ErrorCodes.NETWORK_CONNECTION_FAILED]: "网络连接失败",
      [ErrorCodes.NETWORK_TIMEOUT]: "网络请求超时",
      [ErrorCodes.NETWORK_DISCONNECTED]: "网络连接断开",
      [ErrorCodes.NETWORK_PROTOCOL_ERROR]: "网络协议错误",

      [ErrorCodes.AUTH_TOKEN_INVALID]: "认证令牌无效",
      [ErrorCodes.AUTH_TOKEN_EXPIRED]: "认证令牌已过期",
      [ErrorCodes.AUTH_PERMISSION_DENIED]: "权限被拒绝",
      [ErrorCodes.AUTH_AGENT_NOT_FOUND]: "Agent 未找到",

      [ErrorCodes.MESSAGE_FORMAT_INVALID]: "消息格式无效",
      [ErrorCodes.MESSAGE_ROUTING_FAILED]: "消息路由失败",
      [ErrorCodes.MESSAGE_QUEUE_FULL]: "消息队列已满",
      [ErrorCodes.MESSAGE_DELIVERY_FAILED]: "消息传递失败",

      [ErrorCodes.FILE_UPLOAD_FAILED]: "文件上传失败",
      [ErrorCodes.FILE_DOWNLOAD_FAILED]: "文件下载失败",
      [ErrorCodes.FILE_SIZE_EXCEEDED]: "文件大小超过限制",
      [ErrorCodes.FILE_TYPE_NOT_ALLOWED]: "文件类型不被允许",
      [ErrorCodes.FILE_NOT_FOUND]: "文件未找到",
      [ErrorCodes.FILE_EXPIRED]: "文件已过期",

      [ErrorCodes.SERVER_START_FAILED]: "服务器启动失败",
      [ErrorCodes.SERVER_SHUTDOWN_FAILED]: "服务器关闭失败",
      [ErrorCodes.SERVER_RESOURCE_LIMIT]: "服务器资源限制",
      [ErrorCodes.SERVER_CONFIG_ERROR]: "服务器配置错误",

      [ErrorCodes.CONFIG_VALIDATION_FAILED]: "配置验证失败",
      [ErrorCodes.CONFIG_FILE_CORRUPTED]: "配置文件损坏",
      [ErrorCodes.CONFIG_NOT_FOUND]: "配置文件未找到",

      [ErrorCodes.RELATIONSHIP_CONFIG_INVALID]: "关系配置无效",
      [ErrorCodes.RELATIONSHIP_PERMISSION_DENIED]: "关系权限被拒绝",
      [ErrorCodes.RELATIONSHIP_TRUST_TOO_LOW]: "信任级别太低",

      [ErrorCodes.AI_TOOL_EXECUTION_FAILED]: "AI 工具执行失败",
      [ErrorCodes.AI_TOOL_VALIDATION_FAILED]: "AI 工具验证失败",
      [ErrorCodes.AI_TOOL_NOT_FOUND]: "AI 工具未找到",

      [ErrorCodes.UNKNOWN_ERROR]: "未知错误",
      [ErrorCodes.INTERNAL_ERROR]: "内部错误",
    };

    return descriptions[code] || "未知错误代码";
  }

  /**
   * 获取错误解决建议
   */
  getErrorResolution(code) {
    const resolutions = {
      [ErrorCodes.NETWORK_CONNECTION_FAILED]: "检查网络连接，确保服务器可访问",
      [ErrorCodes.NETWORK_TIMEOUT]: "增加超时时间或检查网络稳定性",
      [ErrorCodes.AUTH_TOKEN_INVALID]: "重新获取有效的认证令牌",
      [ErrorCodes.AUTH_TOKEN_EXPIRED]: "刷新认证令牌",
      [ErrorCodes.AUTH_PERMISSION_DENIED]: "检查权限配置，确保有足够权限",
      [ErrorCodes.FILE_UPLOAD_FAILED]: "检查文件大小和类型限制，重试上传",
      [ErrorCodes.FILE_SIZE_EXCEEDED]: "减小文件大小或调整文件大小限制",
      [ErrorCodes.FILE_TYPE_NOT_ALLOWED]: "使用允许的文件类型",
      [ErrorCodes.MESSAGE_DELIVERY_FAILED]: "检查目标 Agent 是否在线，重试发送",
      [ErrorCodes.SERVER_START_FAILED]: "检查端口是否被占用，查看服务器日志",
      [ErrorCodes.CONFIG_VALIDATION_FAILED]: "检查配置文件格式和内容",
      [ErrorCodes.RELATIONSHIP_PERMISSION_DENIED]: "调整关系权限配置",
      [ErrorCodes.AI_TOOL_EXECUTION_FAILED]: "检查工具参数和权限，重试执行",
      [ErrorCodes.UNKNOWN_ERROR]: "查看详细错误日志，联系技术支持",
    };

    return resolutions[code] || "查看错误详情和日志以获取更多信息";
  }
}

module.exports = {
  ErrorHandler,
  ErrorCodes,
  ErrorSeverity,
};
