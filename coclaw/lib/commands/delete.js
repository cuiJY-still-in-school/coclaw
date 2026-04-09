const { cli } = require("../cli");
const Config = require("../config");
const AgentManager = require("../agent-manager");
const fs = require("fs-extra");
const path = require("path");

/**
 * 删除 Agent
 * @param {string} agentId - 要删除的 Agent ID
 * @param {boolean} force - 是否强制删除（不询问确认）
 */
async function run(agentId, force = false) {
  try {
    cli.title(`删除 Agent: ${agentId}`);

    // 加载配置
    const config = new Config();
    await config.load();

    // 获取 Agent 管理器
    const agentManager = new AgentManager(config);

    // 检查 Agent 是否存在
    const agents = await agentManager.listAgents();
    const agentExists = agents.some((agent) => agent.id === agentId);

    if (!agentExists) {
      cli.error(`Agent "${agentId}" 不存在`);
      cli.info("使用 `coclaw list` 查看所有可用的 Agent");
      process.exit(1);
    }

    // 获取 Agent 信息
    const agentInfo = await agentManager.getAgentInfo(agentId);
    const agentPath = path.join(config.agentsDir, agentId);

    // 显示 Agent 信息
    cli.info(`Agent 名称: ${agentInfo.name || "未命名"}`);
    cli.info(`创建时间: ${agentInfo.createdAt || "未知"}`);
    cli.info(`配置文件: ${agentPath}`);

    // 检查是否正在运行
    const isRunning = await agentManager.isAgentRunning(agentId);
    if (isRunning) {
      cli.warn(`Agent "${agentId}" 正在运行中`);

      if (!force) {
        const shouldStop = await cli.confirm("是否先停止 Agent？ (Y/n)");
        if (shouldStop) {
          cli.info(`正在停止 Agent "${agentId}"...`);
          try {
            await agentManager.stopAgent(agentId);
            cli.success(`Agent "${agentId}" 已停止`);
          } catch (stopError) {
            cli.warn(`停止 Agent 失败: ${stopError.message}`);
            cli.warn("将继续尝试删除 Agent 目录...");
          }
        } else {
          cli.error("无法删除正在运行的 Agent");
          cli.info("请先停止 Agent 或使用 --force 参数强制删除");
          process.exit(1);
        }
      } else {
        cli.info(`强制停止 Agent "${agentId}"...`);
        try {
          await agentManager.stopAgent(agentId);
          cli.success(`Agent "${agentId}" 已停止`);
        } catch (stopError) {
          cli.warn(`停止 Agent 失败: ${stopError.message}`);
          cli.warn("将继续尝试删除 Agent 目录...");
        }
      }
    }

    // 确认删除
    if (!force) {
      const confirmDelete = await cli.confirm(
        `确定要删除 Agent "${agentId}" 吗？此操作不可撤销。 (y/N)`,
      );

      if (!confirmDelete) {
        cli.info("删除操作已取消");
        return;
      }
    }

    // 删除 Agent 目录
    cli.info(`正在删除 Agent 目录: ${agentPath}`);
    await fs.remove(agentPath);

    // 验证删除
    if (await fs.pathExists(agentPath)) {
      cli.error(`删除失败: Agent 目录仍然存在`);
      process.exit(1);
    }

    cli.success(`Agent "${agentId}" 已成功删除`);
    cli.info(`已释放空间: ${agentPath}`);
  } catch (error) {
    cli.error(`删除 Agent 失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

module.exports = { run };
