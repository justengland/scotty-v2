import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { formatFrontmatter, parseFrontmatter } from "./parse-frontmatter";

export async function appendCaptainsLogEntry(params: {
  vaultPath: string;
  repoName: string;
  repoHeadSha: string;
  summary: string;
  stardate?: string;
}): Promise<void> {
  const logPath = join(
    params.vaultPath,
    "archive",
    params.repoName,
    "captains-log.md",
  );
  const existing = await readFile(logPath, "utf8");
  const { frontmatter, body } = parseFrontmatter(existing);
  const stardate = params.stardate ?? new Date().toISOString().slice(0, 10);

  const entry = `\n## ${stardate}\n\n${params.summary.trim()}\n`;
  const updatedFrontmatter = {
    entity: frontmatter.entity ?? params.repoName,
    repo: frontmatter.repo ?? params.repoName,
    updated: stardate,
    sources: [`${params.repoName}@${params.repoHeadSha}`],
  };

  const updated = `${formatFrontmatter(updatedFrontmatter)}\n${body.trimEnd()}${entry}\n`;
  await writeFile(logPath, updated);
}
