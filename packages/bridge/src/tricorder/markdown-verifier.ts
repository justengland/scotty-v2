import { readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { VerificationResult, Verifier } from "./types";

const MARKDOWN_LINK_PATTERN = /\[([^\]]*)\]\(([^)]+)\)/g;
const WIKI_LINK_PATTERN = /\[\[([^\]]+)\]\]/g;
const BAD_HEADING_PATTERN = /^#{1,6}[^\s#]/m;

async function findMarkdownFiles(dir: string): Promise<string[]> {
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

  await walk(dir);
  return files;
}

function lintMarkdown(filePath: string, content: string): string[] {
  const errors: string[] = [];

  if (content.trim().length === 0) {
    errors.push(`${filePath}: empty markdown file`);
    return errors;
  }

  if (BAD_HEADING_PATTERN.test(content)) {
    errors.push(`${filePath}: heading must have a space after #`);
  }

  return errors;
}

async function markdownFilesInRepo(
  repoPath: string,
): Promise<Map<string, string>> {
  const files = await findMarkdownFiles(repoPath);
  const byRelativePath = new Map<string, string>();

  for (const filePath of files) {
    const relative = filePath.slice(repoPath.length + 1);
    byRelativePath.set(relative, filePath);
    byRelativePath.set(filePath, filePath);

    const withoutExtension = relative.replace(/\.md$/, "");
    byRelativePath.set(withoutExtension, filePath);
    byRelativePath.set(join(withoutExtension + ".md"), filePath);
  }

  return byRelativePath;
}

function checkMarkdownLinks(
  filePath: string,
  content: string,
  repoPath: string,
  knownFiles: Map<string, string>,
): string[] {
  const errors: string[] = [];

  for (const match of content.matchAll(MARKDOWN_LINK_PATTERN)) {
    const target = match[2]?.trim();
    if (!target || /^(https?:|mailto:|#)/.test(target)) {
      continue;
    }

    const resolved = resolve(dirname(filePath), target);
    const relative = resolved.slice(repoPath.length + 1);
    if (!knownFiles.has(relative) && !knownFiles.has(resolved)) {
      errors.push(`${filePath}: broken link to ${target}`);
    }
  }

  return errors;
}

function checkWikiLinks(
  filePath: string,
  content: string,
  knownFiles: Map<string, string>,
): string[] {
  const errors: string[] = [];

  for (const match of content.matchAll(WIKI_LINK_PATTERN)) {
    const target = match[1]?.trim();
    if (!target) {
      continue;
    }

    const candidates = [
      target,
      `${target}.md`,
      target.replace(/\.md$/, ""),
    ];

    if (!candidates.some((candidate) => knownFiles.has(candidate))) {
      errors.push(`${filePath}: broken wiki-link to [[${target}]]`);
    }
  }

  return errors;
}

export function createMarkdownVerifier(): Verifier {
  return {
    async verify(repoPath: string): Promise<VerificationResult> {
      const startedAt = Date.now();
      const markdownFiles = await findMarkdownFiles(repoPath);
      const knownFiles = await markdownFilesInRepo(repoPath);
      const errors: string[] = [];

      for (const filePath of markdownFiles) {
        const content = await Bun.file(filePath).text();
        errors.push(...lintMarkdown(filePath, content));
        errors.push(...checkMarkdownLinks(filePath, content, repoPath, knownFiles));
        errors.push(...checkWikiLinks(filePath, content, knownFiles));
      }

      const passed = errors.length === 0;

      return {
        passed,
        summary: passed
          ? `markdown verification passed (${markdownFiles.length} files)`
          : `markdown verification failed (${errors.length} issues)`,
        errors: passed ? undefined : errors,
        durationMs: Date.now() - startedAt,
      };
    },
  };
}
