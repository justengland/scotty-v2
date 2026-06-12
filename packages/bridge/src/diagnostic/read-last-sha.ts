import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "./parse-frontmatter";

function shaFromSources(sources: string[] | undefined, repoName: string): string | undefined {
  if (!sources) return undefined;

  for (const source of sources) {
    const match = source.match(new RegExp(`^${repoName}@([0-9a-f]+)$`));
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

async function shaFromArchiveDir(
  vaultPath: string,
  repoName: string,
): Promise<string | undefined> {
  const archiveDir = join(vaultPath, "archive", repoName);

  let entries: string[];
  try {
    entries = await readdir(archiveDir);
  } catch {
    return undefined;
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;

    const content = await Bun.file(join(archiveDir, entry)).text();
    const { frontmatter } = parseFrontmatter(content);
    const sha = shaFromSources(frontmatter.sources, repoName);
    if (sha) return sha;
  }

  return undefined;
}

async function shaFromScottyIndex(
  vaultPath: string,
  repoName: string,
): Promise<string | undefined> {
  const indexPath = join(vaultPath, "Scotty Index.md");
  if (!(await Bun.file(indexPath).exists())) {
    return undefined;
  }

  const content = await Bun.file(indexPath).text();
  const inlineMatch = content.match(
    new RegExp(`${repoName}@([0-9a-f]+)`, "i"),
  );
  if (inlineMatch) {
    return inlineMatch[1];
  }

  const lineMatch = content.match(
    new RegExp(`^${repoName}:\\s*([0-9a-f]+)$`, "m"),
  );
  return lineMatch?.[1];
}

export async function readLastRecordedSha(
  vaultPath: string,
  repoName: string,
): Promise<string | undefined> {
  return (
    (await shaFromArchiveDir(vaultPath, repoName)) ??
    (await shaFromScottyIndex(vaultPath, repoName))
  );
}
