const { cli } = require("../lib/cli");
const inquirer = require("inquirer").default;

/**
 * UI 提示组件
 * 仿 OpenClaw 风格的终端界面
 */
class UIPrompts {
  constructor() {
    this.theme = {
      primary: "#5865F2", // Discord blue
      success: "#57F287", // Discord green
      warning: "#FEE75C", // Discord yellow
      error: "#ED4245", // Discord red
      info: "#EB459E", // Discord pink
    };
  }

  /**
   * 显示欢迎界面
   */
  showWelcome() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🦞  Coclaw  v0.1.0                        ║
║          基于 OpenClaw 的本地局域网 AI 协作工具              ║
╚══════════════════════════════════════════════════════════════╝
`);
  }

  /**
   * 显示主菜单
   * @returns {Promise<Object>}
   */
  async showMainMenu() {
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "请选择操作:",
        choices: [
          { name: "📋 列出所有 Agent", value: "list" },
          { name: "🆕 创建新 Agent", value: "create" },
          { name: "🚀 启动/停止服务器", value: "server" },
          { name: "🔗 连接到远程服务器", value: "connect" },
          { name: "⚙️  Agent 管理", value: "agent" },
          { name: "❓ 帮助", value: "help" },
          { name: "🚪 退出", value: "exit" },
        ],
      },
    ]);

    return { action };
  }

  /**
   * 显示 Agent 管理菜单
   * @param {Array} agents - Agent 列表
   * @returns {Promise<Object>}
   */
  async showAgentMenu(agents = []) {
    const choices = agents.map((agent) => ({
      name: `${agent.isRunning ? "🟢" : "🔴"} ${agent.name} (${agent.id})`,
      value: agent.id,
      short: agent.name,
    }));

    choices.push(new inquirer.Separator(), {
      name: "↩️  返回主菜单",
      value: "back",
    });

    const { agentId } = await inquirer.prompt([
      {
        type: "list",
        name: "agentId",
        message: "选择要管理的 Agent:",
        choices:
          choices.length > 1
            ? choices
            : [
                { name: "📝 创建新 Agent", value: "create" },
                { name: "↩️  返回主菜单", value: "back" },
              ],
      },
    ]);

    if (agentId === "back" || agentId === "create") {
      return { agentId, action: agentId };
    }

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `对 Agent ${agentId} 执行什么操作?`,
        choices: [
          { name: "🚀 启动", value: "start" },
          { name: "🛑 停止", value: "stop" },
          { name: "💬 聊天", value: "chat" },
          { name: "⚙️  配置", value: "configure" },
          { name: "🔗 关系配置", value: "relation" },
          { name: "📊 查看信息", value: "info" },
          { name: "🗑️  删除", value: "delete" },
          new inquirer.Separator(),
          { name: "↩️  返回", value: "back" },
        ],
      },
    ]);

    return { agentId, action };
  }

  /**
   * 显示关系配置界面
   * @param {string} agentId - 当前 Agent ID
   * @param {Array} allAgents - 所有 Agent 列表
   * @param {Array} currentRelations - 当前关系配置
   * @returns {Promise<Object>}
   */
  async showRelationConfig(agentId, allAgents, currentRelations = []) {
    cli.title(`配置 ${agentId} 的关系`);

    const otherAgents = allAgents.filter((a) => a.id !== agentId);

    if (otherAgents.length === 0) {
      cli.info("没有其他 Agent 可以配置关系");
      return { relations: [] };
    }

    const relationChoices = otherAgents.map((agent) => {
      const existingRelation = currentRelations.find(
        (r) => r.targetAgentId === agent.id,
      );
      const status = existingRelation ? "✅" : "❌";

      return {
        name: `${status} ${agent.name} (${agent.id})`,
        value: agent.id,
        checked: !!existingRelation,
      };
    });

    const { selectedAgents } = await inquirer.prompt([
      {
        type: "checkbox",
        name: "selectedAgents",
        message: "选择允许通信的 Agent:",
        choices: relationChoices,
        pageSize: 10,
      },
    ]);

    // 为每个选中的 Agent 配置详细权限
    const relations = [];

    for (const targetAgentId of selectedAgents) {
      const targetAgent = otherAgents.find((a) => a.id === targetAgentId);
      const existingRelation = currentRelations.find(
        (r) => r.targetAgentId === targetAgentId,
      );

      cli.title(`配置与 ${targetAgent.name} 的关系`);

      const { allowFileSend, allowFileReceive, allowHistoryRead } =
        await inquirer.prompt([
          {
            type: "confirm",
            name: "allowFileSend",
            message: "允许发送文件?",
            default: existingRelation?.allowFileSend ?? true,
          },
          {
            type: "confirm",
            name: "allowFileReceive",
            message: "允许接收文件?",
            default: existingRelation?.allowFileReceive ?? true,
          },
          {
            type: "confirm",
            name: "allowHistoryRead",
            message: "允许读取聊天记录?",
            default: existingRelation?.allowHistoryRead ?? false,
          },
        ]);

      relations.push({
        targetAgentId,
        allowCommunication: true,
        allowFileSend,
        allowFileReceive,
        allowHistoryRead,
        allowRemoteExecution: false, // 默认关闭，需要额外授权
      });
    }

    // 处理未选中的 Agent（禁用通信）
    const unselectedAgents = otherAgents
      .filter((a) => !selectedAgents.includes(a.id))
      .map((agent) => ({
        targetAgentId: agent.id,
        allowCommunication: false,
        allowFileSend: false,
        allowFileReceive: false,
        allowHistoryRead: false,
        allowRemoteExecution: false,
      }));

    return { relations: [...relations, ...unselectedAgents] };
  }

  /**
   * 显示服务器连接界面
   * @returns {Promise<Object>}
   */
  async showServerConnect() {
    const { serverAddress } = await inquirer.prompt([
      {
        type: "input",
        name: "serverAddress",
        message: "输入服务器地址 (格式: host:port):",
        default: "localhost:18790",
        validate: (input) => {
          if (!input) return "服务器地址不能为空";
          const parts = input.split(":");
          if (parts.length !== 2) return "格式错误，请使用 host:port 格式";
          const port = parseInt(parts[1], 10);
          if (isNaN(port) || port < 1 || port > 65535) return "端口号无效";
          return true;
        },
      },
    ]);

    const [host, port] = serverAddress.split(":");

    return { host, port: parseInt(port, 10) };
  }

  /**
   * 显示创建 Agent 向导
   * @returns {Promise<Object>}
   */
  async showCreateAgentWizard() {
    cli.title("创建新 Agent");

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Agent 名称:",
        validate: (input) => {
          if (!input || input.trim().length === 0) {
            return "名称不能为空";
          }
          if (input.length > 50) {
            return "名称不能超过 50 个字符";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "model",
        message: "选择 AI 模型:",
        choices: [
          { name: "DeepSeek Chat", value: "deepseek/deepseek-chat" },
          { name: "DeepSeek Reasoner", value: "deepseek/deepseek-reasoner" },
          { name: "Kimi Code", value: "kimi/kimi-code" },
          { name: "GPT-5.4", value: "openai/gpt-5.4" },
          { name: "手动配置", value: "custom" },
        ],
        default: "deepseek/deepseek-chat",
      },
      {
        type: "confirm",
        name: "configureNow",
        message: "立即配置 Agent?",
        default: true,
      },
      {
        type: "confirm",
        name: "startAfterCreate",
        message: "创建后立即启动?",
        default: false,
        when: (answers) => !answers.configureNow,
      },
    ]);

    return answers;
  }

  /**
   * 显示确认对话框
   * @param {string} message - 确认消息
   * @param {boolean} defaultYes - 默认是否确认
   * @returns {Promise<boolean>}
   */
  async showConfirm(message, defaultYes = false) {
    const { confirmed } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmed",
        message: message,
        default: defaultYes,
      },
    ]);

    return confirmed;
  }

  /**
   * 显示进度界面
   * @param {string} message - 进度消息
   * @returns {Function} 停止函数
   */
  showProgress(message) {
    return cli.progress(message);
  }

  /**
   * 显示错误界面
   * @param {string} title - 错误标题
   * @param {Error} error - 错误对象
   * @param {Object} options - 选项
   */
  showError(title, error, options = {}) {
    const { showStackTrace = false, suggestions = [] } = options;

    console.log("\n" + "═".repeat(60));
    console.log(`❌ ${title}`);
    console.log("─".repeat(60));
    console.log(`错误: ${error.message}`);

    if (showStackTrace && error.stack) {
      console.log("\n堆栈跟踪:");
      console.log(error.stack);
    }

    if (suggestions.length > 0) {
      console.log("\n建议:");
      suggestions.forEach((suggestion, index) => {
        console.log(`  ${index + 1}. ${suggestion}`);
      });
    }

    console.log("═".repeat(60) + "\n");
  }

  /**
   * 显示成功界面
   * @param {string} message - 成功消息
   * @param {Object} details - 详细信息
   */
  showSuccess(message, details = {}) {
    console.log("\n" + "━".repeat(60));
    console.log(`✅ ${message}`);
    console.log("─".repeat(60));

    Object.entries(details).forEach(([key, value]) => {
      console.log(`${key}: ${value}`);
    });

    console.log("━".repeat(60) + "\n");
  }

  /**
   * 显示信息卡片
   * @param {string} title - 卡片标题
   * @param {Object} info - 信息对象
   */
  showInfoCard(title, info) {
    console.log("\n" + "╔" + "═".repeat(58) + "╗");
    console.log(`║ ${title.padEnd(56)} ║`);
    console.log("╠" + "═".repeat(58) + "╣");

    Object.entries(info).forEach(([key, value]) => {
      const line = `  ${key}: ${value}`;
      console.log(`║ ${line.padEnd(56)} ║`);
    });

    console.log("╚" + "═".repeat(58) + "╝\n");
  }

  /**
   * 显示帮助界面
   */
  showHelp() {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                        Coclaw 帮助                           ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  基础命令:                                                   ║
║    coclaw list               列出所有 Agent                  ║
║    coclaw create             创建新 Agent                    ║
║    coclaw server             启动/停止服务器                 ║
║    coclaw connect <host:port> 连接到远程服务器               ║
║                                                              ║
║  Agent 操作:                                                 ║
║    coclaw agent <id> start   启动 Agent                      ║
║    coclaw agent <id> chat    与 Agent 聊天                   ║
║    coclaw agent <id> configure 配置 Agent                    ║
║    coclaw agent <id> relation 配置 Agent 关系                ║
║                                                              ║
║  全局选项:                                                   ║
║    -V, --version             显示版本信息                    ║
║    -H, --help                显示帮助信息                    ║
║                                                              ║
║  交互模式:                                                   ║
║    直接运行 coclaw 进入交互式界面                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
  }
}

module.exports = UIPrompts;
