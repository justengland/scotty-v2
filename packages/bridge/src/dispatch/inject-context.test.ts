import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadContextFiles, resolveContextPaths } from "./inject-context";

let tempRoot: string;
let vaultPath: string;
const repo = "alpha";

beforeEach(async () => {
  tempRoot = join(tmpdir(), `inject-context-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  const archiveDir = join(vaultPath, "archive", repo);
  await mkdir(archiveDir, { recursive: true });

  await writeFile(
    join(archiveDir, "index.md"),
    "# Alpha\n\nSee [[architecture]].\n"
  );
  await writeFile(
    join(archiveDir, "architecture.md"),
    "# Architecture\n\nSee [[decision]].\n"
  );
  await writeFile(join(archiveDir, "decision.md"), "# Decision\n\nFinal.\n");
  await writeFile(join(archiveDir, "captains-log.md"), "# Log\n");
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test("resolveContextPaths includes defaults and mission order extras", () => {
  expect(resolveContextPaths(repo)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
  ]);
  expect(resolveContextPaths(repo, ["runbook.md"])).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
    "archive/alpha/runbook.md",
  ]);
});

test("loadContextFiles delegates to archive traversal", async () => {
  const paths = resolveContextPaths(repo);
  const files = await loadContextFiles(vaultPath, paths, {
    repo,
    contextDepth: 1,
  });

  expect(files.map((file) => file.path)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
    "archive/alpha/architecture.md",
  ]);
});
