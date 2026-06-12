#!/usr/bin/env bun
/**
 * PROTOTYPE — Discord Hailing Frequencies
 *
 * Question: Can Scotty send failure hails to Discord via webhook with the
 * message shape Bridge will use (test + three failure triggers)?
 *
 * Run: bun run prototype:discord-hail
 * Requires: DISCORD_WEBHOOK_URL in env or .env (Bun loads automatically)
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import {
  createDiscordChannel,
  createInitialHailState,
  hail,
  setRepo,
  type HailKind,
  type HailState,
} from "./hail-channel.ts";

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;

function render(state: HailState): void {
  console.clear();
  console.log(bold("Scotty · Discord hail prototype"));
  console.log(dim("Question: does the webhook path work for Bridge hails?\n"));

  console.log(bold("State"));
  console.log(
    `  webhook: ${
      state.webhookConfigured
        ? green("configured")
        : red("missing — set DISCORD_WEBHOOK_URL")
    }`,
  );
  if (state.webhookPreview) {
    console.log(`  url:     ${dim(state.webhookPreview)}`);
  }
  console.log(`  repo:    ${state.repo}`);
  console.log(`  last:    ${state.lastKind ?? dim("(none)")}`);

  if (state.lastResult) {
    const { ok, status, statusText, sentAt } = state.lastResult;
    const statusLine = ok
      ? green(`${status} ${statusText}`)
      : red(`${status} ${statusText}`);
    console.log(`  result:  ${statusLine} ${dim(`@ ${sentAt}`)}`);
  } else {
    console.log(`  result:  ${dim("(none)")}`);
  }

  if (state.lastMessage) {
    console.log(`\n${bold("Last message")}`);
    for (const line of state.lastMessage.split("\n")) {
      console.log(`  ${line}`);
    }
  }

  console.log(`\n${bold("Actions")}`);
  console.log(
    [
      dim("[t] test hail"),
      dim("[1] away team crash"),
      dim("[2] tricorder failure"),
      dim("[3] diagnostic failure"),
      dim("[r] set repo"),
      dim("[q] quit"),
    ].join("  "),
  );
}

async function promptRepo(current: string): Promise<string> {
  const rl = readline.createInterface({ input, output });
  const answer = await rl.question(`Repo name (${current}): `);
  rl.close();
  return answer.trim() || current;
}

async function dispatch(
  state: HailState,
  channel: NonNullable<ReturnType<typeof createDiscordChannel>>,
  kind: HailKind,
): Promise<HailState> {
  render(state);
  process.stdout.write(dim("\nSending…\n"));
  return hail(state, channel, kind);
}

async function main(): Promise<void> {
  let state = createInitialHailState();
  const channel = createDiscordChannel();

  if (!channel) {
    render(state);
    console.log(
      `\n${red("No webhook configured.")} Export DISCORD_WEBHOOK_URL and re-run.`,
    );
    process.exit(1);
  }

  render(state);

  const rl = readline.createInterface({ input, output });

  while (true) {
    const key = (await rl.question("\n> ")).trim().toLowerCase();

    if (key === "q") break;

    if (key === "r") {
      const repo = await promptRepo(state.repo);
      state = setRepo(state, repo);
      render(state);
      continue;
    }

    const kindMap: Record<string, HailKind> = {
      t: "test",
      "1": "away-team-crash",
      "2": "tricorder-failure",
      "3": "diagnostic-failure",
    };

    const kind = kindMap[key];
    if (!kind) {
      render(state);
      console.log(dim("Unknown action — use t, 1, 2, 3, r, or q."));
      continue;
    }

    state = await dispatch(state, channel, kind);
    render(state);
  }

  rl.close();
  console.log(dim("\nDone."));
}

main().catch((error) => {
  console.error(red(String(error)));
  process.exit(1);
});
