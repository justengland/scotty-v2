import type { Task } from "../dispatch/types";
import {
  runClaudePrompt,
  type RunClaudePromptInput,
} from "../claude-runner/run-claude-prompt";
import { buildTaskPrompt } from "./build-prompt";

export interface ClaudeTeamDeps {
  resolveClaudePath?: RunClaudePromptInput["resolveClaudePath"];
  runClaudePrompt?: typeof runClaudePrompt;
}

export function createClaudeTeam(deps: ClaudeTeamDeps = {}) {
  const executeClaude = deps.runClaudePrompt ?? runClaudePrompt;

  return {
    id: "claude-code",
    async execute(task: Task, repoPath: string) {
      const prompt = buildTaskPrompt(task);
      return executeClaude({
        prompt,
        cwd: repoPath,
        resolveClaudePath: deps.resolveClaudePath,
      });
    },
  };
}
