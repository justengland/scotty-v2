import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { formatFrontmatter } from "../diagnostic/parse-frontmatter";
import {
  buildPageIndex,
  readLatestArchiveStardate,
  resolveWikiLink,
  traverseContextPaths,
  validateArchivePages,
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

function archivePage(sha: string, body = "# Alpha index\n"): string {
  return `${formatFrontmatter({
    entity: "alpha-service",
    repo: "alpha",
    updated: "2026-06-01",
    sources: [`alpha@${sha}`],
  })}
${body}`;
}

test("validateArchivePages rejects missing frontmatter and stale sources", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(join(archiveDir, "index.md"), archivePage("abc123"));
  await writeFile(
    join(archiveDir, "captains-log.md"),
    archivePage("abc123", "# Captain's Log\n")
  );
  await writeFile(join(archiveDir, "broken.md"), "# Missing frontmatter\n");

  const errors = await validateArchivePages({
    vaultPath,
    repoName: repo,
    repoHeadSha: "def456",
  });

  expect(
    errors.some((error) =>
      error.includes(
        'archive/alpha/broken.md: missing frontmatter field "entity"'
      )
    )
  ).toBe(true);
  expect(errors.some((error) => error.includes("stale sources"))).toBe(true);
});

test("validateArchivePages rejects broken wiki-links", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(
    join(archiveDir, "index.md"),
    archivePage("abc123", "# Alpha\n\nSee [[Missing Page]].\n")
  );
  await writeFile(
    join(archiveDir, "captains-log.md"),
    archivePage("abc123", "# Captain's Log\n")
  );

  const errors = await validateArchivePages({
    vaultPath,
    repoName: repo,
    repoHeadSha: "abc123",
  });

  expect(errors.some((error) => error.includes("broken wiki-link"))).toBe(true);
});

test("repo-scoped wiki-links valid at dispatch are valid at diagnostic", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(
    join(archiveDir, "index.md"),
    archivePage("abc123", "# Alpha\n\nSee [[architecture]].\n")
  );
  await writeFile(
    join(archiveDir, "captains-log.md"),
    archivePage("abc123", "# Captain's Log\n")
  );

  const seeds = ["archive/alpha/index.md", "archive/alpha/captains-log.md"];
  await traverseContextPaths(vaultPath, seeds, { repo, contextDepth: 1 });

  const errors = await validateArchivePages({
    vaultPath,
    repoName: repo,
    repoHeadSha: "abc123",
  });

  expect(errors.filter((error) => error.includes("broken wiki-link"))).toEqual(
    []
  );
});

test("readLatestArchiveStardate returns latest updated date across pages", async () => {
  const archiveDir = join(vaultPath, "archive", repo);
  await writeFile(
    join(archiveDir, "index.md"),
    `${formatFrontmatter({
      entity: "alpha-service",
      repo: "alpha",
      updated: "2026-06-10",
      sources: ["alpha@abc123"],
    })}
# Alpha index
`
  );
  await writeFile(
    join(archiveDir, "captains-log.md"),
    `${formatFrontmatter({
      entity: "alpha-service",
      repo: "alpha",
      updated: "2026-06-12",
      sources: ["alpha@abc123"],
    })}
# Captain's Log
`
  );

  const stardate = await readLatestArchiveStardate(vaultPath, repo);

  expect(stardate).toBe("2026-06-12");
});
