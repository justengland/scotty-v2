import type { HailChannel } from "./types";

export function resolveDiscordWebhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  return url ? url : null;
}

export class DiscordWebhookChannel implements HailChannel {
  constructor(private readonly webhookUrl: string) {}

  async send(message: string): Promise<void> {
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,
        username: "Scotty",
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Discord webhook failed: ${response.status} ${response.statusText}`,
      );
    }
  }
}

export function createDiscordChannel(): DiscordWebhookChannel | null {
  const url = resolveDiscordWebhookUrl();
  return url ? new DiscordWebhookChannel(url) : null;
}
