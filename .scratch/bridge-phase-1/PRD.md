# PRD: The Bridge — Phase 1 MVP

**Status:** ready-for-agent

## Problem Statement

Managing multiple code repositories with AI agents is fragmented: context lives in scattered notes, agent runs leave no durable record, success is self-reported by the agent, and failures go unnoticed unless you are watching the terminal. There is no single place to declare which repos exist in the fleet, which Away Team handles each one, or what institutional knowledge an agent should see before starting work.

The operator needs a deliberate, local-first orchestration layer that dispatches work to Claude Code, independently verifies outcomes, maintains a git-backed Obsidian vault of fleet knowledge, and alerts on failure — without requiring a database or cloud service.

## Solution

Build **The Bridge**, a CLI package inside the Scotty monorepo, that orchestrates the dispatch lifecycle against a **Scotty Vault** (a single git-backed Obsidian vault holding the Starfleet Archive, Engineering Log, and Mission Orders). The operator runs five commands — `init`, `roster`, `dispatch`, `diagnostic`, and `hail` — to initialize the vault, view the Duty Roster, send Tasks to Claude Code with injected Archive context, update fleet knowledge from repo diffs, and test failure notifications.

Persistent state is markdown in git. Away Team output streams to the console in real time; the Engineering Log records outcomes only. The Tricorder independently verifies success when configured. Discord hails fire on failures.

## User Stories

1. As an operator, I want to run `bridge init` to clone the Scotty Vault and scaffold Mission Orders, so that first-time setup is a single command.
2. As an operator, I want the vault remote URL committed in Mission Orders and the vault path in a gitignored local overlay, so that fleet config is portable but machine paths stay private.
3. As an operator, I want `SCOTTY_VAULT_PATH` and `SCOTTY_VAULT_REMOTE` environment variables to override TOML defaults, so that I can point Bridge at different vaults without editing files.
4. As an operator, I want `bridge roster` to print the Duty Roster from Mission Orders, so that I can see which repositories Bridge knows about and how each is configured.
5. As an operator, I want each repository profile to declare its local path, Away Team agent, optional verifier, and optional extra context pages, so that per-repo behavior is explicit.
6. As an operator, I want `bridge dispatch <repo> --title "..." --description "..."` to send a Task to Claude Code, so that I can deliberately trigger agent work on a named repository.
7. As an operator, I want `bridge dispatch <repo> --file task.md` as an alternative to inline title/description, so that I can author complex Tasks in a file.
8. As an operator, I want Bridge to pull the Scotty Vault before every operation, so that context and orders are always fresh.
9. As an operator, I want Bridge to inject `archive/<repo>/index.md` and `archive/<repo>/captains-log.md` as default context on dispatch, so that Claude starts with project knowledge.
10. As an operator, I want to declare optional extra context pages per repo in Mission Orders (`context = ["architecture", ...]`), so that specific repos receive additional Archive pages without wiki-link crawling.
11. As an operator, I want Claude Code stdout/stderr to stream to my terminal during execution, so that I can follow progress in real time.
12. As an operator, I want the Engineering Log to record dispatch outcomes and summaries without replaying streamed output, so that telemetry is concise and durable.
13. As an operator, I want Bridge to auto-commit Engineering Log entries locally after dispatch without pushing, so that outcomes are never lost but I control when remote changes land.
14. As an operator, I want Bridge to fail fast if `claude` is not on PATH when the profile requires Claude Team, so that misconfiguration is caught before work starts.
15. As an operator, I want Bridge to never commit changes in the target repository on my behalf, so that git history in project repos stays under agent or human control.
16. As an operator, I want the Tricorder to run after dispatch when the repo profile declares `verify = "bun"` or `verify = "markdown"`, so that success is externally verified.
17. As an operator, I want Away Team self-reported success to be ignored when a verifier is configured, so that only the Tricorder determines pass/fail.
18. As an operator, I want `bridge dispatch --skip-verify` to bypass Tricorder checks, so that I can bootstrap repos before verifiers are ready.
19. As an operator, I want repos without a `verify` key to skip Tricorder entirely, so that I am not blocked on verification for repos that do not need it.
20. As an operator, I want `BunVerifier` to run `bun test` in the target repo, so that Bun projects are verified with their native test runner.
21. As an operator, I want `MarkdownVerifier` to lint and link-check markdown in the target repo, so that documentation-only repos can be verified.
22. As an operator, I want Tricorder failure to write an Engineering Log entry, send a Discord hail, and exit non-zero, so that failures are recorded and visible.
23. As an operator, I want the target repo worktree left untouched on Tricorder failure, so that I can inspect and fix the broken state.
24. As an operator, I want successful dispatches logged to the Engineering Log without a Discord hail, so that I am not spammed on green runs.
25. As an operator, I want `bridge diagnostic <repo>` to diff the target repo since its last recorded SHA, so that diagnostics focus on what changed.
26. As an operator, I want diagnostic to use Claude to update Starfleet Archive pages for the project, so that fleet knowledge stays current with the codebase.
27. As an operator, I want diagnostic to append an entry to the project's Captain's Log, so that there is a human-readable timeline of knowledge updates.
28. As an operator, I want diagnostic to validate vault markdown (frontmatter completeness, stale `sources`, wiki-link integrity) before commit, so that broken Archive pages never land in git.
29. As an operator, I want diagnostic to commit Archive changes and push the vault, so that knowledge updates reach the remote immediately.
30. As an operator, I want diagnostic to not execute code changes in the target repository, so that knowledge sync is separate from dispatch.
31. As an operator, I want diagnostic failure to hail Discord and exit non-zero, so that broken diagnostics are not silent.
32. As an operator, I want every Archive page to require frontmatter (`entity`, `repo`, `updated`, `sources`), so that fleet knowledge has consistent metadata.
33. As an operator, I want `updated` to use ISO dates (e.g. `2026-06-12`), so that timestamps are human-readable and sortable.
34. As an operator, I want `sources` to reference `repo@sha`, so that Archive pages trace back to the code they describe.
35. As an operator, I want code citations in Archive body text to use `repo@sha path:line` format, so that references are precise and reproducible.
36. As an operator, I want Archive pages to use Obsidian-style `[[wiki-links]]` for cross-references, so that the vault is browsable in Obsidian.
37. As an operator, I want `Scotty Index.md` at the vault root to link all sections and track fleet-wide state, so that the vault has a single entry point.
38. As an operator, I want Mission Orders to contain no secrets, so that the orders directory is safe to commit.
39. As an operator, I want Discord webhook credentials in `DISCORD_WEBHOOK_URL` only, so that tokens never enter git.
40. As an operator, I want `bridge hail` to send a test message to all configured Hailing Frequencies channels, so that I can confirm notifications work.
41. As an operator, I want Discord hails on Away Team crash, Tricorder failure, and diagnostic failure, so that I am alerted when things go wrong.
42. As an operator, I want Bridge compiled to a single `bridge` binary via `bun build --compile`, so that I can install it without a Node runtime.
43. As an operator, I want the Scotty monorepo to use Bun workspaces with Bridge at `packages/bridge/`, so that future Scotty components can be added without restructuring.
44. As an operator, I want re-cloning the Scotty monorepo to restore full Bridge capacity instantly, so that the Shipyard Principle holds — only the vault and env vars matter.
45. As an operator, I want `local.toml` gitignored in the vault's orders section for machine-specific repo paths, so that the same Mission Orders work across machines with different filesystems.
46. As an operator, I want diagnostic to read `last_repo_sha` from project Archive frontmatter or Scotty Index, so that diff baselines are recorded in the vault not a database.
47. As an operator, I want vault layout with `archive/`, `log/`, and `orders/` top-level folders, so that knowledge, telemetry, and config are visually separated in Obsidian.
48. As an operator, I want Bridge to error clearly when a named repo is not in the Duty Roster, so that typos fail fast.
49. As an operator, I want Bridge to error clearly when injected context files are missing, so that dispatch does not proceed with incomplete knowledge.
50. As an operator, I want priority on Tasks to be settable at dispatch time, so that future queue features have a field to grow into.

## Implementation Decisions

### Monorepo layout

- Initialize Bun workspaces at the repo root with `packages/*`.
- Bridge lives at `packages/bridge/` and ships as the `bridge` compiled binary.
- TypeScript strict mode throughout.

### Core interfaces

Bridge is built around small, swappable interfaces. Shapes from the historical spec, refined by domain decisions:

```ts
interface Task {
  id: string;
  repo: string;
  title: string;
  description: string;
  priority: number;
  contextFiles: Array<{ path: string; content: string }>;
}

interface ExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  commitSha?: string;
  durationMs: number;
}

interface AwayTeam {
  id: string;
  execute(task: Task, repoPath: string): Promise<ExecutionResult>;
}

interface VerificationResult {
  passed: boolean;
  summary: string;
  errors?: string[];
  durationMs: number;
}

interface Verifier {
  verify(repoPath: string): Promise<VerificationResult>;
}

interface HailChannel {
  send(message: string): Promise<void>;
}
```

### Dispatch lifecycle

Single pipeline module orchestrates: **Route → Inject Context → Execute → Verify → Update Engineering Log → Notify (on failure)**.

- **Route:** resolve repo name against Duty Roster; load merged Mission Orders.
- **Inject Context:** read default Archive pages plus optional `context` list; populate `Task.contextFiles`.
- **Execute:** delegate to the configured Away Team; stream subprocess output to console.
- **Verify:** run Tricorder if verifier configured and `--skip-verify` not set.
- **Update Engineering Log:** append markdown summary to `log/`; auto-commit vault locally.
- **Notify:** hail Discord on failure only.

Diagnostic is a separate command with its own pipeline: pull vault → diff repo → Claude updates Archive → validate vault markdown → append Captain's Log → commit and push.

### Away Team — Claude Team (Phase 1 only)

- Single implementation: `claude-code` via `claude -p` invoked through `Bun.$`.
- Subprocess stdout/stderr piped to `process.stdout`/`process.stderr` as data arrives.
- Fail fast if `claude` not on PATH.
- CursorTeam deferred.

### Tricorder

- Registry maps `verify` string to verifier implementation.
- Phase 1 verifiers: `bun` (`bun test` in repo path) and `markdown` (lint + link check on target repo markdown).
- No verifier configured → skip verification.
- Away Team `success` field ignored when verifier runs.

### Vault client

- Resolves vault path and remote: env vars override TOML defaults.
- `git pull` before every command.
- After dispatch: write log entry, `git add` + `git commit` locally (no push).
- After diagnostic: `git add` + `git commit` + `git push`.
- `bridge init`: clone remote to path if directory missing; scaffold vault layout and example Mission Orders if empty.

### Mission Orders loader

- Merge order: `orders/mission-orders.toml` + `orders/local.toml` (gitignored overlay).
- Vault section: `[vault] remote` in committed file; `[vault] path` in local overlay.
- Repo profiles: `path`, `agent`, optional `verify`, optional `context` array.
- No secrets in any TOML file.

### Context injection

- Defaults: `archive/<repo>/index.md`, `archive/<repo>/captains-log.md`.
- Extras: filenames from `context` array resolved under `archive/<repo>/`.
- No wiki-link traversal in Phase 1.

### Archive validation (diagnostic only)

- Every Archive page must have frontmatter: `entity`, `repo`, `updated` (ISO date), `sources` (`["repo@sha"]`).
- Reject commit if any field missing or `sources` SHA stale relative to target repo HEAD.
- Validate `[[wiki-links]]` resolve to existing pages within the vault.

### Hailing Frequencies

- Phase 1 channel: Discord via `DISCORD_WEBHOOK_URL` env var.
- `bridge hail` sends test message.
- Hail triggers: Away Team crash, Tricorder failure, diagnostic failure.

### CLI commands (Phase 1 MVP)

| Command | Purpose |
|---------|---------|
| `bridge init` | Clone vault, scaffold layout |
| `bridge roster` | Print Duty Roster |
| `bridge dispatch <repo>` | Run dispatch lifecycle |
| `bridge diagnostic <repo>` | Update Archive from repo diff |
| `bridge hail` | Test notification channels |

### CLI framework

- Use `citty` (or `commander` per historical spec) for command parsing.
- Compiled output: `bun build --compile --minify --target=bun`.

### Domain vocabulary

- All user-facing strings and internal naming follow `CONTEXT.md` at the repo root.
- `scotty.md` is historical reference only; do not treat it as canonical.

## Testing Decisions

### What makes a good test

- Test **external behavior** at the highest seam available — CLI exit codes, vault file mutations, log entries, hail calls — not internal wiring.
- Prefer temp directories with real git repos and fixture vaults over heavy mocking.
- Mock only at system boundaries that are slow or non-deterministic: Claude subprocess, Discord webhook, `bun test` in verifier fixtures.
- Do not assert on implementation details (internal module call order, private functions).

### Proposed test seams (highest first)

1. **CLI integration (primary seam):** invoke `bridge` against a temp Scotty Vault clone and temp target repo. Assert exit code, Engineering Log append, vault git state, and hail invocation. Mock Claude with a shell script on PATH named `claude` that writes predictable output.
2. **Dispatch pipeline:** run the full Route → Inject → Execute → Verify → Log pipeline with injected AwayTeam and Verifier fakes. Assert Task shape, context files loaded, Tricorder gate behavior, and log entry content.
3. **Diagnostic pipeline:** run diff → validate → commit flow with fixture Archive pages and a temp repo with known SHAs. Assert frontmatter validation rejects stale/missing fields.
4. **Mission Orders loader:** table-driven tests for TOML merge, env override precedence, and missing-repo errors.
5. **Vault sync:** temp git repos testing pull-before-op, local-commit-after-dispatch, push-after-diagnostic.
6. **Verifier registry:** fixture repos for `bun` and `markdown` verifiers asserting `VerificationResult` shape.

### Modules under test

- CLI entry and command routing
- Dispatch pipeline orchestrator
- Diagnostic pipeline orchestrator
- Mission Orders loader (merge + env override)
- Vault client (git operations, layout scaffold)
- Context injection resolver
- Archive frontmatter validator
- Tricorder registry and Phase 1 verifiers
- Hailing Frequencies Discord channel
- Claude Team Away Team (subprocess streaming via mock `claude` binary)

### Prior art

- Greenfield — no existing tests. Establish `bun test` convention under `packages/bridge/`.

## Out of Scope

- `bridge status` and `bridge log` commands
- CursorTeam (`@cursor/sdk`) Away Team implementation
- Bun.cron scheduled Diagnostic Cycles (Level 1 / Level 5 automation)
- Ralph Loop and Commendation Engine (task queue, scoring, leaderboard)
- Wiki-link traversal for context injection
- Issue tracker integration for Task creation (`bridge dispatch --issue`)
- SQLite Engineering Log (replaced by markdown in Scotty Vault)
- Additional Tricorder verifiers: Node, Gradle, Go, Terraform
- Slack, Telegram, ntfy Hailing Frequencies channels
- Secrets in Mission Orders or vault git
- Bridge committing changes in target repositories
- Auto-push after dispatch (push only after diagnostic)
- Parallel Away Team execution and cross-agent consensus

## Further Notes

- Canonical domain language: `CONTEXT.md`.
- Historical v3.2 spec: `scotty.md` (may diverge).
- The Scotty Vault is a **new** Obsidian vault to be created; `bridge init` should scaffold the `archive/`, `log/`, `orders/` layout and a starter `Scotty Index.md`.
- Phase 1 agent is Claude Code only; every repo profile should set `agent = "claude-code"` until CursorTeam ships.
- Engineering Log entries should be append-friendly markdown (dated sections) under `log/`, not a replay of streamed console output.
- When Claude is invoked for diagnostic Archive updates, the prompt should include the repo diff, existing Archive pages, frontmatter requirements, and citation format rules from `CONTEXT.md`.
