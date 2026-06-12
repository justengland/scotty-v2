import { afterEach, beforeEach, expect, test } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeNotFoundError } from "../dispatch/errors";
import {
  defaultResolveClaudePath,
  runClaudePrompt,
  type ClaudeSpawnProcess,
} from "./run-claude-prompt";

function textReadable(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

function collectingWritable(): { stream: WritableStream; text: () => string } {
  const chunks: string[] = [];
  const decoder = new TextDecoder();
  const stream = new WritableStream({
    write(chunk) {
      chunks.push(decoder.decode(chunk));
    },
  });
  return { stream, text: () => chunks.join("") };
}

function mockSpawn(params: {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}): (args: {
  claudePath: string;
  prompt: string;
  cwd: string;
}) => ClaudeSpawnProcess {
  return ({ claudePath, prompt, cwd }) => ({
    claudePath,
    prompt,
    cwd,
    stdout: textReadable(params.stdout ?? ""),
    stderr: textReadable(params.stderr ?? ""),
    exited: Promise.resolve(params.exitCode ?? 0),
  });
}

let originalScottyClaudePath: string | undefined;

beforeEach(() => {
  originalScottyClaudePath = process.env.SCOTTY_CLAUDE_PATH;
});

afterEach(() => {
  if (originalScottyClaudePath === undefined) {
    delete process.env.SCOTTY_CLAUDE_PATH;
  } else {
    process.env.SCOTTY_CLAUDE_PATH = originalScottyClaudePath;
  }
});

test("runClaudePrompt throws ClaudeNotFoundError when claude binary is missing", async () => {
  await expect(
    runClaudePrompt({
      prompt: "hello",
      cwd: "/tmp",
      resolveClaudePath: () => undefined,
    })
  ).rejects.toThrow(ClaudeNotFoundError);
});

test("runClaudePrompt tees stdout and stderr while accumulating output", async () => {
  const stdoutTarget = collectingWritable();
  const stderrTarget = collectingWritable();
  let spawnArgs:
    | { claudePath: string; prompt: string; cwd: string }
    | undefined;

  const result = await runClaudePrompt({
    prompt: "do the thing",
    cwd: "/tmp/repo",
    resolveClaudePath: () => "/usr/bin/claude",
    stream: {
      stdout: stdoutTarget.stream,
      stderr: stderrTarget.stream,
    },
    spawnClaude: (args) => {
      spawnArgs = args;
      return mockSpawn({
        stdout: "line one\n",
        stderr: "warn\n",
        exitCode: 0,
      })(args);
    },
  });

  expect(spawnArgs).toEqual({
    claudePath: "/usr/bin/claude",
    prompt: "do the thing",
    cwd: "/tmp/repo",
  });
  expect(result.success).toBe(true);
  expect(result.stdout).toBe("line one\n");
  expect(result.stderr).toBe("warn\n");
  expect(stdoutTarget.text()).toBe("line one\n");
  expect(stderrTarget.text()).toBe("warn\n");
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
});

test("runClaudePrompt maps non-zero exit code to success false", async () => {
  const result = await runClaudePrompt({
    prompt: "fail",
    cwd: "/tmp/repo",
    resolveClaudePath: () => "/usr/bin/claude",
    spawnClaude: mockSpawn({ exitCode: 1 }),
  });

  expect(result.success).toBe(false);
});

test("defaultResolveClaudePath prefers SCOTTY_CLAUDE_PATH when file exists", () => {
  const override = join(tmpdir(), `claude-override-${crypto.randomUUID()}`);
  Bun.write(override, "#!/bin/sh\n");

  process.env.SCOTTY_CLAUDE_PATH = override;

  expect(defaultResolveClaudePath()).toBe(override);
});

test("defaultResolveClaudePath returns undefined when SCOTTY_CLAUDE_PATH points to missing file", () => {
  process.env.SCOTTY_CLAUDE_PATH = join(tmpdir(), "missing-claude-binary");

  expect(defaultResolveClaudePath()).toBeUndefined();
});
