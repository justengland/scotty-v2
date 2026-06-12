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
let originalFetch: typeof globalThis.fetch;

beforeEach(async () => {
  stdout = [];
  originalStdoutWrite = process.stdout.write;
  originalStderrWrite = process.stderr.write;
  originalConsoleLog = console.log;
  originalConsoleError = console.error;
  originalFetch = globalThis.fetch;
  originalEnv = {
    SCOTTY_VAULT_PATH: process.env.SCOTTY_VAULT_PATH,
    SCOTTY_VAULT_REMOTE: process.env.SCOTTY_VAULT_REMOTE,
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    SCOTTY_CLAUDE_PATH: process.env.SCOTTY_CLAUDE_PATH,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
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
  globalThis.fetch = originalFetch;

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

function installMockDiscordWebhook(): { payloads: string[] } {
  const payloads: string[] = [];
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";
  globalThis.fetch = (async (_url, init) => {
    payloads.push(String(init?.body));
    return new Response("", { status: 204 });
  }) as typeof fetch;
  return { payloads };
}

async function setupDispatchFixtures(): Promise<void> {
  await writeOrders();
  await writeArchiveContext();
  await mkdir(repoPath, { recursive: true });
  await writeFile(
    join(repoPath, "passing.test.ts"),
    `import { expect, test } from "bun:test";

test("passes", () => {
  expect(1).toBe(1);
});
`,
  );
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
  expect(logContent).toContain("**Tricorder:** passed");
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

test("bridge dispatch fails when Tricorder fails and logs verification", async () => {
  await setupDispatchFixtures();
  const { payloads } = installMockDiscordWebhook();
  await writeFile(
    join(repoPath, "passing.test.ts"),
    `import { expect, test } from "bun:test";

test("fails", () => {
  expect(1).toBe(2);
});
`,
  );
  const markerPath = join(repoPath, "marker.txt");
  await writeFile(markerPath, "inspect-me");

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Tricorder fail",
      "--description",
      "Tests should fail.",
    ],
  });

  expect(process.exitCode).toBe(1);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("**Tricorder:** failed");
  expect(await Bun.file(markerPath).text()).toBe("inspect-me");
  expect(payloads).toHaveLength(1);
  const hailBody = JSON.parse(payloads[0]!);
  expect(hailBody.content).toContain("alpha");
  expect(hailBody.content).toContain("Tricorder failure");
});

test("bridge dispatch succeeds when Tricorder passes despite Away Team failure", async () => {
  await setupDispatchFixtures();
  await writeFile(
    join(mockBinDir, "claude"),
    `#!/bin/sh
echo "mock-claude: failed run" >&2
exit 1
`,
  );
  await chmod(join(mockBinDir, "claude"), 0o755);

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Away Team fail",
      "--description",
      "Tricorder should still pass.",
    ],
  });

  expect(process.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("**Tricorder:** passed");
  expect(logContent).toContain("**Outcome:** success");
});

test("bridge dispatch --skip-verify bypasses Tricorder", async () => {
  await setupDispatchFixtures();
  await writeFile(
    join(repoPath, "passing.test.ts"),
    `import { expect, test } from "bun:test";

test("fails", () => {
  expect(1).toBe(2);
});
`,
  );

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Skip verify",
      "--description",
      "Ignore failing tests.",
      "--skip-verify",
    ],
  });

  expect(process.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).not.toContain("**Tricorder:**");
});

test("bridge dispatch runs markdown Tricorder for configured repo", async () => {
  const markdownRepoPath = join(tempRoot, "docs-repo");
  await mkdir(markdownRepoPath, { recursive: true });
  await writeFile(join(markdownRepoPath, "README.md"), "# Docs\n");
  await writeOrders(markdownRepoPath);
  await mkdir(join(vaultPath, "archive", "alpha"), { recursive: true });
  await writeArchiveContext();
  await Bun.$`git init`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
  await installMockClaude();
  process.env.SCOTTY_CLAUDE_PATH = join(mockBinDir, "claude");

  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "claude-code"
verify = "markdown"
`,
  );

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Docs check",
      "--description",
      "Markdown verifier.",
    ],
  });

  expect(process.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("markdown verification passed");
});

test("bridge dispatch without verify uses Away Team outcome only", async () => {
  await setupDispatchFixtures();
  const betaPath = join(tempRoot, "beta-repo");
  await mkdir(betaPath, { recursive: true });
  await writeFile(
    join(vaultPath, "orders", "local.toml"),
    `[vault]
path = "${vaultPath}"

[repos.alpha]
path = "${repoPath}"

[repos.beta]
path = "${betaPath}"
`,
  );
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.beta]
agent = "claude-code"
`,
  );
  await mkdir(join(vaultPath, "archive", "beta"), { recursive: true });
  await writeFile(join(vaultPath, "archive", "beta", "index.md"), "# Beta\n");
  await writeFile(join(vaultPath, "archive", "beta", "captains-log.md"), "# Log\n");

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "beta",
      "--title",
      "No verifier",
      "--description",
      "Beta has no verify key.",
    ],
  });

  expect(process.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) => name.endsWith(".md"));
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).not.toContain("**Tricorder:**");
});

test("bridge hail sends test Discord message when webhook is configured", async () => {
  const { payloads } = installMockDiscordWebhook();

  await runCommand(bridgeCommand, { rawArgs: ["hail"] });

  const output = stdout.join("\n");
  expect(output).toContain("Test hail sent");
  expect(payloads).toHaveLength(1);
  const hailBody = JSON.parse(payloads[0]!);
  expect(hailBody.content).toContain("Scotty Hail");
  expect(hailBody.content).toContain("Test hail");
  expect(hailBody.username).toBe("Scotty");
});

test("bridge hail errors when DISCORD_WEBHOOK_URL is missing", async () => {
  delete process.env.DISCORD_WEBHOOK_URL;

  await runCommand(bridgeCommand, { rawArgs: ["hail"] });

  const output = stdout.join("\n");
  expect(output).toContain("DISCORD_WEBHOOK_URL is not set");
  expect(process.exitCode).toBe(1);
});

test("bridge dispatch hails on Away Team crash when repo has no verifier", async () => {
  const betaPath = join(tempRoot, "beta-repo");
  await mkdir(betaPath, { recursive: true });
  await writeOrders();
  await mkdir(join(vaultPath, "archive", "beta"), { recursive: true });
  await writeFile(join(vaultPath, "archive", "beta", "index.md"), "# Beta\n");
  await writeFile(join(vaultPath, "archive", "beta", "captains-log.md"), "# Log\n");
  await writeFile(
    join(vaultPath, "orders", "local.toml"),
    `[vault]
path = "${vaultPath}"

[repos.alpha]
path = "${repoPath}"

[repos.beta]
path = "${betaPath}"
`,
  );
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.beta]
agent = "claude-code"
`,
  );
  await Bun.$`git init`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
  await installMockClaude();
  await writeFile(
    join(mockBinDir, "claude"),
    `#!/bin/sh
echo "mock-claude: crashed" >&2
exit 1
`,
  );
  await chmod(join(mockBinDir, "claude"), 0o755);
  process.env.SCOTTY_CLAUDE_PATH = join(mockBinDir, "claude");
  const { payloads } = installMockDiscordWebhook();

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "beta",
      "--title",
      "Away Team crash",
      "--description",
      "No verifier configured.",
    ],
  });

  expect(process.exitCode).toBe(1);
  expect(payloads).toHaveLength(1);
  const hailBody = JSON.parse(payloads[0]!);
  expect(hailBody.content).toContain("beta");
  expect(hailBody.content).toContain("Away Team crash");
  expect(hailBody.content).toContain("mock-claude: crashed");
});

test("successful bridge dispatch does not hail", async () => {
  await setupDispatchFixtures();
  const { payloads } = installMockDiscordWebhook();

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "All good",
      "--description",
      "Should not hail.",
    ],
  });

  expect(process.exitCode).toBe(0);
  expect(payloads).toHaveLength(0);
});
