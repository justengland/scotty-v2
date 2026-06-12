import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadMissionOrders } from "./load-mission-orders";

let tempDir: string;
const originalVaultPath = process.env.SCOTTY_VAULT_PATH;
const originalVaultRemote = process.env.SCOTTY_VAULT_REMOTE;

beforeEach(async () => {
  tempDir = join(tmpdir(), `bridge-orders-${crypto.randomUUID()}`);
  await mkdir(join(tempDir, "orders"), { recursive: true });
});

afterEach(async () => {
  delete process.env.SCOTTY_VAULT_PATH;
  delete process.env.SCOTTY_VAULT_REMOTE;
  if (originalVaultPath !== undefined) {
    process.env.SCOTTY_VAULT_PATH = originalVaultPath;
  }
  if (originalVaultRemote !== undefined) {
    process.env.SCOTTY_VAULT_REMOTE = originalVaultRemote;
  }
  await rm(tempDir, { recursive: true, force: true });
});

async function writeOrders(
  mission: string,
  local?: string,
): Promise<void> {
  await writeFile(join(tempDir, "orders", "mission-orders.toml"), mission);
  if (local !== undefined) {
    await writeFile(join(tempDir, "orders", "local.toml"), local);
  }
}

test("merges mission-orders.toml with local.toml repo paths", async () => {
  await writeOrders(
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "claude-code"
verify = "bun"

[repos.beta]
agent = "claude-code"
`,
    `[vault]
path = "${tempDir}"

[repos.alpha]
path = "/tmp/alpha"

[repos.beta]
path = "/tmp/beta"
`,
  );

  const orders = loadMissionOrders(tempDir);

  expect(orders.vault.remote).toBe("git@github.com:example/scotty-vault.git");
  expect(orders.vault.path).toBe(tempDir);
  expect(orders.repos.alpha).toEqual({
    agent: "claude-code",
    verify: "bun",
    path: "/tmp/alpha",
  });
  expect(orders.repos.beta).toEqual({
    agent: "claude-code",
    path: "/tmp/beta",
  });
});

test("env vars override TOML vault path and remote", async () => {
  await writeOrders(
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "claude-code"
`,
    `[vault]
path = "${tempDir}"

[repos.alpha]
path = "/tmp/alpha"
`,
  );

  process.env.SCOTTY_VAULT_PATH = tempDir;
  process.env.SCOTTY_VAULT_REMOTE = "git@github.com:override/remote.git";

  const { loadResolvedMissionOrders } = await import("../vault/resolve-vault-config");
  const orders = loadResolvedMissionOrders();

  expect(orders.vault.path).toBe(tempDir);
  expect(orders.vault.remote).toBe("git@github.com:override/remote.git");
});

test("resolveVaultPath reads path from machine local.toml when env unset", async () => {
  const { resolveVaultPath } = await import("../vault/resolve-vault-config");

  await mkdir(join(tempDir, ".config", "scotty", "orders"), {
    recursive: true,
  });
  await writeFile(
    join(tempDir, ".config", "scotty", "orders", "local.toml"),
    `[vault]
path = "${tempDir}/from-local"
`,
  );

  expect(resolveVaultPath({ HOME: tempDir })).toBe(`${tempDir}/from-local`);
});
