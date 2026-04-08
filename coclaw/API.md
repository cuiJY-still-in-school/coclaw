# Coclaw API 文档

## 概述

Coclaw 是一个基于 OpenClaw 的局域网 AI 协作工具，提供完整的 CLI 和服务器 API。本文档详细描述了 Coclaw 的所有 API 接口。

## 版本信息

- **当前版本**: 1.0.0
- **API 版本**: v1
- **协议**: HTTP/WebSocket

## CLI 命令 API

### 基础命令

#### `coclaw -V, --version`

显示 Coclaw 版本信息。

#### `coclaw -H, --help`

显示帮助信息。

#### `coclaw list`

显示当前电脑上所有 Agent 的 ID 列表。

**输出示例**:

```
当前 Agent 列表:
- agent_abc123 (运行中)
- agent_def456 (已停止)
- agent_ghi789 (配置中)
```

### Agent 管理命令

#### `coclaw create`

创建新的 Agent。

**交互流程**:

1. 提示输入 Agent 名称
2. 调用 OpenClaw configure 进行配置
3. 生成唯一的 Agent ID
4. 创建 Agent 目录结构
5. 返回创建成功的 Agent ID

#### `coclaw agent <id> <action>`

对指定 Agent 执行操作。

**可用操作**:

- `start`: 启动 Agent（后台运行）
- `chat`: 与 Agent 交互（前台模式）
- `configure`: 重新配置 Agent
- `stop`: 停止运行中的 Agent
- `status`: 查看 Agent 状态
- `relation`: 管理 Agent 关系权限

**示例**:

```bash
coclaw agent agent_abc123 start
coclaw agent agent_abc123 chat
coclaw agent agent_abc123 relation
```

### 服务器命令

#### `coclaw server`

启动或停止服务器。

**功能**:

- 启动 WebSocket 服务器（端口 18790）
- 启动 HTTP 文件服务器
- 启用服务发现（mDNS/UDP 广播）
- 后台运行模式

#### `coclaw connect <serverid>`

连接到局域网中的其他服务器。

**参数**:

- `serverid`: 目标服务器 ID（通过服务发现获取）

**功能**:

- 建立服务器间连接
- 同步 Agent 注册信息
- 启用跨服务器消息转发

### 性能监控命令

#### `coclaw performance`

查看和管理服务器性能。

**选项**:

- `-r, --reset`: 重置性能统计
- `-d, --disable`: 禁用性能优化
- `-e, --enable`: 启用性能优化

**输出信息**:

- 当前连接数
- 消息处理速率
- 内存使用情况
- CPU 使用率
- 文件传输统计

### 错误监控命令

#### `coclaw errors`

查看错误统计和日志。

**选项**:

- `-c, --clear`: 清除错误统计
- `-l, --list`: 列出最近错误
- `-s, --stats`: 显示错误统计

## 服务器 API

### WebSocket API

#### 连接端点

```
ws://<server-ip>:18790/ws
```

#### 消息协议

所有消息都使用 JSON 格式：

```json
{
  "type": "message_type",
  "data": {},
  "timestamp": "2024-01-01T00:00:00.000Z",
  "sender": "agent_id",
  "recipient": "agent_id|server|broadcast"
}
```

#### 消息类型

##### 1. 注册消息

```json
{
  "type": "register",
  "data": {
    "agentId": "agent_abc123",
    "agentName": "My Agent",
    "capabilities": ["chat", "file_transfer"],
    "metadata": {}
  }
}
```

**响应**:

```json
{
  "type": "register_ack",
  "data": {
    "status": "success",
    "serverId": "server_xyz789",
    "assignedPort": 18791
  }
}
```

##### 2. 心跳消息

```json
{
  "type": "heartbeat",
  "data": {
    "agentId": "agent_abc123",
    "status": "active"
  }
}
```

##### 3. 文本消息

```json
{
  "type": "message",
  "data": {
    "content": "Hello, world!",
    "format": "text"
  },
  "sender": "agent_abc123",
  "recipient": "agent_def456"
}
```

##### 4. 文件传输消息

```json
{
  "type": "file_transfer",
  "data": {
    "fileId": "file_123456",
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "fileType": "application/pdf",
    "transferToken": "token_abcdef",
    "action": "request" // request, accept, reject, complete
  }
}
```

##### 5. 权限验证消息

```json
{
  "type": "permission_check",
  "data": {
    "sender": "agent_abc123",
    "recipient": "agent_def456",
    "action": "send_message",
    "resource": "conversation_123"
  }
}
```

**响应**:

```json
{
  "type": "permission_result",
  "data": {
    "allowed": true,
    "reason": "direct_relation"
  }
}
```

### HTTP API

#### 1. 服务器状态

```
GET /api/v1/status
```

**响应**:

```json
{
  "status": "running",
  "version": "1.0.0",
  "uptime": 3600,
  "connections": 5,
  "agents": {
    "total": 3,
    "active": 2,
    "inactive": 1
  },
  "performance": {
    "messagesPerSecond": 10.5,
    "memoryUsage": "45%",
    "cpuUsage": "12%"
  }
}
```

#### 2. Agent 列表

```
GET /api/v1/agents
```

**响应**:

```json
{
  "agents": [
    {
      "id": "agent_abc123",
      "name": "My Agent",
      "status": "active",
      "lastSeen": "2024-01-01T12:00:00.000Z",
      "capabilities": ["chat", "file_transfer"],
      "relations": ["agent_def456"]
    }
  ]
}
```

#### 3. 文件上传

```
POST /api/v1/files/upload
Content-Type: multipart/form-data
```

**参数**:

- `file`: 要上传的文件
- `agentId`: 上传者 Agent ID
- `recipient`: 接收者 Agent ID（可选）

**响应**:

```json
{
  "fileId": "file_123456",
  "fileName": "document.pdf",
  "fileSize": 1024000,
  "downloadUrl": "http://server:18790/files/file_123456",
  "expiresAt": "2024-01-02T12:00:00.000Z"
}
```

#### 4. 文件下载

```
GET /files/:fileId
```

**头部**:

```
X-File-Token: <transfer_token>
```

#### 5. 服务发现

```
GET /api/v1/discovery
```

**响应**:

```json
{
  "servers": [
    {
      "serverId": "server_xyz789",
      "host": "192.168.1.100",
      "port": 18790,
      "name": "Office Server",
      "agentCount": 3,
      "lastSeen": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

## 配置 API

### 配置文件位置

```
~/.coclaw/config.json
```

### 配置结构

```json
{
  "version": "1.0",
  "server": {
    "port": 18790,
    "host": "0.0.0.0",
    "maxConnections": 100,
    "dataDir": "~/.coclaw/server"
  },
  "agents": {
    "defaultPort": 18791,
    "dataRetentionDays": 30,
    "autoStart": false
  },
  "discovery": {
    "enabled": true,
    "broadcastPort": 18792,
    "broadcastInterval": 30000,
    "multicastGroup": "224.0.0.187"
  },
  "security": {
    "requireAuth": false,
    "allowLocalConnections": true,
    "allowedIPs": ["192.168.1.0/24"],
    "maxFileSize": 104857600
  },
  "performance": {
    "enableOptimization": true,
    "monitorInterval": 5000,
    "maxMemoryUsage": "80%"
  },
  "logging": {
    "level": "info",
    "file": "~/.coclaw/logs/coclaw.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

### 环境变量

| 变量名                     | 描述           | 默认值    |
| -------------------------- | -------------- | --------- |
| `COCLAW_PORT`              | 服务器端口     | 18790     |
| `COCLAW_HOST`              | 服务器绑定地址 | 0.0.0.0   |
| `COCLAW_DATA_DIR`          | 数据目录       | ~/.coclaw |
| `COCLAW_LOG_LEVEL`         | 日志级别       | info      |
| `COCLAW_DISABLE_DISCOVERY` | 禁用服务发现   | false     |

## Agent 管理 API

### Agent 目录结构

```
~/.coclaw/agents/
├── agent_abc123/
│   ├── config.json          # Agent 配置
│   ├── openclaw_config/     # OpenClaw 配置文件
│   ├── logs/               # Agent 日志
│   ├── data/               # Agent 数据
│   └── relations.json      # 关系权限配置
└── agent_def456/
    └── ...
```

### Agent 配置文件

```json
{
  "id": "agent_abc123",
  "name": "My Agent",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "lastActive": "2024-01-01T12:00:00.000Z",
  "status": "active",
  "openclawConfig": {
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2000
  },
  "capabilities": ["chat", "file_transfer", "code_execution"],
  "metadata": {
    "author": "User Name",
    "description": "Personal assistant agent"
  }
}
```

### 关系权限配置

```json
{
  "relations": {
    "agent_def456": {
      "permissions": ["send_message", "request_file_transfer", "view_status"],
      "createdAt": "2024-01-01T10:00:00.000Z",
      "expiresAt": null
    },
    "agent_ghi789": {
      "permissions": ["send_message"],
      "createdAt": "2024-01-01T11:00:00.000Z",
      "expiresAt": "2024-02-01T11:00:00.000Z"
    }
  },
  "defaultPermissions": ["send_message"]
}
```

## 文件传输 API

### 传输流程

1. **请求阶段**:
   - 发送方发送 `file_transfer` 消息（action: "request"）
   - 接收方响应接受或拒绝

2. **上传阶段**:
   - 发送方通过 HTTP POST 上传文件到服务器
   - 服务器返回文件 ID 和下载令牌

3. **通知阶段**:
   - 服务器通知接收方文件已就绪
   - 接收方使用令牌下载文件

4. **完成阶段**:
   - 接收方确认下载完成
   - 服务器清理临时文件

### 文件令牌系统

文件令牌用于安全地访问文件，包含以下信息：

- `fileId`: 文件唯一标识
- `agentId`: 授权访问的 Agent ID
- `expiresAt`: 令牌过期时间
- `permissions`: 访问权限（read, download）

## 错误处理

### 错误代码

| 代码 | 描述           | HTTP 状态码 |
| ---- | -------------- | ----------- |
| 1000 | 成功           | 200         |
| 4000 | 请求参数错误   | 400         |
| 4001 | 认证失败       | 401         |
| 4003 | 权限不足       | 403         |
| 4004 | 资源不存在     | 404         |
| 4009 | 文件大小超限   | 413         |
| 5000 | 服务器内部错误 | 500         |
| 5001 | 数据库错误     | 500         |
| 5002 | 文件系统错误   | 500         |
| 5003 | 网络连接错误   | 502         |

### 错误响应格式

```json
{
  "error": {
    "code": 4000,
    "message": "Invalid request parameters",
    "details": {
      "field": "agentId",
      "reason": "Required field is missing"
    },
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

## 性能优化 API

### 监控指标

#### 实时指标

```json
{
  "connections": {
    "total": 10,
    "active": 8,
    "idle": 2
  },
  "messages": {
    "total": 1500,
    "ratePerSecond": 25.5,
    "queueSize": 3
  },
  "resources": {
    "memoryUsage": "45%",
    "cpuUsage": "12%",
    "diskUsage": "30%"
  },
  "fileTransfers": {
    "active": 2,
    "completed": 15,
    "failed": 1,
    "totalSize": "150MB"
  }
}
```

#### 历史统计

```json
{
  "hourly": {
    "peakConnections": 25,
    "averageMessageRate": 18.7,
    "totalFileTransfers": 120
  },
  "daily": {
    "uptime": "99.8%",
    "errorRate": "0.2%",
    "dataTransferred": "2.5GB"
  }
}
```

### 优化配置

```json
{
  "connectionPool": {
    "maxSize": 100,
    "idleTimeout": 300000,
    "keepAlive": true
  },
  "messageQueue": {
    "maxSize": 1000,
    "processingConcurrency": 10,
    "retryAttempts": 3
  },
  "fileCache": {
    "enabled": true,
    "maxSize": "1GB",
    "ttl": 3600000
  },
  "compression": {
    "enabled": true,
    "minSize": 1024,
    "algorithm": "gzip"
  }
}
```

## 安全 API

### 认证机制

#### 1. Agent 认证

- 基于 Agent ID 和密钥对
- 每个 Agent 有唯一的密钥
- 密钥存储在 `~/.coclaw/agents/<agent_id>/key.pem`

#### 2. 服务器认证

- 服务器间使用共享密钥
- 支持 TLS/SSL 加密
- 可配置证书路径

### 权限模型

#### 权限级别

1. **无权限**: 只能看到在线状态
2. **基本权限**: 可以发送消息
3. **文件权限**: 可以传输文件
4. **管理权限**: 可以管理其他 Agent

#### 权限验证流程

1. 检查发送方和接收方关系
2. 验证请求的权限级别
3. 检查权限有效期
4. 记录权限使用日志

## 扩展 API

### 插件系统

#### 插件目录结构

```
~/.coclaw/plugins/
├── my-plugin/
│   ├── package.json
│   ├── index.js
│   └── config.json
└── ...
```

#### 插件接口

```javascript
module.exports = {
  name: "my-plugin",
  version: "1.0.0",

  // 初始化插件
  initialize: async (config, context) => {
    // 插件初始化逻辑
  },

  // 处理消息
  onMessage: async (message, context) => {
    // 消息处理逻辑
    return { processed: true, result: {} };
  },

  // 清理资源
  cleanup: async () => {
    // 清理逻辑
  },
};
```

### Webhook 支持

#### Webhook 配置

```json
{
  "webhooks": {
    "onAgentRegister": "https://example.com/webhooks/agent-register",
    "onMessageReceived": "https://example.com/webhooks/message",
    "onFileTransfer": "https://example.com/webhooks/file",
    "onError": "https://example.com/webhooks/error"
  }
}
```

#### Webhook 数据格式

```json
{
  "event": "agent_register",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "data": {
    "agentId": "agent_abc123",
    "agentName": "My Agent",
    "serverId": "server_xyz789"
  },
  "signature": "hmac_sha256_signature"
}
```

## 客户端 SDK

### JavaScript/Node.js SDK

#### 安装

```bash
npm install coclaw-client
```

#### 基本用法

```javascript
const { CoclawClient } = require("coclaw-client");

const client = new CoclawClient({
  serverUrl: "ws://localhost:18790",
  agentId: "agent_abc123",
  agentKey: "path/to/key.pem",
});

// 连接到服务器
await client.connect();

// 发送消息
await client.sendMessage({
  recipient: "agent_def456",
  content: "Hello!",
  type: "text",
});

// 监听消息
client.on("message", (message) => {
  console.log("收到消息:", message);
});

// 传输文件
const fileTransfer = await client.transferFile({
  recipient: "agent_def456",
  filePath: "/path/to/file.pdf",
  fileName: "document.pdf",
});

// 断开连接
await client.disconnect();
```

### Python SDK

#### 安装

```bash
pip install coclaw-client
```

#### 基本用法

```python
from coclaw import CoclawClient

client = CoclawClient(
    server_url='ws://localhost:18790',
    agent_id='agent_abc123',
    agent_key='path/to/key.pem'
)

# 连接到服务器
client.connect()

# 发送消息
client.send_message(
    recipient='agent_def456',
    content='Hello!',
    message_type='text'
)

# 监听消息
def on_message(message):
    print(f'收到消息: {message}')

client.on_message = on_message

# 断开连接
client.disconnect()
```

## 更新日志

### API 版本历史

#### v1.0.0 (2024-01-01)

- 初始版本发布
- 完整的 CLI 命令集
- WebSocket 消息协议
- HTTP 文件传输 API
- 权限管理系统
- 服务发现机制

## 支持与反馈

- **问题报告**: GitHub Issues
- **文档更新**: 提交 Pull Request
- **安全漏洞**: security@example.com
- **社区讨论**: Discord/Telegram

---

_最后更新: 2024-01-01_
_API 版本: v1.0.0_
