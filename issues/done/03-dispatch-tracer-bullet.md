# Dispatch tracer bullet (Claude Team + context + Engineering Log)

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Implement `bridge dispatch <repo>` as a complete vertical slice through the dispatch lifecycle — **without Tricorder** (added in issue 04).

Pipeline: **Route → Inject Context → Execute → Update Engineering Log**.

- **Route:** resolve repo from Duty Roster; build `Task` from `--title`/`--description` or `--file`; optional `--priority`.
- **Inject Context:** load `archive/<repo>/index.md` and `archive/<repo>/captains-log.md` plus optional `context` pages from Mission Orders. Error if any required context file is missing.
- **Execute:** Claude Team (`claude-code`) via `claude -p` and `Bun.$`. Stream stdout/stderr to the console in real time. Fail fast if `claude` not on PATH. Bridge does not commit in the target repo.
- **Log:** append a concise outcome summary to `log/` (not streamed output). Auto-commit vault locally; no push.

```ts
interface Task {
  id: string;
  repo: string;
  title: string;
  description: string;
  priority: number;
  contextFiles: Array<{ path: string; content: string }>;
}

interface AwayTeam {
  id: string;
  execute(task: Task, repoPath: string): Promise<ExecutionResult>;
}
```

## Acceptance criteria

- [x] `bridge dispatch <repo> --title "..." --description "..."` runs Claude Team in the target repo path
- [x] `bridge dispatch <repo> --file task.md` loads title/description from file
- [x] `--priority` sets Task priority (default reasonable value)
- [x] Default context files injected; optional `context` list from Mission Orders adds more pages
- [x] Missing context file aborts dispatch with clear error before Claude runs
- [x] Claude stdout/stderr streams to terminal during execution
- [x] Engineering Log entry appended with summary only; vault locally committed; no push
- [x] `claude` missing from PATH → non-zero exit with clear message
- [x] CLI integration test with mock `claude` script on PATH against temp vault + temp repo

## Blocked by

- `issues/02-vault-client-mission-orders-roster.md`

## Comments

Completed 2026-06-12. `SCOTTY_CLAUDE_PATH` overrides Claude binary for integration tests (`Bun.which` does not honor runtime PATH changes). Default Task priority is `0`.
