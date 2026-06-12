import type { MissionOrders, RepoProfile } from "../mission-orders/types";
import {
  loadResolvedMissionOrders,
  resolveRepoProfile,
  resolveVaultPath,
  VaultConfigError,
} from "../vault/resolve-vault-config";
import {
  defaultVaultGitOps,
  syncVaultBeforeCommand,
  type VaultGitOps,
} from "../vault/vault-client";

export interface BridgeSession {
  vaultPath: string;
  orders: MissionOrders;
}

export interface PrepareBridgeSessionDeps {
  gitOps?: VaultGitOps;
  env?: NodeJS.ProcessEnv;
}

export async function prepareBridgeSession(
  deps: PrepareBridgeSessionDeps = {}
): Promise<BridgeSession> {
  const env = deps.env ?? process.env;
  const gitOps = deps.gitOps ?? defaultVaultGitOps;
  const vaultPath = resolveVaultPath(env);
  await syncVaultBeforeCommand(vaultPath, gitOps);
  const orders = loadResolvedMissionOrders(env);
  return { vaultPath, orders };
}

export function resolveRosterRepo(
  orders: MissionOrders,
  repoName: string
): { name: string; profile: RepoProfile } {
  const { name, profile } = resolveRepoProfile(orders, repoName);

  if (!profile.path) {
    throw new VaultConfigError(
      `Repository "${repoName}" has no local path in Mission Orders.`
    );
  }

  return { name, profile };
}
