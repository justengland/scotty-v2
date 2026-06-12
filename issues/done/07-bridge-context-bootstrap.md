# BridgeContext bootstrap and Duty Roster resolution

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-deep-modules/PRD.md`

## What to build

Introduce a deep BridgeContext module with two entry points:

- `prepareBridgeSession` — resolve Scotty Vault path, run Vault sync (`git pull`), load merged Mission Orders
- `resolveRosterRepo` — resolve a Duty Roster repo name to a validated profile (membership via existing roster lookup, plus local path must be set)

Wire every vault-reading Bridge command through `prepareBridgeSession`: `bridge dispatch`, `bridge diagnostic`, `bridge roster`, `bridge log`, and `bridge status`. Each command parses args, bootstraps once, then calls downstream orchestrators or formatters.

Update Dispatch and Diagnostic Cycle orchestrators to accept a resolved `RepoProfile` (and repo name) instead of performing Duty Roster lookup internally. Roster validation moves upstream to BridgeContext / CLI.

Do not change `bridge init` or `bridge hail` — they do not need full session prepare today.

Injectable `VaultGitOps` for tests. Dedicated BridgeContext test suite. Update orchestrator tests to inject resolved profiles directly. Keep `bun test` green.

## Acceptance criteria

- [x] `prepareBridgeSession` resolves vault path, syncs vault, and returns merged Mission Orders
- [x] `resolveRosterRepo` throws on unknown repo (Duty Roster miss) and on missing local path
- [x] `bridge dispatch`, `diagnostic`, `roster`, `log`, and `status` each call `prepareBridgeSession` once — no duplicated bootstrap
- [x] `runDispatch` and `runDiagnostic` accept resolved profile; no internal Duty Roster lookup
- [x] Roster error messages remain substantially consistent with current behavior
- [x] BridgeContext tests use injectable `VaultGitOps` (no real `git pull` required)
- [x] All existing `packages/bridge` tests pass

## Blocked by

None — can start immediately
