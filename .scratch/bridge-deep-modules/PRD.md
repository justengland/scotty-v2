# PRD: Bridge Deep Modules — Archive Index, Claude Runner, Command Bootstrap

**Status:** ready-for-agent

## Problem Statement

The Bridge CLI grew feature-by-feature through Phase 1 and Phase 2, and three areas of duplicated orchestration now slow development and invite drift.

**Context injection** and **Diagnostic Cycle** Archive validation each implement their own vault walker and wiki-link page index. The two implementations resolve paths differently (vault-relative vs absolute), so wiki-link rules can diverge silently. Phase 2 `contextDepth` traversal and diagnostic markdown validation should share one definition of how `[[wiki-links]]` resolve in the Scotty Vault — they do not today. `bridge status` also reaches into diagnostic internals to read Archive frontmatter instead of a stable knowledge seam.

**Claude Team** and the **Diagnostic Cycle** agent each embed the same subprocess logic: resolve `claude` on PATH, spawn with `-p`, tee stdout/stderr to the **Console stream**, and assemble an `ExecutionResult`. A streaming or PATH-resolution fix must be applied twice; tests mock at the Away Team or Diagnostic Agent level and never exercise a shared runner adapter.

Every vault-touching Bridge command repeats the same bootstrap: resolve Scotty Vault path, **Vault sync** (`git pull`), load **Mission Orders**. **Dispatch** and **Diagnostic Cycle** orchestrators independently validate **Duty Roster** membership and local repo path — logic that `resolveRepoProfile` already centralizes for `bridge roster`. New commands (`bridge log`, `bridge status`) copied this pattern again. Orchestration has no locality at the CLI seam.

## Solution

Deepen three modules inside The Bridge so duplicated policy concentrates behind small interfaces:

1. **Starfleet Archive module** — one deep module for vault markdown indexing, wiki-link resolution, bounded **Context injection** traversal, and Archive page validation (frontmatter, stale `sources`, broken links). Dispatch, Diagnostic Cycle, and `bridge status` become thin callers.

2. **Claude Console stream runner** — one deep subprocess adapter for headless `claude -p` with real-time **Console stream** teeing. Claude Team and the Diagnostic Cycle agent build prompts and delegate execution.

3. **BridgeContext** — one deep bootstrap module that performs Vault sync and Mission Orders load, and resolves a **Duty Roster** repo to a validated profile. CLI commands parse arguments, call BridgeContext, then invoke orchestrators with a resolved profile — not raw `repoName` plus full orders.

Behavior visible to the operator is unchanged. This is an internal deepening refactor that improves locality, test surfaces, and Phase 2 readiness.

## User Stories

1. As an operator, I want `bridge dispatch` to inject Archive context using the same wiki-link rules as `bridge diagnostic`, so that broken links are caught consistently whether I am dispatching or validating.
2. As an operator, I want `contextDepth` traversal on dispatch to resolve `[[wiki-links]]` identically to diagnostic Archive validation, so that linked pages I can dispatch with are pages diagnostic considers valid.
3. As an operator, I want broken `[[wiki-links]]` during context injection to abort dispatch before the Away Team runs, so that Tasks never start with incomplete knowledge.
4. As an operator, I want diagnostic Archive validation to use the same page index as context injection, so that a page reachable at dispatch time is not falsely flagged broken at diagnostic time.
5. As an operator, I want `bridge status` to read Archive frontmatter through the same knowledge module as diagnostic, so that status stardates reflect the same parsing rules as validation.
6. As an operator, I want default context injection at depth `0` to behave exactly as Phase 1 (index, captains-log, explicit Mission Orders context only), so that existing workflows are not disrupted.
7. As an operator, I want bounded wiki-link traversal at depth N to remain cycle-safe and deduplicated, so that dispatch cannot infinite-loop on circular Archive links.
8. As an operator, I want Claude Team stdout/stderr to stream to my terminal in real time during dispatch, so that the Console stream UX is preserved after the refactor.
9. As an operator, I want Diagnostic Cycle Claude output to stream to my terminal in real time, so that I can follow Archive updates as they are written.
10. As an operator, I want Bridge to fail fast when `claude` is not on PATH for either dispatch or diagnostic, so that misconfiguration is caught before subprocess work starts.
11. As an operator, I want `SCOTTY_CLAUDE_PATH` to override PATH lookup for both Claude Team and Diagnostic Cycle, so that I can pin a specific Claude binary in one place.
12. As an operator, I want every vault-touching command to pull the Scotty Vault before reading state, so that Mission Orders and Archive pages are fresh — without each command reimplementing that policy.
13. As an operator, I want `bridge dispatch <repo>` to error clearly when `<repo>` is not on the Duty Roster, so that typos fail fast with the same message whether I used roster, dispatch, or diagnostic.
14. As an operator, I want dispatch and diagnostic to error clearly when a rostered repo has no local path in Mission Orders, so that missing `local.toml` overlays are obvious.
15. As an operator, I want `bridge roster`, `bridge dispatch`, `bridge diagnostic`, `bridge log`, and `bridge status` to share one bootstrap path, so that Vault sync behavior cannot drift between commands.
16. As a maintainer, I want wiki-link indexing logic in one module, so that Phase 2 wiki-link context and diagnostic validation do not require parallel edits.
17. As a maintainer, I want Claude subprocess and streaming logic in one module, so that Console stream fixes apply to both Away Team and Diagnostic Cycle automatically.
18. As a maintainer, I want Duty Roster resolution in one module, so that adding a new vault-touching command does not copy five lines of bootstrap and roster validation.
19. As a maintainer, I want the Starfleet Archive module's interface to be the test surface for traversal and validation, so that dispatch and diagnostic tests do not assert walker internals.
20. As a maintainer, I want the Claude runner's interface to accept an injectable subprocess adapter in tests, so that Away Team tests focus on prompt construction not spawn mechanics.
21. As a maintainer, I want BridgeContext to accept injectable VaultGitOps in tests, so that bootstrap tests do not require real `git pull` on every run.
22. As a maintainer, I want `runDispatch` and `runDiagnostic` to accept a resolved `RepoProfile` (or equivalent), so that orchestrator unit tests do not reconstruct Mission Orders lookup.
23. As a maintainer, I want deleting the old duplicate walkers to pass the deletion test — complexity should concentrate in the Archive module, not reappear across callers.
24. As a maintainer, I want the Archive page index to use vault-relative paths as the canonical representation, so that context files, validation errors, and Task payloads stay consistent.
25. As a maintainer, I want wiki-link resolution to try repo-scoped candidates (`archive/<repo>/...`) before vault-wide candidates, so that Context injection stays repo-aware per CONTEXT.md.
26. As a maintainer, I want Archive validation to continue checking required frontmatter (`entity`, `repo`, `updated`, `sources`), stale `sources` relative to repo HEAD, and broken wiki-links, so that diagnostic quality gates are preserved.
27. As a maintainer, I want `validateArchivePages` (or its successor) to remain callable from the Diagnostic Cycle orchestrator after Archive pages are written, so that invalid markdown never commits to the Scotty Vault.
28. As a maintainer, I want `loadContextFiles` / `traverseContextPaths` to remain callable from Task construction on dispatch, so that Context injection stays on the dispatch path.
29. As a maintainer, I want Claude Team to continue executing against the target repository path, so that Away Team cwd semantics are unchanged.
30. As a maintainer, I want the Diagnostic Cycle agent to continue executing against the Scotty Vault path, so that Archive writes stay confined to the vault.
31. As a maintainer, I want `ExecutionResult` shape (`success`, `stdout`, `stderr`, `durationMs`) to remain stable, so that Engineering Log and hail orchestration do not change.
32. As a maintainer, I want existing `inject-context.test.ts` scenarios (depth 0, depth 1 chain, broken link, cycle) to pass against the new Archive module, so that Phase 2 wiki-link context behavior is regression-protected.
33. As a maintainer, I want existing `run-diagnostic.test.ts` validation scenarios to pass, so that frontmatter and wiki-link validation behavior is regression-protected.
34. As a maintainer, I want existing `run-dispatch.test.ts` and `cli.integration.test.ts` dispatch scenarios to pass, so that the end-to-end dispatch lifecycle is regression-protected.
35. As a maintainer, I want `resolveRepoProfile` to become the single Duty Roster lookup used by dispatch and diagnostic orchestration paths, so that the orphaned helper earns its keep.
36. As a maintainer, I want CLI commands to remain thin — parse args, bootstrap via BridgeContext, call orchestrator, format output — so that business logic does not creep back into `cli/commands/`.
37. As a maintainer, I want no change to Vault sync commit policy (local commit after dispatch, commit+push after diagnostic), so that this refactor does not scope-creep into Vault git unification.
38. As a maintainer, I want no change to Hailing Frequencies behavior, so that failure notification policy stays out of this PRD.
39. As a maintainer, I want no change to Tricorder or Away Team registry shapes beyond wiring through the new runner, so that verifier and agent selection stay stable.
40. As a maintainer, I want CursorTeam dispatch to continue working after Archive and bootstrap refactors, so that Phase 2's second Away Team is not broken.

## Implementation Decisions

### Scope and ordering

Three independent deepenings in one PRD. Recommended implementation order:

1. **BridgeContext** — smallest behavioral surface, unblocks orchestrator signature cleanup.
2. **Starfleet Archive module** — highest leverage; supersedes duplicated walkers before more wiki-link features land.
3. **Claude Console stream runner** — independent of the other two; can follow Archive or run in parallel after BridgeContext.

Each deepening should ship with tests before deleting the old duplicate implementation. No feature flags required — replace in place.

### 1. Starfleet Archive module

**New deep module** (suggested name: `archive` or `vault/archive`) owning all Scotty Vault markdown knowledge operations for Bridge.

**Public interface** (vault-relative paths throughout):

- `buildPageIndex(vaultPath)` → index mapping link aliases (basename, without extension, lowercase) to vault-relative `.md` paths.
- `resolveWikiLink(target, { repo?, index })` → vault-relative path or undefined. Repo-scoped candidates first when `repo` is provided.
- `traverseContextPaths(vaultPath, seedPaths, { repo, contextDepth })` → `{ path, content }[]`. Throws on missing seed files or broken links when depth > 0. Cycle-safe BFS with visited set. Depth `0` loads seeds only (no index build).
- `validateArchivePages(vaultPath, repoName, repoHeadSha)` → `string[]` error messages. Checks required **Archive frontmatter**, stale `sources`, and broken wiki-links using the shared index.
- `readLatestArchiveStardate(vaultPath, repoName)` → ISO date or undefined — consolidates status's frontmatter scan (optional in first slice; include if `read-status` is touched).

**Callers after refactor:**

- Task construction / Context injection calls `traverseContextPaths` (replaces inline logic in context injection).
- Diagnostic Cycle calls `validateArchivePages` (replaces inline logic in archive validation).
- `bridge status` calls `readLatestArchiveStardate` or shared frontmatter reader if extracted.

**Delete or reduce to re-exports:** duplicate `findVaultMarkdownFiles`, `buildVaultPageIndex` / `vaultPageIndex`, and duplicated wiki-link patterns in the old context-injection and archive-validation modules.

**Canonical path representation:** vault-relative paths (e.g. `archive/alpha/index.md`) everywhere the Archive module returns paths. Diagnostic error messages may include vault-relative paths for consistency with dispatch errors.

### 2. Claude Console stream runner

**New deep module** (suggested name: `claude-runner` or `agent/claude-runner`) with a single execution entry point:

```ts
runClaudePrompt(input: {
  prompt: string;
  cwd: string;
  resolveClaudePath?: () => string | undefined;
  stream?: { stdout: WritableStream; stderr: WritableStream }; // default: process.stdout/stderr
}): Promise<ExecutionResult>
```

**Behavior:**

- Resolve binary: `SCOTTY_CLAUDE_PATH` if set and exists, else `Bun.which("claude")`.
- Throw `ClaudeNotFoundError` if unresolved (existing error type).
- `Bun.spawn([claude, "-p", prompt], { cwd, stdout: "pipe", stderr: "pipe" })`.
- Tee each stream to the Console stream target while accumulating full stdout/stderr strings.
- Return `{ success: exitCode === 0, stdout, stderr, durationMs }`.

**Adapters after refactor:**

- Claude Team: `buildTaskPrompt(task)` → `runClaudePrompt({ prompt, cwd: repoPath })`.
- Diagnostic Cycle agent: `runClaudePrompt({ prompt, cwd: vaultPath })`.

**Injectable deps for tests:** `resolveClaudePath` and optionally a spawn/stream factory so runner tests do not require a real `claude` binary.

`ExecutionResult` remains in its current shared location; moving it to a neutral `agent/types` module is optional and out of scope unless required to break an import cycle.

### 3. BridgeContext bootstrap

**New deep module** (suggested name: `bridge-context` or `session/bridge-context`):

```ts
prepareBridgeSession(deps?: { gitOps?: VaultGitOps; env?: ProcessEnv }): Promise<{
  vaultPath: string;
  orders: MissionOrders;
}>

resolveRosterRepo(
  orders: MissionOrders,
  repoName: string,
): { name: string; profile: RepoProfile }  // throws VaultConfigError; validates profile.path is set
```

**`prepareBridgeSession` behavior:**

1. `resolveVaultConfig(env)` → `vaultPath` (remote resolution not needed for read commands unless init).
2. `syncVaultBeforeCommand(vaultPath, gitOps)` — **Vault sync** before every operation.
3. `loadResolvedMissionOrders(env)` → merged orders with vault path/remote resolved.

**`resolveRosterRepo` behavior:**

- Delegate roster membership to existing `resolveRepoProfile`.
- Additionally throw `DispatchError` or `DiagnosticError` (preserve existing error types per caller) when `profile.path` is missing — or throw a shared `VaultConfigError` if consolidating error types is cleaner without changing CLI exit messaging.

**CLI commands after refactor:**

`dispatch`, `diagnostic`, `roster`, `status`, `log` each call `prepareBridgeSession()` once, then pass `vaultPath` + `orders` (or resolved profile) to orchestrators/formatters.

**Orchestrator input change:**

- `runDispatch` and `runDiagnostic` accept `profile: RepoProfile` and `repoName: string` (or a single `resolvedRepo` object) instead of performing Duty Roster lookup internally.
- Roster validation moves upstream to BridgeContext / CLI layer.

**`bridge init` and `bridge hail`:** init uses vault config resolution but not full session prepare; hail does not need vault pull. Only vault-reading commands adopt `prepareBridgeSession` — do not force hail/init through unnecessary sync if they do not today.

### Regression and compatibility

- All existing `bun test` suites in `packages/bridge` must pass after refactor.
- Operator-visible CLI arguments, exit codes, and error message wording should remain substantially the same (minor wording normalization acceptable if tests are updated deliberately).
- No changes to Mission Orders schema, Engineering Log format, or Archive frontmatter requirements.

## Testing Decisions

### What makes a good test

Test **external behavior through module interfaces**, not private walkers, spawn internals, or duplicate bootstrap copies. Callers cross the same seam production code uses. If a test requires reaching past the public interface, the module boundary is probably wrong.

Prefer temp-directory vault fixtures (existing pattern) over mocking `node:fs`. Prefer injectable adapters (`VaultGitOps`, `resolveClaudePath`, mock subprocess) over global `Bun.$` mocks.

### Proposed test seams (highest first)

| Module            | Primary test seam                                                     | Callers tested how                                                                                                                |
| ----------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Starfleet Archive | `buildPageIndex`, `traverseContextPaths`, `validateArchivePages`      | Dedicated `archive/*.test.ts` with vault fixtures; migrate scenarios from context-injection and archive-validation tests          |
| Claude runner     | `runClaudePrompt` with injectable path resolver and spawn/stream deps | Dedicated `claude-runner.test.ts`; Away Team tests mock runner and assert prompt + cwd only                                       |
| BridgeContext     | `prepareBridgeSession`, `resolveRosterRepo` with fake `VaultGitOps`   | Dedicated `bridge-context.test.ts`; orchestrator tests inject resolved profile; one CLI integration path asserts sync called once |

### Modules to test

- **New:** Archive module test suite (wiki-link index, traversal depth, broken links, cycles, validation errors, frontmatter staleness).
- **New:** Claude runner test suite (PATH resolution, missing binary error, stream teeing with fake streams, success/failure exit codes).
- **New:** BridgeContext test suite (sync invoked, orders loaded, roster miss, missing local path).
- **Updated:** context-injection tests → Archive module tests (or thin re-export tests if wrappers remain).
- **Updated:** diagnostic validation tests → Archive module tests.
- **Updated:** `run-dispatch.test.ts`, `run-diagnostic.test.ts` — remove redundant roster lookup cases from orchestrator tests; add BridgeContext cases upstream.
- **Smoke:** `cli.integration.test.ts` — full dispatch and diagnostic paths still green.

### Prior art

- `inject-context.test.ts` — temp vault, wiki-link graph fixtures, depth and broken-link assertions.
- `run-diagnostic.test.ts` — Archive validation and frontmatter scenarios.
- `vault-client.test.ts` — injectable `VaultGitOps` for pull/init behavior.
- `run-dispatch.test.ts` — mock Away Team at orchestrator seam, temp vault with git init.
- `resolve-vault-config.test.ts` — `resolveRepoProfile` Duty Roster errors.

## Out of Scope

- Operational failure pipeline unification (hail channel wiring, `summarizeExecution` duplication).
- Vault sync git operations unification (extending `VaultGitOps` to commit/push; merging commit-vault and push-vault).
- Shallow registry cleanup and Tricorder `DispatchError` leakage.
- New Away Teams, verifiers, or CLI commands beyond wiring existing commands through BridgeContext.
- Changes to Vault sync commit/push policy, Engineering Log format, Hailing Frequencies behavior, or Tricorder verification rules.
- Rewriting all integration tests to stop asserting hail message substrings.
- Moving `ExecutionResult` or error types to new packages unless required to complete this refactor.
- `bridge init` scaffold changes and `bridge hail` bootstrap changes beyond what is needed for consistency.

## Further Notes

### Relationship to Phase 2 issues

This PRD deepens infrastructure that Phase 2 features depend on:

- `.scratch/bridge-phase-2/issues/04-wiki-link-context-traversal.md` — traversal logic should live in the Archive module; that issue's acceptance criteria should be satisfied by Archive module tests (may already be partially implemented in context injection).
- `.scratch/bridge-phase-2/issues/02-bridge-status.md` — status Archive reads should use the Archive module instead of importing diagnostic parsers directly.

### Architecture review origin

Candidates 1–3 from the Bridge architecture review (2026-06-12). Candidates 4–6 (failure pipeline, Vault git unification, registry seams) are explicitly deferred.

### Suggested issue breakdown (optional)

If splitting work across agents:

1. BridgeContext bootstrap + orchestrator signature update + CLI wiring.
2. Starfleet Archive module + migrate context injection and validation + status read.
3. Claude Console stream runner + wire Claude Team and Diagnostic Cycle agent.

Each slice should keep `bun test` green before merging.
