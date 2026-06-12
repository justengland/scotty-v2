import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initVault,
  scaffoldVaultLayout,
  type VaultGitOps,
} from "./vault-client";

let tempRoot: string;
let vaultPath: string;
let bareRemote: string;
const pullCalls: string[] = [];
let originalHome: string | undefined;

const gitOps: VaultGitOps = {
  async clone(remote, path) {
    await Bun.$`git clone ${remote} ${path}`.quiet();
  },
  async pull(path) {
    pullCalls.push(path);
    if (!existsSync(join(path, ".git"))) return;
    const upstream = await Bun.$`git rev-parse --abbrev-ref @{upstream}`
      .cwd(path)
      .quiet()
      .nothrow();
    if (upstream.exitCode !== 0) return;
    await Bun.$`git pull --ff-only`.cwd(path).quiet();
  },
  async init(path) {
    await Bun.$`git init`.cwd(path).quiet();
  },
};

beforeEach(async () => {
  pullCalls.length = 0;
  originalHome = process.env.HOME;
  tempRoot = join(tmpdir(), `bridge-vault-${crypto.randomUUID()}`);
  process.env.HOME = tempRoot;
  vaultPath = join(tempRoot, "vault");
  bareRemote = join(tempRoot, "remote.git");
  await mkdir(tempRoot, { recursive: true });
  await Bun.$`git init --bare -b main ${bareRemote}`.quiet();
});

afterEach(async () => {
  if (originalHome === undefined) {
    delete process.env.HOME;
  } else {
    process.env.HOME = originalHome;
  }
  await rm(tempRoot, { recursive: true, force: true });
});

test("scaffoldVaultLayout creates archive, log, orders, and Scotty Index", async () => {
  await mkdir(vaultPath, { recursive: true });
  await scaffoldVaultLayout(vaultPath);

  expect(existsSync(join(vaultPath, "archive"))).toBe(true);
  expect(existsSync(join(vaultPath, "log"))).toBe(true);
  expect(existsSync(join(vaultPath, "orders"))).toBe(true);
  expect(existsSync(join(vaultPath, "Scotty Index.md"))).toBe(true);
});

test("initVault scaffolds an empty vault directory", async () => {
  await mkdir(vaultPath, { recursive: true });

  const result = await initVault({
    path: vaultPath,
    remote: bareRemote,
    gitOps,
  });

  expect(result.action).toBe("scaffolded");
  expect(existsSync(join(vaultPath, "archive"))).toBe(true);
  expect(existsSync(join(vaultPath, "orders", "mission-orders.toml"))).toBe(
    true,
  );
  expect(existsSync(join(vaultPath, "orders", "local.toml"))).toBe(true);
});

test("initVault clones when vault path is missing", async () => {
  const seedVault = join(tempRoot, "seed");
  await Bun.$`git clone ${bareRemote} ${seedVault}`.quiet();
  await writeFile(
    join(seedVault, "README.md"),
    "# seed vault\n",
  );
  await Bun.$`git add README.md`.cwd(seedVault).quiet();
  await Bun.$`git commit -m seed`.cwd(seedVault).quiet();
  await Bun.$`git branch -M main`.cwd(seedVault).quiet();
  await Bun.$`git push -u origin main`.cwd(seedVault).quiet();

  const result = await initVault({
    path: vaultPath,
    remote: bareRemote,
    gitOps,
  });

  expect(result.action).toBe("cloned");
  expect(existsSync(join(vaultPath, "README.md"))).toBe(true);
});

test("syncVaultBeforeCommand runs git pull on existing vault", async () => {
  const seedVault = join(tempRoot, "seed");
  await Bun.$`git clone ${bareRemote} ${seedVault}`.quiet();
  await writeFile(join(seedVault, "README.md"), "# seed\n");
  await Bun.$`git add README.md`.cwd(seedVault).quiet();
  await Bun.$`git commit -m seed`.cwd(seedVault).quiet();
  await Bun.$`git branch -M main`.cwd(seedVault).quiet();
  await Bun.$`git push -u origin main`.cwd(seedVault).quiet();
  await Bun.$`git clone ${bareRemote} ${vaultPath}`.quiet();

  const { syncVaultBeforeCommand } = await import("./vault-client");
  await syncVaultBeforeCommand(vaultPath, gitOps);

  expect(pullCalls).toEqual([vaultPath]);
});
