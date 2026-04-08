const { cli } = require("../cli");
const Config = require("../config");
const AgentManager = require("../agent-manager");
// 临时简化 create 命令，跳过交互
// const inquirer = require("inquirer").default;

/**
 * 创建新 Agent
 */
async function run() {
  try {
    cli.title("创建新 Agent");

    // 加载配置
    const config = new Config();
    await config.load();

    // 获取 Agent 管理器
    const agentManager = new AgentManager(config);

    // 临时简化：使用默认名称
    const answers = {
      name: "Test Agent",
      configureNow: false,
    };

    const createProgress = cli.progress("正在创建 Agent...");

    // 创建 Agent
    const agentId = await agentManager.createAgent(answers.name);

    createProgress();

    cli.success(`Agent 创建成功!`);
    cli.info(`Agent ID: ${agentId}`);
    cli.info(`Agent 名称: ${answers.name}`);
    cli.info(`配置文件: ~/.coclaw/agents/${agentId}/`);

    // 如果需要立即配置
    if (answers.configureNow) {
      cli.info("正在启动配置向导...");

      // 这里会调用 openclaw configure
      // 暂时先提示用户手动配置
      cli.warn(
        "配置功能开发中，请稍后使用 `coclaw ${agentId} configure` 进行配置",
      );
    }

    cli.info("使用以下命令操作 Agent:");
    cli.info(`  coclaw ${agentId} start    # 启动 Agent`);
    cli.info(`  coclaw ${agentId} chat     # 与 Agent 聊天`);
    cli.info(`  coclaw ${agentId} configure # 配置 Agent`);
  } catch (error) {
    cli.error(`创建 Agent 失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

module.exports = { run };
