const fs = require("fs-extra");
const path = require("path");
const { spawn } = require("child_process");
const WebSocket = require("ws");
const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { cli } = require("./cli");
const Discovery = require("./discovery");
const Monitoring = require("./monitoring");
const TokenManager = require("./token-manager");
const RelationshipManager = require("./relationship-manager");
const ServerConnector = require("./server-connector");
const AITools = require("./ai-tools");
const { ErrorHandler } = require("./error-handler");
const PerformanceOptimizer = require("./performance-optimizer");
const ResourceCleaner = require("./resource-cleaner");

/**
 * 服务器管理器
 */
class ServerManager {
  constructor(config) {
    this.config = config;
    this.serverProcess = null;
    this.wsServer = null;
    this.httpServer = null;
    this.app = express();
    this.agentRegistry = new Map(); // agentId -> agentInfo
    this.serverRegistry = new Map(); // serverId -> serverInfo
    this.fileRegistry = new Map(); // fileId -> fileInfo
    this.discovery = null;
    this.monitoring = null;
    this.tokenManager = new TokenManager(config);
    this.relationshipManager = new RelationshipManager(config);
    this.serverConnector = new ServerConnector(config, this);
    this.aiTools = new AITools(config, this);
    this.errorHandler = null; // 将在 startServer 中初始化
    this.performanceOptimizer = null; // 将在 startServer 中初始化
    this.resourceCleaner = null; // 将在 startServer 中初始化
    this.setupFileStorage();
  }

  /**
   * 设置文件存储
   */
  setupFileStorage() {
    const filesDir = this.config.getServerFilesDir();
    fs.ensureDirSync(filesDir);

    // 配置 multer 用于文件上传
    this.upload = multer({
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          cb(null, filesDir);
        },
        filename: (req, file, cb) => {
          const fileId = crypto.randomBytes(16).toString("hex");
          const ext = path.extname(file.originalname);
          cb(null, `${fileId}${ext}`);
        },
      }),
      limits: {
        fileSize: 100 * 1024 * 1024, // 100MB 限制
      },
    });
  }

  /**
   * 检查服务器是否在运行
   */
  async isServerRunning() {
    if (!this.serverProcess) {
      return false;
    }

    // 检查进程是否存活
    if (this.serverProcess.exitCode !== null) {
      this.serverProcess = null;
      return false;
    }

    // 检查端口是否监听
    const port = this.config.get("server.port", 18790);
    try {
      const { exec } = require("child_process");
      const { promisify } = require("util");
      const execAsync = promisify(exec);

      await execAsync(`lsof -ti:${port} || echo ""`);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * 启动服务器
   */
  async startServer() {
    if (await this.isServerRunning()) {
      throw new Error("服务器已经在运行中");
    }

    const port = this.config.get("server.port", 18790);
    const host = this.config.get("server.host", "0.0.0.0");

    cli.info(`启动 Coclaw 服务器 (${host}:${port})`);

    try {
      // 启动 HTTP 服务器
      await this.startHttpServer(port, host);

      // 启动 WebSocket 服务器
      await this.startWebSocketServer(port + 1);

      // 启动错误处理器
      this.errorHandler = new ErrorHandler(this.config, this.monitoring);

      // 启动监控
      this.monitoring = new Monitoring(this.config, this);

      // 启动性能优化器
      this.performanceOptimizer = new PerformanceOptimizer(
        this.config,
        this.monitoring,
      );

      // 启动资源清理器
      this.resourceCleaner = new ResourceCleaner(this.config, this);
      this.resourceCleaner.startAllCleanupTasks();

      // 启动服务发现
      this.discovery = new Discovery(this.config, this);
      await this.discovery.start();

      // 启动令牌管理器清理
      this.tokenManager.startCleanup();

      cli.success(`服务器已启动 (HTTP: ${port}, WebSocket: ${port + 1})`);
      this.serverStartTime = Date.now();
      return true;
    } catch (error) {
      cli.error(`服务器启动失败: ${error.message}`);

      // 清理资源
      await this.stopServer();
      throw error;
    }
  }

  /**
   * 启动 HTTP 服务器
   * @param {number} port
   * @param {string} host
   */
  async startHttpServer(port, host) {
    return new Promise((resolve, reject) => {
      // 配置中间件
      this.app.use(express.json());
      this.app.use(express.urlencoded({ extended: true }));

      // 静态文件服务
      const filesDir = this.config.getServerFilesDir();
      this.app.use("/files", express.static(filesDir));

      // API 路由
      this.setupRoutes();

      // 启动服务器
      this.httpServer = this.app.listen(port, host, () => {
        cli.debug(`HTTP 服务器监听在 ${host}:${port}`);
        resolve();
      });

      this.httpServer.on("error", reject);
    });
  }

  /**
   * 设置路由
   */
  setupRoutes() {
    // 监控中间件
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      // 记录响应完成
      res.on("finish", () => {
        const duration = Date.now() - startTime;
        if (this.monitoring) {
          this.monitoring.logRequest(
            req.method,
            req.path,
            res.statusCode,
            duration,
          );
        }
      });

      next();
    });

    // 健康检查
    this.app.get("/health", (req, res) => {
      const healthReport = this.monitoring
        ? this.monitoring.getHealthReport()
        : {
            status: "unknown",
            checks: {},
            metrics: {},
            timestamp: new Date(),
          };

      res.json({
        ...healthReport,
        version: require("../package.json").version,
        agents: this.agentRegistry.size,
        servers: this.serverRegistry.size,
        files: this.fileRegistry.size,
      });
    });

    // 监控指标
    this.app.get("/metrics", (req, res) => {
      if (!this.monitoring) {
        return res.status(503).json({ error: "监控未启用" });
      }

      res.json(this.monitoring.getMetrics());
    });

    // 注册 Agent
    this.app.post("/api/agents/register", (req, res) => {
      const { agentId, name, port, capabilities } = req.body;

      if (!agentId || !name) {
        return res.status(400).json({ error: "缺少必要参数" });
      }

      this.agentRegistry.set(agentId, {
        agentId,
        name,
        port: port || 18789,
        capabilities: capabilities || [],
        registeredAt: new Date(),
        lastSeen: new Date(),
      });

      cli.debug(`Agent 注册: ${agentId} (${name})`);
      res.json({ success: true, agentId });
    });

    // 注销 Agent
    this.app.post("/api/agents/unregister", (req, res) => {
      const { agentId } = req.body;

      if (this.agentRegistry.has(agentId)) {
        this.agentRegistry.delete(agentId);
        cli.debug(`Agent 注销: ${agentId}`);
      }

      res.json({ success: true });
    });

    // 列出所有 Agent
    this.app.get("/api/agents", (req, res) => {
      const agents = Array.from(this.agentRegistry.values()).map((agent) => ({
        ...agent,
        isOnline: Date.now() - new Date(agent.lastSeen).getTime() < 30000, // 30秒内在线
      }));

      res.json({ agents });
    });

    // 文件上传
    this.app.post(
      "/api/files/upload",
      this.upload.single("file"),
      async (req, res) => {
        try {
          const { fromAgentId, toAgentId, description, uploadToken } = req.body;
          const file = req.file;

          if (!file) {
            return res.status(400).json({ error: "没有上传文件" });
          }

          if (!fromAgentId || !toAgentId || !uploadToken) {
            // 删除上传的文件
            if (file && file.path) {
              await fs.remove(file.path);
            }
            return res
              .status(400)
              .json({ error: "缺少 fromAgentId、toAgentId 或 uploadToken" });
          }

          // 验证上传令牌
          const tokenValidation = this.tokenManager.validateFileUploadToken(
            uploadToken,
            fromAgentId,
            toAgentId,
          );

          if (!tokenValidation.valid) {
            if (file && file.path) {
              await fs.remove(file.path);
            }
            return res
              .status(401)
              .json({ error: "令牌验证失败", details: tokenValidation.error });
          }

          // 使用令牌
          if (!this.tokenManager.useToken(uploadToken)) {
            if (file && file.path) {
              await fs.remove(file.path);
            }
            return res.status(401).json({ error: "令牌无效或已使用" });
          }

          // 检查发送者和接收者
          const fromAgent = this.agentRegistry.get(fromAgentId);
          const toAgent = this.agentRegistry.get(toAgentId);

          if (!fromAgent) {
            await fs.remove(file.path);
            return res
              .status(404)
              .json({ error: `发送者 Agent 未找到: ${fromAgentId}` });
          }

          if (!toAgent) {
            await fs.remove(file.path);
            return res
              .status(404)
              .json({ error: `接收者 Agent 未找到: ${toAgentId}` });
          }

          // 生成文件 ID
          const fileId = path.basename(file.path, path.extname(file.path));
          const fileInfo = {
            fileId,
            originalName: file.originalname,
            filename: file.filename,
            path: file.path,
            size: file.size,
            mimetype: file.mimetype,
            fromAgentId,
            toAgentId,
            description: description || "",
            uploadedAt: new Date(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24小时后过期
          };

          // 优化文件传输
          let optimizedFileInfo = fileInfo;
          if (this.performanceOptimizer) {
            try {
              optimizedFileInfo =
                await this.performanceOptimizer.optimizeFileTransfer(fileInfo, {
                  fromAgentId,
                  toAgentId,
                  filename: file.originalname,
                });
            } catch (error) {
              cli.warn(`文件传输优化失败: ${error.message}`);
              // 继续使用原始文件信息
            }
          }

          // 保存文件信息
          this.fileRegistry.set(fileId, optimizedFileInfo);

          cli.info(
            `文件上传: ${file.originalname} (${fileId}) from ${fromAgentId} to ${toAgentId}`,
          );

          // 记录文件上传
          if (this.monitoring) {
            this.monitoring.logFileTransfer("upload", fileId, file.size, true);
          }

          // 通知接收者
          if (
            toAgent.wsClient &&
            toAgent.wsClient.readyState === WebSocket.OPEN
          ) {
            toAgent.wsClient.send(
              JSON.stringify({
                type: "file_available",
                data: {
                  fileId,
                  originalName: file.originalname,
                  fromAgentId,
                  description: fileInfo.description,
                  size: file.size,
                  mimetype: file.mimetype,
                  downloadUrl: `/api/files/${fileId}`,
                },
              }),
            );
          }

          res.json({
            success: true,
            fileId,
            filename: file.filename,
            originalName: file.originalname,
            size: file.size,
            downloadUrl: `/api/files/${fileId}`,
          });
        } catch (error) {
          cli.error(`文件上传失败: ${error.message}`);
          res
            .status(500)
            .json({ error: "文件上传失败", details: error.message });
        }
      },
    );

    // 文件下载（带令牌验证）
    this.app.get("/api/files/:fileId", async (req, res) => {
      try {
        const { fileId } = req.params;
        const { downloadToken, agentId } = req.query;

        if (!downloadToken || !agentId) {
          return res
            .status(400)
            .json({ error: "缺少 downloadToken 或 agentId 参数" });
        }

        const fileInfo = this.fileRegistry.get(fileId);

        if (!fileInfo) {
          return res.status(404).json({ error: "文件未找到" });
        }

        // 验证下载令牌
        const tokenValidation = this.tokenManager.validateFileDownloadToken(
          downloadToken,
          fileId,
          agentId,
        );

        if (!tokenValidation.valid) {
          return res.status(401).json({
            error: "下载令牌验证失败",
            details: tokenValidation.error,
          });
        }

        // 检查权限：只有发送者或接收者可以下载
        if (
          agentId !== fileInfo.fromAgentId &&
          agentId !== fileInfo.toAgentId
        ) {
          return res.status(403).json({ error: "无权下载此文件" });
        }

        // 检查文件是否过期
        if (new Date() > new Date(fileInfo.expiresAt)) {
          // 删除过期文件
          await fs.remove(fileInfo.path);
          this.fileRegistry.delete(fileId);
          return res.status(410).json({ error: "文件已过期" });
        }

        // 检查文件是否存在
        if (!(await fs.pathExists(fileInfo.path))) {
          this.fileRegistry.delete(fileId);
          return res.status(404).json({ error: "文件不存在" });
        }

        // 使用令牌
        this.tokenManager.useToken(downloadToken);

        // 设置下载头
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="${encodeURIComponent(fileInfo.originalName)}"`,
        );
        res.setHeader("Content-Type", fileInfo.mimetype);
        res.setHeader("Content-Length", fileInfo.size);

        // 记录文件下载
        if (this.monitoring) {
          this.monitoring.logFileTransfer(
            "download",
            fileId,
            fileInfo.size,
            true,
          );
        }

        // 记录传输开始时间
        const transferStartTime = Date.now();

        // 发送文件
        const fileStream = fs.createReadStream(fileInfo.path);
        fileStream.pipe(res);

        // 记录传输完成
        res.on("finish", () => {
          const transferTime = Date.now() - transferStartTime;
          if (this.performanceOptimizer) {
            this.performanceOptimizer.recordFileTransfer(
              fileId,
              fileInfo.size,
              transferTime,
              true,
            );
          }
        });

        cli.debug(
          `文件下载: ${fileInfo.originalName} (${fileId}) by ${agentId}`,
        );
      } catch (error) {
        cli.error(`文件下载失败: ${error.message}`);
        res.status(500).json({ error: "文件下载失败", details: error.message });
      }
    });

    // 生成下载令牌
    this.app.post("/api/files/:fileId/token", async (req, res) => {
      try {
        const { fileId } = req.params;
        const { agentId } = req.body;

        if (!agentId) {
          return res.status(400).json({ error: "缺少 agentId" });
        }

        const fileInfo = this.fileRegistry.get(fileId);

        if (!fileInfo) {
          return res.status(404).json({ error: "文件未找到" });
        }

        // 检查权限：只有发送者或接收者可以获取下载令牌
        if (
          agentId !== fileInfo.fromAgentId &&
          agentId !== fileInfo.toAgentId
        ) {
          return res.status(403).json({ error: "无权访问此文件" });
        }

        // 生成下载令牌
        const downloadToken = this.tokenManager.generateFileDownloadToken(
          fileId,
          agentId,
        );

        res.json({
          success: true,
          downloadToken,
          fileId,
          expiresIn: 3600, // 1小时
        });
      } catch (error) {
        cli.error(`生成下载令牌失败: ${error.message}`);
        res
          .status(500)
          .json({ error: "生成下载令牌失败", details: error.message });
      }
    });

    // 文件信息
    this.app.get("/api/files/:fileId/info", async (req, res) => {
      const { fileId } = req.params;
      const fileInfo = this.fileRegistry.get(fileId);

      if (!fileInfo) {
        return res.status(404).json({ error: "文件未找到" });
      }

      res.json({
        fileId,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        mimetype: fileInfo.mimetype,
        fromAgentId: fileInfo.fromAgentId,
        toAgentId: fileInfo.toAgentId,
        description: fileInfo.description,
        uploadedAt: fileInfo.uploadedAt,
        expiresAt: fileInfo.expiresAt,
      });
    });

    // 清理过期文件
    this.app.post("/api/files/cleanup", async (req, res) => {
      try {
        const cleaned = await this.cleanupExpiredFiles();
        res.json({ success: true, cleaned });
      } catch (error) {
        res.status(500).json({ error: "清理失败", details: error.message });
      }
    });

    // 关系管理 API
    // 获取 Agent 关系配置
    this.app.get("/api/relationships/:agentId", (req, res) => {
      const { agentId } = req.params;

      try {
        const relationship = this.relationshipManager.getRelationship(agentId);
        res.json({
          success: true,
          agentId,
          relationship,
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "获取关系配置失败", details: error.message });
      }
    });

    // 更新 Agent 关系配置
    this.app.put("/api/relationships/:agentId", async (req, res) => {
      const { agentId } = req.params;
      const { relationship } = req.body;

      if (!relationship) {
        return res.status(400).json({ error: "缺少 relationship 配置" });
      }

      try {
        await this.relationshipManager.setRelationship(agentId, relationship);
        res.json({
          success: true,
          agentId,
          message: "关系配置已更新",
        });
      } catch (error) {
        res
          .status(400)
          .json({ error: "更新关系配置失败", details: error.message });
      }
    });

    // 检查权限
    this.app.post("/api/relationships/check", (req, res) => {
      const { fromAgentId, toAgentId, permission, context = {} } = req.body;

      if (!fromAgentId || !toAgentId || !permission) {
        return res.status(400).json({ error: "缺少必要参数" });
      }

      try {
        const result = this.relationshipManager.checkPermission(
          fromAgentId,
          toAgentId,
          permission,
          context,
        );

        res.json({
          success: true,
          ...result,
        });
      } catch (error) {
        res.status(500).json({ error: "检查权限失败", details: error.message });
      }
    });

    // 阻止 Agent
    this.app.post("/api/relationships/:agentId/block", async (req, res) => {
      const { agentId } = req.params;
      const { blockedAgentId } = req.body;

      if (!blockedAgentId) {
        return res.status(400).json({ error: "缺少 blockedAgentId" });
      }

      try {
        await this.relationshipManager.blockAgent(agentId, blockedAgentId);
        res.json({
          success: true,
          agentId,
          blockedAgentId,
          message: "Agent 已阻止",
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "阻止 Agent 失败", details: error.message });
      }
    });

    // 取消阻止 Agent
    this.app.post("/api/relationships/:agentId/unblock", async (req, res) => {
      const { agentId } = req.params;
      const { blockedAgentId } = req.body;

      if (!blockedAgentId) {
        return res.status(400).json({ error: "缺少 blockedAgentId" });
      }

      try {
        await this.relationshipManager.unblockAgent(agentId, blockedAgentId);
        res.json({
          success: true,
          agentId,
          blockedAgentId,
          message: "Agent 已取消阻止",
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "取消阻止 Agent 失败", details: error.message });
      }
    });

    // 设置特定 Agent 权限
    this.app.post("/api/relationships/:agentId/override", async (req, res) => {
      const { agentId } = req.params;
      const { targetAgentId, permissions } = req.body;

      if (!targetAgentId || !permissions) {
        return res
          .status(400)
          .json({ error: "缺少 targetAgentId 或 permissions" });
      }

      try {
        await this.relationshipManager.setAgentOverride(
          agentId,
          targetAgentId,
          permissions,
        );
        res.json({
          success: true,
          agentId,
          targetAgentId,
          permissions,
          message: "特定 Agent 权限已设置",
        });
      } catch (error) {
        res.status(500).json({ error: "设置权限失败", details: error.message });
      }
    });

    // 设置信任级别
    this.app.post("/api/relationships/:agentId/trust", async (req, res) => {
      const { agentId } = req.params;
      const { trustLevel } = req.body;

      if (trustLevel === undefined || trustLevel < 0 || trustLevel > 10) {
        return res
          .status(400)
          .json({ error: "trustLevel 必须是 0-10 之间的数字" });
      }

      try {
        await this.relationshipManager.setTrustLevel(agentId, trustLevel);
        res.json({
          success: true,
          agentId,
          trustLevel,
          message: "信任级别已设置",
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "设置信任级别失败", details: error.message });
      }
    });

    // 获取关系统计
    this.app.get("/api/relationships/stats", (req, res) => {
      try {
        const stats = this.relationshipManager.getStats();
        res.json({
          success: true,
          stats,
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "获取关系统计失败", details: error.message });
      }
    });

    // 导出所有关系配置
    this.app.get("/api/relationships/export", (req, res) => {
      try {
        const data = this.relationshipManager.exportRelationships();
        res.json({
          success: true,
          data,
        });
      } catch (error) {
        res
          .status(500)
          .json({ error: "导出关系配置失败", details: error.message });
      }
    });

    // 导入关系配置
    this.app.post("/api/relationships/import", async (req, res) => {
      const { data } = req.body;

      if (!data) {
        return res.status(400).json({ error: "缺少导入数据" });
      }

      try {
        const count = await this.relationshipManager.importRelationships(data);
        res.json({
          success: true,
          importedCount: count,
          message: `成功导入 ${count} 个 Agent 的关系配置`,
        });
      } catch (error) {
        res
          .status(400)
          .json({ error: "导入关系配置失败", details: error.message });
      }
    });

    // 服务器信息
    this.app.get("/api/server/info", (req, res) => {
      res.json({
        name: "Coclaw Server",
        version: require("../package.json").version,
        uptime: process.uptime(),
        agentsCount: this.agentRegistry.size,
        serversCount: this.serverRegistry.size,
        config: {
          port: this.config.get("server.port"),
          maxConnections: this.config.get("server.maxConnections"),
        },
      });
    });

    // 性能统计
    this.app.get("/api/performance/stats", (req, res) => {
      try {
        const stats = this.performanceOptimizer
          ? this.performanceOptimizer.getPerformanceStats()
          : {
              error: "性能优化器未启用",
              optimizationEnabled: false,
            };

        res.json({
          success: true,
          stats,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "获取性能统计失败",
          details: error.message,
        });
      }
    });

    // 性能优化控制
    this.app.post("/api/performance/control", (req, res) => {
      try {
        const { action, strategyName, updates } = req.body;

        if (!this.performanceOptimizer) {
          return res.status(400).json({
            success: false,
            error: "性能优化器未启用",
          });
        }

        switch (action) {
          case "enable":
            this.performanceOptimizer.setOptimizationEnabled(true);
            break;

          case "disable":
            this.performanceOptimizer.setOptimizationEnabled(false);
            break;

          case "update_strategy":
            if (!strategyName) {
              return res.status(400).json({
                success: false,
                error: "缺少 strategyName",
              });
            }
            this.performanceOptimizer.updateOptimizationStrategy(
              strategyName,
              updates || {},
            );
            break;

          case "reset_stats":
            this.performanceOptimizer.resetPerformanceStats();
            break;

          default:
            return res.status(400).json({
              success: false,
              error: `未知的操作: ${action}`,
            });
        }

        res.json({
          success: true,
          action,
          message: "操作执行成功",
        });
      } catch (error) {
        res.status(500).json({
          success: false,
          error: "性能控制操作失败",
          details: error.message,
        });
      }
    });
  }

  /**
   * 启动 WebSocket 服务器
   * @param {number} port
   */
  async startWebSocketServer(port) {
    return new Promise((resolve, reject) => {
      this.wsServer = new WebSocket.Server({ port }, () => {
        cli.debug(`WebSocket 服务器监听在端口 ${port}`);
        resolve();
      });

      this.wsServer.on("error", reject);

      // 处理连接
      this.wsServer.on("connection", async (ws, req) => {
        await this.handleWebSocketConnection(ws, req);
      });
    });
  }

  /**
   * 处理 WebSocket 连接
   * @param {WebSocket} ws
   * @param {Object} req
   */
  async handleWebSocketConnection(ws, req) {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const clientInfo = {
      id: clientId,
      ip: req.socket.remoteAddress,
      connectedAt: new Date(),
      type: "unknown",
    };

    cli.debug(`WebSocket 客户端连接: ${clientId} (${clientInfo.ip})`);

    // 记录连接
    if (this.monitoring) {
      this.monitoring.logConnection("connect", clientId, "unknown");
    }

    // 优化连接管理
    if (this.performanceOptimizer) {
      try {
        const optimizedConnection =
          await this.performanceOptimizer.optimizeConnection(
            {
              clientId,
              type: "unknown",
              ip: clientInfo.ip,
            },
            {
              target: req.socket.remoteAddress,
            },
          );
        clientInfo.optimized = optimizedConnection;
      } catch (error) {
        cli.warn(`连接优化失败: ${error.message}`);
      }
    }

    // 发送欢迎消息
    ws.send(
      JSON.stringify({
        type: "welcome",
        clientId,
        serverInfo: {
          name: "Coclaw Server",
          version: require("../package.json").version,
        },
      }),
    );

    // 处理消息
    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(ws, clientInfo, message);
      } catch (error) {
        // 使用错误处理器处理消息解析错误
        if (this.errorHandler) {
          this.errorHandler
            .handleError(error, {
              clientId,
              clientType: clientInfo.type,
              action: "websocket_message_parse",
            })
            .catch((handlerError) => {
              cli.warn(`错误处理器失败: ${handlerError.message}`);
            });
        } else {
          cli.warn(`WebSocket 消息解析失败: ${error.message}`);
        }

        ws.send(
          JSON.stringify({
            type: "error",
            error: "消息格式错误",
            details: this.errorHandler
              ? "消息格式无效，请检查JSON格式"
              : "内部错误",
          }),
        );
      }
    });

    // 处理关闭
    ws.on("close", () => {
      cli.debug(`WebSocket 客户端断开: ${clientId}`);

      // 记录断开
      if (this.monitoring) {
        this.monitoring.logConnection("disconnect", clientId, clientInfo.type);
      }

      // 释放连接优化资源
      if (this.performanceOptimizer && clientInfo.optimized) {
        try {
          this.performanceOptimizer.releaseConnection(
            clientInfo.optimized.poolId,
            req.socket.remoteAddress,
          );
        } catch (error) {
          cli.warn(`连接释放失败: ${error.message}`);
        }
      }

      // 清理相关资源
      this.cleanupClientResources(clientId);
    });

    // 处理错误
    ws.on("error", (error) => {
      cli.warn(`WebSocket 客户端错误 (${clientId}): ${error.message}`);
    });
  }

  /**
   * 处理 WebSocket 消息
   * @param {WebSocket} ws
   * @param {Object} clientInfo
   * @param {Object} message
   */
  handleWebSocketMessage(ws, clientInfo, message) {
    const { type, data } = message;

    switch (type) {
      case "identify":
        this.handleIdentify(ws, clientInfo, data);
        break;

      case "ping":
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
        break;

      case "agent_register":
        this.handleAgentRegister(ws, clientInfo, data);
        break;

      case "agent_message":
        this.handleAgentMessage(ws, clientInfo, data);
        break;

      case "file_transfer":
        this.handleFileTransfer(ws, clientInfo, data);
        break;

      case "ai_tool_call":
        this.handleAIToolCall(ws, clientInfo, data);
        break;

      default:
        cli.warn(`未知的 WebSocket 消息类型: ${type}`);
        ws.send(
          JSON.stringify({
            type: "error",
            error: `未知的消息类型: ${type}`,
          }),
        );
    }
  }

  /**
   * 处理客户端身份识别
   */
  handleIdentify(ws, clientInfo, data) {
    const { clientType, agentId, capabilities } = data;

    clientInfo.type = clientType;
    clientInfo.agentId = agentId;
    clientInfo.capabilities = capabilities || [];

    cli.debug(`客户端识别: ${clientInfo.id} -> ${clientType} ${agentId || ""}`);

    ws.send(
      JSON.stringify({
        type: "identified",
        clientId: clientInfo.id,
        success: true,
      }),
    );

    // 如果是 Agent，更新注册表
    if (clientType === "agent" && agentId) {
      this.agentRegistry.set(agentId, {
        ...(this.agentRegistry.get(agentId) || {}),
        wsClient: ws,
        clientId: clientInfo.id,
        lastSeen: new Date(),
      });
    }
  }

  /**
   * 处理 Agent 注册
   */
  handleAgentRegister(ws, clientInfo, data) {
    const { agentId, name, port, capabilities } = data;

    if (!agentId || !name) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "缺少 agentId 或 name",
        }),
      );
      return;
    }

    const agentInfo = {
      agentId,
      name,
      port: port || 18789,
      capabilities: capabilities || [],
      wsClient: ws,
      clientId: clientInfo.id,
      registeredAt: new Date(),
      lastSeen: new Date(),
    };

    this.agentRegistry.set(agentId, agentInfo);

    cli.info(`Agent 注册: ${name} (${agentId})`);

    ws.send(
      JSON.stringify({
        type: "agent_registered",
        agentId,
        success: true,
      }),
    );

    // 广播 Agent 上线通知到其他服务器
    if (this.serverConnector) {
      this.serverConnector.notifyAgentOnline(agentInfo);
    }

    // 广播 Agent 上线通知到本地服务器
    this.broadcastToServers({
      type: "agent_online",
      agent: agentInfo,
    });
  }

  /**
   * 处理 Agent 消息
   */
  async handleAgentMessage(ws, clientInfo, data) {
    const { fromAgentId, toAgentId, message, messageType = "text" } = data;

    if (!fromAgentId || !toAgentId || !message) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "缺少必要参数",
        }),
      );
      return;
    }

    // 检查目标 Agent 是否在本服务器
    const targetAgent = this.agentRegistry.get(toAgentId);
    if (!targetAgent || !targetAgent.wsClient) {
      // 检查目标 Agent 是否在其他服务器
      const isRemoteAgent = Array.from(this.serverRegistry.values()).some(
        (agent) => agent.agentId === toAgentId && agent.isRemote,
      );

      if (isRemoteAgent && this.serverConnector) {
        // 尝试通过服务器连接器转发消息
        const relayed = this.serverConnector.relayAgentMessage(
          {
            toAgentId,
            message,
            messageType,
            timestamp: new Date().toISOString(),
          },
          fromAgentId,
        );

        if (relayed) {
          cli.debug(`消息转发到远程服务器: ${fromAgentId} -> ${toAgentId}`);

          // 发送确认
          ws.send(
            JSON.stringify({
              type: "message_delivered",
              toAgentId,
              timestamp: new Date().toISOString(),
              isRemote: true,
            }),
          );
          return;
        }
      }

      ws.send(
        JSON.stringify({
          type: "error",
          error: `目标 Agent 未找到或未连接: ${toAgentId}`,
        }),
      );
      return;
    }

    // 检查权限
    const permissionCheck = this.relationshipManager.checkMessagePermission(
      fromAgentId,
      toAgentId,
      messageType,
    );

    if (!permissionCheck.hasPermission) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: `消息发送权限被拒绝: ${permissionCheck.reason}`,
        }),
      );
      cli.warn(
        `消息权限拒绝: ${fromAgentId} -> ${toAgentId}: ${permissionCheck.reason}`,
      );
      return;
    }

    // 优化消息路由
    let optimizedMessage = {
      type: "agent_message",
      data: {
        fromAgentId,
        message,
        messageType,
        timestamp: new Date().toISOString(),
      },
    };

    if (this.performanceOptimizer) {
      try {
        optimizedMessage =
          await this.performanceOptimizer.optimizeMessageRouting(
            optimizedMessage,
            {
              fromAgentId,
              toAgentId,
              messageType,
              messageSize: JSON.stringify(message).length,
            },
          );
      } catch (error) {
        cli.warn(`消息路由优化失败: ${error.message}`);
        // 继续使用原始消息
      }
    }

    // 转发消息
    targetAgent.wsClient.send(JSON.stringify(optimizedMessage));

    cli.debug(`消息转发: ${fromAgentId} -> ${toAgentId}`);

    // 记录消息
    if (this.monitoring) {
      this.monitoring.logMessage("sent", fromAgentId, toAgentId, true);
    }

    // 发送确认
    ws.send(
      JSON.stringify({
        type: "message_delivered",
        toAgentId,
        timestamp: new Date().toISOString(),
      }),
    );
  }

  /**
   * 处理文件传输
   */
  handleFileTransfer(ws, clientInfo, data) {
    const { action, fileId, fromAgentId, toAgentId, description } = data;

    switch (action) {
      case "request_upload":
        this.handleFileUploadRequest(ws, clientInfo, data);
        break;

      case "notify_available":
        this.handleFileAvailableNotification(ws, clientInfo, data);
        break;

      default:
        cli.warn(`未知的文件传输操作: ${action}`);
        ws.send(
          JSON.stringify({
            type: "error",
            error: `未知的文件传输操作: ${action}`,
          }),
        );
    }
  }

  /**
   * 处理文件上传请求
   */
  handleFileUploadRequest(ws, clientInfo, data) {
    const { fromAgentId, toAgentId, filename, size, description } = data;

    // 检查接收者
    const toAgent = this.agentRegistry.get(toAgentId);
    if (!toAgent || !toAgent.wsClient) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: `接收者 Agent 未找到或未连接: ${toAgentId}`,
        }),
      );
      return;
    }

    // 检查文件发送权限
    const permissionCheck = this.relationshipManager.checkFilePermission(
      fromAgentId,
      toAgentId,
      {
        type: filename.split(".").pop() || "unknown",
        size: size || 0,
      },
    );

    if (!permissionCheck.hasPermission) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: `文件发送权限被拒绝: ${permissionCheck.reason}`,
        }),
      );
      cli.warn(
        `文件权限拒绝: ${fromAgentId} -> ${toAgentId}: ${permissionCheck.reason}`,
      );
      return;
    }

    // 生成上传令牌
    const uploadToken = this.tokenManager.generateFileUploadToken(
      fromAgentId,
      toAgentId,
      filename,
      size,
    );
    const uploadUrl = `http://localhost:${this.config.get("server.port", 18790)}/api/files/upload`;

    // 通知接收者
    toAgent.wsClient.send(
      JSON.stringify({
        type: "file_upload_request",
        data: {
          fromAgentId,
          filename,
          size,
          description,
          uploadToken,
          uploadUrl,
        },
      }),
    );

    // 发送确认给发送者
    ws.send(
      JSON.stringify({
        type: "file_upload_requested",
        uploadToken,
        uploadUrl,
      }),
    );

    cli.debug(`文件上传请求: ${filename} from ${fromAgentId} to ${toAgentId}`);
  }

  /**
   * 处理文件可用通知
   */
  handleFileAvailableNotification(ws, clientInfo, data) {
    // 这个通知通常由服务器在文件上传完成后发送
    // 这里只是记录日志
    cli.debug(`文件可用通知: ${JSON.stringify(data)}`);
  }

  /**
   * 处理 AI Tool 调用
   */
  async handleAIToolCall(ws, clientInfo, data) {
    const { toolCall, context = {} } = data;
    const { agentId } = context;

    if (!toolCall || !agentId) {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "缺少 toolCall 或 agentId",
        }),
      );
      return;
    }

    try {
      // 验证工具调用
      this.aiTools.validateToolCall(toolCall);

      // 执行工具
      const result = await this.aiTools.executeTool(
        toolCall.name,
        toolCall.arguments || {},
        {
          agentId,
          wsClient: ws,
        },
      );

      // 发送结果
      ws.send(
        JSON.stringify({
          type: "ai_tool_result",
          data: {
            toolCall,
            result,
            timestamp: new Date().toISOString(),
          },
        }),
      );

      cli.debug(`AI Tool 执行成功: ${toolCall.name} by ${agentId}`);
    } catch (error) {
      cli.error(`AI Tool 执行失败: ${error.message}`);

      ws.send(
        JSON.stringify({
          type: "ai_tool_error",
          data: {
            toolCall,
            error: error.message,
            timestamp: new Date().toISOString(),
          },
        }),
      );
    }
  }

  /**
   * 清理过期文件
   */
  async cleanupExpiredFiles() {
    if (this.resourceCleaner) {
      return this.resourceCleaner.cleanupExpiredFiles();
    }
    return { cleaned: 0, failed: 0 };
  }

  /**
   * 广播消息到所有服务器
   */
  broadcastToServers(message) {
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        // 只发送给服务器类型的客户端
        // TODO: 根据客户端类型过滤
        client.send(JSON.stringify(message));
      }
    });
  }

  /**
   * 清理客户端资源
   */
  cleanupClientResources(clientId) {
    // 从注册表中移除
    for (const [agentId, agentInfo] of this.agentRegistry.entries()) {
      if (agentInfo.clientId === clientId) {
        this.agentRegistry.delete(agentId);
        cli.debug(`清理 Agent 注册: ${agentId}`);

        // 广播 Agent 离线通知
        this.broadcastToServers({
          type: "agent_offline",
          agentId,
        });

        break;
      }
    }
  }

  /**
   * 广播服务器信息
   */
  broadcastServerInfo() {
    const serverInfo = {
      type: "coclaw_server",
      version: require("../package.json").version,
      port: this.config.get("server.port", 18790),
      wsPort: this.config.get("server.port", 18790) + 1,
      agentsCount: this.agentRegistry.size,
      timestamp: new Date().toISOString(),
    };

    cli.debug(`广播服务器信息: ${JSON.stringify(serverInfo)}`);
    // TODO: 实现 UDP 广播
  }

  /**
   * 停止服务器
   */
  async stopServer() {
    cli.info("正在停止服务器...");

    // 停止监控
    if (this.monitoring) {
      await this.monitoring.stop();
      this.monitoring = null;
    }

    // 停止服务发现
    if (this.discovery) {
      await this.discovery.stop();
      this.discovery = null;
    }

    // 停止服务器连接器
    if (this.serverConnector) {
      this.serverConnector.stopAllConnections();
    }

    // 停止令牌管理器
    if (this.tokenManager) {
      this.tokenManager.stopCleanup();
    }

    // 停止资源清理器
    if (this.resourceCleaner) {
      this.resourceCleaner.stopAllCleanupTasks();
      this.resourceCleaner = null;
    }

    // 关闭 WebSocket 服务器
    if (this.wsServer) {
      this.wsServer.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000, "服务器关闭");
        }
      });

      await new Promise((resolve) => {
        this.wsServer.close(resolve);
      });
      this.wsServer = null;
    }

    // 关闭 HTTP 服务器
    if (this.httpServer) {
      await new Promise((resolve) => {
        this.httpServer.close(resolve);
      });
      this.httpServer = null;
    }

    // 停止进程
    if (this.serverProcess) {
      this.serverProcess.kill("SIGTERM");
      this.serverProcess = null;
    }

    // 清理注册表
    this.agentRegistry.clear();
    this.serverRegistry.clear();

    cli.success("服务器已停止");
    return true;
  }

  /**
   * 获取服务器状态
   */
  getServerStatus() {
    return {
      isRunning: !!this.httpServer && !!this.wsServer,
      httpPort: this.config.get("server.port", 18790),
      wsPort: this.config.get("server.port", 18790) + 1,
      agentsCount: this.agentRegistry.size,
      serversCount: this.serverRegistry.size,
      uptime: this.serverStartTime ? Date.now() - this.serverStartTime : 0,
    };
  }

  /**
   * 连接到远程服务器
   * @param {string} host
   * @param {number} port
   */
  async connectToServer(host, port) {
    const wsUrl = `ws://${host}:${port + 1}`;

    cli.info(`连接到服务器: ${wsUrl}`);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(wsUrl);

      ws.on("open", () => {
        cli.debug("WebSocket 连接已建立");

        // 发送身份识别
        ws.send(
          JSON.stringify({
            type: "identify",
            data: {
              clientType: "server",
              capabilities: ["agent_relay", "file_transfer"],
            },
          }),
        );

        resolve(ws);
      });

      ws.on("error", reject);

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleRemoteServerMessage(ws, message);
        } catch (error) {
          cli.warn(`远程服务器消息解析失败: ${error.message}`);
        }
      });
    });
  }

  /**
   * 处理远程服务器消息
   */
  handleRemoteServerMessage(ws, message) {
    const { type, data } = message;

    switch (type) {
      case "welcome":
        cli.debug(
          `连接到远程服务器: ${data.serverInfo.name} v${data.serverInfo.version}`,
        );
        break;

      case "agent_online":
        this.handleRemoteAgentOnline(data.agent);
        break;

      case "agent_offline":
        this.handleRemoteAgentOffline(data.agentId);
        break;

      default:
        cli.debug(`收到远程服务器消息: ${type}`);
    }
  }

  /**
   * 处理远程 Agent 上线
   */
  handleRemoteAgentOnline(agent) {
    const serverId = `remote_${agent.agentId}`;

    this.serverRegistry.set(serverId, {
      ...agent,
      isRemote: true,
      serverId,
    });

    cli.debug(`远程 Agent 上线: ${agent.name} (${agent.agentId})`);
  }

  /**
   * 处理远程 Agent 离线
   */
  handleRemoteAgentOffline(agentId) {
    for (const [serverId, agent] of this.serverRegistry.entries()) {
      if (agent.agentId === agentId) {
        this.serverRegistry.delete(serverId);
        cli.debug(`远程 Agent 离线: ${agentId}`);
        break;
      }
    }
  }
}

module.exports = ServerManager;
