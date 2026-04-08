const dgram = require("dgram");
const { cli } = require("./cli");

/**
 * 服务发现模块
 * 使用 UDP 广播实现局域网内的服务器发现
 */
class Discovery {
  constructor(config, serverManager) {
    this.config = config;
    this.serverManager = serverManager;
    this.broadcastSocket = null;
    this.listenSocket = null;
    this.discoveredServers = new Map(); // serverId -> serverInfo
    this.broadcastInterval = null;
  }

  /**
   * 启动服务发现
   */
  async start() {
    const broadcastPort = this.config.get("discovery.broadcastPort", 18792);
    const listenPort = this.config.get("discovery.listenPort", 18793);

    cli.debug(`启动服务发现 (广播: ${broadcastPort}, 监听: ${listenPort})`);

    // 启动广播
    await this.startBroadcasting(broadcastPort);

    // 启动监听
    await this.startListening(listenPort);

    cli.info("服务发现已启动");
  }

  /**
   * 启动广播
   */
  async startBroadcasting(port) {
    return new Promise((resolve, reject) => {
      this.broadcastSocket = dgram.createSocket("udp4");

      this.broadcastSocket.on("error", (error) => {
        cli.error(`广播 socket 错误: ${error.message}`);
        reject(error);
      });

      this.broadcastSocket.on("listening", () => {
        this.broadcastSocket.setBroadcast(true);
        cli.debug(`广播 socket 监听在端口 ${port}`);

        // 开始定期广播
        this.startPeriodicBroadcast();

        resolve();
      });

      this.broadcastSocket.bind(port);
    });
  }

  /**
   * 启动监听
   */
  async startListening(port) {
    return new Promise((resolve, reject) => {
      this.listenSocket = dgram.createSocket("udp4");

      this.listenSocket.on("error", (error) => {
        cli.error(`监听 socket 错误: ${error.message}`);
        reject(error);
      });

      this.listenSocket.on("listening", () => {
        cli.debug(`监听 socket 监听在端口 ${port}`);
        resolve();
      });

      this.listenSocket.on("message", (msg, rinfo) => {
        this.handleDiscoveryMessage(msg, rinfo);
      });

      this.listenSocket.bind(port);
    });
  }

  /**
   * 开始定期广播
   */
  startPeriodicBroadcast() {
    const interval = this.config.get("discovery.broadcastInterval", 30000); // 30秒

    this.broadcastInterval = setInterval(() => {
      this.broadcastServerInfo();
    }, interval);

    // 立即广播一次
    this.broadcastServerInfo();
  }

  /**
   * 广播服务器信息
   */
  broadcastServerInfo() {
    if (!this.broadcastSocket) {
      return;
    }

    const serverInfo = {
      type: "coclaw_server",
      version: require("../package.json").version,
      serverId: this.config.get("server.id"),
      name: this.config.get("server.name", "Coclaw Server"),
      httpPort: this.config.get("server.port", 18790),
      wsPort: this.config.get("server.port", 18790) + 1,
      agentsCount: this.serverManager.agentRegistry.size,
      timestamp: new Date().toISOString(),
    };

    const message = JSON.stringify(serverInfo);
    const broadcastAddress = "255.255.255.255";
    const port = this.config.get("discovery.broadcastPort", 18792);

    this.broadcastSocket.send(
      message,
      0,
      message.length,
      port,
      broadcastAddress,
      (error) => {
        if (error) {
          cli.warn(`广播失败: ${error.message}`);
        } else {
          cli.debug(
            `广播服务器信息: ${serverInfo.name} (${serverInfo.serverId})`,
          );
        }
      },
    );
  }

  /**
   * 处理发现消息
   */
  handleDiscoveryMessage(msg, rinfo) {
    try {
      const message = JSON.parse(msg.toString());

      if (message.type !== "coclaw_server") {
        return; // 忽略非 Coclaw 消息
      }

      // 忽略自己的广播
      if (message.serverId === this.config.get("server.id")) {
        return;
      }

      const serverId = message.serverId;
      const serverInfo = {
        ...message,
        address: rinfo.address,
        lastSeen: new Date(),
      };

      // 更新或添加服务器信息
      const existing = this.discoveredServers.get(serverId);
      if (existing) {
        // 更新最后看到时间
        existing.lastSeen = new Date();
        this.discoveredServers.set(serverId, existing);
      } else {
        // 新服务器发现
        this.discoveredServers.set(serverId, serverInfo);
        this.onServerDiscovered(serverInfo);
      }

      cli.debug(
        `发现服务器: ${serverInfo.name} (${serverId}) at ${rinfo.address}`,
      );
    } catch (error) {
      cli.warn(`发现消息解析失败: ${error.message}`);
    }
  }

  /**
   * 服务器发现回调
   */
  onServerDiscovered(serverInfo) {
    cli.info(`发现新服务器: ${serverInfo.name} (${serverInfo.address})`);

    // 通知服务器管理器
    if (this.serverManager && this.serverManager.onServerDiscovered) {
      this.serverManager.onServerDiscovered(serverInfo);
    }

    // 自动连接（如果配置允许）
    const autoConnect = this.config.get("discovery.autoConnect", false);
    if (autoConnect && this.serverManager.connectToServer) {
      cli.debug(`自动连接到服务器: ${serverInfo.address}:${serverInfo.wsPort}`);
      this.serverManager
        .connectToServer(serverInfo.address, serverInfo.wsPort)
        .catch((error) => {
          cli.warn(`自动连接失败: ${error.message}`);
        });
    }
  }

  /**
   * 获取发现的服务器列表
   */
  getDiscoveredServers() {
    const now = new Date();
    const timeout = 120000; // 2分钟超时

    // 清理超时的服务器
    for (const [serverId, serverInfo] of this.discoveredServers.entries()) {
      if (now - new Date(serverInfo.lastSeen) > timeout) {
        this.discoveredServers.delete(serverId);
        cli.debug(`服务器超时移除: ${serverInfo.name} (${serverId})`);
      }
    }

    return Array.from(this.discoveredServers.values());
  }

  /**
   * 停止服务发现
   */
  async stop() {
    cli.debug("停止服务发现...");

    // 停止广播
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }

    // 关闭 sockets
    if (this.broadcastSocket) {
      this.broadcastSocket.close();
      this.broadcastSocket = null;
    }

    if (this.listenSocket) {
      this.listenSocket.close();
      this.listenSocket = null;
    }

    // 清理发现的服务器
    this.discoveredServers.clear();

    cli.debug("服务发现已停止");
  }
}

module.exports = Discovery;
