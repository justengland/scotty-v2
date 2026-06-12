import type { ParsedLogEntry } from "./parse-log";

export function formatLogEntry(entry: ParsedLogEntry): string {
  const lines = [
    `[${entry.date}] dispatch: ${entry.repo} — ${entry.taskId}`,
    `  Task: ${entry.taskTitle} (priority ${entry.priority})`,
    `  Outcome: ${entry.outcome} (${entry.durationMs}ms)`,
    `  Summary: ${entry.summary}`,
  ];

  if (entry.tricorder) {
    lines.push(`  Tricorder: ${entry.tricorder}`);
  }
  if (entry.verification) {
    lines.push(`  Verification: ${entry.verification}`);
  }

  return lines.join("\n");
}

export function formatLogEntries(entries: ParsedLogEntry[]): string {
  return entries.map(formatLogEntry).join("\n\n");
}
