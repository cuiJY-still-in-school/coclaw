# 如何完成 Coclaw v1.0.0 发布

## 当前状态

✅ **所有开发工作已完成**
✅ **发布包已创建**
✅ **文档已完善**
✅ **代码已提交**
✅ **Git 标签已创建**

## 需要手动完成的步骤

### 步骤1：访问 GitHub 仓库

1. 打开 https://github.com/cuiJY-still-in-school/coclaw
2. 登录你的 GitHub 账户

### 步骤2：清理分支（如果需要）

如果 `coclaw-phase5` 分支存在且不是默认分支：

1. 进入仓库设置 (Settings → Branches)
2. 确保 `master` 是默认分支
3. 删除 `coclaw-phase5` 分支

### 步骤3：创建 GitHub Release

1. 点击 "Releases" 标签页
2. 点击 "Draft a new release"
3. 在 "Choose a tag" 中选择 `v1.0.0`
4. 标题输入: `Coclaw v1.0.0`
5. 复制 `RELEASE_NOTES_v1.0.0.md` 的内容到描述框
6. 上传以下文件（从 `dist/` 目录）：
   - `coclaw-1.0.0.tar.gz`
   - `coclaw-1.0.0.zip`
   - `coclaw-1.0.0.tar.gz.sha256`
   - `coclaw-1.0.0.zip.sha256`
7. 点击 "Publish release"

### 步骤4：验证安装

测试安装脚本是否正常工作：

```bash
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash -s -- --help
```

应该显示安装脚本的帮助信息。

### 步骤5：更新 README（可选）

如果需要，更新 README.md 中的安装说明：

````markdown
## 安装

```bash
# 使用安装脚本
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash
```
````

````

## 快速命令参考

### 创建 Release（使用 GitHub CLI）
如果你有 GitHub CLI 安装：
```bash
gh release create v1.0.0 \
  --title "Coclaw v1.0.0" \
  --notes-file RELEASE_NOTES_v1.0.0.md \
  dist/coclaw-1.0.0.tar.gz \
  dist/coclaw-1.0.0.zip \
  dist/coclaw-1.0.0.tar.gz.sha256 \
  dist/coclaw-1.0.0.zip.sha256
````

### 检查当前状态

```bash
# 检查版本
node -e "console.log(require('./package.json').version)"

# 检查标签
git tag -l

# 检查发布包
ls -la dist/

# 运行测试
npm test
```

## 发布后验证

1. **Release 页面**：确认 https://github.com/cuiJY-still-in-school/coclaw/releases/tag/v1.0.0 可以访问
2. **安装脚本**：确认可以从 GitHub 直接运行
3. **文档链接**：确认所有文档链接正常工作
4. **功能测试**：快速测试核心功能

## 问题解决

### 如果无法删除分支

如果 `coclaw-phase5` 是默认分支：

1. 先将默认分支改为 `master`
2. 等待 GitHub 处理
3. 然后删除 `coclaw-phase5` 分支

### 如果 Release 创建失败

1. 检查是否有权限创建 Release
2. 检查标签 `v1.0.0` 是否存在
3. 检查网络连接

### 如果安装脚本不工作

1. 检查 GitHub URL 是否正确
2. 检查文件权限：`chmod +x install.sh`
3. 检查依赖：Node.js 版本等

## 完成标志

发布完成后，你应该看到：

- ✅ GitHub 上有 v1.0.0 Release
- ✅ 发布包可以下载
- ✅ 安装脚本可以运行
- ✅ 所有文档可访问
- ✅ 代码测试通过

---

**完成时间**: 2025年4月8日  
**版本**: v1.0.0  
**状态**: 等待最后一步发布操作
