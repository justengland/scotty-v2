import type { Task } from "../dispatch/types";
import { existsSync } from "node:fs";
import { ClaudeNotFoundError } from "../dispatch/errors";
import { buildTaskPrompt } from "./build-prompt";

export interface ClaudeTeamDeps {
  resolveClaudePath?: () => string | undefined;
}

function defaultResolveClaudePath(): string | undefined {
  const override = process.env.SCOTTY_CLAUDE_PATH;
  if (override) {
    return existsSync(override) ? override : undefined;
  }
  return Bun.which("claude") ?? undefined;
}

export function createClaudeTeam(deps: ClaudeTeamDeps = {}) {
  const resolveClaudePath = deps.resolveClaudePath ?? defaultResolveClaudePath;

  return {
    id: "claude-code",
    async execute(task: Task, repoPath: string) {
      const claudePath = resolveClaudePath();
      if (!claudePath) {
        throw new ClaudeNotFoundError();
      }

      const prompt = buildTaskPrompt(task);
      const startedAt = Date.now();

      const proc = Bun.spawn([claudePath, "-p", prompt], {
        cwd: repoPath,
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
