# Vault client + Mission Orders loader + roster

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Wire `bridge init` and `bridge roster` end-to-end against the Scotty Vault.

**Vault client:** resolve vault path and remote (`SCOTTY_VAULT_*` env overrides TOML defaults). `bridge init` clones the remote into the configured path when missing, or scaffolds `archive/`, `log/`, `orders/`, and `Scotty Index.md` if the directory is empty. `git pull` runs before every Bridge command.

**Mission Orders loader:** merge `orders/mission-orders.toml` + gitignored `orders/local.toml`. Repo profiles expose `path`, `agent`, optional `verify`, optional `context`. No secrets in TOML.

**Roster:** `bridge roster` prints the Duty Roster — each repo name with agent, verifier, and resolved local path. Clear error when a repo name is not in the roster.

Scotty Vault remote: `git@github.com:justengland/scotty-vault.git`

## Acceptance criteria

- [x] `bridge init` clones vault remote when path missing, or scaffolds empty vault layout
- [x] Vault path resolves: `SCOTTY_VAULT_PATH` → `local.toml` → error if unset
- [x] Vault remote resolves: `SCOTTY_VAULT_REMOTE` → `mission-orders.toml` → error if unset
- [x] `git pull` runs before `init` and `roster` (and is reusable for later commands)
- [x] `bridge roster` prints all `[repos.*]` profiles with agent, verify, and path
- [x] Unknown repo name lookup returns a clear error message
- [x] Tests cover TOML merge, env override precedence, and init scaffold against temp git dirs

## Blocked by

- `issues/01-monorepo-cli-shell.md`

## Comments

Completed 2026-06-12. Vault path falls back to `~/.config/scotty/orders/local.toml` machine overlay (written by `bridge init`). `syncVaultBeforeCommand` skips pull when no upstream is configured.
