import type { ExecutionResult } from "../dispatch/types";
import { loadArchivePages } from "./load-archive-pages";
import {
  runClaudePrompt,
  type RunClaudePromptInput,
} from "../claude-runner/run-claude-prompt";

function buildDiagnosticPrompt(params: {
  repoName: string;
  repoHeadSha: string;
  sinceSha: string | undefined;
  diff: string;
  archivePages: Array<{ path: string; content: string }>;
}): string {
  const sections = [
    `# Diagnostic Cycle: ${params.repoName}`,
    "",
    "Update Starfleet Archive pages for this repository based on the diff below.",
    "Do not modify the target repository — only update vault markdown under `archive/`.",
    "",
    "## Frontmatter requirements",
    "",
    "Every Archive page must include YAML frontmatter with:",
    "- `entity` — entity name",
    `- \`repo\` — repository name (${params.repoName})`,
    "- `updated` — ISO date (YYYY-MM-DD)",
    `- \`sources\` — array with exactly \`["${params.repoName}@${params.repoHeadSha}"]\``,
    "",
    "## Citation format",
    "",
    "Use `repo@sha path:line` in body text (e.g. `alpha@abc123 src/index.ts:42`).",
    "",
    "## Diff baseline",
    "",
    params.sinceSha
      ? `Changes since ${params.repoName}@${params.sinceSha}:`
      : "Full repository diff (no prior SHA recorded):",
    "",
    params.diff.trim() || "(no changes)",
    "",
    "## Existing Archive pages",
    "",
  ];

  for (const page of params.archivePages) {
    sections.push(`### ${page.path}`, "", page.content, "");
  }

  return sections.join("\n").trim();
}

export interface DiagnosticAgent {
  id: string;
  updateArchive(params: {
    vaultPath: string;
    repoName: string;
    prompt: string;
  }): Promise<ExecutionResult>;
}

export interface ClaudeDiagnosticDeps {
  resolveClaudePath?: RunClaudePromptInput["resolveClaudePath"];
  runClaudePrompt?: typeof runClaudePrompt;
}

export function createClaudeDiagnostic(
  deps: ClaudeDiagnosticDeps = {}
): DiagnosticAgent {
  const executeClaude = deps.runClaudePrompt ?? runClaudePrompt;

  return {
    id: "claude-code",
    async updateArchive({ vaultPath, repoName: _repoName, prompt }) {
      return executeClaude({
        prompt,
        cwd: vaultPath,
        resolveClaudePath: deps.resolveClaudePath,
      });
    },
  };
}

export async function buildDiagnosticPromptForRepo(params: {
  vaultPath: string;
  repoName: string;
  repoHeadSha: string;
  sinceSha: string | undefined;
  diff: string;
}): Promise<string> {
  const archivePages = await loadArchivePages(
    params.vaultPath,
    params.repoName
  );
  return buildDiagnosticPrompt({
    repoName: params.repoName,
    repoHeadSha: params.repoHeadSha,
    sinceSha: params.sinceSha,
    diff: params.diff,
    archivePages,
  });
}
