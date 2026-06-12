import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runCommand } from "citty";
import { bridgeCommand } from "./cli/main";

let tempRoot: string;
let vaultPath: string;
let stdout: string[];
let originalEnv: Record<string, string | undefined>;

beforeEach(async () => {
  stdout = [];
  originalEnv = {
    SCOTTY_VAULT_PATH: process.env.SCOTTY_VAULT_PATH,
    SCOTTY_VAULT_REMOTE: process.env.SCOTTY_VAULT_REMOTE,
    HOME: process.env.HOME,
  };

  tempRoot = join(tmpdir(), `bridge-cli-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  process.env.HOME = tempRoot;
  process.env.SCOTTY_VAULT_PATH = vaultPath;
  process.env.SCOTTY_VAULT_REMOTE = "git@github.com:example/scotty-vault.git";

  const log = (...args: unknown[]) => {
    stdout.push(args.map(String).join(" "));
  };
  console.log = log as typeof console.log;
  console.error = log as typeof console.error;
});

afterEach(async () => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  await rm(tempRoot, { recursive: true, force: true });
});

async function writeOrders(): Promise<void> {
  await mkdir(join(vaultPath, "orders"), { recursive: true });
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "claude-code"
verify = "bun"

[repos.beta]
agent = "claude-code"
`,
  );
  await writeFile(
    join(vaultPath, "orders", "local.toml"),
    `[vault]
path = "${vaultPath}"

[repos.alpha]
path = "/tmp/alpha"

[repos.beta]
path = "/tmp/beta"
`,
  );
}

test("bridge init scaffolds an empty vault directory", async () => {
  await mkdir(vaultPath, { recursive: true });

  await runCommand(bridgeCommand, { rawArgs: ["init"] });

  const output = stdout.join("\n");
  expect(output).toContain("Scaffolded Scotty Vault");
  expect(await Bun.file(join(vaultPath, "Scotty Index.md")).exists()).toBe(true);
});

test("bridge roster prints Duty Roster entries", async () => {
  await writeOrders();
  await mkdir(join(vaultPath, "archive"), { recursive: true });
  await Bun.$`git init`.cwd(vaultPath).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["roster"] });

  const output = stdout.join("\n");
  expect(output).toContain("Duty Roster");
  expect(output).toContain("alpha");
  expect(output).toContain("verify: bun");
  expect(output).toContain("path: /tmp/alpha");
});

test("bridge roster errors for unknown repo", async () => {
  await writeOrders();
  await mkdir(join(vaultPath, "archive"), { recursive: true });
  await Bun.$`git init`.cwd(vaultPath).quiet();

  await runCommand(bridgeCommand, { rawArgs: ["roster", "missing"] });

  const output = stdout.join("\n");
  expect(output).toContain('Repository "missing" is not on the Duty Roster');
});
