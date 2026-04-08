const fs = require("fs-extra");
const path = require("path");
const { cli } = require("./cli");

/**
 * 服务器监控模块
 * 收集和报告服务器性能指标
 */
class Monitoring {
  constructor(config, serverManager) {
    this.config = config;
    this.serverManager = serverManager;
    this.metrics = {
      startTime: new Date(),
      requests: {
        total: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
      },
      messages: {
        sent: 0,
        received: 0,
        failed: 0,
      },
      connections: {
        peak: 0,
        current: 0,
        total: 0,
      },
      files: {
        uploaded: 0,
        downloaded: 0,
        totalSize: 0,
      },
      errors: [],
    };
    this.logFile = null;
    this.setupLogging();
  }

  /**
   * 设置日志
   */
  setupLogging() {
    const logDir = this.config.getLogsDir();
    fs.ensureDirSync(logDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.logFile = path.join(logDir, `server-${timestamp}.log`);

    // 写入日志头
    const header = `=== Coclaw Server Log ===
Start Time: ${this.metrics.startTime.toISOString()}
Version: ${require("../package.json").version}
Config: ${JSON.stringify(this.config.getAll(), null, 2)}
========================================

`;
    fs.writeFileSync(this.logFile, header);
  }

  /**
   * 记录请求
   */
  logRequest(method, endpoint, statusCode, duration) {
    this.metrics.requests.total++;

    // 按端点统计
    const endpointKey = `${method} ${endpoint}`;
    const endpointStats = this.metrics.requests.byEndpoint.get(endpointKey) || {
      count: 0,
      totalDuration: 0,
      statusCodes: new Map(),
    };
    endpointStats.count++;
    endpointStats.totalDuration += duration;
    endpointStats.statusCodes.set(
      statusCode,
      (endpointStats.statusCodes.get(statusCode) || 0) + 1,
    );
    this.metrics.requests.byEndpoint.set(endpointKey, endpointStats);

    // 按方法统计
    const methodStats = this.metrics.requests.byMethod.get(method) || {
      count: 0,
      totalDuration: 0,
    };
    methodStats.count++;
    methodStats.totalDuration += duration;
    this.metrics.requests.byMethod.set(method, methodStats);

    // 写入日志
    const logEntry = `[${new Date().toISOString()}] REQUEST ${method} ${endpoint} ${statusCode} ${duration}ms\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }

  /**
   * 记录消息
   */
  logMessage(direction, fromAgentId, toAgentId, success = true) {
    if (direction === "sent") {
      this.metrics.messages.sent++;
    } else {
      this.metrics.messages.received++;
    }

    if (!success) {
      this.metrics.messages.failed++;
    }

    const logEntry = `[${new Date().toISOString()}] MESSAGE ${direction} ${fromAgentId} -> ${toAgentId} ${success ? "OK" : "FAILED"}\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }

  /**
   * 记录连接
   */
  logConnection(action, clientId, clientType) {
    if (action === "connect") {
      this.metrics.connections.current++;
      this.metrics.connections.total++;
      if (this.metrics.connections.current > this.metrics.connections.peak) {
        this.metrics.connections.peak = this.metrics.connections.current;
      }
    } else if (action === "disconnect") {
      this.metrics.connections.current = Math.max(
        0,
        this.metrics.connections.current - 1,
      );
    }

    const logEntry = `[${new Date().toISOString()}] CONNECTION ${action} ${clientId} (${clientType})\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }

  /**
   * 记录文件传输
   */
  logFileTransfer(action, fileId, size, success = true) {
    if (action === "upload") {
      this.metrics.files.uploaded++;
      this.metrics.files.totalSize += size;
    } else if (action === "download") {
      this.metrics.files.downloaded++;
    }

    const logEntry = `[${new Date().toISOString()}] FILE ${action} ${fileId} ${size} bytes ${success ? "OK" : "FAILED"}\n`;
    fs.appendFileSync(this.logFile, logEntry);
  }

  /**
   * 记录错误
   */
  logError(error, context = {}) {
    const errorEntry = {
      timestamp: new Date(),
      error: error.message,
      stack: error.stack,
      context,
    };

    this.metrics.errors.push(errorEntry);

    // 只保留最近的100个错误
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }

    const logEntry = `[${new Date().toISOString()}] ERROR ${error.message}\nContext: ${JSON.stringify(context)}\nStack: ${error.stack}\n`;
    fs.appendFileSync(this.logFile, logEntry);

    cli.error(`监控错误: ${error.message}`);
  }

  /**
   * 获取监控指标
   */
  getMetrics() {
    const now = new Date();
    const uptime = now - this.metrics.startTime;

    // 计算请求统计
    const requestStats = {
      total: this.metrics.requests.total,
      averageDuration:
        this.metrics.requests.total > 0
          ? Array.from(this.metrics.requests.byMethod.values()).reduce(
              (sum, stats) => sum + stats.totalDuration,
              0,
            ) / this.metrics.requests.total
          : 0,
      byEndpoint: Array.from(this.metrics.requests.byEndpoint.entries()).map(
        ([endpoint, stats]) => ({
          endpoint,
          count: stats.count,
          averageDuration:
            stats.count > 0 ? stats.totalDuration / stats.count : 0,
          statusCodes: Array.from(stats.statusCodes.entries()).map(
            ([code, count]) => ({
              code,
              count,
            }),
          ),
        }),
      ),
      byMethod: Array.from(this.metrics.requests.byMethod.entries()).map(
        ([method, stats]) => ({
          method,
          count: stats.count,
          averageDuration:
            stats.count > 0 ? stats.totalDuration / stats.count : 0,
        }),
      ),
    };

    // 计算消息统计
    const messageStats = {
      sent: this.metrics.messages.sent,
      received: this.metrics.messages.received,
      failed: this.metrics.messages.failed,
      successRate:
        this.metrics.messages.sent + this.metrics.messages.received > 0
          ? ((this.metrics.messages.sent +
              this.metrics.messages.received -
              this.metrics.messages.failed) /
              (this.metrics.messages.sent + this.metrics.messages.received)) *
            100
          : 100,
    };

    // 计算连接统计
    const connectionStats = {
      current: this.metrics.connections.current,
      peak: this.metrics.connections.peak,
      total: this.metrics.connections.total,
    };

    // 计算文件统计
    const fileStats = {
      uploaded: this.metrics.files.uploaded,
      downloaded: this.metrics.files.downloaded,
      totalSize: this.metrics.files.totalSize,
      averageSize:
        this.metrics.files.uploaded > 0
          ? this.metrics.files.totalSize / this.metrics.files.uploaded
          : 0,
    };

    // 错误统计
    const errorStats = {
      total: this.metrics.errors.length,
      recent: this.metrics.errors.slice(-10).map((err) => ({
        timestamp: err.timestamp,
        error: err.error,
        context: err.context,
      })),
    };

    return {
      uptime,
      startTime: this.metrics.startTime,
      currentTime: now,
      requests: requestStats,
      messages: messageStats,
      connections: connectionStats,
      files: fileStats,
      errors: errorStats,
      logFile: this.logFile,
    };
  }

  /**
   * 生成健康报告
   */
  getHealthReport() {
    const metrics = this.getMetrics();
    const uptimeHours = metrics.uptime / (1000 * 60 * 60);

    // 检查健康状态
    const checks = {
      uptime: uptimeHours > 0.1, // 至少运行6分钟
      requestRate: metrics.requests.total > 0 || uptimeHours < 1, // 新服务器或已有请求
      errorRate: metrics.errors.length < 10 || uptimeHours > 1, // 允许一些错误
      connections: metrics.connections.current <= 100, // 不超过100个连接
    };

    const allHealthy = Object.values(checks).every((check) => check);
    const healthStatus = allHealthy ? "healthy" : "degraded";

    return {
      status: healthStatus,
      checks,
      metrics: {
        uptime: metrics.uptime,
        requests: metrics.requests.total,
        messages: metrics.messages.sent + metrics.messages.received,
        connections: metrics.connections.current,
        errors: metrics.errors.length,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 清理旧日志
   */
  async cleanupOldLogs(maxAgeDays = 7) {
    try {
      const logDir = this.config.getLogsDir();
      if (!(await fs.pathExists(logDir))) {
        return 0;
      }

      const files = await fs.readdir(logDir);
      const cutoffTime = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const file of files) {
        if (file.endsWith(".log")) {
          const filePath = path.join(logDir, file);
          const stats = await fs.stat(filePath);

          if (stats.mtimeMs < cutoffTime) {
            await fs.remove(filePath);
            deletedCount++;
            cli.debug(`清理旧日志: ${file}`);
          }
        }
      }

      return deletedCount;
    } catch (error) {
      cli.warn(`清理日志失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 停止监控
   */
  async stop() {
    // 记录关闭
    const logEntry = `[${new Date().toISOString()}] SERVER STOPPED\n`;
    fs.appendFileSync(this.logFile, logEntry);

    // 清理旧日志
    await this.cleanupOldLogs();

    cli.debug("监控已停止");
  }
}

module.exports = Monitoring;
