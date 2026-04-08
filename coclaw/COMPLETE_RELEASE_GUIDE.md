# Coclaw v1.0.0 完整发布指南

## 🎯 当前状态

✅ **所有技术工作已完成**
✅ **代码已提交到两个分支**
✅ **发布包已创建**
✅ **文档已完善**
✅ **Git标签 v1.0.0 已存在**

## 📋 问题与解决方案

### 问题：默认分支是 `coclaw-phase5` 而不是 `master`

**解决方案**：两个分支现在包含相同的代码，我们可以直接发布。

### 问题：无法通过SSH更改GitHub设置

**解决方案**：使用GitHub API或网页界面完成发布。

## 🚀 发布方案（选择一种）

### 方案A：使用GitHub网页界面（推荐）

**步骤**：

1. **访问仓库**: https://github.com/cuiJY-still-in-school/coclaw
2. **创建Release**:
   - 点击 "Releases" → "Draft a new release"
   - 标签: `v1.0.0`
   - 目标: `master` 或 `coclaw-phase5`（两个分支代码相同）
   - 标题: `Coclaw v1.0.0`
   - 描述: 复制 `RELEASE_NOTES_v1.0.0.md` 的内容
   - 上传文件（从 `dist/` 目录）:
     - `coclaw-1.0.0.tar.gz`
     - `coclaw-1.0.0.zip`
     - `coclaw-1.0.0.tar.gz.sha256`
     - `coclaw-1.0.0.zip.sha256`
   - 点击 "Publish release"

### 方案B：使用GitHub CLI

```bash
# 安装GitHub CLI（如果未安装）
# Ubuntu/Debian: sudo apt install gh
# macOS: brew install gh

# 登录GitHub
gh auth login

# 创建Release
gh release create v1.0.0 \
  --title "Coclaw v1.0.0" \
  --notes-file RELEASE_NOTES_v1.0.0.md \
  dist/coclaw-1.0.0.tar.gz \
  dist/coclaw-1.0.0.zip \
  dist/coclaw-1.0.0.tar.gz.sha256 \
  dist/coclaw-1.0.0.zip.sha256
```

### 方案C：使用提供的脚本（需要GitHub令牌）

```bash
# 1. 创建GitHub个人访问令牌
#   访问: https://github.com/settings/tokens
#   权限: repo (全部)

# 2. 运行发布脚本
./create_github_release.sh <你的GitHub令牌>
```

## 🔧 技术细节

### 分支状态

```
coclaw-phase5 (默认分支)
  ↑
master (包含阶段6的所有工作)
```

两个分支现在包含**完全相同的代码**，因为我已经将master的更改合并到了coclaw-phase5。

### 发布包验证

```bash
# 检查发布包
ls -la dist/
# 应该看到:
# - coclaw-1.0.0.tar.gz (3.2MB)
# - coclaw-1.0.0.zip (5.0MB)
# - 校验和文件

# 验证校验和
sha256sum -c dist/coclaw-1.0.0.tar.gz.sha256
sha256sum -c dist/coclaw-1.0.0.zip.sha256
```

### 安装脚本测试

```bash
# 测试安装脚本
./install.sh --help
# 应该显示帮助信息

# 测试从GitHub安装（发布后）
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash -s -- --help
```

## 📁 文件清单

### 必须上传的文件

1. `dist/coclaw-1.0.0.tar.gz` - 主发布包
2. `dist/coclaw-1.0.0.zip` - 备用格式
3. `dist/coclaw-1.0.0.tar.gz.sha256` - 校验和
4. `dist/coclaw-1.0.0.zip.sha256` - 校验和

### 重要文档

1. `RELEASE_NOTES_v1.0.0.md` - 发布说明
2. `README.md` - 用户手册
3. `QUICKSTART.md` - 快速开始
4. `API.md` - API文档

## 🎪 发布后验证

### 1. 检查Release页面

访问: https://github.com/cuiJY-still-in-school/coclaw/releases/tag/v1.0.0
验证:

- [ ] Release标题正确
- [ ] 发布说明完整
- [ ] 所有文件可下载
- [ ] 安装命令正确

### 2. 测试安装

```bash
# 方法1: 使用curl
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash -s -- --help

# 方法2: 下载后安装
wget https://github.com/cuiJY-still-in-school/coclaw/releases/download/v1.0.0/coclaw-1.0.0.tar.gz
tar -xzf coclaw-1.0.0.tar.gz
cd coclaw-1.0.0
./install.sh --help
```

### 3. 功能测试

```bash
# 解压发布包
tar -xzf dist/coclaw-1.0.0.tar.gz
cd coclaw-1.0.0

# 测试基本功能
./install.sh --help
npm test
npm run lint
```

## 🔄 可选：更改默认分支

如果需要将默认分支改为 `master`：

### 方法1：GitHub网页界面

1. 访问仓库设置: Settings → Branches
2. 在 "Default branch" 部分，点击编辑按钮
3. 选择 `master` 分支
4. 点击 "Update"
5. （可选）删除 `coclaw-phase5` 分支

### 方法2：使用脚本

```bash
# 需要GitHub令牌
./change_default_branch.sh <你的GitHub令牌>
```

## 📞 故障排除

### 问题：无法创建Release

**原因**: 权限不足或标签已存在
**解决**:

1. 确保有仓库的写入权限
2. 检查标签 `v1.0.0` 是否已存在
3. 使用网页界面创建

### 问题：安装脚本不工作

**原因**: GitHub URL错误或网络问题
**解决**:

1. 检查URL: https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh
2. 测试可访问性: `curl -I <URL>`
3. 使用下载的本地文件测试

### 问题：分支冲突

**原因**: 两个分支有差异
**解决**:

1. 两个分支现在已同步，代码相同
2. 使用任意分支创建Release
3. 发布后可以统一分支

## 🏁 完成标志

发布完成后，你应该看到：

- ✅ GitHub上有 v1.0.0 Release
- ✅ 发布包可以下载
- ✅ 安装脚本可以运行
- ✅ 所有文档可访问
- ✅ 代码测试通过

## 📢 发布公告模板

````markdown
🎉 **Coclaw v1.0.0 正式发布！**

基于 OpenClaw 的局域网 AI 协作工具。

**主要功能：**

- 🤖 多 Agent 协作系统
- 📁 安全文件传输
- 🌐 网络自动发现
- 🛠️ 完整的 CLI 界面

**安装：**

```bash
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash
```
````

**快速开始：**

1. `./install.sh`
2. `coclaw create`
3. `coclaw server`
4. `coclaw agent <id> chat`

**文档：**

- 用户手册: https://github.com/cuiJY-still-in-school/coclaw#readme
- API文档: https://github.com/cuiJY-still-in-school/coclaw/blob/main/API.md

**下载：** https://github.com/cuiJY-still-in-school/coclaw/releases/tag/v1.0.0

```

---

**最后更新**: 2025年4月8日
**版本**: v1.0.0
**状态**: ✅ 准备发布
```
