import type { MissionOrders } from "../mission-orders/types";
import { createHailChannels, sendFailureHail } from "../hailing/send-hail";
import type { HailChannel } from "../hailing/types";
import { resolveVerifier } from "../tricorder/registry";
import type { VerificationResult } from "../tricorder/types";
import { VaultConfigError } from "../vault/resolve-vault-config";
import { commitVaultLocally } from "../vault/commit-vault";
import {
  resolveAwayTeam,
  type AwayTeamRegistryDeps,
} from "../away-team/registry";
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
  contextDepth?: number;
  skipVerify?: boolean;
  awayTeam?: AwayTeam;
  awayTeamDeps?: AwayTeamRegistryDeps;
  hailChannels?: HailChannel[];
}

export interface DispatchResult {
  exitCode: number;
  taskId?: string;
  logPath?: string;
}

function summarizeExecution(
  stdout: string,
  stderr: string,
  success: boolean
): string {
  const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join(" ");
  if (combined) {
    const firstLine = combined.split(/\r?\n/)[0] ?? combined;
    return firstLine.slice(0, 200);
  }
  return success ? "Away Team completed." : "Away Team failed.";
}

export async function runDispatch(
  input: DispatchInput
): Promise<DispatchResult> {
  const profile = input.orders.repos[input.repoName];
  if (!profile) {
    throw new VaultConfigError(
      `Repository "${input.repoName}" is not on the Duty Roster. Check Mission Orders for available repos.`
    );
  }

  if (!profile.path) {
    throw new DispatchError(
      `Repository "${input.repoName}" has no local path in Mission Orders.`
    );
  }

  const awayTeam =
    input.awayTeam ?? resolveAwayTeam(profile.agent, input.awayTeamDeps);

  const task = await buildTask({
    repo: input.repoName,
    vaultPath: input.vaultPath,
    profile,
    title: input.title,
    description: input.description,
    file: input.file,
    priority: input.priority,
    contextDepth: input.contextDepth,
  });

  const result = await awayTeam.execute(task, profile.path);

  let verification: VerificationResult | undefined;
  if (profile.verify && !input.skipVerify) {
    const verifier = resolveVerifier(profile.verify);
    verification = await verifier.verify(profile.path);
  }

  const dispatchSucceeded = verification ? verification.passed : result.success;

  const summary = verification
    ? verification.summary
    : summarizeExecution(result.stdout, result.stderr, result.success);

  const logPath = await appendEngineeringLogEntry(input.vaultPath, {
    repo: input.repoName,
    task,
    result,
    summary,
    verification,
  });

  await commitVaultLocally(
    input.vaultPath,
    `dispatch: ${input.repoName} — ${task.title}`
  );

  if (!dispatchSucceeded) {
    const configuredChannels =
      input.hailChannels !== undefined
        ? input.hailChannels
        : createHailChannels();
    const channels =
      input.hailChannels === undefined && configuredChannels.length === 0
        ? null
        : configuredChannels;
    const hailKind =
      verification && !verification.passed
        ? ("tricorder-failure" as const)
        : ("away-team-crash" as const);
    await sendFailureHail({
      channels,
      kind: hailKind,
      repo: input.repoName,
      summary,
    });
  }

  return {
    exitCode: dispatchSucceeded ? 0 : 1,
    taskId: task.id,
    logPath,
  };
}
