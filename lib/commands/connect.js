const { cli } = require("../cli");
const Config = require("../config");
const ServerConnector = require("../server-connector");

/**
 * 连接到远程服务器
 * @param {string} serverId - 服务器 ID (IP:端口 或 主机名)
 */
async function run(serverId) {
  try {
    cli.title(`连接到服务器: ${serverId}`);

    // 加载配置
    const config = new Config();
    await config.load();

    // 解析服务器地址
    let host, port;
    if (serverId.includes(":")) {
      [host, port] = serverId.split(":");
      port = parseInt(port, 10);
    } else {
      host = serverId;
      port = 18790; // 默认端口
    }

    // 验证参数
    if (!host || !port || port < 1 || port > 65535) {
      throw new Error("无效的服务器地址格式，请使用 host:port 格式");
    }

    cli.info(`服务器地址: ${host}:${port}`);

    const connectProgress = cli.progress("正在连接服务器...");

    // 创建连接器
    const connector = new ServerConnector(config);

    // 连接到服务器
    const serverInfo = await connector.connect(host, port);

    connectProgress();

    cli.success("连接成功!");
    cli.info(`服务器名称: ${serverInfo.name || "未知"}`);
    cli.info(`服务器版本: ${serverInfo.version || "未知"}`);
    cli.info(`Agent 数量: ${serverInfo.agentCount || 0}`);

    // 刷新本地 Agent 列表
    cli.info("正在刷新 Agent 列表...");
    await connector.syncAgents();

    cli.success("Agent 列表已更新");
    cli.info("现在可以使用 `coclaw list` 查看所有 Agent");
  } catch (error) {
    cli.error(`连接服务器失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

module.exports = { run };
