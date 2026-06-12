import { existsSync } from "node:fs";
import { ClaudeNotFoundError } from "../dispatch/errors";
import type { ExecutionResult } from "../dispatch/types";
import { loadArchivePages } from "./load-archive-pages";

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
  resolveClaudePath?: () => string | undefined;
}

function defaultResolveClaudePath(): string | undefined {
  const override = process.env.SCOTTY_CLAUDE_PATH;
  if (override) {
    return existsSync(override) ? override : undefined;
  }
  return Bun.which("claude") ?? undefined;
}

export function createClaudeDiagnostic(deps: ClaudeDiagnosticDeps = {}): DiagnosticAgent {
  const resolveClaudePath =
    deps.resolveClaudePath ?? defaultResolveClaudePath;

  return {
    id: "claude-code",
    async updateArchive({ vaultPath, repoName: _repoName, prompt }) {
      const claudePath = resolveClaudePath();
      if (!claudePath) {
        throw new ClaudeNotFoundError();
      }

      const startedAt = Date.now();
      const proc = Bun.spawn([claudePath, "-p", prompt], {
        cwd: vaultPath,
        stdout: "pipe",
        stderr: "pipe",
        env: process.env,
      });

      let stdout = "";
      let stderr = "";

      const streamStdout = (async () => {
        const reader = proc.stdout.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          stdout += chunk;
          process.stdout.write(chunk);
        }
      })();

      const streamStderr = (async () => {
        const reader = proc.stderr.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          stderr += chunk;
          process.stderr.write(chunk);
        }
      })();

      await Promise.all([streamStdout, streamStderr]);
      const exitCode = await proc.exited;

      return {
        success: exitCode === 0,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      };
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
  const archivePages = await loadArchivePages(params.vaultPath, params.repoName);
  return buildDiagnosticPrompt({
    repoName: params.repoName,
    repoHeadSha: params.repoHeadSha,
    sinceSha: params.sinceSha,
    diff: params.diff,
    archivePages,
  });
}
