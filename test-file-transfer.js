#!/usr/bin/env node

const WebSocket = require("ws");
const http = require("http");
const fs = require("fs-extra");
const path = require("path");
const FormData = require("form-data");

/**
 * 文件传输测试脚本
 */
async function testFileTransfer() {
  console.log("=== Coclaw 文件传输测试 ===\n");

  const serverPort = 18790;
  const serverUrl = `http://localhost:${serverPort}`;
  const wsUrl = `ws://localhost:${serverPort + 1}`;

  try {
    console.log("1. 检查服务器是否运行...");
    const isServerRunning = await checkServerRunning(serverUrl);
    if (!isServerRunning) {
      console.log("   ❌ 服务器未运行，请先启动服务器");
      console.log("   命令: coclaw server");
      return;
    }
    console.log("   ✅ 服务器正在运行");

    console.log("\n2. 创建测试 Agent...");
    const agent1 = await createTestAgent("test_agent_1", "测试 Agent 1");
    const agent2 = await createTestAgent("test_agent_2", "测试 Agent 2");
    console.log("   ✅ 创建测试 Agent 完成");

    console.log("\n3. 连接 Agent 到服务器...");
    const ws1 = await connectAgent(wsUrl, agent1);
    const ws2 = await connectAgent(wsUrl, agent2);
    console.log("   ✅ Agent 连接成功");

    console.log("\n4. 注册 Agent...");
    await registerAgent(ws1, agent1);
    await registerAgent(ws2, agent2);
    console.log("   ✅ Agent 注册成功");

    console.log("\n5. 测试文件传输请求...");
    const uploadRequest = await testFileUploadRequest(ws1, agent1, agent2);
    if (!uploadRequest.success) {
      throw new Error("文件传输请求失败");
    }
    console.log("   ✅ 文件传输请求成功");

    console.log("\n6. 测试文件上传...");
    const uploadResult = await testFileUpload(
      serverUrl,
      uploadRequest.uploadToken,
      agent1,
      agent2,
    );
    if (!uploadResult.success) {
      throw new Error("文件上传失败");
    }
    console.log("   ✅ 文件上传成功");

    console.log("\n7. 测试文件下载...");
    const downloadResult = await testFileDownload(
      serverUrl,
      uploadResult.fileId,
      agent2,
    );
    if (!downloadResult.success) {
      throw new Error("文件下载失败");
    }
    console.log("   ✅ 文件下载成功");

    console.log("\n8. 清理测试文件...");
    await cleanupTestFiles([uploadResult.filePath]);
    console.log("   ✅ 测试文件已清理");

    console.log("\n9. 断开连接...");
    ws1.close();
    ws2.close();
    console.log("   ✅ 连接已关闭");

    console.log("\n=== 测试完成 ===");
    console.log("所有文件传输测试通过！");
  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * 检查服务器是否运行
 */
async function checkServerRunning(serverUrl) {
  return new Promise((resolve) => {
    const req = http.get(`${serverUrl}/health`, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on("error", () => {
      resolve(false);
    });

    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * 创建测试 Agent
 */
function createTestAgent(id, name) {
  return {
    id,
    name,
    capabilities: ["chat", "file_transfer"],
    port: 18791,
  };
}

/**
 * 连接 Agent 到服务器
 */
function connectAgent(wsUrl, agent) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      resolve(ws);
    });

    ws.on("error", reject);

    ws.setTimeout(5000, () => {
      ws.close();
      reject(new Error("连接超时"));
    });
  });
}

/**
 * 注册 Agent
 */
function registerAgent(ws, agent) {
  return new Promise((resolve, reject) => {
    const message = {
      type: "agent_register",
      data: {
        agentId: agent.id,
        name: agent.name,
        port: agent.port,
        capabilities: agent.capabilities,
      },
    };

    ws.send(JSON.stringify(message));

    // 等待注册响应
    const handler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.type === "agent_registered" && response.success) {
          ws.removeListener("message", handler);
          resolve();
        }
      } catch (error) {
        // 忽略解析错误
      }
    };

    ws.on("message", handler);

    // 超时处理
    setTimeout(() => {
      ws.removeListener("message", handler);
      reject(new Error("注册超时"));
    }, 5000);
  });
}

/**
 * 测试文件上传请求
 */
function testFileUploadRequest(ws, fromAgent, toAgent) {
  return new Promise((resolve, reject) => {
    const message = {
      type: "file_transfer",
      data: {
        action: "request_upload",
        fromAgentId: fromAgent.id,
        toAgentId: toAgent.id,
        filename: "test_file.txt",
        size: 1024, // 1KB
        description: "测试文件",
      },
    };

    ws.send(JSON.stringify(message));

    // 等待响应
    const handler = (data) => {
      try {
        const response = JSON.parse(data.toString());
        if (response.type === "file_upload_requested") {
          ws.removeListener("message", handler);
          resolve({
            success: true,
            uploadToken: response.uploadToken,
            uploadUrl: response.uploadUrl,
          });
        } else if (response.type === "error") {
          ws.removeListener("message", handler);
          reject(new Error(response.error));
        }
      } catch (error) {
        // 忽略解析错误
      }
    };

    ws.on("message", handler);

    // 超时处理
    setTimeout(() => {
      ws.removeListener("message", handler);
      reject(new Error("文件上传请求超时"));
    }, 5000);
  });
}

/**
 * 测试文件上传
 */
async function testFileUpload(serverUrl, uploadToken, fromAgent, toAgent) {
  // 创建测试文件
  const testDir = path.join(__dirname, "test_files");
  await fs.ensureDir(testDir);

  const testFilePath = path.join(testDir, "test_file.txt");
  const testContent = "这是测试文件内容\n".repeat(100); // 大约 2KB
  await fs.writeFile(testFilePath, testContent);

  // 准备表单数据
  const form = new FormData();
  form.append("file", fs.createReadStream(testFilePath));
  form.append("fromAgentId", fromAgent.id);
  form.append("toAgentId", toAgent.id);
  form.append("description", "测试文件上传");
  form.append("uploadToken", uploadToken);

  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: "localhost",
      port: 18790,
      path: "/api/files/upload",
      headers: form.getHeaders(),
    };

    const req = http.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 && result.success) {
            resolve({
              success: true,
              fileId: result.fileId,
              filePath: testFilePath,
            });
          } else {
            reject(new Error(`上传失败: ${result.error || "未知错误"}`));
          }
        } catch (error) {
          reject(new Error(`响应解析失败: ${error.message}`));
        }
      });
    });

    req.on("error", reject);

    // 发送表单数据
    form.pipe(req);

    // 超时处理
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("上传超时"));
    });
  });
}

/**
 * 测试文件下载
 */
async function testFileDownload(serverUrl, fileId, agent) {
  // 首先获取下载令牌
  const tokenResult = await getDownloadToken(serverUrl, fileId, agent);
  if (!tokenResult.success) {
    throw new Error("获取下载令牌失败");
  }

  return new Promise((resolve, reject) => {
    const downloadUrl = `${serverUrl}/api/files/${fileId}?downloadToken=${tokenResult.downloadToken}&agentId=${agent.id}`;

    const req = http.get(downloadUrl, (res) => {
      if (res.statusCode === 200) {
        // 创建下载目录
        const downloadDir = path.join(__dirname, "test_downloads");
        fs.ensureDirSync(downloadDir);

        const downloadPath = path.join(downloadDir, `downloaded_${fileId}.txt`);
        const fileStream = fs.createWriteStream(downloadPath);

        res.pipe(fileStream);

        fileStream.on("finish", () => {
          fileStream.close();
          resolve({
            success: true,
            downloadPath,
          });
        });

        fileStream.on("error", reject);
      } else {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`));
      }
    });

    req.on("error", reject);

    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error("下载超时"));
    });
  });
}

/**
 * 获取下载令牌
 */
async function getDownloadToken(serverUrl, fileId, agent) {
  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: "localhost",
      port: 18790,
      path: `/api/files/${fileId}/token`,
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
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 200 && result.success) {
            resolve({
              success: true,
              downloadToken: result.downloadToken,
            });
          } else {
            resolve({
              success: false,
              error: result.error || "未知错误",
            });
          }
        } catch (error) {
          resolve({
            success: false,
            error: `响应解析失败: ${error.message}`,
          });
        }
      });
    });

    req.on("error", () => {
      resolve({
        success: false,
        error: "请求失败",
      });
    });

    req.write(JSON.stringify({ agentId: agent.id }));
    req.end();

    req.setTimeout(5000, () => {
      req.destroy();
      resolve({
        success: false,
        error: "请求超时",
      });
    });
  });
}

/**
 * 清理测试文件
 */
async function cleanupTestFiles(filePaths) {
  for (const filePath of filePaths) {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
    }
  }

  // 清理测试目录
  const testDir = path.join(__dirname, "test_files");
  const downloadDir = path.join(__dirname, "test_downloads");

  if (await fs.pathExists(testDir)) {
    await fs.remove(testDir);
  }

  if (await fs.pathExists(downloadDir)) {
    await fs.remove(downloadDir);
  }
}

// 运行测试
testFileTransfer().catch((error) => {
  console.error("测试脚本错误:", error);
  process.exit(1);
});
