import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { loadMissionOrders } from "../mission-orders/load-mission-orders";
import type { MissionOrders, RepoProfile } from "../mission-orders/types";

export class VaultConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultConfigError";
  }
}

function scottyDataRoot(home = homedir()): string {
  return join(home, ".config", "scotty");
}

function readLocalVaultPath(localTomlPath: string): string | undefined {
  if (!existsSync(localTomlPath)) return undefined;

  const parsed = Bun.TOML.parse(readFileSync(localTomlPath, "utf8")) as {
    vault?: { path?: string };
  };
  return parsed.vault?.path;
}

export function resolveVaultPath(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.SCOTTY_VAULT_PATH;
  if (fromEnv) return fromEnv;

  const home = env.HOME ?? homedir();
  const vaultLocal = join(scottyDataRoot(home), "orders", "local.toml");
  const fromLocal = readLocalVaultPath(vaultLocal);
  if (fromLocal) return fromLocal;

  throw new VaultConfigError(
    "Vault path not configured. Set SCOTTY_VAULT_PATH or add [vault].path to orders/local.toml.",
  );
}

export function resolveVaultRemote(
  vaultPath: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const fromEnv = env.SCOTTY_VAULT_REMOTE;
  if (fromEnv) return fromEnv;

  const missionPath = join(vaultPath, "orders", "mission-orders.toml");
  if (existsSync(missionPath)) {
    const orders = loadMissionOrders(vaultPath);
    if (orders.vault.remote) return orders.vault.remote;
  }

  throw new VaultConfigError(
    "Vault remote not configured. Set SCOTTY_VAULT_REMOTE or add [vault].remote to orders/mission-orders.toml.",
  );
}

export function resolveVaultConfig(
  env: NodeJS.ProcessEnv = process.env,
): { path: string; remote: string } {
  const path = resolveVaultPath(env);
  const remote = resolveVaultRemote(path, env);
  return { path, remote };
}

export function loadResolvedMissionOrders(
  env: NodeJS.ProcessEnv = process.env,
): MissionOrders {
  const path = resolveVaultPath(env);
  const orders = loadMissionOrders(path);

  const vaultPath = env.SCOTTY_VAULT_PATH ?? orders.vault.path ?? path;
  const vaultRemote = env.SCOTTY_VAULT_REMOTE ?? orders.vault.remote;

  if (!vaultPath) {
    throw new VaultConfigError(
      "Vault path not configured. Set SCOTTY_VAULT_PATH or add [vault].path to orders/local.toml.",
    );
  }

  if (!vaultRemote) {
    throw new VaultConfigError(
      "Vault remote not configured. Set SCOTTY_VAULT_REMOTE or add [vault].remote to orders/mission-orders.toml.",
    );
  }

  return {
    vault: { path: vaultPath, remote: vaultRemote },
    repos: orders.repos,
  };
}

export function resolveRepoProfile(
  orders: MissionOrders,
  repoName: string,
): { name: string; profile: RepoProfile } {
  const profile = orders.repos[repoName];
  if (!profile) {
    throw new VaultConfigError(
      `Repository "${repoName}" is not on the Duty Roster. Check Mission Orders for available repos.`,
    );
  }
  return { name: repoName, profile };
}
