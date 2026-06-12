import { test, expect } from "bun:test";
import { renderUsage, runCommand, type ArgsDef, type CommandDef } from "citty";
import { diagnosticCommand } from "./cli/commands/diagnostic";
import { dispatchCommand } from "./cli/commands/dispatch";
import { hailCommand } from "./cli/commands/hail";
import { initCommand } from "./cli/commands/init";
import { rosterCommand } from "./cli/commands/roster";
import { bridgeCommand } from "./cli/main";

const PHASE1_COMMANDS = [
  "init",
  "roster",
  "dispatch",
  "diagnostic",
  "hail",
] as const;

const COMMAND_HELP_CASES = [
  { name: "init", command: initCommand, term: "Scotty Vault" },
  { name: "roster", command: rosterCommand, term: "Duty Roster" },
  { name: "dispatch", command: dispatchCommand, term: "Away Team" },
  { name: "diagnostic", command: diagnosticCommand, term: "Diagnostic Cycle" },
  { name: "hail", command: hailCommand, term: "Hailing Frequencies" },
];

test("bridge --help lists all Phase 1 commands", async () => {
  const usage = await renderUsage(bridgeCommand);

  for (const name of PHASE1_COMMANDS) {
    expect(usage).toContain(name);
  }
});

for (const { name, command, term } of COMMAND_HELP_CASES) {
  test(`bridge ${name} --help uses domain vocabulary`, async () => {
    const usage = await renderUsage(
      command as CommandDef<ArgsDef>,
      bridgeCommand,
    );
    expect(usage).toContain(term);
  });
}

test("bridge hail completes when DISCORD_WEBHOOK_URL is configured", async () => {
  const originalWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const originalFetch = globalThis.fetch;
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/test/token";
  globalThis.fetch = (async () => new Response("", { status: 204 })) as unknown as typeof fetch;

  try {
    await runCommand(bridgeCommand, { rawArgs: ["hail"] });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWebhookUrl === undefined) {
      delete process.env.DISCORD_WEBHOOK_URL;
    } else {
      process.env.DISCORD_WEBHOOK_URL = originalWebhookUrl;
    }
  }
});
