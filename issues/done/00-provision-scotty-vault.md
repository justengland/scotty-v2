# Provision Scotty Vault (Obsidian + git remote)

**Status:** done
**Type:** HITL

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Create the **Scotty Vault** — a new git-backed Obsidian vault that holds all durable Scotty state (Starfleet Archive, Engineering Log, Mission Orders). This is a one-time human setup step. Bridge `init` (issue 02) will clone into and scaffold this vault going forward, but the remote repo and Obsidian vault must exist first.

## Acceptance criteria

- [x] Vault directory exists at `/home/justin/Obsidian/scotty-vault`
- [x] Layout has `archive/`, `log/`, `orders/`, and `Scotty Index.md`
- [x] `orders/mission-orders.toml` committed with `[vault] remote` → `git@github.com:justengland/scotty-vault.git`
- [x] `orders/local.toml` gitignored with `[vault] path` set to the Obsidian folder
- [x] Git remote pushed to `origin/main`
- [x] Vault opens in Obsidian without errors

## Blocked by

None — can start immediately

## Comments

Closed 2026-06-12. Vault at `/home/justin/Obsidian/scotty-vault`. Remote `git@github.com:justengland/scotty-vault.git` pushed to `main`. `scotty-v2` added to Duty Roster in Mission Orders.
