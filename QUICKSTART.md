# Coclaw 快速开始指南

## 概述

Coclaw 是一个基于 OpenClaw 的本地局域网 AI 协作工具，提供多 Agent 管理、通信和文件共享功能。

## 系统要求

- **操作系统**: macOS 或 Linux
- **Node.js**: v18+
- **OpenClaw**: 自动安装或手动安装

## 安装

### 方法1: 使用安装脚本（推荐）

```bash
# 下载安装脚本
curl -fsSL https://raw.githubusercontent.com/yourusername/coclaw/main/install.sh -o install.sh

# 运行安装脚本
chmod +x install.sh
./install.sh
```

### 方法2: 手动安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/coclaw.git
cd coclaw

# 安装依赖
npm install

# 全局安装（可选）
npm link
```

## 快速开始

### 1. 启动交互式界面

```bash
coclaw
```

这会启动一个交互式终端界面，引导您完成所有操作。

### 2. 创建第一个 Agent

在交互界面中选择 "🆕 创建新 Agent"，或使用命令行：

```bash
coclaw create
```

按照提示输入 Agent 名称，系统会自动创建并配置 Agent。

### 3. 启动 Agent

```bash
coclaw agent <agent-id> start
```

例如：

```bash
coclaw agent agent_d81cc634d872 start
```

### 4. 与 Agent 聊天

```bash
coclaw agent <agent-id> chat
```

这会启动一个聊天界面，您可以直接与 AI Agent 对话。

### 5. 管理多个 Agent

```bash
# 列出所有 Agent
coclaw list

# 配置 Agent
coclaw agent <agent-id> configure

# 停止 Agent
coclaw agent <agent-id> stop
```

## 命令行参考

### 基础命令

| 命令                         | 描述             |
| ---------------------------- | ---------------- |
| `coclaw --help`              | 显示帮助信息     |
| `coclaw --version`           | 显示版本信息     |
| `coclaw list`                | 列出所有 Agent   |
| `coclaw create`              | 创建新 Agent     |
| `coclaw server`              | 启动/停止服务器  |
| `coclaw connect <host:port>` | 连接到远程服务器 |

### Agent 操作命令

| 命令                          | 描述            |
| ----------------------------- | --------------- |
| `coclaw agent <id> start`     | 启动 Agent      |
| `coclaw agent <id> stop`      | 停止 Agent      |
| `coclaw agent <id> chat`      | 与 Agent 聊天   |
| `coclaw agent <id> configure` | 配置 Agent      |
| `coclaw agent <id> relation`  | 配置 Agent 关系 |

## 配置目录

安装后会在用户目录创建配置结构：

```
~/.coclaw/
├── config.json              # 全局配置
├── agents/                  # Agent 数据
│   └── <agent-id>/
│       ├── config.json      # Agent 配置
│       ├── openclaw.json    # OpenClaw 配置
│       ├── relations.json   # 关系配置
│       ├── data/            # 数据目录
│       ├── files/           # 文件目录
│       └── logs/            # 日志目录
├── servers/                 # 服务器配置
└── server/                  # 服务器数据
```

## 故障排除

### 常见问题

1. **OpenClaw 未安装**

   ```
   Error: OpenClaw 未安装
   ```

   解决方案：运行 `npm install -g openclaw@latest`

2. **端口被占用**

   ```
   Error: Gateway 在 10000ms 内未启动
   ```

   解决方案：检查端口是否被其他程序占用，或修改 Agent 配置中的端口号

3. **配置错误**
   ```
   Error: Invalid config at ...
   ```
   解决方案：运行 `coclaw agent <id> configure` 重新配置

### 查看日志

Agent 日志位于：

```
~/.coclaw/agents/<agent-id>/logs/
```

### 重置配置

删除配置目录并重新安装：

```bash
rm -rf ~/.coclaw
# 重新运行安装脚本
```

## 高级功能

### 服务器功能

启动本地服务器以支持多 Agent 协作：

```bash
coclaw server
```

### Agent 关系配置

配置 Agent 间的通信权限：

```bash
coclaw agent <id> relation
```

### 远程连接

连接到其他计算机上的 Coclaw 服务器：

```bash
coclaw connect 192.168.1.100:18790
```

## 开发

### 项目结构

```
coclaw/
├── bin/coclaw              # CLI 入口
├── lib/                    # 核心库
│   ├── cli.js              # CLI 工具
│   ├── config.js           # 配置管理
│   ├── agent-manager.js    # Agent 管理
│   ├── openclaw.js         # OpenClaw 封装
│   ├── server-manager.js   # 服务器管理
│   └── commands/           # 命令实现
├── ui/                     # 终端 UI
│   ├── prompts.js          # 提示组件
│   └── interactive.js      # 交互界面
├── templates/              # 配置模板
├── tests/                  # 测试文件
└── install.sh              # 安装脚本
```

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- <test-file>
```

## 贡献

欢迎贡献代码、报告问题或提出建议！

1. Fork 仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

MIT License

## 支持

- 查看 [project.md](./project.md) 了解详细设计
- 查看 [plan.md](./plan.md) 了解开发路线图
- 创建 GitHub Issue 报告问题
