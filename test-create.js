// 测试 create 命令
const { run } = require("./lib/commands/create");

// 模拟命令行参数
async function test() {
  console.log("测试 create 命令...");

  try {
    await run();
    console.log("测试成功");
  } catch (error) {
    console.error("测试失败:", error);
    console.error(error.stack);
  }
}

test();
