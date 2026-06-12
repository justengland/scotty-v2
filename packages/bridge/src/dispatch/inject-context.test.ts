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

test("depth 0 loads only initial context paths", async () => {
  const paths = resolveContextPaths(repo);
  const files = await loadContextFiles(vaultPath, paths, {
    repo,
    contextDepth: 0,
  });

  expect(files.map((file) => file.path)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
  ]);
});

test("depth 1 adds linked archive pages to context", async () => {
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

test("depth 2 follows links from traversed pages", async () => {
  const paths = resolveContextPaths(repo);
  const files = await loadContextFiles(vaultPath, paths, {
    repo,
    contextDepth: 2,
  });

  expect(files.map((file) => file.path)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
    "archive/alpha/architecture.md",
    "archive/alpha/decision.md",
  ]);
});

test("broken wiki-link aborts with clear error naming target", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(
    join(archiveDir, "index.md"),
    "# Alpha\n\nSee [[Missing Page]].\n"
  );

  const paths = resolveContextPaths(repo);

  await expect(
    loadContextFiles(vaultPath, paths, { repo, contextDepth: 1 })
  ).rejects.toThrow("broken wiki-link to [[Missing Page]]");
});

test("cycle-safe traversal does not infinite-loop", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(
    join(archiveDir, "index.md"),
    "# Alpha\n\nSee [[architecture]].\n"
  );
  await writeFile(
    join(archiveDir, "architecture.md"),
    "# Architecture\n\nBack to [[index]].\n"
  );

  const paths = resolveContextPaths(repo);
  const files = await loadContextFiles(vaultPath, paths, {
    repo,
    contextDepth: 3,
  });

  expect(files.map((file) => file.path)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
    "archive/alpha/architecture.md",
  ]);
});
