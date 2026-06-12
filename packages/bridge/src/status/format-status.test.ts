import { expect, test } from "bun:test";
import { formatFleetStatus } from "./format-status";
import type { RepoStatus } from "./read-status";

test("formatFleetStatus prints aligned table with placeholders for missing data", () => {
  const statuses: RepoStatus[] = [
    {
      repo: "alpha",
      lastDispatchOutcome: "success",
      lastDispatchDate: "2026-06-12",
      lastSourcesSha: "abc123def456",
      lastDiagnosticStardate: "2026-06-10",
    },
    {
      repo: "beta",
      lastDispatchOutcome: "failure",
      lastDispatchDate: "2026-06-12",
    },
    {
      repo: "gamma",
    },
  ];

  const output = formatFleetStatus(statuses);

  expect(output).toContain("Fleet Status");
  expect(output).toContain("Repo");
  expect(output).toContain("Dispatch");
  expect(output).toContain("Sources");
  expect(output).toContain("Stardate");
  expect(output).toContain("alpha");
  expect(output).toContain("success");
  expect(output).toContain("abc123def456");
  expect(output).toContain("2026-06-10");
  expect(output).toContain("failure");
  expect(output).toContain("(none)");
});
