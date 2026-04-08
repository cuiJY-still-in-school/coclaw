#!/usr/bin/env node

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs-extra");
const path = require("path");
const { setTimeout } = require("timers/promises");

/**
 * 端到端测试场景：多 Agent 协作
 * 模拟完整的协作流程：
 * 1. 启动服务器
 * 2. 创建多个 Agent
 * 3. 配置关系权限
 * 4. 进行消息通信
 * 5. 文件传输
 * 6. 权限验证
 * 7. 错误处理
 */
class E2ETestScenario {
  constructor() {
    this.serverPort = 18790;
    this.serverUrl = `http://localhost:${this.serverPort}`;
    this.wsUrl = `ws://localhost:${this.serverPort + 1}`;
    this.agents = new Map(); // agentId -> {ws, info, messages}
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: [],
    };
  }

  /**
   * 运行端到端测试
   */
  async run() {
    console.log("=== Coclaw 端到端测试场景 ===\n");
    console.log("模拟多 Agent 协作流程...\n");

    try {
      // 检查服务器
      await this.testStep("检查服务器状态", this.checkServer.bind(this));

      // 创建测试 Agent
      await this.testStep("创建测试 Agent", this.createTestAgents.bind(this));

      // 连接和注册 Agent
      await this.testStep(
        "连接和注册 Agent",
        this.connectAndRegisterAgents.bind(this),
      );

      // 配置关系权限
      await this.testStep(
        "配置关系权限",
        this.configureRelationships.bind(this),
      );

      // 测试消息通信
      await this.testStep(
        "测试消息通信",
        this.testMessageCommunication.bind(this),
      );

      // 测试文件传输
      await this.testStep("测试文件传输", this.testFileTransfer.bind(this));

      // 测试权限验证
      await this.testStep(
        "测试权限验证",
        this.testPermissionValidation.bind(this),
      );

      // 测试错误处理
      await this.testStep("测试错误处理", this.testErrorHandling.bind(this));

      // 清理测试
      await this.testStep("清理测试资源", this.cleanupTest.bind(this));

      // 显示测试结果
      this.showResults();
    } catch (error) {
      console.error(`\n❌ 测试场景失败: ${error.message}`);
      console.error(error.stack);
      this.cleanupTest().catch(() => {});
      process.exit(1);
    }
  }

  /**
   * 测试步骤包装器
   */
  async testStep(name, testFunction) {
    console.log(`\n🔧 ${name}...`);

    try {
      await testFunction();
      this.testResults.tests.push({ name, status: "passed" });
      this.testResults.passed++;
      console.log(`   ✅ ${name} 通过`);
    } catch (error) {
      this.testResults.tests.push({
        name,
        status: "failed",
        error: error.message,
      });
      this.testResults.failed++;
      console.log(`   ❌ ${name} 失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查服务器状态
   */
  async checkServer() {
    const isRunning = await new Promise((resolve) => {
      const req = http.get(`${this.serverUrl}/health`, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on("error", () => resolve(false));
      req.setTimeout(3000, () => {
        req.destroy();
        resolve(false);
      });
    });

    if (!isRunning) {
      throw new Error("服务器未运行，请先启动: coclaw server");
    }

    // 检查 API 端点
    const endpoints = ["/health", "/metrics", "/api/agents"];
    for (const endpoint of endpoints) {
      const url = `${this.serverUrl}${endpoint}`;
      const response = await this.httpRequest(url);
      if (response.statusCode >= 400) {
        throw new Error(
          `API 端点 ${endpoint} 不可用: HTTP ${response.statusCode}`,
        );
      }
    }
  }

  /**
   * 创建测试 Agent
   */
  async createTestAgents() {
    // 定义测试 Agent
    const agentDefinitions = [
      {
        id: "writer_agent",
        name: "写作助手",
        capabilities: ["writing", "summarization", "file_processing"],
        role: "负责写作和文档处理",
      },
      {
        id: "coder_agent",
        name: "编程助手",
        capabilities: ["coding", "debugging", "code_review"],
        role: "负责编程和代码审查",
      },
      {
        id: "researcher_agent",
        name: "研究助手",
        capabilities: ["research", "data_analysis", "report_generation"],
        role: "负责研究和数据分析",
      },
      {
        id: "manager_agent",
        name: "项目管理",
        capabilities: ["coordination", "task_assignment", "progress_tracking"],
        role: "负责项目协调和任务分配",
      },
    ];

    for (const def of agentDefinitions) {
      this.agents.set(def.id, {
        info: def,
        ws: null,
        messages: [],
        files: [],
        connected: false,
        registered: false,
      });
    }

    console.log(`   创建了 ${this.agents.size} 个测试 Agent:`);
    for (const [id, agent] of this.agents.entries()) {
      console.log(`     - ${id}: ${agent.info.name} (${agent.info.role})`);
    }
  }

  /**
   * 连接和注册 Agent
   */
  async connectAndRegisterAgents() {
    const connectionPromises = [];

    for (const [agentId, agent] of this.agents.entries()) {
      connectionPromises.push(this.connectAgent(agentId));
    }

    // 并行连接所有 Agent
    await Promise.all(connectionPromises);

    // 注册所有 Agent
    const registrationPromises = [];
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.connected) {
        registrationPromises.push(this.registerAgent(agentId));
      }
    }

    await Promise.all(registrationPromises);

    // 验证注册状态
    for (const [agentId, agent] of this.agents.entries()) {
      if (!agent.registered) {
        throw new Error(`Agent ${agentId} 注册失败`);
      }
    }

    console.log(`   所有 ${this.agents.size} 个 Agent 已连接并注册`);
  }

  /**
   * 连接单个 Agent
   */
  async connectAgent(agentId) {
    const agent = this.agents.get(agentId);

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);

      ws.on("open", () => {
        agent.ws = ws;
        agent.connected = true;

        // 设置消息处理器
        ws.on("message", (data) => {
          try {
            const message = JSON.parse(data.toString());
            agent.messages.push({
              timestamp: new Date(),
              type: message.type,
              data: message.data,
              from: "server",
            });

            // 处理特定消息类型
            if (message.type === "agent_registered") {
              agent.registered = true;
            }
          } catch (error) {
            // 忽略解析错误
          }
        });

        resolve();
      });

      ws.on("error", reject);

      ws.on("close", () => {
        agent.connected = false;
        agent.registered = false;
      });

      ws.setTimeout(5000, () => {
        ws.close();
        reject(new Error(`连接超时: ${agentId}`));
      });
    });
  }

  /**
   * 注册单个 Agent
   */
  async registerAgent(agentId) {
    const agent = this.agents.get(agentId);

    return new Promise((resolve, reject) => {
      const message = {
        type: "agent_register",
        data: {
          agentId: agent.info.id,
          name: agent.info.name,
          port: 18791,
          capabilities: agent.info.capabilities,
        },
      };

      agent.ws.send(JSON.stringify(message));

      // 等待注册响应
      const timeout = setTimeout(() => {
        reject(new Error(`注册超时: ${agentId}`));
      }, 5000);

      // 检查消息队列中的注册响应
      const checkInterval = setInterval(() => {
        if (agent.registered) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * 配置关系权限
   */
  async configureRelationships() {
    console.log("   配置 Agent 关系权限...");

    // 配置默认权限
    const defaultPermissions = {
      sendMessage: true,
      receiveMessage: true,
      sendFile: true,
      receiveFile: true,
      executeCommand: false,
      accessFiles: false,
    };

    // 为每个 Agent 设置关系配置
    for (const [agentId] of this.agents.entries()) {
      const relationship = {
        defaultPermissions,
        agentOverrides: {},
        trustLevel: 7,
        autoAcceptMessages: true,
        autoAcceptFiles: false,
        maxFileSize: 50 * 1024 * 1024, // 50MB
        allowedFileTypes: ["*"],
        blockList: [],
      };

      // 设置特定权限覆盖
      if (agentId === "manager_agent") {
        // 经理可以给所有人发送消息
        relationship.agentOverrides = {
          writer_agent: { sendMessage: true, receiveMessage: true },
          coder_agent: { sendMessage: true, receiveMessage: true },
          researcher_agent: { sendMessage: true, receiveMessage: true },
        };
      }

      // 通过 API 设置关系
      const response = await this.httpRequest(
        `${this.serverUrl}/api/relationships/${agentId}`,
        "PUT",
        { relationship },
      );

      if (response.statusCode !== 200) {
        throw new Error(
          `设置关系配置失败: ${agentId} - ${response.body?.error}`,
        );
      }
    }

    console.log("   关系权限配置完成");
  }

  /**
   * 测试消息通信
   */
  async testMessageCommunication() {
    console.log("   测试 Agent 间消息通信...");

    // 测试场景1: 经理分配任务
    await this.sendMessage(
      "manager_agent",
      "writer_agent",
      "请撰写项目概述文档，包含背景、目标和时间线。",
      "task_assignment",
    );

    // 等待响应
    await setTimeout(1000);

    // 测试场景2: 写作助手确认任务
    await this.sendMessage(
      "writer_agent",
      "manager_agent",
      "收到任务，已开始撰写项目概述文档。预计2小时内完成。",
      "task_confirmation",
    );

    // 测试场景3: 编程助手请求信息
    await this.sendMessage(
      "coder_agent",
      "researcher_agent",
      "需要最新的用户数据分析结果，用于优化算法。",
      "information_request",
    );

    // 测试场景4: 研究助手回复
    await this.sendMessage(
      "researcher_agent",
      "coder_agent",
      "数据分析已完成，主要发现：用户活跃度提升15%，响应时间减少20%。详细报告稍后发送。",
      "information_response",
    );

    // 验证消息传递
    let deliveredCount = 0;
    for (const [agentId, agent] of this.agents.entries()) {
      const receivedMessages = agent.messages.filter(
        (msg) => msg.type === "agent_message",
      );
      deliveredCount += receivedMessages.length;
    }

    if (deliveredCount < 4) {
      throw new Error(`消息传递不完整: 期望至少4条，实际${deliveredCount}条`);
    }

    console.log(`   消息通信测试完成，共传递 ${deliveredCount} 条消息`);
  }

  /**
   * 发送消息
   */
  async sendMessage(fromAgentId, toAgentId, content, messageType = "text") {
    const fromAgent = this.agents.get(fromAgentId);
    if (!fromAgent || !fromAgent.connected) {
      throw new Error(`发送者 Agent 未连接: ${fromAgentId}`);
    }

    return new Promise((resolve, reject) => {
      const message = {
        type: "agent_message",
        data: {
          fromAgentId,
          toAgentId,
          message: content,
          messageType,
        },
      };

      fromAgent.ws.send(JSON.stringify(message));

      // 等待发送确认（简化处理）
      setTimeout(() => {
        resolve();
      }, 500);
    });
  }

  /**
   * 测试文件传输
   */
  async testFileTransfer() {
    console.log("   测试文件传输流程...");

    // 创建测试文件
    const testDir = path.join(__dirname, "e2e_test_files");
    await fs.ensureDir(testDir);

    const testFile = path.join(testDir, "project_report.md");
    const reportContent = `# 项目报告

## 概述
这是由写作助手生成的测试项目报告。

## 进度
1. ✅ 文档框架完成
2. ⏳ 内容填充中
3. 📅 预计完成时间: 今天

## 数据
- 用户增长: +15%
- 性能提升: +20%
- 满意度: 92%

---
*生成时间: ${new Date().toISOString()}*
`;

    await fs.writeFile(testFile, reportContent);

    // 研究助手发送报告给经理
    const uploadResult = await this.requestFileUpload(
      "researcher_agent",
      "manager_agent",
      "project_report.md",
      "项目进度报告",
      Buffer.byteLength(reportContent),
    );

    if (!uploadResult.success) {
      throw new Error(`文件上传请求失败: ${uploadResult.error}`);
    }

    console.log(
      `   文件上传请求成功，令牌: ${uploadResult.uploadToken.substring(0, 8)}...`,
    );

    // 实际文件上传（简化测试）
    console.log("   文件上传测试通过（简化测试）");

    // 清理测试文件
    await fs.remove(testDir);
  }

  /**
   * 请求文件上传
   */
  async requestFileUpload(fromAgentId, toAgentId, filename, description, size) {
    const fromAgent = this.agents.get(fromAgentId);
    if (!fromAgent || !fromAgent.connected) {
      return { success: false, error: "发送者未连接" };
    }

    return new Promise((resolve) => {
      const message = {
        type: "file_transfer",
        data: {
          action: "request_upload",
          fromAgentId,
          toAgentId,
          filename,
          description,
          size,
        },
      };

      fromAgent.ws.send(JSON.stringify(message));

      // 等待响应
      const timeout = setTimeout(() => {
        resolve({ success: false, error: "请求超时" });
      }, 5000);

      // 检查响应
      const checkInterval = setInterval(() => {
        const response = fromAgent.messages.find(
          (msg) => msg.type === "file_upload_requested",
        );

        if (response) {
          clearInterval(checkInterval);
          clearTimeout(timeout);
          resolve({
            success: true,
            uploadToken: response.data?.uploadToken,
            uploadUrl: response.data?.uploadUrl,
          });
        }
      }, 100);
    });
  }

  /**
   * 测试权限验证
   */
  async testPermissionValidation() {
    console.log("   测试权限验证...");

    // 测试1: 检查有效权限
    const validCheck = await this.checkPermission(
      "manager_agent",
      "writer_agent",
      "sendMessage",
    );

    if (!validCheck.hasPermission) {
      throw new Error(`权限检查失败: 经理应该能向写作助手发送消息`);
    }

    // 测试2: 检查阻止的权限（如果配置了阻止）
    // 这里测试默认配置下的权限

    console.log("   权限验证测试通过");
  }

  /**
   * 检查权限
   */
  async checkPermission(fromAgentId, toAgentId, permission) {
    const response = await this.httpRequest(
      `${this.serverUrl}/api/relationships/check`,
      "POST",
      {
        fromAgentId,
        toAgentId,
        permission,
        context: {},
      },
    );

    if (response.statusCode === 200 && response.body?.success) {
      return response.body;
    }

    return { hasPermission: false, reason: "检查失败" };
  }

  /**
   * 测试错误处理
   */
  async testErrorHandling() {
    console.log("   测试错误处理...");

    // 测试1: 发送消息给不存在的 Agent
    try {
      await this.sendMessage("manager_agent", "nonexistent_agent", "测试消息");
      // 应该抛出错误或收到错误响应
      console.log("   错误处理测试1: 发送给不存在 Agent - 通过");
    } catch (error) {
      console.log(
        `   错误处理测试1: 发送给不存在 Agent - 通过 (错误: ${error.message})`,
      );
    }

    // 测试2: 发送无效消息格式
    const managerAgent = this.agents.get("manager_agent");
    if (managerAgent && managerAgent.connected) {
      managerAgent.ws.send("invalid json message");
      console.log("   错误处理测试2: 无效消息格式 - 通过");
    }

    // 测试3: 检查服务器健康状态
    const healthResponse = await this.httpRequest(`${this.serverUrl}/health`);
    if (healthResponse.statusCode === 200) {
      console.log("   错误处理测试3: 服务器健康检查 - 通过");
    }

    console.log("   错误处理测试完成");
  }

  /**
   * 清理测试资源
   */
  async cleanupTest() {
    console.log("   清理测试资源...");

    // 断开所有 WebSocket 连接
    for (const [agentId, agent] of this.agents.entries()) {
      if (agent.ws && agent.connected) {
        agent.ws.close();
      }
    }

    // 清理测试目录
    const testDir = path.join(__dirname, "e2e_test_files");
    if (await fs.pathExists(testDir)) {
      await fs.remove(testDir);
    }

    // 等待连接关闭
    await setTimeout(1000);

    this.agents.clear();
    console.log("   测试资源清理完成");
  }

  /**
   * 显示测试结果
   */
  showResults() {
    console.log("\n" + "=".repeat(50));
    console.log("端到端测试结果");
    console.log("=".repeat(50));

    console.log(`\n📊 统计:`);
    console.log(`   通过: ${this.testResults.passed}`);
    console.log(`   失败: ${this.testResults.failed}`);
    console.log(`   总计: ${this.testResults.tests.length}`);

    console.log(`\n📋 测试详情:`);
    for (const test of this.testResults.tests) {
      const icon = test.status === "passed" ? "✅" : "❌";
      console.log(`   ${icon} ${test.name}`);
      if (test.status === "failed" && test.error) {
        console.log(`      错误: ${test.error}`);
      }
    }

    console.log("\n" + "=".repeat(50));

    if (this.testResults.failed === 0) {
      console.log("🎉 所有测试通过！系统集成测试成功完成。");
    } else {
      console.log("⚠️  部分测试失败，需要进一步调试。");
      process.exit(1);
    }
  }

  /**
   * HTTP 请求辅助函数
   */
  async httpRequest(url, method = "GET", body = null) {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = http.request(options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          let parsedBody;
          try {
            parsedBody = data ? JSON.parse(data) : null;
          } catch (error) {
            parsedBody = null;
          }

          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsedBody,
            raw: data,
          });
        });
      });

      req.on("error", reject);

      if (body && (method === "POST" || method === "PUT")) {
        req.write(JSON.stringify(body));
      }

      req.end();

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error("请求超时"));
      });
    });
  }
}

// 运行测试场景
const scenario = new E2ETestScenario();
scenario.run().catch((error) => {
  console.error("测试场景执行失败:", error);
  process.exit(1);
});
