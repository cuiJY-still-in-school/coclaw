const { exec, spawn } = require("child_process");
const { promisify } = require("util");
const fs = require("fs-extra");
const path = require("path");
const { cli } = require("./cli");

const execAsync = promisify(exec);

/**
 * OpenClaw CLI 封装类
 */
class OpenClaw {
  constructor() {
    this.binaryPath = "openclaw";
    this.version = null;
  }

  /**
   * 检查 OpenClaw 是否安装
   */
  async checkInstallation() {
    try {
      const { stdout } = await execAsync(`which ${this.binaryPath}`);
      return stdout.trim();
    } catch (error) {
      throw new Error(
        "OpenClaw 未安装，请先运行: npm install -g openclaw@latest",
      );
    }
  }

  /**
   * 获取 OpenClaw 版本
   */
  async getVersion() {
    if (this.version) return this.version;

    try {
      const { stdout } = await execAsync(`${this.binaryPath} --version`);
      this.version = stdout.trim();
      return this.version;
    } catch (error) {
      throw new Error(`获取 OpenClaw 版本失败: ${error.message}`);
    }
  }

  /**
   * 执行 OpenClaw 命令
   * @param {Array} args - 命令参数
   * @param {Object} options - 执行选项
   */
  async execute(args, options = {}) {
    const {
      cwd = process.cwd(),
      env = process.env,
      timeout = 30000,
      captureOutput = true,
      showOutput = false,
    } = options;

    const command = `${this.binaryPath} ${args.join(" ")}`;

    cli.debug(`执行 OpenClaw 命令: ${command}`);

    try {
      if (captureOutput) {
        const { stdout, stderr } = await execAsync(command, {
          cwd,
          env,
          timeout,
        });

        if (showOutput && stdout) {
          console.log(stdout);
        }

        if (stderr && stderr.trim()) {
          cli.warn(`OpenClaw 警告: ${stderr.trim()}`);
        }

        return { stdout: stdout.trim(), stderr: stderr.trim() };
      } else {
        // 实时输出模式
        return new Promise((resolve, reject) => {
          const process = spawn(this.binaryPath, args, {
            cwd,
            env,
            stdio: "inherit",
          });

          process.on("close", (code) => {
            if (code === 0) {
              resolve({ code: 0 });
            } else {
              reject(new Error(`OpenClaw 命令退出代码: ${code}`));
            }
          });

          process.on("error", reject);
        });
      }
    } catch (error) {
      if (error.code === "ETIMEDOUT") {
        throw new Error(`OpenClaw 命令执行超时 (${timeout}ms)`);
      }
      throw new Error(`OpenClaw 命令执行失败: ${error.message}`);
    }
  }

  /**
   * 启动 Gateway
   * @param {Object} options - 启动选项
   */
  async startGateway(options = {}) {
    const {
      port = 18789,
      verbose = false,
      configPath = null,
      stateDir = null,
    } = options;

    const args = ["gateway"];

    if (port) args.push("--port", port.toString());
    if (verbose) args.push("--verbose");

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;
    if (stateDir) env.OPENCLAW_STATE_DIR = stateDir;

    cli.info(`启动 OpenClaw Gateway (端口: ${port})`);

    return this.execute(args, {
      env,
      captureOutput: false,
      showOutput: true,
    });
  }

  /**
   * 配置 OpenClaw
   * @param {Object} options - 配置选项
   */
  async configure(options = {}) {
    const { configPath = null, interactive = true } = options;

    const args = ["configure"];

    if (!interactive) {
      args.push("--non-interactive");
    }

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;

    cli.info("启动 OpenClaw 配置向导");

    return this.execute(args, {
      env,
      captureOutput: false,
      showOutput: true,
    });
  }

  /**
   * 发送消息
   * @param {Object} options - 消息选项
   */
  async sendMessage(options = {}) {
    const { to, message, configPath = null } = options;

    if (!to || !message) {
      throw new Error("需要提供接收者和消息内容");
    }

    const args = ["message", "send", "--to", to, "--message", `"${message}"`];

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;

    return this.execute(args, { env });
  }

  /**
   * 与 Agent 聊天
   * @param {Object} options - 聊天选项
   */
  async chat(options = {}) {
    const {
      message,
      thinking = "medium",
      configPath = null,
      stateDir = null,
      sessionId = "coclaw-chat", // 默认会话 ID
    } = options;

    const args = ["agent"];

    // 使用会话 ID 而不是 agent ID
    // OpenClaw 需要 --session-id, --to, 或 --agent 参数
    args.push("--session-id", sessionId);

    if (message) {
      args.push("--message", message);
    } else {
      // 如果没有消息，启动交互模式
      args.push("--message", "开始聊天");
    }

    if (thinking) {
      args.push("--thinking", thinking);
    }

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;
    if (stateDir) env.OPENCLAW_STATE_DIR = stateDir;

    cli.info("启动 OpenClaw Agent 聊天");

    return this.execute(args, {
      env,
      captureOutput: false,
      showOutput: true,
    });
  }

  /**
   * 运行 Onboard 向导
   * @param {Object} options - Onboard 选项
   */
  async onboard(options = {}) {
    const { installDaemon = false, profile = null } = options;

    const args = ["onboard"];

    if (installDaemon) {
      args.push("--install-daemon");
    }

    if (profile) {
      args.push("--profile", profile);
    }

    cli.info("启动 OpenClaw Onboard 向导");

    return this.execute(args, {
      captureOutput: false,
      showOutput: true,
    });
  }

  /**
   * 运行 Doctor 检查
   * @param {Object} options - Doctor 选项
   */
  async doctor(options = {}) {
    const { configPath = null, fix = false } = options;

    const args = ["doctor"];

    if (fix) {
      args.push("--fix");
    }

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;

    cli.info("运行 OpenClaw Doctor 检查");

    return this.execute(args, {
      env,
      showOutput: true,
    });
  }

  /**
   * 检查 Gateway 状态
   * @param {number} port - Gateway 端口
   */
  async checkGatewayStatus(port = 18789) {
    try {
      const { stdout } = await execAsync(
        `curl -s http://localhost:${port}/health || echo "NOT_RUNNING"`,
      );
      return stdout.trim();
    } catch (error) {
      return "NOT_RUNNING";
    }
  }

  /**
   * 停止 Gateway
   * @param {number} port - Gateway 端口
   */
  async stopGateway(port = 18789) {
    try {
      // 尝试通过 API 停止
      await execAsync(`curl -X POST http://localhost:${port}/shutdown || true`);

      // 查找并杀死进程
      const { stdout } = await execAsync(`lsof -ti:${port} || echo ""`);
      const pids = stdout
        .trim()
        .split("\n")
        .filter((pid) => pid);

      for (const pid of pids) {
        if (pid) {
          await execAsync(`kill -TERM ${pid} || kill -KILL ${pid}`);
        }
      }

      return true;
    } catch (error) {
      cli.warn(`停止 Gateway 时出错: ${error.message}`);
      return false;
    }
  }

  /**
   * 验证配置
   * @param {string} configPath - 配置文件路径
   */
  async validateConfig(configPath) {
    if (!(await fs.pathExists(configPath))) {
      throw new Error(`配置文件不存在: ${configPath}`);
    }

    try {
      const configContent = await fs.readFile(configPath, "utf8");
      JSON.parse(configContent);
      return true;
    } catch (error) {
      throw new Error(`配置文件格式错误: ${error.message}`);
    }
  }

  /**
   * 创建默认配置
   * @param {string} configPath - 配置文件路径
   * @param {Object} overrides - 覆盖配置
   */
  async createDefaultConfig(configPath, overrides = {}) {
    const defaultConfig = {
      meta: {
        lastTouchedVersion: "2026.4.2",
        lastTouchedAt: new Date().toISOString(),
      },
      agent: {
        model: "deepseek/deepseek-chat",
      },
      gateway: {
        port: 18789,
        mode: "local",
        bind: "loopback",
      },
      ...overrides,
    };

    await fs.ensureDir(path.dirname(configPath));
    await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2));

    return defaultConfig;
  }

  /**
   * 获取可用模型
   * @param {string} configPath - 配置文件路径
   */
  async getAvailableModels(configPath = null) {
    try {
      const env = { ...process.env };
      if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;

      const { stdout } = await this.execute(["models", "list"], { env });

      // 解析模型列表
      const lines = stdout.split("\n");
      const models = [];

      for (const line of lines) {
        if (line.includes("/")) {
          const [provider, model] = line.split("/");
          if (provider && model) {
            models.push({ provider: provider.trim(), model: model.trim() });
          }
        }
      }

      return models;
    } catch (error) {
      cli.warn(`获取模型列表失败: ${error.message}`);
      return [];
    }
  }

  /**
   * 测试连接
   * @param {Object} options - 测试选项
   */
  async testConnection(options = {}) {
    const { configPath = null, timeout = 10000 } = options;

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;

    try {
      const { stdout } = await this.execute(["--version"], { env, timeout });
      return {
        success: true,
        version: stdout.trim(),
        message: "OpenClaw 连接正常",
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "OpenClaw 连接失败",
      };
    }
  }
}

module.exports = OpenClaw;
