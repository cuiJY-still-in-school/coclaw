const fs = require("fs-extra");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const { cli } = require("./cli");
const OpenClaw = require("./openclaw");

const execAsync = promisify(exec);

/**
 * Agent 管理器
 */
class AgentManager {
  constructor(config) {
    this.config = config;
    this.agentsDir = config.agentsDir;
    this.runningAgents = new Map(); // agentId -> process info
    this.openclaw = new OpenClaw();
  }

  /**
   * 列出所有 Agent
   */
  async listAgents() {
    try {
      await this.config.ensureDirectories();

      if (!(await fs.pathExists(this.agentsDir))) {
        return [];
      }

      const agentDirs = await fs.readdir(this.agentsDir);
      const agents = [];

      for (const agentId of agentDirs) {
        const agentPath = path.join(this.agentsDir, agentId);
        const stats = await fs.stat(agentPath);

        if (stats.isDirectory()) {
          const agentConfigPath = path.join(agentPath, "config.json");
          let agentConfig = {};

          if (await fs.pathExists(agentConfigPath)) {
            try {
              const configContent = await fs.readFile(agentConfigPath, "utf8");
              agentConfig = JSON.parse(configContent);
            } catch (error) {
              cli.warn(`无法读取 Agent ${agentId} 的配置: ${error.message}`);
            }
          }

          agents.push({
            id: agentId,
            name: agentConfig.name || agentId,
            status: (await this.isAgentRunning(agentId)) ? "运行中" : "停止",
            createdAt: stats.birthtime || stats.ctime,
            config: agentConfig,
          });
        }
      }

      return agents;
    } catch (error) {
      cli.error(`列出 Agent 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查 Agent 是否存在
   * @param {string} agentId
   */
  async agentExists(agentId) {
    try {
      const agentPath = path.join(this.agentsDir, agentId);
      return await fs.pathExists(agentPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * 创建新 Agent
   * @param {string} name - Agent 名称
   */
  async createAgent(name) {
    try {
      await this.config.ensureDirectories();

      // 生成唯一 ID
      const agentId = `agent_${uuidv4().replace(/-/g, "").substring(0, 12)}`;
      const agentPath = path.join(this.agentsDir, agentId);

      // 创建 Agent 目录结构
      await fs.ensureDir(agentPath);
      await fs.ensureDir(path.join(agentPath, "data"));
      await fs.ensureDir(path.join(agentPath, "files"));
      await fs.ensureDir(path.join(agentPath, "logs"));

      // 创建 Agent 配置
      const agentConfig = {
        id: agentId,
        name: name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        openclaw: {
          configPath: path.join(agentPath, "openclaw.json"),
          dataDir: path.join(agentPath, "data"),
        },
        network: {
          port:
            this.config.get("agents.defaultPort", 18791) +
            Math.floor(Math.random() * 1000),
        },
      };

      await fs.writeFile(
        path.join(agentPath, "config.json"),
        JSON.stringify(agentConfig, null, 2),
      );

      // 创建默认 OpenClaw 配置
      const openclawConfig = {
        meta: {
          lastTouchedVersion: "2026.4.2",
          lastTouchedAt: new Date().toISOString(),
        },
        agents: {
          defaults: {
            model: "deepseek/deepseek-chat",
          },
        },
        gateway: {
          port: agentConfig.network.port,
          mode: "local",
          bind: "loopback",
        },
      };

      await fs.writeFile(
        path.join(agentPath, "openclaw.json"),
        JSON.stringify(openclawConfig, null, 2),
      );

      // 创建默认关系配置
      const relationsConfig = {
        agentId: agentId,
        relations: [],
      };

      await fs.writeFile(
        path.join(agentPath, "relations.json"),
        JSON.stringify(relationsConfig, null, 2),
      );

      // 创建聊天记录数据库文件
      await fs.writeFile(
        path.join(agentPath, "data", "chat.db"),
        JSON.stringify({ messages: [], createdAt: new Date().toISOString() }),
      );

      cli.success(`Agent "${name}" 创建成功`);
      return agentId;
    } catch (error) {
      cli.error(`创建 Agent 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 启动 Agent
   * @param {string} agentId
   */
  async startAgent(agentId) {
    try {
      // 检查 Agent 是否存在
      if (!(await this.agentExists(agentId))) {
        throw new Error(`Agent "${agentId}" 不存在`);
      }

      // 检查是否已在运行
      if (await this.isAgentRunning(agentId)) {
        throw new Error(`Agent "${agentId}" 已经在运行中`);
      }

      const agentPath = path.join(this.agentsDir, agentId);
      const openclawConfigPath = path.join(agentPath, "openclaw.json");
      const agentDataDir = path.join(agentPath, "data");

      // 检查 OpenClaw 是否安装
      await this.openclaw.checkInstallation();

      // 验证配置
      await this.openclaw.validateConfig(openclawConfigPath);

      // 获取 Agent 配置以确定端口
      const configPath = path.join(agentPath, "config.json");
      const configContent = await fs.readFile(configPath, "utf8");
      const agentConfig = JSON.parse(configContent);
      const port = agentConfig.network?.port || 18791;

      // 启动 OpenClaw Gateway
      const env = {
        ...process.env,
        OPENCLAW_CONFIG_PATH: openclawConfigPath,
        OPENCLAW_STATE_DIR: agentDataDir,
      };

      const args = ["gateway", "--port", port.toString()];

      const openclawProcess = spawn("openclaw", args, {
        cwd: agentPath,
        env: env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: true,
      });

      // 保存进程引用
      this.runningAgents.set(agentId, {
        process: openclawProcess,
        pid: openclawProcess.pid,
        port: port,
        startedAt: new Date(),
      });

      // 监听进程退出
      openclawProcess.on("exit", (code) => {
        this.runningAgents.delete(agentId);
        if (code !== 0 && code !== null) {
          cli.warn(`Agent "${agentId}" 进程异常退出，代码: ${code}`);
        }
      });

      // 记录日志
      const logStream = fs.createWriteStream(
        path.join(agentPath, "logs", `gateway-${Date.now()}.log`),
        { flags: "a" },
      );

      openclawProcess.stdout.on("data", (data) => {
        const logData = `[STDOUT] ${data}`;
        logStream.write(logData);
        cli.debug(`Agent ${agentId}: ${data.toString().trim()}`);
      });

      openclawProcess.stderr.on("data", (data) => {
        const logData = `[STDERR] ${data}`;
        logStream.write(logData);
        cli.debug(`Agent ${agentId} [ERROR]: ${data.toString().trim()}`);
      });

      // 等待 Gateway 启动
      await this.waitForGatewayStart(port, 10000);

      cli.debug(
        `Agent "${agentId}" 启动成功，PID: ${openclawProcess.pid}, 端口: ${port}`,
      );
      return true;
    } catch (error) {
      cli.error(`启动 Agent "${agentId}" 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 等待 Gateway 启动
   * @param {number} port
   * @param {number} timeout
   */
  async waitForGatewayStart(port, timeout = 10000) {
    const startTime = Date.now();
    const checkInterval = 500;

    while (Date.now() - startTime < timeout) {
      try {
        const status = await this.openclaw.checkGatewayStatus(port);
        if (status !== "NOT_RUNNING") {
          return true;
        }
      } catch (error) {
        // 忽略检查错误
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Gateway 在 ${timeout}ms 内未启动`);
  }

  /**
   * 停止 Agent
   * @param {string} agentId
   */
  async stopAgent(agentId) {
    try {
      const agentInfo = this.runningAgents.get(agentId);

      if (!agentInfo) {
        throw new Error(`Agent "${agentId}" 未在运行`);
      }

      const { process, port } = agentInfo;

      // 先尝试优雅停止
      const stopped = await this.openclaw.stopGateway(port);

      if (!stopped) {
        // 如果优雅停止失败，强制终止进程
        process.kill("SIGTERM");

        // 等待进程退出
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            if (process.killed) {
              resolve();
            } else {
              process.kill("SIGKILL");
              resolve();
            }
          }, 5000);

          process.on("exit", () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      this.runningAgents.delete(agentId);
      cli.debug(`Agent "${agentId}" 已停止`);
      return true;
    } catch (error) {
      cli.error(`停止 Agent "${agentId}" 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查 Agent 是否在运行
   * @param {string} agentId
   */
  async isAgentRunning(agentId) {
    // 首先检查运行中进程列表
    if (this.runningAgents.has(agentId)) {
      const agentInfo = this.runningAgents.get(agentId);
      const { process } = agentInfo;

      // 检查进程是否存活
      if (process.exitCode !== null) {
        this.runningAgents.delete(agentId);
        return false;
      }
      return true;
    }

    // 如果没有在运行中列表，检查进程是否存在
    try {
      // 直接读取配置文件获取端口
      const agentPath = path.join(this.agentsDir, agentId);
      const configPath = path.join(agentPath, "config.json");

      if (!(await fs.pathExists(configPath))) {
        return false;
      }

      const configContent = await fs.readFile(configPath, "utf8");
      const config = JSON.parse(configContent);
      const port = config.network?.port || 18791;

      // 简单检查端口是否被占用
      const { stdout } = await execAsync(`lsof -ti:${port} || echo ""`);
      return stdout.trim() !== "";
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取 Agent 信息
   * @param {string} agentId
   */
  async getAgentInfo(agentId) {
    try {
      if (!(await this.agentExists(agentId))) {
        throw new Error(`Agent "${agentId}" 不存在`);
      }

      const agentPath = path.join(this.agentsDir, agentId);
      const configPath = path.join(agentPath, "config.json");

      const configContent = await fs.readFile(configPath, "utf8");
      const config = JSON.parse(configContent);

      const isRunning = await this.isAgentRunning(agentId);

      return {
        ...config,
        isRunning,
        agentPath,
        pid: isRunning ? this.runningAgents.get(agentId)?.pid : null,
      };
    } catch (error) {
      cli.error(`获取 Agent 信息失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 删除 Agent
   * @param {string} agentId
   */
  async deleteAgent(agentId) {
    try {
      // 如果正在运行，先停止
      if (this.runningAgents.has(agentId)) {
        await this.stopAgent(agentId);
      }

      const agentPath = path.join(this.agentsDir, agentId);

      if (!(await fs.pathExists(agentPath))) {
        throw new Error(`Agent "${agentId}" 不存在`);
      }

      await fs.remove(agentPath);
      return true;
    } catch (error) {
      cli.error(`删除 Agent "${agentId}" 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新 Agent 配置
   * @param {string} agentId
   * @param {Object} updates
   */
  async updateAgentConfig(agentId, updates) {
    try {
      const agentPath = path.join(this.agentsDir, agentId);
      const configPath = path.join(agentPath, "config.json");

      if (!(await fs.pathExists(configPath))) {
        throw new Error(`Agent "${agentId}" 配置不存在`);
      }

      const configContent = await fs.readFile(configPath, "utf8");
      const config = JSON.parse(configContent);

      // 合并更新
      const updatedConfig = {
        ...config,
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
      return updatedConfig;
    } catch (error) {
      cli.error(`更新 Agent 配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取 Agent 关系配置
   * @param {string} agentId
   */
  async getAgentRelations(agentId) {
    try {
      const relationsPath = this.config.getAgentRelationsPath(agentId);

      if (!(await fs.pathExists(relationsPath))) {
        return { agentId, relations: [] };
      }

      const relationsContent = await fs.readFile(relationsPath, "utf8");
      return JSON.parse(relationsContent);
    } catch (error) {
      cli.error(`获取 Agent 关系失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 更新 Agent 关系配置
   * @param {string} agentId
   * @param {Object} relations
   */
  async updateAgentRelations(agentId, relations) {
    try {
      const relationsPath = this.config.getAgentRelationsPath(agentId);
      const relationsConfig = {
        agentId,
        relations,
        updatedAt: new Date().toISOString(),
      };

      await fs.writeFile(
        relationsPath,
        JSON.stringify(relationsConfig, null, 2),
      );
      return relationsConfig;
    } catch (error) {
      cli.error(`更新 Agent 关系失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 停止所有 Agent
   */
  async stopAllAgents() {
    try {
      const agents = await this.listAgents();

      for (const agent of agents) {
        if (await this.isAgentRunning(agent.id)) {
          try {
            await this.stopAgent(agent.id);
            cli.info(`已停止 Agent: ${agent.id}`);
          } catch (error) {
            cli.warn(`停止 Agent ${agent.id} 失败: ${error.message}`);
          }
        }
      }

      return true;
    } catch (error) {
      cli.error(`停止所有 Agent 失败: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AgentManager;
