import { readFile } from "node:fs/promises";
import type { RepoProfile } from "../mission-orders/types";
import { DispatchError } from "./errors";
import {
  loadContextFiles,
  resolveContextPaths,
} from "./inject-context";
import { parseTaskFile } from "./parse-task-file";
import {
  DEFAULT_TASK_PRIORITY,
  type Task,
} from "./types";

export interface BuildTaskInput {
  repo: string;
  vaultPath: string;
  profile: RepoProfile;
  title?: string;
  description?: string;
  file?: string;
  priority?: number;
}

export async function buildTask(input: BuildTaskInput): Promise<Task> {
  const { title, description } = await resolveTitleAndDescription(input);
  const contextPaths = resolveContextPaths(input.repo, input.profile.context);
  const contextFiles = await loadContextFiles(input.vaultPath, contextPaths);

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
  input: BuildTaskInput,
): Promise<{ title: string; description: string }> {
  if (input.file) {
    const content = await readFile(input.file, "utf8");
    return parseTaskFile(content);
  }

  if (input.title && input.description) {
    return { title: input.title, description: input.description };
  }

  throw new DispatchError(
    "Provide --title and --description, or --file with a Task definition.",
  );
}
