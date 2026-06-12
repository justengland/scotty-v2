import { beforeEach, afterEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readEngineeringLog } from "./read-log";

let tempRoot: string;
let vaultPath: string;

beforeEach(async () => {
  tempRoot = join(tmpdir(), `log-read-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  await mkdir(join(vaultPath, "log"), { recursive: true });
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

test("readEngineeringLog returns entries newest-first across dated files", async () => {
  await writeFile(
    join(vaultPath, "log", "2026-06-10.md"),
    `## dispatch: alpha — older

- **Repo:** alpha
- **Task:** Old task
- **Priority:** 1
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** Old run.
`
  );
  await writeFile(
    join(vaultPath, "log", "2026-06-12.md"),
    `## dispatch: beta — newer

- **Repo:** beta
- **Task:** New task
- **Priority:** 3
- **Outcome:** failure
- **Duration:** 200ms
- **Summary:** Failed run.
- **Tricorder:** failed
- **Verification:** bun test failed
`
  );

  const entries = await readEngineeringLog(vaultPath);

  expect(entries).toHaveLength(2);
  expect(entries[0]!.repo).toBe("beta");
  expect(entries[1]!.repo).toBe("alpha");
});

test("readEngineeringLog filters by repo, since, and limit", async () => {
  await writeFile(
    join(vaultPath, "log", "2026-06-01.md"),
    `## dispatch: alpha — a1

- **Repo:** alpha
- **Task:** Alpha one
- **Priority:** 1
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** First.
`
  );
  await writeFile(
    join(vaultPath, "log", "2026-06-11.md"),
    `## dispatch: alpha — a2

- **Repo:** alpha
- **Task:** Alpha two
- **Priority:** 2
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** Second.

## dispatch: beta — b1

- **Repo:** beta
- **Task:** Beta one
- **Priority:** 1
- **Outcome:** success
- **Duration:** 100ms
- **Summary:** Beta run.
`
  );

  const entries = await readEngineeringLog(vaultPath, {
    repo: "alpha",
    since: "2026-06-10",
    limit: 1,
  });

  expect(entries).toHaveLength(1);
  expect(entries[0]!.taskTitle).toBe("Alpha two");
});

test("readEngineeringLog returns empty array when log directory is empty", async () => {
  const entries = await readEngineeringLog(vaultPath);
  expect(entries).toEqual([]);
});
