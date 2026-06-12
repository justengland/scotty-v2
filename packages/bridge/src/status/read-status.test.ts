import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFleetStatus } from "./read-status";

let tempRoot: string;
let vaultPath: string;

beforeEach(async () => {
  tempRoot = join(tmpdir(), `status-read-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  await mkdir(join(vaultPath, "log"), { recursive: true });
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test("readFleetStatus returns last dispatch outcome and archive metadata per repo", async () => {
  await writeFile(
    join(vaultPath, "log", "2026-06-12.md"),
    `## dispatch: alpha — task-1

- **Repo:** alpha
- **Task:** Alpha task
- **Priority:** 1
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** Alpha succeeded.

## dispatch: beta — task-2

- **Repo:** beta
- **Task:** Beta task
- **Priority:** 2
- **Outcome:** failure
- **Duration:** 200ms
- **Summary:** Beta failed.
`
  );

  const alphaArchive = join(vaultPath, "archive", "alpha");
  await mkdir(alphaArchive, { recursive: true });
  await writeFile(
    join(alphaArchive, "index.md"),
    `---
entity: alpha-service
repo: alpha
updated: 2026-06-10
sources: ["alpha@abc123def456"]
---
# Alpha index
`
  );

  const status = await readFleetStatus(vaultPath, ["alpha", "beta", "gamma"]);

  expect(status).toHaveLength(3);
  expect(status[0]).toEqual({
    repo: "alpha",
    lastDispatchOutcome: "success",
    lastDispatchDate: "2026-06-12",
    lastSourcesSha: "abc123def456",
    lastDiagnosticStardate: "2026-06-10",
  });
  expect(status[1]).toEqual({
    repo: "beta",
    lastDispatchOutcome: "failure",
    lastDispatchDate: "2026-06-12",
    lastSourcesSha: undefined,
    lastDiagnosticStardate: undefined,
  });
  expect(status[2]).toEqual({
    repo: "gamma",
    lastDispatchOutcome: undefined,
    lastDispatchDate: undefined,
    lastSourcesSha: undefined,
    lastDiagnosticStardate: undefined,
  });
});
