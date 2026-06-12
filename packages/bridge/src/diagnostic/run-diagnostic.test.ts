import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resetHailWarningsForTests } from "../hailing/send-hail";
import type { HailChannel } from "../hailing/types";
import type { DiagnosticAgent } from "./claude-diagnostic";
import { formatFrontmatter } from "./parse-frontmatter";
import { readLastRecordedSha } from "./read-last-sha";
import { diffRepoSince } from "./repo-diff";
import { runDiagnostic } from "./run-diagnostic";
import { validateArchivePages } from "./validate-archive";

let tempRoot: string;
let vaultPath: string;
let repoPath: string;
let initialSha: string;
let headSha: string;

async function initGitRepo(path: string): Promise<void> {
  await Bun.$`git init -b main`.cwd(path).quiet();
  await Bun.$`git config user.email test@example.com`.cwd(path).quiet();
  await Bun.$`git config user.name Test`.cwd(path).quiet();
}

async function setupRepoWithTwoCommits(): Promise<void> {
  repoPath = join(tempRoot, "alpha-repo");
  await mkdir(repoPath, { recursive: true });
  await initGitRepo(repoPath);

  await writeFile(join(repoPath, "README.md"), "# Alpha v1\n");
  await Bun.$`git add -A`.cwd(repoPath).quiet();
  await Bun.$`git commit -m ${"initial"}`.cwd(repoPath).quiet();
  initialSha = (
    await Bun.$`git rev-parse HEAD`.cwd(repoPath).quiet()
  ).stdout
    .toString()
    .trim();

  await writeFile(join(repoPath, "README.md"), "# Alpha v2\n");
  await mkdir(join(repoPath, "src"), { recursive: true });
  await writeFile(join(repoPath, "src", "index.ts"), "export const x = 1;\n");
  await Bun.$`git add -A`.cwd(repoPath).quiet();
  await Bun.$`git commit -m ${"feature"}`.cwd(repoPath).quiet();
  headSha = (
    await Bun.$`git rev-parse HEAD`.cwd(repoPath).quiet()
  ).stdout
    .toString()
    .trim();
}

function archivePage(sha: string, body = "# Alpha index\n"): string {
  return `${formatFrontmatter({
    entity: "alpha-service",
    repo: "alpha",
    updated: "2026-06-01",
    sources: [`alpha@${sha}`],
  })}
${body}`;
}

async function setupVault(staleSha: string): Promise<void> {
  vaultPath = join(tempRoot, "vault");
  const archiveDir = join(vaultPath, "archive", "alpha");
  await mkdir(archiveDir, { recursive: true });
  await writeFile(join(archiveDir, "index.md"), archivePage(staleSha));
  await writeFile(
    join(archiveDir, "captains-log.md"),
    archivePage(staleSha, "# Captain's Log\n"),
  );
  await initGitRepo(vaultPath);
  await Bun.$`git add -A`.cwd(vaultPath).quiet();
  await Bun.$`git commit -m ${"seed vault"}`.cwd(vaultPath).quiet();
}

function mockHailChannel(): HailChannel & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    async send(message) {
      messages.push(message);
    },
  };
}

function mockDiagnosticAgent(
  onPrompt?: (prompt: string) => void,
): DiagnosticAgent & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    id: "mock",
    prompts,
    async updateArchive({ vaultPath, repoName, prompt }) {
      prompts.push(prompt);
      onPrompt?.(prompt);

      const archiveDir = join(vaultPath, "archive", repoName);
      const head = headSha;
      const updatedIndex = archivePage(head, "# Alpha index\n\nUpdated from diff.\n");
      await writeFile(join(archiveDir, "index.md"), updatedIndex);

      return {
        success: true,
        stdout: "mock-diagnostic: archive updated",
        stderr: "",
        durationMs: 1,
      };
    },
  };
}

beforeEach(async () => {
  tempRoot = join(tmpdir(), `diagnostic-test-${crypto.randomUUID()}`);
  await setupRepoWithTwoCommits();
});

afterEach(async () => {
  resetHailWarningsForTests();
  await rm(tempRoot, { recursive: true, force: true });
});

test("readLastRecordedSha reads sources from archive frontmatter", async () => {
  await setupVault(initialSha);
  const sha = await readLastRecordedSha(vaultPath, "alpha");
  expect(sha).toBe(initialSha);
});

test("diffRepoSince returns changes after recorded SHA", async () => {
  const diff = await diffRepoSince(repoPath, initialSha);
  expect(diff).toContain("Alpha v2");
  expect(diff).toContain("src/index.ts");
});

test("runDiagnostic includes repo diff since archive SHA in Claude prompt", async () => {
  await setupVault(initialSha);
  const agent = mockDiagnosticAgent();

  await runDiagnostic({
    vaultPath,
    orders: {
      vault: {},
      repos: { alpha: { path: repoPath, agent: "claude-code" } },
    },
    repoName: "alpha",
    agent,
    commitAndPush: async () => {},
    stardate: "2026-06-12",
  });

  expect(agent.prompts[0]).toContain(initialSha);
  expect(agent.prompts[0]).toContain("Alpha v2");
  expect(agent.prompts[0]).toContain("frontmatter");
});

test("runDiagnostic appends Captain's Log, validates, commits, and pushes vault", async () => {
  await setupVault(initialSha);
  let pushed = false;
  const agent = mockDiagnosticAgent();

  const result = await runDiagnostic({
    vaultPath,
    orders: {
      vault: {},
      repos: { alpha: { path: repoPath, agent: "claude-code" } },
    },
    repoName: "alpha",
    agent,
    commitAndPush: async (path, message) => {
      expect(path).toBe(vaultPath);
      expect(message).toContain("diagnostic: alpha");
      await Bun.$`git add -A`.cwd(path).quiet();
      await Bun.$`git commit -m ${message}`.cwd(path).quiet();
      pushed = true;
    },
    stardate: "2026-06-12",
  });

  expect(result.exitCode).toBe(0);
  expect(pushed).toBe(true);

  const captainsLog = await readFile(
    join(vaultPath, "archive", "alpha", "captains-log.md"),
    "utf8",
  );
  expect(captainsLog).toContain("## 2026-06-12");
  expect(captainsLog).toContain("mock-diagnostic: archive updated");
  expect(captainsLog).toContain(`alpha@${headSha}`);
});

test("validateArchivePages rejects missing frontmatter and stale sources", async () => {
  await setupVault(initialSha);
  await writeFile(
    join(vaultPath, "archive", "alpha", "broken.md"),
    "# Missing frontmatter\n",
  );

  const errors = await validateArchivePages({
    vaultPath,
    repoName: "alpha",
    repoHeadSha: headSha,
  });

  expect(errors.some((error) => error.includes('missing frontmatter field "entity"'))).toBe(
    true,
  );
  expect(errors.some((error) => error.includes("stale sources"))).toBe(true);
});

test("validateArchivePages rejects broken wiki-links", async () => {
  await setupVault(headSha);
  await writeFile(
    join(vaultPath, "archive", "alpha", "index.md"),
    `${archivePage(headSha, "# Alpha\n\nSee [[Missing Page]].\n")}`,
  );

  const errors = await validateArchivePages({
    vaultPath,
    repoName: "alpha",
    repoHeadSha: headSha,
  });

  expect(errors.some((error) => error.includes("broken wiki-link"))).toBe(true);
});

test("runDiagnostic hails and exits non-zero when validation fails", async () => {
  await setupVault(initialSha);
  const hail = mockHailChannel();
  const agent: DiagnosticAgent = {
    id: "mock",
    async updateArchive({ vaultPath, repoName }) {
      const archiveDir = join(vaultPath, "archive", repoName);
      await writeFile(
        join(archiveDir, "index.md"),
        archivePage(initialSha, "# Alpha\n\nStale sources left in place.\n"),
      );
      return {
        success: true,
        stdout: "mock-diagnostic: left stale sources",
        stderr: "",
        durationMs: 1,
      };
    },
  };

  const result = await runDiagnostic({
    vaultPath,
    orders: {
      vault: {},
      repos: { alpha: { path: repoPath, agent: "claude-code" } },
    },
    repoName: "alpha",
    agent,
    hailChannels: [hail],
    commitAndPush: async () => {
      throw new Error("should not commit");
    },
    stardate: "2026-06-12",
  });

  expect(result.exitCode).toBe(1);
  expect(hail.messages).toHaveLength(1);
  expect(hail.messages[0]).toContain("Diagnostic failure");
  expect(hail.messages[0]).toContain("alpha");
});

test("runDiagnostic hails when Claude fails", async () => {
  await setupVault(initialSha);
  const hail = mockHailChannel();
  const agent: DiagnosticAgent = {
    id: "mock",
    async updateArchive() {
      return {
        success: false,
        stdout: "",
        stderr: "claude crashed",
        durationMs: 1,
      };
    },
  };

  const result = await runDiagnostic({
    vaultPath,
    orders: {
      vault: {},
      repos: { alpha: { path: repoPath, agent: "claude-code" } },
    },
    repoName: "alpha",
    agent,
    hailChannels: [hail],
    commitAndPush: async () => {
      throw new Error("should not commit");
    },
  });

  expect(result.exitCode).toBe(1);
  expect(hail.messages).toHaveLength(1);
  expect(hail.messages[0]).toContain("claude crashed");
});

test("runDiagnostic does not modify target repository", async () => {
  await setupVault(initialSha);
  const repoMarker = join(repoPath, "marker.txt");
  await writeFile(repoMarker, "untouched");
  const agent = mockDiagnosticAgent();

  await runDiagnostic({
    vaultPath,
    orders: {
      vault: {},
      repos: { alpha: { path: repoPath, agent: "claude-code" } },
    },
    repoName: "alpha",
    agent,
    commitAndPush: async () => {},
    stardate: "2026-06-12",
  });

  expect(await Bun.file(repoMarker).text()).toBe("untouched");
  const repoStatus = await Bun.$`git status --porcelain`.cwd(repoPath).quiet();
  expect(repoStatus.stdout.toString().trim()).toBe("?? marker.txt");
});
