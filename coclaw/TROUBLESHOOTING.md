# Coclaw 故障排除指南

本文档提供 Coclaw 系统的故障排除指南，帮助您诊断和解决常见问题。

## 目录

1. [快速诊断](#快速诊断)
2. [常见问题](#常见问题)
3. [错误代码参考](#错误代码参考)
4. [性能问题](#性能问题)
5. [网络问题](#网络问题)
6. [文件传输问题](#文件传输问题)
7. [权限和认证问题](#权限和认证问题)
8. [服务器管理](#服务器管理)
9. [监控和日志](#监控和日志)
10. [高级故障排除](#高级故障排除)

## 快速诊断

### 1. 检查服务器状态

```bash
# 检查服务器是否运行
coclaw server status

# 或使用健康检查端点
curl http://localhost:18790/health
```

### 2. 检查错误统计

```bash
# 查看错误统计
coclaw errors

# 列出最近错误
coclaw errors --list
```

### 3. 检查性能统计

```bash
# 查看性能统计
coclaw performance
```

### 4. 检查 Agent 状态

```bash
# 列出所有 Agent
coclaw list
```

## 常见问题

### 问题1: 服务器无法启动

**症状**: `coclaw server` 命令失败，显示端口被占用或其他错误。

**解决方案**:

1. 检查端口是否被占用:

   ```bash
   lsof -i :18790
   lsof -i :18791
   ```

2. 停止占用端口的进程:

   ```bash
   kill -9 <PID>
   ```

3. 更改服务器端口:

   ```bash
   # 编辑配置文件
   nano ~/.coclaw/config.json
   # 修改 server.port 设置
   ```

4. 检查权限:
   ```bash
   # 确保有权限绑定到端口
   sudo setcap 'cap_net_bind_service=+ep' $(which node)
   ```

### 问题2: Agent 无法连接

**症状**: Agent 显示连接失败或超时。

**解决方案**:

1. 检查服务器是否运行:

   ```bash
   coclaw server status
   ```

2. 检查防火墙设置:

   ```bash
   # 临时禁用防火墙测试
   sudo ufw disable
   # 或添加规则
   sudo ufw allow 18790/tcp
   sudo ufw allow 18791/tcp
   ```

3. 检查网络配置:

   ```bash
   # 测试本地连接
   curl http://localhost:18790/health

   # 测试远程连接
   curl http://<server-ip>:18790/health
   ```

### 问题3: 文件传输失败

**症状**: 文件上传或下载失败，显示权限错误或超时。

**解决方案**:

1. 检查文件大小限制:

   ```bash
   # 默认限制为 100MB
   # 可以在配置中调整
   ```

2. 检查磁盘空间:

   ```bash
   df -h
   ```

3. 检查文件权限:

   ```bash
   ls -la ~/.coclaw/files/
   ```

4. 使用调试模式:
   ```bash
   DEBUG=coclaw:* coclaw agent <id> send-file <file>
   ```

## 错误代码参考

### 网络错误 (1000-1999)

| 代码 | 名称                      | 描述         | 解决方案                     |
| ---- | ------------------------- | ------------ | ---------------------------- |
| 1001 | NETWORK_CONNECTION_FAILED | 网络连接失败 | 检查网络连接和防火墙         |
| 1002 | NETWORK_TIMEOUT           | 网络超时     | 增加超时设置或检查网络质量   |
| 1003 | NETWORK_DISCONNECTED      | 网络断开     | 重新连接或检查网络稳定性     |
| 1004 | NETWORK_PROTOCOL_ERROR    | 网络协议错误 | 检查客户端和服务器版本兼容性 |

### 认证错误 (2000-2999)

| 代码 | 名称                   | 描述         | 解决方案                     |
| ---- | ---------------------- | ------------ | ---------------------------- |
| 2001 | AUTH_TOKEN_INVALID     | 令牌无效     | 重新生成令牌或检查令牌有效期 |
| 2002 | AUTH_TOKEN_EXPIRED     | 令牌过期     | 获取新令牌                   |
| 2003 | AUTH_PERMISSION_DENIED | 权限被拒绝   | 检查关系配置和权限设置       |
| 2004 | AUTH_AGENT_NOT_FOUND   | Agent 未找到 | 检查 Agent ID 是否正确       |

### 消息错误 (3000-3999)

| 代码 | 名称                    | 描述         | 解决方案                       |
| ---- | ----------------------- | ------------ | ------------------------------ |
| 3001 | MESSAGE_FORMAT_INVALID  | 消息格式无效 | 检查消息 JSON 格式             |
| 3002 | MESSAGE_ROUTING_FAILED  | 消息路由失败 | 检查目标 Agent 是否在线        |
| 3003 | MESSAGE_QUEUE_FULL      | 消息队列已满 | 减少消息发送频率或增加队列大小 |
| 3004 | MESSAGE_DELIVERY_FAILED | 消息投递失败 | 检查网络连接和目标状态         |

### 文件错误 (4000-4999)

| 代码 | 名称                  | 描述           | 解决方案                     |
| ---- | --------------------- | -------------- | ---------------------------- |
| 4001 | FILE_UPLOAD_FAILED    | 文件上传失败   | 检查文件大小、权限和磁盘空间 |
| 4002 | FILE_DOWNLOAD_FAILED  | 文件下载失败   | 检查文件是否存在和权限       |
| 4003 | FILE_SIZE_EXCEEDED    | 文件大小超限   | 减小文件大小或调整配置       |
| 4004 | FILE_TYPE_NOT_ALLOWED | 文件类型不允许 | 检查文件类型限制配置         |
| 4005 | FILE_NOT_FOUND        | 文件未找到     | 检查文件 ID 是否正确         |
| 4006 | FILE_EXPIRED          | 文件已过期     | 文件已超过保留期限           |

### 服务器错误 (5000-5999)

| 代码 | 名称                   | 描述           | 解决方案               |
| ---- | ---------------------- | -------------- | ---------------------- |
| 5001 | SERVER_START_FAILED    | 服务器启动失败 | 检查端口占用和权限     |
| 5002 | SERVER_SHUTDOWN_FAILED | 服务器关闭失败 | 强制终止进程或等待     |
| 5003 | SERVER_RESOURCE_LIMIT  | 服务器资源限制 | 增加系统资源或优化配置 |
| 5004 | SERVER_CONFIG_ERROR    | 服务器配置错误 | 检查配置文件格式和内容 |

## 性能问题

### 症状: 消息延迟高

**诊断**:

```bash
# 查看性能统计
coclaw performance

# 检查消息延迟
# 如果平均延迟 > 100ms，可能存在性能问题
```

**解决方案**:

1. 启用消息压缩:

   ```bash
   # 通过 API 启用消息压缩
   curl -X POST http://localhost:18790/api/performance/control \
     -H "Content-Type: application/json" \
     -d '{"action":"update_strategy","strategyName":"messageCompression","updates":{"enabled":true}}'
   ```

2. 启用消息批处理:

   ```bash
   curl -X POST http://localhost:18790/api/performance/control \
     -H "Content-Type: application/json" \
     -d '{"action":"update_strategy","strategyName":"messageBatching","updates":{"enabled":true,"batchSize":20}}'
   ```

3. 优化连接池:
   ```bash
   curl -X POST http://localhost:18790/api/performance/control \
     -H "Content-Type: application/json" \
     -d '{"action":"update_strategy","strategyName":"connectionPooling","updates":{"maxPoolSize":100}}'
   ```

### 症状: 文件传输速度慢

**诊断**:

```bash
# 查看文件传输统计
coclaw performance
# 检查文件传输平均速度
```

**解决方案**:

1. 启用文件分块传输:

   ```bash
   curl -X POST http://localhost:18790/api/performance/control \
     -H "Content-Type: application/json" \
     -d '{"action":"update_strategy","strategyName":"fileTransferOptimization","updates":{"enabled":true,"chunkSize":131072}}'
   ```

2. 启用并行传输:

   ```bash
   curl -X POST http://localhost:18790/api/performance/control \
     -H "Content-Type: application/json" \
     -d '{"action":"update_strategy","strategyName":"fileTransferOptimization","updates":{"parallelUploads":5}}'
   ```

3. 调整缓冲区大小:
   ```bash
   curl -X POST http://localhost:18790/api/performance/control \
     -H "Content-Type: application/json" \
     -d '{"action":"update_strategy","strategyName":"fileTransferOptimization","updates":{"bufferPoolSize":20}}'
   ```

## 网络问题

### 症状: 连接不稳定

**诊断**:

```bash
# 检查网络连接
ping <server-ip>

# 检查端口连通性
telnet <server-ip> 18790
telnet <server-ip> 18791
```

**解决方案**:

1. 检查网络质量:

   ```bash
   # 测试网络延迟和丢包
   mtr <server-ip>
   ```

2. 调整超时设置:

   ```bash
   # 在配置文件中增加超时时间
   {
     "server": {
       "timeout": 30000,
       "keepalive": 60000
     }
   }
   ```

3. 启用自动重连:
   ```bash
   # 客户端配置中启用自动重连
   {
     "reconnect": {
       "enabled": true,
       "maxAttempts": 10,
       "interval": 5000
     }
   }
   ```

### 症状: 跨网络无法连接

**解决方案**:

1. 配置端口转发:

   ```bash
   # 在路由器上配置端口转发
   # 外部端口 18790 -> 内部服务器 IP:18790
   # 外部端口 18791 -> 内部服务器 IP:18791
   ```

2. 使用 VPN 或内网穿透:

   ```bash
   # 推荐使用 Tailscale、ZeroTier 或 frp
   ```

3. 配置反向代理:
   ```nginx
   # Nginx 配置示例
   server {
     listen 80;
     server_name your-domain.com;

     location / {
       proxy_pass http://localhost:18790;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
     }
   }
   ```

## 文件传输问题

### 症状: 大文件传输失败

**解决方案**:

1. 增加文件大小限制:

   ```bash
   # 编辑配置文件
   {
     "file": {
       "maxSize": 1073741824  # 1GB
     }
   }
   ```

2. 启用分块传输:

   ```bash
   # 使用分块传输大文件
   coclaw agent <id> send-file --chunked <large-file>
   ```

3. 检查磁盘空间:
   ```bash
   # 确保有足够磁盘空间
   df -h ~/.coclaw/files/
   ```

### 症状: 文件权限错误

**解决方案**:

1. 检查文件权限:

   ```bash
   ls -la ~/.coclaw/
   chmod 755 ~/.coclaw
   chmod 755 ~/.coclaw/files
   ```

2. 以正确用户运行:

   ```bash
   # 确保以文件所有者身份运行
   sudo -u <username> coclaw server
   ```

3. 检查 SELinux/AppArmor:
   ```bash
   # 临时禁用测试
   sudo setenforce 0
   # 或添加规则
   ```

## 权限和认证问题

### 症状: 权限被拒绝

**诊断**:

```bash
# 检查关系配置
coclaw agent <id> relationships

# 检查权限设置
```

**解决方案**:

1. 调整信任级别:

   ```bash
   # 增加信任级别 (0-10)
   coclaw agent <id> trust <level>
   ```

2. 配置特定权限:

   ```bash
   # 允许特定操作
   coclaw agent <id> allow <target-agent> <permission>
   ```

3. 检查阻止列表:
   ```bash
   # 查看是否被阻止
   coclaw agent <id> blocked
   # 取消阻止
   coclaw agent <id> unblock <agent-id>
   ```

### 症状: 令牌无效或过期

**解决方案**:

1. 重新生成令牌:

   ```bash
   # 文件上传令牌会自动生成
   # 下载令牌需要重新请求
   ```

2. 调整令牌有效期:

   ```bash
   # 在配置文件中调整
   {
     "token": {
       "expiration": 3600  # 1小时
     }
   }
   ```

3. 检查时钟同步:
   ```bash
   # 确保服务器和客户端时钟同步
   date
   sudo ntpdate pool.ntp.org
   ```

## 服务器管理

### 症状: 服务器资源占用高

**诊断**:

```bash
# 查看服务器资源使用
top -p $(pgrep -f "coclaw server")

# 检查内存使用
ps aux | grep coclaw
```

**解决方案**:

1. 限制连接数:

   ```bash
   # 在配置文件中设置
   {
     "server": {
       "maxConnections": 100
     }
   }
   ```

2. 启用资源清理:

   ```bash
   # 确保资源清理定时任务运行
   # 检查日志中的清理记录
   ```

3. 重启服务器:
   ```bash
   coclaw server stop
   coclaw server start
   ```

### 症状: 服务器崩溃或重启

**诊断**:

```bash
# 检查错误日志
tail -f ~/.coclaw/logs/errors.json

# 检查系统日志
journalctl -u coclaw
```

**解决方案**:

1. 增加内存限制:

   ```bash
   # 使用系统服务管理
   # 在 systemd 服务文件中增加内存限制
   ```

2. 启用监控和告警:

   ```bash
   # 配置监控告警
   # 使用健康检查端点监控
   ```

3. 配置自动重启:
   ```bash
   # 使用 systemd 或 supervisor 配置自动重启
   ```

## 监控和日志

### 访问监控数据

1. 健康检查端点:

   ```bash
   curl http://localhost:18790/health
   ```

2. 性能统计端点:

   ```bash
   curl http://localhost:18790/api/performance/stats
   ```

3. 监控指标端点:
   ```bash
   curl http://localhost:18790/metrics
   ```

### 查看日志文件

1. 错误日志:

   ```bash
   cat ~/.coclaw/logs/errors.json
   ```

2. 服务器日志:

   ```bash
   cat ~/.coclaw/logs/server.log
   ```

3. 访问日志:
   ```bash
   cat ~/.coclaw/logs/access.log
   ```

### 启用调试模式

```bash
# 启用详细日志
DEBUG=coclaw:* coclaw server

# 或设置环境变量
export DEBUG=coclaw:*
coclaw server
```

## 高级故障排除

### 使用诊断工具

1. 运行负载测试:

   ```bash
   node test-load-stability.js
   ```

2. 运行端到端测试:

   ```bash
   node test-e2e-scenario.js
   ```

3. 检查系统依赖:

   ```bash
   # 检查 Node.js 版本
   node --version

   # 检查 npm 包
   npm list
   ```

### 网络诊断工具

1. 使用 tcpdump 分析网络流量:

   ```bash
   sudo tcpdump -i any port 18790 or port 18791 -w capture.pcap
   ```

2. 使用 wireshark 分析:

   ```bash
   wireshark capture.pcap
   ```

3. 使用 netstat 查看连接:
   ```bash
   netstat -tulpn | grep 18790
   ```

### 性能分析工具

1. 使用 Node.js 性能分析:

   ```bash
   node --prof server.js
   node --prof-process isolate-0x*.log > processed.txt
   ```

2. 使用 clinic.js:

   ```bash
   npm install -g clinic
   clinic doctor -- node server.js
   ```

3. 使用 heapdump:
   ```bash
   # 在代码中添加
   const heapdump = require('heapdump');
   heapdump.writeSnapshot();
   ```

### 联系支持

如果以上方法都无法解决问题:

1. 收集诊断信息:

   ```bash
   # 收集系统信息
   uname -a
   node --version
   npm --version

   # 收集日志文件
   tar -czf coclaw-debug.tar.gz ~/.coclaw/logs/
   ```

2. 创建问题报告:
   - 描述问题现象
   - 提供错误信息
   - 附上相关日志
   - 说明复现步骤

3. 提交到 GitHub Issues:
   - 访问: https://github.com/your-org/coclaw/issues
   - 创建新 issue
   - 附上诊断信息

## 预防措施

### 定期维护

1. 清理旧文件:

   ```bash
   # 自动清理过期文件
   # 服务器会自动清理24小时前的文件
   ```

2. 监控磁盘空间:

   ```bash
   # 设置磁盘空间监控
   df -h | grep /home
   ```

3. 更新软件:
   ```bash
   # 定期更新 Coclaw
   npm update -g coclaw
   ```

### 备份配置

1. 备份配置文件:

   ```bash
   cp -r ~/.coclaw ~/.coclaw.backup
   ```

2. 导出关系配置:

   ```bash
   curl http://localhost:18790/api/relationships/export > relationships-backup.json
   ```

3. 定期备份数据:
   ```bash
   tar -czf coclaw-backup-$(date +%Y%m%d).tar.gz ~/.coclaw
   ```

### 安全最佳实践

1. 使用防火墙:

   ```bash
   # 只允许信任的 IP 访问
   sudo ufw allow from 192.168.1.0/24 to any port 18790
   sudo ufw allow from 192.168.1.0/24 to any port 18791
   ```

2. 定期轮换令牌:

   ```bash
   # 在配置中设置较短的令牌有效期
   {
     "token": {
       "expiration": 3600  # 1小时
     }
   }
   ```

3. 监控异常活动:
   ```bash
   # 检查异常连接
   coclaw performance
   # 检查错误统计
   coclaw errors
   ```

---

**最后更新**: 2025-04-07  
**版本**: 1.0.0  
**作者**: Coclaw 开发团队
