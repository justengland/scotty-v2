import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function loadArchivePages(
  vaultPath: string,
  repoName: string,
): Promise<Array<{ path: string; content: string }>> {
  const archiveDir = join(vaultPath, "archive", repoName);
  const entries = await readdir(archiveDir);
  const pages: Array<{ path: string; content: string }> = [];

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const relativePath = `archive/${repoName}/${entry}`;
    const content = await Bun.file(join(archiveDir, entry)).text();
    pages.push({ path: relativePath, content });
  }

  return pages;
}
