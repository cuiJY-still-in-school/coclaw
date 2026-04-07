const chalk = require("chalk").default;
const debug = require("debug")("coclaw:cli");

/**
 * CLI 工具函数
 */
class CLI {
  constructor() {
    this.debug = debug;
  }

  /**
   * 打印成功消息
   * @param {string} message
   */
  success(message) {
    console.log(chalk.green("✓"), message);
  }

  /**
   * 打印错误消息
   * @param {string} message
   */
  error(message) {
    console.error(chalk.red("✗"), message);
  }

  /**
   * 打印警告消息
   * @param {string} message
   */
  warn(message) {
    console.warn(chalk.yellow("⚠"), message);
  }

  /**
   * 打印信息消息
   * @param {string} message
   */
  info(message) {
    console.log(chalk.blue("ℹ"), message);
  }

  /**
   * 打印标题
   * @param {string} title
   */
  title(title) {
    console.log(chalk.bold.cyan(`\n${title}`));
    console.log(chalk.cyan("-".repeat(title.length)));
  }

  /**
   * 打印表格数据
   * @param {Array} data
   * @param {Array} columns
   */
  table(data, columns) {
    if (!data || data.length === 0) {
      console.log(chalk.gray("(空)"));
      return;
    }

    // 简单表格实现
    const headers = columns.map((col) => chalk.bold(col.name));
    console.log(headers.join("  "));
    console.log("-".repeat(headers.join("  ").length));

    data.forEach((row) => {
      const values = columns.map((col) => {
        const value = row[col.key] || "";
        return String(value).padEnd(col.width || 20);
      });
      console.log(values.join("  "));
    });
  }

  /**
   * 确认操作
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  async confirm(message) {
    const readline = require("readline");
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(`${chalk.yellow("?")} ${message} (y/N) `, (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
      });
    });
  }

  /**
   * 显示进度指示器
   * @param {string} message
   * @returns {Function} 停止函数
   */
  progress(message) {
    const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let i = 0;

    process.stdout.write(chalk.blue(frames[i]) + " " + message);

    const interval = setInterval(() => {
      process.stdout.write(
        "\r" + chalk.blue(frames[(i = ++i % frames.length)]) + " " + message,
      );
    }, 100);

    return () => {
      clearInterval(interval);
      process.stdout.write("\r" + chalk.green("✓") + " " + message + "\n");
    };
  }

  /**
   * 解析命令参数
   * @param {Array} args
   * @returns {Object}
   */
  parseArgs(args) {
    const result = {};
    let currentKey = null;

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        const key = arg.slice(2);
        if (args[i + 1] && !args[i + 1].startsWith("-")) {
          result[key] = args[i + 1];
          i++;
        } else {
          result[key] = true;
        }
        currentKey = key;
      } else if (arg.startsWith("-")) {
        const key = arg.slice(1);
        if (args[i + 1] && !args[i + 1].startsWith("-")) {
          result[key] = args[i + 1];
          i++;
        } else {
          result[key] = true;
        }
        currentKey = key;
      } else if (currentKey) {
        // 处理多个值的参数
        if (Array.isArray(result[currentKey])) {
          result[currentKey].push(arg);
        } else if (result[currentKey] !== undefined) {
          result[currentKey] = [result[currentKey], arg];
        } else {
          result[currentKey] = arg;
        }
      } else {
        // 位置参数
        if (!result._) result._ = [];
        result._.push(arg);
      }
    }

    return result;
  }
}

module.exports = {
  CLI,
  cli: new CLI(),
};
