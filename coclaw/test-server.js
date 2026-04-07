#!/usr/bin/env node

const Config = require("./lib/config");
const ServerManager = require("./lib/server-manager");
const { cli } = require("./lib/cli");

async function testServer() {
  console.log("=== Coclaw Server 测试 ===\n");

  try {
    // 创建配置
    const config = new Config();
    await config.load();

    // 创建服务器管理器
    const serverManager = new ServerManager(config);

    console.log("1. 测试服务器状态检查...");
    const isRunning = await serverManager.isServerRunning();
    console.log(`   服务器状态: ${isRunning ? "运行中" : "未运行"}`);

    if (isRunning) {
      console.log("   警告: 服务器已在运行，跳过启动测试");
      return;
    }

    console.log("\n2. 启动服务器...");
    const started = await serverManager.startServer();
    if (!started) {
      throw new Error("服务器启动失败");
    }
    console.log("   ✓ 服务器启动成功");

    // 等待服务器完全启动
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log("\n3. 验证服务器状态...");
    const status = serverManager.getServerStatus();
    console.log(`   HTTP 端口: ${status.httpPort}`);
    console.log(`   WebSocket 端口: ${status.wsPort}`);
    console.log(`   运行时间: ${status.uptime}ms`);
    console.log(`   Agent 数量: ${status.agentsCount}`);

    console.log("\n4. 测试健康检查端点...");
    const http = require("http");
    const healthUrl = `http://localhost:${status.httpPort}/health`;

    await new Promise((resolve, reject) => {
      const req = http.get(healthUrl, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            console.log(`   健康状态: ${result.status}`);
            console.log(`   版本: ${result.version}`);
            console.log(`   Agent 数量: ${result.agents}`);
            resolve();
          } catch (error) {
            reject(new Error(`健康检查响应解析失败: ${error.message}`));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("健康检查请求超时"));
      });
    });

    console.log("\n5. 测试监控端点...");
    const metricsUrl = `http://localhost:${status.httpPort}/metrics`;

    await new Promise((resolve, reject) => {
      const req = http.get(metricsUrl, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            console.log(`   运行时间: ${result.uptime}ms`);
            console.log(`   总请求数: ${result.requests?.total || 0}`);
            console.log(`   日志文件: ${result.logFile || "无"}`);
            resolve();
          } catch (error) {
            reject(new Error(`监控端点响应解析失败: ${error.message}`));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("监控端点请求超时"));
      });
    });

    console.log("\n6. 等待 3 秒模拟服务器运行...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n7. 停止服务器...");
    const stopped = await serverManager.stopServer();
    if (!stopped) {
      throw new Error("服务器停止失败");
    }
    console.log("   ✓ 服务器停止成功");

    // 验证服务器已停止
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const isStillRunning = await serverManager.isServerRunning();
    if (isStillRunning) {
      throw new Error("服务器停止后仍在运行");
    }
    console.log("   ✓ 服务器确认已停止");

    console.log("\n=== 测试完成 ===");
    console.log("所有测试通过！服务器启动、运行和停止功能正常。");
  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// 运行测试
testServer().catch((error) => {
  console.error("测试脚本错误:", error);
  process.exit(1);
});
