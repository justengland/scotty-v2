# Starfleet Archive module — validation and status reads

**Status:** ready-for-agent
**Type:** AFK

## Parent

`.scratch/bridge-deep-modules/PRD.md`

## What to build

Extend the Starfleet Archive module from issue 02 with validation and status read operations, using the same shared page index:

- `validateArchivePages(vaultPath, repoName, repoHeadSha)` — required Archive frontmatter (`entity`, `repo`, `updated`, `sources`), stale `sources` relative to repo HEAD, broken wiki-links
- `readLatestArchiveStardate(vaultPath, repoName)` — latest ISO `updated` across project Archive pages

Wire Diagnostic Cycle orchestrator to `validateArchivePages` (replace duplicate walker in archive validation). Wire `bridge status` Archive stardate reads to `readLatestArchiveStardate` instead of importing diagnostic internals directly.

Remove duplicate vault walker and wiki-link index from archive validation. Migrate diagnostic validation test scenarios to Archive module tests.

Dispatch context injection and diagnostic validation must agree on wiki-link resolution — one index, one set of rules.

## Acceptance criteria

- [ ] `validateArchivePages` uses shared `buildPageIndex`; duplicate walker removed from archive validation
- [ ] Diagnostic Cycle still blocks vault commit on frontmatter errors, stale sources, and broken wiki-links
- [ ] Validation error messages use vault-relative paths where paths appear
- [ ] `bridge status` reads Archive stardate via Archive module, not diagnostic imports
- [ ] A page reachable at dispatch context time is not falsely flagged broken at diagnostic time
- [ ] Archive module tests cover frontmatter validation and stale `sources` scenarios
- [ ] All existing `packages/bridge` tests pass

## Blocked by

- `.scratch/bridge-deep-modules/issues/02-archive-context-injection.md`
