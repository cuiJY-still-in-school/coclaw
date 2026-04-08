const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

describe("Coclaw Basic Tests", () => {
  test("CLI should show help", () => {
    const output = execSync("node bin/coclaw --help", { encoding: "utf8" });
    expect(output).toContain("Local network AI collaboration tool");
  });

  test("CLI should show version", () => {
    const output = execSync("node bin/coclaw --version", { encoding: "utf8" });
    expect(output).toContain("1.0.0");
  });

  test("Package.json should have correct version", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
    );
    expect(packageJson.version).toBe("1.0.0");
  });

  test("Required documentation files exist", () => {
    const requiredFiles = [
      "CHANGELOG.md",
      "CONTRIBUTING.md",
      "API.md",
      "ARCHITECTURE.md",
      "QUICKSTART.md",
      "TROUBLESHOOTING.md",
      "RELEASE_CHECKLIST.md",
    ];

    requiredFiles.forEach((file) => {
      const filePath = path.join(__dirname, "..", file);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    // README.md is in the root directory, not in coclaw/
    const rootReadmePath = path.join(__dirname, "..", "..", "README.md");
    expect(fs.existsSync(rootReadmePath)).toBe(true);
  });

  test("Installation script exists and is executable", () => {
    const installScript = path.join(__dirname, "..", "install.sh");
    expect(fs.existsSync(installScript)).toBe(true);

    const stats = fs.statSync(installScript);
    expect(stats.isFile()).toBe(true);

    // Check if it's executable (at least by owner)
    const isExecutable = (stats.mode & 0o111) !== 0;
    expect(isExecutable).toBe(true);
  });

  test("Package release script exists", () => {
    const packageScript = path.join(__dirname, "../package-release.sh");
    expect(fs.existsSync(packageScript)).toBe(true);
  });

  test("Version manager script exists", () => {
    const versionScript = path.join(__dirname, "../version-manager.sh");
    expect(fs.existsSync(versionScript)).toBe(true);
  });
});
