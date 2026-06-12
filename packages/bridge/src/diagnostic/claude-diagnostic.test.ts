import { expect, test } from "bun:test";
import { ClaudeNotFoundError } from "../dispatch/errors";
import { createClaudeDiagnostic } from "./claude-diagnostic";

test("createClaudeDiagnostic delegates to runClaudePrompt with vault cwd", async () => {
  let captured:
    | {
        prompt: string;
        cwd: string;
        resolveClaudePath?: () => string | undefined;
      }
    | undefined;

  const agent = createClaudeDiagnostic({
    runClaudePrompt: async (input) => {
      captured = input;
      return {
        success: true,
        stdout: "archive updated",
        stderr: "",
        durationMs: 2,
      };
    },
  });

  const result = await agent.updateArchive({
    vaultPath: "/tmp/vault",
    repoName: "alpha",
    prompt: "update archive pages",
  });

  expect(captured?.cwd).toBe("/tmp/vault");
  expect(captured?.prompt).toBe("update archive pages");
  expect(result.success).toBe(true);
  expect(result.stdout).toBe("archive updated");
});

test("createClaudeDiagnostic propagates ClaudeNotFoundError from runner", async () => {
  const agent = createClaudeDiagnostic({
    runClaudePrompt: async () => {
      throw new ClaudeNotFoundError();
    },
  });

  await expect(
    agent.updateArchive({
      vaultPath: "/tmp/vault",
      repoName: "alpha",
      prompt: "update archive pages",
    })
  ).rejects.toThrow(ClaudeNotFoundError);
});
