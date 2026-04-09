/**
 * Coclaw 主入口点
 *
 * 这个文件作为 package.json 中指定的主入口点，
 * 但实际上 Coclaw 是通过 bin/coclaw 直接运行的。
 */

module.exports = {
  // 导出主要模块
  AgentManager: require("./agent-manager"),
  ServerManager: require("./server-manager"),
  Config: require("./config"),
  CLI: require("./cli"),

  // 版本信息
  version: require("../package.json").version,
};
