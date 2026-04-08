const { cli } = require("../cli");
const http = require("http");
const fs = require("fs-extra");
const path = require("path");

/**
 * 错误监控命令
 */
class ErrorsCommand {
  constructor() {
    this.config = require("../config");
  }

  /**
   * 运行命令
   * @param {Object} options - 命令选项
   */
  async run(options = {}) {
    try {
      const config = new this.config();
      const port = config.get("server.port", 18790);

      // 检查服务器是否运行
      const isRunning = await this.checkServerStatus(port);

      if (options.clear) {
        await this.clearErrorStats(config);
      } else if (options.list) {
        await this.listRecentErrors(config);
      } else if (options.stats) {
        if (isRunning) {
          await this.showErrorStats(port);
        } else {
          await this.showErrorStatsFromFile(config);
        }
      } else {
        // 默认显示错误统计
        if (isRunning) {
          await this.showErrorStats(port);
        } else {
          await this.showErrorStatsFromFile(config);
        }
      }
    } catch (error) {
      cli.error(`错误命令执行失败: ${error.message}`);
    }
  }

  /**
   * 检查服务器状态
   */
  async checkServerStatus(port) {
    return new Promise((resolve) => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        resolve(res.statusCode === 200);
      });

      req.on("error", () => resolve(false));
      req.setTimeout(2000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * 显示错误统计
   */
  async showErrorStats(port) {
    cli.title("服务器错误统计");

    try {
      const health = await this.fetchHealth(port);

      if (health.status === "healthy") {
        cli.success("服务器运行正常，无严重错误");
      } else if (health.status === "degraded") {
        cli.warn("服务器运行降级，存在一些错误");
      } else if (health.status === "unhealthy") {
        cli.error("服务器运行不健康，存在严重错误");
      }

      // 显示错误统计
      if (health.checks && health.checks.errors) {
        const errorStats = health.checks.errors;
        cli.info(`总错误数: ${errorStats.total || 0}`);
        cli.info(`严重错误: ${errorStats.critical || 0}`);
        cli.info(`主要错误: ${errorStats.major || 0}`);
        cli.info(`次要错误: ${errorStats.minor || 0}`);
        cli.info(`警告: ${errorStats.warning || 0}`);

        // 显示错误类型分布
        if (errorStats.byType && Object.keys(errorStats.byType).length > 0) {
          cli.title("错误类型分布");
          for (const [type, count] of Object.entries(errorStats.byType)) {
            cli.info(`${type}: ${count}`);
          }
        }
      }

      // 显示最近错误
      if (health.metrics && health.metrics.recentErrors) {
        const recentErrors = health.metrics.recentErrors;
        if (recentErrors.length > 0) {
          cli.title("最近错误");
          recentErrors.slice(0, 5).forEach((error, index) => {
            cli.info(`${index + 1}. ${error.code}: ${error.message}`);
            if (error.timestamp) {
              cli.info(
                `   时间: ${new Date(error.timestamp).toLocaleString()}`,
              );
            }
          });
        }
      }
    } catch (error) {
      cli.error(`获取错误统计失败: ${error.message}`);
    }
  }

  /**
   * 从文件显示错误统计
   */
  async showErrorStatsFromFile(config) {
    cli.title("错误统计（从文件）");

    try {
      const errorLogPath = path.join(
        config.getDataDir(),
        "logs",
        "errors.json",
      );

      if (await fs.pathExists(errorLogPath)) {
        const errorLog = await fs.readJson(errorLogPath);

        cli.info(`总错误数: ${errorLog.total || 0}`);
        cli.info(`严重错误: ${errorLog.critical || 0}`);
        cli.info(`主要错误: ${errorLog.major || 0}`);
        cli.info(`次要错误: ${errorLog.minor || 0}`);
        cli.info(`警告: ${errorLog.warning || 0}`);

        // 显示最近错误
        if (errorLog.recent && errorLog.recent.length > 0) {
          cli.title("最近错误");
          errorLog.recent.slice(0, 5).forEach((error, index) => {
            cli.info(`${index + 1}. ${error.code}: ${error.message}`);
            if (error.timestamp) {
              cli.info(
                `   时间: ${new Date(error.timestamp).toLocaleString()}`,
              );
            }
          });
        }
      } else {
        cli.info("未找到错误日志文件");
      }
    } catch (error) {
      cli.error(`读取错误日志失败: ${error.message}`);
    }
  }

  /**
   * 列出最近错误
   */
  async listRecentErrors(config) {
    cli.title("最近错误列表");

    try {
      const errorLogPath = path.join(
        config.getDataDir(),
        "logs",
        "errors.json",
      );

      if (await fs.pathExists(errorLogPath)) {
        const errorLog = await fs.readJson(errorLogPath);

        if (errorLog.recent && errorLog.recent.length > 0) {
          errorLog.recent.forEach((error, index) => {
            cli.title(`错误 ${index + 1}`);
            cli.info(`代码: ${error.code}`);
            cli.info(`消息: ${error.message}`);
            cli.info(`严重级别: ${error.severity}`);
            cli.info(`时间: ${new Date(error.timestamp).toLocaleString()}`);

            if (error.context) {
              cli.info("上下文:");
              Object.entries(error.context).forEach(([key, value]) => {
                cli.info(`  ${key}: ${value}`);
              });
            }

            if (error.solution) {
              cli.info(`解决方案: ${error.solution}`);
            }

            console.log(); // 空行
          });
        } else {
          cli.info("没有错误记录");
        }
      } else {
        cli.info("未找到错误日志文件");
      }
    } catch (error) {
      cli.error(`读取错误日志失败: ${error.message}`);
    }
  }

  /**
   * 清除错误统计
   */
  async clearErrorStats(config) {
    const confirmed = await cli.confirm("确定要清除所有错误统计吗？");

    if (confirmed) {
      try {
        const errorLogPath = path.join(
          config.getDataDir(),
          "logs",
          "errors.json",
        );

        if (await fs.pathExists(errorLogPath)) {
          await fs.writeJson(errorLogPath, {
            total: 0,
            critical: 0,
            major: 0,
            minor: 0,
            warning: 0,
            byType: {},
            recent: [],
            lastReset: new Date().toISOString(),
          });

          cli.success("错误统计已清除");
        } else {
          cli.info("未找到错误日志文件，无需清除");
        }
      } catch (error) {
        cli.error(`清除错误统计失败: ${error.message}`);
      }
    } else {
      cli.info("操作已取消");
    }
  }

  /**
   * 获取健康状态
   */
  async fetchHealth(port) {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${port}/health`, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error(`解析响应失败: ${error.message}`));
          }
        });
      });

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("请求超时"));
      });
    });
  }
}

module.exports = new ErrorsCommand();
