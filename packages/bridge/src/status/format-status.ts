import type { RepoStatus } from "./read-status";

const PLACEHOLDER = "(none)";

function formatDispatch(status: RepoStatus): string {
  if (!status.lastDispatchOutcome) return PLACEHOLDER;
  if (status.lastDispatchDate) {
    return `${status.lastDispatchOutcome} (${status.lastDispatchDate})`;
  }
  return status.lastDispatchOutcome;
}

function formatSha(sha: string | undefined): string {
  return sha ?? PLACEHOLDER;
}

function formatStardate(stardate: string | undefined): string {
  return stardate ?? PLACEHOLDER;
}

export function formatFleetStatus(statuses: RepoStatus[]): string {
  const headers = ["Repo", "Dispatch", "Sources", "Stardate"];
  const rows = statuses.map((status) => [
    status.repo,
    formatDispatch(status),
    formatSha(status.lastSourcesSha),
    formatStardate(status.lastDiagnosticStardate),
  ]);

  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => row[index]!.length))
  );

  const pad = (value: string, width: number) => value.padEnd(width);

  const lines = [
    "Fleet Status",
    "",
    headers.map((header, index) => pad(header, widths[index]!)).join("  "),
    ...rows.map((row) =>
      row.map((cell, index) => pad(cell, widths[index]!)).join("  ")
    ),
  ];

  return lines.join("\n");
}
