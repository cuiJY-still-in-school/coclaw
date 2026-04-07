const { cli } = require("./cli");
const fs = require("fs-extra");
const path = require("path");

/**
 * 资源清理管理器
 * 优化资源清理机制，防止内存泄漏和资源浪费
 */
class ResourceCleaner {
  constructor(config, serverManager) {
    this.config = config;
    this.serverManager = serverManager;
    this.cleanupIntervals = new Map();
    this.cleanupStats = {
      files: { total: 0, cleaned: 0, failed: 0 },
      connections: { total: 0, cleaned: 0, failed: 0 },
      memory: { total: 0, cleaned: 0, failed: 0 },
      tokens: { total: 0, cleaned: 0, failed: 0 },
    };
  }

  /**
   * 启动所有清理任务
   */
  startAllCleanupTasks() {
    cli.info("启动资源清理管理器...");

    // 文件清理任务
    this.startFileCleanup();

    // 连接清理任务
    this.startConnectionCleanup();

    // 内存清理任务
    this.startMemoryCleanup();

    // 令牌清理任务
    this.startTokenCleanup();

    // 临时文件清理任务
    this.startTempFileCleanup();

    // 监控清理任务
    this.startMonitoringCleanup();

    cli.success("资源清理管理器已启动");
  }

  /**
   * 停止所有清理任务
   */
  stopAllCleanupTasks() {
    cli.info("停止资源清理管理器...");

    for (const [name, interval] of this.cleanupIntervals.entries()) {
      clearInterval(interval);
      cli.debug(`停止清理任务: ${name}`);
    }

    this.cleanupIntervals.clear();
    cli.success("资源清理管理器已停止");
  }

  /**
   * 启动文件清理任务
   */
  startFileCleanup() {
    const interval = 30 * 60 * 1000; // 每30分钟清理一次
    const taskName = "file_cleanup";

    this.cleanupIntervals.set(
      taskName,
      setInterval(async () => {
        await this.cleanupExpiredFiles();
      }, interval),
    );

    // 立即执行一次
    this.cleanupExpiredFiles().catch((error) => {
      cli.warn(`初始文件清理失败: ${error.message}`);
    });

    cli.debug(`文件清理任务已启动 (间隔: ${interval / 60000} 分钟)`);
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles() {
    const startTime = Date.now();
    let cleaned = 0;
    let failed = 0;

    try {
      if (!this.serverManager.fileRegistry) {
        return { cleaned, failed };
      }

      const now = new Date();
      const filesToDelete = [];

      // 收集需要删除的文件
      for (const [
        fileId,
        fileInfo,
      ] of this.serverManager.fileRegistry.entries()) {
        if (now > new Date(fileInfo.expiresAt)) {
          filesToDelete.push({ fileId, fileInfo });
        }
      }

      // 批量删除文件
      for (const { fileId, fileInfo } of filesToDelete) {
        try {
          await fs.remove(fileInfo.path);
          this.serverManager.fileRegistry.delete(fileId);
          cleaned++;
          cli.debug(`清理过期文件: ${fileInfo.originalName} (${fileId})`);
        } catch (error) {
          failed++;
          cli.warn(`清理文件失败 ${fileId}: ${error.message}`);

          // 如果文件不存在，从注册表中移除
          if (error.code === "ENOENT") {
            this.serverManager.fileRegistry.delete(fileId);
            cli.debug(`移除不存在的文件记录: ${fileId}`);
          }
        }
      }

      // 清理空目录
      await this.cleanupEmptyDirectories();

      // 更新统计
      this.cleanupStats.files.total += filesToDelete.length;
      this.cleanupStats.files.cleaned += cleaned;
      this.cleanupStats.files.failed += failed;

      const duration = Date.now() - startTime;
      if (cleaned > 0 || failed > 0) {
        cli.info(
          `文件清理完成: 清理了 ${cleaned} 个文件, 失败 ${failed} 个, 耗时 ${duration}ms`,
        );
      }

      return { cleaned, failed, duration };
    } catch (error) {
      cli.error(`文件清理任务失败: ${error.message}`);
      return { cleaned: 0, failed: 1, error: error.message };
    }
  }

  /**
   * 清理空目录
   */
  async cleanupEmptyDirectories() {
    try {
      const filesDir = this.config.getServerFilesDir();
      if (!(await fs.pathExists(filesDir))) {
        return;
      }

      const entries = await fs.readdir(filesDir, { withFileTypes: true });
      const subdirs = entries.filter((entry) => entry.isDirectory());

      for (const subdir of subdirs) {
        const subdirPath = path.join(filesDir, subdir.name);
        const subdirEntries = await fs.readdir(subdirPath);

        if (subdirEntries.length === 0) {
          await fs.remove(subdirPath);
          cli.debug(`清理空目录: ${subdirPath}`);
        }
      }
    } catch (error) {
      cli.warn(`清理空目录失败: ${error.message}`);
    }
  }

  /**
   * 启动连接清理任务
   */
  startConnectionCleanup() {
    const interval = 5 * 60 * 1000; // 每5分钟清理一次
    const taskName = "connection_cleanup";

    this.cleanupIntervals.set(
      taskName,
      setInterval(async () => {
        await this.cleanupIdleConnections();
      }, interval),
    );

    cli.debug(`连接清理任务已启动 (间隔: ${interval / 60000} 分钟)`);
  }

  /**
   * 清理空闲连接
   */
  async cleanupIdleConnections() {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      // 清理性能优化器中的空闲连接
      if (this.serverManager.performanceOptimizer) {
        this.serverManager.performanceOptimizer.cleanupIdleConnections();
      }

      // 清理无效的 WebSocket 连接
      if (this.serverManager.wsServer) {
        const clients = Array.from(this.serverManager.wsServer.clients);
        const now = Date.now();

        for (const client of clients) {
          // 检查连接状态
          if (client.readyState !== 1) {
            // 不是 OPEN 状态
            try {
              client.terminate();
              cleaned++;
            } catch (error) {
              // 忽略终止错误
            }
          }
        }
      }

      // 清理长时间不活动的 Agent
      await this.cleanupInactiveAgents();

      // 更新统计
      this.cleanupStats.connections.cleaned += cleaned;

      const duration = Date.now() - startTime;
      if (cleaned > 0) {
        cli.debug(`连接清理完成: 清理了 ${cleaned} 个连接, 耗时 ${duration}ms`);
      }

      return { cleaned, duration };
    } catch (error) {
      cli.error(`连接清理任务失败: ${error.message}`);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * 清理不活动的 Agent
   */
  async cleanupInactiveAgents() {
    if (!this.serverManager.agentRegistry) {
      return;
    }

    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5分钟不活动
    const agentsToRemove = [];

    for (const [
      agentId,
      agentInfo,
    ] of this.serverManager.agentRegistry.entries()) {
      const lastSeen = new Date(agentInfo.lastSeen).getTime();
      const inactiveTime = now - lastSeen;

      if (inactiveTime > inactiveThreshold) {
        agentsToRemove.push(agentId);
      }
    }

    for (const agentId of agentsToRemove) {
      this.serverManager.agentRegistry.delete(agentId);
      cli.debug(`清理不活动的 Agent: ${agentId}`);
    }

    return agentsToRemove.length;
  }

  /**
   * 启动内存清理任务
   */
  startMemoryCleanup() {
    const interval = 10 * 60 * 1000; // 每10分钟清理一次
    const taskName = "memory_cleanup";

    this.cleanupIntervals.set(
      taskName,
      setInterval(async () => {
        await this.cleanupMemory();
      }, interval),
    );

    cli.debug(`内存清理任务已启动 (间隔: ${interval / 60000} 分钟)`);
  }

  /**
   * 清理内存
   */
  async cleanupMemory() {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      // 清理过期的缓存数据
      if (this.serverManager.performanceOptimizer) {
        // 重置性能统计如果太久没更新
        const stats =
          this.serverManager.performanceOptimizer.getPerformanceStats();
        const now = Date.now();

        // 这里可以添加更复杂的内存清理逻辑
        // 例如清理旧的性能统计记录
      }

      // 建议 Node.js 进行垃圾回收（如果启用）
      if (global.gc) {
        global.gc();
        cleaned++;
        cli.debug("执行垃圾回收");
      }

      // 更新统计
      this.cleanupStats.memory.cleaned += cleaned;

      const duration = Date.now() - startTime;
      return { cleaned, duration };
    } catch (error) {
      cli.error(`内存清理任务失败: ${error.message}`);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * 启动令牌清理任务
   */
  startTokenCleanup() {
    const interval = 15 * 60 * 1000; // 每15分钟清理一次
    const taskName = "token_cleanup";

    this.cleanupIntervals.set(
      taskName,
      setInterval(async () => {
        await this.cleanupExpiredTokens();
      }, interval),
    );

    cli.debug(`令牌清理任务已启动 (间隔: ${interval / 60000} 分钟)`);
  }

  /**
   * 清理过期令牌
   */
  async cleanupExpiredTokens() {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      // 清理令牌管理器中的过期令牌
      if (this.serverManager.tokenManager) {
        // 调用令牌管理器的清理方法
        // 注意：需要 tokenManager 实现 cleanupExpiredTokens 方法
        if (
          typeof this.serverManager.tokenManager.cleanupExpiredTokens ===
          "function"
        ) {
          cleaned =
            await this.serverManager.tokenManager.cleanupExpiredTokens();
        }
      }

      // 更新统计
      this.cleanupStats.tokens.cleaned += cleaned;

      const duration = Date.now() - startTime;
      if (cleaned > 0) {
        cli.debug(`令牌清理完成: 清理了 ${cleaned} 个令牌, 耗时 ${duration}ms`);
      }

      return { cleaned, duration };
    } catch (error) {
      cli.error(`令牌清理任务失败: ${error.message}`);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * 启动临时文件清理任务
   */
  startTempFileCleanup() {
    const interval = 60 * 60 * 1000; // 每小时清理一次
    const taskName = "temp_file_cleanup";

    this.cleanupIntervals.set(
      taskName,
      setInterval(async () => {
        await this.cleanupTempFiles();
      }, interval),
    );

    cli.debug(`临时文件清理任务已启动 (间隔: ${interval / 60000} 分钟)`);
  }

  /**
   * 清理临时文件
   */
  async cleanupTempFiles() {
    const startTime = Date.now();
    let cleaned = 0;
    let failed = 0;

    try {
      const tempDir = path.join(this.config.getDataDir(), "temp");
      if (!(await fs.pathExists(tempDir))) {
        return { cleaned, failed };
      }

      const now = Date.now();
      const maxAge = 24 * 60 * 60 * 1000; // 24小时

      const entries = await fs.readdir(tempDir);
      for (const entry of entries) {
        const entryPath = path.join(tempDir, entry);
        try {
          const stats = await fs.stat(entryPath);
          const age = now - stats.mtimeMs;

          if (age > maxAge) {
            await fs.remove(entryPath);
            cleaned++;
            cli.debug(`清理临时文件: ${entry}`);
          }
        } catch (error) {
          failed++;
          cli.warn(`清理临时文件失败 ${entry}: ${error.message}`);
        }
      }

      const duration = Date.now() - startTime;
      if (cleaned > 0) {
        cli.debug(
          `临时文件清理完成: 清理了 ${cleaned} 个文件, 耗时 ${duration}ms`,
        );
      }

      return { cleaned, failed, duration };
    } catch (error) {
      cli.error(`临时文件清理任务失败: ${error.message}`);
      return { cleaned: 0, failed: 1, error: error.message };
    }
  }

  /**
   * 启动监控清理任务
   */
  startMonitoringCleanup() {
    const interval = 30 * 60 * 1000; // 每30分钟清理一次
    const taskName = "monitoring_cleanup";

    this.cleanupIntervals.set(
      taskName,
      setInterval(async () => {
        await this.cleanupMonitoringData();
      }, interval),
    );

    cli.debug(`监控清理任务已启动 (间隔: ${interval / 60000} 分钟)`);
  }

  /**
   * 清理监控数据
   */
  async cleanupMonitoringData() {
    const startTime = Date.now();
    let cleaned = 0;

    try {
      // 清理旧的监控数据
      if (this.serverManager.monitoring) {
        // 调用监控系统的清理方法
        // 注意：需要 monitoring 实现 cleanupOldData 方法
        if (
          typeof this.serverManager.monitoring.cleanupOldData === "function"
        ) {
          cleaned = await this.serverManager.monitoring.cleanupOldData();
        }
      }

      // 清理旧的错误日志
      await this.cleanupOldErrorLogs();

      const duration = Date.now() - startTime;
      if (cleaned > 0) {
        cli.debug(`监控清理完成: 清理了 ${cleaned} 条记录, 耗时 ${duration}ms`);
      }

      return { cleaned, duration };
    } catch (error) {
      cli.error(`监控清理任务失败: ${error.message}`);
      return { cleaned: 0, error: error.message };
    }
  }

  /**
   * 清理旧的错误日志
   */
  async cleanupOldErrorLogs() {
    try {
      const errorLogPath = path.join(
        this.config.getDataDir(),
        "logs",
        "errors.json",
      );
      if (!(await fs.pathExists(errorLogPath))) {
        return 0;
      }

      const errorLog = await fs.readJson(errorLogPath);
      const maxRecentErrors = 100; // 最多保留100个最近错误

      if (errorLog.recent && errorLog.recent.length > maxRecentErrors) {
        errorLog.recent = errorLog.recent.slice(-maxRecentErrors);
        await fs.writeJson(errorLogPath, errorLog, { spaces: 2 });
        return errorLog.recent.length;
      }

      return 0;
    } catch (error) {
      cli.warn(`清理错误日志失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 获取清理统计
   */
  getCleanupStats() {
    return {
      ...this.cleanupStats,
      activeTasks: Array.from(this.cleanupIntervals.keys()),
      taskCount: this.cleanupIntervals.size,
    };
  }

  /**
   * 重置清理统计
   */
  resetCleanupStats() {
    this.cleanupStats = {
      files: { total: 0, cleaned: 0, failed: 0 },
      connections: { total: 0, cleaned: 0, failed: 0 },
      memory: { total: 0, cleaned: 0, failed: 0 },
      tokens: { total: 0, cleaned: 0, failed: 0 },
    };
    cli.info("清理统计已重置");
  }

  /**
   * 执行全面清理
   */
  async performFullCleanup() {
    cli.title("执行全面资源清理");

    const results = {
      files: await this.cleanupExpiredFiles(),
      connections: await this.cleanupIdleConnections(),
      memory: await this.cleanupMemory(),
      tokens: await this.cleanupExpiredTokens(),
      tempFiles: await this.cleanupTempFiles(),
      monitoring: await this.cleanupMonitoringData(),
    };

    cli.title("全面清理结果");
    for (const [resource, result] of Object.entries(results)) {
      if (result.cleaned > 0 || result.failed > 0) {
        cli.info(
          `${resource}: 清理了 ${result.cleaned} 个, 失败 ${result.failed || 0} 个`,
        );
      }
    }

    return results;
  }
}

module.exports = ResourceCleaner;
