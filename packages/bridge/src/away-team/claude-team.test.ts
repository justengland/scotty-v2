import { expect, test } from "bun:test";
import type { Task } from "../dispatch/types";
import { ClaudeNotFoundError } from "../dispatch/errors";
import { createClaudeTeam } from "./claude-team";

const sampleTask: Task = {
  id: "task-1",
  repo: "alpha",
  title: "Fix the widget",
  description: "Repair the broken widget.",
  priority: 0,
  contextFiles: [
    { path: "archive/alpha/index.md", content: "# Alpha index\n" },
  ],
};

test("createClaudeTeam delegates to runClaudePrompt with task prompt and repo cwd", async () => {
  let captured:
    | {
        prompt: string;
        cwd: string;
        resolveClaudePath?: () => string | undefined;
      }
    | undefined;

  const team = createClaudeTeam({
    runClaudePrompt: async (input) => {
      captured = input;
      return {
        success: true,
        stdout: "done",
        stderr: "",
        durationMs: 3,
      };
    },
  });

  const result = await team.execute(sampleTask, "/tmp/alpha-repo");

  expect(captured?.cwd).toBe("/tmp/alpha-repo");
  expect(captured?.prompt).toContain("# Task: Fix the widget");
  expect(captured?.prompt).toContain("Repair the broken widget.");
  expect(captured?.prompt).toContain("### archive/alpha/index.md");
  expect(result.success).toBe(true);
  expect(result.stdout).toBe("done");
});

test("createClaudeTeam propagates ClaudeNotFoundError from runner", async () => {
  const team = createClaudeTeam({
    runClaudePrompt: async () => {
      throw new ClaudeNotFoundError();
    },
  });

  await expect(team.execute(sampleTask, "/tmp/alpha-repo")).rejects.toThrow(
    ClaudeNotFoundError
  );
});
