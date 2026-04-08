const { cli } = require("../lib/cli");
const Config = require("../lib/config");
const AgentManager = require("../lib/agent-manager");
const UIPrompts = require("./prompts");

/**
 * 交互式界面主类
 */
class InteractiveUI {
  constructor() {
    this.config = null;
    this.agentManager = null;
    this.ui = new UIPrompts();
    this.running = true;
  }

  /**
   * 初始化
   */
  async initialize() {
    try {
      this.ui.showWelcome();

      // 加载配置
      this.config = new Config();
      await this.config.load();

      // 初始化 Agent 管理器
      this.agentManager = new AgentManager(this.config);

      cli.success("系统初始化完成");
      return true;
    } catch (error) {
      this.ui.showError("初始化失败", error, {
        suggestions: [
          "检查 ~/.coclaw/ 目录权限",
          "确保 Node.js 版本 >= 18",
          "运行 coclaw --help 查看基础命令",
        ],
      });
      return false;
    }
  }

  /**
   * 运行主循环
   */
  async run() {
    if (!(await this.initialize())) {
      return;
    }

    while (this.running) {
      try {
        const { action } = await this.ui.showMainMenu();

        switch (action) {
          case "list":
            await this.handleListAgents();
            break;

          case "create":
            await this.handleCreateAgent();
            break;

          case "server":
            await this.handleServer();
            break;

          case "connect":
            await this.handleConnect();
            break;

          case "agent":
            await this.handleAgentManagement();
            break;

          case "help":
            this.ui.showHelp();
            break;

          case "exit":
            await this.handleExit();
            break;
        }
      } catch (error) {
        if (error.message === "User force closed the prompt") {
          await this.handleExit();
        } else {
          this.ui.showError("操作失败", error);
        }
      }
    }
  }

  /**
   * 处理列出 Agent
   */
  async handleListAgents() {
    const stopProgress = this.ui.showProgress("加载 Agent 列表...");

    try {
      const agents = await this.agentManager.listAgents();
      stopProgress();

      if (agents.length === 0) {
        cli.info("没有找到任何 Agent");
        const create = await this.ui.showConfirm("是否创建新 Agent?", true);
        if (create) {
          await this.handleCreateAgent();
        }
      } else {
        this.ui.showInfoCard("Agent 列表", {
          总数: agents.length,
          运行中: agents.filter((a) => a.status === "运行中").length,
          已停止: agents.filter((a) => a.status === "停止").length,
        });

        // 显示详细列表
        cli.table(agents, [
          { name: "状态", key: "status", width: 8 },
          { name: "ID", key: "id", width: 30 },
          { name: "名称", key: "name", width: 20 },
          { name: "创建时间", key: "createdAt", width: 20 },
        ]);
      }
    } catch (error) {
      stopProgress();
      throw error;
    }
  }

  /**
   * 处理创建 Agent
   */
  async handleCreateAgent() {
    try {
      const answers = await this.ui.showCreateAgentWizard();

      const stopProgress = this.ui.showProgress("创建 Agent...");
      const agentId = await this.agentManager.createAgent(answers.name);
      stopProgress();

      this.ui.showSuccess("Agent 创建成功", {
        "Agent ID": agentId,
        名称: answers.name,
        配置文件: `~/.coclaw/agents/${agentId}/`,
      });

      // 如果选择立即配置
      if (answers.configureNow) {
        const configure = await this.ui.showConfirm("立即配置 Agent?", true);
        if (configure) {
          await this.handleConfigureAgent(agentId);
        }
      }

      // 如果选择创建后启动
      if (answers.startAfterCreate) {
        const start = await this.ui.showConfirm("立即启动 Agent?", true);
        if (start) {
          await this.handleStartAgent(agentId);
        }
      }
    } catch (error) {
      this.ui.showError("创建 Agent 失败", error, {
        suggestions: ["检查磁盘空间", "检查目录权限", "确保 OpenClaw 已安装"],
      });
    }
  }

  /**
   * 处理服务器管理
   */
  async handleServer() {
    // TODO: 实现服务器管理
    cli.warn("服务器功能开发中");
    cli.info("请使用 `coclaw server` 命令管理服务器");
  }

  /**
   * 处理连接服务器
   */
  async handleConnect() {
    // TODO: 实现服务器连接
    cli.warn("服务器连接功能开发中");
    cli.info("请使用 `coclaw connect <host:port>` 命令连接服务器");
  }

  /**
   * 处理 Agent 管理
   */
  async handleAgentManagement() {
    const agents = await this.agentManager.listAgents();

    if (agents.length === 0) {
      cli.info("没有找到任何 Agent");
      const create = await this.ui.showConfirm("是否创建新 Agent?", true);
      if (create) {
        await this.handleCreateAgent();
      }
      return;
    }

    const { agentId, action } = await this.ui.showAgentMenu(agents);

    if (action === "back" || agentId === "back") {
      return;
    }

    if (agentId === "create") {
      await this.handleCreateAgent();
      return;
    }

    switch (action) {
      case "start":
        await this.handleStartAgent(agentId);
        break;

      case "stop":
        await this.handleStopAgent(agentId);
        break;

      case "chat":
        await this.handleChatWithAgent(agentId);
        break;

      case "configure":
        await this.handleConfigureAgent(agentId);
        break;

      case "relation":
        await this.handleRelationConfig(agentId);
        break;

      case "info":
        await this.handleAgentInfo(agentId);
        break;

      case "delete":
        await this.handleDeleteAgent(agentId);
        break;
    }
  }

  /**
   * 处理启动 Agent
   * @param {string} agentId
   */
  async handleStartAgent(agentId) {
    const stopProgress = this.ui.showProgress(`启动 Agent ${agentId}...`);

    try {
      await this.agentManager.startAgent(agentId);
      stopProgress();

      this.ui.showSuccess(`Agent ${agentId} 已启动`, {
        状态: "运行中",
        端口:
          (await this.agentManager.getAgentInfo(agentId)).config?.network
            ?.port || "未知",
      });
    } catch (error) {
      stopProgress();
      this.ui.showError(`启动 Agent ${agentId} 失败`, error, {
        suggestions: [
          "检查 OpenClaw 是否安装",
          "检查端口是否被占用",
          "查看 Agent 日志: ~/.coclaw/agents/${agentId}/logs/",
        ],
      });
    }
  }

  /**
   * 处理停止 Agent
   * @param {string} agentId
   */
  async handleStopAgent(agentId) {
    const confirm = await this.ui.showConfirm(
      `确定要停止 Agent ${agentId} 吗?`,
      false,
    );
    if (!confirm) return;

    const stopProgress = this.ui.showProgress(`停止 Agent ${agentId}...`);

    try {
      await this.agentManager.stopAgent(agentId);
      stopProgress();

      this.ui.showSuccess(`Agent ${agentId} 已停止`);
    } catch (error) {
      stopProgress();
      this.ui.showError(`停止 Agent ${agentId} 失败`, error);
    }
  }

  /**
   * 处理与 Agent 聊天
   * @param {string} agentId
   */
  async handleChatWithAgent(agentId) {
    cli.info(`正在进入与 ${agentId} 的聊天模式...`);

    try {
      // 检查 Agent 是否运行
      const isRunning = await this.agentManager.isAgentRunning(agentId);
      if (!isRunning) {
        const start = await this.ui.showConfirm(
          "Agent 未运行，是否启动?",
          true,
        );
        if (start) {
          await this.handleStartAgent(agentId);
        } else {
          return;
        }
      }

      // 进入聊天模式
      await this.agentManager.openclaw.chat({
        configPath: this.config.getAgentOpenClawConfigPath(agentId),
        stateDir: this.config.getAgentDataDir(agentId),
        thinking: "medium",
      });
    } catch (error) {
      if (!error.message.includes("SIGINT")) {
        this.ui.showError(`与 Agent ${agentId} 聊天失败`, error);
      }
    }
  }

  /**
   * 处理配置 Agent
   * @param {string} agentId
   */
  async handleConfigureAgent(agentId) {
    cli.info(`正在配置 Agent ${agentId}...`);

    try {
      await this.agentManager.openclaw.configure({
        configPath: this.config.getAgentOpenClawConfigPath(agentId),
        interactive: true,
      });

      this.ui.showSuccess(`Agent ${agentId} 配置完成`);
    } catch (error) {
      this.ui.showError(`配置 Agent ${agentId} 失败`, error, {
        suggestions: [
          "手动运行: cd ~/.coclaw/agents/${agentId}/ && openclaw configure",
          "检查配置文件权限",
        ],
      });
    }
  }

  /**
   * 处理关系配置
   * @param {string} agentId
   */
  async handleRelationConfig(agentId) {
    try {
      const agents = await this.agentManager.listAgents();
      const currentRelations =
        await this.agentManager.getAgentRelations(agentId);

      const { relations } = await this.ui.showRelationConfig(
        agentId,
        agents,
        currentRelations.relations || [],
      );

      const confirm = await this.ui.showConfirm("保存关系配置?", true);
      if (confirm) {
        const stopProgress = this.ui.showProgress("保存关系配置...");
        await this.agentManager.updateAgentRelations(agentId, relations);
        stopProgress();

        this.ui.showSuccess("关系配置已保存", {
          "允许通信的 Agent": relations.filter((r) => r.allowCommunication)
            .length,
          总配置数: relations.length,
        });
      }
    } catch (error) {
      this.ui.showError("配置关系失败", error);
    }
  }

  /**
   * 处理 Agent 信息
   * @param {string} agentId
   */
  async handleAgentInfo(agentId) {
    const stopProgress = this.ui.showProgress("加载 Agent 信息...");

    try {
      const agentInfo = await this.agentManager.getAgentInfo(agentId);
      stopProgress();

      this.ui.showInfoCard(`Agent ${agentId} 信息`, {
        名称: agentInfo.name,
        状态: agentInfo.isRunning ? "运行中" : "停止",
        "Agent ID": agentInfo.id,
        创建时间: new Date(agentInfo.createdAt).toLocaleString(),
        更新时间: new Date(agentInfo.updatedAt).toLocaleString(),
        端口: agentInfo.config?.network?.port || "未知",
        PID: agentInfo.pid || "未运行",
        配置文件: agentInfo.agentPath,
      });
    } catch (error) {
      stopProgress();
      this.ui.showError("获取 Agent 信息失败", error);
    }
  }

  /**
   * 处理删除 Agent
   * @param {string} agentId
   */
  async handleDeleteAgent(agentId) {
    const confirm = await this.ui.showConfirm(
      `确定要删除 Agent ${agentId} 吗？此操作不可撤销！`,
      false,
    );

    if (!confirm) return;

    const stopProgress = this.ui.showProgress(`删除 Agent ${agentId}...`);

    try {
      await this.agentManager.deleteAgent(agentId);
      stopProgress();

      this.ui.showSuccess(`Agent ${agentId} 已删除`);
    } catch (error) {
      stopProgress();
      this.ui.showError(`删除 Agent ${agentId} 失败`, error);
    }
  }

  /**
   * 处理退出
   */
  async handleExit() {
    const confirm = await this.ui.showConfirm("确定要退出吗?", true);
    if (confirm) {
      this.running = false;
      cli.success("感谢使用 Coclaw，再见！");
      process.exit(0);
    }
  }

  /**
   * 启动交互式界面
   */
  static async start() {
    const ui = new InteractiveUI();
    await ui.run();
  }
}

module.exports = InteractiveUI;
