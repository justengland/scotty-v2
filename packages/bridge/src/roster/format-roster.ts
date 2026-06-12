import type { MissionOrders } from "../mission-orders/types";

export function formatDutyRoster(orders: MissionOrders): string {
  const lines = ["Duty Roster", ""];

  const names = Object.keys(orders.repos).sort();
  for (const name of names) {
    const profile = orders.repos[name]!;
    const verify = profile.verify ?? "(none)";
    const path = profile.path ?? "(unset)";
    lines.push(`${name}`);
    lines.push(`  agent: ${profile.agent}`);
    lines.push(`  verify: ${verify}`);
    lines.push(`  path: ${path}`);
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
