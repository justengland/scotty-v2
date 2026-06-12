import { expect, test } from "bun:test";
import { parseEngineeringLogFile } from "./parse-log";

test("parseEngineeringLogFile extracts dispatch block fields", () => {
  const content = `## dispatch: alpha — task-abc123

- **Repo:** alpha
- **Task:** Fix the widget
- **Priority:** 5
- **Outcome:** success
- **Duration:** 1200ms
- **Summary:** Away Team completed work.
- **Tricorder:** passed
- **Verification:** bun test passed (3 tests)
`;

  const entries = parseEngineeringLogFile(content, "2026-06-12");

  expect(entries).toHaveLength(1);
  expect(entries[0]).toEqual({
    kind: "dispatch",
    date: "2026-06-12",
    repo: "alpha",
    taskId: "task-abc123",
    taskTitle: "Fix the widget",
    priority: 5,
    outcome: "success",
    durationMs: 1200,
    summary: "Away Team completed work.",
    tricorder: "passed",
    verification: "bun test passed (3 tests)",
  });
});
