import { test, expect } from "bun:test";
import { parseIssueFile } from "./parse-issue-file";
import { DispatchError } from "./errors";

const sampleIssue = `# Dispatch from issue markdown

**Status:** ready-for-agent
**Type:** AFK

## Parent

Phase 2 — deferred from Phase 1 PRD.

## What to build

Source Tasks from local markdown issue files instead of inline \`--title\` / \`--description\`.

Rest of dispatch lifecycle unchanged.

## Acceptance criteria

- [ ] \`bridge dispatch <repo> --issue path/to/issue.md\` builds Task from issue markdown
`;

test("parseIssueFile reads title from first H1", () => {
  const result = parseIssueFile(sampleIssue);

  expect(result.title).toBe("Dispatch from issue markdown");
});

test("parseIssueFile reads description from What to build section", () => {
  const result = parseIssueFile(sampleIssue);

  expect(result.description).toBe(
    "Source Tasks from local markdown issue files instead of inline `--title` / `--description`.\n\nRest of dispatch lifecycle unchanged."
  );
});

test("parseIssueFile throws when file is empty", () => {
  expect(() => parseIssueFile("   \n")).toThrow(DispatchError);
  expect(() => parseIssueFile("   \n")).toThrow("Issue file is empty.");
});

test("parseIssueFile throws when H1 is missing", () => {
  expect(() => parseIssueFile(`## What to build\n\nDo the thing.`)).toThrow(
    "Issue file is missing a title heading (# ...)."
  );
});

test("parseIssueFile throws when What to build section is missing", () => {
  expect(() =>
    parseIssueFile(`# Fix the widget\n\n## Parent\n\nSome context.`)
  ).toThrow('Issue file is missing a "What to build" section.');
});

test("parseIssueFile throws when What to build section is empty", () => {
  expect(() =>
    parseIssueFile(
      `# Fix the widget\n\n## What to build\n\n## Acceptance criteria\n\n- [ ] done`
    )
  ).toThrow('"What to build" section is empty.');
});
