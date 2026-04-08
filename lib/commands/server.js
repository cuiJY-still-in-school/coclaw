const { cli } = require("../cli");
const Config = require("../config");
const ServerManager = require("../server-manager");

/**
 * 启动或停止服务器
 */
async function run() {
  try {
    // 加载配置
    const config = new Config();
    await config.load();

    // 获取服务器管理器
    const serverManager = new ServerManager(config);

    // 检查服务器状态
    const isRunning = await serverManager.isServerRunning();

    if (isRunning) {
      cli.title("停止服务器");

      const confirm = await cli.confirm("确定要停止服务器吗？");
      if (!confirm) {
        cli.info("操作已取消");
        return;
      }

      const stopProgress = cli.progress("正在停止服务器...");
      await serverManager.stopServer();
      stopProgress();

      cli.success("服务器已停止");
    } else {
      cli.title("启动服务器");

      const confirm = await cli.confirm("确定要启动服务器吗？");
      if (!confirm) {
        cli.info("操作已取消");
        return;
      }

      const startProgress = cli.progress("正在启动服务器...");
      await serverManager.startServer();
      startProgress();

      cli.success("服务器已启动");
      cli.info(`服务器运行在端口: ${config.get("server.port", 18790)}`);
      cli.info("使用 `coclaw server` 停止服务器");
    }
  } catch (error) {
    cli.error(`服务器操作失败: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error);
    }
    process.exit(1);
  }
}

module.exports = { run };
