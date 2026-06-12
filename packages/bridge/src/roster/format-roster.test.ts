import { expect, test } from "bun:test";
import type { MissionOrders } from "../mission-orders/types";
import { formatDutyRoster } from "./format-roster";

test("formatDutyRoster prints agent, verify, and path for each repo", () => {
  const orders: MissionOrders = {
    vault: { path: "/vault", remote: "git@github.com:example/scotty-vault.git" },
    repos: {
      alpha: {
        agent: "claude-code",
        verify: "bun",
        path: "/tmp/alpha",
      },
      beta: {
        agent: "claude-code",
        path: "/tmp/beta",
      },
    },
  };

  const output = formatDutyRoster(orders);

  expect(output).toContain("Duty Roster");
  expect(output).toContain("alpha");
  expect(output).toContain("agent: claude-code");
  expect(output).toContain("verify: bun");
  expect(output).toContain("path: /tmp/alpha");
  expect(output).toContain("verify: (none)");
  expect(output).toContain("path: /tmp/beta");
});
