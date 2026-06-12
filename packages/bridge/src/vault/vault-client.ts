import { existsSync, readdirSync } from "node:fs";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const SCOTTY_INDEX = `# Scotty Index

Fleet map and vault entry point.

- [[Starfleet Archive]] — \`archive/\`
- [[Engineering Log]] — \`log/\`
- [[Mission Orders]] — \`orders/\`
`;

export async function scaffoldVaultLayout(vaultPath: string): Promise<void> {
  await mkdir(join(vaultPath, "archive"), { recursive: true });
  await mkdir(join(vaultPath, "log"), { recursive: true });
  await mkdir(join(vaultPath, "orders"), { recursive: true });
  await writeFile(join(vaultPath, "Scotty Index.md"), SCOTTY_INDEX);
}

export interface VaultClientDeps {
  path: string;
  remote: string;
  gitOps: VaultGitOps;
}

export function isVaultEmpty(vaultPath: string): boolean {
  if (!existsSync(vaultPath)) return false;
  return readdirSync(vaultPath).length === 0;
}

export async function writeVaultLocalOverlay(
  vaultPath: string,
): Promise<void> {
  const localToml = `[vault]
path = "${vaultPath}"
`;
  await mkdir(join(vaultPath, "orders"), { recursive: true });
  await writeFile(join(vaultPath, "orders", "local.toml"), localToml);

  const machineOrdersDir = join(homedir(), ".config", "scotty", "orders");
  await mkdir(machineOrdersDir, { recursive: true });
  await writeFile(join(machineOrdersDir, "local.toml"), localToml);
}

export async function writeStarterMissionOrders(
  vaultPath: string,
  remote: string,
): Promise<void> {
  await writeFile(
    join(vaultPath, "orders", "mission-orders.toml"),
    `[vault]
remote = "${remote}"
`,
  );
}

export interface VaultGitOps {
  clone(remote: string, path: string): Promise<void>;
  pull(path: string): Promise<void>;
  init(path: string): Promise<void>;
}

export const defaultVaultGitOps: VaultGitOps = {
  async clone(remote, path) {
    await Bun.$`git clone ${remote} ${path}`.quiet();
  },
  async pull(path) {
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

export async function syncVaultBeforeCommand(
  vaultPath: string,
  gitOps: VaultGitOps = defaultVaultGitOps,
): Promise<void> {
  if (existsSync(join(vaultPath, ".git"))) {
    await gitOps.pull(vaultPath);
  }
}

export async function initVault(
  deps: Omit<VaultClientDeps, "gitOps"> & { gitOps?: VaultGitOps },
): Promise<{ path: string; action: "cloned" | "scaffolded" | "existing" }> {
  const { path, remote } = deps;
  const gitOps = deps.gitOps ?? defaultVaultGitOps;

  if (!existsSync(path)) {
    await gitOps.clone(remote, path);
    await writeVaultLocalOverlay(path);
    return { path, action: "cloned" };
  }

  const entries = await readdir(path);
  if (entries.length === 0) {
    await scaffoldVaultLayout(path);
    await writeStarterMissionOrders(path, remote);
    await writeVaultLocalOverlay(path);
    if (!existsSync(join(path, ".git"))) {
      await gitOps.init(path);
    }
    return { path, action: "scaffolded" };
  }

  await syncVaultBeforeCommand(path, gitOps);
  return { path, action: "existing" };
}
