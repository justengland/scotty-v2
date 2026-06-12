# Fleet status (`bridge status`)

**Status:** done
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 MVP (`CONTEXT.md`: `bridge status`).

## What to build

At-a-glance fleet health for every repo on the Duty Roster.

`bridge status` pulls the vault and prints a table per repo: last dispatch outcome (from Engineering Log), last recorded `sources` SHA (from Archive frontmatter or Scotty Index), and last diagnostic stardate (`updated` on project Archive pages). Reuse log parsing from `bridge log`.

Read-only — no vault writes. Clear message when a repo has no log or Archive history yet.

## Acceptance criteria

- [x] `bridge status` lists every repo from Mission Orders with status columns
- [x] Last dispatch outcome derived from Engineering Log (reuses log reader from issue 01)
- [x] Last diagnostic SHA/stardate derived from Archive frontmatter
- [x] Repos with no history show placeholders, not errors
- [x] Vault pull before read
- [x] CLI integration test with fixture vault + log + archive pages

## Blocked by

- `.scratch/bridge-phase-2/issues/01-bridge-log.md`

## Completed

2026-06-12. `readFleetStatus` composes `readEngineeringLog` (limit 1 per repo), `readLastRecordedSha`, and archive `updated` scan; aligned table formatter with `(none)` placeholders; vault pull via `syncVaultBeforeCommand`.
