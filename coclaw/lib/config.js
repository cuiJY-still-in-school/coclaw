const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const { cli } = require("./cli");

/**
 * 配置管理类
 */
class Config {
  constructor() {
    this.configDir = path.join(os.homedir(), ".coclaw");
    this.configFile = path.join(this.configDir, "config.json");
    this.agentsDir = path.join(this.configDir, "agents");
    this.serversDir = path.join(this.configDir, "servers");
    this.serverDataDir = path.join(this.configDir, "server");

    this.config = {
      version: "1.0",
      server: {
        port: 18790,
        host: "0.0.0.0",
        maxConnections: 100,
      },
      agents: {
        defaultPort: 18791,
        dataRetentionDays: 30,
      },
      discovery: {
        enabled: true,
        broadcastPort: 18792,
        broadcastInterval: 30000, // 30秒
      },
      security: {
        requireAuth: false,
        allowLocalConnections: true,
      },
    };
  }

  /**
   * 加载配置
   */
  async load() {
    try {
      // 确保配置目录存在
      await this.ensureDirectories();

      // 如果配置文件存在，加载它
      if (await fs.pathExists(this.configFile)) {
        const fileContent = await fs.readFile(this.configFile, "utf8");
        const savedConfig = JSON.parse(fileContent);

        // 合并配置（新配置优先）
        this.config = this.deepMerge(savedConfig, this.config);
      } else {
        // 创建默认配置
        await this.save();
      }

      return this.config;
    } catch (error) {
      cli.error(`加载配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 保存配置
   */
  async save() {
    try {
      await this.ensureDirectories();
      await fs.writeFile(this.configFile, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      cli.error(`保存配置失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 获取配置值
   * @param {string} key - 配置键（支持点符号）
   * @param {any} defaultValue - 默认值
   */
  get(key, defaultValue = null) {
    const keys = key.split(".");
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === "object" && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * 设置配置值
   * @param {string} key - 配置键（支持点符号）
   * @param {any} value - 配置值
   */
  set(key, value) {
    const keys = key.split(".");
    let config = this.config;

    // 遍历到最后一个键的父级
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!config[k] || typeof config[k] !== "object") {
        config[k] = {};
      }
      config = config[k];
    }

    // 设置值
    config[keys[keys.length - 1]] = value;

    // 自动保存
    this.save().catch((error) => {
      cli.warn(`自动保存配置失败: ${error.message}`);
    });

    return this;
  }

  /**
   * 确保所有目录存在
   */
  async ensureDirectories() {
    const dirs = [
      this.configDir,
      this.agentsDir,
      this.serversDir,
      this.serverDataDir,
      path.join(this.serverDataDir, "files"),
      path.join(this.serverDataDir, "logs"),
    ];

    for (const dir of dirs) {
      await fs.ensureDir(dir);
    }

    return true;
  }

  /**
   * 获取 Agent 配置路径
   * @param {string} agentId
   */
  getAgentConfigPath(agentId) {
    return path.join(this.agentsDir, agentId, "config.json");
  }

  /**
   * 获取 Agent 数据目录
   * @param {string} agentId
   */
  getAgentDataDir(agentId) {
    return path.join(this.agentsDir, agentId, "data");
  }

  /**
   * 获取 Agent 文件目录
   * @param {string} agentId
   */
  getAgentFilesDir(agentId) {
    return path.join(this.agentsDir, agentId, "files");
  }

  /**
   * 获取 Agent OpenClaw 配置路径
   * @param {string} agentId
   */
  getAgentOpenClawConfigPath(agentId) {
    return path.join(this.agentsDir, agentId, "openclaw.json");
  }

  /**
   * 获取 Agent 关系配置路径
   * @param {string} agentId
   */
  getAgentRelationsPath(agentId) {
    return path.join(this.agentsDir, agentId, "relations.json");
  }

  /**
   * 获取服务器注册表路径
   */
  getServerRegistryPath() {
    return path.join(this.serverDataDir, "registry.json");
  }

  /**
   * 获取服务器文件目录
   */
  getServerFilesDir() {
    return path.join(this.serverDataDir, "files");
  }

  /**
   * 获取日志目录
   */
  getLogsDir() {
    return path.join(this.serverDataDir, "logs");
  }

  /**
   * 获取所有配置
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * 深度合并对象
   * @param {Object} target
   * @param {Object} source
   */
  deepMerge(target, source) {
    const output = Object.assign({}, target);

    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }

    return output;
  }

  /**
   * 检查是否为对象
   * @param {any} item
   */
  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  }

  /**
   * 重置为默认配置
   */
  async reset() {
    this.config = {
      version: "1.0",
      server: {
        port: 18790,
        host: "0.0.0.0",
        maxConnections: 100,
      },
      agents: {
        defaultPort: 18791,
        dataRetentionDays: 30,
      },
      discovery: {
        enabled: true,
        broadcastPort: 18792,
        broadcastInterval: 30000,
      },
      security: {
        requireAuth: false,
        allowLocalConnections: true,
      },
    };

    await this.save();
    return this.config;
  }

  /**
   * 导出配置
   */
  export() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 导入配置
   * @param {Object} newConfig
   */
  async import(newConfig) {
    if (!this.isObject(newConfig)) {
      throw new Error("配置必须是对象");
    }

    this.config = this.deepMerge(newConfig, this.config);
    await this.save();
    return this.config;
  }

  /**
   * 获取数据目录
   */
  getDataDir() {
    return this.configDir;
  }

  /**
   * 获取服务器文件目录
   */
  getServerFilesDir() {
    return path.join(this.configDir, "files");
  }
}

module.exports = Config;
