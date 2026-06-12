export interface VaultConfig {
  path?: string;
  remote?: string;
}

export interface RepoProfile {
  path?: string;
  agent: string;
  verify?: string;
  context?: string[];
}

export interface MissionOrders {
  vault: VaultConfig;
  repos: Record<string, RepoProfile>;
}
