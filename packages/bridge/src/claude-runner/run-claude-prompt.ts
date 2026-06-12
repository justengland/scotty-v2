import { existsSync } from "node:fs";
import { ClaudeNotFoundError } from "../dispatch/errors";
import type { ExecutionResult } from "../dispatch/types";

export interface ClaudeSpawnProcess {
  claudePath: string;
  prompt: string;
  cwd: string;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exited: Promise<number>;
}

export interface RunClaudePromptInput {
  prompt: string;
  cwd: string;
  resolveClaudePath?: () => string | undefined;
  stream?: { stdout: WritableStream; stderr: WritableStream };
  spawnClaude?: (args: {
    claudePath: string;
    prompt: string;
    cwd: string;
  }) => ClaudeSpawnProcess;
}

export function defaultResolveClaudePath(): string | undefined {
  const override = process.env.SCOTTY_CLAUDE_PATH;
  if (override) {
    return existsSync(override) ? override : undefined;
  }
  return Bun.which("claude") ?? undefined;
}

function processWritableStream(
  write: (chunk: string) => boolean | void
): WritableStream {
  const decoder = new TextDecoder();
  return new WritableStream({
    write(chunk) {
      write(decoder.decode(chunk));
    },
  });
}

function defaultConsoleStream(): {
  stdout: WritableStream;
  stderr: WritableStream;
} {
  return {
    stdout: processWritableStream((chunk) => process.stdout.write(chunk)),
    stderr: processWritableStream((chunk) => process.stderr.write(chunk)),
  };
}

function defaultSpawnClaude(args: {
  claudePath: string;
  prompt: string;
  cwd: string;
}): ClaudeSpawnProcess {
  const proc = Bun.spawn([args.claudePath, "-p", args.prompt], {
    cwd: args.cwd,
    stdout: "pipe",
    stderr: "pipe",
    env: process.env,
  });

  return {
    ...args,
    stdout: proc.stdout,
    stderr: proc.stderr,
    exited: proc.exited,
  };
}

async function teeStream(
  source: ReadableStream<Uint8Array>,
  target: WritableStream
): Promise<string> {
  const reader = source.getReader();
  const writer = target.getWriter();
  const decoder = new TextDecoder();
  let accumulated = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      accumulated += chunk;
      await writer.write(value);
    }
  } finally {
    writer.releaseLock();
  }

  return accumulated;
}

export async function runClaudePrompt(
  input: RunClaudePromptInput
): Promise<ExecutionResult> {
  const resolveClaudePath = input.resolveClaudePath ?? defaultResolveClaudePath;
  const claudePath = resolveClaudePath();
  if (!claudePath) {
    throw new ClaudeNotFoundError();
  }

  const stream = input.stream ?? defaultConsoleStream();
  const spawnClaude = input.spawnClaude ?? defaultSpawnClaude;
  const startedAt = Date.now();

  const proc = spawnClaude({
    claudePath,
    prompt: input.prompt,
    cwd: input.cwd,
  });

  const [stdout, stderr] = await Promise.all([
    teeStream(proc.stdout, stream.stdout),
    teeStream(proc.stderr, stream.stderr),
  ]);
  const exitCode = await proc.exited;

  return {
    success: exitCode === 0,
    stdout,
    stderr,
    durationMs: Date.now() - startedAt,
  };
}
