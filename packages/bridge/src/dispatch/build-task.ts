import { readFile } from "node:fs/promises";
import type { RepoProfile } from "../mission-orders/types";
import { DispatchError } from "./errors";
import { loadContextFiles, resolveContextPaths } from "./inject-context";
import { parseIssueFile } from "./parse-issue-file";
import { parseTaskFile } from "./parse-task-file";
import { DEFAULT_TASK_PRIORITY, type Task } from "./types";

export interface BuildTaskInput {
  repo: string;
  vaultPath: string;
  profile: RepoProfile;
  title?: string;
  description?: string;
  file?: string;
  issue?: string;
  priority?: number;
  contextDepth?: number;
}

export async function buildTask(input: BuildTaskInput): Promise<Task> {
  const { title, description } = await resolveTitleAndDescription(input);
  const contextPaths = resolveContextPaths(input.repo, input.profile.context);
  const contextDepth = input.contextDepth ?? input.profile.contextDepth ?? 0;
  const contextFiles = await loadContextFiles(input.vaultPath, contextPaths, {
    repo: input.repo,
    contextDepth,
  });

  return {
    id: crypto.randomUUID(),
    repo: input.repo,
    title,
    description,
    priority: input.priority ?? DEFAULT_TASK_PRIORITY,
    contextFiles,
  };
}

async function resolveTitleAndDescription(
  input: BuildTaskInput
): Promise<{ title: string; description: string }> {
  if (input.issue) {
    if (input.file) {
      throw new DispatchError("--issue cannot be combined with --file");
    }
    if (input.title || input.description) {
      throw new DispatchError(
        "--issue cannot be combined with --title or --description"
      );
    }
    try {
      const content = await readFile(input.issue, "utf8");
      return parseIssueFile(content);
    } catch (error) {
      if (error instanceof DispatchError) {
        throw error;
      }
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        throw new DispatchError(`Issue file not found: ${input.issue}`);
      }
      throw error;
    }
  }

  if (input.file) {
    const content = await readFile(input.file, "utf8");
    return parseTaskFile(content);
  }

  if (input.title && input.description) {
    return { title: input.title, description: input.description };
  }

  throw new DispatchError(
    "Provide --title and --description, --file with a Task definition, or --issue with an issue markdown file."
  );
}
