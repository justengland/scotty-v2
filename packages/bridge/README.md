# Bridge

The Bridge is Scotty's CLI: it orchestrates dispatch and diagnostic cycles against a git-backed **Scotty Vault** (Obsidian notes, Mission Orders, Engineering Log). Phase 2 adds Engineering Log and Fleet Status viewers, CursorTeam as a second Away Team, wiki-link context traversal, and issue-sourced dispatch.

## Operator setup

1. **Install Bun** (for development and building the binary).

2. **Initialize the vault:**

   ```sh
   bridge init
   ```

   `bridge init` clones your vault remote (from Mission Orders) or scaffolds an empty vault with `archive/`, `log/`, and `orders/`.

3. **Configure Mission Orders** in the vault:

   - `orders/mission-orders.toml` — committed fleet config (remote URL, repo profiles, verifiers).
   - `orders/local.toml` — gitignored machine overlay with vault path and repo paths.

4. **Set environment variables** (optional overrides):

   | Variable                   | Purpose                                                    |
   | -------------------------- | ---------------------------------------------------------- |
   | `SCOTTY_VAULT_PATH`        | Vault directory (overrides `local.toml`)                   |
   | `SCOTTY_VAULT_REMOTE`      | Vault git remote (overrides `mission-orders.toml`)         |
   | `DISCORD_WEBHOOK_URL`      | Discord webhook for failure hails                          |
   | `SCOTTY_CLAUDE_PATH`       | Path to `claude` binary (default: `claude` on `PATH`)      |
   | `CURSOR_API_KEY`           | Required when Mission Orders sets `agent = "cursor"`       |
   | `SCOTTY_CURSOR_MODEL`      | Cursor model id (default: `composer-2.5`)                  |
   | `SCOTTY_CURSOR_STREAM_LOG` | When `1`, stream Cursor SDK output to console (default on) |
   | `SCOTTY_CURSOR_RUNTIME`    | Cursor runtime selector (default: `node`)                  |
   | `SCOTTY_NODE_BIN`          | Optional Node binary when runtime is `node`                |
   | `SCOTTY_CURSOR_CWD`        | Optional cwd override; target repo path wins when unset    |

   Canonical env names live in the repo root `.env-template` (Brain section). Out of scope for Bridge dispatch: `SCOTTY_CURSOR_PROMPT`, `SCOTTY_CURSOR_RESUME_PROMPT`, `SCOTTY_BRAIN`, `SCOTTY_BRAIN_SKILL_MAP`.

5. **First dispatch:**

   ```sh
   bridge roster
   bridge dispatch alpha --title "Fix the widget" --description "Repair the broken widget."
   ```

   Bridge pulls the vault, injects Archive context (with optional wiki-link traversal), runs the configured Away Team (`claude-code` or `cursor`), runs the Tricorder when configured, and appends an Engineering Log entry (local commit only — no push).

## Build the binary

From the monorepo root:

```sh
bun run build:bridge
```

Or from this package:

```sh
bun run build
```

The compiled executable is written to `dist/bridge`. It runs without a separate Bun install:

```sh
./dist/bridge --help
```

## Testing

Run the full Bridge test suite from the monorepo root:

```sh
bun test packages/bridge
```

Or:

```sh
npm run test
```

Integration tests use temp vaults and repos with mocked external services — no real Claude, Cursor API, or Discord calls.

### Mock `claude` for local dev and CI

Integration tests replace Claude with a shell script on `PATH`. The pattern:

1. Create a temp `bin/` directory and prepend it to `PATH`.
2. Write an executable `claude` script that prints predictable output or updates fixture files.
3. Optionally set `SCOTTY_CLAUDE_PATH` to the script path (dispatch/diagnostic honor this seam).

**Dispatch mock** (runs in the target repo):

```sh
#!/bin/sh
echo "mock-claude: executed"
echo "cwd=$(pwd)"
exit 0
```

**Diagnostic mock** (runs in the vault; uses `SCOTTY_TEST_REPO_PATH` for HEAD SHA):

```sh
#!/bin/sh
HEAD=$(git -C "$SCOTTY_TEST_REPO_PATH" rev-parse HEAD)
cat > archive/alpha/index.md <<EOF
---
entity: alpha-service
repo: alpha
updated: 2026-06-12
sources: ["alpha@$HEAD"]
---
# Updated by mock diagnostic
EOF
exit 0
```

**Discord** is mocked by replacing `globalThis.fetch` in tests; set `DISCORD_WEBHOOK_URL` to any URL so the channel resolves.

**Cursor SDK** is mocked by injecting `createAgent` into `createCursorTeam` (see `packages/bridge/src/away-team/cursor-team.test.ts` and `packages/bridge/src/dispatch/run-dispatch.test.ts`). Set `CURSOR_API_KEY` in tests but replace the SDK boundary — no real API calls in CI.

See `packages/bridge/src/cli.integration.test.ts` for full fixtures (`installMockClaude`, `installMockDiagnosticClaude`, `installMockDiscordWebhook`).

## Commands

| Command                    | Purpose                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| `bridge init`              | Clone or scaffold the Scotty Vault                                 |
| `bridge roster`            | Print the Duty Roster from Mission Orders                          |
| `bridge dispatch <repo>`   | Run the dispatch lifecycle                                         |
| `bridge diagnostic <repo>` | Update Archive from repo diff                                      |
| `bridge hail`              | Send a test Discord hail                                           |
| `bridge log`               | Print Engineering Log entries (`--repo`, `--since`, `--limit`)     |
| `bridge status`            | Print fleet health — last dispatch, sources SHA, stardate per repo |

### Dispatch options (Phase 2)

| Flag                        | Purpose                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `--title` / `--description` | Inline Task title and body                                                                                                  |
| `--file`                    | Task from markdown file (`#` heading = title)                                                                               |
| `--issue`                   | Task from issue markdown (H1 title + `## What to build` body; mutually exclusive with `--title`, `--description`, `--file`) |
| `--priority`                | Task priority (default `0`)                                                                                                 |
| `--context-depth`           | Wiki-link traversal depth for Archive context (overrides Mission Orders `contextDepth`)                                     |
| `--skip-verify`             | Bypass Tricorder verification                                                                                               |

Mission Orders selects the Away Team per repo: `agent = "claude-code"` (Claude Team) or `agent = "cursor"` (CursorTeam via `@cursor/sdk`).
