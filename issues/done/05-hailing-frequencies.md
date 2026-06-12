# Hailing Frequencies (Discord)

**Status:** done
**Type:** AFK

## Parent

`.scratch/bridge-phase-1/PRD.md`

## What to build

Implement Hailing Frequencies for failure notifications.

- `DiscordChannel` reads `DISCORD_WEBHOOK_URL` from environment (never from Mission Orders or vault git).
- `bridge hail` sends a test message to all configured channels.
- Wire hails into dispatch: Away Team crash, Tricorder failure.
- Successful dispatches log only — no hail.

Reuse or extend `formatHail` from the existing hailing prototype if present.

```ts
interface HailChannel {
  send(message: string): Promise<void>;
}
```

## Acceptance criteria

- [x] `bridge hail` sends a test Discord message when `DISCORD_WEBHOOK_URL` is set
- [x] Missing webhook URL → clear error on `bridge hail`; other commands skip hail silently or warn once
- [x] Away Team crash during dispatch triggers Discord hail + non-zero exit
- [x] Tricorder failure triggers Discord hail + non-zero exit
- [x] Successful dispatch does not hail
- [x] Hail message includes repo name, failure kind, and summary
- [x] Tests mock Discord webhook HTTP; no real network calls in CI

## Blocked by

- `issues/04-tricorder-gate.md`

## Next iteration

- Wire hails into diagnostic cycle failures (`issues/06-diagnostic-cycle.md`)
