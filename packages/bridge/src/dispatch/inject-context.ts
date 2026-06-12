import { traverseContextPaths } from "../archive/archive";

const DEFAULT_CONTEXT_FILES = ["index.md", "captains-log.md"];

export interface LoadContextOptions {
  repo?: string;
  contextDepth?: number;
}

export function resolveContextPaths(
  repo: string,
  extraContext?: string[]
): string[] {
  const defaults = DEFAULT_CONTEXT_FILES.map(
    (file) => `archive/${repo}/${file}`
  );
  const extras = (extraContext ?? []).map((file) => `archive/${repo}/${file}`);
  return [...defaults, ...extras];
}

export async function loadContextFiles(
  vaultPath: string,
  relativePaths: string[],
  options?: LoadContextOptions
): Promise<Array<{ path: string; content: string }>> {
  return traverseContextPaths(vaultPath, relativePaths, options);
}
