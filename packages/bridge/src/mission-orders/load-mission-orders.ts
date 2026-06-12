import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MissionOrders, RepoProfile, VaultConfig } from "./types";

function parseToml(path: string): Record<string, unknown> {
  const raw = readFileSync(path, "utf8");
  return Bun.TOML.parse(raw) as Record<string, unknown>;
}

function mergeVault(
  mission: Record<string, unknown>,
  local: Record<string, unknown>,
): VaultConfig {
  const missionVault = (mission.vault ?? {}) as VaultConfig;
  const localVault = (local.vault ?? {}) as VaultConfig;
  return { ...missionVault, ...localVault };
}

function mergeRepos(
  mission: Record<string, unknown>,
  local: Record<string, unknown>,
): Record<string, RepoProfile> {
  const missionRepos = (mission.repos ?? {}) as Record<string, RepoProfile>;
  const localRepos = (local.repos ?? {}) as Record<string, RepoProfile>;
  const names = new Set([...Object.keys(missionRepos), ...Object.keys(localRepos)]);
  const merged: Record<string, RepoProfile> = {};

  for (const name of names) {
    merged[name] = {
      ...missionRepos[name],
      ...localRepos[name],
    } as RepoProfile;
  }

  return merged;
}

export function loadMissionOrders(vaultPath: string): MissionOrders {
  const ordersDir = join(vaultPath, "orders");
  const missionPath = join(ordersDir, "mission-orders.toml");
  const localPath = join(ordersDir, "local.toml");

  const mission = parseToml(missionPath);
  const local = existsSync(localPath) ? parseToml(localPath) : {};

  return {
    vault: mergeVault(mission, local),
    repos: mergeRepos(mission, local),
  };
}
