import { readLatestArchiveStardate } from "../archive/archive";
import { readLastRecordedSha } from "../diagnostic/read-last-sha";
import { readEngineeringLog } from "../log/read-log";

export interface RepoStatus {
  repo: string;
  lastDispatchOutcome?: string;
  lastDispatchDate?: string;
  lastSourcesSha?: string;
  lastDiagnosticStardate?: string;
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
    const lastDiagnosticStardate = await readLatestArchiveStardate(
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
