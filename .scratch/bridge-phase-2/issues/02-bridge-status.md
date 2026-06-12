# Fleet status (`bridge status`)

**Status:** ready-for-agent
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 MVP (`CONTEXT.md`: `bridge status`).

## What to build

At-a-glance fleet health for every repo on the Duty Roster.

`bridge status` pulls the vault and prints a table per repo: last dispatch outcome (from Engineering Log), last recorded `sources` SHA (from Archive frontmatter or Scotty Index), and last diagnostic stardate (`updated` on project Archive pages). Reuse log parsing from `bridge log`.

Read-only — no vault writes. Clear message when a repo has no log or Archive history yet.

## Acceptance criteria

- [ ] `bridge status` lists every repo from Mission Orders with status columns
- [ ] Last dispatch outcome derived from Engineering Log (reuses log reader from issue 01)
- [ ] Last diagnostic SHA/stardate derived from Archive frontmatter
- [ ] Repos with no history show placeholders, not errors
- [ ] Vault pull before read
- [ ] CLI integration test with fixture vault + log + archive pages

## Blocked by

- `.scratch/bridge-phase-2/issues/01-bridge-log.md`
