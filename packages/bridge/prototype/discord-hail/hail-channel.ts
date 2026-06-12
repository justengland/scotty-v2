/** PROTOTYPE — lift into packages/bridge/src/hailing/ when validated. */

export type HailKind =
  | "test"
  | "away-team-crash"
  | "tricorder-failure"
  | "diagnostic-failure";

export interface HailState {
  webhookConfigured: boolean;
  webhookPreview: string | null;
  repo: string;
  lastKind: HailKind | null;
  lastMessage: string | null;
  lastResult: HailSendResult | null;
}

export interface HailSendResult {
  ok: boolean;
  status: number;
  statusText: string;
  sentAt: string;
}

export interface HailChannel {
  send(message: string): Promise<HailSendResult>;
}

const KIND_LABEL: Record<HailKind, string> = {
  test: "Test hail",
  "away-team-crash": "Away Team crash",
  "tricorder-failure": "Tricorder failure",
  "diagnostic-failure": "Diagnostic failure",
};

export function maskWebhookUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/");
    const token = parts.at(-1);
    if (token && token.length > 8) {
      parts[parts.length - 1] = `${token.slice(0, 4)}…${token.slice(-4)}`;
      parsed.pathname = parts.join("/");
    }
    return parsed.toString();
  } catch {
    return "(invalid URL)";
  }
}

export function resolveWebhookUrl(): string | null {
  const url = process.env.DISCORD_WEBHOOK_URL?.trim();
  return url ? url : null;
}

export function createInitialHailState(): HailState {
  const webhookUrl = resolveWebhookUrl();
  return {
    webhookConfigured: webhookUrl !== null,
    webhookPreview: webhookUrl ? maskWebhookUrl(webhookUrl) : null,
    repo: "starbase-api",
    lastKind: null,
    lastMessage: null,
    lastResult: null,
  };
}

export function formatHail(params: {
  kind: HailKind;
  repo?: string;
  summary: string;
}): string {
  const label = KIND_LABEL[params.kind];
  const lines = ["🚨 **Scotty Hail**", `**${label}**`];

  if (params.repo) {
    lines.push(`Repo: \`${params.repo}\``);
  }

  lines.push("", params.summary);
  return lines.join("\n");
}

export function defaultSummary(kind: HailKind, repo: string): string {
  switch (kind) {
    case "test":
      return "Hailing Frequencies check from discord-hail prototype.";
    case "away-team-crash":
      return "Claude Code exited non-zero before returning a result.";
    case "tricorder-failure":
      return "`bun test` failed — 2 failing, 14 passing.";
    case "diagnostic-failure":
      return "Archive validation failed: missing `sources` frontmatter on index.md.";
  }
}

export class DiscordWebhookChannel implements HailChannel {
  constructor(private readonly webhookUrl: string) {}

  async send(message: string): Promise<HailSendResult> {
    const sentAt = new Date().toISOString();
    const response = await fetch(this.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: message,
        username: "Scotty",
      }),
    });

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      sentAt,
    };
  }
}

export function createDiscordChannel(): DiscordWebhookChannel | null {
  const url = resolveWebhookUrl();
  return url ? new DiscordWebhookChannel(url) : null;
}

export async function hail(
  state: HailState,
  channel: HailChannel,
  kind: HailKind,
): Promise<HailState> {
  const summary = defaultSummary(kind, state.repo);
  const message = formatHail({
    kind,
    repo: kind === "test" ? undefined : state.repo,
    summary,
  });
  const lastResult = await channel.send(message);

  return {
    ...state,
    lastKind: kind,
    lastMessage: message,
    lastResult,
  };
}

export function setRepo(state: HailState, repo: string): HailState {
  const trimmed = repo.trim();
  if (!trimmed) return state;
  return { ...state, repo: trimmed };
}
