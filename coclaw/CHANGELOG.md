# Changelog

All notable changes to Coclaw will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project structure and design documentation
- Complete 10-week development plan
- Core architecture design

## [1.0.5] - 2026-04-09

### Fixed

- **安装脚本语法错误**: 修复安装脚本中的重复代码和语法错误
- **用户体验改进**: 允许 `--help` 和 `--version` 命令在没有 root 权限时运行
- **参数解析优化**: 优化命令行参数解析逻辑
- **文档更新**: 更新所有文档中的安装说明和故障排除指南

## [1.0.4] - 2026-04-09

### Fixed

- **文件下载不完全**: 修复安装脚本只下载部分文件的问题
- **完整文件下载**: 确保下载所有 26 个必要的库文件
- **入口点修复**: 创建 `lib/index.js` 作为主入口点，修复 `package.json` 配置
- **关键文件缺失**: 确保 `lib/openclaw.js` 等关键文件被下载

## [1.0.3] - 2026-04-09

### Changed

- **安装脚本简化**: 直接要求 sudo，移除管道运行警告
- **安装选项**: 添加 `--local` 选项支持本地用户安装
- **权限处理**: 简化权限包装逻辑，提高安装成功率

## [1.0.2] - 2026-04-09

### Fixed

- **安装脚本权限问题**: 修复 `sudo $cmd` 无法正确处理带引号命令的问题
- **远程安装改进**: 改进远程安装的文件下载逻辑和错误处理
- **命令执行修复**: 使用 `bash -c` 正确处理命令执行

## [1.0.1] - 2026-04-09

### Fixed

- **初始安装修复**: 修复安装脚本的基本权限和路径问题
- **依赖安装**: 确保 npm 依赖正确安装
- **符号链接**: 修复命令符号链接创建问题

## [1.0.0] - 2025-04-07

### Added

- Complete Phase 1-5 implementation
- Multi-Agent collaboration system
- Secure file transfer with token-based authentication
- Relationship-based permission management
- WebSocket-based real-time communication
- HTTP API for file upload/download
- Service discovery for local network
- AI tools integration framework
- Comprehensive error handling and recovery
- Performance optimization with message batching and connection pooling
- Resource cleanup and memory management
- CLI interface with interactive mode
- Load testing and stability testing
- Detailed user documentation and troubleshooting guide

### Features

- **Agent Management**: Create, start, stop, and manage AI agents
- **File Transfer**: Secure end-to-end file transfer with size limits and expiration
- **Permission Control**: Fine-grained permission system based on trust levels
- **Real-time Messaging**: WebSocket-based message routing between agents
- **Network Discovery**: Automatic discovery of Coclaw servers in local network
- **Performance Monitoring**: Real-time performance statistics and optimization
- **Error Handling**: Comprehensive error codes and automatic recovery
- **CLI Interface**: User-friendly command-line interface with help and autocomplete

### Technical Details

- **Architecture**: Modular design with clear separation of concerns
- **Communication**: HTTP + WebSocket hybrid architecture
- **Security**: Token-based authentication and permission validation
- **Performance**: Optimized message routing and file transfer
- **Scalability**: Support for multiple concurrent agents and servers
- **Reliability**: Automatic error recovery and resource cleanup

### System Requirements

- **Node.js**: v18.0.0 or higher
- **Operating Systems**: macOS 10.15+, Ubuntu 20.04+, CentOS 8+
- **Memory**: Minimum 512MB RAM
- **Disk Space**: Minimum 100MB available space

### Installation

```bash
# 查看帮助信息（不需要 sudo）
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/install.sh | bash -s -- --help

# 查看版本信息（不需要 sudo）
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/install.sh | bash -s -- --version

# 标准安装（需要 sudo）
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/install.sh | sudo bash

# 本地安装（需要 sudo，但安装在用户目录）
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/install.sh | sudo bash -s -- --local

# 或手动安装
git clone https://github.com/cuiJY-still-in-school/coclaw.git
cd coclaw/coclaw
sudo ./install.sh
```

### Quick Start

1. Install Coclaw: `./install.sh`
2. Create an agent: `coclaw create`
3. Start the server: `coclaw server`
4. Connect agents and start collaborating!

### Documentation

- [User Manual](README.md)
- [Troubleshooting Guide](TROUBLESHOOTING.md)
- [Quick Start Guide](QUICKSTART.md)
- [API Documentation](docs/api.md)
- [Architecture Design](docs/architecture.md)

## Development Phases

### Phase 1: Foundation & Architecture (Week 1-2)

- Project setup and configuration management
- Basic CLI framework and agent management
- Core server architecture design

### Phase 2: Communication Protocol (Week 3-4)

- WebSocket server implementation
- Message routing and delivery system
- Basic file transfer protocol

### Phase 3: Security & Permissions (Week 5-6)

- Token-based authentication system
- Relationship and permission management
- File transfer security enhancements

### Phase 4: Advanced Features (Week 7-8)

- AI tools integration framework
- Network discovery and server connectivity
- Monitoring and logging system

### Phase 5: System Integration & Optimization (Week 9)

- End-to-end testing scenarios
- Comprehensive error handling and recovery
- Performance optimization and resource management
- CLI user experience improvements
- Documentation and troubleshooting guides

### Phase 6: Deployment & Release (Week 10)

- Installation script development
- Distribution package creation
- Version management and release process
- Production environment testing
- Final documentation and release

## Contributors

- **CuiJY** (shortsubjayfire@gmail.com) - Project lead and main developer

## Acknowledgments

- Thanks to the OpenClaw project for inspiration and foundation
- Thanks to all testers and contributors for feedback and support
- Special thanks to the open-source community for tools and libraries

---

_For detailed information about each version, please refer to the corresponding release notes on GitHub._
