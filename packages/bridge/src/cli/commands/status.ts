import { defineCommand } from "citty";
import { formatFleetStatus } from "../../status/format-status";
import { readFleetStatus } from "../../status/read-status";
import {
  loadResolvedMissionOrders,
  resolveVaultConfig,
  VaultConfigError,
} from "../../vault/resolve-vault-config";
import { syncVaultBeforeCommand } from "../../vault/vault-client";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description:
      "Print fleet health — last dispatch, diagnostic SHA, and stardate per Duty Roster repo",
  },
  async run() {
    try {
      const { path } = resolveVaultConfig();
      await syncVaultBeforeCommand(path);
      const orders = loadResolvedMissionOrders();
      const repoNames = Object.keys(orders.repos);
      const statuses = await readFleetStatus(path, repoNames);

      console.log(formatFleetStatus(statuses));
    } catch (error) {
      if (error instanceof VaultConfigError) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  },
});
