export interface ParsedLogEntry {
  kind: "dispatch";
  date: string;
  repo: string;
  taskId: string;
  taskTitle: string;
  priority: number;
  outcome: string;
  durationMs: number;
  summary: string;
  tricorder?: string;
  verification?: string;
}

const BULLET = /^- \*\*(\w[\w ]*):\*\* (.+)$/;

function parseBulletValue(
  key: string,
  value: string,
  entry: Partial<ParsedLogEntry>
): void {
  switch (key) {
    case "Repo":
      entry.repo = value;
      break;
    case "Task":
      entry.taskTitle = value;
      break;
    case "Priority":
      entry.priority = Number(value);
      break;
    case "Outcome":
      entry.outcome = value;
      break;
    case "Duration":
      entry.durationMs = Number(value.replace(/ms$/, ""));
      break;
    case "Summary":
      entry.summary = value;
      break;
    case "Tricorder":
      entry.tricorder = value;
      break;
    case "Verification":
      entry.verification = value;
      break;
  }
}

export function parseEngineeringLogFile(
  content: string,
  date: string
): ParsedLogEntry[] {
  const entries: ParsedLogEntry[] = [];
  const blocks = content.split(/^## dispatch: /m).slice(1);

  for (const block of blocks) {
    const headerMatch = block.match(/^(\S+) — (\S+)/);
    if (!headerMatch) continue;

    const entry: Partial<ParsedLogEntry> = {
      kind: "dispatch",
      date,
      repo: headerMatch[1],
      taskId: headerMatch[2],
    };

    for (const line of block.split("\n")) {
      const bulletMatch = line.match(BULLET);
      if (bulletMatch) {
        parseBulletValue(bulletMatch[1]!, bulletMatch[2]!, entry);
      }
    }

    if (
      entry.repo &&
      entry.taskId &&
      entry.taskTitle &&
      entry.priority !== undefined &&
      entry.outcome &&
      entry.durationMs !== undefined &&
      entry.summary
    ) {
      entries.push(entry as ParsedLogEntry);
    }
  }

  return entries;
}
