import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseFrontmatter } from "../diagnostic/parse-frontmatter";
import { readLastRecordedSha } from "../diagnostic/read-last-sha";
import { readEngineeringLog } from "../log/read-log";

export interface RepoStatus {
  repo: string;
  lastDispatchOutcome?: string;
  lastDispatchDate?: string;
  lastSourcesSha?: string;
  lastDiagnosticStardate?: string;
}

async function readLastDiagnosticStardate(
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

    const content = await Bun.file(join(archiveDir, entry)).text();
    const { frontmatter } = parseFrontmatter(content);
    if (!frontmatter.updated) continue;
    if (!latest || frontmatter.updated > latest) {
      latest = frontmatter.updated;
    }
  }

  return latest;
}

export async function readFleetStatus(
  vaultPath: string,
  repoNames: string[]
): Promise<RepoStatus[]> {
  const sortedNames = [...repoNames].sort();
  const statuses: RepoStatus[] = [];

  for (const repo of sortedNames) {
    const [lastDispatch] = await readEngineeringLog(vaultPath, {
      repo,
      limit: 1,
    });
    const lastSourcesSha = await readLastRecordedSha(vaultPath, repo);
    const lastDiagnosticStardate = await readLastDiagnosticStardate(
      vaultPath,
      repo
    );

    statuses.push({
      repo,
      lastDispatchOutcome: lastDispatch?.outcome,
      lastDispatchDate: lastDispatch?.date,
      lastSourcesSha,
      lastDiagnosticStardate,
    });
  }

  return statuses;
}
