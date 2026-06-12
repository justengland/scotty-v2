# Claude Console stream runner

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-deep-modules/PRD.md`

## What to build

Extract duplicated Claude subprocess logic into a deep runner module with a single entry point:

```ts
runClaudePrompt(input: {
  prompt: string;
  cwd: string;
  resolveClaudePath?: () => string | undefined;
  stream?: { stdout: WritableStream; stderr: WritableStream };
}): Promise<ExecutionResult>
```

Behavior: resolve binary (`SCOTTY_CLAUDE_PATH` if set and exists, else PATH), throw `ClaudeNotFoundError` if missing, spawn `claude -p`, tee stdout/stderr to Console stream while accumulating strings, return stable `ExecutionResult` shape.

Wire Claude Team as a thin adapter: build task prompt → `runClaudePrompt({ cwd: target repo path })`. Wire Diagnostic Cycle agent similarly: build diagnostic prompt → `runClaudePrompt({ cwd: Scotty Vault path })`.

Dedicated runner tests with injectable path resolver and stream targets. Away Team tests mock the runner and assert prompt + cwd — not spawn internals.

## Acceptance criteria

- [x] `runClaudePrompt` handles PATH resolution, streaming, duration, and exit code → success mapping
- [x] `SCOTTY_CLAUDE_PATH` overrides PATH for both Claude Team and Diagnostic Cycle agent
- [x] Missing `claude` binary throws `ClaudeNotFoundError` before spawn
- [x] Console stream UX preserved: stdout/stderr reach terminal in real time during dispatch and diagnostic
- [x] Claude Team executes against target repo path; Diagnostic agent against Scotty Vault path
- [x] `ExecutionResult` shape unchanged (`success`, `stdout`, `stderr`, `durationMs`)
- [x] Runner tests cover path resolution, stream teeing, and success/failure without real `claude` binary
- [x] All existing `packages/bridge` tests pass

## Blocked by

None — can start immediately
