import { defineCommand } from "citty";
import { prepareBridgeSession } from "../../bridge-context/bridge-context";
import { formatFleetStatus } from "../../status/format-status";
import { readFleetStatus } from "../../status/read-status";
import { VaultConfigError } from "../../vault/resolve-vault-config";

export const statusCommand = defineCommand({
  meta: {
    name: "status",
    description:
      "Print fleet health — last dispatch, diagnostic SHA, and stardate per Duty Roster repo",
  },
  async run() {
    try {
      const { vaultPath, orders } = await prepareBridgeSession();
      const repoNames = Object.keys(orders.repos);
      const statuses = await readFleetStatus(vaultPath, repoNames);

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
