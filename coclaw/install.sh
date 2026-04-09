#!/bin/bash

# ============================================================================
# Coclaw 安装脚本 v2.3
# 支持 macOS 和 Linux 系统
# 作者: CuiJY (shortsubjayfire@gmail.com)
# GitHub: https://github.com/cuiJY-still-in-school/coclaw
# ============================================================================

set -e



# ============================================================================
# 颜色和样式定义
# ============================================================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ============================================================================
# 日志函数
# ============================================================================
log_header() {
    echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$1${NC}"
}

log_info() {
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

log_debug() {
    if [ "$DEBUG" = "true" ]; then
        echo -e "${MAGENTA}[DEBUG]${NC} $1"
    fi
}

# ============================================================================
# 工具函数
# ============================================================================

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 获取操作系统信息
get_os_info() {
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    case $OS in
        Darwin)
            OS_NAME="macOS"
            OS_VERSION=$(sw_vers -productVersion)
            ;;
        Linux)
            if [ -f /etc/os-release ]; then
                . /etc/os-release
                OS_NAME="$NAME"
                OS_VERSION="$VERSION_ID"
            else
                OS_NAME="Linux"
                OS_VERSION="unknown"
            fi
            ;;
        *)
            OS_NAME="$OS"
            OS_VERSION="unknown"
            ;;
    esac
    
    echo "$OS_NAME $OS_VERSION ($ARCH)"
}

# 检查是否需要 sudo（现在脚本已经以 root 运行，此函数主要用于信息提示）
need_sudo() {
    return 1  # 不需要 sudo，因为脚本已经以 root 运行
}

# 执行命令（简化版，因为脚本已经以 root 运行）
exec_cmd() {
    local cmd="$1"
    local desc="$2"
    
    log_info "$desc..."
    bash -c "$cmd"
}

# ============================================================================
# 系统检查函数
# ============================================================================

# 检查系统要求
check_system_requirements() {
    log_header "检查系统要求"
    
    # 检查操作系统
    OS=$(uname -s)
    if [ "$OS" != "Darwin" ] && [ "$OS" != "Linux" ]; then
        log_error "不支持的操作系统: $OS"
        log_info "仅支持 macOS 和 Linux 系统"
        exit 1
    fi
    
    log_success "操作系统: $(get_os_info)"
    
    # 检查内存
    if [ "$OS" = "Darwin" ]; then
        TOTAL_MEM=$(sysctl -n hw.memsize)
        TOTAL_MEM_MB=$((TOTAL_MEM / 1024 / 1024))
    else
        TOTAL_MEM=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        TOTAL_MEM_MB=$((TOTAL_MEM / 1024))
    fi
    
    if [ $TOTAL_MEM_MB -lt 512 ]; then
        log_warn "系统内存较低: ${TOTAL_MEM_MB}MB (推荐 1GB+)"
    else
        log_success "系统内存: ${TOTAL_MEM_MB}MB"
    fi
    
    # 检查磁盘空间
    MIN_DISK_SPACE=100  # 100MB
    AVAILABLE_SPACE=$(df -m . | awk 'NR==2 {print $4}')
    
    if [ $AVAILABLE_SPACE -lt $MIN_DISK_SPACE ]; then
        log_warn "磁盘空间不足: ${AVAILABLE_SPACE}MB (需要 ${MIN_DISK_SPACE}MB)"
    else
        log_success "可用磁盘空间: ${AVAILABLE_SPACE}MB"
    fi
}

# 检查 Node.js
check_nodejs() {
    log_header "检查 Node.js"
    
    if ! command_exists node; then
        log_error "Node.js 未安装"
        log_info ""
        log_info "请安装 Node.js v18+："
        log_info "1. 使用 nvm (推荐): https://github.com/nvm-sh/nvm"
        log_info "2. 从官网下载: https://nodejs.org/"
        log_info "3. 使用包管理器:"
        log_info "   - macOS: brew install node"
        log_info "   - Ubuntu/Debian: apt-get install nodejs npm"
        log_info "   - CentOS/RHEL: yum install nodejs npm"
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
    log_header "检查 npm"
    
    if ! command_exists npm; then
        log_error "npm 未安装"
        log_info "npm 通常随 Node.js 一起安装"
        log_info "请重新安装 Node.js 或手动安装 npm"
        exit 1
    fi
    
    NPM_VERSION=$(npm -v)
    log_success "npm 版本: $NPM_VERSION"
}

# 检查 OpenClaw
check_openclaw() {
    log_header "检查 OpenClaw"
    
    if command_exists openclaw; then
        OPENCLAW_VERSION=$(openclaw --version 2>/dev/null || echo "未知版本")
        log_success "OpenClaw 已安装: $OPENCLAW_VERSION"
        return 0
    else
        log_warn "OpenClaw 未安装"
        return 1
    fi
}

# ============================================================================
# 安装函数
# ============================================================================

# 安装 OpenClaw
install_openclaw() {
    log_header "安装 OpenClaw"
    
    local package_manager="npm"
    
    # 检测包管理器
    if command_exists pnpm; then
        package_manager="pnpm"
        log_info "检测到 pnpm，使用 pnpm 安装"
    elif command_exists bun; then
        package_manager="bun"
        log_info "检测到 bun，使用 bun 安装"
    elif command_exists yarn; then
        package_manager="yarn"
        log_info "检测到 yarn，使用 yarn 安装"
    fi
    
    case $package_manager in
        pnpm)
            exec_cmd "pnpm add -g openclaw@latest" "使用 pnpm 安装 OpenClaw"
            ;;
        bun)
            exec_cmd "bun add -g openclaw@latest" "使用 bun 安装 OpenClaw"
            ;;
        yarn)
            exec_cmd "yarn global add openclaw@latest" "使用 yarn 安装 OpenClaw"
            ;;
        *)
            exec_cmd "npm install -g openclaw@latest" "使用 npm 安装 OpenClaw"
            ;;
    esac
    
    if [ $? -eq 0 ]; then
        log_success "OpenClaw 安装成功"
    else
        log_error "OpenClaw 安装失败"
        exit 1
    fi
}

# 安装 Coclaw
install_coclaw() {
    local local_install="${1:-false}"
    
    log_header "安装 Coclaw"
    
    # 安装选项
    local INSTALL_MODE="global"  # global 或 local
    local INSTALL_DIR=""
    local BIN_DIR=""
    
    # 根据选项确定安装模式
    if [ "$local_install" = true ]; then
        INSTALL_MODE="local"
    fi
    
    # 确定安装目录
    if [ "$INSTALL_MODE" = "global" ]; then
        INSTALL_DIR="/usr/local/lib/coclaw"
        BIN_DIR="/usr/local/bin"
    else
        INSTALL_DIR="$HOME/.local/lib/coclaw"
        BIN_DIR="$HOME/.local/bin"
        mkdir -p "$BIN_DIR"
    fi
    
    log_info "安装模式: $INSTALL_MODE"
    log_info "安装目录: $INSTALL_DIR"
    log_info "二进制目录: $BIN_DIR"
    
    # 清理旧版本
    if [ -d "$INSTALL_DIR" ]; then
        log_info "清理旧版本..."
        exec_cmd "rm -rf $INSTALL_DIR" "删除旧版本"
    fi
    
    # 创建目录结构
    log_info "创建目录结构..."
    exec_cmd "mkdir -p $INSTALL_DIR" "创建安装目录"
    exec_cmd "mkdir -p $INSTALL_DIR/bin" "创建 bin 目录"
    exec_cmd "mkdir -p $INSTALL_DIR/lib" "创建 lib 目录"
    exec_cmd "mkdir -p $INSTALL_DIR/ui" "创建 ui 目录"
    exec_cmd "mkdir -p $INSTALL_DIR/templates" "创建 templates 目录"
    exec_cmd "mkdir -p $INSTALL_DIR/tests" "创建 tests 目录"
    
    # 下载或复制文件
    log_info "获取 Coclaw 文件..."
    
    # 检查是否在 Coclaw 项目目录中
    if [ -f "package.json" ] && [ -d "lib" ] && [ -d "bin" ]; then
        # 在项目目录中，直接复制文件
        log_info "从本地项目目录复制文件..."
        exec_cmd "cp package.json '$INSTALL_DIR/'" "复制 package.json"
    else
        # 不在项目目录中，从 GitHub 下载
        log_info "从 GitHub 仓库下载文件..."
        
        # 下载 package.json
        exec_cmd "curl -s -L 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/package.json' -o '$INSTALL_DIR/package.json'" "下载 package.json"
        
        # 下载 bin/coclaw
        exec_cmd "curl -s -L 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/bin/coclaw' -o '$INSTALL_DIR/bin/coclaw'" "下载 coclaw 可执行文件"
        exec_cmd "chmod +x '$INSTALL_DIR/bin/coclaw'" "设置可执行权限"
        
        # 创建必要的目录结构
        exec_cmd "mkdir -p '$INSTALL_DIR/lib'" "创建 lib 目录"
        exec_cmd "mkdir -p '$INSTALL_DIR/ui'" "创建 ui 目录"
        exec_cmd "mkdir -p '$INSTALL_DIR/templates'" "创建 templates 目录"
        
        # 标记为从远程安装
        exec_cmd "echo 'installed_from=remote' > '$INSTALL_DIR/.install_source'" "创建安装标记文件"
    fi
    
    # 如果是本地安装，复制其他文件
    if [ -f "package.json" ] && [ -d "lib" ] && [ -d "bin" ]; then
        # 复制 README 和文档
        exec_cmd "cp README.md '$INSTALL_DIR/'" "复制 README.md" || true
        exec_cmd "cp TROUBLESHOOTING.md '$INSTALL_DIR/'" "复制 TROUBLESHOOTING.md" || true
        exec_cmd "cp QUICKSTART.md '$INSTALL_DIR/'" "复制 QUICKSTART.md" || true
        
        # 复制 lib 目录
        exec_cmd "cp -r lib/* '$INSTALL_DIR/lib/'" "复制 lib 目录" || true
        
        # 复制 ui 目录
        exec_cmd "cp -r ui/* '$INSTALL_DIR/ui/'" "复制 ui 目录" || true
        
        # 复制 templates 目录
        exec_cmd "cp -r templates/* '$INSTALL_DIR/templates/'" "复制 templates 目录" || true
    else
        # 远程安装，下载所有必要文件
        log_info "下载核心库文件..."
        
        # 下载主要的库文件
        log_info "下载核心库文件..."
        
        # 下载所有 lib 目录中的 JS 文件
        lib_files=(
            "lib/index.js"
            "lib/agent-manager.js"
            "lib/ai-tools.js"
            "lib/cli.js"
            "lib/config.js"
            "lib/discovery.js"
            "lib/error-handler.js"
            "lib/message-system.js"
            "lib/monitoring.js"
            "lib/openclaw.js"
            "lib/performance-optimizer.js"
            "lib/relation-cli.js"
            "lib/relationship-manager.js"
            "lib/resource-cleaner.js"
            "lib/server-connector.js"
            "lib/server-manager.js"
            "lib/token-manager.js"
            "lib/commands/agent.js"
            "lib/commands/connect.js"
            "lib/commands/create.js"
            "lib/commands/errors.js"
            "lib/commands/list.js"
            "lib/commands/performance.js"
            "lib/commands/server.js"
        )
        
        for file in "${lib_files[@]}"; do
            filename=$(basename "$file")
            dirname=$(dirname "$file")
            exec_cmd "mkdir -p '$INSTALL_DIR/$dirname'" "创建目录 $dirname"
            if ! exec_cmd "curl -s -L 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/$file' -o '$INSTALL_DIR/$file'" "下载 $filename"; then
                log_warn "无法下载 $filename"
                # 尝试备用下载方式
                exec_cmd "curl -s 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/$file' -o '$INSTALL_DIR/$file'" "尝试备用方式下载 $filename" || true
            fi
        done
        
        # 下载 UI 文件
        log_info "下载 UI 文件..."
        exec_cmd "mkdir -p '$INSTALL_DIR/ui'" "创建 UI 目录"
        for file in "ui/interactive.js" "ui/prompts.js" "ui/index.js"; do
            filename=$(basename "$file")
            exec_cmd "curl -s -L 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/$file' -o '$INSTALL_DIR/$file'" "下载 $filename" || true
        done
        
        # 下载模板文件
        log_info "下载模板文件..."
        exec_cmd "mkdir -p '$INSTALL_DIR/templates'" "创建模板目录"
        for file in "templates/agent-config.json" "templates/server-config.json"; do
            filename=$(basename "$file")
            exec_cmd "curl -s -L 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/$file' -o '$INSTALL_DIR/$file'" "下载 $filename" || true
        done
        
        # 下载文档文件（可选）
        log_info "下载文档文件..."
        for file in "README.md" "TROUBLESHOOTING.md" "QUICKSTART.md" "API.md" "ARCHITECTURE.md" "CONTRIBUTING.md" "CHANGELOG.md"; do
            exec_cmd "curl -s -L 'https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/$file' -o '$INSTALL_DIR/$file'" "下载 $file" || true
        done
    fi
    
    # 创建符号链接
    log_info "创建符号链接..."
    if [ -w "$BIN_DIR" ] || need_sudo "$BIN_DIR"; then
        exec_cmd "ln -sf $INSTALL_DIR/bin/coclaw $BIN_DIR/coclaw" "创建 coclaw 命令链接"
    else
        log_warn "无法写入 $BIN_DIR，请手动创建符号链接:"
        log_info "  ln -s $INSTALL_DIR/bin/coclaw ~/bin/coclaw"
    fi
    
    # 安装依赖
    log_info "安装 npm 依赖..."
    cd "$INSTALL_DIR"
    npm install --production --silent
    
    if [ $? -eq 0 ]; then
        log_success "Coclaw 安装完成"
    else
        log_error "npm 依赖安装失败"
        exit 1
    fi
}

# 创建配置文件
create_config() {
    log_header "创建配置文件"
    
    local CONFIG_DIR="$HOME/.coclaw"
    local CONFIG_FILE="$CONFIG_DIR/config.json"
    local LOG_DIR="$CONFIG_DIR/logs"
    local FILES_DIR="$CONFIG_DIR/files"
    local AGENTS_DIR="$CONFIG_DIR/agents"
    
    # 创建目录
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$FILES_DIR"
    mkdir -p "$AGENTS_DIR"
    
    log_success "配置目录: $CONFIG_DIR"
    
    # 创建默认配置文件（如果不存在）
    if [ ! -f "$CONFIG_FILE" ]; then
        cat > "$CONFIG_FILE" << EOF
{
  "version": "1.0",
  "server": {
    "port": 18790,
    "host": "0.0.0.0",
    "maxConnections": 100,
    "timeout": 30000
  },
  "file": {
    "maxSize": 104857600,
    "storageDir": "$FILES_DIR",
    "retentionDays": 1
  },
  "security": {
    "requireAuth": false,
    "allowLocalConnections": true,
    "tokenExpiration": 3600
  },
  "performance": {
    "optimizationEnabled": true,
    "messageBatching": {
      "enabled": true,
      "batchSize": 10,
      "batchTimeout": 100
    }
  }
}
EOF
        log_success "默认配置文件已创建"
    else
        log_info "配置文件已存在"
    fi
    
    # 设置权限
    chmod 700 "$CONFIG_DIR"
    chmod 600 "$CONFIG_FILE"
}

# 验证安装
verify_installation() {
    log_header "验证安装"
    
    # 检查命令是否可用
    if command_exists coclaw; then
        log_success "coclaw 命令已安装"
        
        # 测试版本命令
        # 使用绝对路径避免 PATH 问题
        COCLAW_CMD=$(which coclaw)
        if [ -n "$COCLAW_CMD" ] && "$COCLAW_CMD" --version >/dev/null 2>&1; then
            VERSION=$("$COCLAW_CMD" --version 2>/dev/null || "$COCLAW_CMD" -v 2>/dev/null || echo "未知")
            log_success "Coclaw 版本: $VERSION"
        else
            # 如果命令执行失败，尝试直接读取 package.json
            INSTALL_DIR="/usr/local/lib/coclaw"
            if [ -f "$INSTALL_DIR/package.json" ]; then
                VERSION=$(grep '"version"' "$INSTALL_DIR/package.json" | cut -d'"' -f4)
                log_success "Coclaw 版本: $VERSION (从 package.json 读取)"
            else
                log_warn "无法获取版本信息"
            fi
        fi
    else
        log_error "coclaw 命令未找到"
        log_info "请检查 PATH 环境变量或重新运行安装脚本"
        return 1
    fi
    
    # 检查 OpenClaw
    if command_exists openclaw; then
        log_success "OpenClaw 已安装"
    else
        log_warn "OpenClaw 未安装，部分功能可能受限"
    fi
    
    return 0
}

# ============================================================================
# 卸载函数
# ============================================================================

uninstall_coclaw() {
    log_header "卸载 Coclaw"
    
    local response
    read -p "确定要卸载 Coclaw 吗？这将删除所有安装文件。 (y/N): " response
    
    if [[ ! $response =~ ^[Yy]$ ]]; then
        log_info "卸载已取消"
        return
    fi
    
    # 删除全局安装
    if [ -d "/usr/local/lib/coclaw" ]; then
        log_info "删除全局安装文件..."
        exec_cmd "rm -rf /usr/local/lib/coclaw" "删除安装目录"
        exec_cmd "rm -f /usr/local/bin/coclaw" "删除符号链接"
    fi
    
    # 删除本地安装
    if [ -d "$HOME/.local/lib/coclaw" ]; then
        log_info "删除本地安装文件..."
        rm -rf "$HOME/.local/lib/coclaw"
        rm -f "$HOME/.local/bin/coclaw"
    fi
    
    # 询问是否删除配置文件
    read -p "是否删除配置文件 (~/.coclaw)？ (y/N): " response
    if [[ $response =~ ^[Yy]$ ]]; then
        log_info "删除配置文件..."
        rm -rf "$HOME/.coclaw"
        log_success "配置文件已删除"
    else
        log_info "配置文件保留在 ~/.coclaw"
    fi
    
    log_success "Coclaw 已卸载"
}

# ============================================================================
# 信息显示函数
# ============================================================================

show_welcome() {
    echo -e "\n${CYAN}${BOLD}"
    echo "   ██████  ██████  ██████  ██       █████  ██     ██ "
    echo "  ██      ██    ██ ██   ██ ██      ██   ██ ██     ██ "
    echo "  ██      ██    ██ ██████  ██      ███████ ██  █  ██ "
    echo "  ██      ██    ██ ██   ██ ██      ██   ██ ██ ███ ██ "
    echo "   ██████  ██████  ██   ██ ███████ ██   ██  ███ ███  "
    echo -e "${NC}"
    echo -e "${BOLD}本地网络 AI 协作工具${NC}"
    echo -e "基于 OpenClaw 的多 Agent 协作平台"
    echo ""
}

show_completion() {
    echo -e "\n${GREEN}${BOLD}========================================${NC}"
    echo -e "${GREEN}${BOLD}        Coclaw 安装完成!              ${NC}"
    echo -e "${GREEN}${BOLD}========================================${NC}\n"
    
    echo -e "${BOLD}🎉 恭喜！Coclaw 已成功安装。${NC}\n"
    
    echo -e "${BOLD}📚 快速开始:${NC}"
    echo -e "  1. 创建你的第一个 Agent:"
    echo -e "     ${CYAN}coclaw create${NC}"
    echo ""
    echo -e "  2. 启动服务器:"
    echo -e "     ${CYAN}coclaw server${NC}"
    echo ""
    echo -e "  3. 查看所有命令:"
    echo -e "     ${CYAN}coclaw --help${NC}"
    echo ""
    
    echo -e "${BOLD}🔧 常用命令:${NC}"
    echo -e "  ${CYAN}coclaw list${NC}                # 列出所有 Agent"
    echo -e "  ${CYAN}coclaw agent <id> start${NC}    # 启动 Agent"
    echo -e "  ${CYAN}coclaw performance${NC}         # 查看性能统计"
    echo -e "  ${CYAN}coclaw errors${NC}              # 查看错误日志"
    echo ""
    
    echo -e "${BOLD}📖 文档:${NC}"
    echo -e "  - 完整文档: ${CYAN}cat ~/.coclaw/README.md${NC}"
    echo -e "  - 故障排除: ${CYAN}cat ~/.coclaw/TROUBLESHOOTING.md${NC}"
    echo -e "  - GitHub: https://github.com/cuiJY-still-in-school/coclaw"
    echo ""
    
    echo -e "${BOLD}🐛 问题反馈:${NC}"
    echo "  - 创建 GitHub Issue"
    echo "  - 邮箱: shortsubjayfire@gmail.com"
    echo ""
    
    echo -e "${BOLD}🚀 开始你的 AI 协作之旅吧！${NC}\n"
}

show_help() {
    echo -e "${BOLD}Coclaw 安装脚本使用说明${NC}\n"
    echo "用法: ./install.sh [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help        显示此帮助信息"
    echo "  -v, --version     显示版本信息"
    echo "  -d, --debug       启用调试模式"
    echo "  -u, --uninstall   卸载 Coclaw"
    echo "  --no-openclaw     跳过 OpenClaw 安装"
    echo "  --local           本地安装（非全局）"
    echo ""
    echo "示例:"
    echo "  ./install.sh                 # 标准安装"
    echo "  ./install.sh --local         # 本地用户安装"
    echo "  ./install.sh --no-openclaw   # 跳过 OpenClaw 安装"
    echo "  ./install.sh --uninstall     # 卸载 Coclaw"
    echo ""
}

# ============================================================================
# 主函数
# ============================================================================

main() {
    # 解析命令行参数（先解析帮助和版本，不需要 root 权限）
    local SKIP_OPENCLAW=false
    local LOCAL_INSTALL=false
    local UNINSTALL=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_welcome
                show_help
                exit 0
                ;;
            -v|--version)
                echo "Coclaw 安装脚本 v2.3"
                exit 0
                ;;
            -d|--debug)
                DEBUG="true"
                shift
                ;;
            -u|--uninstall)
                UNINSTALL=true
                shift
                ;;
            --no-openclaw)
                SKIP_OPENCLAW=true
                shift
                ;;
            --local)
                LOCAL_INSTALL=true
                shift
                ;;
            *)
                log_error "未知选项: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # 检查是否需要 sudo（除了帮助和版本命令）
    if [ "$EUID" -ne 0 ]; then
        echo "❌ 错误: 此安装脚本需要 root 权限"
        echo ""
        echo "请使用 sudo 运行:"
        echo "  sudo ./install.sh"
        echo ""
        echo "或使用以下方式:"
        echo "  curl -fsSL https://raw.githubusercontent.com/cuiJY-still-in-school/coclaw/main/coclaw/install.sh | sudo bash"
        echo ""
        exit 1
    fi
    
    # 显示欢迎信息
    show_welcome
    
    # 执行卸载
    if [ "$UNINSTALL" = true ]; then
        uninstall_coclaw
        exit 0
    fi
    
    # 检查系统要求
    check_system_requirements
    
    # 检查 Node.js 和 npm
    check_nodejs
    check_npm
    
    # 检查/安装 OpenClaw
    if [ "$SKIP_OPENCLAW" = false ]; then
        if ! check_openclaw; then
            log_info "Coclaw 需要 OpenClaw 作为依赖"
            read -p "是否安装 OpenClaw？(Y/n): " response
            if [[ ! $response =~ ^[Nn]$ ]]; then
                install_openclaw
            else
                log_warn "跳过 OpenClaw 安装"
                log_info "注意：没有 OpenClaw，Coclaw 的部分功能将无法使用"
            fi
        fi
    else
        log_info "跳过 OpenClaw 检查（使用 --no-openclaw 选项）"
    fi
    
    # 安装 Coclaw
    install_coclaw "$LOCAL_INSTALL"
    
    # 创建配置文件
    create_config
    
    # 验证安装
    if verify_installation; then
        show_completion
    else
        log_error "安装验证失败"
        log_info "请检查安装日志或重新运行安装脚本"
        exit 1
    fi
}

# ============================================================================
# 脚本入口
# ============================================================================

# 捕获中断信号
trap 'log_error "安装被用户中断"; exit 1' INT

# 运行主函数
main "$@"

# 安装成功
exit 0