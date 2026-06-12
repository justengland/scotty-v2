# Tricorder gate (bun + markdown verifiers)

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Add the Tricorder verification step to the dispatch pipeline: **Verify** runs after Execute when the repo profile declares a verifier.

- Registry maps `verify = "bun"` → runs `bun test` in repo path; `verify = "markdown"` → lint + link-check target repo markdown.
- No `verify` key → skip Tricorder entirely.
- `--skip-verify` flag bypasses verification.
- When verifier runs, Away Team `success` is ignored — Tricorder is the final word.
- On failure: append Engineering Log entry, exit non-zero. Target repo worktree left as-is. (Discord hail wired in issue 05.)

```ts
interface VerificationResult {
  passed: boolean;
  summary: string;
  errors?: string[];
  durationMs: number;
}

interface Verifier {
  verify(repoPath: string): Promise<VerificationResult>;
}
```

## Acceptance criteria

- [x] `verify = "bun"` runs `bun test` and maps result to `VerificationResult`
- [x] `verify = "markdown"` lints and link-checks `.md` files in target repo
- [x] Repos without `verify` skip Tricorder; dispatch succeeds based on Away Team alone
- [x] `--skip-verify` bypasses Tricorder even when configured
- [x] Tricorder failure → non-zero exit, Engineering Log entry, repo untouched
- [x] Tricorder success with Away Team reporting failure → dispatch succeeds (exit 0)
- [x] Tests use fixture repos for bun and markdown verifiers

## Blocked by

- `issues/03-dispatch-tracer-bullet.md`

## Comments

Completed 2026-06-12. Dispatch pipeline is Route → Inject → Execute → Verify → Engineering Log. `SCOTTY_BUN_PATH` overrides bun binary for tests. Root `test` script scopes to `packages/bridge/src` so verifier fixture `*.test.ts` files are not collected by the suite runner.
