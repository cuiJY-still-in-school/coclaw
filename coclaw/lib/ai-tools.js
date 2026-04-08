const { cli } = require("./cli");

/**
 * AI Tool 集成模块
 * 为 AI Agent 提供与其他 Agent 通信的工具
 */
class AITools {
  constructor(config, serverManager) {
    this.config = config;
    this.serverManager = serverManager;
    this.tools = this.createTools();
  }

  /**
   * 创建 AI 工具集
   */
  createTools() {
    return [
      {
        type: "function",
        function: {
          name: "coclaw_send_message",
          description: "发送消息给其他 Agent",
          parameters: {
            type: "object",
            properties: {
              to_agent_id: {
                type: "string",
                description: "接收消息的 Agent ID",
              },
              message: {
                type: "string",
                description: "要发送的消息内容",
              },
              message_type: {
                type: "string",
                enum: ["text", "command", "query", "response"],
                description: "消息类型",
                default: "text",
              },
            },
            required: ["to_agent_id", "message"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_request_file_transfer",
          description: "请求发送文件给其他 Agent",
          parameters: {
            type: "object",
            properties: {
              to_agent_id: {
                type: "string",
                description: "接收文件的 Agent ID",
              },
              filename: {
                type: "string",
                description: "文件名",
              },
              description: {
                type: "string",
                description: "文件描述",
              },
              file_size: {
                type: "number",
                description: "文件大小（字节）",
              },
            },
            required: ["to_agent_id", "filename"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_list_agents",
          description: "列出所有可用的 Agent",
          parameters: {
            type: "object",
            properties: {
              include_remote: {
                type: "boolean",
                description: "是否包括远程 Agent",
                default: false,
              },
              filter_by_capability: {
                type: "string",
                description: "按能力过滤",
              },
            },
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_get_agent_info",
          description: "获取特定 Agent 的详细信息",
          parameters: {
            type: "object",
            properties: {
              agent_id: {
                type: "string",
                description: "Agent ID",
              },
            },
            required: ["agent_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_check_permission",
          description: "检查与特定 Agent 的通信权限",
          parameters: {
            type: "object",
            properties: {
              target_agent_id: {
                type: "string",
                description: "目标 Agent ID",
              },
              permission: {
                type: "string",
                enum: [
                  "send_message",
                  "receive_message",
                  "send_file",
                  "receive_file",
                ],
                description: "要检查的权限类型",
              },
            },
            required: ["target_agent_id", "permission"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_set_relationship",
          description: "设置与其他 Agent 的关系配置",
          parameters: {
            type: "object",
            properties: {
              target_agent_id: {
                type: "string",
                description: "目标 Agent ID",
              },
              trust_level: {
                type: "number",
                minimum: 0,
                maximum: 10,
                description: "信任级别 (0-10)",
              },
              auto_accept_messages: {
                type: "boolean",
                description: "是否自动接受消息",
              },
              auto_accept_files: {
                type: "boolean",
                description: "是否自动接受文件",
              },
            },
            required: ["target_agent_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_block_agent",
          description: "阻止特定 Agent",
          parameters: {
            type: "object",
            properties: {
              agent_id: {
                type: "string",
                description: "要阻止的 Agent ID",
              },
            },
            required: ["agent_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_unblock_agent",
          description: "取消阻止特定 Agent",
          parameters: {
            type: "object",
            properties: {
              agent_id: {
                type: "string",
                description: "要取消阻止的 Agent ID",
              },
            },
            required: ["agent_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_get_message_history",
          description: "获取与特定 Agent 的消息历史",
          parameters: {
            type: "object",
            properties: {
              with_agent_id: {
                type: "string",
                description: "对话的 Agent ID",
              },
              limit: {
                type: "number",
                description: "返回的消息数量限制",
                default: 20,
              },
              direction: {
                type: "string",
                enum: ["sent", "received", "all"],
                description: "消息方向",
                default: "all",
              },
            },
            required: ["with_agent_id"],
          },
        },
      },
      {
        type: "function",
        function: {
          name: "coclaw_get_server_status",
          description: "获取服务器状态信息",
          parameters: {
            type: "object",
            properties: {},
          },
        },
      },
    ];
  }

  /**
   * 执行 AI 工具
   */
  async executeTool(toolName, parameters, context) {
    const { agentId, wsClient } = context;

    if (!agentId) {
      throw new Error("需要 agentId 上下文来执行工具");
    }

    cli.debug(`AI Tool 执行: ${toolName} by ${agentId}`);

    switch (toolName) {
      case "coclaw_send_message":
        return await this.sendMessage(agentId, parameters, wsClient);

      case "coclaw_request_file_transfer":
        return await this.requestFileTransfer(agentId, parameters, wsClient);

      case "coclaw_list_agents":
        return await this.listAgents(agentId, parameters);

      case "coclaw_get_agent_info":
        return await this.getAgentInfo(agentId, parameters);

      case "coclaw_check_permission":
        return await this.checkPermission(agentId, parameters);

      case "coclaw_set_relationship":
        return await this.setRelationship(agentId, parameters);

      case "coclaw_block_agent":
        return await this.blockAgent(agentId, parameters);

      case "coclaw_unblock_agent":
        return await this.unblockAgent(agentId, parameters);

      case "coclaw_get_message_history":
        return await this.getMessageHistory(agentId, parameters);

      case "coclaw_get_server_status":
        return await this.getServerStatus(agentId);

      default:
        throw new Error(`未知的工具: ${toolName}`);
    }
  }

  /**
   * 发送消息
   */
  async sendMessage(agentId, parameters, wsClient) {
    const { to_agent_id, message, message_type = "text" } = parameters;

    if (!wsClient || wsClient.readyState !== 1) {
      throw new Error("WebSocket 连接不可用");
    }

    // 通过 WebSocket 发送消息
    wsClient.send(
      JSON.stringify({
        type: "agent_message",
        data: {
          fromAgentId: agentId,
          toAgentId: to_agent_id,
          message,
          messageType: message_type,
        },
      }),
    );

    return {
      success: true,
      message: "消息已发送",
      to_agent_id,
      message_type,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 请求文件传输
   */
  async requestFileTransfer(agentId, parameters, wsClient) {
    const {
      to_agent_id,
      filename,
      description = "",
      file_size = 0,
    } = parameters;

    if (!wsClient || wsClient.readyState !== 1) {
      throw new Error("WebSocket 连接不可用");
    }

    // 通过 WebSocket 发送文件传输请求
    wsClient.send(
      JSON.stringify({
        type: "file_transfer",
        data: {
          action: "request_upload",
          fromAgentId: agentId,
          toAgentId: to_agent_id,
          filename,
          description,
          size: file_size,
        },
      }),
    );

    return {
      success: true,
      message: "文件传输请求已发送",
      to_agent_id,
      filename,
      description,
      file_size,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 列出 Agent
   */
  async listAgents(agentId, parameters) {
    const { include_remote = false, filter_by_capability } = parameters;

    let agents = [];

    // 本地 Agent
    for (const agent of this.serverManager.agentRegistry.values()) {
      agents.push({
        agent_id: agent.agentId,
        name: agent.name,
        is_local: true,
        is_online: true,
        capabilities: agent.capabilities || [],
        port: agent.port,
      });
    }

    // 远程 Agent
    if (include_remote) {
      for (const agent of this.serverManager.serverRegistry.values()) {
        if (agent.isRemote) {
          agents.push({
            agent_id: agent.agentId,
            name: agent.name,
            is_local: false,
            is_online: true,
            capabilities: agent.capabilities || [],
            source_server: agent.sourceServer,
          });
        }
      }
    }

    // 按能力过滤
    if (filter_by_capability) {
      agents = agents.filter((agent) =>
        agent.capabilities.includes(filter_by_capability),
      );
    }

    return {
      success: true,
      agents,
      total_count: agents.length,
      local_count: agents.filter((a) => a.is_local).length,
      remote_count: agents.filter((a) => !a.is_local).length,
    };
  }

  /**
   * 获取 Agent 信息
   */
  async getAgentInfo(agentId, parameters) {
    const { agent_id } = parameters;

    // 检查本地 Agent
    let agent = this.serverManager.agentRegistry.get(agent_id);

    // 检查远程 Agent
    if (!agent) {
      for (const remoteAgent of this.serverManager.serverRegistry.values()) {
        if (remoteAgent.agentId === agent_id && remoteAgent.isRemote) {
          agent = remoteAgent;
          break;
        }
      }
    }

    if (!agent) {
      throw new Error(`Agent 未找到: ${agent_id}`);
    }

    // 获取关系配置
    const relationship =
      this.serverManager.relationshipManager.getRelationship(agentId);

    // 检查权限
    const canSendMessage =
      this.serverManager.relationshipManager.checkMessagePermission(
        agentId,
        agent_id,
        "text",
      ).hasPermission;

    const canSendFile =
      this.serverManager.relationshipManager.checkFilePermission(
        agentId,
        agent_id,
        {},
      ).hasPermission;

    return {
      success: true,
      agent_id: agent.agentId,
      name: agent.name,
      is_local: !agent.isRemote,
      is_online: true,
      capabilities: agent.capabilities || [],
      relationship: {
        trust_level: relationship.trustLevel || 5,
        auto_accept_messages: relationship.autoAcceptMessages || true,
        auto_accept_files: relationship.autoAcceptFiles || false,
        is_blocked: (relationship.blockList || []).includes(agent_id),
      },
      permissions: {
        can_send_message: canSendMessage,
        can_send_file: canSendFile,
      },
      connection_info: {
        port: agent.port,
        source_server: agent.sourceServer,
        registered_at: agent.registeredAt,
        last_seen: agent.lastSeen,
      },
    };
  }

  /**
   * 检查权限
   */
  async checkPermission(agentId, parameters) {
    const { target_agent_id, permission } = parameters;

    let checkResult;

    switch (permission) {
      case "send_message":
        checkResult =
          this.serverManager.relationshipManager.checkMessagePermission(
            agentId,
            target_agent_id,
            "text",
          );
        break;

      case "send_file":
        checkResult =
          this.serverManager.relationshipManager.checkFilePermission(
            agentId,
            target_agent_id,
            {},
          );
        break;

      case "receive_message":
        checkResult =
          this.serverManager.relationshipManager.checkMessagePermission(
            target_agent_id,
            agentId,
            "text",
          );
        break;

      case "receive_file":
        checkResult =
          this.serverManager.relationshipManager.checkFilePermission(
            target_agent_id,
            agentId,
            {},
          );
        break;

      default:
        throw new Error(`未知的权限类型: ${permission}`);
    }

    return {
      success: true,
      has_permission: checkResult.hasPermission,
      reason: checkResult.reason,
      agent_id: agentId,
      target_agent_id,
      permission,
    };
  }

  /**
   * 设置关系
   */
  async setRelationship(agentId, parameters) {
    const {
      target_agent_id,
      trust_level,
      auto_accept_messages,
      auto_accept_files,
    } = parameters;

    const relationship =
      this.serverManager.relationshipManager.getRelationship(agentId);

    // 更新配置
    if (trust_level !== undefined) {
      relationship.trustLevel = trust_level;
    }

    if (auto_accept_messages !== undefined) {
      relationship.autoAcceptMessages = auto_accept_messages;
    }

    if (auto_accept_files !== undefined) {
      relationship.autoAcceptFiles = auto_accept_files;
    }

    // 保存配置
    await this.serverManager.relationshipManager.setRelationship(
      agentId,
      relationship,
    );

    return {
      success: true,
      message: "关系配置已更新",
      agent_id: agentId,
      target_agent_id,
      updated_fields: Object.keys(parameters).filter(
        (key) => key !== "target_agent_id",
      ),
    };
  }

  /**
   * 阻止 Agent
   */
  async blockAgent(agentId, parameters) {
    const { agent_id } = parameters;

    await this.serverManager.relationshipManager.blockAgent(agentId, agent_id);

    return {
      success: true,
      message: "Agent 已阻止",
      agent_id: agentId,
      blocked_agent_id: agent_id,
    };
  }

  /**
   * 取消阻止 Agent
   */
  async unblockAgent(agentId, parameters) {
    const { agent_id } = parameters;

    await this.serverManager.relationshipManager.unblockAgent(
      agentId,
      agent_id,
    );

    return {
      success: true,
      message: "Agent 已取消阻止",
      agent_id: agentId,
      unblocked_agent_id: agent_id,
    };
  }

  /**
   * 获取消息历史
   */
  async getMessageHistory(agentId, parameters) {
    const { with_agent_id, limit = 20, direction = "all" } = parameters;

    // 这里需要消息系统的支持
    // 暂时返回模拟数据
    const messages = [
      {
        id: "msg_1",
        from_agent_id: agentId,
        to_agent_id: with_agent_id,
        message: "你好，这是测试消息",
        message_type: "text",
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        direction: "sent",
      },
      {
        id: "msg_2",
        from_agent_id: with_agent_id,
        to_agent_id: agentId,
        message: "收到，这是回复",
        message_type: "text",
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        direction: "received",
      },
    ];

    // 过滤方向
    let filteredMessages = messages;
    if (direction !== "all") {
      filteredMessages = messages.filter((msg) => msg.direction === direction);
    }

    // 限制数量
    filteredMessages = filteredMessages.slice(0, limit);

    return {
      success: true,
      messages: filteredMessages,
      total_count: messages.length,
      filtered_count: filteredMessages.length,
      with_agent_id,
    };
  }

  /**
   * 获取服务器状态
   */
  async getServerStatus(agentId) {
    const status = this.serverManager.getServerStatus();
    const relationshipStats = this.serverManager.relationshipManager.getStats();
    const connectionStatus = this.serverConnector
      ? this.serverConnector.getConnectionStatus()
      : { totalConnections: 0, activeConnections: 0 };

    return {
      success: true,
      server: {
        name: "Coclaw Server",
        version: require("../package.json").version,
        uptime: status.uptime,
        http_port: status.httpPort,
        ws_port: status.wsPort,
      },
      agents: {
        local_count: status.agentsCount,
        remote_count: this.serverManager.serverRegistry.size,
        total_count:
          status.agentsCount + this.serverManager.serverRegistry.size,
      },
      relationships: relationshipStats,
      connections: connectionStatus,
      files: {
        total_count: this.serverManager.fileRegistry.size,
        total_size: Array.from(this.serverManager.fileRegistry.values()).reduce(
          (sum, file) => sum + (file.size || 0),
          0,
        ),
      },
    };
  }

  /**
   * 获取工具描述（用于 AI 系统集成）
   */
  getToolsDescription() {
    return this.tools;
  }

  /**
   * 验证工具调用
   */
  validateToolCall(toolCall) {
    const { name, arguments: args } = toolCall;

    // 查找工具定义
    const toolDef = this.tools.find((tool) => tool.function.name === name);
    if (!toolDef) {
      throw new Error(`未知的工具: ${name}`);
    }

    // 验证参数
    const { parameters } = toolDef.function;
    const { properties, required = [] } = parameters;

    // 检查必需参数
    for (const param of required) {
      if (args[param] === undefined) {
        throw new Error(`缺少必需参数: ${param}`);
      }
    }

    // 验证参数类型
    for (const [paramName, paramValue] of Object.entries(args)) {
      const paramDef = properties[paramName];
      if (!paramDef) {
        throw new Error(`未知参数: ${paramName}`);
      }

      // 类型验证
      if (paramDef.type === "number" && typeof paramValue !== "number") {
        throw new Error(`参数 ${paramName} 必须是数字`);
      } else if (paramDef.type === "string" && typeof paramValue !== "string") {
        throw new Error(`参数 ${paramName} 必须是字符串`);
      } else if (
        paramDef.type === "boolean" &&
        typeof paramValue !== "boolean"
      ) {
        throw new Error(`参数 ${paramName} 必须是布尔值`);
      }

      // 枚举验证
      if (paramDef.enum && !paramDef.enum.includes(paramValue)) {
        throw new Error(
          `参数 ${paramName} 必须是以下值之一: ${paramDef.enum.join(", ")}`,
        );
      }

      // 范围验证
      if (paramDef.minimum !== undefined && paramValue < paramDef.minimum) {
        throw new Error(`参数 ${paramName} 必须大于等于 ${paramDef.minimum}`);
      }
      if (paramDef.maximum !== undefined && paramValue > paramDef.maximum) {
        throw new Error(`参数 ${paramName} 必须小于等于 ${paramDef.maximum}`);
      }
    }

    return true;
  }
}

module.exports = AITools;
