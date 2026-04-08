const { cli } = require("../cli");
const Config = require("../config");
const AgentManager = require("../agent-manager");

/**
 * 列出所有 Agent
 */
async function run() {
  try {
    cli.title("Agent 列表");

    // 加载配置
    const config = new Config();
    await config.load();

    // 获取 Agent 管理器
    const agentManager = new AgentManager(config);
    const agents = await agentManager.listAgents();

    if (agents.length === 0) {
      cli.info("没有找到任何 Agent");
      cli.info("使用 `coclaw create` 创建新 Agent");
      return;
    }

    // 显示表格
    cli.table(agents, [
      { name: "ID", key: "id", width: 30 },
      { name: "名称", key: "name", width: 20 },
      { name: "状态", key: "status", width: 10 },
      { name: "创建时间", key: "createdAt", width: 20 },
    ]);

    cli.success(`找到 ${agents.length} 个 Agent`);
  } catch (error) {
    cli.error(`列出 Agent 失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

module.exports = { run };
