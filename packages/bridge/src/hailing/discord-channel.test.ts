import { afterEach, beforeEach, expect, test } from "bun:test";
import { DiscordWebhookChannel, resolveDiscordWebhookUrl } from "./discord-channel";

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

test("resolveDiscordWebhookUrl reads DISCORD_WEBHOOK_URL from environment", () => {
  expect(resolveDiscordWebhookUrl()).toBe(
    "https://discord.com/api/webhooks/123/token",
  );
});

test("DiscordWebhookChannel posts JSON to webhook URL", async () => {
  let capturedUrl = "";
  let capturedBody = "";

  globalThis.fetch = (async (url, init) => {
    capturedUrl = String(url);
    capturedBody = String(init?.body);
    return new Response("", { status: 204 });
  }) as typeof fetch;

  const channel = new DiscordWebhookChannel(
    "https://discord.com/api/webhooks/123/token",
  );
  await channel.send("🚨 **Scotty Hail**");

  expect(capturedUrl).toBe("https://discord.com/api/webhooks/123/token");
  expect(JSON.parse(capturedBody)).toEqual({
    content: "🚨 **Scotty Hail**",
    username: "Scotty",
  });
});
