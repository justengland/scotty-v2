import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DispatchError } from "./errors";

const DEFAULT_CONTEXT_FILES = ["index.md", "captains-log.md"];

export function resolveContextPaths(
  repo: string,
  extraContext?: string[],
): string[] {
  const defaults = DEFAULT_CONTEXT_FILES.map(
    (file) => `archive/${repo}/${file}`,
  );
  const extras = (extraContext ?? []).map((file) => `archive/${repo}/${file}`);
  return [...defaults, ...extras];
}

export async function loadContextFiles(
  vaultPath: string,
  relativePaths: string[],
): Promise<Array<{ path: string; content: string }>> {
  const files: Array<{ path: string; content: string }> = [];

  for (const relativePath of relativePaths) {
    const fullPath = join(vaultPath, relativePath);
    if (!existsSync(fullPath)) {
      throw new DispatchError(
        `Context file missing: ${relativePath}. Add it to the Starfleet Archive before dispatch.`,
      );
    }
    const content = await readFile(fullPath, "utf8");
    files.push({ path: relativePath, content });
  }

  return files;
}
