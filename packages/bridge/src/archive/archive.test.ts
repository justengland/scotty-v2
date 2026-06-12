import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildPageIndex,
  resolveWikiLink,
  traverseContextPaths,
} from "./archive";

let tempRoot: string;
let vaultPath: string;
const repo = "alpha";

beforeEach(async () => {
  tempRoot = join(tmpdir(), `archive-${crypto.randomUUID()}`);
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

test("buildPageIndex maps aliases to vault-relative paths", async () => {
  const index = await buildPageIndex(vaultPath);

  expect(index.get("archive/alpha/index.md")).toBe("archive/alpha/index.md");
  expect(index.get("index.md")).toBe("archive/alpha/index.md");
  expect(index.get("archive/alpha/index")).toBe("archive/alpha/index.md");
  expect(index.get("index")).toBe("archive/alpha/index.md");
});

test("resolveWikiLink prefers repo-scoped candidates", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(join(archiveDir, "shared.md"), "# Alpha shared\n");
  const otherDir = join(vaultPath, "archive", "beta");
  await mkdir(otherDir, { recursive: true });
  await writeFile(join(otherDir, "shared.md"), "# Beta shared\n");
  const index = await buildPageIndex(vaultPath);

  const resolved = resolveWikiLink("shared", { repo, index });

  expect(resolved).toBe("archive/alpha/shared.md");
});

test("depth 0 loads only seed paths without building index", async () => {
  const seeds = ["archive/alpha/index.md", "archive/alpha/captains-log.md"];
  const files = await traverseContextPaths(vaultPath, seeds, {
    repo,
    contextDepth: 0,
  });

  expect(files.map((file) => file.path)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
  ]);
});

test("depth 1 adds linked archive pages to context", async () => {
  const seeds = ["archive/alpha/index.md", "archive/alpha/captains-log.md"];
  const files = await traverseContextPaths(vaultPath, seeds, {
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
  const seeds = ["archive/alpha/index.md", "archive/alpha/captains-log.md"];
  const files = await traverseContextPaths(vaultPath, seeds, {
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

  const seeds = ["archive/alpha/index.md", "archive/alpha/captains-log.md"];

  await expect(
    traverseContextPaths(vaultPath, seeds, { repo, contextDepth: 1 })
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

  const seeds = ["archive/alpha/index.md", "archive/alpha/captains-log.md"];
  const files = await traverseContextPaths(vaultPath, seeds, {
    repo,
    contextDepth: 3,
  });

  expect(files.map((file) => file.path)).toEqual([
    "archive/alpha/index.md",
    "archive/alpha/captains-log.md",
    "archive/alpha/architecture.md",
  ]);
});

test("missing seed file aborts with clear error", async () => {
  const seeds = ["archive/alpha/missing.md"];

  await expect(
    traverseContextPaths(vaultPath, seeds, { repo, contextDepth: 0 })
  ).rejects.toThrow(
    "Context file missing: archive/alpha/missing.md. Add it to the Starfleet Archive before dispatch."
  );
});
