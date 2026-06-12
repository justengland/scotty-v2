# CursorTeam Away Team

**Status:** done
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 (`CONTEXT.md`: CursorTeam; PRD out of scope).

## What to build

Second Away Team implementation selectable via Mission Orders `agent = "cursor"`. Full dispatch lifecycle unchanged: Route → Inject Context → Execute → Tricorder → Engineering Log → hail on failure.

CursorTeam invokes the Cursor SDK (`@cursor/sdk`) with **local runtime** against the target repo path. Console streaming when enabled. Away Team registry resolves `cursor` alongside existing `claude-code`.

**Environment configuration** (from repo `.env-template` — do not invent alternate names):

| Variable                   | Role                                                             |
| -------------------------- | ---------------------------------------------------------------- |
| `CURSOR_API_KEY`           | Required — fail fast with clear message if missing               |
| `SCOTTY_CURSOR_MODEL`      | Model id (default `composer-2.5`)                                |
| `SCOTTY_CURSOR_STREAM_LOG` | When `1`, stream SDK output to console (default on per template) |
| `SCOTTY_CURSOR_RUNTIME`    | Runtime selector (default `node`)                                |
| `SCOTTY_NODE_BIN`          | Optional Node binary override when runtime is `node`             |
| `SCOTTY_CURSOR_CWD`        | Optional cwd override; target repo path wins when unset          |

Out of scope for this slice: `SCOTTY_CURSOR_PROMPT`, `SCOTTY_CURSOR_RESUME_PROMPT`, `SCOTTY_BRAIN`, `SCOTTY_BRAIN_SKILL_MAP` (interactive brain / skill routing), Gmail, WhatsApp, whisper.

Tests mock the SDK boundary — no real API calls in CI.

## Acceptance criteria

- [x] Mission Orders `agent = "cursor"` routes dispatch to CursorTeam
- [x] Missing `CURSOR_API_KEY` aborts before SDK call with clear error
- [x] Model, streaming, runtime, and node bin read from `SCOTTY_CURSOR_*` env vars per `.env-template`
- [x] Task prompt includes title, description, and injected Archive context (same shape as Claude Team)
- [x] Tricorder gate, Engineering Log append, and failure hails behave identically to Claude Team dispatch
- [x] Dispatch integration test with mocked SDK; no network in CI
- [x] `.env-template` remains the canonical env reference (no duplicate env docs with conflicting names)

## Blocked by

None — can start immediately

## Completed

2026-06-12. Added `resolveAwayTeam` registry, `createCursorTeam` with dynamic `@cursor/sdk` import (keeps compiled binary lean), shared `buildTaskPrompt`, and env-driven config from `.env-template`. Dispatch resolves Away Team from Mission Orders agent profile; tests mock SDK at boundary.
