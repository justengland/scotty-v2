import { afterEach, beforeEach, expect, test } from "bun:test";
import { chmod, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCommand } from "citty";
import { bridgeCommand } from "./cli/main";

let tempRoot: string;
let vaultPath: string;
let repoPath: string;
let mockBinDir: string;
let stdout: string[];
let originalEnv: Record<string, string | undefined>;
let originalStdoutWrite: typeof process.stdout.write;
let originalStderrWrite: typeof process.stderr.write;
let originalConsoleLog: typeof console.log;
let originalConsoleError: typeof console.error;

beforeEach(async () => {
  stdout = [];
  originalStdoutWrite = process.stdout.write;
  originalStderrWrite = process.stderr.write;
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  originalEnv = {
    SCOTTY_VAULT_PATH: process.env.SCOTTY_VAULT_PATH,
    SCOTTY_VAULT_REMOTE: process.env.SCOTTY_VAULT_REMOTE,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    SCOTTY_CLAUDE_PATH: process.env.SCOTTY_CLAUDE_PATH,
  };

  tempRoot = join(tmpdir(), `bridge-cli-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  repoPath = join(tempRoot, "alpha-repo");
  mockBinDir = join(tempRoot, "bin");
  process.env.HOME = tempRoot;
  process.env.SCOTTY_VAULT_PATH = vaultPath;
  process.env.SCOTTY_VAULT_REMOTE = "git@github.com:example/scotty-vault.git";
  process.env.PATH = `${mockBinDir}:${process.env.PATH ?? ""}`;

  const log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.log = log as typeof console.log;
  console.error = log as typeof console.error;
  process.stdout.write = (() => true) as typeof process.stdout.write;
  process.stderr.write = (() => true) as typeof process.stderr.write;
});

afterEach(async () => {
  process.exitCode = 0;
  process.stdout.write = originalStdoutWrite;
  process.stderr.write = originalStderrWrite;
  console.log = originalConsoleLog;
  console.error = originalConsoleError;

  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  await rm(tempRoot, { recursive: true, force: true });
});

async function writeOrders(repoLocalPath = repoPath): Promise<void> {
  await mkdir(join(vaultPath, "orders"), { recursive: true });
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "claude-code"
verify = "bun"
context = ["architecture.md"]

[repos.beta]
agent = "claude-code"
`,
  );
  await writeFile(
    join(vaultPath, "orders", "local.toml"),
    `[vault]
path = "${vaultPath}"

[repos.alpha]
path = "${repoLocalPath}"

[repos.beta]
path = "/tmp/beta"
`,
  );
}

async function writeArchiveContext(): Promise<void> {
  const archiveDir = join(vaultPath, "archive", "alpha");
  await mkdir(archiveDir, { recursive: true });
  await writeFile(join(archiveDir, "index.md"), "# Alpha index\n");
  await writeFile(join(archiveDir, "captains-log.md"), "# Captain's Log\n");
  await writeFile(join(archiveDir, "architecture.md"), "# Architecture\n");
}

async function installMockClaude(): Promise<void> {
  await mkdir(mockBinDir, { recursive: true });
  const script = `#!/bin/sh
echo "mock-claude: executed"
echo "cwd=$(pwd)"
exit 0
`;
  const scriptPath = join(mockBinDir, "claude");
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);
}

async function setupDispatchFixtures(): Promise<void> {
  await writeOrders();
  await writeArchiveContext();
  await mkdir(repoPath, { recursive: true });
  await Bun.$`git init`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
  await installMockClaude();
  process.env.SCOTTY_CLAUDE_PATH = join(mockBinDir, "claude");
}

test("bridge init scaffolds an empty vault directory", async () => {
  await mkdir(vaultPath, { recursive: true });

  await runCommand(bridgeCommand, { rawArgs: ["init"] });

  const output = stdout.join("\n");
  expect(output).toContain("Scaffolded Scotty Vault");
  expect(await Bun.file(join(vaultPath, "Scotty Index.md")).exists()).toBe(true);
});

test("bridge roster prints Duty Roster entries", async () => {
  await writeOrders("/tmp/alpha");
  await mkdir(join(vaultPath, "archive"), { recursive: true });
  await Bun.$`git init`.cwd(vaultPath).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["roster"] });

  const output = stdout.join("\n");
  expect(output).toContain("Duty Roster");
  expect(output).toContain("alpha");
  expect(output).toContain("verify: bun");
  expect(output).toContain("path: /tmp/alpha");
});

test("bridge roster errors for unknown repo", async () => {
  await writeOrders();
  await mkdir(join(vaultPath, "archive"), { recursive: true });
  await Bun.$`git init`.cwd(vaultPath).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["roster", "missing"] });

  const output = stdout.join("\n");
  expect(output).toContain('Repository "missing" is not on the Duty Roster');
});

test("bridge dispatch runs Claude Team with context and logs outcome", async () => {
  await setupDispatchFixtures();

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Fix the widget",
      "--description",
      "Repair the broken widget.",
    ],
  });

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  expect(logFiles.length).toBeGreaterThan(0);

  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("dispatch: alpha");
  expect(logContent).toContain("Fix the widget");
  expect(logContent).toContain("mock-claude: executed");
  expect(logContent).not.toContain("Repair the broken widget.");

  const vaultLog = await Bun.$`git log --oneline`.cwd(vaultPath).quiet();
  expect(vaultLog.stdout.toString()).toContain("dispatch: alpha");
});

test("bridge dispatch loads Task from --file", async () => {
  await setupDispatchFixtures();
  const taskFile = join(tempRoot, "task.md");
  await writeFile(
    taskFile,
    `# Ship the feature

Implement the feature end to end.
`,
  );

  await runCommand(bridgeCommand, {
    rawArgs: ["dispatch", "alpha", "--file", taskFile],
  });

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("Ship the feature");
});

test("bridge dispatch sets Task priority from --priority", async () => {
  await setupDispatchFixtures();

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Priority task",
      "--description",
      "High priority work.",
      "--priority",
      "7",
    ],
  });

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("**Priority:** 7");
});

test("bridge dispatch aborts when context file is missing", async () => {
  await setupDispatchFixtures();
  await rm(join(vaultPath, "archive", "alpha", "architecture.md"));

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Should not run",
      "--description",
      "Missing context.",
    ],
  });

  const output = stdout.join("\n");
  expect(output).toContain("Context file missing");
  expect(output).toContain("architecture.md");
  expect(output).not.toContain("mock-claude: executed");
});

test("bridge dispatch errors when claude is not on PATH", async () => {
  await setupDispatchFixtures();
  process.env.SCOTTY_CLAUDE_PATH = "/nonexistent/claude";

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "No claude",
      "--description",
      "Should fail fast.",
    ],
  });

  const output = stdout.join("\n");
  expect(output).toContain("claude is not on PATH");
  expect(output).not.toContain("mock-claude: executed");
});
