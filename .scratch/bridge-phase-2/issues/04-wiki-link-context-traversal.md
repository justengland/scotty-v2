# Wiki-link context traversal

**Status:** ready-for-agent
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 PRD (wiki-link traversal for context injection).

## What to build

Extend context injection on dispatch to optionally follow `[[wiki-links]]` from loaded Archive pages.

After loading default pages (`index.md`, `captains-log.md`) and explicit `context` entries from Mission Orders, traverse wiki-links within the vault up to a bounded depth. Depth `0` preserves Phase 1 behavior (no traversal). Expose depth via Mission Orders per-repo key (e.g. `contextDepth`) or a dispatch flag — default `0`.

Missing link targets error before Away Team execution (consistent with diagnostic Archive validation). No full-vault dump; visited pages deduplicated.

## Acceptance criteria

- [ ] Default depth `0` — behavior identical to Phase 1
- [ ] Configurable depth adds linked Archive pages to `Task.contextFiles`
- [ ] Broken `[[wiki-links]]` abort dispatch with clear error naming the missing target
- [ ] Cycle-safe: revisiting a page does not infinite-loop
- [ ] Tests with small Archive fixture graph (index → architecture → decision)
- [ ] Works with both Claude Team and CursorTeam dispatch paths

## Blocked by

None — can start immediately
