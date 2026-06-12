# Bootstrap Bridge package with test and typecheck harness

**Status:** ready-for-agent
**Type:** AFK

## What to build

Set up `packages/bridge` as a Bun workspace package with root `test` and `typecheck` scripts. Lift the hail message formatter from the discord-hail prototype as the first tested module — proves the harness works and encodes a real Bridge behavior.

## Acceptance criteria

- [ ] Root `package.json` declares Bun workspaces (`packages/*`)
- [ ] `npm run test` runs `packages/bridge` tests and passes
- [ ] `npm run typecheck` type-checks the bridge package with strict TypeScript
- [ ] `formatHail` formats Discord hail messages with kind label and summary (lifted from prototype)

## Blocked by

None — can start immediately
