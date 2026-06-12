import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseEngineeringLogFile, type ParsedLogEntry } from "./parse-log";

export interface ReadEngineeringLogOptions {
  repo?: string;
  since?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 50;

function logFileDate(name: string): string | null {
  const match = name.match(/^(\d{4}-\d{2}-\d{2})\.md$/);
  return match?.[1] ?? null;
}

export async function readEngineeringLog(
  vaultPath: string,
  options: ReadEngineeringLogOptions = {}
): Promise<ParsedLogEntry[]> {
  const logDir = join(vaultPath, "log");
  const limit = options.limit ?? DEFAULT_LIMIT;
  const since = options.since;

  let files: string[];
  try {
    files = await readdir(logDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const datedFiles = files
    .map((name) => ({ name, date: logFileDate(name) }))
    .filter(
      (file): file is { name: string; date: string } => file.date !== null
    )
    .filter((file) => !since || file.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date));

  const entries: ParsedLogEntry[] = [];

  for (const file of datedFiles) {
    const content = await readFile(join(logDir, file.name), "utf8");
    const parsed = parseEngineeringLogFile(content, file.date);
    for (let i = parsed.length - 1; i >= 0; i--) {
      const entry = parsed[i]!;
      if (options.repo && entry.repo !== options.repo) continue;
      entries.push(entry);
      if (entries.length >= limit) return entries;
    }
  }

  return entries;
}
