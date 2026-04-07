# Coclaw 项目设计文档

## 概述
Coclaw 是一个基于 OpenClaw 的本地局域网 AI 协作工具，提供多 Agent 管理、通信和文件共享功能。它通过 CLI 界面提供类似 OpenClaw 的用户体验，但专注于多个 AI Agent 之间的高效协作。

### 核心概念
- **Agent**: 一个独立的 AI 助手实例，基于 OpenClaw 运行
- **Server**: 局域网中的中心服务器，负责 Agent 注册、发现和消息中转
- **Relation**: Agent 之间的通信权限配置

## 功能需求

### 1. 命令行接口 (CLI)

#### 基础命令
- `coclaw -V` / `coclaw --version`: 显示版本信息
- `coclaw -H` / `coclaw --help`: 显示帮助信息
- `coclaw list`: 显示当前电脑上所有 Agent 的 ID 列表

#### 服务器管理
- `coclaw server`: 启动或停止服务器（后台运行）
  - 首次运行: 启动服务器
  - 服务器运行时: 停止服务器

#### Agent 管理
- `coclaw create`: 创建新 Agent
  - 生成唯一 ID
  - 自动进入 `coclaw <id> configure` 状态进行初始配置
  - 返回 Agent ID

- `coclaw connect <serverid>`: 连接到局域网中的其他服务器
  - 刷新 Agent 列表（包括远程 Agent）
  - 提交本地 Agent 信息到远程服务器
  - `<serverid>` 可以是 IP:端口 或 主机名

#### Agent 操作 (以 `<id>` 为参数)
- `coclaw <id> start`: 启动指定 Agent（后台运行）
- `coclaw <id> chat`: 与指定 Agent 直接交互（前台聊天界面）
- `coclaw <id> configure`: 配置 Agent，等同于 `openclaw configure`
- `coclaw <id> relation`: 配置该 Agent 与其他 Agent 的关系和通信权限
  - UI 风格照抄 OpenClaw
  - 可配置: 是否允许通信、是否可以发送文件、是否可以读取聊天记录等

### 2. Agent 特性
- 每个 Agent 独立运行一个 OpenClaw 实例
- 聊天记录持久化存储，可供 Agent 查看历史
- Agent 间可通过服务器中转传递文件和文本消息
- 支持权限控制，限制特定 Agent 间的通信

### 3. 服务器功能
- 局域网内 Agent 注册与发现
- 消息和文件中转
- 权限验证（基于 Relation 配置）
- 多服务器互联支持

## 技术架构

### 1. 依赖关系
- **OpenClaw**: 作为底层 AI 助手引擎，通过 CLI 调用
- **Node.js**: 运行环境（v18+）
- **系统要求**: macOS 和 Linux

### 2. Agent 实现方案
每个 Agent 对应:
1. 独立的配置目录: `~/.coclaw/agents/<id>/`
2. 独立的 OpenClaw 配置: `~/.coclaw/agents/<id>/openclaw.json`
3. 独立的数据目录: `~/.coclaw/agents/<id>/data/`
4. 独立的进程管理

### 3. 服务器架构
```
┌─────────────────────────────────────────────────────┐
│                    Coclaw Server                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Agent Registry │ │ Message Bus │ │ File Relay  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │              WebSocket API                    │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
         ↑                   ↑                   ↑
         │                   │                   │
┌────────┴───────┐ ┌────────┴───────┐ ┌────────┴───────┐
│   Local Agent  │ │   Local Agent  │ │  Remote Agent  │
│     (ID: A1)   │ │     (ID: A2)   │ │   (Server B)   │
└────────────────┘ └────────────────┘ └────────────────┘
```

### 4. 通信协议
- **控制通道**: WebSocket（服务器-客户端）
- **文件传输**: HTTP + 分块上传/下载
- **服务发现**: UDP 广播 + mDNS（Bonjour/Avahi）
- **服务器互联**: 专用的服务器间协议

### 5. 数据存储
```
~/.coclaw/
├── config.json              # 全局配置
├── servers/                 # 已知服务器列表
│   ├── server1.json
│   └── server2.json
├── agents/                  # Agent 数据
│   ├── <agent-id-1>/
│   │   ├── openclaw.json    # OpenClaw 配置
│   │   ├── config.json      # Agent 特定配置
│   │   ├── relations.json   # 关系配置
│   │   ├── chat.db         # 聊天记录数据库
│   │   └── files/          # 接收的文件
│   └── <agent-id-2>/
└── server/                  # 服务器数据
    ├── registry.db         # Agent 注册表
    └── files/              # 临时中转文件
```

## 详细设计

### 1. Agent 创建流程
```
用户输入: coclaw create
1. 生成唯一 ID（如: agent_abc123）
2. 创建目录结构: ~/.coclaw/agents/agent_abc123/
3. 初始化 OpenClaw 配置（复制默认模板）
4. 启动 `coclaw agent_abc123 configure`
5. 用户完成配置后，返回 Agent ID
```

### 2. 服务器启动流程
```
用户输入: coclaw server
1. 检查服务器是否已在运行
2. 如果未运行:
   a. 启动 WebSocket 服务器（默认端口: 18790）
   b. 启动 HTTP 文件服务器（默认端口: 18791）
   c. 启动服务发现广播
   d. 后台运行，记录 PID
3. 如果已在运行: 发送关闭信号，停止服务器
```

### 3. Agent 间通信流程
```
Agent A 发送消息给 Agent B:
1. Agent A 通过 WebSocket 发送消息到服务器
2. 服务器检查 Relation 权限
3. 如果有权限: 转发消息到 Agent B
4. Agent B 接收消息并处理

文件传输:
1. Agent A 上传文件到服务器的 HTTP 端点
2. 服务器返回文件令牌
3. Agent A 发送文件令牌给 Agent B（通过消息通道）
4. Agent B 使用令牌下载文件
```

### 4. Relation 权限模型
```json
{
  "agentId": "agent_a",
  "relations": [
    {
      "targetAgentId": "agent_b",
      "allowCommunication": true,
      "allowFileSend": true,
      "allowFileReceive": true,
      "allowHistoryRead": false,
      "allowRemoteExecution": false
    }
  ]
}
```

### 5. AI Tool 集成
OpenClaw Agent 可以通过以下 Tool 与其他 Agent 交互:
- `coclaw_send_message(agentId, message)`: 发送文本消息
- `coclaw_send_file(agentId, filePath)`: 发送文件
- `coclaw_list_agents()`: 列出可用 Agent
- `coclaw_get_history(agentId, limit)`: 获取聊天历史

## 安装与部署

### 1. 安装脚本 (install.sh)
```bash
#!/bin/bash
# Coclaw 安装脚本

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "错误: 需要 Node.js v18+"
    exit 1
fi

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "错误: 需要 npm"
    exit 1
fi

# 安装 OpenClaw（如果未安装）
if ! command -v openclaw &> /dev/null; then
    echo "正在安装 OpenClaw..."
    npm install -g openclaw@latest
fi

# 创建安装目录
INSTALL_DIR="/usr/local/lib/coclaw"
mkdir -p $INSTALL_DIR

# 复制文件（假设从 GitHub 下载）
# ... 实际文件复制逻辑 ...

# 创建符号链接
ln -sf $INSTALL_DIR/bin/coclaw /usr/local/bin/coclaw

echo "Coclaw 安装完成！"
echo "运行 'coclaw --help' 查看使用说明"
```

### 2. 目录结构
```
coclaw/
├── bin/
│   └── coclaw            # 主 CLI 入口
├── lib/
│   ├── server.js         # 服务器实现
│   ├── agent-manager.js  # Agent 管理
│   ├── communication.js  # 通信模块
│   └── utils.js          # 工具函数
├── ui/
│   └── prompts/          # 交互式 UI 组件
├── package.json
├── project.md
└── install.sh
```

## 开发计划

### Phase 1: 基础框架
1. CLI 框架和命令解析
2. Agent 目录结构管理
3. 基础配置文件管理

### Phase 2: OpenClaw 集成
1. OpenClaw CLI 调用封装
2. Agent 进程管理（启动/停止）
3. 配置管理界面

### Phase 3: 服务器实现
1. WebSocket 服务器
2. Agent 注册与发现
3. 基础消息转发

### Phase 4: 高级功能
1. 文件传输系统
2. Relation 权限管理
3. 多服务器互联
4. AI Tool 集成

### Phase 5: 优化与测试
1. 性能优化
2. 错误处理
3. 跨平台测试
4. 文档完善

## 已知问题与限制

1. **依赖 OpenClaw**: 需要 OpenClaw 正确安装和配置
2. **网络要求**: 需要局域网连通性
3. **安全考虑**: 当前设计假设可信局域网环境
4. **资源占用**: 每个 Agent 运行独立的 OpenClaw 实例，内存消耗较大

## 后续扩展

1. **Web UI**: 提供浏览器管理界面
2. **插件系统**: 支持功能扩展
3. **云同步**: 支持配置和聊天记录云端备份
4. **高级权限**: 更细粒度的权限控制
5. **API 接口**: 提供 REST API 供其他应用集成

---
*最后更新: 2026-04-07*
*设计基于 OpenClaw 项目 (https://github.com/openclaw/openclaw)*