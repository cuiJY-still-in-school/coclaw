const { cli } = require("../cli");
const Config = require("../config");
const AgentManager = require("../agent-manager");
const RelationCLI = require("../relation-cli");
const path = require("path");

/**
 * Agent 操作命令
 * @param {string} id - Agent ID
 * @param {string} action - 操作类型 (start, chat, configure, relation)
 */
async function run(id, action) {
  try {
    // 加载配置
    const config = new Config();
    await config.load();

    // 获取 Agent 管理器
    const agentManager = new AgentManager(config);

    // 检查 Agent 是否存在
    const agentExists = await agentManager.agentExists(id);
    if (!agentExists) {
      throw new Error(`Agent "${id}" 不存在`);
    }

    // 根据操作类型执行
    switch (action) {
      case "start":
        await startAgent(agentManager, id);
        break;

      case "chat":
        await chatWithAgent(agentManager, id);
        break;

      case "configure":
        await configureAgent(agentManager, id);
        break;

      case "relation":
        await configureRelation(agentManager, id);
        break;

      default:
        throw new Error(
          `未知的操作: ${action}。可用操作: start, chat, configure, relation`,
        );
    }
  } catch (error) {
    cli.error(`Agent 操作失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

/**
 * 启动 Agent
 */
async function startAgent(agentManager, agentId) {
  cli.title(`启动 Agent: ${agentId}`);

  // 检查是否已在运行
  const isRunning = await agentManager.isAgentRunning(agentId);
  if (isRunning) {
    cli.warn(`Agent "${agentId}" 已经在运行中`);
    return;
  }

  const startProgress = cli.progress("正在启动 Agent...");
  await agentManager.startAgent(agentId);
  startProgress();

  cli.success(`Agent "${agentId}" 已启动`);
  cli.info("Agent 在后台运行中");
  cli.info(`使用 \`coclaw ${agentId} chat\` 与 Agent 交互`);
}

/**
 * 与 Agent 聊天
 */
async function chatWithAgent(agentManager, agentId) {
  cli.title(`与 Agent 聊天: ${agentId}`);

  // 获取 Agent 信息
  const agentInfo = await agentManager.getAgentInfo(agentId);
  const configPath =
    agentInfo.openclaw?.configPath ||
    path.join(agentInfo.agentPath, "openclaw.json");
  const stateDir =
    agentInfo.openclaw?.dataDir || path.join(agentInfo.agentPath, "data");

  // 检查是否在运行
  const isRunning = await agentManager.isAgentRunning(agentId);
  if (!isRunning) {
    cli.warn(`Agent "${agentId}" 未运行，正在启动...`);
    await agentManager.startAgent(agentId);
  }

  cli.info("正在进入聊天模式...");
  cli.info("输入 /exit 退出聊天");
  cli.info("输入 /help 查看帮助");
  cli.info("按 Ctrl+C 退出");

  try {
    // 调用 OpenClaw chat 命令
    const openclaw = agentManager.openclaw;

    // 启动交互式聊天（不传递 message 参数，让 OpenClaw 进入交互模式）
    await openclaw.chat({
      configPath: configPath,
      stateDir: stateDir,
      // 不传递 message 参数，让 OpenClaw 进入交互模式
    });
  } catch (error) {
    if (error.message.includes("SIGINT") || error.message.includes("Ctrl+C")) {
      cli.info("聊天已退出");
    } else {
      cli.error(`聊天失败: ${error.message}`);

      // 提供备用方案
      cli.info("备用方案:");
      cli.info(`  1. cd ~/.coclaw/agents/${agentId}/`);
      cli.info("  2. openclaw agent --thinking medium");
    }
  }
}

/**
 * 配置 Agent
 */
async function configureAgent(agentManager, agentId) {
  cli.title(`配置 Agent: ${agentId}`);

  // 获取 Agent 信息
  const agentInfo = await agentManager.getAgentInfo(agentId);
  const configPath =
    agentInfo.openclaw?.configPath ||
    path.join(agentInfo.agentPath, "openclaw.json");

  cli.info("正在启动 OpenClaw 配置向导...");

  try {
    // 调用 OpenClaw configure 命令
    const openclaw = agentManager.openclaw;

    const stopProgress = cli.progress("准备配置环境...");

    // 检查 OpenClaw 是否安装
    await openclaw.checkInstallation();

    // 验证配置
    await openclaw.validateConfig(configPath);

    stopProgress();

    // 运行配置向导
    await openclaw.configure({
      configPath: configPath,
      interactive: true,
    });

    cli.success("Agent 配置完成");
    cli.info("配置已保存到: " + configPath);
  } catch (error) {
    cli.error(`配置 Agent 失败: ${error.message}`);

    // 提供备用方案
    cli.info("备用方案:");
    cli.info(`  1. cd ~/.coclaw/agents/${agentId}/`);
    cli.info("  2. openclaw configure");

    throw error;
  }
}

/**
 * 配置 Agent 关系
 */
async function configureRelation(agentManager, agentId) {
  try {
    const relationCLI = new RelationCLI();
    await relationCLI.configureAgentRelation(agentId);
  } catch (error) {
    cli.error(`配置关系失败: ${error.message}`);
    throw error;
  }
}

module.exports = { run };
