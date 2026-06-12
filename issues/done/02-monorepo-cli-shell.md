# Monorepo scaffold + CLI shell

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Complete the Bridge CLI package inside the Scotty Bun workspaces monorepo. Workspaces and a test harness may already exist from bootstrap work (`issues/done/01-bootstrap-bridge-package.md`) — extend them with a citty-based CLI that registers all five Phase 1 commands (`init`, `roster`, `dispatch`, `diagnostic`, `hail`) with `--help` stubs. Ship a compilable `bridge` binary via `bun build --compile`.

Each command returns a placeholder message for now; later issues wire real behavior. Domain vocabulary in help text and command descriptions follows `CONTEXT.md`.

## Acceptance criteria

- [x] `packages/bridge/` is a workspace package with TypeScript strict mode
- [x] Root `bun test` and `bun run typecheck` pass
- [x] `bridge --help` lists `init`, `roster`, `dispatch`, `diagnostic`, `hail`
- [x] Each subcommand has `--help` with a one-line description using domain terms (Duty Roster, Away Team, Tricorder, etc.)
- [x] `bun build --compile --minify --target=bun` produces a runnable `bridge` binary
- [x] Stub commands exit 0

## Blocked by

None — can start immediately
