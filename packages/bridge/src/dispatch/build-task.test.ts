import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildTask } from "./build-task";
import { DispatchError } from "./errors";

let tempRoot: string;
let vaultPath: string;

beforeEach(async () => {
  tempRoot = join(tmpdir(), `build-task-test-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  await mkdir(join(vaultPath, "archive", "alpha"), { recursive: true });
  await writeFile(join(vaultPath, "archive", "alpha", "index.md"), "# Alpha\n");
  await writeFile(
    join(vaultPath, "archive", "alpha", "captains-log.md"),
    "# Log\n"
  );
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

const sampleIssue = `# Ship from issue

**Status:** ready-for-agent

## What to build

Implement the tracer bullet end to end.
`;

test("buildTask loads title and description from issue file", async () => {
  const issuePath = join(tempRoot, "issue.md");
  await writeFile(issuePath, sampleIssue);

  const task = await buildTask({
    repo: "alpha",
    vaultPath,
    profile: { path: join(tempRoot, "repo"), agent: "claude-code" },
    issue: issuePath,
  });

  expect(task.title).toBe("Ship from issue");
  expect(task.description).toBe("Implement the tracer bullet end to end.");
});

test("buildTask rejects issue combined with inline title or description", async () => {
  const issuePath = join(tempRoot, "issue.md");
  await writeFile(issuePath, sampleIssue);

  await expect(
    buildTask({
      repo: "alpha",
      vaultPath,
      profile: { path: join(tempRoot, "repo"), agent: "claude-code" },
      issue: issuePath,
      title: "Inline title",
    })
  ).rejects.toThrow(DispatchError);

  await expect(
    buildTask({
      repo: "alpha",
      vaultPath,
      profile: { path: join(tempRoot, "repo"), agent: "claude-code" },
      issue: issuePath,
      description: "Inline description",
    })
  ).rejects.toThrow("--issue cannot be combined with --title or --description");
});

test("buildTask rejects issue combined with file", async () => {
  const issuePath = join(tempRoot, "issue.md");
  const taskPath = join(tempRoot, "task.md");
  await writeFile(issuePath, sampleIssue);
  await writeFile(taskPath, "# Task\n\nBody");

  await expect(
    buildTask({
      repo: "alpha",
      vaultPath,
      profile: { path: join(tempRoot, "repo"), agent: "claude-code" },
      issue: issuePath,
      file: taskPath,
    })
  ).rejects.toThrow("--issue cannot be combined with --file");
});

test("buildTask throws when issue file is missing", async () => {
  await expect(
    buildTask({
      repo: "alpha",
      vaultPath,
      profile: { path: join(tempRoot, "repo"), agent: "claude-code" },
      issue: join(tempRoot, "missing.md"),
    })
  ).rejects.toThrow(DispatchError);
});
