# Integration tests + compiled binary polish

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Harden Phase 1 with end-to-end integration tests and a polished compiled binary deliverable.

Cover the testing seams from the PRD:
1. CLI integration — temp vault + temp repo + mock `claude` on PATH
2. Dispatch pipeline — context injection, Tricorder gate, log content
3. Diagnostic pipeline — frontmatter validation, push behavior
4. Mission Orders loader — merge + env overrides
5. Vault sync — pull / local-commit / push rules
6. Verifier registry — bun + markdown fixture repos

Add a root or package script to build the compiled `bridge` binary. Document minimal operator setup in package README or similar (vault path, env vars, first dispatch).

## Acceptance criteria

- [x] `bun test packages/bridge` passes full integration suite
- [x] At least one CLI integration test per command: `init`, `roster`, `dispatch`, `diagnostic`, `hail`
- [x] Mock `claude` script pattern documented for local dev and CI
- [x] Compiled `bridge` binary builds and runs `--help` without Bun installed at runtime
- [x] No tests make real Discord or Claude network calls
- [x] All Phase 1 acceptance paths from issues 01–06 covered by at least one test

## Blocked by

- `issues/06-diagnostic-cycle.md`

## Next iteration

Phase 1 MVP complete. Future work: `bridge status`, CursorTeam, scheduled diagnostics (see PRD out of scope).
