import { afterEach, beforeEach, expect, test } from "bun:test";
import type { AgentOptions } from "@cursor/sdk";
import type { Task } from "../dispatch/types";
import { CursorApiKeyMissingError } from "../dispatch/errors";
import { createCursorTeam } from "./cursor-team";

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

let originalCursorApiKey: string | undefined;

afterEach(() => {
  if (originalCursorApiKey === undefined) {
    delete process.env.CURSOR_API_KEY;
  } else {
    process.env.CURSOR_API_KEY = originalCursorApiKey;
  }
  delete process.env.SCOTTY_CURSOR_MODEL;
  delete process.env.SCOTTY_CURSOR_STREAM_LOG;
  delete process.env.SCOTTY_CURSOR_RUNTIME;
  delete process.env.SCOTTY_NODE_BIN;
  delete process.env.SCOTTY_CURSOR_CWD;
});

beforeEach(() => {
  originalCursorApiKey = process.env.CURSOR_API_KEY;
  delete process.env.CURSOR_API_KEY;
});

test("createCursorTeam fails fast when CURSOR_API_KEY is missing", async () => {
  const team = createCursorTeam({ env: {} });

  await expect(team.execute(sampleTask, "/tmp/repo")).rejects.toThrow(
    CursorApiKeyMissingError
  );
});

test("createCursorTeam sends task prompt to Cursor SDK with local runtime", async () => {
  let capturedOptions: AgentOptions | undefined;
  let capturedPrompt: string | undefined;
  const written: string[] = [];

  const team = createCursorTeam({
    env: {
      CURSOR_API_KEY: "cursor_test_key",
      SCOTTY_CURSOR_MODEL: "composer-2.5",
      SCOTTY_CURSOR_STREAM_LOG: "1",
      SCOTTY_CURSOR_RUNTIME: "node",
    },
    writeStdout: (chunk) => {
      written.push(chunk);
    },
    createAgent: async (options) => {
      capturedOptions = options;
      return {
        agentId: "agent-1",
        model: undefined,
        async send(message: string) {
          capturedPrompt = message;
          return {
            id: "run-1",
            agentId: "agent-1",
            supports: () => true,
            unsupportedReason: () => undefined,
            async *stream() {
              yield {
                type: "assistant",
                agent_id: "agent-1",
                run_id: "run-1",
                message: {
                  role: "assistant",
                  content: [{ type: "text", text: "done" }],
                },
              };
            },
            conversation: async () => [],
            wait: async () => ({
              id: "run-1",
              status: "finished" as const,
              result: "done",
              durationMs: 42,
            }),
            cancel: async () => {},
            status: "finished" as const,
            onDidChangeStatus: () => () => {},
          };
        },
        close: () => {},
        reload: async () => {},
        [Symbol.asyncDispose]: async () => {},
        listArtifacts: async () => [],
        downloadArtifact: async () => Buffer.from(""),
      };
    },
  });

  const result = await team.execute(sampleTask, "/tmp/target-repo");

  expect(capturedOptions?.apiKey).toBe("cursor_test_key");
  expect(capturedOptions?.model).toEqual({ id: "composer-2.5" });
  expect(capturedOptions?.local?.cwd).toBe("/tmp/target-repo");
  expect(capturedPrompt).toContain("# Task: Fix the widget");
  expect(capturedPrompt).toContain("Repair the broken widget.");
  expect(capturedPrompt).toContain("## Starfleet Archive context");
  expect(capturedPrompt).toContain("### archive/alpha/index.md");
  expect(capturedPrompt).toContain("# Alpha index");
  expect(result.success).toBe(true);
  expect(result.stdout).toContain("done");
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
  expect(written.join("")).toContain("done");
});

test("createCursorTeam uses target repo path when SCOTTY_CURSOR_CWD is unset", async () => {
  let capturedOptions: AgentOptions | undefined;

  const team = createCursorTeam({
    env: {
      CURSOR_API_KEY: "cursor_test_key",
    },
    createAgent: async (options) => {
      capturedOptions = options;
      return mockAgent();
    },
  });

  await team.execute(sampleTask, "/tmp/target-repo");

  expect(capturedOptions?.local?.cwd).toBe("/tmp/target-repo");
});

test("createCursorTeam uses SCOTTY_CURSOR_CWD when set", async () => {
  let capturedOptions: AgentOptions | undefined;

  const team = createCursorTeam({
    env: {
      CURSOR_API_KEY: "cursor_test_key",
      SCOTTY_CURSOR_CWD: "/tmp/override",
    },
    createAgent: async (options) => {
      capturedOptions = options;
      return mockAgent();
    },
  });

  await team.execute(sampleTask, "/tmp/target-repo");

  expect(capturedOptions?.local?.cwd).toBe("/tmp/override");
});

test("createCursorTeam prepends SCOTTY_NODE_BIN directory to PATH for node runtime", async () => {
  const originalPath = process.env.PATH;
  let pathDuringCreate: string | undefined;

  const team = createCursorTeam({
    env: {
      CURSOR_API_KEY: "cursor_test_key",
      SCOTTY_CURSOR_RUNTIME: "node",
      SCOTTY_NODE_BIN: "/opt/custom/node",
    },
    createAgent: async () => {
      pathDuringCreate = process.env.PATH;
      return mockAgent();
    },
  });

  await team.execute(sampleTask, "/tmp/target-repo");

  expect(pathDuringCreate).toContain("/opt/custom");
  process.env.PATH = originalPath;
});

function mockAgent() {
  return {
    agentId: "agent-1",
    model: undefined,
    async send(_message: string) {
      return {
        id: "run-1",
        agentId: "agent-1",
        supports: () => true,
        unsupportedReason: () => undefined,
        async *stream() {},
        conversation: async () => [],
        wait: async () => ({
          id: "run-1",
          status: "finished" as const,
          result: "ok",
          durationMs: 1,
        }),
        cancel: async () => {},
        status: "finished" as const,
        onDidChangeStatus: () => () => {},
      };
    },
    close: () => {},
    reload: async () => {},
    [Symbol.asyncDispose]: async () => {},
    listArtifacts: async () => [],
    downloadArtifact: async () => Buffer.from(""),
  };
}
