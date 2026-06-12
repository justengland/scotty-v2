import type { RepoProfile } from "../mission-orders/types";
import { createHailChannels, sendFailureHail } from "../hailing/send-hail";
import type { HailChannel } from "../hailing/types";
import { appendCaptainsLogEntry } from "./append-captains-log";
import type { DiagnosticAgent } from "./claude-diagnostic";
import { buildDiagnosticPromptForRepo } from "./claude-diagnostic";
import { DiagnosticError } from "./errors";
import { diffRepoSince, resolveRepoHeadSha } from "./repo-diff";
import { readLastRecordedSha } from "./read-last-sha";
import { commitAndPushVault } from "./push-vault";
import { validateArchivePages } from "../archive/archive";

export interface RunDiagnosticInput {
  vaultPath: string;
  repoName: string;
  profile: RepoProfile;
  agent: DiagnosticAgent;
  hailChannels?: HailChannel[];
  commitAndPush?: (vaultPath: string, message: string) => Promise<void>;
  stardate?: string;
}

export interface RunDiagnosticResult {
  exitCode: number;
  summary: string;
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
  return success ? "Diagnostic Cycle completed." : "Diagnostic Cycle failed.";
}

export async function runDiagnostic(
  input: RunDiagnosticInput
): Promise<RunDiagnosticResult> {
  const profile = input.profile;
  if (!profile.path) {
    throw new DiagnosticError(
      `Repository "${input.repoName}" has no local path in Mission Orders.`
    );
  }

  const sinceSha = await readLastRecordedSha(input.vaultPath, input.repoName);
  const repoHeadSha = await resolveRepoHeadSha(profile.path);
  const diff = await diffRepoSince(profile.path, sinceSha);
  const prompt = await buildDiagnosticPromptForRepo({
    vaultPath: input.vaultPath,
    repoName: input.repoName,
    repoHeadSha,
    sinceSha,
    diff,
  });

  const result = await input.agent.updateArchive({
    vaultPath: input.vaultPath,
    repoName: input.repoName,
    prompt,
  });

  if (!result.success) {
    const summary = summarizeExecution(result.stdout, result.stderr, false);
    await hailDiagnosticFailure(input, summary);
    return { exitCode: 1, summary };
  }

  const summary =
    summarizeExecution(result.stdout, result.stderr, true) ||
    `Updated Archive for ${input.repoName} at ${repoHeadSha.slice(0, 7)}.`;

  await appendCaptainsLogEntry({
    vaultPath: input.vaultPath,
    repoName: input.repoName,
    repoHeadSha,
    summary,
    stardate: input.stardate,
  });

  const validationErrors = await validateArchivePages({
    vaultPath: input.vaultPath,
    repoName: input.repoName,
    repoHeadSha,
  });

  if (validationErrors.length > 0) {
    const validationSummary = validationErrors.slice(0, 3).join("; ");
    await hailDiagnosticFailure(input, validationSummary);
    return { exitCode: 1, summary: validationSummary };
  }

  const commitAndPush =
    input.commitAndPush ??
    ((vaultPath, message) => commitAndPushVault(vaultPath, message));
  await commitAndPush(
    input.vaultPath,
    `diagnostic: ${input.repoName} — ${repoHeadSha.slice(0, 7)}`
  );

  return { exitCode: 0, summary };
}

async function hailDiagnosticFailure(
  input: RunDiagnosticInput,
  summary: string
): Promise<void> {
  const configuredChannels =
    input.hailChannels !== undefined
      ? input.hailChannels
      : createHailChannels();
  const channels =
    input.hailChannels === undefined && configuredChannels.length === 0
      ? null
      : configuredChannels;

  await sendFailureHail({
    channels,
    kind: "diagnostic-failure",
    repo: input.repoName,
    summary,
  });
}
