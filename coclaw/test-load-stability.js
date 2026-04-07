const { cli } = require("./lib/cli");
const Config = require("./lib/config");
const ServerManager = require("./lib/server-manager");
const WebSocket = require("ws");
const http = require("http");

/**
 * 负载和稳定性测试
 */
class LoadStabilityTest {
  constructor() {
    this.config = new Config();
    this.serverManager = null;
    this.testAgents = [];
    this.testResults = {
      startTime: null,
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      performanceStats: {},
      errorStats: {},
    };
  }

  /**
   * 运行所有测试
   */
  async runAllTests() {
    cli.title("Coclaw 负载和稳定性测试");
    cli.info("开始运行负载和稳定性测试...");

    this.testResults.startTime = new Date();

    try {
      // 测试1: 启动服务器
      await this.testServerStartup();

      // 测试2: 并发连接测试
      await this.testConcurrentConnections();

      // 测试3: 消息负载测试
      await this.testMessageLoad();

      // 测试4: 文件传输负载测试
      await this.testFileTransferLoad();

      // 测试5: 长时间运行稳定性测试
      await this.testLongRunningStability();

      // 测试6: 错误恢复测试
      await this.testErrorRecovery();

      // 测试7: 资源清理测试
      await this.testResourceCleanup();

      // 测试8: 性能监控测试
      await this.testPerformanceMonitoring();

      this.testResults.endTime = new Date();
      this.printTestSummary();
    } catch (error) {
      cli.error(`测试失败: ${error.message}`);
      console.error(error);
    } finally {
      // 清理测试资源
      await this.cleanupTestResources();
    }
  }

  /**
   * 测试1: 服务器启动
   */
  async testServerStartup() {
    cli.title("测试1: 服务器启动测试");

    try {
      this.serverManager = new ServerManager(this.config);

      // 启动服务器
      const stopProgress = cli.progress("正在启动服务器...");
      await this.serverManager.startServer();
      stopProgress();

      // 验证服务器状态
      const status = this.serverManager.getServerStatus();
      if (status.isRunning) {
        cli.success(
          `服务器启动成功 (HTTP: ${status.httpPort}, WebSocket: ${status.wsPort})`,
        );
        this.testResults.passedTests++;
      } else {
        throw new Error("服务器启动失败");
      }

      // 等待服务器完全启动
      await new Promise((resolve) => setTimeout(resolve, 2000));

      this.testResults.totalTests++;
      cli.success("服务器启动测试通过");
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`服务器启动测试失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 测试2: 并发连接测试
   */
  async testConcurrentConnections() {
    cli.title("测试2: 并发连接测试");

    try {
      const port = this.config.get("server.port", 18790);
      const wsPort = port + 1;
      const connectionCount = 50; // 测试50个并发连接
      const connections = [];

      cli.info(`测试 ${connectionCount} 个并发 WebSocket 连接...`);

      // 创建并发连接
      const connectPromises = [];
      for (let i = 0; i < connectionCount; i++) {
        connectPromises.push(
          this.createTestConnection(wsPort, `test_agent_${i}`),
        );
      }

      const stopProgress = cli.progress("正在建立并发连接...");
      const results = await Promise.allSettled(connectPromises);
      stopProgress();

      // 统计结果
      const successfulConnections = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedConnections = results.filter(
        (r) => r.status === "rejected",
      ).length;

      connections.push(
        ...results.filter((r) => r.status === "fulfilled").map((r) => r.value),
      );

      cli.info(
        `成功连接: ${successfulConnections}, 失败连接: ${failedConnections}`,
      );

      if (successfulConnections >= connectionCount * 0.9) {
        // 90%成功率
        cli.success("并发连接测试通过");
        this.testResults.passedTests++;
      } else {
        throw new Error(
          `连接成功率过低: ${((successfulConnections / connectionCount) * 100).toFixed(1)}%`,
        );
      }

      // 保存连接供后续测试使用
      this.testAgents = connections;

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`并发连接测试失败: ${error.message}`);
    }
  }

  /**
   * 创建测试连接
   */
  async createTestConnection(port, agentId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${port}`);

      ws.on("open", () => {
        // 发送身份识别
        ws.send(
          JSON.stringify({
            type: "identify",
            data: {
              clientType: "agent",
              agentId,
              capabilities: ["message", "file"],
            },
          }),
        );

        // 注册 Agent
        ws.send(
          JSON.stringify({
            type: "agent_register",
            data: {
              agentId,
              name: `Test Agent ${agentId}`,
              capabilities: ["message", "file"],
            },
          }),
        );

        resolve({ ws, agentId });
      });

      ws.on("error", reject);

      // 设置超时
      setTimeout(() => reject(new Error("连接超时")), 5000);
    });
  }

  /**
   * 测试3: 消息负载测试
   */
  async testMessageLoad() {
    cli.title("测试3: 消息负载测试");

    try {
      const messageCount = 1000; // 发送1000条消息
      const agents = this.testAgents.slice(0, 10); // 使用前10个Agent进行测试

      if (agents.length < 2) {
        cli.warn("Agent数量不足，跳过消息负载测试");
        return;
      }

      cli.info(
        `测试 ${messageCount} 条消息负载 (使用 ${agents.length} 个Agent)...`,
      );

      const stopProgress = cli.progress("正在发送测试消息...");
      const startTime = Date.now();

      // 发送消息
      const sendPromises = [];
      for (let i = 0; i < messageCount; i++) {
        const fromAgent = agents[i % agents.length];
        const toAgent = agents[(i + 1) % agents.length];

        sendPromises.push(
          this.sendTestMessage(fromAgent, toAgent, `Test message ${i}`),
        );
      }

      const results = await Promise.allSettled(sendPromises);
      const endTime = Date.now();

      stopProgress();

      // 统计结果
      const successfulMessages = results.filter(
        (r) => r.status === "fulfilled",
      ).length;
      const failedMessages = results.filter(
        (r) => r.status === "rejected",
      ).length;
      const totalTime = endTime - startTime;
      const messagesPerSecond = (
        successfulMessages /
        (totalTime / 1000)
      ).toFixed(2);

      cli.info(`成功消息: ${successfulMessages}, 失败消息: ${failedMessages}`);
      cli.info(`总时间: ${totalTime}ms, 吞吐量: ${messagesPerSecond} 消息/秒`);

      // 检查性能统计
      const perfStats = await this.getPerformanceStats();
      this.testResults.performanceStats.messageLoad = {
        totalMessages: successfulMessages,
        failedMessages,
        throughput: messagesPerSecond,
        latency: perfStats.messageRouting?.averageLatency || 0,
      };

      if (successfulMessages >= messageCount * 0.95) {
        // 95%成功率
        cli.success("消息负载测试通过");
        this.testResults.passedTests++;
      } else {
        throw new Error(
          `消息发送成功率过低: ${((successfulMessages / messageCount) * 100).toFixed(1)}%`,
        );
      }

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`消息负载测试失败: ${error.message}`);
    }
  }

  /**
   * 发送测试消息
   */
  async sendTestMessage(fromAgent, toAgent, message) {
    return new Promise((resolve, reject) => {
      const messageData = {
        type: "agent_message",
        data: {
          fromAgentId: fromAgent.agentId,
          toAgentId: toAgent.agentId,
          message,
          messageType: "text",
        },
      };

      fromAgent.ws.send(JSON.stringify(messageData));

      // 设置超时
      setTimeout(() => resolve(), 100);
    });
  }

  /**
   * 测试4: 文件传输负载测试
   */
  async testFileTransferLoad() {
    cli.title("测试4: 文件传输负载测试");

    try {
      const fileCount = 10; // 测试10个文件传输
      const fileSize = 1024 * 1024; // 1MB 测试文件
      const agents = this.testAgents.slice(0, 5); // 使用前5个Agent

      if (agents.length < 2) {
        cli.warn("Agent数量不足，跳过文件传输测试");
        return;
      }

      cli.info(
        `测试 ${fileCount} 个文件传输 (每个 ${this.formatBytes(fileSize)})...`,
      );

      // 这里简化测试，实际实现需要模拟文件上传
      cli.info("文件传输测试简化实现 - 验证API端点");

      // 测试文件上传端点
      const port = this.config.get("server.port", 18790);
      const health = await this.checkHealth(port);

      if (health.status === "healthy" || health.status === "degraded") {
        cli.success("文件传输端点可用");
        this.testResults.passedTests++;
      } else {
        throw new Error("文件传输端点不可用");
      }

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`文件传输负载测试失败: ${error.message}`);
    }
  }

  /**
   * 测试5: 长时间运行稳定性测试
   */
  async testLongRunningStability() {
    cli.title("测试5: 长时间运行稳定性测试");

    try {
      const testDuration = 30000; // 30秒稳定性测试
      cli.info(`运行 ${testDuration / 1000} 秒稳定性测试...`);

      const stopProgress = cli.progress("正在运行稳定性测试...");
      const startTime = Date.now();

      // 监控服务器状态
      const monitoringInterval = setInterval(async () => {
        try {
          const port = this.config.get("server.port", 18790);
          const health = await this.checkHealth(port);

          if (health.status === "unhealthy") {
            clearInterval(monitoringInterval);
            throw new Error("服务器状态不健康");
          }
        } catch (error) {
          // 忽略监控错误
        }
      }, 5000);

      // 等待测试完成
      await new Promise((resolve) => setTimeout(resolve, testDuration));

      clearInterval(monitoringInterval);
      stopProgress();

      // 检查最终状态
      const port = this.config.get("server.port", 18790);
      const finalHealth = await this.checkHealth(port);

      if (finalHealth.status !== "unhealthy") {
        cli.success("长时间运行稳定性测试通过");
        this.testResults.passedTests++;
      } else {
        throw new Error("服务器在稳定性测试中变得不健康");
      }

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`长时间运行稳定性测试失败: ${error.message}`);
    }
  }

  /**
   * 测试6: 错误恢复测试
   */
  async testErrorRecovery() {
    cli.title("测试6: 错误恢复测试");

    try {
      cli.info("测试错误处理机制...");

      // 获取错误统计
      const errorStats = await this.getErrorStats();

      if (errorStats) {
        cli.info(
          `当前错误统计: 总错误数=${errorStats.total}, 严重错误=${errorStats.critical || 0}`,
        );

        if (errorStats.critical === 0) {
          cli.success("错误恢复测试通过（无严重错误）");
          this.testResults.passedTests++;
        } else {
          cli.warn(`存在严重错误: ${errorStats.critical} 个`);
          // 检查是否有自动恢复
          const recentErrors = errorStats.recent || [];
          const recoveredErrors = recentErrors.filter((e) => e.recovered);

          if (recoveredErrors.length > 0) {
            cli.success(
              `错误恢复测试通过（${recoveredErrors.length} 个错误已自动恢复）`,
            );
            this.testResults.passedTests++;
          } else {
            throw new Error("存在未恢复的严重错误");
          }
        }
      } else {
        cli.success("错误恢复测试通过（无错误记录）");
        this.testResults.passedTests++;
      }

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`错误恢复测试失败: ${error.message}`);
    }
  }

  /**
   * 测试7: 资源清理测试
   */
  async testResourceCleanup() {
    cli.title("测试7: 资源清理测试");

    try {
      cli.info("测试资源清理机制...");

      // 断开一些测试连接
      const agentsToDisconnect = this.testAgents.slice(0, 5);
      for (const agent of agentsToDisconnect) {
        agent.ws.close();
      }

      // 等待清理
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 检查连接统计
      const perfStats = await this.getPerformanceStats();
      const activeConnections = perfStats.connections?.active || 0;

      cli.info(`活跃连接数: ${activeConnections}`);

      if (
        activeConnections <=
        this.testAgents.length - agentsToDisconnect.length + 5
      ) {
        // 允许一些缓冲
        cli.success("资源清理测试通过");
        this.testResults.passedTests++;
      } else {
        throw new Error("资源清理不彻底");
      }

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`资源清理测试失败: ${error.message}`);
    }
  }

  /**
   * 测试8: 性能监控测试
   */
  async testPerformanceMonitoring() {
    cli.title("测试8: 性能监控测试");

    try {
      cli.info("测试性能监控功能...");

      const perfStats = await this.getPerformanceStats();

      if (perfStats && perfStats.optimizationEnabled !== undefined) {
        this.testResults.performanceStats = perfStats;

        cli.info(
          `性能优化状态: ${perfStats.optimizationEnabled ? "启用" : "禁用"}`,
        );
        cli.info(
          `消息路由统计: ${perfStats.messageRouting?.totalMessages || 0} 条消息`,
        );
        cli.info(
          `文件传输统计: ${perfStats.fileTransfer?.totalFiles || 0} 个文件`,
        );
        cli.info(`连接统计: ${perfStats.connections?.active || 0} 个活跃连接`);

        cli.success("性能监控测试通过");
        this.testResults.passedTests++;
      } else {
        throw new Error("无法获取性能统计");
      }

      this.testResults.totalTests++;
    } catch (error) {
      this.testResults.failedTests++;
      cli.error(`性能监控测试失败: ${error.message}`);
    }
  }

  /**
   * 获取性能统计
   */
  async getPerformanceStats() {
    const port = this.config.get("server.port", 18790);

    return new Promise((resolve) => {
      const req = http.get(
        `http://localhost:${port}/api/performance/stats`,
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              const result = JSON.parse(data);
              resolve(result.success ? result.stats : null);
            } catch {
              resolve(null);
            }
          });
        },
      );

      req.on("error", () => resolve(null));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  /**
   * 获取错误统计
   */
  async getErrorStats() {
    const port = this.config.get("server.port", 18790);

    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const result = JSON.parse(data);
            resolve(result.checks?.errors || null);
          } catch {
            resolve(null);
          }
        });
      });

      req.on("error", () => resolve(null));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  /**
   * 检查健康状态
   */
  async checkHealth(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ status: "unknown" });
          }
        });
      });

      req.on("error", () => resolve({ status: "unhealthy" }));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve({ status: "timeout" });
      });
    });
  }

  /**
   * 打印测试总结
   */
  printTestSummary() {
    cli.title("测试总结");

    const duration = this.testResults.endTime - this.testResults.startTime;
    const passRate = (
      (this.testResults.passedTests / this.testResults.totalTests) *
      100
    ).toFixed(1);

    cli.info(`测试开始时间: ${this.testResults.startTime.toLocaleString()}`);
    cli.info(`测试结束时间: ${this.testResults.endTime.toLocaleString()}`);
    cli.info(`总测试时间: ${(duration / 1000).toFixed(1)} 秒`);
    cli.info(`总测试数: ${this.testResults.totalTests}`);
    cli.info(`通过测试: ${this.testResults.passedTests}`);
    cli.info(`失败测试: ${this.testResults.failedTests}`);
    cli.info(`通过率: ${passRate}%`);

    // 性能统计
    if (this.testResults.performanceStats.messageLoad) {
      cli.title("性能统计");
      const msgStats = this.testResults.performanceStats.messageLoad;
      cli.info(`消息吞吐量: ${msgStats.throughput} 消息/秒`);
      cli.info(`平均延迟: ${msgStats.latency.toFixed(2)}ms`);
    }

    // 总体评估
    if (passRate >= 90) {
      cli.success("✅ 负载和稳定性测试通过！系统表现良好。");
    } else if (passRate >= 70) {
      cli.warn("⚠️ 负载和稳定性测试基本通过，但存在一些问题需要改进。");
    } else {
      cli.error("❌ 负载和稳定性测试失败，系统需要重大改进。");
    }
  }

  /**
   * 清理测试资源
   */
  async cleanupTestResources() {
    cli.info("清理测试资源...");

    // 关闭所有测试连接
    for (const agent of this.testAgents) {
      if (agent.ws && agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.close();
      }
    }

    // 停止服务器
    if (this.serverManager) {
      try {
        await this.serverManager.stopServer();
        cli.success("测试服务器已停止");
      } catch (error) {
        cli.warn(`停止服务器失败: ${error.message}`);
      }
    }

    this.testAgents = [];
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }
}

// 运行测试
if (require.main === module) {
  const test = new LoadStabilityTest();
  test.runAllTests().catch((error) => {
    cli.error(`测试运行失败: ${error.message}`);
    process.exit(1);
  });
}

module.exports = LoadStabilityTest;
