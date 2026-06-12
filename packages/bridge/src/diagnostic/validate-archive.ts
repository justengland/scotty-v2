import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "./parse-frontmatter";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const WIKI_LINK_PATTERN = /\[\[([^\]|#]+)(?:#[^\]|]+)?\]\]/g;

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

async function vaultPageIndex(vaultPath: string): Promise<Map<string, string>> {
  const markdownFiles = await findVaultMarkdownFiles(vaultPath);
  const known = new Map<string, string>();

  for (const filePath of markdownFiles) {
    const relative = filePath.slice(vaultPath.length + 1);
    const basename = relative.split("/").pop() ?? relative;
    const withoutExtension = relative.replace(/\.md$/, "");
    const basenameWithoutExtension = basename.replace(/\.md$/, "");

    known.set(relative, filePath);
    known.set(basename, filePath);
    known.set(withoutExtension, filePath);
    known.set(basenameWithoutExtension, filePath);
    known.set(basenameWithoutExtension.toLowerCase(), filePath);
  }

  return known;
}

function checkWikiLinks(
  filePath: string,
  content: string,
  knownPages: Map<string, string>,
): string[] {
  const errors: string[] = [];

  for (const match of content.matchAll(WIKI_LINK_PATTERN)) {
    const target = match[1]?.trim();
    if (!target) continue;

    const candidates = [
      target,
      `${target}.md`,
      target.replace(/\.md$/, ""),
      target.toLowerCase(),
    ];

    if (!candidates.some((candidate) => knownPages.has(candidate))) {
      errors.push(`${filePath}: broken wiki-link to [[${target}]]`);
    }
  }

  return errors;
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

  const markdownFiles = entries
    .filter((entry) => entry.endsWith(".md"))
    .map((entry) => join(archiveDir, entry));

  if (markdownFiles.length === 0) {
    errors.push(`No Archive pages under archive/${params.repoName}/`);
  }

  const knownPages = await vaultPageIndex(params.vaultPath);

  for (const filePath of markdownFiles) {
    const content = await Bun.file(filePath).text();
    const { frontmatter } = parseFrontmatter(content);

    if (!frontmatter.entity) {
      errors.push(`${filePath}: missing frontmatter field "entity"`);
    }
    if (!frontmatter.repo) {
      errors.push(`${filePath}: missing frontmatter field "repo"`);
    }
    if (!frontmatter.updated || !ISO_DATE_PATTERN.test(frontmatter.updated)) {
      errors.push(`${filePath}: missing or invalid frontmatter field "updated"`);
    }
    if (!frontmatter.sources || frontmatter.sources.length === 0) {
      errors.push(`${filePath}: missing frontmatter field "sources"`);
    } else {
      const expected = `${params.repoName}@${params.repoHeadSha}`;
      if (!frontmatter.sources.includes(expected)) {
        errors.push(
          `${filePath}: stale sources (expected ${expected}, got ${frontmatter.sources.join(", ")})`,
        );
      }
    }

    errors.push(...checkWikiLinks(filePath, content, knownPages));
  }

  return errors;
}
