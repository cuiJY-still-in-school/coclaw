const { cli } = require("./cli");

/**
 * 性能优化器
 * 优化消息路由和文件传输性能
 */
class PerformanceOptimizer {
  constructor(config, monitoring = null) {
    this.config = config;
    this.monitoring = monitoring;
    this.optimizationEnabled = config.get(
      "performance.optimizationEnabled",
      true,
    );
    this.performanceStats = {
      messageRouting: {
        totalMessages: 0,
        averageLatency: 0,
        peakLatency: 0,
        latencyHistory: [], // 最近100个延迟记录
      },
      fileTransfer: {
        totalFiles: 0,
        totalBytes: 0,
        averageSpeed: 0,
        speedHistory: [], // 最近100个速度记录
      },
      connections: {
        active: 0,
        peak: 0,
        totalOpened: 0,
        totalClosed: 0,
      },
    };
    this.optimizationStrategies = this.setupOptimizationStrategies();
  }

  /**
   * 设置优化策略
   */
  setupOptimizationStrategies() {
    return {
      // 消息批处理
      messageBatching: {
        enabled: true,
        batchSize: 10, // 每批消息数量
        batchTimeout: 100, // 批处理超时(ms)
        currentBatch: [],
        batchTimer: null,
      },

      // 连接池
      connectionPooling: {
        enabled: true,
        maxPoolSize: 50,
        idleTimeout: 30000, // 空闲超时(ms)
        pools: new Map(), // target -> connection[]
      },

      // 消息压缩
      messageCompression: {
        enabled: true,
        minSize: 1024, // 最小压缩大小(字节)
        compressionLevel: 6, // 压缩级别(1-9)
      },

      // 文件传输优化
      fileTransferOptimization: {
        enabled: true,
        chunkSize: 64 * 1024, // 分块大小(64KB)
        parallelUploads: 3, // 并行上传数
        bufferPoolSize: 10, // 缓冲区池大小
      },

      // 缓存优化
      caching: {
        enabled: true,
        permissionCacheTTL: 300000, // 权限缓存TTL(5分钟)
        agentInfoCacheTTL: 60000, // Agent信息缓存TTL(1分钟)
        messageCacheTTL: 30000, // 消息缓存TTL(30秒)
      },
    };
  }

  /**
   * 记录消息路由性能
   */
  recordMessageRouting(fromAgentId, toAgentId, messageSize, latency) {
    if (!this.optimizationEnabled) return;

    const stats = this.performanceStats.messageRouting;
    stats.totalMessages++;

    // 更新平均延迟
    stats.averageLatency =
      (stats.averageLatency * (stats.totalMessages - 1) + latency) /
      stats.totalMessages;

    // 更新峰值延迟
    if (latency > stats.peakLatency) {
      stats.peakLatency = latency;
    }

    // 记录延迟历史
    stats.latencyHistory.push({
      timestamp: Date.now(),
      latency,
      fromAgentId,
      toAgentId,
      messageSize,
    });

    // 只保留最近100个记录
    if (stats.latencyHistory.length > 100) {
      stats.latencyHistory.shift();
    }

    // 监控记录
    if (this.monitoring) {
      this.monitoring.logMessage("routed", fromAgentId, toAgentId, true);
    }
  }

  /**
   * 记录文件传输性能
   */
  recordFileTransfer(fileId, fileSize, transferTime, success = true) {
    if (!this.optimizationEnabled) return;

    const stats = this.performanceStats.fileTransfer;
    stats.totalFiles++;
    stats.totalBytes += fileSize;

    // 计算传输速度 (字节/秒)
    const speed = fileSize / (transferTime / 1000);

    // 更新平均速度
    if (stats.totalFiles === 1) {
      stats.averageSpeed = speed;
    } else {
      stats.averageSpeed =
        (stats.averageSpeed * (stats.totalFiles - 1) + speed) /
        stats.totalFiles;
    }

    // 记录速度历史
    stats.speedHistory.push({
      timestamp: Date.now(),
      speed,
      fileSize,
      transferTime,
      success,
    });

    // 只保留最近100个记录
    if (stats.speedHistory.length > 100) {
      stats.speedHistory.shift();
    }
  }

  /**
   * 记录连接状态
   */
  recordConnection(action, clientId, clientType) {
    if (!this.optimizationEnabled) return;

    const stats = this.performanceStats.connections;

    if (action === "open") {
      stats.active++;
      stats.totalOpened++;
      if (stats.active > stats.peak) {
        stats.peak = stats.active;
      }
    } else if (action === "close") {
      stats.active = Math.max(0, stats.active - 1);
      stats.totalClosed++;
    }
  }

  /**
   * 优化消息路由
   */
  async optimizeMessageRouting(message, context) {
    if (!this.optimizationEnabled) {
      return message;
    }

    const { fromAgentId, toAgentId } = context;
    const startTime = Date.now();

    try {
      let optimizedMessage = { ...message };

      // 1. 消息批处理
      if (this.optimizationStrategies.messageBatching.enabled) {
        optimizedMessage = await this.applyMessageBatching(
          optimizedMessage,
          context,
        );
      }

      // 2. 消息压缩
      if (this.optimizationStrategies.messageCompression.enabled) {
        optimizedMessage = await this.applyMessageCompression(
          optimizedMessage,
          context,
        );
      }

      // 3. 路由缓存
      if (this.optimizationStrategies.caching.enabled) {
        optimizedMessage = await this.applyRoutingCache(
          optimizedMessage,
          context,
        );
      }

      const endTime = Date.now();
      const latency = endTime - startTime;

      // 记录性能
      this.recordMessageRouting(
        fromAgentId,
        toAgentId,
        JSON.stringify(optimizedMessage).length,
        latency,
      );

      return optimizedMessage;
    } catch (error) {
      cli.warn(`消息路由优化失败: ${error.message}`);
      // 返回原始消息
      return message;
    }
  }

  /**
   * 应用消息批处理
   */
  async applyMessageBatching(message, context) {
    const { fromAgentId, toAgentId } = context;
    const strategy = this.optimizationStrategies.messageBatching;

    // 创建批处理键
    const batchKey = `${fromAgentId}:${toAgentId}`;

    // 添加到当前批次
    strategy.currentBatch.push({
      message,
      context,
      timestamp: Date.now(),
    });

    // 如果批次未满且没有定时器，设置定时器
    if (
      !strategy.batchTimer &&
      strategy.currentBatch.length < strategy.batchSize
    ) {
      strategy.batchTimer = setTimeout(() => {
        this.processMessageBatch(batchKey);
      }, strategy.batchTimeout);
    }

    // 如果批次已满，立即处理
    if (strategy.currentBatch.length >= strategy.batchSize) {
      if (strategy.batchTimer) {
        clearTimeout(strategy.batchTimer);
        strategy.batchTimer = null;
      }
      return this.processMessageBatch(batchKey);
    }

    // 返回原始消息（批处理中）
    return message;
  }

  /**
   * 处理消息批次
   */
  async processMessageBatch(batchKey) {
    const strategy = this.optimizationStrategies.messageBatching;
    const batch = strategy.currentBatch;
    strategy.currentBatch = [];
    strategy.batchTimer = null;

    if (batch.length === 0) {
      return null;
    }

    // 合并消息
    const batchedMessage = {
      type: "batch_message",
      data: {
        messages: batch.map((item) => ({
          originalType: item.message.type,
          data: item.message.data,
          context: item.context,
          timestamp: item.timestamp,
        })),
        batchSize: batch.length,
        batchId: `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      },
    };

    cli.debug(`消息批处理: 合并了 ${batch.length} 条消息`);

    return batchedMessage;
  }

  /**
   * 应用消息压缩
   */
  async applyMessageCompression(message, context) {
    const strategy = this.optimizationStrategies.messageCompression;
    const messageString = JSON.stringify(message);

    // 只有大于最小大小的消息才压缩
    if (messageString.length < strategy.minSize) {
      return message;
    }

    try {
      // 这里可以使用实际的压缩库，如 zlib
      // 暂时返回原始消息，标记为可压缩
      return {
        ...message,
        _compressed: false, // 标记为未压缩（实际实现中会压缩）
        _originalSize: messageString.length,
      };
    } catch (error) {
      cli.warn(`消息压缩失败: ${error.message}`);
      return message;
    }
  }

  /**
   * 应用路由缓存
   */
  async applyRoutingCache(message, context) {
    const { fromAgentId, toAgentId } = context;
    const strategy = this.optimizationStrategies.caching;

    // 创建缓存键
    const cacheKey = `route:${fromAgentId}:${toAgentId}:${message.type}`;

    // 检查缓存（实际实现中会使用内存或Redis缓存）
    // 这里只是示例
    const cached = null; // 实际从缓存获取

    if (cached && Date.now() - cached.timestamp < strategy.permissionCacheTTL) {
      cli.debug(`使用缓存路由: ${fromAgentId} -> ${toAgentId}`);
      return cached.message;
    }

    // 没有缓存或缓存过期，返回原始消息
    return message;
  }

  /**
   * 优化文件传输
   */
  async optimizeFileTransfer(fileInfo, context) {
    if (!this.optimizationEnabled) {
      return fileInfo;
    }

    const startTime = Date.now();
    const strategy = this.optimizationStrategies.fileTransferOptimization;

    try {
      let optimizedTransfer = { ...fileInfo };

      // 1. 文件分块
      if (fileInfo.size > strategy.chunkSize) {
        optimizedTransfer = await this.applyFileChunking(
          optimizedTransfer,
          context,
        );
      }

      // 2. 并行传输
      if (strategy.parallelUploads > 1) {
        optimizedTransfer = await this.applyParallelTransfer(
          optimizedTransfer,
          context,
        );
      }

      // 3. 缓冲区优化
      optimizedTransfer = await this.applyBufferOptimization(
        optimizedTransfer,
        context,
      );

      const endTime = Date.now();
      const transferTime = endTime - startTime;

      // 记录性能
      this.recordFileTransfer(
        fileInfo.fileId || "unknown",
        fileInfo.size || 0,
        transferTime,
        true,
      );

      return optimizedTransfer;
    } catch (error) {
      cli.warn(`文件传输优化失败: ${error.message}`);
      // 返回原始文件信息
      return fileInfo;
    }
  }

  /**
   * 应用文件分块
   */
  async applyFileChunking(fileInfo, context) {
    const strategy = this.optimizationStrategies.fileTransferOptimization;
    const chunkSize = strategy.chunkSize;
    const fileSize = fileInfo.size || 0;

    // 计算分块数量
    const chunkCount = Math.ceil(fileSize / chunkSize);

    return {
      ...fileInfo,
      chunked: true,
      chunkSize,
      chunkCount,
      chunks: Array.from({ length: chunkCount }, (_, i) => ({
        index: i,
        offset: i * chunkSize,
        size: Math.min(chunkSize, fileSize - i * chunkSize),
        uploaded: false,
      })),
    };
  }

  /**
   * 应用并行传输
   */
  async applyParallelTransfer(fileInfo, context) {
    const strategy = this.optimizationStrategies.fileTransferOptimization;

    if (!fileInfo.chunked || fileInfo.chunkCount <= 1) {
      return fileInfo;
    }

    return {
      ...fileInfo,
      parallelUploads: Math.min(strategy.parallelUploads, fileInfo.chunkCount),
      uploadStrategy: "parallel",
    };
  }

  /**
   * 应用缓冲区优化
   */
  async applyBufferOptimization(fileInfo, context) {
    const strategy = this.optimizationStrategies.fileTransferOptimization;

    // 计算最优缓冲区大小
    const optimalBufferSize = Math.min(
      strategy.chunkSize * 2, // 最大为2个分块大小
      Math.max(64 * 1024, fileInfo.size / 100), // 至少64KB，最多文件大小的1%
    );

    return {
      ...fileInfo,
      bufferSize: optimalBufferSize,
      bufferPool: strategy.bufferPoolSize,
    };
  }

  /**
   * 优化连接管理
   */
  async optimizeConnection(connectionInfo, context) {
    if (!this.optimizationEnabled) {
      return connectionInfo;
    }

    const strategy = this.optimizationStrategies.connectionPooling;

    try {
      let optimizedConnection = { ...connectionInfo };

      // 1. 连接池管理
      if (strategy.enabled) {
        optimizedConnection = await this.applyConnectionPooling(
          optimizedConnection,
          context,
        );
      }

      // 2. 记录连接状态
      this.recordConnection(
        "open",
        connectionInfo.clientId,
        connectionInfo.type,
      );

      return optimizedConnection;
    } catch (error) {
      cli.warn(`连接优化失败: ${error.message}`);
      return connectionInfo;
    }
  }

  /**
   * 应用连接池
   */
  async applyConnectionPooling(connectionInfo, context) {
    const strategy = this.optimizationStrategies.connectionPooling;
    const { target } = context;

    if (!target) {
      return connectionInfo;
    }

    // 获取或创建连接池
    if (!strategy.pools.has(target)) {
      strategy.pools.set(target, []);
    }

    const pool = strategy.pools.get(target);

    // 检查是否有空闲连接
    const idleConnection = pool.find((conn) => conn.idle);
    if (idleConnection) {
      cli.debug(`重用连接池中的空闲连接: ${target}`);
      idleConnection.idle = false;
      idleConnection.lastUsed = Date.now();
      return {
        ...connectionInfo,
        pooled: true,
        reused: true,
        poolId: idleConnection.id,
      };
    }

    // 检查池大小
    if (pool.length >= strategy.maxPoolSize) {
      // 清理最旧的空闲连接
      const oldestIdle = pool
        .filter((conn) => conn.idle)
        .sort((a, b) => a.lastUsed - b.lastUsed)[0];

      if (oldestIdle) {
        cli.debug(`清理空闲连接: ${target}`);
        pool.splice(pool.indexOf(oldestIdle), 1);
      }
    }

    // 创建新连接
    const newConnection = {
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      target,
      created: Date.now(),
      lastUsed: Date.now(),
      idle: false,
    };

    pool.push(newConnection);

    return {
      ...connectionInfo,
      pooled: true,
      reused: false,
      poolId: newConnection.id,
    };
  }

  /**
   * 释放连接回池
   */
  async releaseConnection(connectionId, target) {
    if (!this.optimizationEnabled) return;

    const strategy = this.optimizationStrategies.connectionPooling;

    if (!strategy.pools.has(target)) {
      return;
    }

    const pool = strategy.pools.get(target);
    const connection = pool.find((conn) => conn.id === connectionId);

    if (connection) {
      connection.idle = true;
      connection.lastUsed = Date.now();
      cli.debug(`连接释放回池: ${target}`);
    }

    // 记录连接关闭
    this.recordConnection("close", connectionId, "pooled");
  }

  /**
   * 清理空闲连接
   */
  cleanupIdleConnections() {
    if (!this.optimizationEnabled) return;

    const strategy = this.optimizationStrategies.connectionPooling;
    const now = Date.now();
    let cleaned = 0;

    for (const [target, pool] of strategy.pools.entries()) {
      const activeConnections = pool.filter((conn) => !conn.idle);
      const idleConnections = pool.filter((conn) => conn.idle);

      // 清理超时空闲连接
      const toRemove = idleConnections.filter(
        (conn) => now - conn.lastUsed > strategy.idleTimeout,
      );

      toRemove.forEach((conn) => {
        pool.splice(pool.indexOf(conn), 1);
        cleaned++;
      });

      // 如果池为空，删除池
      if (pool.length === 0) {
        strategy.pools.delete(target);
      }
    }

    if (cleaned > 0) {
      cli.debug(`清理了 ${cleaned} 个空闲连接`);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    const stats = { ...this.performanceStats };

    // 计算消息路由性能指标
    const latencyHistory = stats.messageRouting.latencyHistory;
    if (latencyHistory.length > 0) {
      const recentLatencies = latencyHistory.slice(-20).map((h) => h.latency);
      stats.messageRouting.recentAverageLatency =
        recentLatencies.reduce((sum, lat) => sum + lat, 0) /
        recentLatencies.length;
      stats.messageRouting.latencyStdDev =
        this.calculateStdDev(recentLatencies);
    }

    // 计算文件传输性能指标
    const speedHistory = stats.fileTransfer.speedHistory;
    if (speedHistory.length > 0) {
      const recentSpeeds = speedHistory.slice(-20).map((h) => h.speed);
      stats.fileTransfer.recentAverageSpeed =
        recentSpeeds.reduce((sum, speed) => sum + speed, 0) /
        recentSpeeds.length;
      stats.fileTransfer.speedStdDev = this.calculateStdDev(recentSpeeds);
    }

    // 计算连接使用率
    stats.connections.utilization =
      stats.connections.peak > 0
        ? (stats.connections.active / stats.connections.peak) * 100
        : 0;

    // 优化策略状态
    stats.optimizationStrategies = {};
    for (const [name, strategy] of Object.entries(
      this.optimizationStrategies,
    )) {
      stats.optimizationStrategies[name] = {
        enabled: strategy.enabled,
        ...(name === "connectionPooling"
          ? { poolCount: strategy.pools.size }
          : {}),
        ...(name === "messageBatching"
          ? { currentBatchSize: strategy.currentBatch.length }
          : {}),
      };
    }

    return stats;
  }

  /**
   * 计算标准差
   */
  calculateStdDev(values) {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance =
      squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;

    return Math.sqrt(variance);
  }

  /**
   * 重置性能统计
   */
  resetPerformanceStats() {
    this.performanceStats = {
      messageRouting: {
        totalMessages: 0,
        averageLatency: 0,
        peakLatency: 0,
        latencyHistory: [],
      },
      fileTransfer: {
        totalFiles: 0,
        totalBytes: 0,
        averageSpeed: 0,
        speedHistory: [],
      },
      connections: {
        active: 0,
        peak: 0,
        totalOpened: 0,
        totalClosed: 0,
      },
    };
  }

  /**
   * 启用/禁用优化
   */
  setOptimizationEnabled(enabled) {
    this.optimizationEnabled = enabled;
    cli.info(`性能优化 ${enabled ? "启用" : "禁用"}`);
  }

  /**
   * 更新优化策略配置
   */
  updateOptimizationStrategy(strategyName, updates) {
    if (this.optimizationStrategies[strategyName]) {
      Object.assign(this.optimizationStrategies[strategyName], updates);
      cli.info(`更新优化策略: ${strategyName}`);
    }
  }
}

module.exports = PerformanceOptimizer;
