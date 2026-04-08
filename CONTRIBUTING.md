# 贡献指南

感谢您对 Coclaw 项目的关注！我们欢迎各种形式的贡献，包括但不限于代码贡献、文档改进、问题报告和功能建议。

## 行为准则

请阅读并遵守我们的 [行为准则](CODE_OF_CONDUCT.md)。我们致力于为所有贡献者提供一个友好、尊重和包容的环境。

## 如何开始

### 1. 寻找贡献点

- **初学者友好**: 查看标记为 `good-first-issue` 的问题
- **文档改进**: 检查文档中的错别字、不清晰的部分或缺失的内容
- **功能请求**: 查看标记为 `enhancement` 的问题
- **Bug 修复**: 查看标记为 `bug` 的问题

### 2. 设置开发环境

#### 前提条件

- Node.js 14.0 或更高版本
- npm 6.0 或更高版本
- Git

#### 克隆仓库

```bash
git clone https://github.com/cuiJY-still-in-school/coclaw.git
cd coclaw
```

#### 安装依赖

```bash
npm install
```

#### 运行测试

```bash
npm test
```

#### 运行开发版本

```bash
npm run dev
```

### 3. 项目结构

```
coclaw/
├── bin/                    # CLI 入口点
├── lib/                   # 核心库代码
│   ├── commands/         # CLI 命令实现
│   ├── server/          # 服务器相关代码
│   └── utils/           # 工具函数
├── ui/                   # 用户界面组件
├── tests/               # 测试文件
├── docs/                # 文档
├── examples/            # 示例代码
└── scripts/             # 构建和部署脚本
```

## 贡献流程

### 1. 创建 Issue

在开始工作之前，请先创建一个 Issue 来描述您想要解决的问题或添加的功能。这有助于：

- 避免重复工作
- 获得项目维护者的反馈
- 确保您的贡献符合项目方向

**Issue 模板**:

```
## 问题描述
[清晰描述问题或功能需求]

## 重现步骤（如果是 Bug）
1.
2.
3.

## 预期行为
[描述您期望看到的行为]

## 实际行为
[描述实际看到的行为]

## 环境信息
- 操作系统: [例如: macOS 12.0]
- Node.js 版本: [例如: v16.13.0]
- Coclaw 版本: [例如: v1.0.0]

## 附加信息
[任何其他相关信息]
```

### 2. Fork 仓库

1. 点击 GitHub 页面右上角的 "Fork" 按钮
2. 克隆您的 fork 到本地:

```bash
git clone https://github.com/your-username/coclaw.git
cd coclaw
```

### 3. 创建分支

为您的更改创建一个新的分支:

```bash
git checkout -b feature/your-feature-name
# 或
git checkout -b fix/issue-number-description
```

**分支命名约定**:

- `feature/`: 新功能
- `fix/`: Bug 修复
- `docs/`: 文档更新
- `test/`: 测试相关
- `chore/`: 维护任务

### 4. 进行更改

#### 代码风格

- 使用 2 个空格缩进
- 使用单引号
- 遵循现有的代码风格
- 添加适当的注释

#### 提交消息规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范:

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

**类型**:

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具的变动

**示例**:

```
feat: 添加文件传输功能

- 实现文件分块传输
- 添加断点续传支持
- 更新相关文档

Closes #123
```

### 5. 运行测试

在提交之前，请确保所有测试通过:

```bash
npm test
```

如果添加了新功能，请添加相应的测试:

```bash
npm run test:watch  # 开发时使用
```

### 6. 提交更改

```bash
git add .
git commit -m "feat: 添加新功能描述"
```

### 7. 推送更改

```bash
git push origin feature/your-feature-name
```

### 8. 创建 Pull Request

1. 访问您的 GitHub fork
2. 点击 "Compare & pull request"
3. 填写 PR 描述模板
4. 等待代码审查

## 开发指南

### 代码质量

#### 1. 代码检查

```bash
npm run lint          # 运行 ESLint
npm run lint:fix      # 自动修复可修复的问题
```

#### 2. 类型检查

```bash
npm run typecheck     # 运行 TypeScript 类型检查（如果使用 TypeScript）
```

#### 3. 测试覆盖率

```bash
npm run test:coverage # 生成测试覆盖率报告
```

目标覆盖率:

- 语句覆盖率: > 80%
- 分支覆盖率: > 70%
- 函数覆盖率: > 80%
- 行覆盖率: > 80%

### 文档要求

#### 1. 代码注释

- 公共 API 必须有 JSDoc 注释
- 复杂算法必须有解释性注释
- 使用英文注释（代码中的注释）

#### 2. 用户文档

- 所有新功能必须更新 README.md
- 重大更改必须更新 CHANGELOG.md
- API 更改必须更新 API.md

#### 3. 内联文档

```javascript
/**
 * 发送消息到指定 Agent
 * @param {string} agentId - 目标 Agent ID
 * @param {Object} message - 消息对象
 * @param {string} message.content - 消息内容
 * @param {string} [message.type='text'] - 消息类型
 * @returns {Promise<Object>} 发送结果
 * @throws {Error} 如果发送失败
 */
async function sendMessage(agentId, message) {
  // 实现代码
}
```

### 测试指南

#### 1. 单元测试

- 测试文件放在 `tests/unit/` 目录
- 使用 Jest 测试框架
- 每个测试用例应该独立

```javascript
describe("Config Manager", () => {
  test("should load default config", () => {
    const config = new ConfigManager();
    expect(config.get("server.port")).toBe(18790);
  });
});
```

#### 2. 集成测试

- 测试文件放在 `tests/integration/` 目录
- 测试多个组件的交互
- 使用真实的文件系统和网络

#### 3. 端到端测试

- 测试文件放在 `tests/e2e/` 目录
- 模拟真实用户场景
- 可能需要较长的运行时间

### 性能考虑

#### 1. 内存使用

- 避免内存泄漏
- 及时释放资源
- 使用流处理大文件

#### 2. 响应时间

- 异步处理耗时操作
- 使用缓存减少重复计算
- 优化数据库查询（如果使用）

#### 3. 并发处理

- 使用连接池
- 实现背压控制
- 限制并发请求数

## 特定领域的贡献

### CLI 开发

#### 命令结构

```javascript
// lib/commands/your-command.js
module.exports = {
  name: "your-command",
  description: "命令描述",

  async run(options) {
    // 命令实现
  },

  // 可选: 命令选项定义
  options: [
    {
      name: "--verbose",
      description: "显示详细输出",
    },
  ],
};
```

#### 用户交互

- 使用 `ui/prompts.js` 进行用户输入
- 提供清晰的进度反馈
- 处理用户取消操作

### 服务器开发

#### WebSocket 处理

```javascript
// lib/server/websocket-handler.js
class WebSocketHandler {
  handleConnection(ws, request) {
    // 处理新连接
  }

  handleMessage(ws, message) {
    // 处理收到的消息
  }

  handleClose(ws, code, reason) {
    // 处理连接关闭
  }
}
```

#### HTTP 路由

```javascript
// lib/server/http-routes.js
app.get("/api/v1/status", (req, res) => {
  res.json({ status: "ok" });
});
```

### Agent 管理

#### OpenClaw 集成

- 使用 `lib/openclaw.js` 与 OpenClaw 交互
- 处理进程启动和停止
- 解析 OpenClaw 输出

#### 状态管理

- 跟踪 Agent 生命周期状态
- 实现健康检查
- 处理故障恢复

## 审查流程

### 1. 代码审查标准

#### 功能性

- 代码是否正确实现了需求？
- 是否有明显的 Bug？
- 是否处理了边界情况？

#### 可读性

- 代码是否易于理解？
- 命名是否清晰？
- 是否有适当的注释？

#### 可维护性

- 代码是否遵循项目约定？
- 是否有适当的测试？
- 是否更新了相关文档？

#### 性能

- 代码是否高效？
- 是否有潜在的性能问题？
- 是否考虑了内存使用？

### 2. 审查流程

1. **自动检查**: CI/CD 流水线运行测试和代码检查
2. **维护者审查**: 至少需要一名维护者批准
3. **合并前检查**: 确保所有检查通过
4. **合并**: 使用 squash merge 保持提交历史整洁

### 3. 常见反馈

#### 需要改进的情况

- 缺少测试或测试不充分
- 代码风格不符合项目约定
- 文档不完整或缺失
- 性能问题或内存泄漏

#### 直接拒绝的情况

- 安全漏洞
- 破坏性更改（没有充分的理由）
- 与项目目标不符的功能
- 重复的功能实现

## 发布流程

### 1. 版本管理

我们使用 [语义化版本](https://semver.org/):

- `MAJOR`: 不兼容的 API 修改
- `MINOR`: 向下兼容的功能性新增
- `PATCH`: 向下兼容的问题修正

### 2. 发布检查清单

在发布新版本前，请确保:

- [ ] 所有测试通过
- [ ] 代码检查通过
- [ ] 文档已更新
- [ ] CHANGELOG.md 已更新
- [ ] 版本号已更新
- [ ] 发布说明已准备

### 3. 发布步骤

1. 更新版本号:

```bash
npm version patch  # 或 minor, major
```

2. 更新 CHANGELOG.md

3. 创建 Git 标签:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
```

4. 推送到 GitHub:

```bash
git push origin main --tags
```

5. 创建 GitHub Release

## 社区角色

### 贡献者级别

#### 1. 新手贡献者

- 完成第一个 Pull Request
- 修复简单的 Bug
- 改进文档

#### 2. 活跃贡献者

- 多次成功贡献
- 帮助审查其他人的 PR
- 参与问题讨论

#### 3. 核心贡献者

- 对项目有深入了解
- 负责特定模块
- 有合并权限

#### 4. 维护者

- 项目决策权
- 发布管理权限
- 社区管理责任

### 如何成为维护者

1. 持续贡献 6 个月以上
2. 对项目有深入了解
3. 得到现有维护者的提名
4. 通过社区投票

## 获取帮助

### 1. 讨论区

- [GitHub Discussions](https://github.com/cuiJY-still-in-school/coclaw/discussions)
- 用于功能讨论、问题咨询和社区交流

### 2. 即时通讯

- [Discord 服务器](https://discord.gg/your-invite-link)
- 用于实时交流和协作

### 3. 邮件列表

- 开发公告: coclaw-dev@googlegroups.com
- 用户支持: coclaw-users@googlegroups.com

### 4. 办公时间

- 每周三 14:00-16:00 (UTC)
- 视频会议链接在讨论区公布

## 许可证

通过向本项目贡献代码，您同意您的贡献将使用与项目相同的许可证:

- 代码: MIT License
- 文档: Creative Commons Attribution 4.0 International

## 致谢

感谢所有贡献者的努力！您的每一份贡献都让 Coclaw 变得更好。

### 特别感谢

- 项目创始人和维护者
- 核心贡献者团队
- 文档翻译志愿者
- 测试和反馈用户

---

_最后更新: 2024-01-01_
_版本: v1.0_
