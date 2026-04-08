# Coclaw v1.0.0

🎉 **第一个稳定版本发布！** 基于 OpenClaw 的局域网 AI 协作工具。

## 主要功能

### 🤖 多 Agent 协作系统

- 创建、启动、停止和管理多个 AI Agent
- 基于关系的权限管理系统
- 实时消息路由和转发

### 📁 安全文件传输

- 令牌认证的文件传输
- 文件大小限制和过期机制
- 端到端的安全传输

### 🌐 网络互联

- 局域网服务自动发现
- 多服务器互联和同步
- WebSocket 实时通信

### 🛠️ 开发者友好

- 完整的 CLI 界面
- RESTful API 和 WebSocket API
- 详细的文档和示例

## 安装方式

### 使用安装脚本（推荐）：

```bash
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash
```

### 手动安装：

```bash
git clone https://github.com/cuiJY-still-in-school/coclaw.git
cd coclaw
./install.sh
```

## 快速开始

1. **安装 Coclaw**：

   ```bash
   ./install.sh
   ```

2. **创建你的第一个 Agent**：

   ```bash
   coclaw create
   ```

3. **启动服务器**：

   ```bash
   coclaw server
   ```

4. **开始协作**：
   ```bash
   coclaw agent <agent_id> chat
   ```

## 系统要求

- **Node.js**: v18.0.0 或更高版本
- **操作系统**: macOS 10.15+, Ubuntu 20.04+, CentOS 8+
- **内存**: 至少 512MB RAM
- **磁盘空间**: 至少 100MB 可用空间

## 文档

- [用户手册](README.md) - 完整的使用指南
- [快速开始](QUICKSTART.md) - 快速上手指南
- [故障排除](TROUBLESHOOTING.md) - 常见问题解答
- [API 文档](API.md) - 完整的 API 参考
- [架构设计](ARCHITECTURE.md) - 系统架构说明
- [贡献指南](CONTRIBUTING.md) - 如何参与开发

## 技术特性

- **模块化架构**: 清晰的组件分离
- **混合通信**: HTTP + WebSocket 架构
- **安全设计**: 令牌认证和权限验证
- **性能优化**: 消息批处理和连接池
- **可扩展性**: 支持多并发 Agent 和服务器
- **可靠性**: 自动错误恢复和资源清理

## 发布包内容

此版本包含以下文件：

1. **coclaw-1.0.0.tar.gz** - Tar 压缩包 (3.2MB)
2. **coclaw-1.0.0.zip** - Zip 压缩包 (5.0MB)
3. **安装脚本** - 自动安装脚本
4. **完整文档** - 所有文档文件

## 问题反馈

如果您遇到任何问题或有功能建议，请通过以下方式联系我们：

- [GitHub Issues](https://github.com/cuiJY-still-in-school/coclaw/issues)
- 电子邮件: shortsubjayfire@gmail.com

## 致谢

特别感谢：

- **OpenClaw 项目** - 提供了灵感和基础
- **所有测试者和贡献者** - 提供了宝贵的反馈和支持
- **开源社区** - 提供了优秀的工具和库

---

**Coclaw 开发团队**  
2025年4月8日
