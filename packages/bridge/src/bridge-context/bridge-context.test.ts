import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { VaultGitOps } from "../vault/vault-client";
import { VaultConfigError } from "../vault/resolve-vault-config";
import type { MissionOrders } from "../mission-orders/types";
import { prepareBridgeSession, resolveRosterRepo } from "./bridge-context";

let tempRoot: string;
let vaultPath: string;
let env: NodeJS.ProcessEnv;
let pullCalls: string[];

beforeEach(async () => {
  tempRoot = join(tmpdir(), `bridge-context-test-${crypto.randomUUID()}`);
  vaultPath = join(tempRoot, "vault");
  await mkdir(join(vaultPath, "orders"), { recursive: true });
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "git@github.com:example/scotty-vault.git"

[repos.alpha]
agent = "claude-code"
path = "/tmp/alpha"
verify = "bun"
`
  );
  await Bun.$`git init`.cwd(vaultPath).quiet();
  env = {
    SCOTTY_VAULT_PATH: vaultPath,
    SCOTTY_VAULT_REMOTE: "git@github.com:example/scotty-vault.git",
  };
  pullCalls = [];
});

afterEach(async () => {
  await rm(tempRoot, { recursive: true, force: true });
});

function fakeGitOps(): VaultGitOps {
  return {
    async clone() {},
    async pull(path) {
      pullCalls.push(path);
    },
    async init() {},
  };
}

test("prepareBridgeSession syncs vault and returns merged Mission Orders", async () => {
  const session = await prepareBridgeSession({
    env,
    gitOps: fakeGitOps(),
  });

  expect(pullCalls).toEqual([vaultPath]);
  expect(session.vaultPath).toBe(vaultPath);
  expect(session.orders.vault.path).toBe(vaultPath);
  expect(session.orders.vault.remote).toBe(
    "git@github.com:example/scotty-vault.git"
  );
  expect(session.orders.repos.alpha?.agent).toBe("claude-code");
  expect(session.orders.repos.alpha?.path).toBe("/tmp/alpha");
});

const sampleOrders: MissionOrders = {
  vault: {
    path: "/vault",
    remote: "git@github.com:example/scotty-vault.git",
  },
  repos: {
    alpha: {
      agent: "claude-code",
      verify: "bun",
      path: "/tmp/alpha",
    },
    "no-path": {
      agent: "claude-code",
    },
  },
};

test("resolveRosterRepo returns validated profile for known repo", () => {
  const { name, profile } = resolveRosterRepo(sampleOrders, "alpha");
  expect(name).toBe("alpha");
  expect(profile.path).toBe("/tmp/alpha");
});

test("resolveRosterRepo errors for unknown repo", () => {
  expect(() => resolveRosterRepo(sampleOrders, "missing")).toThrow(
    VaultConfigError
  );
  expect(() => resolveRosterRepo(sampleOrders, "missing")).toThrow(
    'Repository "missing" is not on the Duty Roster'
  );
});

test("resolveRosterRepo errors when rostered repo has no local path", () => {
  expect(() => resolveRosterRepo(sampleOrders, "no-path")).toThrow(
    VaultConfigError
  );
  expect(() => resolveRosterRepo(sampleOrders, "no-path")).toThrow(
    'Repository "no-path" has no local path in Mission Orders.'
  );
});
