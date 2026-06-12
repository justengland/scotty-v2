# Engineering Log viewer (`bridge log`)

**Status:** done
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 MVP (`CONTEXT.md`: `bridge log`).

## What to build

Read-only CLI command to inspect Engineering Log entries without opening Obsidian.

`bridge log` pulls the Scotty Vault, reads dated markdown files under `log/`, and prints dispatch/diagnostic outcome blocks to stdout. Support filters: `--repo`, `--since` (ISO date), `--limit` (default reasonable cap). Parse the existing Phase 1 log format (dispatch blocks with repo, task, outcome, Tricorder summary).

No new vault schema. No writes. Exit non-zero on vault/read errors only.

## Acceptance criteria

- [x] `bridge log` prints recent Engineering Log entries from `log/`
- [x] `--repo` filters to a single Duty Roster repo name
- [x] `--since` and `--limit` constrain output
- [x] Vault `git pull` runs before read (same as other Bridge commands)
- [x] CLI integration test with fixture vault containing known log entries
- [x] Empty log directory prints a clear message and exits zero

## Blocked by

None — can start immediately

## Completed

2026-06-12. Log reader module parses Phase 1 dispatch blocks from dated `log/*.md` files; `bridge log` command with `--repo`, `--since`, `--limit` (default 50); vault pull via `syncVaultBeforeCommand`.
