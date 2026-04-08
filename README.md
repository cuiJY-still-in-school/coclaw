# Coclaw - 本地网络 AI 协作工具

Coclaw 是一个基于 OpenClaw 的本地网络 AI 协作工具，支持多 Agent 之间的安全通信、文件传输和智能工具调用。

## 特性

- 🚀 **高性能通信**: 基于 WebSocket 的实时消息传递
- 📁 **安全文件传输**: 端到端加密的文件传输系统
- 🔐 **细粒度权限控制**: 基于关系的权限管理系统
- 🧠 **AI 工具集成**: 支持多种 AI 工具调用
- 📊 **实时监控**: 全面的性能监控和错误处理
- 🔧 **可扩展架构**: 模块化设计，易于扩展
- 🌐 **网络发现**: 自动发现局域网内的其他服务器

## 快速开始

### 安装

#### 方法一：使用安装脚本（推荐）

```bash
# 下载并运行安装脚本
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/install.sh | bash

# 或先下载再运行
wget https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/install.sh
chmod +x install.sh
./install.sh
```

#### 方法二：手动安装

```bash
# 克隆仓库
git clone https://github.com/cuiJY-still-in-school/coclaw.git
cd coclaw

# 安装依赖
npm install

# 全局安装（可选）
npm install -g .
```

### 启动服务器

```bash
# 启动服务器（后台运行）
coclaw server

# 或使用交互模式（无参数运行）
coclaw
```

### 创建 Agent

```bash
# 创建新 Agent
coclaw create

# 查看所有 Agent
coclaw list
```

### 连接到其他服务器

```bash
# 连接到局域网中的服务器
coclaw connect <server-id>
```

## 架构概述

Coclaw 采用模块化架构，基于 OpenClaw 构建，主要组件包括：

### 核心模块

1. **CLI 界面**: 基于 Commander.js 的命令行界面
2. **服务器管理器 (ServerManager)**: 管理 HTTP 和 WebSocket 服务器
3. **Agent 管理器 (AgentManager)**: 管理 OpenClaw Agent 生命周期
4. **关系管理器 (RelationshipManager)**: 处理 Agent 之间的权限配置
5. **文件传输系统**: 基于 HTTP 的安全文件传输
6. **服务发现模块**: UDP 广播用于局域网内服务器发现
7. **错误处理系统**: 统一的错误处理和恢复机制
8. **性能监控系统**: 实时监控服务器性能指标

### 技术栈

- **运行时**: Node.js (v14+)
- **CLI 框架**: Commander.js
- **Web 框架**: Express.js
- **WebSocket**: ws 库
- **文件操作**: fs-extra
- **用户交互**: inquirer
- **配置管理**: 基于 JSON 文件的配置系统

## 详细使用指南

### Agent 管理

#### 创建 Agent

```bash
coclaw create
```

创建过程会提示输入：

- Agent 名称
- 监听端口（默认: 18789）
- 能力配置（消息、文件、AI 工具等）

#### Agent 操作

```bash
# 启动 Agent
coclaw agent <agent-id> start

# 停止 Agent
coclaw agent <agent-id> stop

# 查看 Agent 状态
coclaw agent <agent-id> status

# 发送消息
coclaw agent <agent-id> send <target-agent> "Hello, world!"

# 发送文件
coclaw agent <agent-id> send-file <target-agent> /path/to/file.txt

# 查看关系配置
coclaw agent <agent-id> relationships
```

### 服务器管理

#### 启动/停止服务器

```bash
# 启动服务器（后台运行）
coclaw server start

# 停止服务器
coclaw server stop

# 查看服务器状态
coclaw server status

# 重启服务器
coclaw server restart
```

#### 服务器配置

配置文件位于 `~/.coclaw/config.json`:

```json
{
  "server": {
    "port": 18790,
    "host": "0.0.0.0",
    "maxConnections": 100,
    "timeout": 30000
  },
  "file": {
    "maxSize": 104857600,
    "storageDir": "~/.coclaw/files",
    "retentionDays": 1
  },
  "security": {
    "tokenExpiration": 3600,
    "maxFailedAttempts": 5
  }
}
```

### 权限管理

#### 信任级别

信任级别从 0（不信任）到 10（完全信任），影响默认权限：

```bash
# 设置信任级别
coclaw agent <agent-id> trust <level>

# 示例：设置高信任级别
coclaw agent agent1 trust 8
```

#### 特定权限

```bash
# 允许特定操作
coclaw agent <agent-id> allow <target-agent> send_message
coclaw agent <agent-id> allow <target-agent> send_file
coclaw agent <agent-id> allow <target-agent> call_tool

# 阻止 Agent
coclaw agent <agent-id> block <target-agent>

# 取消阻止
coclaw agent <agent-id> unblock <target-agent>
```

### 文件传输

#### 发送文件

```bash
# 发送文件给其他 Agent
coclaw agent <agent-id> send-file <target-agent> /path/to/file.txt

# 发送文件并添加描述
coclaw agent <agent-id> send-file <target-agent> /path/to/file.txt --description "项目文档"
```

#### 文件管理

```bash
# 查看已接收文件
coclaw agent <agent-id> files

# 下载文件
coclaw agent <agent-id> download <file-id> /download/path

# 清理过期文件
curl -X POST http://localhost:18790/api/files/cleanup
```

### 性能监控

#### 查看性能统计

```bash
# 查看性能统计
coclaw performance

# 输出示例：
# 消息路由统计: 1250 条消息
# 平均延迟: 45.2ms
# 文件传输统计: 25 个文件
# 平均速度: 5.2 MB/s
```

#### 性能优化控制

```bash
# 启用/禁用性能优化
coclaw performance --enable
coclaw performance --disable

# 重置性能统计
coclaw performance --reset
```

#### API 端点

```bash
# 健康检查
curl http://localhost:18790/health

# 性能统计
curl http://localhost:18790/api/performance/stats

# 控制性能优化
curl -X POST http://localhost:18790/api/performance/control \
  -H "Content-Type: application/json" \
  -d '{"action":"enable"}'
```

### 错误监控

#### 查看错误统计

```bash
# 查看错误统计
coclaw errors

# 列出最近错误
coclaw errors --list

# 显示详细统计
coclaw errors --stats

# 清除错误统计
coclaw errors --clear
```

#### 错误代码参考

Coclaw 使用标准化的错误代码系统：

- **1000-1999**: 网络错误
- **2000-2999**: 认证错误
- **3000-3999**: 消息错误
- **4000-4999**: 文件错误
- **5000-5999**: 服务器错误
- **6000-6999**: 配置错误
- **7000-7999**: 关系错误
- **8000-8999**: AI 工具错误
- **9000-9999**: 未知错误

详细错误代码参考请查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

## 高级功能

### AI 工具集成

Coclaw 支持多种 AI 工具调用：

```bash
# 调用 AI 工具
coclaw agent <agent-id> call-tool <tool-name> --params '{"param1": "value1"}'

# 可用工具列表
coclaw agent <agent-id> tools
```

### 网络发现

自动发现局域网内的其他 Coclaw 服务器：

```bash
# 查看发现的服务器
coclaw server discover

# 手动连接到服务器
coclaw connect <server-id>
```

### 负载均衡

当有多个服务器时，Coclaw 支持基本的负载均衡：

```bash
# 查看服务器负载
curl http://localhost:18790/metrics

# 手动转移连接
coclaw agent <agent-id> transfer <new-server>
```

## API 参考

### HTTP API

#### 健康检查

```
GET /health
```

#### 性能统计

```
GET /api/performance/stats
POST /api/performance/control
```

#### Agent 管理

```
GET    /api/agents
POST   /api/agents/register
POST   /api/agents/unregister
```

#### 文件传输

```
POST   /api/files/upload
GET    /api/files/:fileId
POST   /api/files/:fileId/token
GET    /api/files/:fileId/info
POST   /api/files/cleanup
```

#### 关系管理

```
GET    /api/relationships/:agentId
PUT    /api/relationships/:agentId
POST   /api/relationships/check
POST   /api/relationships/:agentId/block
POST   /api/relationships/:agentId/unblock
POST   /api/relationships/:agentId/override
POST   /api/relationships/:agentId/trust
GET    /api/relationships/stats
GET    /api/relationships/export
POST   /api/relationships/import
```

### WebSocket 协议

#### 消息类型

1. **身份识别**

```json
{
  "type": "identify",
  "data": {
    "clientType": "agent",
    "agentId": "agent_123",
    "capabilities": ["message", "file"]
  }
}
```

2. **Agent 注册**

```json
{
  "type": "agent_register",
  "data": {
    "agentId": "agent_123",
    "name": "My Agent",
    "capabilities": ["message", "file"]
  }
}
```

3. **消息发送**

```json
{
  "type": "agent_message",
  "data": {
    "fromAgentId": "agent_123",
    "toAgentId": "agent_456",
    "message": "Hello!",
    "messageType": "text"
  }
}
```

4. **文件传输请求**

```json
{
  "type": "file_transfer",
  "data": {
    "action": "request_upload",
    "fromAgentId": "agent_123",
    "toAgentId": "agent_456",
    "filename": "document.pdf",
    "size": 1048576
  }
}
```

## 开发指南

### 项目结构

```
coclaw/
├── bin/
│   └── coclaw              # CLI 入口点
├── lib/
│   ├── commands/           # CLI 命令
│   │   ├── agent.js        # Agent 操作命令
│   │   ├── server.js       # 服务器管理命令
│   │   ├── create.js       # 创建 Agent 命令
│   │   ├── list.js         # 列出 Agent 命令
│   │   ├── connect.js      # 连接服务器命令
│   │   ├── performance.js  # 性能监控命令
│   │   └── errors.js       # 错误监控命令
│   ├── server-manager.js   # 服务器管理器
│   ├── agent-manager.js    # Agent 管理器
│   ├── relationship-manager.js # 关系管理器
│   ├── token-manager.js    # 令牌管理器
│   ├── error-handler.js    # 错误处理器
│   ├── performance-optimizer.js # 性能优化器
│   ├── resource-cleaner.js # 资源清理器
│   ├── server-connector.js # 服务器连接器
│   ├── ai-tools.js         # AI 工具集成
│   ├── discovery.js        # 服务发现
│   ├── monitoring.js       # 监控系统
│   ├── message-system.js   # 消息系统
│   ├── openclaw.js         # OpenClaw 集成
│   ├── config.js           # 配置管理
│   ├── cli.js             # CLI 工具函数
│   └── relation-cli.js     # 关系 CLI 工具
├── tests/                  # 测试文件
├── ui/                    # 用户界面
│   └── interactive.js     # 交互式 UI
├── dist/                  # 发布包目录
├── .github/               # GitHub 配置
│   └── workflows/         # CI/CD 工作流
├── README.md              # 本文档
├── ARCHITECTURE.md        # 架构设计文档
├── API.md                 # API 文档
├── TROUBLESHOOTING.md     # 故障排除指南
└── package.json           # 项目配置
```

### 开发环境设置

```bash
# 克隆项目
git clone <repository-url>
cd coclaw

# 安装依赖
npm install

# 运行测试
npm test

# 运行负载测试
node test-load-stability.js

# 运行端到端测试
node test-e2e-scenario.js

# 开发模式运行
npm run dev
```

### 添加新功能

#### 1. 添加新 CLI 命令

1. 在 `lib/commands/` 目录下创建新命令文件
2. 在 `bin/coclaw` 中注册命令
3. 实现命令逻辑

#### 2. 添加新 API 端点

1. 在 `lib/server-manager.js` 的 `setupRoutes()` 方法中添加新路由
2. 实现对应的处理函数
3. 更新 API 文档

#### 3. 添加新 AI 工具

1. 在 `lib/ai-tools.js` 中添加新工具定义
2. 实现工具执行逻辑
3. 更新工具注册表

### 测试

```bash
# 运行所有测试
npm test

# 运行特定测试
node test-server.js
node test-file-transfer.js
node test-e2e-scenario.js
node test-load-stability.js

# 代码覆盖率
npm run coverage
```

## 部署指南

### 生产环境部署

#### 1. 系统要求

- Node.js 16+
- 至少 1GB 可用内存
- 至少 10GB 可用磁盘空间
- Linux/Unix 系统（推荐 Ubuntu 20.04+）

#### 2. 安装步骤

```bash
# 1. 安装 Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. 安装 Coclaw
sudo npm install -g coclaw

# 3. 创建系统服务
sudo nano /etc/systemd/system/coclaw.service
```

#### 3. Systemd 服务配置

```ini
[Unit]
Description=Coclaw AI Collaboration Server
After=network.target

[Service]
Type=simple
User=coclaw
WorkingDirectory=/var/lib/coclaw
ExecStart=/usr/bin/coclaw server
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=coclaw

# 安全设置
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/coclaw

# 资源限制
MemoryMax=1G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

#### 4. 启动服务

```bash
# 创建用户和数据目录
sudo useradd -r -s /bin/false coclaw
sudo mkdir -p /var/lib/coclaw
sudo chown -R coclaw:coclaw /var/lib/coclaw

# 启用并启动服务
sudo systemctl daemon-reload
sudo systemctl enable coclaw
sudo systemctl start coclaw

# 查看服务状态
sudo systemctl status coclaw
sudo journalctl -u coclaw -f
```

### 高可用部署

#### 1. 负载均衡配置

```nginx
# Nginx 配置示例
upstream coclaw_servers {
    server 192.168.1.100:18790;
    server 192.168.1.101:18790;
    server 192.168.1.102:18790;
}

server {
    listen 80;
    server_name coclaw.example.com;

    location / {
        proxy_pass http://coclaw_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

#### 2. 数据库集成（可选）

Coclaw 支持外部数据库存储：

```bash
# 使用 PostgreSQL
export COCLAW_DB_TYPE=postgres
export COCLAW_DB_URL=postgres://user:password@localhost:5432/coclaw

# 使用 Redis 缓存
export COCLAW_REDIS_URL=redis://localhost:6379
```

## 故障排除

详细的故障排除指南请查看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。

常见问题：

1. **服务器无法启动**: 检查端口占用和权限
2. **Agent 无法连接**: 检查防火墙和网络配置
3. **文件传输失败**: 检查文件大小限制和磁盘空间
4. **性能问题**: 使用性能监控工具诊断

## 贡献指南

我们欢迎贡献！请查看以下指南：

### 报告问题

1. 使用 GitHub Issues 报告问题
2. 提供详细的复现步骤
3. 包含相关日志和错误信息

### 提交代码

1. Fork 项目仓库
2. 创建功能分支
3. 提交更改
4. 创建 Pull Request

### 代码规范

- 使用 ESLint 检查代码风格
- 编写单元测试
- 更新相关文档
- 遵循现有的代码约定

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](LICENSE) 文件。

## 支持

- 📖 文档: [README.md](README.md), [ARCHITECTURE.md](ARCHITECTURE.md), [API.md](API.md), [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
- 🐛 问题: [GitHub Issues](https://github.com/cuiJY-still-in-school/coclaw/issues)
- 📧 联系: shortsubjayfire@gmail.com

## 版本历史

### v1.0.0 (2026-04-08)

- 🎉 **初始正式发布**
- 🏗️ **核心架构**: 基于 OpenClaw 的模块化架构
- 🤖 **Agent 管理**: 完整的 Agent 创建、启动、停止、监控功能
- 🔗 **服务器通信**: WebSocket 实时通信 + HTTP 文件传输
- 🌐 **服务发现**: 局域网内自动服务器发现
- 📊 **性能监控**: 实时性能统计和优化
- 🛡️ **错误处理**: 统一的错误处理和恢复机制
- 📁 **文件传输**: 安全的端到端文件传输系统
- 🔐 **权限管理**: 基于关系的细粒度权限控制
- 📚 **完整文档**: 详细的用户指南和 API 文档
- 🧪 **测试覆盖**: 完整的单元测试和集成测试

---

**感谢使用 Coclaw！** 🚀

如有任何问题或建议，请随时联系我们。
