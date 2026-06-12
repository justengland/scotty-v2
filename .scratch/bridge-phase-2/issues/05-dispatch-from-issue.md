# Dispatch from issue markdown

**Status:** ready-for-agent
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 PRD (`bridge dispatch --issue`).

## What to build

Source Tasks from local markdown issue files instead of inline `--title` / `--description`.

`bridge dispatch <repo> --issue <path>` reads a markdown issue (`.scratch/<feature>/issues/*.md` or `issues/*.md` layout): title from the first H1, description from the **What to build** section body. `--file` and inline title/description remain available; `--issue` is mutually exclusive with inline title/description.

Rest of dispatch lifecycle unchanged (context injection, Away Team, Tricorder, Engineering Log). Clear errors for missing files, empty sections, or malformed issue shape.

## Acceptance criteria

- [ ] `bridge dispatch <repo> --issue path/to/issue.md` builds Task from issue markdown
- [ ] Title from H1; description from **What to build** section
- [ ] Mutually exclusive with `--title`/`--description`; clear error if both provided
- [ ] Full dispatch pipeline runs (integration test with mock Away Team)
- [ ] Works with repos using `claude-code` or `cursor` agent profiles

## Blocked by

None — can start immediately
