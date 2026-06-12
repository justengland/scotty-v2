# Engineering Log viewer (`bridge log`)

**Status:** ready-for-agent
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 MVP (`CONTEXT.md`: `bridge log`).

## What to build

Read-only CLI command to inspect Engineering Log entries without opening Obsidian.

`bridge log` pulls the Scotty Vault, reads dated markdown files under `log/`, and prints dispatch/diagnostic outcome blocks to stdout. Support filters: `--repo`, `--since` (ISO date), `--limit` (default reasonable cap). Parse the existing Phase 1 log format (dispatch blocks with repo, task, outcome, Tricorder summary).

No new vault schema. No writes. Exit non-zero on vault/read errors only.

## Acceptance criteria

- [ ] `bridge log` prints recent Engineering Log entries from `log/`
- [ ] `--repo` filters to a single Duty Roster repo name
- [ ] `--since` and `--limit` constrain output
- [ ] Vault `git pull` runs before read (same as other Bridge commands)
- [ ] CLI integration test with fixture vault containing known log entries
- [ ] Empty log directory prints a clear message and exits zero

## Blocked by

None — can start immediately
