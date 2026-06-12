import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ExecutionResult, Task } from "./types";

export interface EngineeringLogEntry {
  repo: string;
  task: Task;
  result: ExecutionResult;
  summary: string;
}

function logFileName(date = new Date()): string {
  const iso = date.toISOString().slice(0, 10);
  return `${iso}.md`;
}

export function formatEngineeringLogEntry(entry: EngineeringLogEntry): string {
  const outcome = entry.result.success ? "success" : "failure";
  const lines = [
    `## dispatch: ${entry.repo} — ${entry.task.id}`,
    "",
    `- **Repo:** ${entry.repo}`,
    `- **Task:** ${entry.task.title}`,
    `- **Priority:** ${entry.task.priority}`,
    `- **Outcome:** ${outcome}`,
    `- **Duration:** ${entry.result.durationMs}ms`,
    `- **Summary:** ${entry.summary}`,
    "",
  ];
  return lines.join("\n");
}

export async function appendEngineeringLogEntry(
  vaultPath: string,
  entry: EngineeringLogEntry,
): Promise<string> {
  const logDir = join(vaultPath, "log");
  await mkdir(logDir, { recursive: true });
  const logPath = join(logDir, logFileName());
  const block = formatEngineeringLogEntry(entry);
  await appendFile(logPath, block, "utf8");
  return logPath;
}
