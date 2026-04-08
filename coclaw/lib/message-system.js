const { cli } = require("./cli");
const fs = require("fs-extra");
const path = require("path");

/**
 * 消息系统
 * 负责消息的路由、存储和转发
 */
class MessageSystem {
  constructor(config, agentRegistry, serverManager) {
    this.config = config;
    this.agentRegistry = agentRegistry; // 来自 server-manager
    this.serverManager = serverManager; // 来自 server-manager
    this.messageQueue = new Map(); // agentId -> message[]
    this.messageHistory = new Map(); // agentId -> history[]
  }

  /**
   * 发送消息
   * @param {Object} options - 消息选项
   */
  async sendMessage(options) {
    const {
      fromAgentId,
      toAgentId,
      message,
      messageType = "text",
      metadata = {},
    } = options;

    try {
      // 验证参数
      if (!fromAgentId || !toAgentId || !message) {
        throw new Error("缺少必要参数: fromAgentId, toAgentId, message");
      }

      // 检查发送者是否存在
      const fromAgent = this.agentRegistry.get(fromAgentId);
      if (!fromAgent) {
        throw new Error(`发送者 Agent 未找到: ${fromAgentId}`);
      }

      // 检查接收者是否存在
      const toAgent = this.agentRegistry.get(toAgentId);
      if (!toAgent) {
        throw new Error(`接收者 Agent 未找到: ${toAgentId}`);
      }

      // 检查权限（TODO: 实现完整的权限检查）
      const hasPermission = await this.checkMessagePermission(
        fromAgentId,
        toAgentId,
      );
      if (!hasPermission) {
        throw new Error(`没有权限向 ${toAgentId} 发送消息`);
      }

      // 创建消息对象
      const messageObj = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        fromAgentId,
        toAgentId,
        message,
        messageType,
        metadata,
        timestamp: new Date().toISOString(),
        status: "pending",
      };

      cli.debug(`消息发送: ${fromAgentId} -> ${toAgentId} (${messageType})`);

      // 存储到历史记录
      await this.storeMessage(messageObj);

      // 尝试直接发送
      const delivered = await this.deliverMessage(messageObj, toAgent);

      if (delivered) {
        messageObj.status = "delivered";
        messageObj.deliveredAt = new Date().toISOString();
        await this.updateMessageStatus(messageObj.id, "delivered");

        cli.debug(`消息已送达: ${messageObj.id}`);
        return {
          success: true,
          messageId: messageObj.id,
          delivered: true,
        };
      } else {
        // 加入队列等待重试
        messageObj.status = "queued";
        await this.updateMessageStatus(messageObj.id, "queued");
        await this.queueMessage(messageObj);

        cli.debug(`消息加入队列: ${messageObj.id}`);
        return {
          success: true,
          messageId: messageObj.id,
          delivered: false,
          queued: true,
        };
      }
    } catch (error) {
      cli.error(`发送消息失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 投递消息
   * @param {Object} messageObj - 消息对象
   * @param {Object} targetAgent - 目标 Agent
   */
  async deliverMessage(messageObj, targetAgent) {
    try {
      // 检查目标 Agent 是否在线
      if (!targetAgent.wsClient || targetAgent.wsClient.readyState !== 1) {
        cli.debug(`目标 Agent 未连接: ${targetAgent.agentId}`);
        return false;
      }

      // 准备消息数据
      const messageData = {
        type: "agent_message",
        data: {
          messageId: messageObj.id,
          fromAgentId: messageObj.fromAgentId,
          message: messageObj.message,
          messageType: messageObj.messageType,
          metadata: messageObj.metadata,
          timestamp: messageObj.timestamp,
        },
      };

      // 发送消息
      targetAgent.wsClient.send(JSON.stringify(messageData));

      cli.debug(`消息已发送到 WebSocket: ${messageObj.id}`);
      return true;
    } catch (error) {
      cli.warn(`投递消息失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 检查消息权限
   * @param {string} fromAgentId
   * @param {string} toAgentId
   */
  async checkMessagePermission(fromAgentId, toAgentId) {
    try {
      // 如果是同一个 Agent，允许发送
      if (fromAgentId === toAgentId) {
        return true;
      }

      // 加载发送者的关系配置
      const relationsPath = this.config.getAgentRelationsPath(fromAgentId);
      if (!(await fs.pathExists(relationsPath))) {
        cli.warn(`未找到关系配置: ${fromAgentId}`);
        return false; // 默认不允许
      }

      const relationsContent = await fs.readFile(relationsPath, "utf8");
      const relations = JSON.parse(relationsContent);

      // 查找目标 Agent 的关系配置
      const relation = relations.relations.find(
        (r) => r.targetAgentId === toAgentId,
      );

      if (!relation) {
        cli.warn(`未找到关系配置: ${fromAgentId} -> ${toAgentId}`);
        return false;
      }

      return relation.allowCommunication === true;
    } catch (error) {
      cli.warn(`检查权限失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 存储消息
   * @param {Object} messageObj
   */
  async storeMessage(messageObj) {
    try {
      const { fromAgentId, toAgentId } = messageObj;

      // 存储到发送者历史
      await this.addToHistory(fromAgentId, messageObj, "sent");

      // 存储到接收者历史
      await this.addToHistory(toAgentId, messageObj, "received");

      // 保存到文件（持久化）
      await this.saveMessageToFile(messageObj);

      cli.debug(`消息已存储: ${messageObj.id}`);
    } catch (error) {
      cli.warn(`存储消息失败: ${error.message}`);
    }
  }

  /**
   * 添加到历史记录
   * @param {string} agentId
   * @param {Object} messageObj
   * @param {string} direction - 'sent' 或 'received'
   */
  async addToHistory(agentId, messageObj, direction) {
    if (!this.messageHistory.has(agentId)) {
      this.messageHistory.set(agentId, []);
    }

    const history = this.messageHistory.get(agentId);
    history.push({
      ...messageObj,
      direction,
      storedAt: new Date().toISOString(),
    });

    // 限制历史记录大小
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  /**
   * 保存消息到文件
   * @param {Object} messageObj
   */
  async saveMessageToFile(messageObj) {
    try {
      const { fromAgentId, toAgentId } = messageObj;

      // 保存到发送者目录
      const senderDir = path.join(
        this.config.getAgentDataDir(fromAgentId),
        "messages",
        "sent",
      );
      await fs.ensureDir(senderDir);

      const senderFile = path.join(senderDir, `${messageObj.id}.json`);
      await fs.writeFile(senderFile, JSON.stringify(messageObj, null, 2));

      // 保存到接收者目录
      const receiverDir = path.join(
        this.config.getAgentDataDir(toAgentId),
        "messages",
        "received",
      );
      await fs.ensureDir(receiverDir);

      const receiverFile = path.join(receiverDir, `${messageObj.id}.json`);
      await fs.writeFile(receiverFile, JSON.stringify(messageObj, null, 2));
    } catch (error) {
      cli.warn(`保存消息到文件失败: ${error.message}`);
    }
  }

  /**
   * 更新消息状态
   * @param {string} messageId
   * @param {string} status
   */
  async updateMessageStatus(messageId, status) {
    try {
      // 更新内存中的状态
      for (const [agentId, history] of this.messageHistory.entries()) {
        const message = history.find((msg) => msg.id === messageId);
        if (message) {
          message.status = status;
          if (status === "delivered") {
            message.deliveredAt = new Date().toISOString();
          }
        }
      }

      // 更新文件状态
      await this.updateMessageFileStatus(messageId, status);
    } catch (error) {
      cli.warn(`更新消息状态失败: ${error.message}`);
    }
  }

  /**
   * 更新消息文件状态
   * @param {string} messageId
   * @param {string} status
   */
  async updateMessageFileStatus(messageId, status) {
    try {
      // 查找消息文件
      const messagesDir = path.join(this.config.configDir, "agents");
      const agentDirs = await fs.readdir(messagesDir);

      for (const agentId of agentDirs) {
        const sentDir = path.join(
          messagesDir,
          agentId,
          "data",
          "messages",
          "sent",
        );
        const receivedDir = path.join(
          messagesDir,
          agentId,
          "data",
          "messages",
          "received",
        );

        // 检查发送目录
        if (await fs.pathExists(sentDir)) {
          const sentFile = path.join(sentDir, `${messageId}.json`);
          if (await fs.pathExists(sentFile)) {
            const content = await fs.readFile(sentFile, "utf8");
            const message = JSON.parse(content);
            message.status = status;
            if (status === "delivered") {
              message.deliveredAt = new Date().toISOString();
            }
            await fs.writeFile(sentFile, JSON.stringify(message, null, 2));
          }
        }

        // 检查接收目录
        if (await fs.pathExists(receivedDir)) {
          const receivedFile = path.join(receivedDir, `${messageId}.json`);
          if (await fs.pathExists(receivedFile)) {
            const content = await fs.readFile(receivedFile, "utf8");
            const message = JSON.parse(content);
            message.status = status;
            await fs.writeFile(receivedFile, JSON.stringify(message, null, 2));
          }
        }
      }
    } catch (error) {
      cli.warn(`更新消息文件状态失败: ${error.message}`);
    }
  }

  /**
   * 队列消息
   * @param {Object} messageObj
   */
  async queueMessage(messageObj) {
    const { toAgentId } = messageObj;

    if (!this.messageQueue.has(toAgentId)) {
      this.messageQueue.set(toAgentId, []);
    }

    const queue = this.messageQueue.get(toAgentId);
    queue.push(messageObj);

    // 启动重试机制
    this.startRetryForAgent(toAgentId);
  }

  /**
   * 启动重试机制
   * @param {string} agentId
   */
  startRetryForAgent(agentId) {
    if (this.retryTimers && this.retryTimers[agentId]) {
      clearTimeout(this.retryTimers[agentId]);
    }

    if (!this.retryTimers) {
      this.retryTimers = {};
    }

    this.retryTimers[agentId] = setTimeout(() => {
      this.retryQueuedMessages(agentId);
    }, 5000); // 5秒后重试
  }

  /**
   * 重试队列中的消息
   * @param {string} agentId
   */
  async retryQueuedMessages(agentId) {
    const queue = this.messageQueue.get(agentId);
    if (!queue || queue.length === 0) {
      return;
    }

    const targetAgent = this.agentRegistry.get(agentId);
    if (
      !targetAgent ||
      !targetAgent.wsClient ||
      targetAgent.wsClient.readyState !== 1
    ) {
      // Agent 仍然离线，稍后重试
      this.startRetryForAgent(agentId);
      return;
    }

    cli.debug(`重试队列消息: ${agentId} (${queue.length} 条)`);

    // 尝试发送队列中的消息
    const successfulMessages = [];
    const failedMessages = [];

    for (const messageObj of queue) {
      const delivered = await this.deliverMessage(messageObj, targetAgent);
      if (delivered) {
        successfulMessages.push(messageObj.id);
        await this.updateMessageStatus(messageObj.id, "delivered");
      } else {
        failedMessages.push(messageObj);
      }
    }

    // 移除已发送的消息
    if (successfulMessages.length > 0) {
      const newQueue = queue.filter(
        (msg) => !successfulMessages.includes(msg.id),
      );
      this.messageQueue.set(agentId, newQueue);
      cli.debug(`成功发送 ${successfulMessages.length} 条消息到 ${agentId}`);
    }

    // 如果还有失败的消息，继续重试
    if (failedMessages.length > 0) {
      this.startRetryForAgent(agentId);
    }
  }

  /**
   * 获取消息历史
   * @param {string} agentId
   * @param {Object} options
   */
  async getMessageHistory(agentId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      direction = "all", // 'sent', 'received', 'all'
      withAgentId = null, // 特定 Agent 的对话
    } = options;

    try {
      let history = this.messageHistory.get(agentId) || [];

      // 从文件加载历史记录（如果内存中没有）
      if (history.length === 0) {
        history = await this.loadMessageHistoryFromFile(agentId);
        this.messageHistory.set(agentId, history);
      }

      // 过滤方向
      if (direction !== "all") {
        history = history.filter((msg) => msg.direction === direction);
      }

      // 过滤特定 Agent
      if (withAgentId) {
        history = history.filter(
          (msg) =>
            (msg.direction === "sent" && msg.toAgentId === withAgentId) ||
            (msg.direction === "received" && msg.fromAgentId === withAgentId),
        );
      }

      // 排序（最新的在前）
      history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // 分页
      const paginated = history.slice(offset, offset + limit);

      return {
        messages: paginated,
        total: history.length,
        hasMore: offset + limit < history.length,
      };
    } catch (error) {
      cli.error(`获取消息历史失败: ${error.message}`);
      return {
        messages: [],
        total: 0,
        hasMore: false,
        error: error.message,
      };
    }
  }

  /**
   * 从文件加载消息历史
   * @param {string} agentId
   */
  async loadMessageHistoryFromFile(agentId) {
    const history = [];

    try {
      // 加载发送的消息
      const sentDir = path.join(
        this.config.getAgentDataDir(agentId),
        "messages",
        "sent",
      );

      if (await fs.pathExists(sentDir)) {
        const sentFiles = await fs.readdir(sentDir);
        for (const file of sentFiles) {
          if (file.endsWith(".json")) {
            const content = await fs.readFile(path.join(sentDir, file), "utf8");
            const message = JSON.parse(content);
            history.push({
              ...message,
              direction: "sent",
            });
          }
        }
      }

      // 加载接收的消息
      const receivedDir = path.join(
        this.config.getAgentDataDir(agentId),
        "messages",
        "received",
      );

      if (await fs.pathExists(receivedDir)) {
        const receivedFiles = await fs.readdir(receivedDir);
        for (const file of receivedFiles) {
          if (file.endsWith(".json")) {
            const content = await fs.readFile(
              path.join(receivedDir, file),
              "utf8",
            );
            const message = JSON.parse(content);
            history.push({
              ...message,
              direction: "received",
            });
          }
        }
      }

      cli.debug(`从文件加载 ${history.length} 条消息历史: ${agentId}`);
    } catch (error) {
      cli.warn(`加载消息历史文件失败: ${error.message}`);
    }

    return history;
  }

  /**
   * 处理消息确认
   * @param {string} messageId
   * @param {string} agentId
   */
  async handleMessageAck(messageId, agentId) {
    try {
      await this.updateMessageStatus(messageId, "read");
      cli.debug(`消息已读确认: ${messageId} by ${agentId}`);

      return { success: true };
    } catch (error) {
      cli.warn(`处理消息确认失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 广播消息
   * @param {Object} options
   */
  async broadcastMessage(options) {
    const {
      fromAgentId,
      message,
      messageType = "text",
      metadata = {},
      excludeAgents = [],
    } = options;

    try {
      if (!fromAgentId || !message) {
        throw new Error("缺少必要参数: fromAgentId, message");
      }

      const results = [];
      const agentIds = Array.from(this.agentRegistry.keys()).filter(
        (id) => id !== fromAgentId && !excludeAgents.includes(id),
      );

      cli.debug(`广播消息到 ${agentIds.length} 个 Agent`);

      for (const toAgentId of agentIds) {
        try {
          const result = await this.sendMessage({
            fromAgentId,
            toAgentId,
            message,
            messageType,
            metadata,
          });
          results.push({ toAgentId, ...result });
        } catch (error) {
          results.push({
            toAgentId,
            success: false,
            error: error.message,
          });
        }
      }

      return {
        success: true,
        total: agentIds.length,
        results,
      };
    } catch (error) {
      cli.error(`广播消息失败: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 清理旧消息
   * @param {Object} options
   */
  async cleanupOldMessages(options = {}) {
    const { maxAgeDays = 30, maxMessagesPerAgent = 1000 } = options;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

      let deletedCount = 0;

      // 清理内存中的历史记录
      for (const [agentId, history] of this.messageHistory.entries()) {
        const originalLength = history.length;

        // 按时间过滤
        const filtered = history.filter(
          (msg) => new Date(msg.timestamp) > cutoffDate,
        );

        // 按数量限制
        if (filtered.length > maxMessagesPerAgent) {
          filtered.sort(
            (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
          );
          filtered.splice(maxMessagesPerAgent);
        }

        this.messageHistory.set(agentId, filtered);
        deletedCount += originalLength - filtered.length;
      }

      // 清理文件系统中的消息
      deletedCount += await this.cleanupMessageFiles(
        cutoffDate,
        maxMessagesPerAgent,
      );

      cli.debug(`清理了 ${deletedCount} 条旧消息`);
      return { success: true, deletedCount };
    } catch (error) {
      cli.warn(`清理旧消息失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清理消息文件
   * @param {Date} cutoffDate
   * @param {number} maxMessagesPerAgent
   */
  async cleanupMessageFiles(cutoffDate, maxMessagesPerAgent) {
    let deletedCount = 0;

    try {
      const agentsDir = path.join(this.config.configDir, "agents");
      if (!(await fs.pathExists(agentsDir))) {
        return 0;
      }

      const agentDirs = await fs.readdir(agentsDir);

      for (const agentId of agentDirs) {
        const sentDir = path.join(
          agentsDir,
          agentId,
          "data",
          "messages",
          "sent",
        );
        const receivedDir = path.join(
          agentsDir,
          agentId,
          "data",
          "messages",
          "received",
        );

        // 清理发送目录
        if (await fs.pathExists(sentDir)) {
          const sentFiles = await fs.readdir(sentDir);
          const sentMessages = [];

          for (const file of sentFiles) {
            if (file.endsWith(".json")) {
              const filePath = path.join(sentDir, file);
              const content = await fs.readFile(filePath, "utf8");
              const message = JSON.parse(content);
              sentMessages.push({
                filePath,
                timestamp: new Date(message.timestamp),
              });
            }
          }

          // 按时间排序（旧的在前）
          sentMessages.sort((a, b) => a.timestamp - b.timestamp);

          // 删除旧的消息
          for (let i = 0; i < sentMessages.length - maxMessagesPerAgent; i++) {
            await fs.remove(sentMessages[i].filePath);
            deletedCount++;
          }

          // 删除过期的消息
          for (const msg of sentMessages) {
            if (msg.timestamp < cutoffDate) {
              await fs.remove(msg.filePath);
              deletedCount++;
            }
          }
        }

        // 清理接收目录（类似逻辑）
        if (await fs.pathExists(receivedDir)) {
          const receivedFiles = await fs.readdir(receivedDir);
          const receivedMessages = [];

          for (const file of receivedFiles) {
            if (file.endsWith(".json")) {
              const filePath = path.join(receivedDir, file);
              const content = await fs.readFile(filePath, "utf8");
              const message = JSON.parse(content);
              receivedMessages.push({
                filePath,
                timestamp: new Date(message.timestamp),
              });
            }
          }

          receivedMessages.sort((a, b) => a.timestamp - b.timestamp);

          for (
            let i = 0;
            i < receivedMessages.length - maxMessagesPerAgent;
            i++
          ) {
            await fs.remove(receivedMessages[i].filePath);
            deletedCount++;
          }

          for (const msg of receivedMessages) {
            if (msg.timestamp < cutoffDate) {
              await fs.remove(msg.filePath);
              deletedCount++;
            }
          }
        }
      }
    } catch (error) {
      cli.warn(`清理消息文件失败: ${error.message}`);
    }

    return deletedCount;
  }
}

module.exports = MessageSystem;
