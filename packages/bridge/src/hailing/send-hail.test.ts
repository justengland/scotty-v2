import { afterEach, beforeEach, expect, test } from "bun:test";
import { createDiscordChannel } from "./discord-channel";
import { sendTestHail } from "./send-hail";
import type { HailChannel } from "./types";

const originalFetch = globalThis.fetch;
const originalWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

beforeEach(() => {
  process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/123/token";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWebhookUrl === undefined) {
    delete process.env.DISCORD_WEBHOOK_URL;
  } else {
    process.env.DISCORD_WEBHOOK_URL = originalWebhookUrl;
  }
});

test("sendTestHail sends formatted test message to all channels", async () => {
  const sent: string[] = [];
  const channel: HailChannel = {
    async send(message) {
      sent.push(message);
    },
  };

  await sendTestHail([channel]);

  expect(sent).toHaveLength(1);
  expect(sent[0]).toContain("Scotty Hail");
  expect(sent[0]).toContain("Test hail");
  expect(sent[0]).toContain("Hailing Frequencies check");
});

test("createDiscordChannel returns channel when webhook URL is set", () => {
  expect(createDiscordChannel()).not.toBeNull();
});

test("sendTestHail uses Discord webhook when configured", async () => {
  let capturedBody = "";
  globalThis.fetch = (async (_url, init) => {
    capturedBody = String(init?.body);
    return new Response("", { status: 204 });
  }) as typeof fetch;

  const channel = createDiscordChannel();
  expect(channel).not.toBeNull();
  await sendTestHail([channel!]);

  const payload = JSON.parse(capturedBody);
  expect(payload.content).toContain("Scotty Hail");
  expect(payload.username).toBe("Scotty");
});
