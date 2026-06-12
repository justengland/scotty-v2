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
    SCOTTY_TEST_REPO_PATH: process.env.SCOTTY_TEST_REPO_PATH,
    CURSOR_API_KEY: process.env.CURSOR_API_KEY,
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

async function writeOrders(
  repoLocalPath = repoPath,
  agent = "claude-code"
): Promise<void> {
  await mkdir(join(vaultPath, "orders"), { recursive: true });
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "${agent}"
verify = "bun"
context = ["architecture.md"]

[repos.beta]
agent = "claude-code"
`
  );
  await writeFile(
    join(vaultPath, "orders", "local.toml"),
    `[vault]
path = "${vaultPath}"

[repos.alpha]
path = "${repoLocalPath}"

[repos.beta]
path = "/tmp/beta"
`
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
  process.env.DISCORD_WEBHOOK_URL =
    "https://discord.com/api/webhooks/test/token";
  globalThis.fetch = (async (_url, init) => {
    payloads.push(String(init?.body));
    return new Response("", { status: 204 });
  }) as typeof fetch;
  return { payloads };
}

async function setupDispatchFixtures(agent = "claude-code"): Promise<void> {
  await writeOrders(repoPath, agent);
  await writeArchiveContext();
  await mkdir(repoPath, { recursive: true });
  await writeFile(
    join(repoPath, "passing.test.ts"),
    `import { expect, test } from "bun:test";

test("passes", () => {
  expect(1).toBe(1);
});
`
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
  expect(await Bun.file(join(vaultPath, "Scotty Index.md")).exists()).toBe(
    true
  );
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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
  expect(logFiles.length).toBeGreaterThan(0);

  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("dispatch: alpha");
  expect(logContent).toContain("Fix the widget");
  expect(logContent).toContain("**Tricorder:** passed");
  expect(logContent).not.toContain("Repair the broken widget.");

  const vaultLog = await Bun.$`git log --oneline`.cwd(vaultPath).quiet();
  expect(vaultLog.stdout.toString()).toContain("dispatch: alpha");
});

test("bridge dispatch local-commits vault without pushing to remote", async () => {
  await setupDispatchFixtures();
  await Bun.$`git add -A`.cwd(vaultPath).quiet();
  await Bun.$`git commit -m ${"seed vault"}`.cwd(vaultPath).quiet();
  await Bun.$`git branch -M main`.cwd(vaultPath).quiet();
  const bareRemote = join(tempRoot, "vault-remote.git");
  await Bun.$`git init --bare -b main ${bareRemote}`.quiet();
  await Bun.$`git remote add origin ${bareRemote}`.cwd(vaultPath).quiet();
  await Bun.$`git push -u origin main`.cwd(vaultPath).quiet();
  const remoteBefore = (
    await Bun.$`git rev-parse HEAD`.cwd(bareRemote).quiet()
  ).stdout
    .toString()
    .trim();

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Local only",
      "--description",
      "Should not push.",
    ],
  });

  expect(process.exitCode).toBe(0);
  const remoteAfter = (
    await Bun.$`git rev-parse HEAD`.cwd(bareRemote).quiet()
  ).stdout
    .toString()
    .trim();
  expect(remoteAfter).toBe(remoteBefore);

  const localLog = await Bun.$`git log --oneline`.cwd(vaultPath).quiet();
  expect(localLog.stdout.toString()).toContain("dispatch: alpha");
});

test("bridge dispatch loads Task from --file", async () => {
  await setupDispatchFixtures();
  const taskFile = join(tempRoot, "task.md");
  await writeFile(
    taskFile,
    `# Ship the feature

Implement the feature end to end.
`
  );

  await runCommand(bridgeCommand, {
    rawArgs: ["dispatch", "alpha", "--file", taskFile],
  });

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("Ship the feature");
});

test("bridge dispatch loads Task from --issue", async () => {
  await setupDispatchFixtures();
  const issueFile = join(tempRoot, "issue.md");
  await writeFile(
    issueFile,
    `# Ship from issue markdown

**Status:** ready-for-agent

## What to build

Source Tasks from local markdown issue files.
`
  );

  await runCommand(bridgeCommand, {
    rawArgs: ["dispatch", "alpha", "--issue", issueFile],
  });

  expect(process.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("Ship from issue markdown");
});

test("bridge dispatch errors when --issue is combined with --title", async () => {
  await setupDispatchFixtures();
  const issueFile = join(tempRoot, "issue.md");
  await writeFile(
    issueFile,
    `# Ship from issue

## What to build

Do the thing.
`
  );

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--issue",
      issueFile,
      "--title",
      "Inline title",
    ],
  });

  const output = stdout.join("\n");
  expect(output).toContain(
    "--issue cannot be combined with --title, --description, or --file"
  );
  expect(output).not.toContain("mock-claude: executed");
});

test("bridge dispatch errors for malformed issue file", async () => {
  await setupDispatchFixtures();
  const issueFile = join(tempRoot, "bad-issue.md");
  await writeFile(issueFile, "# Title only\n\nNo What to build section.\n");

  await runCommand(bridgeCommand, {
    rawArgs: ["dispatch", "alpha", "--issue", issueFile],
  });

  const output = stdout.join("\n");
  expect(output).toContain('Issue file is missing a "What to build" section.');
  expect(output).not.toContain("mock-claude: executed");
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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
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

test("bridge dispatch --context-depth traverses wiki-linked Archive pages", async () => {
  await setupDispatchFixtures();
  await writeFile(
    join(vaultPath, "archive", "alpha", "index.md"),
    "# Alpha index\n\nSee [[architecture]].\n"
  );

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Wiki context",
      "--description",
      "Traverse linked pages.",
      "--context-depth",
      "1",
    ],
  });

  expect(process.exitCode ?? 0).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("Wiki context");
  expect(logContent).toContain("**Tricorder:** passed");
});

test("bridge dispatch aborts on broken wiki-link before Away Team execution", async () => {
  await setupDispatchFixtures();
  await writeFile(
    join(vaultPath, "archive", "alpha", "index.md"),
    "# Alpha index\n\nSee [[Missing Page]].\n"
  );

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "Broken link",
      "--description",
      "Should fail before Away Team.",
      "--context-depth",
      "1",
    ],
  });

  const output = stdout.join("\n");
  expect(output).toContain("broken wiki-link to [[Missing Page]]");
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

test("bridge dispatch errors when CURSOR_API_KEY is missing for cursor agent", async () => {
  await setupDispatchFixtures("cursor");
  delete process.env.CURSOR_API_KEY;

  await runCommand(bridgeCommand, {
    rawArgs: [
      "dispatch",
      "alpha",
      "--title",
      "No cursor key",
      "--description",
      "Should fail fast.",
    ],
  });

  const output = stdout.join("\n");
  expect(output).toContain("CURSOR_API_KEY is not set");
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
`
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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
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
`
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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
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
`
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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
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
`
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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
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
`
  );
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.beta]
agent = "claude-code"
`
  );
  await mkdir(join(vaultPath, "archive", "beta"), { recursive: true });
  await writeFile(join(vaultPath, "archive", "beta", "index.md"), "# Beta\n");
  await writeFile(
    join(vaultPath, "archive", "beta", "captains-log.md"),
    "# Log\n"
  );

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
  const logFiles = (await readdir(logDir)).filter((name) =>
    name.endsWith(".md")
  );
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
  await writeFile(
    join(vaultPath, "archive", "beta", "captains-log.md"),
    "# Log\n"
  );
  await writeFile(
    join(vaultPath, "orders", "local.toml"),
    `[vault]
path = "${vaultPath}"

[repos.alpha]
path = "${repoPath}"

[repos.beta]
path = "${betaPath}"
`
  );
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.beta]
agent = "claude-code"
`
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
`
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

async function setupDiagnosticFixtures(): Promise<void> {
  await writeOrders();
  await mkdir(repoPath, { recursive: true });
  await Bun.$`git init -b main`.cwd(repoPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(repoPath).quiet();
  await Bun.$`git config user.name Test`.cwd(repoPath).quiet();
  await writeFile(join(repoPath, "README.md"), "# Alpha v1\n");
  await Bun.$`git add -A`.cwd(repoPath).quiet();
  await Bun.$`git commit -m ${"initial"}`.cwd(repoPath).quiet();
  const initialSha = (
    await Bun.$`git rev-parse HEAD`.cwd(repoPath).quiet()
  ).stdout
    .toString()
    .trim();

  await writeFile(join(repoPath, "README.md"), "# Alpha v2\n");
  await Bun.$`git add -A`.cwd(repoPath).quiet();
  await Bun.$`git commit -m ${"feature"}`.cwd(repoPath).quiet();

  const archiveDir = join(vaultPath, "archive", "alpha");
  await mkdir(archiveDir, { recursive: true });
  const frontmatter = (sha: string) => `---
entity: alpha-service
repo: alpha
updated: 2026-06-01
sources: ["alpha@${sha}"]
---
`;
  await writeFile(
    join(archiveDir, "index.md"),
    `${frontmatter(initialSha)}# Alpha index\n`
  );
  await writeFile(
    join(archiveDir, "captains-log.md"),
    `${frontmatter(initialSha)}# Captain's Log\n`
  );

  await Bun.$`git init -b main`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
  await Bun.$`git add -A`.cwd(vaultPath).quiet();
  await Bun.$`git commit -m ${"seed vault"}`.cwd(vaultPath).quiet();

  const bareRemote = join(tempRoot, "vault-remote.git");
  await Bun.$`git init --bare -b main ${bareRemote}`.quiet();
  await Bun.$`git remote add origin ${bareRemote}`.cwd(vaultPath).quiet();
  await Bun.$`git push -u origin main`.cwd(vaultPath).quiet();

  await installMockDiagnosticClaude();
  process.env.SCOTTY_CLAUDE_PATH = join(mockBinDir, "claude");
  process.env.SCOTTY_TEST_REPO_PATH = repoPath;
}

async function installMockDiagnosticClaude(): Promise<void> {
  await mkdir(mockBinDir, { recursive: true });
  const script = `#!/bin/sh
HEAD=$(git -C "$SCOTTY_TEST_REPO_PATH" rev-parse HEAD)
DATE=2026-06-12
write_page() {
  cat > "$1" <<EOF
---
entity: alpha-service
repo: alpha
updated: $DATE
sources: ["alpha@$HEAD"]
---
$2
EOF
}
write_page "archive/alpha/index.md" "# Alpha index

Updated by diagnostic mock.
"
echo "mock-diagnostic: archive updated"
exit 0
`;
  const scriptPath = join(mockBinDir, "claude");
  await writeFile(scriptPath, script);
  await chmod(scriptPath, 0o755);
}

test("bridge diagnostic updates archive, commits, and pushes vault", async () => {
  await setupDiagnosticFixtures();

  await runCommand(bridgeCommand, { rawArgs: ["diagnostic", "alpha"] });

  expect(process.exitCode).toBe(0);

  const indexContent = await Bun.file(
    join(vaultPath, "archive", "alpha", "index.md")
  ).text();
  expect(indexContent).toContain("Updated by diagnostic mock");

  const captainsLog = await Bun.file(
    join(vaultPath, "archive", "alpha", "captains-log.md")
  ).text();
  expect(captainsLog).toContain("mock-diagnostic: archive updated");

  const bareRemote = join(tempRoot, "vault-remote.git");
  const remoteLog = await Bun.$`git log --oneline`.cwd(bareRemote).quiet();
  expect(remoteLog.stdout.toString()).toContain("diagnostic: alpha");
});

test("bridge diagnostic hails and exits non-zero on validation failure", async () => {
  await setupDiagnosticFixtures();
  const { payloads } = installMockDiscordWebhook();
  await writeFile(
    join(mockBinDir, "claude"),
    `#!/bin/sh
cat > archive/alpha/index.md <<EOF
# Missing frontmatter
EOF
echo "mock-diagnostic: invalid output"
exit 0
`
  );
  await chmod(join(mockBinDir, "claude"), 0o755);

  await runCommand(bridgeCommand, { rawArgs: ["diagnostic", "alpha"] });

  expect(process.exitCode).toBe(1);
  expect(payloads).toHaveLength(1);
  const hailBody = JSON.parse(payloads[0]!);
  expect(hailBody.content).toContain("alpha");
  expect(hailBody.content).toContain("Diagnostic failure");
});

test("bridge diagnostic errors when repo is missing from roster", async () => {
  await setupDiagnosticFixtures();

  await runCommand(bridgeCommand, { rawArgs: ["diagnostic", "missing"] });

  const output = stdout.join("\n");
  expect(output).toContain('Repository "missing" is not on the Duty Roster');
  expect(process.exitCode).toBe(1);
});

async function writeEngineeringLogFixtures(): Promise<void> {
  await writeOrders();
  await mkdir(join(vaultPath, "archive"), { recursive: true });
  await mkdir(join(vaultPath, "log"), { recursive: true });
  await writeFile(
    join(vaultPath, "log", "2026-06-10.md"),
    `## dispatch: alpha — task-old

- **Repo:** alpha
- **Task:** Old alpha task
- **Priority:** 1
- **Outcome:** success
- **Duration:** 500ms
- **Summary:** Earlier dispatch.
`
  );
  await writeFile(
    join(vaultPath, "log", "2026-06-12.md"),
    `## dispatch: alpha — task-recent

- **Repo:** alpha
- **Task:** Recent alpha task
- **Priority:** 5
- **Outcome:** success
- **Duration:** 1200ms
- **Summary:** Latest alpha run.
- **Tricorder:** passed
- **Verification:** bun test passed

## dispatch: beta — task-beta

- **Repo:** beta
- **Task:** Beta task
- **Priority:** 3
- **Outcome:** failure
- **Duration:** 800ms
- **Summary:** Beta failed.
- **Tricorder:** failed
- **Verification:** bun test failed
`
  );
  await Bun.$`git init`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
  await Bun.$`git add -A`.cwd(vaultPath).quiet();
  await Bun.$`git commit -m ${"seed log fixtures"}`.cwd(vaultPath).quiet();
}

test("bridge log prints recent Engineering Log entries", async () => {
  await writeEngineeringLogFixtures();

  await runCommand(bridgeCommand, { rawArgs: ["log"] });

  const output = stdout.join("\n");
  expect(output).toContain("Recent alpha task");
  expect(output).toContain("Beta task");
  expect(output).toContain("Tricorder: passed");
  expect(output).toContain("Tricorder: failed");
  expect(output.indexOf("Recent alpha task")).toBeLessThan(
    output.indexOf("Old alpha task")
  );
});

test("bridge log --repo filters to a single repository", async () => {
  await writeEngineeringLogFixtures();

  await runCommand(bridgeCommand, { rawArgs: ["log", "--repo", "beta"] });

  const output = stdout.join("\n");
  expect(output).toContain("Beta task");
  expect(output).not.toContain("Recent alpha task");
  expect(output).not.toContain("Old alpha task");
});

test("bridge log --since and --limit constrain output", async () => {
  await writeEngineeringLogFixtures();

  await runCommand(bridgeCommand, {
    rawArgs: [
      "log",
      "--repo",
      "alpha",
      "--since",
      "2026-06-11",
      "--limit",
      "1",
    ],
  });

  const output = stdout.join("\n");
  expect(output).toContain("Recent alpha task");
  expect(output).not.toContain("Old alpha task");
  expect(output).not.toContain("Beta task");
});

test("bridge log prints clear message when log directory is empty", async () => {
  await writeOrders();
  await mkdir(join(vaultPath, "log"), { recursive: true });
  await Bun.$`git init`.cwd(vaultPath).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["log"] });

  const output = stdout.join("\n");
  expect(output).toContain("No Engineering Log entries found.");
  expect(process.exitCode ?? 0).toBe(0);
});

test("bridge log pulls vault before reading entries", async () => {
  await writeEngineeringLogFixtures();
  await Bun.$`git branch -M main`.cwd(vaultPath).quiet();
  const bareRemote = join(tempRoot, "vault-remote.git");
  await Bun.$`git init --bare -b main ${bareRemote}`.quiet();
  await Bun.$`git remote add origin ${bareRemote}`.cwd(vaultPath).quiet();
  await Bun.$`git push -u origin main`.cwd(vaultPath).quiet();

  const clonePath = join(tempRoot, "vault-clone");
  await Bun.$`git clone ${bareRemote} ${clonePath}`.quiet();
  process.env.SCOTTY_VAULT_PATH = clonePath;

  const remoteVault = join(tempRoot, "remote-vault");
  await Bun.$`git clone ${bareRemote} ${remoteVault}`.quiet();
  await writeFile(
    join(remoteVault, "log", "2026-06-13.md"),
    `## dispatch: alpha — task-remote

- **Repo:** alpha
- **Task:** Remote-only entry
- **Priority:** 9
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** Pulled from remote.
`
  );
  await Bun.$`git config user.email test@example.com`.cwd(remoteVault).quiet();
  await Bun.$`git config user.name Test`.cwd(remoteVault).quiet();
  await Bun.$`git add -A`.cwd(remoteVault).quiet();
  await Bun.$`git commit -m ${"add remote log"}`.cwd(remoteVault).quiet();
  await Bun.$`git push origin main`.cwd(remoteVault).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["log", "--limit", "1"] });

  const output = stdout.join("\n");
  expect(output).toContain("Remote-only entry");
});

async function writeFleetStatusFixtures(): Promise<void> {
  await writeEngineeringLogFixtures();

  const alphaArchive = join(vaultPath, "archive", "alpha");
  await mkdir(alphaArchive, { recursive: true });
  await writeFile(
    join(alphaArchive, "index.md"),
    `---
entity: alpha-service
repo: alpha
updated: 2026-06-11
sources: ["alpha@deadbeef1234"]
---
# Alpha index
`
  );

  await Bun.$`git add -A`.cwd(vaultPath).quiet();
  await Bun.$`git commit -m ${"add archive fixtures"}`.cwd(vaultPath).quiet();
}

test("bridge status lists every repo with dispatch, sources, and stardate", async () => {
  await writeFleetStatusFixtures();

  await runCommand(bridgeCommand, { rawArgs: ["status"] });

  const output = stdout.join("\n");
  expect(output).toContain("Fleet Status");
  expect(output).toContain("alpha");
  expect(output).toContain("success (2026-06-12)");
  expect(output).toContain("deadbeef1234");
  expect(output).toContain("2026-06-11");
  expect(output).toContain("beta");
  expect(output).toContain("failure (2026-06-12)");
  expect(output).toContain("(none)");
  expect(process.exitCode ?? 0).toBe(0);
});

test("bridge status pulls vault before reading fleet data", async () => {
  await writeFleetStatusFixtures();
  await Bun.$`git branch -M main`.cwd(vaultPath).quiet();
  const bareRemote = join(tempRoot, "status-vault-remote.git");
  await Bun.$`git init --bare -b main ${bareRemote}`.quiet();
  await Bun.$`git remote add origin ${bareRemote}`.cwd(vaultPath).quiet();
  await Bun.$`git push -u origin main`.cwd(vaultPath).quiet();

  const clonePath = join(tempRoot, "status-vault-clone");
  await Bun.$`git clone ${bareRemote} ${clonePath}`.quiet();
  process.env.SCOTTY_VAULT_PATH = clonePath;

  const remoteVault = join(tempRoot, "status-remote-vault");
  await Bun.$`git clone ${bareRemote} ${remoteVault}`.quiet();
  await writeFile(
    join(remoteVault, "log", "2026-06-13.md"),
    `## dispatch: beta — task-remote

- **Repo:** beta
- **Task:** Remote beta success
- **Priority:** 1
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** Pulled from remote.
`
  );
  await mkdir(join(remoteVault, "archive", "beta"), { recursive: true });
  await writeFile(
    join(remoteVault, "archive", "beta", "index.md"),
    `---
entity: beta-service
repo: beta
updated: 2026-06-13
sources: ["beta@cafebabe5678"]
---
# Beta index
`
  );
  await Bun.$`git config user.email test@example.com`.cwd(remoteVault).quiet();
  await Bun.$`git config user.name Test`.cwd(remoteVault).quiet();
  await Bun.$`git add -A`.cwd(remoteVault).quiet();
  await Bun.$`git commit -m ${"add remote status data"}`
    .cwd(remoteVault)
    .quiet();
  await Bun.$`git push origin main`.cwd(remoteVault).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["status"] });

  const output = stdout.join("\n");
  expect(output).toContain("success (2026-06-13)");
  expect(output).toContain("cafebabe5678");
  expect(output).toContain("2026-06-13");
});
