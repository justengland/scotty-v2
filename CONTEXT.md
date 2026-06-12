# Scotty

A Bun workspaces monorepo (`packages/*`) for agent orchestration, knowledge archival, and automated repo maintenance. Components ship independently but share conventions and persistent data. Persistent state is git-backed markdown wherever possible.

> **Canonical domain language lives here.** `scotty.md` is the historical v3.2 spec; it may diverge from decisions captured in this glossary.

## Language

**Scotty data root**:
Platform-wide path at `~/.config/scotty/` for runtime config. The Scotty Vault path is machine-specific. Env vars override TOML defaults.
_Avoid_: `~/.config/bridge/`, hard-coded vault paths only

**Vault location**:
Resolved in order: `SCOTTY_VAULT_PATH` env → `orders/local.toml` `[vault] path` default. Remote resolved: `SCOTTY_VAULT_REMOTE` env → `orders/mission-orders.toml` `[vault] remote` default. `bridge init` clones remote into path when the directory is missing.
_Avoid_: Vault path in committed TOML, env-only with no TOML fallback

**Scotty Vault**:
A single git-backed Obsidian vault holding all durable Scotty state. New vault — to be created. Layout:

```
scotty-vault/
├── Scotty Index.md       # fleet map, vault entry point
├── archive/              # Starfleet Archive (knowledge)
├── log/                  # Engineering Log (telemetry)
└── orders/               # Mission Orders (TOML)
```

_Avoid_: Three separate repos, flat vault without section folders

**Scotty Index**:
The vault root note linking all sections. Tracks fleet-wide state (e.g. last-known repo SHAs) and serves as the Obsidian entry point.
_Avoid_: Fleet Index (for the root note), README

**Vault sync**:
Bridge `git pull`s the Scotty Vault before every operation. After dispatch: append to `log/`, auto-commit locally (no push). After diagnostic: commit Archive changes and `git push`. Manual Obsidian edits and Bridge commits coexist until the user pushes.
_Avoid_: Auto-push after every dispatch, manual-only sync (no Bridge git ops)

**Git-first persistence**:
Durable state is stored as markdown in git repositories, not local databases. If it matters tomorrow, it should be committable today.
_Avoid_: SQLite, embedded databases (for now)

**Wiki-link**:
Cross-reference between Archive pages using Obsidian-style `[[page]]` syntax.
_Avoid_: Relative path links (as the canonical cross-ref style)

**Scotty**:
The overarching project and repository. User-facing brand for the platform as a whole.
_Avoid_: The Bridge (as project name), scotty-v2 (implementation codename only)

**The Bridge**:
The CLI package at `packages/bridge/` within the Scotty monorepo. Routes work to Away Teams, runs diagnostics, and coordinates verification and notifications. Ships as the `bridge` binary.
_Avoid_: Scotty (when referring specifically to the CLI), router (generic)

**Dispatch**:
A deliberate, human-triggered act that sends a Task to an Away Team for a named repository. Entry points: `bridge dispatch <repo> --title "..." --description "..."`, `--file`, or `--issue` (markdown issue with `## What to build`).
_Avoid_: Auto-dispatch, diagnostic-driven code changes

**Task**:
A unit of work handed to an Away Team: title, description, priority, and injected context files. Created at dispatch time from CLI arguments — not queued or pulled from an issue tracker (yet).
_Avoid_: Job, ticket, issue

**Away Team**:
An agent backend that executes a dispatched Task against a target repository. May commit changes in the target repo; Bridge does not commit on its behalf. Phase 1: Claude Code (`claude-code`). Phase 2: CursorTeam (`cursor` via `@cursor/sdk` local runtime).
_Avoid_: Agent, worker, executor

**Claude Team**:
The Phase 1 Away Team implementation. Invokes Claude Code headlessly via `claude -p` and `Bun.$`. Selected when a repo profile sets `agent = "claude-code"`. Bridge fails fast if `claude` is not on PATH.
_Avoid_: ClaudeTeam (code name)

**CursorTeam**:
The Phase 2 Away Team implementation. Invokes the Cursor SDK (`@cursor/sdk`) with local runtime against the target repo. Selected when a repo profile sets `agent = "cursor"`. Requires `CURSOR_API_KEY`; model, streaming, runtime, and node bin from `SCOTTY_CURSOR_*` env vars per `.env-template`.
_Avoid_: Cursor (generic), Brain (for dispatch routing)

**Tricorder**:
The verification engine that independently judges whether work succeeded. Decoupled from Away Team execution. Runs only when the repo profile declares a verifier (`bun` or `markdown`). Away Team self-reported success is ignored — Tricorder is the final word. On failure: log to Scotty Log, alert via Hailing Frequencies, exit non-zero; repo worktree left as-is for inspection. `--skip-verify` bypasses verification for bootstrap scenarios. Phase 1 verifiers: `BunVerifier` (`bun test`) and `MarkdownVerifier` (lint + link check).
_Avoid_: Linter, test runner (as the concept name), trusting Away Team success

**Starfleet Archive**:
The fleet knowledge section of the Scotty Vault — project pages, entity docs, and wiki-links. Updated by Diagnostic Cycles.
_Avoid_: Wiki, docs repo, knowledge base, a separate git repository

**Engineering Log**:
The telemetry section of the Scotty Vault — markdown records of run outcomes, verification results, and scheduled job heartbeats. Kept separate from Archive pages so operational noise does not pollute fleet knowledge.
_Avoid_: SQLite, database, unstructured stdout logs (as the source of truth)

**Mission Orders**:
TOML configuration declaring repository profiles, agents, verification rules, and scheduling. Lives in the Scotty Vault, merged with a gitignored `local.toml` for machine-specific paths. Contains no secrets.
_Avoid_: Config, settings, secrets (use environment variables instead), a separate git repository

**Local overlay**:
A gitignored `local.toml` in the vault's orders section that supplies machine-specific values (e.g. repo paths) layered on top of committed `mission-orders.toml`.
_Avoid_: secrets.toml, per-machine config forks

**Hailing Frequencies**:
Outbound notification channels for failures. Phase 1: Discord webhook via `DISCORD_WEBHOOK_URL` env var. Hails on: Away Team crash, Tricorder failure, diagnostic failure. Successes are logged only, not hailed. `bridge hail` tests the webhook.
_Avoid_: Alerts, webhooks (as the concept name)

**Console stream**:
Away Team stdout/stderr streams to the terminal in real time during execution. The Engineering Log records outcomes and summaries — not a replay of streamed output.
_Avoid_: Buffering output to log, tail-log as the primary UX

**Diagnostic Cycle**:
A routine that diffs a target repo since its last recorded SHA, uses Claude to update Archive pages, appends the Captain's Log, and commits the Scotty Vault. Phase 1: manual only via `bridge diagnostic <repo>`. Does not execute code changes in the target repo. Scheduled automation (Bun.cron) deferred to Phase 4.
_Avoid_: Sync, crawl, index, auto-dispatch

**Stardate**:
The timestamp recorded in vault frontmatter and log entries. Human-readable ISO date in Phase 1 (e.g. `2026-06-12`); not a custom format.
_Avoid_: SHA (for timestamps), epoch

**Captain's Log**:
A per-project dated timeline at `archive/<repo>/captains-log.md`, appended after each diagnostic run. Requires the same frontmatter as all Archive pages.
_Avoid_: Changelog, activity feed

**Archive frontmatter**:
Required YAML on every Archive page: `entity`, `repo`, `updated` (ISO date), `sources` (`["repo@sha"]`). Diagnostic validation fails if any field is missing or `sources` is stale relative to the repo HEAD.
_Avoid_: Optional frontmatter, per-type schema exceptions

**Citation**:
Code references in Archive body text use `repo@sha path:line` format (e.g. `starbase-api@abc123 src/index.ts:42`).
_Avoid_: Bare file paths, line numbers without SHA

**Context injection**:
Archive pages passed to an Away Team as `Task.contextFiles` on dispatch. Defaults: `archive/<repo>/index.md` and `archive/<repo>/captains-log.md`. Optional extras declared per repo in Mission Orders (`context = ["architecture", ...]`). Phase 2: BFS wiki-link traversal to `contextDepth` (default `0`; per-repo in Mission Orders or `--context-depth` CLI override). Broken links abort before Away Team execution.
_Avoid_: Full vault dump, unbounded link crawling

**Markdown verification**:
`verify = "markdown"` runs Tricorder against the target repo's markdown (lint + link check). Vault markdown is validated inside `bridge diagnostic` after Archive writes, before commit — not via Tricorder.
_Avoid_: Vault linting as a Tricorder verifier, skipping vault validation on diagnostic

**Shipyard Principle**:
Scotty components are stateless and replaceable; re-cloning restores full capacity. Persistent state lives in the Scotty Vault (git-backed Obsidian vault) plus environment variables for credentials.
_Avoid_: Stateless (generic), ephemeral

**Duty Roster**:
The set of repository profiles declared in Mission Orders.
_Avoid_: Repo list, registry

## Phase 1 MVP

Commands: `bridge init`, `bridge roster`, `bridge dispatch`, `bridge diagnostic`, `bridge hail`.

Deferred to later: `bridge status`, `bridge log`, Bun.cron automation, CursorTeam, Ralph Loop.

## Phase 2 MVP

Commands: all Phase 1 commands plus `bridge log`, `bridge status`.

Phase 2 dispatch enhancements:

- **CursorTeam** — second Away Team via `agent = "cursor"` and `CURSOR_API_KEY`
- **Wiki-link context** — `contextDepth` in Mission Orders or `--context-depth` on CLI
- **Issue-sourced dispatch** — `--issue <path>` reads H1 title and `## What to build` body

`bridge log` reads the Engineering Log (filters: `--repo`, `--since`, `--limit`). `bridge status` prints last dispatch outcome, diagnostic SHA, and Archive stardate per Duty Roster repo. Both pull the vault before reading.

Deferred to later: Bun.cron automation, Ralph Loop, Discord bot / Brain interactive routing.
