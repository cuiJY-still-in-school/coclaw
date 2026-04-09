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

    const env = { ...process.env };
    if (configPath) env.OPENCLAW_CONFIG_PATH = configPath;
    if (stateDir) env.OPENCLAW_STATE_DIR = stateDir;

    cli.info("启动 OpenClaw Agent 聊天");

    // 如果有初始消息，发送它
    if (message) {
      const args = ["agent"];
      args.push("--session-id", sessionId);
      args.push("--message", message);
      args.push("--thinking", thinking);

      return this.execute(args, {
        env,
        captureOutput: false,
        showOutput: true,
      });
    } else {
      // 进入交互模式
      return this.interactiveChat(sessionId, thinking, env);
    }
  }

  /**
   * 交互式聊天
   * @param {string} sessionId - 会话 ID
   * @param {string} thinking - 思考级别
   * @param {Object} env - 环境变量
   */
  async interactiveChat(sessionId, thinking, env) {
    const readline = require("readline");

    // 检查 stdin 是否可交互
    if (!process.stdin.isTTY) {
      cli.warn("标准输入不可交互，使用简单模式");
      return this.simpleChat(sessionId, thinking, env);
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    cli.info("进入交互式聊天模式");
    cli.info("输入 /exit 退出聊天");
    cli.info("输入 /help 查看帮助");
    cli.info("按 Ctrl+C 退出");

    // 发送初始问候
    const initialArgs = ["agent"];
    initialArgs.push("--session-id", sessionId);
    initialArgs.push("--message", "你好！");
    initialArgs.push("--thinking", thinking);

    try {
      await this.execute(initialArgs, {
        env,
        captureOutput: false,
        showOutput: true,
      });
    } catch (error) {
      // 忽略初始问候的错误，继续聊天
      cli.debug(`初始问候失败: ${error.message}`);
    }

    // 交互式循环
    while (true) {
      try {
        const userMessage = await new Promise((resolve) => {
          rl.question("\n你: ", resolve);
        });

        // 检查退出命令
        if (userMessage.trim() === "/exit") {
          cli.info("退出聊天");
          rl.close();
          break;
        }

        if (userMessage.trim() === "/help") {
          cli.info("可用命令:");
          cli.info("  /exit - 退出聊天");
          cli.info("  /help - 显示帮助");
          continue;
        }

        if (userMessage.trim() === "") {
          continue;
        }

        // 发送用户消息
        const args = ["agent"];
        args.push("--session-id", sessionId);
        args.push("--message", userMessage);
        args.push("--thinking", thinking);

        await this.execute(args, {
          env,
          captureOutput: false,
          showOutput: true,
        });
      } catch (error) {
        if (
          error.message.includes("SIGINT") ||
          error.message.includes("Ctrl+C")
        ) {
          cli.info("聊天已退出");
          rl.close();
          break;
        } else {
          cli.error(`聊天错误: ${error.message}`);
          // 继续聊天
        }
      }
    }
  }

  /**
   * 简单聊天模式（用于非交互式环境）
   * @param {string} sessionId - 会话 ID
   * @param {string} thinking - 思考级别
   * @param {Object} env - 环境变量
   */
  async simpleChat(sessionId, thinking, env) {
    cli.info("进入简单聊天模式");
    cli.info("输入消息与 AI 对话，输入 /exit 退出");

    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // 发送初始问候
    const initialArgs = ["agent"];
    initialArgs.push("--session-id", sessionId);
    initialArgs.push("--message", "你好！");
    initialArgs.push("--thinking", thinking);

    try {
      await this.execute(initialArgs, {
        env,
        captureOutput: false,
        showOutput: true,
      });
    } catch (error) {
      cli.debug(`初始问候失败: ${error.message}`);
    }

    // 逐行读取输入
    for await (const line of rl) {
      const userMessage = line.trim();

      if (userMessage === "/exit") {
        cli.info("退出聊天");
        break;
      }

      if (userMessage === "/help") {
        cli.info("可用命令:");
        cli.info("  /exit - 退出聊天");
        cli.info("  /help - 显示帮助");
        continue;
      }

      if (userMessage === "") {
        continue;
      }

      // 发送用户消息
      const args = ["agent"];
      args.push("--session-id", sessionId);
      args.push("--message", userMessage);
      args.push("--thinking", thinking);

      try {
        await this.execute(args, {
          env,
          captureOutput: false,
          showOutput: true,
        });
      } catch (error) {
        cli.error(`聊天错误: ${error.message}`);
      }
    }

    rl.close();
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
