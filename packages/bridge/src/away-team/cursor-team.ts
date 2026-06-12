import type { AgentOptions, SDKAgent, SDKMessage } from "@cursor/sdk";
import { dirname } from "node:path";
import type { Task } from "../dispatch/types";
import { buildTaskPrompt } from "./build-prompt";
import {
  readCursorConfig,
  resolveCursorCwd,
  type CursorTeamConfig,
} from "./cursor-config";

export interface CursorTeamDeps {
  env?: NodeJS.ProcessEnv;
  createAgent?: (options: AgentOptions) => Promise<SDKAgent>;
  writeStdout?: (chunk: string) => void;
}

async function defaultCreateAgent(options: AgentOptions): Promise<SDKAgent> {
  const { Agent } = await import("@cursor/sdk");
  return Agent.create(options);
}

function streamAssistantText(
  message: SDKMessage,
  writeStdout: (chunk: string) => void
): void {
  if (message.type !== "assistant") {
    return;
  }

  for (const block of message.message.content) {
    if (block.type === "text") {
      writeStdout(block.text);
    }
  }
}

function applyRuntimeEnv(config: CursorTeamConfig): () => void {
  if (config.runtime !== "node" || !config.nodeBin) {
    return () => {};
  }

  const nodeDir = dirname(config.nodeBin);
  const previousPath = process.env.PATH;
  process.env.PATH = `${nodeDir}:${previousPath ?? ""}`;

  return () => {
    if (previousPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = previousPath;
    }
  };
}

export function createCursorTeam(deps: CursorTeamDeps = {}) {
  const env = deps.env ?? process.env;
  const createAgent = deps.createAgent ?? defaultCreateAgent;
  const writeStdout =
    deps.writeStdout ?? ((chunk: string) => process.stdout.write(chunk));

  return {
    id: "cursor",
    async execute(task: Task, repoPath: string) {
      const config = readCursorConfig(env);
      const cwd = resolveCursorCwd(config, repoPath);
      const prompt = buildTaskPrompt(task);
      const startedAt = Date.now();
      const restoreEnv = applyRuntimeEnv(config);

      try {
        const agent = await createAgent({
          apiKey: config.apiKey,
          model: { id: config.model },
          local: { cwd },
        });

        try {
          const run = await agent.send(prompt);
          let stdout = "";

          if (config.streamLog) {
            for await (const event of run.stream()) {
              streamAssistantText(event, (chunk) => {
                stdout += chunk;
                writeStdout(chunk);
              });
            }
          }

          const result = await run.wait();
          const combinedStdout = stdout || result.result || "";

          return {
            success: result.status === "finished",
            stdout: combinedStdout,
            stderr: result.status === "error" ? combinedStdout : "",
            durationMs: result.durationMs ?? Date.now() - startedAt,
          };
        } finally {
          await agent[Symbol.asyncDispose]();
        }
      } catch (error) {
        const { CursorAgentError } = await import("@cursor/sdk");
        if (error instanceof CursorAgentError) {
          return {
            success: false,
            stdout: "",
            stderr: error.message,
            durationMs: Date.now() - startedAt,
          };
        }
        throw error;
      } finally {
        restoreEnv();
      }
    },
  };
}
