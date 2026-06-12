import { formatHail } from "./format-hail";
import type { HailChannel, HailKind } from "./types";
import { createDiscordChannel } from "./discord-channel";

export class HailConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HailConfigError";
  }
}

let warnedMissingWebhook = false;

export function resetHailWarningsForTests(): void {
  warnedMissingWebhook = false;
}

export function createHailChannels(): HailChannel[] {
  const channel = createDiscordChannel();
  return channel ? [channel] : [];
}

export function warnMissingWebhookOnce(): void {
  if (warnedMissingWebhook) return;
  warnedMissingWebhook = true;
  console.warn(
    "DISCORD_WEBHOOK_URL is not set — skipping Hailing Frequencies notification.",
  );
}

export async function sendTestHail(channels: HailChannel[]): Promise<void> {
  const message = formatHail({
    kind: "test",
    summary: "Hailing Frequencies check from bridge hail.",
  });
  await Promise.all(channels.map((channel) => channel.send(message)));
}

export async function sendFailureHail(params: {
  channels: HailChannel[] | null;
  kind: Exclude<HailKind, "test">;
  repo: string;
  summary: string;
}): Promise<void> {
  if (params.channels === null) {
    warnMissingWebhookOnce();
    return;
  }
  if (params.channels.length === 0) {
    return;
  }

  const message = formatHail({
    kind: params.kind,
    repo: params.repo,
    summary: params.summary,
  });
  await Promise.all(params.channels.map((channel) => channel.send(message)));
}

export async function runBridgeHail(): Promise<void> {
  const channels = createHailChannels();
  if (channels.length === 0) {
    throw new HailConfigError(
      "DISCORD_WEBHOOK_URL is not set. Export it to use Hailing Frequencies.",
    );
  }
  await sendTestHail(channels);
}
