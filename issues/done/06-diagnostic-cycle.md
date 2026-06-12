# Diagnostic cycle

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Implement `bridge diagnostic <repo>` as a separate pipeline from dispatch. Updates fleet knowledge; does not execute code changes in the target repo.

Pipeline: pull vault → read last repo SHA from Archive frontmatter or Scotty Index → diff target repo → invoke Claude to update Archive pages → append Captain's Log → validate vault markdown → commit and push vault.

**Validation before commit:**
- Every Archive page has frontmatter: `entity`, `repo`, `updated` (ISO date), `sources` (`["repo@sha"]`).
- Reject if any field missing or `sources` SHA stale vs target repo HEAD.
- `[[wiki-links]]` must resolve to existing vault pages.

**On failure:** Discord hail (from issue 05) + non-zero exit.

## Acceptance criteria

- [x] `bridge diagnostic <repo>` diffs repo since last recorded SHA in Archive frontmatter
- [x] Claude invoked with diff + existing Archive pages + frontmatter/citation rules from `CONTEXT.md`
- [x] Archive pages updated under `archive/<repo>/`
- [x] `archive/<repo>/captains-log.md` appended with dated entry
- [x] Validation rejects missing frontmatter, stale `sources`, or broken wiki-links
- [x] Successful diagnostic commits and **pushes** vault (unlike dispatch)
- [x] Diagnostic does not modify the target repository code
- [x] Diagnostic failure hails Discord and exits non-zero
- [x] Tests use fixture vault + fixture repo with known SHAs; mock Claude subprocess

## Blocked by

- `issues/05-hailing-frequencies.md`

## Next iteration

- Harden Phase 1 with integration tests and compiled binary polish (`issues/07-integration-tests-binary-polish.md`)
