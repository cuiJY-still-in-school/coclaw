#!/bin/bash

# ============================================================================
# 更改GitHub仓库默认分支脚本
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
NEW_DEFAULT_BRANCH="master"

log_info "正在更改仓库默认分支..."
log_info "仓库: $REPO_OWNER/$REPO_NAME"
log_info "新默认分支: $NEW_DEFAULT_BRANCH"

# 检查当前默认分支
log_info "检查当前默认分支..."
CURRENT_DEFAULT=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME" | \
    grep -o '"default_branch":"[^"]*"' | cut -d'"' -f4)

if [ -z "$CURRENT_DEFAULT" ]; then
    log_error "无法获取当前默认分支"
    exit 1
fi

log_info "当前默认分支: $CURRENT_DEFAULT"

if [ "$CURRENT_DEFAULT" = "$NEW_DEFAULT_BRANCH" ]; then
    log_success "默认分支已经是 $NEW_DEFAULT_BRANCH，无需更改"
    exit 0
fi

# 检查新分支是否存在
log_info "检查分支 $NEW_DEFAULT_BRANCH 是否存在..."
BRANCH_EXISTS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/branches/$NEW_DEFAULT_BRANCH" | \
    grep -o '"name":"[^"]*"' | cut -d'"' -f4)

if [ -z "$BRANCH_EXISTS" ]; then
    log_error "分支 $NEW_DEFAULT_BRANCH 不存在"
    exit 1
fi

log_success "分支 $NEW_DEFAULT_BRANCH 存在"

# 更改默认分支
log_info "正在更改默认分支..."
RESPONSE=$(curl -s -X PATCH \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -d "{\"default_branch\":\"$NEW_DEFAULT_BRANCH\"}" \
    "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME")

# 检查响应
if echo "$RESPONSE" | grep -q '"default_branch":"master"'; then
    log_success "默认分支已成功更改为 $NEW_DEFAULT_BRANCH"
    
    # 现在可以安全地删除旧分支
    log_info "是否要删除旧分支 $CURRENT_DEFAULT？(y/n)"
    read -r DELETE_OLD
    
    if [ "$DELETE_OLD" = "y" ] || [ "$DELETE_OLD" = "Y" ]; then
        log_info "正在删除分支 $CURRENT_DEFAULT..."
        
        # 检查是否有未合并的更改
        MERGE_STATUS=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
            "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/compare/master...$CURRENT_DEFAULT" | \
            grep -o '"status":"[^"]*"' | cut -d'"' -f4)
        
        if [ "$MERGE_STATUS" = "identical" ] || [ "$MERGE_STATUS" = "ahead" ]; then
            # 删除分支
            curl -s -X DELETE \
                -H "Authorization: token $GITHUB_TOKEN" \
                "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/git/refs/heads/$CURRENT_DEFAULT"
            
            log_success "分支 $CURRENT_DEFAULT 已删除"
        else
            log_warn "分支 $CURRENT_DEFAULT 与 master 有差异，建议先合并"
            log_warn "状态: $MERGE_STATUS"
            log_warn "跳过删除操作"
        fi
    fi
else
    log_error "更改默认分支失败"
    echo "响应: $RESPONSE"
    exit 1
fi

log_success "完成！"
echo ""
echo "下一步:"
echo "1. 访问 https://github.com/$REPO_OWNER/$REPO_NAME 验证更改"
echo "2. 创建 GitHub Release"
echo "3. 测试安装脚本"