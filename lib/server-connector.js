const WebSocket = require("ws");
const { cli } = require("./cli");

/**
 * 服务器连接器
 * 管理多服务器之间的连接和同步
 */
class ServerConnector {
  constructor(config, serverManager) {
    this.config = config;
    this.serverManager = serverManager;
    this.connections = new Map(); // serverId -> connectionInfo
    this.messageQueue = new Map(); // serverId -> message[]
    this.reconnectIntervals = new Map(); // serverId -> intervalId
  }

  /**
   * 连接到远程服务器
   */
  async connectToServer(host, port, serverId = null) {
    const wsUrl = `ws://${host}:${port + 1}`;
    const serverKey = serverId || `${host}:${port}`;

    cli.info(`连接到服务器: ${wsUrl}`);

    // 检查是否已连接
    if (this.connections.has(serverKey)) {
      const existing = this.connections.get(serverKey);
      if (existing.ws.readyState === WebSocket.OPEN) {
        cli.warn(`已经连接到服务器: ${serverKey}`);
        return existing.ws;
      }
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);
      const connectionInfo = {
        ws,
        host,
        port,
        serverId: serverKey,
        connectedAt: new Date(),
        lastMessageAt: null,
        reconnectAttempts: 0,
        maxReconnectAttempts: 5,
        capabilities: [],
      };

      ws.on("open", () => {
        cli.debug("WebSocket 连接已建立");

        // 发送身份识别
        ws.send(
          JSON.stringify({
            type: "identify",
            data: {
              clientType: "server",
              serverId: this.config.get("server.id"),
              name: this.config.get("server.name", "Coclaw Server"),
              capabilities: [
                "agent_relay",
                "file_transfer",
                "message_sync",
                "discovery_relay",
              ],
              version: require("../package.json").version,
            },
          }),
        );

        // 保存连接
        this.connections.set(serverKey, connectionInfo);

        // 重置重连尝试
        connectionInfo.reconnectAttempts = 0;

        // 发送待处理的消息
        this.flushMessageQueue(serverKey);

        resolve(ws);
      });

      ws.on("error", (error) => {
        cli.error(`连接到服务器 ${serverKey} 失败: ${error.message}`);
        reject(error);
      });

      ws.on("close", (code, reason) => {
        cli.warn(`与服务器 ${serverKey} 的连接关闭: ${code} ${reason}`);
        this.handleDisconnection(serverKey, connectionInfo);
      });

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          connectionInfo.lastMessageAt = new Date();
          this.handleServerMessage(serverKey, connectionInfo, message);
        } catch (error) {
          cli.warn(`服务器消息解析失败: ${error.message}`);
        }
      });

      // 设置连接超时
      setTimeout(() => {
        if (ws.readyState !== WebSocket.OPEN) {
          ws.close();
          reject(new Error(`连接超时: ${serverKey}`));
        }
      }, 10000);
    });
  }

  /**
   * 处理服务器消息
   */
  handleServerMessage(serverKey, connectionInfo, message) {
    const { type, data } = message;

    switch (type) {
      case "welcome":
        cli.debug(
          `连接到远程服务器: ${data.serverInfo.name} v${data.serverInfo.version}`,
        );
        connectionInfo.capabilities = data.capabilities || [];
        break;

      case "identified":
        cli.info(`服务器身份验证成功: ${serverKey}`);
        break;

      case "agent_online":
        this.handleRemoteAgentOnline(data.agent, serverKey);
        break;

      case "agent_offline":
        this.handleRemoteAgentOffline(data.agentId, serverKey);
        break;

      case "agent_message":
        this.handleRemoteAgentMessage(data, serverKey);
        break;

      case "server_sync_request":
        this.handleSyncRequest(data, serverKey, connectionInfo);
        break;

      case "server_sync_response":
        this.handleSyncResponse(data, serverKey);
        break;

      default:
        cli.debug(`收到服务器消息 [${serverKey}]: ${type}`);
    }
  }

  /**
   * 处理远程 Agent 上线
   */
  handleRemoteAgentOnline(agent, sourceServer) {
    const remoteAgentId = `remote_${sourceServer}_${agent.agentId}`;

    // 添加到服务器管理器的注册表
    this.serverManager.serverRegistry.set(remoteAgentId, {
      ...agent,
      isRemote: true,
      sourceServer,
      remoteAgentId,
      lastSeen: new Date(),
    });

    cli.debug(
      `远程 Agent 上线: ${agent.name} (${agent.agentId}) from ${sourceServer}`,
    );
  }

  /**
   * 处理远程 Agent 离线
   */
  handleRemoteAgentOffline(agentId, sourceServer) {
    for (const [
      remoteAgentId,
      agent,
    ] of this.serverManager.serverRegistry.entries()) {
      if (agent.agentId === agentId && agent.sourceServer === sourceServer) {
        this.serverManager.serverRegistry.delete(remoteAgentId);
        cli.debug(`远程 Agent 离线: ${agentId} from ${sourceServer}`);
        break;
      }
    }
  }

  /**
   * 处理远程 Agent 消息
   */
  handleRemoteAgentMessage(messageData, sourceServer) {
    const { fromAgentId, toAgentId, message, messageType } = messageData;

    // 检查目标 Agent 是否在本服务器
    const targetAgent = this.serverManager.agentRegistry.get(toAgentId);
    if (targetAgent && targetAgent.wsClient) {
      // 转发消息给本地 Agent
      targetAgent.wsClient.send(
        JSON.stringify({
          type: "agent_message",
          data: {
            fromAgentId: `remote_${sourceServer}_${fromAgentId}`,
            message,
            messageType,
            timestamp: new Date().toISOString(),
            isRemote: true,
            sourceServer,
          },
        }),
      );

      cli.debug(`转发远程消息: ${fromAgentId}@${sourceServer} -> ${toAgentId}`);
    } else {
      // 目标 Agent 不在本服务器，尝试转发到其他服务器
      cli.debug(`目标 Agent 未找到: ${toAgentId}, 消息来自 ${sourceServer}`);
    }
  }

  /**
   * 处理同步请求
   */
  handleSyncRequest(data, serverKey, connectionInfo) {
    const { requestId, syncType } = data;

    let responseData = {};

    switch (syncType) {
      case "agents":
        responseData.agents = Array.from(
          this.serverManager.agentRegistry.values(),
        ).map((agent) => ({
          agentId: agent.agentId,
          name: agent.name,
          capabilities: agent.capabilities,
          isOnline: true,
        }));
        break;

      case "servers":
        responseData.servers = Array.from(this.connections.values()).map(
          (conn) => ({
            serverId: conn.serverId,
            host: conn.host,
            port: conn.port,
            connectedAt: conn.connectedAt,
          }),
        );
        break;

      default:
        cli.warn(`未知的同步类型: ${syncType}`);
        return;
    }

    // 发送同步响应
    connectionInfo.ws.send(
      JSON.stringify({
        type: "server_sync_response",
        data: {
          requestId,
          syncType,
          ...responseData,
        },
      }),
    );
  }

  /**
   * 处理同步响应
   */
  handleSyncResponse(data, serverKey) {
    const { requestId, syncType, ...syncData } = data;

    cli.debug(`收到同步响应 [${serverKey}]: ${syncType}`);

    switch (syncType) {
      case "agents":
        // 处理远程 Agent 列表
        for (const agent of syncData.agents || []) {
          this.handleRemoteAgentOnline(agent, serverKey);
        }
        break;

      case "servers":
        // 处理服务器列表（可用于自动连接）
        for (const server of syncData.servers || []) {
          if (server.serverId !== this.config.get("server.id")) {
            cli.debug(
              `发现可通过 ${serverKey} 访问的服务器: ${server.serverId}`,
            );
          }
        }
        break;
    }
  }

  /**
   * 发送消息到服务器
   */
  sendToServer(serverKey, message) {
    const connection = this.connections.get(serverKey);

    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      // 将消息加入队列，等待重连
      if (!this.messageQueue.has(serverKey)) {
        this.messageQueue.set(serverKey, []);
      }
      this.messageQueue.get(serverKey).push(message);
      return false;
    }

    try {
      connection.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      cli.error(`发送消息到服务器 ${serverKey} 失败: ${error.message}`);
      return false;
    }
  }

  /**
   * 广播消息到所有连接的服务器
   */
  broadcastToServers(message, excludeServer = null) {
    let sentCount = 0;

    for (const [serverKey, connection] of this.connections.entries()) {
      if (serverKey === excludeServer) {
        continue;
      }

      if (this.sendToServer(serverKey, message)) {
        sentCount++;
      }
    }

    return sentCount;
  }

  /**
   * 发送 Agent 上线通知
   */
  notifyAgentOnline(agent) {
    const message = {
      type: "agent_online",
      data: {
        agent: {
          agentId: agent.agentId,
          name: agent.name,
          capabilities: agent.capabilities || [],
          port: agent.port,
        },
      },
    };

    return this.broadcastToServers(message);
  }

  /**
   * 发送 Agent 离线通知
   */
  notifyAgentOffline(agentId) {
    const message = {
      type: "agent_offline",
      data: { agentId },
    };

    return this.broadcastToServers(message);
  }

  /**
   * 发送 Agent 消息到其他服务器
   */
  relayAgentMessage(messageData, sourceAgentId) {
    const { toAgentId, ...rest } = messageData;

    // 检查目标 Agent 是否在其他服务器
    for (const [
      remoteAgentId,
      agent,
    ] of this.serverManager.serverRegistry.entries()) {
      if (agent.agentId === toAgentId && agent.isRemote) {
        const message = {
          type: "agent_message",
          data: {
            fromAgentId: sourceAgentId,
            toAgentId,
            ...rest,
          },
        };

        return this.sendToServer(agent.sourceServer, message);
      }
    }

    return false;
  }

  /**
   * 请求服务器同步
   */
  requestSync(serverKey, syncType) {
    const requestId = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const message = {
      type: "server_sync_request",
      data: {
        requestId,
        syncType,
      },
    };

    if (this.sendToServer(serverKey, message)) {
      cli.debug(`发送同步请求到 ${serverKey}: ${syncType}`);
      return requestId;
    }

    return null;
  }

  /**
   * 处理断开连接
   */
  handleDisconnection(serverKey, connectionInfo) {
    // 清除连接
    this.connections.delete(serverKey);

    // 清理相关的远程 Agent
    for (const [
      remoteAgentId,
      agent,
    ] of this.serverManager.serverRegistry.entries()) {
      if (agent.sourceServer === serverKey) {
        this.serverManager.serverRegistry.delete(remoteAgentId);
      }
    }

    // 尝试重连
    if (
      connectionInfo.reconnectAttempts < connectionInfo.maxReconnectAttempts
    ) {
      connectionInfo.reconnectAttempts++;
      const delay = Math.min(
        1000 * Math.pow(2, connectionInfo.reconnectAttempts),
        30000,
      );

      cli.info(
        `将在 ${delay / 1000} 秒后重连到 ${serverKey} (尝试 ${connectionInfo.reconnectAttempts}/${connectionInfo.maxReconnectAttempts})`,
      );

      this.reconnectIntervals.set(
        serverKey,
        setTimeout(() => {
          this.connectToServer(
            connectionInfo.host,
            connectionInfo.port,
            connectionInfo.serverId,
          ).catch((error) => {
            cli.warn(`重连失败: ${error.message}`);
          });
        }, delay),
      );
    } else {
      cli.warn(`达到最大重连尝试次数，停止重连: ${serverKey}`);
      this.messageQueue.delete(serverKey);
    }
  }

  /**
   * 刷新消息队列
   */
  flushMessageQueue(serverKey) {
    const queue = this.messageQueue.get(serverKey);
    if (!queue || queue.length === 0) {
      return;
    }

    cli.debug(`发送 ${queue.length} 条待处理消息到 ${serverKey}`);

    for (const message of queue) {
      this.sendToServer(serverKey, message);
    }

    this.messageQueue.set(serverKey, []);
  }

  /**
   * 断开与服务器的连接
   */
  disconnectFromServer(serverKey) {
    const connection = this.connections.get(serverKey);
    if (connection) {
      // 清除重连定时器
      const reconnectInterval = this.reconnectIntervals.get(serverKey);
      if (reconnectInterval) {
        clearTimeout(reconnectInterval);
        this.reconnectIntervals.delete(serverKey);
      }

      // 关闭连接
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, "正常关闭");
      }

      this.connections.delete(serverKey);
      this.messageQueue.delete(serverKey);

      cli.info(`已断开与服务器 ${serverKey} 的连接`);
      return true;
    }

    return false;
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus() {
    const status = {
      totalConnections: this.connections.size,
      activeConnections: 0,
      queuedMessages: 0,
      servers: [],
    };

    for (const [serverKey, connection] of this.connections.entries()) {
      const isActive = connection.ws.readyState === WebSocket.OPEN;
      if (isActive) {
        status.activeConnections++;
      }

      status.servers.push({
        serverKey,
        host: connection.host,
        port: connection.port,
        connectedAt: connection.connectedAt,
        lastMessageAt: connection.lastMessageAt,
        reconnectAttempts: connection.reconnectAttempts,
        state: WebSocket.OPEN ? "connected" : "disconnected",
        capabilities: connection.capabilities,
      });

      // 统计队列消息
      const queue = this.messageQueue.get(serverKey);
      if (queue) {
        status.queuedMessages += queue.length;
      }
    }

    return status;
  }

  /**
   * 停止所有连接
   */
  stopAllConnections() {
    cli.debug("停止所有服务器连接...");

    // 清除所有重连定时器
    for (const intervalId of this.reconnectIntervals.values()) {
      clearTimeout(intervalId);
    }
    this.reconnectIntervals.clear();

    // 关闭所有连接
    for (const [serverKey, connection] of this.connections.entries()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.close(1000, "服务器关闭");
      }
    }

    this.connections.clear();
    this.messageQueue.clear();

    cli.debug("所有服务器连接已停止");
  }
}

module.exports = ServerConnector;
