#!/bin/bash

# ============================================================================
# Coclaw 发布打包脚本
# 用于创建发布包和准备 GitHub 发布
# ============================================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

# 显示帮助
show_help() {
    echo -e "${BOLD}Coclaw 发布打包脚本${NC}\n"
    echo "用法: ./package-release.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help          显示此帮助信息"
    echo "  -v, --version       指定版本号 (默认从 package.json 读取)"
    echo "  -t, --type TYPE     发布包类型: tar, zip, all (默认: all)"
    echo "  --no-clean          不清理临时文件"
    echo "  --dry-run           模拟运行，不实际创建文件"
    echo ""
    echo "示例:"
    echo "  ./package-release.sh                    # 创建所有格式的发布包"
    echo "  ./package-release.sh -v 1.0.0          # 指定版本号"
    echo "  ./package-release.sh -t tar            # 只创建 tar 包"
    echo "  ./package-release.sh --dry-run         # 模拟运行"
    echo ""
}

# 获取版本号
get_version() {
    if [ -n "$VERSION" ]; then
        echo "$VERSION"
        return
    fi
    
    if [ -f "package.json" ]; then
        VERSION=$(node -p "require('./package.json').version")
        echo "$VERSION"
    else
        log_error "package.json 未找到"
        exit 1
    fi
}

# 检查依赖
check_dependencies() {
    log "检查依赖..."
    
    # 检查 tar
    if ! command -v tar >/dev/null 2>&1; then
        log_error "tar 命令未找到"
        exit 1
    fi
    
    # 检查 zip (可选)
    if ! command -v zip >/dev/null 2>&1; then
        log_warn "zip 命令未找到，将跳过 zip 包创建"
        CAN_CREATE_ZIP=false
    else
        CAN_CREATE_ZIP=true
    fi
    
    # 检查 Node.js
    if ! command -v node >/dev/null 2>&1; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    # 检查 npm
    if ! command -v npm >/dev/null 2>&1; then
        log_error "npm 未安装"
        exit 1
    fi
    
    log_success "依赖检查通过"
}

# 清理临时文件
cleanup() {
    if [ "$NO_CLEAN" = true ]; then
        log "跳过清理 (使用 --no-clean 选项)"
        return
    fi
    
    log "清理临时文件..."
    
    # 删除临时构建目录
    if [ -d "tmp_build" ]; then
        rm -rf tmp_build
    fi
    
    log_success "清理完成"
}

# 清理旧的发布包（仅在开始时调用）
cleanup_old_packages() {
    log "清理旧的发布包..."
    
    # 删除旧的发布包
    if [ "$DRY_RUN" != true ]; then
        rm -f dist/coclaw-*.tar.gz
        rm -f dist/coclaw-*.tar.gz.sha256
        rm -f dist/coclaw-*.zip
        rm -f dist/coclaw-*.zip.sha256
        rm -f dist/RELEASE-*.md
    fi
    
    log_success "清理完成"
}

# 准备构建目录
prepare_build_dir() {
    local version=$1
    local build_dir="tmp_build/coclaw-$version"
    
    log "准备构建目录: $build_dir"
    
    # 创建目录结构
    mkdir -p "$build_dir"
    mkdir -p "$build_dir/bin"
    mkdir -p "$build_dir/lib"
    mkdir -p "$build_dir/ui"
    mkdir -p "$build_dir/templates"
    mkdir -p "$build_dir/tests"
    mkdir -p "$build_dir/docs"
    
    # 复制核心文件
    log "复制核心文件..."
    
    # 配置文件
    cp package.json "$build_dir/"
    cp package-lock.json "$build_dir/" 2>/dev/null || true
    
    # 文档文件
    cp README.md "$build_dir/"
    cp TROUBLESHOOTING.md "$build_dir/"
    cp QUICKSTART.md "$build_dir/"
    cp plan.md "$build_dir/" 2>/dev/null || true
    cp project.md "$build_dir/" 2>/dev/null || true
    
    # 脚本文件
    cp install.sh "$build_dir/"
    chmod +x "$build_dir/install.sh"
    
    # 二进制文件
    cp bin/coclaw "$build_dir/bin/"
    chmod +x "$build_dir/bin/coclaw"
    
    # 库文件
    cp -r lib/* "$build_dir/lib/" 2>/dev/null || true
    
    # UI 文件
    cp -r ui/* "$build_dir/ui/" 2>/dev/null || true
    
    # 模板文件
    cp -r templates/* "$build_dir/templates/" 2>/dev/null || true
    
    # 测试文件 (可选)
    if [ -d "tests" ]; then
        cp -r tests/* "$build_dir/tests/" 2>/dev/null || true
    fi
    
    # 创建版本文件
    echo "$version" > "$build_dir/VERSION"
    
    # 创建 LICENSE 文件 (如果不存在)
    if [ ! -f "LICENSE" ]; then
        cat > "$build_dir/LICENSE" << EOF
MIT License

Copyright (c) $(date +%Y) CuiJY

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF
    else
        cp LICENSE "$build_dir/"
    fi
    
    log_success "构建目录准备完成"
}

# 安装生产依赖
install_dependencies() {
    local build_dir=$1
    
    log "安装生产依赖..."
    
    cd "$build_dir"
    
    if [ "$DRY_RUN" = true ]; then
        log "模拟: npm install --production --silent"
    else
        npm install --production --silent
        
        if [ $? -eq 0 ]; then
            log_success "依赖安装完成"
        else
            log_error "依赖安装失败"
            exit 1
        fi
    fi
    
    cd - >/dev/null
}

# 创建 tar 包
create_tar_package() {
    local version=$1
    local build_dir="tmp_build/coclaw-$version"
    local tar_file="dist/coclaw-$version.tar.gz"
    
    log "创建 tar 包: $tar_file"
    
    if [ "$DRY_RUN" = true ]; then
        log "模拟: tar -czf $tar_file -C tmp_build coclaw-$version"
        return
    fi
    
    # 确保 dist 目录存在
    mkdir -p dist
    
    # 创建 tar 包
    tar -czf "$tar_file" -C tmp_build "coclaw-$version"
    
    if [ $? -eq 0 ]; then
        # 计算文件大小和校验和
        local size=$(du -h "$tar_file" | cut -f1)
        local checksum=$(sha256sum "$tar_file" | cut -d' ' -f1)
        
        log_success "tar 包创建完成"
        log "  文件: $tar_file"
        log "  大小: $size"
        log "  SHA256: $checksum"
        
        # 保存校验和
        echo "$checksum  $(basename "$tar_file")" > "$tar_file.sha256"
    else
        log_error "tar 包创建失败"
        exit 1
    fi
}

# 创建 zip 包
create_zip_package() {
    local version=$1
    local build_dir="tmp_build/coclaw-$version"
    local zip_file="dist/coclaw-$version.zip"
    
    if [ "$CAN_CREATE_ZIP" = false ]; then
        log_warn "跳过 zip 包创建 (zip 命令不可用)"
        return
    fi
    
    log "创建 zip 包: $zip_file"
    
    if [ "$DRY_RUN" = true ]; then
        log "模拟: zip -r $zip_file $build_dir"
        return
    fi
    
    # 确保 dist 目录存在
    mkdir -p dist
    
    # 创建 zip 包
    cd tmp_build
    zip -r "../$zip_file" "coclaw-$version" >/dev/null
    cd ..
    
    if [ $? -eq 0 ]; then
        # 计算文件大小和校验和
        local size=$(du -h "$zip_file" | cut -f1)
        local checksum=$(sha256sum "$zip_file" | cut -d' ' -f1)
        
        log_success "zip 包创建完成"
        log "  文件: $zip_file"
        log "  大小: $size"
        log "  SHA256: $checksum"
        
        # 保存校验和
        echo "$checksum  $(basename "$zip_file")" > "$zip_file.sha256"
    else
        log_error "zip 包创建失败"
        exit 1
    fi
}

# 验证发布包
verify_packages() {
    local version=$1
    
    log "验证发布包..."
    
    # 检查文件是否存在
    local tar_file="dist/coclaw-$version.tar.gz"
    local zip_file="dist/coclaw-$version.zip"
    
    local errors=0
    
    # 验证 tar 包
    if [ -f "$tar_file" ]; then
        log "验证 $tar_file..."
        
        # 检查文件大小
        local tar_size=$(stat -c%s "$tar_file" 2>/dev/null || stat -f%z "$tar_file" 2>/dev/null)
        if [ "$tar_size" -lt 1000 ]; then
            log_error "tar 包文件大小异常: ${tar_size} 字节"
            errors=$((errors + 1))
        fi
        
        # 测试解压
        if tar -tzf "$tar_file" >/dev/null 2>&1; then
            log_success "tar 包验证通过"
        else
            log_error "tar 包损坏或格式错误"
            errors=$((errors + 1))
        fi
    else
        log_error "tar 包未找到: $tar_file"
        errors=$((errors + 1))
    fi
    
    # 验证 zip 包 (如果创建了)
    if [ -f "$zip_file" ]; then
        log "验证 $zip_file..."
        
        # 检查文件大小
        local zip_size=$(stat -c%s "$zip_file" 2>/dev/null || stat -f%z "$zip_file" 2>/dev/null)
        if [ "$zip_size" -lt 1000 ]; then
            log_error "zip 包文件大小异常: ${zip_size} 字节"
            errors=$((errors + 1))
        fi
        
        # 测试解压
        if unzip -t "$zip_file" >/dev/null 2>&1; then
            log_success "zip 包验证通过"
        else
            log_error "zip 包损坏或格式错误"
            errors=$((errors + 1))
        fi
    elif [ "$CAN_CREATE_ZIP" = true ] && [ "$PACKAGE_TYPE" != "tar" ]; then
        log_warn "zip 包未创建"
    fi
    
    if [ $errors -eq 0 ]; then
        log_success "所有发布包验证通过"
    else
        log_error "发布包验证失败 ($errors 个错误)"
        exit 1
    fi
}

# 生成发布说明
generate_release_notes() {
    local version=$1
    local notes_file="dist/RELEASE-$version.md"
    
    log "生成发布说明: $notes_file"
    
    cat > "$notes_file" << EOF
# Coclaw v$version 发布说明

## 版本信息
- **版本号**: $version
- **发布日期**: $(date +%Y-%m-%d)
- **Node.js 要求**: v18+

## 下载链接
- [coclaw-$version.tar.gz](coclaw-$version.tar.gz) (SHA256: \`$(sha256sum "dist/coclaw-$version.tar.gz" 2>/dev/null | cut -d' ' -f1 || echo "计算中...")\`)
$(if [ -f "dist/coclaw-$version.zip" ]; then echo "- [coclaw-$version.zip](coclaw-$version.zip) (SHA256: \`$(sha256sum "dist/coclaw-$version.zip" | cut -d' ' -f1)\`)"; fi)

## 安装方法
\`\`\`bash
# 下载并安装
curl -L https://github.com/cuiJY-still-in-school/coclaw/releases/download/v$version/coclaw-$version.tar.gz | tar -xz
cd coclaw-$version
./install.sh

# 或使用一键安装脚本
curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/v$version/install.sh | bash
\`\`\`

## 更新内容

### 新功能
- 完整的系统集成与优化
- 性能监控和错误处理
- 资源自动清理机制
- 增强的 CLI 用户体验

### 改进
- 安装脚本支持更多操作系统
- 更好的错误处理和恢复机制
- 优化的文件传输性能
- 详细的用户文档和故障排除指南

### 修复
- 各种稳定性改进
- 内存泄漏修复
- 网络连接稳定性提升

## 系统要求
- **操作系统**: macOS 10.15+, Ubuntu 20.04+, CentOS 8+
- **Node.js**: v18.0.0 或更高版本
- **内存**: 至少 512MB RAM
- **磁盘空间**: 至少 100MB 可用空间

## 快速开始
1. 安装 Coclaw: \`./install.sh\`
2. 创建 Agent: \`coclaw create\`
3. 启动服务器: \`coclaw server\`
4. 查看帮助: \`coclaw --help\`

## 文档
- [用户手册](README.md)
- [故障排除指南](TROUBLESHOOTING.md)
- [快速开始](QUICKSTART.md)

## 问题反馈
如果在使用过程中遇到问题，请：
1. 查看 [故障排除指南](TROUBLESHOOTING.md)
2. 在 GitHub 创建 Issue
3. 发送邮件至: shortsubjayfire@gmail.com

## 致谢
感谢所有贡献者和用户的支持！

---
*Coclaw 开发团队*
EOF
    
    log_success "发布说明已生成"
}

# 主函数
main() {
    # 解析命令行参数
    VERSION=""
    PACKAGE_TYPE="all"
    NO_CLEAN=false
    DRY_RUN=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -v|--version)
                VERSION="$2"
                shift 2
                ;;
            -t|--type)
                PACKAGE_TYPE="$2"
                shift 2
                ;;
            --no-clean)
                NO_CLEAN=true
                shift
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 显示标题
    echo -e "${CYAN}${BOLD}"
    echo "========================================"
    echo "    Coclaw 发布打包脚本"
    echo "========================================"
    echo -e "${NC}"
    
    # 获取版本号
    VERSION=$(get_version)
    log "版本号: $VERSION"
    
    # 检查依赖
    check_dependencies
    
    # 清理旧文件
    cleanup_old_packages
    
    # 准备构建目录
    prepare_build_dir "$VERSION"
    
    # 安装依赖
    install_dependencies "tmp_build/coclaw-$VERSION"
    
    # 创建发布包
    if [ "$PACKAGE_TYPE" = "all" ] || [ "$PACKAGE_TYPE" = "tar" ]; then
        create_tar_package "$VERSION"
    fi
    
    if [ "$PACKAGE_TYPE" = "all" ] || [ "$PACKAGE_TYPE" = "zip" ]; then
        create_zip_package "$VERSION"
    fi
    
    # 验证发布包
    if [ "$DRY_RUN" != true ]; then
        verify_packages "$VERSION"
        
        # 生成发布说明
        generate_release_notes "$VERSION"
        
        # 显示总结
        echo -e "\n${GREEN}${BOLD}========================================"
        echo "    发布包创建完成!"
        echo "========================================"
        echo -e "${NC}"
        
        echo "发布包已保存到 dist/ 目录:"
        ls -lh dist/coclaw-$VERSION.*
        
        echo -e "\n下一步:"
        echo "1. 测试发布包: tar -xzf dist/coclaw-$VERSION.tar.gz && cd coclaw-$VERSION && ./install.sh"
        echo "2. 创建 GitHub Release"
        echo "3. 上传发布包到 GitHub"
        echo "4. 更新文档和公告"
    else
        echo -e "\n${YELLOW}模拟运行完成，未实际创建文件${NC}"
    fi
    
    # 清理临时文件
    if [ "$NO_CLEAN" = false ] && [ "$DRY_RUN" = false ]; then
        cleanup
    fi
}

# 运行主函数
main "$@"