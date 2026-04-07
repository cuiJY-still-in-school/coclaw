const { cli } = require("../cli");
const http = require("http");

/**
 * 性能监控命令
 */
class PerformanceCommand {
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
      if (!isRunning) {
        cli.error("服务器未运行，请先启动服务器: coclaw server");
        return;
      }

      if (options.reset) {
        await this.resetPerformanceStats(port);
      } else if (options.disable) {
        await this.controlPerformance(port, "disable");
      } else if (options.enable) {
        await this.controlPerformance(port, "enable");
      } else {
        await this.showPerformanceStats(port);
      }
    } catch (error) {
      cli.error(`性能命令执行失败: ${error.message}`);
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
   * 显示性能统计
   */
  async showPerformanceStats(port) {
    cli.title("服务器性能统计");

    try {
      const stats = await this.fetchPerformanceStats(port);

      if (stats.success) {
        const perfStats = stats.stats;

        // 显示基本信息
        cli.info(
          `性能优化状态: ${perfStats.optimizationEnabled ? "启用" : "禁用"}`,
        );
        cli.info(`统计时间: ${stats.timestamp}`);

        // 显示消息路由统计
        cli.title("消息路由统计");
        const msgStats = perfStats.messageRouting;
        cli.info(`总消息数: ${msgStats.totalMessages}`);
        cli.info(`平均延迟: ${msgStats.averageLatency.toFixed(2)}ms`);
        cli.info(`峰值延迟: ${msgStats.peakLatency}ms`);
        if (msgStats.recentAverageLatency) {
          cli.info(
            `最近平均延迟: ${msgStats.recentAverageLatency.toFixed(2)}ms`,
          );
        }
        if (msgStats.latencyStdDev) {
          cli.info(`延迟标准差: ${msgStats.latencyStdDev.toFixed(2)}ms`);
        }

        // 显示文件传输统计
        cli.title("文件传输统计");
        const fileStats = perfStats.fileTransfer;
        cli.info(`总文件数: ${fileStats.totalFiles}`);
        cli.info(`总字节数: ${this.formatBytes(fileStats.totalBytes)}`);
        cli.info(`平均速度: ${this.formatBytes(fileStats.averageSpeed)}/s`);
        if (fileStats.recentAverageSpeed) {
          cli.info(
            `最近平均速度: ${this.formatBytes(fileStats.recentAverageSpeed)}/s`,
          );
        }

        // 显示连接统计
        cli.title("连接统计");
        const connStats = perfStats.connections;
        cli.info(`活跃连接: ${connStats.active}`);
        cli.info(`峰值连接: ${connStats.peak}`);
        cli.info(`总打开连接: ${connStats.totalOpened}`);
        cli.info(`总关闭连接: ${connStats.totalClosed}`);
        cli.info(`连接使用率: ${connStats.utilization.toFixed(1)}%`);

        // 显示优化策略状态
        cli.title("优化策略状态");
        const strategies = perfStats.optimizationStrategies || {};
        for (const [name, strategy] of Object.entries(strategies)) {
          const status = strategy.enabled ? "启用" : "禁用";
          let extraInfo = "";

          if (
            name === "messageBatching" &&
            strategy.currentBatchSize !== undefined
          ) {
            extraInfo = ` (当前批次: ${strategy.currentBatchSize})`;
          } else if (
            name === "connectionPooling" &&
            strategy.poolCount !== undefined
          ) {
            extraInfo = ` (连接池: ${strategy.poolCount})`;
          }

          cli.info(`${this.formatStrategyName(name)}: ${status}${extraInfo}`);
        }

        // 显示建议
        this.showRecommendations(perfStats);
      } else {
        cli.warn(`获取性能统计失败: ${stats.error}`);
      }
    } catch (error) {
      cli.error(`获取性能统计失败: ${error.message}`);
    }
  }

  /**
   * 获取性能统计
   */
  async fetchPerformanceStats(port) {
    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://localhost:${port}/api/performance/stats`,
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error(`解析响应失败: ${error.message}`));
            }
          });
        },
      );

      req.on("error", reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error("请求超时"));
      });
    });
  }

  /**
   * 重置性能统计
   */
  async resetPerformanceStats(port) {
    cli.info("正在重置性能统计...");

    try {
      const result = await this.controlPerformance(port, "reset_stats");
      if (result.success) {
        cli.success("性能统计已重置");
      } else {
        cli.error(`重置失败: ${result.error}`);
      }
    } catch (error) {
      cli.error(`重置性能统计失败: ${error.message}`);
    }
  }

  /**
   * 控制性能优化
   */
  async controlPerformance(port, action) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({ action });

      const req = http.request(
        {
          hostname: "localhost",
          port,
          path: "/api/performance/control",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(postData),
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(data));
            } catch (error) {
              reject(new Error(`解析响应失败: ${error.message}`));
            }
          });
        },
      );

      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }

  /**
   * 格式化策略名称
   */
  formatStrategyName(name) {
    const names = {
      messageBatching: "消息批处理",
      connectionPooling: "连接池",
      messageCompression: "消息压缩",
      fileTransferOptimization: "文件传输优化",
      caching: "缓存优化",
    };
    return names[name] || name;
  }

  /**
   * 格式化字节大小
   */
  formatBytes(bytes) {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  /**
   * 显示优化建议
   */
  showRecommendations(stats) {
    const recommendations = [];

    // 消息延迟建议
    if (stats.messageRouting.averageLatency > 100) {
      recommendations.push("消息延迟较高，考虑启用消息压缩");
    }

    // 连接使用率建议
    if (stats.connections.utilization > 80) {
      recommendations.push("连接使用率较高，考虑增加连接池大小");
    }

    // 文件传输速度建议
    if (stats.fileTransfer.averageSpeed < 1024 * 1024) {
      recommendations.push("文件传输速度较慢，考虑启用文件分块传输");
    }

    if (recommendations.length > 0) {
      cli.title("优化建议");
      recommendations.forEach((rec, index) => {
        cli.info(`${index + 1}. ${rec}`);
      });
    }
  }
}

module.exports = new PerformanceCommand();
