import type { MissionOrders } from "../mission-orders/types";
import { VaultConfigError } from "../vault/resolve-vault-config";
import { commitVaultLocally } from "../vault/commit-vault";
import type { AwayTeam } from "./types";
import { buildTask } from "./build-task";
import { DispatchError } from "./errors";
import { appendEngineeringLogEntry } from "./engineering-log";

export interface DispatchInput {
  vaultPath: string;
  orders: MissionOrders;
  repoName: string;
  title?: string;
  description?: string;
  file?: string;
  priority?: number;
  awayTeam: AwayTeam;
}

export interface DispatchResult {
  exitCode: number;
  taskId?: string;
  logPath?: string;
}

function summarizeExecution(stdout: string, stderr: string, success: boolean): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join(" ");
  if (combined) {
    const firstLine = combined.split(/\r?\n/)[0] ?? combined;
    return firstLine.slice(0, 200);
  }
  return success ? "Away Team completed." : "Away Team failed.";
}

export async function runDispatch(input: DispatchInput): Promise<DispatchResult> {
  const profile = input.orders.repos[input.repoName];
  if (!profile) {
    throw new VaultConfigError(
      `Repository "${input.repoName}" is not on the Duty Roster. Check Mission Orders for available repos.`,
    );
  }

  if (!profile.path) {
    throw new DispatchError(
      `Repository "${input.repoName}" has no local path in Mission Orders.`,
    );
  }

  if (profile.agent !== "claude-code") {
    throw new DispatchError(
      `Away Team "${profile.agent}" is not supported in Phase 1. Use agent = "claude-code".`,
    );
  }

  const task = await buildTask({
    repo: input.repoName,
    vaultPath: input.vaultPath,
    profile,
    title: input.title,
    description: input.description,
    file: input.file,
    priority: input.priority,
  });

  const result = await input.awayTeam.execute(task, profile.path);

  const summary = summarizeExecution(result.stdout, result.stderr, result.success);
  const logPath = await appendEngineeringLogEntry(input.vaultPath, {
    repo: input.repoName,
    task,
    result,
    summary,
  });

  await commitVaultLocally(
    input.vaultPath,
    `dispatch: ${input.repoName} — ${task.title}`,
  );

  return {
    exitCode: result.success ? 0 : 1,
    taskId: task.id,
    logPath,
  };
}
