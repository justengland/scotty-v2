import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resetHailWarningsForTests } from "../hailing/send-hail";
import type { HailChannel } from "../hailing/types";
import { createCursorTeam } from "../away-team/cursor-team";
import { runDispatch } from "./run-dispatch";
import type { AwayTeam, ExecutionResult } from "./types";

const fixturesDir = join(import.meta.dir, "../../test-fixtures");

let tempRoot: string;
let vaultPath: string;

function mockAwayTeam(result: Partial<ExecutionResult> = {}): AwayTeam {
  return {
    id: "mock",
    async execute() {
      return {
        success: true,
        stdout: "away-team ok",
        stderr: "",
        durationMs: 5,
        ...result,
      };
    },
  };
}

beforeEach(async () => {
  tempRoot = join(tmpdir(), `dispatch-test-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  await mkdir(join(vaultPath, "archive", "alpha"), { recursive: true });
  await writeFile(join(vaultPath, "archive", "alpha", "index.md"), "# Alpha\n");
  await writeFile(
    join(vaultPath, "archive", "alpha", "captains-log.md"),
    "# Log\n"
  );
  await Bun.$`git init`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
});

afterEach(async () => {
  resetHailWarningsForTests();
  await rm(tempRoot, { recursive: true, force: true });
});

function mockHailChannel(): HailChannel & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
    },
  };
}

test("runDispatch skips Tricorder when repo has no verifier", async () => {
  const repoPath = join(tempRoot, "no-verify-repo");
  await mkdir(repoPath, { recursive: true });

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
        },
      },
    },
    repoName: "alpha",
    title: "No verify",
    description: "Away Team decides outcome.",
    awayTeam: mockAwayTeam({ success: false }),
    hailChannels: [],
  });

  expect(result.exitCode).toBe(1);

  const logDir = join(vaultPath, "log");
  const logFiles = await readdir(logDir);
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).not.toContain("**Tricorder:**");
});

test("runDispatch uses Tricorder result when verify is configured", async () => {
  const repoPath = join(fixturesDir, "bun-pass");

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "bun",
        },
      },
    },
    repoName: "alpha",
    title: "Verify pass",
    description: "Tricorder passes.",
    awayTeam: mockAwayTeam({ success: false }),
  });

  expect(result.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = await readdir(logDir);
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("**Tricorder:** passed");
  expect(logContent).toContain("**Outcome:** success");
});

test("runDispatch fails when Tricorder fails", async () => {
  const repoPath = join(fixturesDir, "bun-fail");

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "bun",
        },
      },
    },
    repoName: "alpha",
    title: "Verify fail",
    description: "Tricorder fails.",
    awayTeam: mockAwayTeam({ success: true }),
    hailChannels: [],
  });

  expect(result.exitCode).toBe(1);

  const logDir = join(vaultPath, "log");
  const logFiles = await readdir(logDir);
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("**Tricorder:** failed");
  expect(logContent).toContain("**Outcome:** failure");
});

test("runDispatch honors --skip-verify", async () => {
  const repoPath = join(fixturesDir, "bun-fail");

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "bun",
        },
      },
    },
    repoName: "alpha",
    title: "Skip verify",
    description: "Away Team decides.",
    skipVerify: true,
    awayTeam: mockAwayTeam({ success: true }),
  });

  expect(result.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = await readdir(logDir);
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).not.toContain("**Tricorder:**");
});

test("runDispatch runs markdown verifier for verify = markdown", async () => {
  const repoPath = join(fixturesDir, "markdown-pass");

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "markdown",
        },
      },
    },
    repoName: "alpha",
    title: "Markdown verify",
    description: "Docs check.",
    awayTeam: mockAwayTeam(),
  });

  expect(result.exitCode).toBe(0);

  const logDir = join(vaultPath, "log");
  const logFiles = await readdir(logDir);
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("markdown verification passed");
});

test("runDispatch hails on Tricorder failure with repo and summary", async () => {
  const repoPath = join(fixturesDir, "bun-fail");
  const hail = mockHailChannel();

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "bun",
        },
      },
    },
    repoName: "alpha",
    title: "Verify fail",
    description: "Tricorder fails.",
    awayTeam: mockAwayTeam({ success: true }),
    hailChannels: [hail],
  });

  expect(result.exitCode).toBe(1);
  expect(hail.messages).toHaveLength(1);
  expect(hail.messages[0]).toContain("alpha");
  expect(hail.messages[0]).toContain("Tricorder failure");
  expect(hail.messages[0]).toContain("bun test");
});

test("runDispatch hails on Away Team crash when no verifier", async () => {
  const repoPath = join(tempRoot, "no-verify-repo");
  await mkdir(repoPath, { recursive: true });
  const hail = mockHailChannel();

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
        },
      },
    },
    repoName: "alpha",
    title: "Away Team fail",
    description: "No Tricorder.",
    awayTeam: mockAwayTeam({ success: false, stderr: "claude exited 1" }),
    hailChannels: [hail],
  });

  expect(result.exitCode).toBe(1);
  expect(hail.messages).toHaveLength(1);
  expect(hail.messages[0]).toContain("alpha");
  expect(hail.messages[0]).toContain("Away Team crash");
  expect(hail.messages[0]).toContain("claude exited 1");
});

test("runDispatch does not hail on success", async () => {
  const repoPath = join(fixturesDir, "bun-pass");
  const hail = mockHailChannel();

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "bun",
        },
      },
    },
    repoName: "alpha",
    title: "Success",
    description: "All green.",
    awayTeam: mockAwayTeam(),
    hailChannels: [hail],
  });

  expect(result.exitCode).toBe(0);
  expect(hail.messages).toHaveLength(0);
});

test("runDispatch does not hail when Tricorder passes despite Away Team failure", async () => {
  const repoPath = join(fixturesDir, "bun-pass");
  const hail = mockHailChannel();

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "claude-code",
          verify: "bun",
        },
      },
    },
    repoName: "alpha",
    title: "Tricorder wins",
    description: "Away Team failed.",
    awayTeam: mockAwayTeam({ success: false }),
    hailChannels: [hail],
  });

  expect(result.exitCode).toBe(0);
  expect(hail.messages).toHaveLength(0);
});

test("runDispatch routes cursor agent through CursorTeam with mocked SDK", async () => {
  const repoPath = join(tempRoot, "cursor-repo");
  await mkdir(repoPath, { recursive: true });
  let capturedPrompt: string | undefined;

  const cursorTeam = createCursorTeam({
    env: {
      CURSOR_API_KEY: "cursor_test_key",
      SCOTTY_CURSOR_MODEL: "composer-2.5",
      SCOTTY_CURSOR_STREAM_LOG: "0",
    },
    createAgent: async () => ({
      agentId: "agent-1",
      model: undefined,
      async send(message: string) {
        capturedPrompt = message;
        return {
          id: "run-1",
          agentId: "agent-1",
          supports: () => true,
          unsupportedReason: () => undefined,
          async *stream() {},
          conversation: async () => [],
          wait: async () => ({
            id: "run-1",
            status: "finished" as const,
            result: "cursor ok",
            durationMs: 12,
          }),
          cancel: async () => {},
          status: "finished" as const,
          onDidChangeStatus: () => () => {},
        };
      },
      close: () => {},
      reload: async () => {},
      [Symbol.asyncDispose]: async () => {},
      listArtifacts: async () => [],
      downloadArtifact: async () => Buffer.from(""),
    }),
  });

  const result = await runDispatch({
    vaultPath,
    orders: {
      vault: {},
      repos: {
        alpha: {
          path: repoPath,
          agent: "cursor",
        },
      },
    },
    repoName: "alpha",
    title: "Cursor dispatch",
    description: "Run via CursorTeam.",
    awayTeam: cursorTeam,
    hailChannels: [],
  });

  expect(result.exitCode).toBe(0);
  expect(capturedPrompt).toContain("# Task: Cursor dispatch");
  expect(capturedPrompt).toContain("Run via CursorTeam.");
  expect(capturedPrompt).toContain("## Starfleet Archive context");

  const logDir = join(vaultPath, "log");
  const logFiles = await readdir(logDir);
  const logContent = await Bun.file(join(logDir, logFiles[0]!)).text();
  expect(logContent).toContain("dispatch: alpha");
  expect(logContent).toContain("Cursor dispatch");
});
