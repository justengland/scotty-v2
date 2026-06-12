# Starfleet Archive module — Context injection on dispatch

**Status:** ready-for-agent
**Type:** AFK

## Parent

`.scratch/bridge-deep-modules/PRD.md`

## What to build

Create a deep Starfleet Archive module owning vault markdown knowledge for Bridge. First slice covers the dispatch path:

Public interface (vault-relative paths throughout):

- `buildPageIndex(vaultPath)` — alias map (basename, without extension, lowercase) → vault-relative `.md` path
- `resolveWikiLink(target, { repo?, index })` — repo-scoped candidates first when `repo` provided, then vault-wide
- `traverseContextPaths(vaultPath, seedPaths, { repo, contextDepth })` — cycle-safe BFS; throws on missing seeds or broken links when depth > 0; depth `0` loads seeds only (no index build)

Wire Task construction / Context injection to `traverseContextPaths`. Remove the duplicate vault walker and page index from context injection. Migrate existing context-injection test scenarios (depth 0, depth N chain, broken link, cycle) to Archive module tests.

Operator-visible dispatch context behavior unchanged: default pages, Mission Orders extras, `contextDepth` traversal, broken-link abort before Away Team execution.

## Acceptance criteria

- [ ] Archive module exposes `buildPageIndex`, `resolveWikiLink`, and `traverseContextPaths`
- [ ] Context injection on dispatch uses Archive module; duplicate walker removed
- [ ] Depth `0` behavior identical to current Phase 1 / Phase 2 default
- [ ] `contextDepth` > 0 traverses wiki-links with cycle safety and deduplication
- [ ] Broken `[[wiki-links]]` abort dispatch before Away Team with clear error naming the target
- [ ] All paths returned are vault-relative (e.g. `archive/alpha/index.md`)
- [ ] Archive module test suite covers index, traversal, broken links, and cycles
- [ ] CursorTeam dispatch path still receives correct `Task.contextFiles`
- [ ] All existing `packages/bridge` tests pass

## Blocked by

None — can start immediately
