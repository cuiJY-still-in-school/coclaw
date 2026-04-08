#!/bin/bash

# ============================================================================
# 创建GitHub Release脚本
# 需要GitHub个人访问令牌
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# 检查参数
if [ $# -lt 1 ]; then
    echo "用法: $0 <github-personal-access-token>"
    echo ""
    echo "步骤:"
    echo "1. 创建GitHub个人访问令牌:"
    echo "   - 访问 https://github.com/settings/tokens"
    echo "   - 点击 'Generate new token'"
    echo "   - 选择 'repo' 权限"
    echo "   - 复制令牌"
    echo "2. 运行脚本: $0 <你的令牌>"
    exit 1
fi

GITHUB_TOKEN="$1"
REPO_OWNER="cuiJY-still-in-school"
REPO_NAME="coclaw"
TAG_NAME="v1.0.0"
RELEASE_NAME="Coclaw v1.0.0"

# 读取发布说明
if [ -f "RELEASE_NOTES_v1.0.0.md" ]; then
    RELEASE_BODY=$(cat RELEASE_NOTES_v1.0.0.md)
else
    RELEASE_BODY="# Coclaw v1.0.0
    
第一个稳定版本发布！基于 OpenClaw 的局域网 AI 协作工具。

## 主要功能
- 🤖 多 Agent 协作系统
- 📁 安全文件传输
- 🌐 网络自动发现
- 🛠️ 完整的 CLI 界面

## 安装方式
\`\`\`bash
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v1.0.0/install.sh | bash
\`\`\`"
fi

log_info "正在创建 GitHub Release..."
log_info "仓库: $REPO_OWNER/$REPO_NAME"
log_info "标签: $TAG_NAME"
log_info "发布名称: $RELEASE_NAME"

# 检查标签是否存在
log_info "检查标签 $TAG_NAME 是否存在..."
TAG_EXISTS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/git/refs/tags/$TAG_NAME" | \
    grep -o '"ref":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TAG_EXISTS" ]; then
    log_error "标签 $TAG_NAME 不存在"
    log_info "正在创建标签..."
    
    # 获取最新提交的SHA
    LATEST_COMMIT=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/git/refs/heads/master" | \
        grep -o '"sha":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$LATEST_COMMIT" ]; then
        # 尝试coclaw-phase5分支
        LATEST_COMMIT=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/git/refs/heads/coclaw-phase5" | \
            grep -o '"sha":"[^"]*"' | cut -d'"' -f4)
    fi
    
    if [ -z "$LATEST_COMMIT" ]; then
        log_error "无法获取最新提交"
        exit 1
    fi
    
    # 创建标签
    TAG_RESPONSE=$(curl -s -X POST \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -d "{\"ref\":\"refs/tags/$TAG_NAME\",\"sha\":\"$LATEST_COMMIT\"}" \
        "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/git/refs")
    
    if echo "$TAG_RESPONSE" | grep -q '"ref":"refs/tags/v1.0.0"'; then
        log_success "标签 $TAG_NAME 创建成功"
    else
        log_error "创建标签失败"
        echo "响应: $TAG_RESPONSE"
        exit 1
    fi
else
    log_success "标签 $TAG_NAME 已存在"
fi

# 创建Release
log_info "正在创建Release..."
RELEASE_RESPONSE=$(curl -s -X POST \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{
        \"tag_name\": \"$TAG_NAME\",
        \"target_commitish\": \"master\",
        \"name\": \"$RELEASE_NAME\",
        \"body\": $(echo -n "$RELEASE_BODY" | jq -Rs .),
        \"draft\": false,
        \"prerelease\": false
    }" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases")

# 检查响应
RELEASE_ID=$(echo "$RELEASE_RESPONSE" | grep -o '"id":[0-9]*' | cut -d':' -f2)
UPLOAD_URL=$(echo "$RELEASE_RESPONSE" | grep -o '"upload_url":"[^"]*"' | cut -d'"' -f4)

if [ -n "$RELEASE_ID" ] && [ -n "$UPLOAD_URL" ]; then
    log_success "Release 创建成功！ID: $RELEASE_ID"
    
    # 上传资产文件
    UPLOAD_URL=$(echo "$UPLOAD_URL" | sed 's/{.*}//')
    
    # 上传文件
    upload_asset() {
        local file_path="$1"
        local file_name=$(basename "$file_path")
        
        if [ ! -f "$file_path" ]; then
            log_warn "文件不存在: $file_path"
            return 1
        fi
        
        log_info "上传文件: $file_name"
        
        curl -s -X POST \
            -H "Authorization: token $GITHUB_TOKEN" \
            -H "Content-Type: application/octet-stream" \
            --data-binary @"$file_path" \
            "$UPLOAD_URL?name=$file_name"
        
        if [ $? -eq 0 ]; then
            log_success "文件上传成功: $file_name"
        else
            log_error "文件上传失败: $file_name"
        fi
    }
    
    # 上传发布包文件
    if [ -d "dist" ]; then
        log_info "上传发布包文件..."
        
        upload_asset "dist/coclaw-1.0.0.tar.gz"
        upload_asset "dist/coclaw-1.0.0.zip"
        upload_asset "dist/coclaw-1.0.0.tar.gz.sha256"
        upload_asset "dist/coclaw-1.0.0.zip.sha256"
    else
        log_warn "dist目录不存在，跳过文件上传"
    fi
    
    log_success "GitHub Release 创建完成！"
    echo ""
    echo "Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$TAG_NAME"
    echo ""
    echo "下一步:"
    echo "1. 访问上面的URL验证Release"
    echo "2. 测试安装脚本:"
    echo "   curl -fsSL https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/$TAG_NAME/install.sh | bash --help"
    echo "3. 更新文档中的链接"
    
else
    log_error "创建Release失败"
    echo "响应: $RELEASE_RESPONSE"
    exit 1
fi