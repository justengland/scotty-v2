import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { DispatchError } from "../dispatch/errors";
import { parseFrontmatter } from "../diagnostic/parse-frontmatter";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WIKI_LINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]/g;

export type PageIndex = Map<string, string>;

export interface TraverseContextOptions {
  repo?: string;
  contextDepth?: number;
}

export interface ResolveWikiLinkOptions {
  repo?: string;
  index: PageIndex;
}

async function findVaultMarkdownFiles(vaultPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") {
        continue;
      }

      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  }

  await walk(vaultPath);
  return files;
}

export async function buildPageIndex(vaultPath: string): Promise<PageIndex> {
  const markdownFiles = await findVaultMarkdownFiles(vaultPath);
  const known = new Map<string, string>();

  for (const filePath of markdownFiles) {
    const relative = filePath.slice(vaultPath.length + 1);
    const basename = relative.split("/").pop() ?? relative;
    const withoutExtension = relative.replace(/\.md$/, "");
    const basenameWithoutExtension = basename.replace(/\.md$/, "");

    known.set(relative, relative);
    known.set(basename, relative);
    known.set(withoutExtension, relative);
    known.set(basenameWithoutExtension, relative);
    known.set(basenameWithoutExtension.toLowerCase(), relative);
  }

  return known;
}

export function resolveWikiLink(
  target: string,
  options: ResolveWikiLinkOptions
): string | undefined {
  const trimmed = target.trim();
  if (!trimmed) return undefined;

  const { repo, index } = options;
  const repoCandidates =
    repo === undefined
      ? []
      : [
          `archive/${repo}/${trimmed}`,
          `archive/${repo}/${trimmed}.md`,
          `archive/${repo}/${trimmed.replace(/\.md$/, "")}`,
        ];

  for (const candidate of repoCandidates) {
    const resolved = index.get(candidate);
    if (resolved) return resolved;
  }

  const vaultCandidates = [
    trimmed,
    `${trimmed}.md`,
    trimmed.replace(/\.md$/, ""),
    trimmed.toLowerCase(),
  ];

  for (const candidate of vaultCandidates) {
    const resolved = index.get(candidate);
    if (resolved) return resolved;
  }

  return undefined;
}

function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  for (const match of content.matchAll(WIKI_LINK_PATTERN)) {
    const target = match[1]?.trim();
    if (target) links.push(target);
  }
  return links;
}

export async function traverseContextPaths(
  vaultPath: string,
  seedPaths: string[],
  options?: TraverseContextOptions
): Promise<Array<{ path: string; content: string }>> {
  const contextDepth = options?.contextDepth ?? 0;
  const repo = options?.repo;
  const pageIndex =
    contextDepth > 0 ? await buildPageIndex(vaultPath) : undefined;

  const files: Array<{ path: string; content: string }> = [];
  const visited = new Set<string>();
  const queue: Array<{ path: string; depth: number }> = seedPaths.map(
    (path) => ({ path, depth: 0 })
  );

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.path)) continue;
    visited.add(current.path);

    const fullPath = join(vaultPath, current.path);
    if (!existsSync(fullPath)) {
      throw new DispatchError(
        `Context file missing: ${current.path}. Add it to the Starfleet Archive before dispatch.`
      );
    }

    const content = await readFile(fullPath, "utf8");
    files.push({ path: current.path, content });

    if (contextDepth > 0 && current.depth < contextDepth && pageIndex) {
      for (const target of extractWikiLinks(content)) {
        const linkedPath = resolveWikiLink(target, { repo, index: pageIndex });
        if (!linkedPath) {
          throw new DispatchError(
            `${current.path}: broken wiki-link to [[${target}]]`
          );
        }
        if (!visited.has(linkedPath)) {
          queue.push({ path: linkedPath, depth: current.depth + 1 });
        }
      }
    }
  }

  return files;
}

export async function validateArchivePages(params: {
  vaultPath: string;
  repoName: string;
  repoHeadSha: string;
}): Promise<string[]> {
  const archiveDir = join(params.vaultPath, "archive", params.repoName);
  const errors: string[] = [];

  let entries: string[];
  try {
    entries = await readdir(archiveDir);
  } catch {
    return [`Archive directory missing: archive/${params.repoName}/`];
  }

  const markdownFiles = entries.filter((entry) => entry.endsWith(".md"));

  if (markdownFiles.length === 0) {
    errors.push(`No Archive pages under archive/${params.repoName}/`);
  }

  const pageIndex = await buildPageIndex(params.vaultPath);
  const expectedSource = `${params.repoName}@${params.repoHeadSha}`;

  for (const entry of markdownFiles) {
    const relativePath = `archive/${params.repoName}/${entry}`;
    const content = await readFile(join(archiveDir, entry), "utf8");
    const { frontmatter } = parseFrontmatter(content);

    if (!frontmatter.entity) {
      errors.push(`${relativePath}: missing frontmatter field "entity"`);
    }
    if (!frontmatter.repo) {
      errors.push(`${relativePath}: missing frontmatter field "repo"`);
    }
    if (!frontmatter.updated || !ISO_DATE_PATTERN.test(frontmatter.updated)) {
      errors.push(
        `${relativePath}: missing or invalid frontmatter field "updated"`
      );
    }
    if (!frontmatter.sources || frontmatter.sources.length === 0) {
      errors.push(`${relativePath}: missing frontmatter field "sources"`);
    } else if (!frontmatter.sources.includes(expectedSource)) {
      errors.push(
        `${relativePath}: stale sources (expected ${expectedSource}, got ${frontmatter.sources.join(", ")})`
      );
    }

    for (const target of extractWikiLinks(content)) {
      const resolved = resolveWikiLink(target, {
        repo: params.repoName,
        index: pageIndex,
      });
      if (!resolved) {
        errors.push(`${relativePath}: broken wiki-link to [[${target}]]`);
      }
    }
  }

  return errors;
}

export async function readLatestArchiveStardate(
  vaultPath: string,
  repoName: string
): Promise<string | undefined> {
  const archiveDir = join(vaultPath, "archive", repoName);

  let entries: string[];
  try {
    entries = await readdir(archiveDir);
  } catch {
    return undefined;
  }

  let latest: string | undefined;

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;

    const content = await readFile(join(archiveDir, entry), "utf8");
    const { frontmatter } = parseFrontmatter(content);
    if (!frontmatter.updated) continue;
    if (!latest || frontmatter.updated > latest) {
      latest = frontmatter.updated;
    }
  }

  return latest;
}
