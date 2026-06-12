import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
    "# Log\n",
  );
  await Bun.$`git init`.cwd(vaultPath).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(vaultPath).quiet();
  await Bun.$`git config user.name Test`.cwd(vaultPath).quiet();
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

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
