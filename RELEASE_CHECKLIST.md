# Coclaw 发布检查清单

本文档包含发布 Coclaw 新版本时需要完成的所有检查项。请按照顺序逐一检查并完成。

## 发布前检查 (Pre-release)

### 代码质量

- [ ] **代码审查完成**
  - [ ] 所有新功能经过代码审查
  - [ ] 代码符合项目编码规范
  - [ ] 无明显的安全漏洞

- [ ] **测试通过**
  - [ ] 单元测试全部通过 (`npm test`)
  - [ ] 集成测试全部通过
  - [ ] 端到端测试全部通过 (`node test-e2e-scenario.js`)
  - [ ] 负载测试通过 (`node test-load-stability.js`)
  - [ ] 性能测试结果符合预期

- [ ] **代码质量工具**
  - [ ] ESLint 检查通过 (`npm run lint` 如果配置了)
  - [ ] 无未使用的依赖
  - [ ] 代码复杂度在可接受范围内

### 文档更新

- [ ] **用户文档**
  - [ ] README.md 更新到最新
  - [ ] TROUBLESHOOTING.md 更新到最新
  - [ ] QUICKSTART.md 更新到最新
  - [ ] 所有示例代码测试通过

- [ ] **API 文档**
  - [ ] HTTP API 文档完整
  - [ ] WebSocket 协议文档完整
  - [ ] CLI 命令文档完整

- [ ] **开发文档**
  - [ ] 架构设计文档更新
  - [ ] 部署指南更新
  - [ ] 贡献者指南更新

### 版本管理

- [ ] **版本号更新**
  - [ ] package.json 版本号已更新
  - [ ] 使用正确的语义化版本号
    - `major`: 不兼容的 API 更改
    - `minor`: 向后兼容的功能性新增
    - `patch`: 向后兼容的问题修复

- [ ] **变更日志**
  - [ ] CHANGELOG.md 已更新
  - [ ] 包含所有重要变更
  - [ ] 变更分类正确 (Added, Changed, Fixed, Removed)
  - [ ] 包含已知问题和限制

## 发布准备 (Release Preparation)

### 构建和打包

- [ ] **清理构建环境**
  - [ ] 删除旧的构建文件 (`rm -rf dist/ tmp_build/`)
  - [ ] 清理 node_modules 缓存 (`npm cache clean --force`)

- [ ] **创建发布包**
  - [ ] 运行打包脚本: `./package-release.sh`
  - [ ] 验证发布包完整性
  - [ ] 检查文件大小是否合理
  - [ ] 验证校验和文件

- [ ] **测试发布包**
  - [ ] 在干净环境中测试安装
  - [ ] 验证所有功能正常工作
  - [ ] 测试卸载流程

### Git 管理

- [ ] **代码状态**
  - [ ] 所有更改已提交
  - [ ] 工作区干净 (`git status --porcelain`)
  - [ ] 分支正确 (应在 main/master 分支)

- [ ] **创建标签**
  - [ ] 创建 Git 标签: `./version-manager.sh tag`
  - [ ] 标签格式正确: `v1.0.0`
  - [ ] 标签消息包含版本信息

- [ ] **推送更改**
  - [ ] 推送代码到远程仓库
  - [ ] 推送标签到远程仓库

## GitHub 发布 (GitHub Release)

### 创建 Release

- [ ] **访问 GitHub**
  - [ ] 登录 GitHub 账户
  - [ ] 导航到仓库: https://github.com/cuiJY-still-in-school/coclaw

- [ ] **创建新 Release**
  - [ ] 点击 "Create a new release"
  - [ ] 选择刚才创建的标签 (如 `v1.0.0`)
  - [ ] 标题: `Coclaw v1.0.0`

- [ ] **填写 Release 说明**
  - [ ] 从 CHANGELOG.md 复制对应版本的内容
  - [ ] 添加安装说明
  - [ ] 添加系统要求
  - [ ] 添加快速开始指南
  - [ ] 添加问题反馈方式

### 上传文件

- [ ] **上传发布包**
  - [ ] 上传 tar.gz 文件: `coclaw-1.0.0.tar.gz`
  - [ ] 上传 zip 文件: `coclaw-1.0.0.zip` (如果创建了)
  - [ ] 上传校验和文件: `coclaw-1.0.0.tar.gz.sha256`

- [ ] **设置发布选项**
  - [ ] 设置为最新 Release
  - [ ] 设置为预发布 (如果是 alpha/beta 版本)
  - [ ] 添加合适的标签

## 发布后任务 (Post-release)

### 验证发布

- [ ] **下载测试**
  - [ ] 从 GitHub Release 页面下载发布包
  - [ ] 验证下载文件完整性
  - [ ] 在新环境中测试安装

- [ ] **安装测试**
  - [ ] 使用一键安装脚本测试: `curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash`
  - [ ] 验证所有 CLI 命令正常工作
  - [ ] 测试核心功能

### 文档更新

- [ ] **更新在线文档**
  - [ ] 更新项目网站 (如果有)
  - [ ] 更新 Wiki 页面
  - [ ] 更新 API 文档网站

- [ ] **社区通知**
  - [ ] 在 README 中更新最新版本信息
  - [ ] 更新相关论坛或社区帖子
  - [ ] 发送邮件通知 (如果有邮件列表)

### 监控和反馈

- [ ] **监控问题**
  - [ ] 监控 GitHub Issues 的新问题
  - [ ] 监控错误报告和崩溃日志
  - [ ] 收集用户反馈

- [ ] **准备热修复**
  - [ ] 准备 patch 版本修复紧急问题
  - [ ] 更新已知问题列表
  - [ ] 准备 FAQ 更新

## 紧急情况处理

### 发布回滚

如果发布后发现严重问题需要回滚:

1. **立即行动**
   - [ ] 在 GitHub 上将 Release 标记为预发布
   - [ ] 在 README 中添加警告
   - [ ] 通知用户已知问题

2. **修复问题**
   - [ ] 创建 hotfix 分支
   - [ ] 修复问题并测试
   - [ ] 创建新的 patch 版本

3. **重新发布**
   - [ ] 按照检查清单重新发布
   - [ ] 通知用户更新

### 安全漏洞

如果发现安全漏洞:

1. **立即响应**
   - [ ] 创建安全公告
   - [ ] 通知受影响的用户
   - [ ] 提供临时解决方案

2. **修复漏洞**
   - [ ] 在私有分支修复漏洞
   - [ ] 充分测试修复
   - [ ] 创建安全更新版本

3. **协调发布**
   - [ ] 协调所有用户同时更新
   - [ ] 提供迁移指南
   - [ ] 更新安全文档

## 版本发布模板

### GitHub Release 模板

````markdown
# Coclaw v1.0.0

## 版本信息

- **版本号**: 1.0.0
- **发布日期**: 2025-04-07
- **Node.js 要求**: v18+

## 下载

- [coclaw-1.0.0.tar.gz](coclaw-1.0.0.tar.gz) (SHA256: `abc123...`)
- [coclaw-1.0.0.zip](coclaw-1.0.0.zip) (SHA256: `def456...`)

## 安装

```bash
# 一键安装
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash

# 手动安装
wget https://github.com/cuiJY-still-in-school/coclaw/releases/download/v1.0.0/coclaw-1.0.0.tar.gz
tar -xzf coclaw-1.0.0.tar.gz
cd coclaw-1.0.0
./install.sh
```
````

## 更新内容

（从 CHANGELOG.md 复制）

## 快速开始

1. 安装 Coclaw: `./install.sh`
2. 创建 Agent: `coclaw create`
3. 启动服务器: `coclaw server`
4. 开始协作！

## 文档

- [用户手册](https://github.com/cuiJY-still-in-school/coclaw/blob/v1.0.0/README.md)
- [故障排除](https://github.com/cuiJY-still-in-school/coclaw/blob/v1.0.0/TROUBLESHOOTING.md)
- [API 文档](https://github.com/cuiJY-still-in-school/coclaw/blob/v1.0.0/docs/api.md)

## 问题反馈

- 创建 [GitHub Issue](https://github.com/cuiJY-still-in-school/coclaw/issues)
- 邮件: shortsubjayfire@gmail.com

````

### 变更日志条目模板
```markdown
## [1.0.0] - 2025-04-07

### Added
- 新功能描述
- 新增 API 端点

### Changed
- 功能改进描述
- 性能优化

### Fixed
- 问题修复描述
- 安全修复

### Removed
- 已弃用功能移除
- 过时 API 移除

### Security
- 安全更新描述
````

## 发布频率指南

### 主要版本 (Major)

- **频率**: 6-12 个月
- **时机**: 重大架构更改、不兼容的 API 变更
- **准备时间**: 2-4 周

### 次要版本 (Minor)

- **频率**: 1-3 个月
- **时机**: 新功能添加、重要改进
- **准备时间**: 1-2 周

### 修订版本 (Patch)

- **频率**: 按需 (通常 2-4 周)
- **时机**: 错误修复、安全更新
- **准备时间**: 1-3 天

### 预发布版本 (Pre-release)

- **频率**: 按需
- **时机**: 测试新功能、收集反馈
- **命名**: `1.0.0-alpha.1`, `1.0.0-beta.1`

## 质量指标

每个版本发布前应达到以下质量指标:

### 代码质量

- 测试覆盖率: > 80%
- 代码重复率: < 5%
- 静态分析警告: 0 严重警告

### 性能指标

- 启动时间: < 5 秒
- 内存使用: < 200MB (空闲时)
- 消息延迟: < 100ms (平均)

### 稳定性

- 无内存泄漏
- 无死锁或竞争条件
- 错误恢复成功率: > 95%

---

**最后更新**: 2025-04-07  
**维护者**: CuiJY (shortsubjayfire@gmail.com)

_请确保在每次发布前完整检查此清单中的所有项目。_
