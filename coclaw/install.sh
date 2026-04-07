#!/bin/bash

# Coclaw 安装脚本
# 支持 macOS 和 Linux

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查 Node.js 版本
check_node_version() {
    if ! command_exists node; then
        log_error "Node.js 未安装"
        log_info "请访问 https://nodejs.org/ 安装 Node.js v18+"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1)
    
    if [ "$NODE_MAJOR" -lt 18 ]; then
        log_error "Node.js 版本过低: $NODE_VERSION"
        log_info "需要 Node.js v18+，当前版本: $NODE_VERSION"
        exit 1
    fi
    
    log_success "Node.js 版本: $NODE_VERSION"
}

# 检查 npm
check_npm() {
    if ! command_exists npm; then
        log_error "npm 未安装"
        exit 1
    fi
    
    log_success "npm 版本: $(npm -v)"
}

# 检查 OpenClaw
check_openclaw() {
    if command_exists openclaw; then
        log_success "OpenClaw 已安装: $(openclaw --version 2>/dev/null || echo '未知版本')"
        return 0
    else
        log_warn "OpenClaw 未安装"
        return 1
    fi
}

# 安装 OpenClaw
install_openclaw() {
    log_info "正在安装 OpenClaw..."
    
    if command_exists pnpm; then
        pnpm add -g openclaw@latest
    elif command_exists bun; then
        bun add -g openclaw@latest
    else
        npm install -g openclaw@latest
    fi
    
    if [ $? -eq 0 ]; then
        log_success "OpenClaw 安装成功"
    else
        log_error "OpenClaw 安装失败"
        exit 1
    fi
}

# 安装 Coclaw
install_coclaw() {
    log_info "正在安装 Coclaw..."
    
    # 创建安装目录
    INSTALL_DIR="/usr/local/lib/coclaw"
    BIN_DIR="/usr/local/bin"
    
    log_info "安装目录: $INSTALL_DIR"
    
    # 清理旧版本
    if [ -d "$INSTALL_DIR" ]; then
        log_info "清理旧版本..."
        rm -rf "$INSTALL_DIR"
    fi
    
    # 创建目录
    mkdir -p "$INSTALL_DIR"
    
    # 复制文件
    log_info "复制文件..."
    
    # 复制 package.json
    cp package.json "$INSTALL_DIR/"
    
    # 创建必要的目录
    mkdir -p "$INSTALL_DIR/bin"
    mkdir -p "$INSTALL_DIR/lib"
    mkdir -p "$INSTALL_DIR/ui"
    mkdir -p "$INSTALL_DIR/templates"
    mkdir -p "$INSTALL_DIR/tests"
    
    # 复制 bin 文件
    cp bin/coclaw "$INSTALL_DIR/bin/"
    chmod +x "$INSTALL_DIR/bin/coclaw"
    
    # 复制 lib 文件
    cp -r lib/* "$INSTALL_DIR/lib/" 2>/dev/null || true
    
    # 复制其他文件
    cp project.md "$INSTALL_DIR/" 2>/dev/null || true
    cp plan.md "$INSTALL_DIR/" 2>/dev/null || true
    
    # 创建符号链接
    log_info "创建符号链接..."
    ln -sf "$INSTALL_DIR/bin/coclaw" "$BIN_DIR/coclaw"
    
    # 安装 npm 依赖
    log_info "安装 npm 依赖..."
    cd "$INSTALL_DIR"
    npm install --production
    
    log_success "Coclaw 安装完成"
}

# 创建配置文件
create_config() {
    log_info "创建配置文件..."
    
    CONFIG_DIR="$HOME/.coclaw"
    
    if [ ! -d "$CONFIG_DIR" ]; then
        mkdir -p "$CONFIG_DIR"
        log_success "配置文件目录已创建: $CONFIG_DIR"
    else
        log_info "配置文件目录已存在: $CONFIG_DIR"
    fi
}

# 显示安装完成信息
show_completion() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}        Coclaw 安装完成!              ${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo "使用以下命令开始:"
    echo ""
    echo "  coclaw --help              # 显示帮助信息"
    echo "  coclaw create              # 创建新 Agent"
    echo "  coclaw list                # 列出所有 Agent"
    echo "  coclaw server              # 启动/停止服务器"
    echo ""
    echo "文档:"
    echo "  - 查看 project.md 了解项目设计"
    echo "  - 查看 plan.md 了解开发计划"
    echo ""
    echo "问题反馈:"
    echo "  - 创建 GitHub Issue"
    echo ""
}

# 主函数
main() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}        Coclaw 安装脚本                ${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    
    # 检查系统
    OS=$(uname -s)
    log_info "操作系统: $OS"
    
    if [ "$OS" != "Darwin" ] && [ "$OS" != "Linux" ]; then
        log_error "不支持的操作系统: $OS"
        log_info "仅支持 macOS 和 Linux"
        exit 1
    fi
    
    # 检查权限
    if [ "$EUID" -eq 0 ]; then
        log_warn "检测到 root 权限，建议使用普通用户安装"
        read -p "是否继续? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "安装已取消"
            exit 0
        fi
    fi
    
    # 执行检查
    check_node_version
    check_npm
    
    # 检查/安装 OpenClaw
    if ! check_openclaw; then
        read -p "是否安装 OpenClaw? (Y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Nn]$ ]]; then
            install_openclaw
        else
            log_warn "跳过 OpenClaw 安装，但 Coclaw 需要 OpenClaw 才能正常工作"
        fi
    fi
    
    # 安装 Coclaw
    install_coclaw
    
    # 创建配置
    create_config
    
    # 显示完成信息
    show_completion
}

# 执行主函数
main "$@"