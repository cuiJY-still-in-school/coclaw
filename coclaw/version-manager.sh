#!/bin/bash

# ============================================================================
# Coclaw 版本管理脚本
# 用于管理版本号、创建标签和准备发布
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

# 日志函数
log() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_header() {
    echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$1${NC}"
}

# 显示帮助
show_help() {
    echo -e "${BOLD}Coclaw 版本管理脚本${NC}\n"
    echo "用法: ./version-manager.sh [命令] [选项]"
    echo ""
    echo "命令:"
    echo "  current                  显示当前版本"
    echo "  bump <type>              bump 版本号"
    echo "  tag                     创建 Git 标签"
    echo "  release                 准备发布"
    echo "  changelog               更新 CHANGELOG"
    echo ""
    echo "选项:"
    echo "  -h, --help              显示此帮助信息"
    echo "  -v, --version <ver>     指定版本号"
    echo "  -m, --message <msg>     提交消息"
    echo "  --dry-run               模拟运行"
    echo ""
    echo "版本类型 (bump 命令):"
    echo "  major                   主版本号 (1.0.0 -> 2.0.0)"
    echo "  minor                   次版本号 (1.0.0 -> 1.1.0)"
    echo "  patch                   修订号 (1.0.0 -> 1.0.1)"
    echo "  prerelease              预发布版本 (1.0.0 -> 1.0.1-alpha.1)"
    echo ""
    echo "示例:"
    echo "  ./version-manager.sh current          # 显示当前版本"
    echo "  ./version-manager.sh bump patch       # 增加修订号"
    echo "  ./version-manager.sh tag              # 创建 Git 标签"
    echo "  ./version-manager.sh release          # 准备发布"
    echo "  ./version-manager.sh changelog        # 更新变更日志"
    echo ""
}

# 获取当前版本
get_current_version() {
    if [ -f "package.json" ]; then
        node -p "require('./package.json').version"
    else
        log_error "package.json 未找到"
        exit 1
    fi
}

# 显示当前版本
show_current_version() {
    local version=$(get_current_version)
    
    echo -e "${CYAN}${BOLD}"
    echo "========================================"
    echo "    Coclaw 版本信息"
    echo "========================================"
    echo -e "${NC}"
    
    echo -e "${BOLD}当前版本:${NC} ${GREEN}$version${NC}"
    echo ""
    
    # 解析版本号
    local major=$(echo $version | cut -d. -f1)
    local minor=$(echo $version | cut -d. -f2)
    local patch=$(echo $version | cut -d. -f3 | cut -d- -f1)
    
    echo -e "${BOLD}版本组成:${NC}"
    echo "  - 主版本号 (Major): $major"
    echo "  - 次版本号 (Minor): $minor"
    echo "  - 修订号 (Patch): $patch"
    
    # 检查是否为预发布版本
    if [[ $version == *"-"* ]]; then
        local prerelease=$(echo $version | cut -d- -f2)
        echo "  - 预发布版本: $prerelease"
    fi
    
    echo ""
    
    # 显示 Git 状态
    if command -v git >/dev/null 2>&1; then
        echo -e "${BOLD}Git 状态:${NC}"
        git status --short
    fi
}

# 更新 package.json 版本
update_package_version() {
    local new_version=$1
    local dry_run=${2:-false}
    
    if [ "$dry_run" = true ]; then
        log "模拟: 更新 package.json 版本为 $new_version"
        return
    fi
    
    if [ ! -f "package.json" ]; then
        log_error "package.json 未找到"
        exit 1
    fi
    
    # 使用 Node.js 更新版本
    node -e "
        const fs = require('fs');
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        packageJson.version = '$new_version';
        fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2) + '\n');
    "
    
    if [ $? -eq 0 ]; then
        log_success "package.json 版本已更新为 $new_version"
    else
        log_error "更新 package.json 失败"
        exit 1
    fi
}

# 计算新版本号
calculate_new_version() {
    local current_version=$1
    local bump_type=$2
    
    # 解析当前版本
    local major=$(echo $current_version | cut -d. -f1)
    local minor=$(echo $current_version | cut -d. -f2)
    local patch=$(echo $current_version | cut -d. -f3 | cut -d- -f1)
    local prerelease=$(echo $current_version | cut -d- -f2 2>/dev/null)
    
    case $bump_type in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            prerelease=""
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            prerelease=""
            ;;
        patch)
            patch=$((patch + 1))
            prerelease=""
            ;;
        prerelease)
            if [ -z "$prerelease" ]; then
                # 第一次预发布
                patch=$((patch + 1))
                prerelease="alpha.1"
            else
                # 增加预发布版本号
                local pre_type=$(echo $prerelease | cut -d. -f1)
                local pre_num=$(echo $prerelease | cut -d. -f2)
                if [ -z "$pre_num" ] || [ "$pre_num" = "$prerelease" ]; then
                    pre_num=1
                else
                    pre_num=$((pre_num + 1))
                fi
                prerelease="$pre_type.$pre_num"
            fi
            ;;
        *)
            log_error "未知的版本类型: $bump_type"
            show_help
            exit 1
            ;;
    esac
    
    # 构建新版本号
    local new_version="$major.$minor.$patch"
    if [ -n "$prerelease" ]; then
        new_version="$new_version-$prerelease"
    fi
    
    echo "$new_version"
}

# bump 版本号
bump_version() {
    local bump_type=$1
    local dry_run=${2:-false}
    
    log_header "Bump 版本号 ($bump_type)"
    
    # 获取当前版本
    local current_version=$(get_current_version)
    log "当前版本: $current_version"
    
    # 计算新版本
    local new_version=$(calculate_new_version "$current_version" "$bump_type")
    log "新版本: $new_version"
    
    if [ "$dry_run" = true ]; then
        log "模拟: 版本将从 $current_version 更新到 $new_version"
        return
    fi
    
    # 更新 package.json
    update_package_version "$new_version" false
    
    log_success "版本已更新: $current_version -> $new_version"
}

# 创建 Git 标签
create_git_tag() {
    local version=$1
    local message=$2
    local dry_run=${3:-false}
    
    log_header "创建 Git 标签"
    
    if ! command -v git >/dev/null 2>&1; then
        log_error "git 命令未找到"
        exit 1
    fi
    
    # 检查 Git 状态
    if [ -n "$(git status --porcelain)" ]; then
        log_warn "工作区有未提交的更改"
        git status --short
        echo ""
        read -p "是否继续创建标签？(y/N): " response
        if [[ ! $response =~ ^[Yy]$ ]]; then
            log_info "操作已取消"
            exit 0
        fi
    fi
    
    # 设置标签消息
    if [ -z "$message" ]; then
        message="Release v$version"
    fi
    
    local tag_name="v$version"
    
    log "标签名称: $tag_name"
    log "标签消息: $message"
    
    if [ "$dry_run" = true ]; then
        log "模拟: git tag -a $tag_name -m \"$message\""
        log "模拟: git push origin $tag_name"
        return
    fi
    
    # 创建标签
    git tag -a "$tag_name" -m "$message"
    
    if [ $? -eq 0 ]; then
        log_success "Git 标签创建成功: $tag_name"
    else
        log_error "Git 标签创建失败"
        exit 1
    fi
    
    # 推送标签
    log "推送标签到远程仓库..."
    git push origin "$tag_name"
    
    if [ $? -eq 0 ]; then
        log_success "标签已推送到远程仓库"
    else
        log_error "标签推送失败"
        exit 1
    fi
}

# 更新变更日志
update_changelog() {
    local version=$1
    local dry_run=${2:-false}
    
    log_header "更新变更日志"
    
    if [ ! -f "CHANGELOG.md" ]; then
        log_error "CHANGELOG.md 未找到"
        exit 1
    fi
    
    # 获取当前日期
    local release_date=$(date +%Y-%m-%d)
    
    log "版本: $version"
    log "发布日期: $release_date"
    
    if [ "$dry_run" = true ]; then
        log "模拟: 更新 CHANGELOG.md"
        return
    fi
    
    # 创建临时文件
    local temp_file=$(mktemp)
    
    # 读取并更新 CHANGELOG
    local in_unreleased_section=false
    local unreleased_content=""
    
    while IFS= read -r line; do
        if [[ $line == "## [Unreleased]" ]]; then
            in_unreleased_section=true
            unreleased_content=""
            echo "$line" >> "$temp_file"
            continue
        fi
        
        if $in_unreleased_section; then
            if [[ $line == "## ["* ]]; then
                # 到达下一个版本章节，插入新版本
                echo "" >> "$temp_file"
                echo "## [$version] - $release_date" >> "$temp_file"
                echo "" >> "$temp_file"
                if [ -n "$unreleased_content" ]; then
                    echo "$unreleased_content" >> "$temp_file"
                else
                    echo "### Added" >> "$temp_file"
                    echo "- Initial release" >> "$temp_file"
                    echo "" >> "$temp_file"
                fi
                echo "" >> "$temp_file"
                in_unreleased_section=false
            else
                unreleased_content+="$line"$'\n'
                continue
            fi
        fi
        
        echo "$line" >> "$temp_file"
    done < "CHANGELOG.md"
    
    # 如果文件结束还在 Unreleased 章节
    if $in_unreleased_section; then
        echo "" >> "$temp_file"
        echo "## [$version] - $release_date" >> "$temp_file"
        echo "" >> "$temp_file"
        if [ -n "$unreleased_content" ]; then
            echo "$unreleased_content" >> "$temp_file"
        else
            echo "### Added" >> "$temp_file"
            echo "- Initial release" >> "$temp_file"
            echo "" >> "$temp_file"
        fi
    fi
    
    # 替换原文件
    mv "$temp_file" "CHANGELOG.md"
    
    log_success "变更日志已更新"
}

# 准备发布
prepare_release() {
    local version=$1
    local message=$2
    local dry_run=${3:-false}
    
    log_header "准备发布 v$version"
    
    # 检查版本号
    if [ -z "$version" ]; then
        version=$(get_current_version)
    fi
    
    log "发布版本: $version"
    
    if [ "$dry_run" = true ]; then
        log "模拟发布流程:"
        log "  1. 检查 Git 状态"
        log "  2. 更新变更日志"
        log "  3. 提交更改"
        log "  4. 创建 Git 标签"
        log "  5. 推送更改和标签"
        return
    fi
    
    # 1. 检查 Git 状态
    if ! command -v git >/dev/null 2>&1; then
        log_error "git 命令未找到"
        exit 1
    fi
    
    log "检查 Git 状态..."
    if [ -n "$(git status --porcelain)" ]; then
        log_warn "工作区有未提交的更改:"
        git status --short
        echo ""
        read -p "是否提交这些更改？(y/N): " response
        if [[ $response =~ ^[Yy]$ ]]; then
            git add .
            git commit -m "Prepare release v$version"
            log_success "更改已提交"
        fi
    fi
    
    # 2. 更新变更日志
    update_changelog "$version" false
    
    # 3. 提交变更日志
    log "提交变更日志..."
    git add CHANGELOG.md
    git commit -m "Update CHANGELOG for v$version"
    
    # 4. 创建 Git 标签
    if [ -z "$message" ]; then
        message="Release v$version"
    fi
    create_git_tag "$version" "$message" false
    
    # 5. 推送更改
    log "推送更改到远程仓库..."
    git push origin main
    
    if [ $? -eq 0 ]; then
        log_success "更改已推送到远程仓库"
    else
        log_error "推送更改失败"
        exit 1
    fi
    
    log_success "发布准备完成"
    echo ""
    echo -e "${GREEN}${BOLD}下一步:${NC}"
    echo "1. 创建发布包: ./package-release.sh"
    echo "2. 在 GitHub 创建 Release"
    echo "3. 上传发布包到 GitHub Release"
    echo "4. 发布公告"
}

# 主函数
main() {
    # 显示标题
    echo -e "${CYAN}${BOLD}"
    echo "========================================"
    echo "    Coclaw 版本管理器"
    echo "========================================"
    echo -e "${NC}"
    
    # 解析命令行参数
    local command=""
    local version=""
    local message=""
    local bump_type=""
    local dry_run=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                version="$2"
                shift 2
                ;;
            -m|--message)
                message="$2"
                shift 2
                ;;
            --dry-run)
                dry_run=true
                shift
                ;;
            current|bump|tag|release|changelog)
                command="$1"
                shift
                
                # 处理 bump 命令的参数
                if [ "$command" = "bump" ] && [ $# -gt 0 ]; then
                    bump_type="$1"
                    shift
                fi
                ;;
            *)
                if [ -z "$command" ]; then
                    command="$1"
                    shift
                else
                    log_error "未知参数: $1"
                    show_help
                    exit 1
                fi
                ;;
        esac
    done
    
    # 执行命令
    case $command in
        current)
            show_current_version
            ;;
        bump)
            if [ -z "$bump_type" ]; then
                log_error "请指定 bump 类型: major, minor, patch, prerelease"
                show_help
                exit 1
            fi
            bump_version "$bump_type" "$dry_run"
            ;;
        tag)
            if [ -z "$version" ]; then
                version=$(get_current_version)
            fi
            create_git_tag "$version" "$message" "$dry_run"
            ;;
        release)
            prepare_release "$version" "$message" "$dry_run"
            ;;
        changelog)
            if [ -z "$version" ]; then
                version=$(get_current_version)
            fi
            update_changelog "$version" "$dry_run"
            ;;
        "")
            show_help
            ;;
        *)
            log_error "未知命令: $command"
            show_help
            exit 1
            ;;
    esac
}

# 运行主函数
main "$@"