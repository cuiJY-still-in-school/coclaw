const inquirer = require("inquirer");
const { cli } = require("./cli");
const Config = require("./config");
const RelationshipManager = require("./relationship-manager");

/**
 * 关系配置 CLI
 */
class RelationCLI {
  constructor() {
    this.config = null;
    this.relationshipManager = null;
  }

  /**
   * 初始化
   */
  async init() {
    this.config = new Config();
    await this.config.load();
    this.relationshipManager = new RelationshipManager(this.config);
  }

  /**
   * 配置 Agent 关系
   */
  async configureAgentRelation(agentId) {
    await this.init();

    cli.title(`配置 Agent 关系: ${agentId}`);

    // 获取当前关系配置
    const relationship = this.relationshipManager.getRelationship(agentId);

    // 主菜单
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "选择要配置的关系选项:",
        choices: [
          { name: "查看当前配置", value: "view" },
          { name: "编辑默认权限", value: "edit_default" },
          { name: "配置特定 Agent 权限", value: "edit_agent" },
          { name: "管理阻止列表", value: "block_list" },
          { name: "设置信任级别", value: "trust" },
          { name: "配置自动接受", value: "auto_accept" },
          { name: "配置文件限制", value: "file_limits" },
          { name: "导出配置", value: "export" },
          { name: "导入配置", value: "import" },
          { name: "返回", value: "back" },
        ],
      },
    ]);

    switch (action) {
      case "view":
        await this.viewRelationship(agentId, relationship);
        break;

      case "edit_default":
        await this.editDefaultPermissions(agentId, relationship);
        break;

      case "edit_agent":
        await this.editAgentPermissions(agentId, relationship);
        break;

      case "block_list":
        await this.manageBlockList(agentId, relationship);
        break;

      case "trust":
        await this.setTrustLevel(agentId, relationship);
        break;

      case "auto_accept":
        await this.configureAutoAccept(agentId, relationship);
        break;

      case "file_limits":
        await this.configureFileLimits(agentId, relationship);
        break;

      case "export":
        await this.exportRelationship(agentId);
        break;

      case "import":
        await this.importRelationship(agentId);
        break;

      case "back":
        return;
    }

    // 递归调用以继续配置
    await this.configureAgentRelation(agentId);
  }

  /**
   * 查看关系配置
   */
  async viewRelationship(agentId, relationship) {
    cli.subtitle(`Agent ${agentId} 的关系配置`);

    // 显示默认权限
    cli.section("默认权限");
    for (const [permission, value] of Object.entries(
      relationship.defaultPermissions,
    )) {
      cli.info(
        `  ${this.formatPermissionName(permission)}: ${value ? "✅ 允许" : "❌ 拒绝"}`,
      );
    }

    // 显示特定 Agent 权限
    if (
      relationship.agentOverrides &&
      Object.keys(relationship.agentOverrides).length > 0
    ) {
      cli.section("特定 Agent 权限覆盖");
      for (const [targetAgentId, overrides] of Object.entries(
        relationship.agentOverrides,
      )) {
        cli.info(`  ${targetAgentId}:`);
        for (const [permission, value] of Object.entries(overrides)) {
          cli.info(
            `    ${this.formatPermissionName(permission)}: ${value ? "✅ 允许" : "❌ 拒绝"}`,
          );
        }
      }
    }

    // 显示阻止列表
    if (relationship.blockList && relationship.blockList.length > 0) {
      cli.section("阻止列表");
      relationship.blockList.forEach((blockedId) => {
        cli.info(`  ❌ ${blockedId}`);
      });
    }

    // 显示其他配置
    cli.section("其他配置");
    cli.info(`  信任级别: ${relationship.trustLevel || 5}/10`);
    cli.info(
      `  自动接受消息: ${relationship.autoAcceptMessages ? "✅ 是" : "❌ 否"}`,
    );
    cli.info(
      `  自动接受文件: ${relationship.autoAcceptFiles ? "✅ 是" : "❌ 否"}`,
    );
    cli.info(
      `  最大文件大小: ${this.formatFileSize(relationship.maxFileSize || 10 * 1024 * 1024)}`,
    );
    cli.info(
      `  允许的文件类型: ${(relationship.allowedFileTypes || ["*"]).join(", ")}`,
    );

    await inquirer.prompt([
      {
        type: "confirm",
        name: "continue",
        message: "按 Enter 键继续",
        default: true,
      },
    ]);
  }

  /**
   * 编辑默认权限
   */
  async editDefaultPermissions(agentId, relationship) {
    cli.subtitle("编辑默认权限");

    const questions = Object.entries(relationship.defaultPermissions).map(
      ([permission, currentValue]) => ({
        type: "confirm",
        name: permission,
        message: `是否允许 ${this.formatPermissionName(permission)}?`,
        default: currentValue,
      }),
    );

    const answers = await inquirer.prompt(questions);

    // 更新权限
    relationship.defaultPermissions = {
      ...relationship.defaultPermissions,
      ...answers,
    };

    await this.relationshipManager.setRelationship(agentId, relationship);
    cli.success("默认权限已更新");
  }

  /**
   * 编辑特定 Agent 权限
   */
  async editAgentPermissions(agentId, relationship) {
    cli.subtitle("配置特定 Agent 权限");

    // 获取所有 Agent（排除自己）
    // 这里需要 Agent 管理器，暂时使用空列表
    const agents = []; // 实际应该从 Agent 管理器获取

    if (agents.length === 0) {
      cli.info("没有其他 Agent 可以配置");
      return;
    }

    // 选择 Agent
    const { targetAgentId } = await inquirer.prompt([
      {
        type: "list",
        name: "targetAgentId",
        message: "选择要配置的 Agent:",
        choices: agents.map((agent) => ({
          name: `${agent.id} (${agent.name})`,
          value: agent.id,
        })),
      },
    ]);

    // 获取当前覆盖
    const currentOverrides = relationship.agentOverrides?.[targetAgentId] || {};

    // 配置权限
    const questions = Object.entries(relationship.defaultPermissions).map(
      ([permission, defaultValue]) => ({
        type: "confirm",
        name: permission,
        message: `是否允许 ${this.formatPermissionName(permission)}?`,
        default:
          currentOverrides[permission] !== undefined
            ? currentOverrides[permission]
            : defaultValue,
      }),
    );

    const answers = await inquirer.prompt(questions);

    // 只保存与默认值不同的权限
    const newOverrides = {};
    for (const [permission, value] of Object.entries(answers)) {
      if (value !== relationship.defaultPermissions[permission]) {
        newOverrides[permission] = value;
      }
    }

    // 更新配置
    if (!relationship.agentOverrides) {
      relationship.agentOverrides = {};
    }

    if (Object.keys(newOverrides).length > 0) {
      relationship.agentOverrides[targetAgentId] = newOverrides;
    } else {
      delete relationship.agentOverrides[targetAgentId];
    }

    await this.relationshipManager.setRelationship(agentId, relationship);

    if (Object.keys(newOverrides).length > 0) {
      cli.success(`已更新 ${targetAgentId} 的权限覆盖`);
    } else {
      cli.success(`已移除 ${targetAgentId} 的权限覆盖（使用默认值）`);
    }
  }

  /**
   * 管理阻止列表
   */
  async manageBlockList(agentId, relationship) {
    cli.subtitle("管理阻止列表");

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "选择操作:",
        choices: [
          { name: "查看阻止列表", value: "view" },
          { name: "添加 Agent 到阻止列表", value: "add" },
          { name: "从阻止列表移除 Agent", value: "remove" },
          { name: "清空阻止列表", value: "clear" },
          { name: "返回", value: "back" },
        ],
      },
    ]);

    switch (action) {
      case "view":
        await this.viewBlockList(agentId, relationship);
        break;

      case "add":
        await this.addToBlockList(agentId, relationship);
        break;

      case "remove":
        await this.removeFromBlockList(agentId, relationship);
        break;

      case "clear":
        await this.clearBlockList(agentId, relationship);
        break;

      case "back":
        return;
    }
  }

  /**
   * 查看阻止列表
   */
  async viewBlockList(agentId, relationship) {
    const blockList = relationship.blockList || [];

    if (blockList.length === 0) {
      cli.info("阻止列表为空");
    } else {
      cli.info("阻止的 Agent:");
      blockList.forEach((blockedId, index) => {
        cli.info(`  ${index + 1}. ❌ ${blockedId}`);
      });
    }

    await inquirer.prompt([
      {
        type: "confirm",
        name: "continue",
        message: "按 Enter 键继续",
        default: true,
      },
    ]);
  }

  /**
   * 添加到阻止列表
   */
  async addToBlockList(agentId, relationship) {
    // 获取所有 Agent（排除自己）
    const agents = []; // 实际应该从 Agent 管理器获取

    if (agents.length === 0) {
      cli.info("没有其他 Agent 可以阻止");
      return;
    }

    const { targetAgentId } = await inquirer.prompt([
      {
        type: "list",
        name: "targetAgentId",
        message: "选择要阻止的 Agent:",
        choices: agents
          .filter((agent) => !(relationship.blockList || []).includes(agent.id))
          .map((agent) => ({
            name: `${agent.id} (${agent.name})`,
            value: agent.id,
          })),
      },
    ]);

    await this.relationshipManager.blockAgent(agentId, targetAgentId);
    cli.success(`已阻止 Agent: ${targetAgentId}`);
  }

  /**
   * 从阻止列表移除
   */
  async removeFromBlockList(agentId, relationship) {
    const blockList = relationship.blockList || [];

    if (blockList.length === 0) {
      cli.info("阻止列表为空");
      return;
    }

    const { targetAgentId } = await inquirer.prompt([
      {
        type: "list",
        name: "targetAgentId",
        message: "选择要取消阻止的 Agent:",
        choices: blockList.map((blockedId) => ({
          name: blockedId,
          value: blockedId,
        })),
      },
    ]);

    await this.relationshipManager.unblockAgent(agentId, targetAgentId);
    cli.success(`已取消阻止 Agent: ${targetAgentId}`);
  }

  /**
   * 清空阻止列表
   */
  async clearBlockList(agentId, relationship) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "确定要清空阻止列表吗？",
        default: false,
      },
    ]);

    if (confirm) {
      relationship.blockList = [];
      await this.relationshipManager.setRelationship(agentId, relationship);
      cli.success("阻止列表已清空");
    }
  }

  /**
   * 设置信任级别
   */
  async setTrustLevel(agentId, relationship) {
    cli.subtitle("设置信任级别");

    const { trustLevel } = await inquirer.prompt([
      {
        type: "number",
        name: "trustLevel",
        message: "输入信任级别 (0-10):",
        default: relationship.trustLevel || 5,
        validate: (value) => {
          if (value < 0 || value > 10) {
            return "信任级别必须在 0-10 之间";
          }
          return true;
        },
      },
    ]);

    relationship.trustLevel = trustLevel;
    await this.relationshipManager.setRelationship(agentId, relationship);
    cli.success(`信任级别已设置为: ${trustLevel}/10`);
  }

  /**
   * 配置自动接受
   */
  async configureAutoAccept(agentId, relationship) {
    cli.subtitle("配置自动接受");

    const answers = await inquirer.prompt([
      {
        type: "confirm",
        name: "autoAcceptMessages",
        message: "是否自动接受消息？",
        default: relationship.autoAcceptMessages !== false,
      },
      {
        type: "confirm",
        name: "autoAcceptFiles",
        message: "是否自动接受文件？",
        default: relationship.autoAcceptFiles || false,
      },
    ]);

    relationship.autoAcceptMessages = answers.autoAcceptMessages;
    relationship.autoAcceptFiles = answers.autoAcceptFiles;

    await this.relationshipManager.setRelationship(agentId, relationship);
    cli.success("自动接受配置已更新");
  }

  /**
   * 配置文件限制
   */
  async configureFileLimits(agentId, relationship) {
    cli.subtitle("配置文件限制");

    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "maxFileSize",
        message: "最大文件大小 (例如: 10MB, 100MB, 1GB):",
        default: this.formatFileSize(
          relationship.maxFileSize || 10 * 1024 * 1024,
        ),
        validate: (value) => {
          const match = value.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
          if (!match) {
            return "请输入有效的文件大小，例如: 10MB, 100MB, 1GB";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "allowedFileTypes",
        message: "允许的文件类型 (用逗号分隔，* 表示所有类型):",
        default: (relationship.allowedFileTypes || ["*"]).join(", "),
      },
    ]);

    // 解析文件大小
    const sizeMatch = answers.maxFileSize.match(
      /^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i,
    );
    let maxFileSize = 10 * 1024 * 1024; // 默认 10MB

    if (sizeMatch) {
      const size = parseFloat(sizeMatch[1]);
      const unit = sizeMatch[2].toUpperCase();

      switch (unit) {
        case "B":
          maxFileSize = size;
          break;
        case "KB":
          maxFileSize = size * 1024;
          break;
        case "MB":
          maxFileSize = size * 1024 * 1024;
          break;
        case "GB":
          maxFileSize = size * 1024 * 1024 * 1024;
          break;
      }
    }

    // 解析文件类型
    const allowedFileTypes = answers.allowedFileTypes
      .split(",")
      .map((type) => type.trim())
      .filter((type) => type.length > 0);

    relationship.maxFileSize = maxFileSize;
    relationship.allowedFileTypes =
      allowedFileTypes.length > 0 ? allowedFileTypes : ["*"];

    await this.relationshipManager.setRelationship(agentId, relationship);
    cli.success("文件限制配置已更新");
  }

  /**
   * 导出关系配置
   */
  async exportRelationship(agentId) {
    cli.subtitle("导出关系配置");

    const relationship = this.relationshipManager.getRelationship(agentId);
    const exportData = {
      [agentId]: relationship,
    };

    cli.info("关系配置 JSON:");
    cli.info(JSON.stringify(exportData, null, 2));

    const { saveToFile } = await inquirer.prompt([
      {
        type: "confirm",
        name: "saveToFile",
        message: "是否保存到文件？",
        default: false,
      },
    ]);

    if (saveToFile) {
      const { filename } = await inquirer.prompt([
        {
          type: "input",
          name: "filename",
          message: "输入文件名:",
          default: `relationship_${agentId}_${new Date().toISOString().split("T")[0]}.json`,
        },
      ]);

      const fs = require("fs-extra");
      const path = require("path");

      const filePath = path.join(process.cwd(), filename);
      await fs.writeFile(filePath, JSON.stringify(exportData, null, 2));

      cli.success(`配置已保存到: ${filePath}`);
    }
  }

  /**
   * 导入关系配置
   */
  async importRelationship(agentId) {
    cli.subtitle("导入关系配置");

    const { importMethod } = await inquirer.prompt([
      {
        type: "list",
        name: "importMethod",
        message: "选择导入方式:",
        choices: [
          { name: "从文件导入", value: "file" },
          { name: "粘贴 JSON", value: "json" },
          { name: "返回", value: "back" },
        ],
      },
    ]);

    if (importMethod === "back") {
      return;
    }

    let importData;

    if (importMethod === "file") {
      const { filename } = await inquirer.prompt([
        {
          type: "input",
          name: "filename",
          message: "输入文件名:",
          default: "relationship.json",
        },
      ]);

      const fs = require("fs-extra");
      const path = require("path");

      const filePath = path.join(process.cwd(), filename);
      if (!(await fs.pathExists(filePath))) {
        cli.error(`文件不存在: ${filePath}`);
        return;
      }

      try {
        const content = await fs.readFile(filePath, "utf8");
        importData = JSON.parse(content);
      } catch (error) {
        cli.error(`读取文件失败: ${error.message}`);
        return;
      }
    } else if (importMethod === "json") {
      const { json } = await inquirer.prompt([
        {
          type: "editor",
          name: "json",
          message: "粘贴 JSON 配置:",
        },
      ]);

      try {
        importData = JSON.parse(json);
      } catch (error) {
        cli.error(`JSON 解析失败: ${error.message}`);
        return;
      }
    }

    // 验证导入数据
    if (!importData || typeof importData !== "object") {
      cli.error("导入数据无效");
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "确定要导入配置吗？这将覆盖现有配置。",
        default: false,
      },
    ]);

    if (confirm) {
      try {
        await this.relationshipManager.importRelationships(importData);
        cli.success("关系配置已导入");
      } catch (error) {
        cli.error(`导入失败: ${error.message}`);
      }
    }
  }

  /**
   * 格式化权限名称
   */
  formatPermissionName(permission) {
    const names = {
      sendMessage: "发送消息",
      receiveMessage: "接收消息",
      sendFile: "发送文件",
      receiveFile: "接收文件",
      executeCommand: "执行命令",
      accessFiles: "访问文件",
    };

    return names[permission] || permission;
  }

  /**
   * 格式化文件大小
   */
  formatFileSize(bytes) {
    if (bytes < 1024) {
      return `${bytes} B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
  }
}

module.exports = RelationCLI;
