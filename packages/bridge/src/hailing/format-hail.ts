import type { HailKind } from "./types";

export type { HailKind };

const KIND_LABEL: Record<HailKind, string> = {
  test: "Test hail",
  "away-team-crash": "Away Team crash",
  "tricorder-failure": "Tricorder failure",
  "diagnostic-failure": "Diagnostic failure",
};

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
