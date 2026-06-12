import { defineCommand } from "citty";
import { formatDutyRoster } from "../../roster/format-roster";
import {
  loadResolvedMissionOrders,
  resolveRepoProfile,
  resolveVaultConfig,
  VaultConfigError,
} from "../../vault/resolve-vault-config";
import { syncVaultBeforeCommand } from "../../vault/vault-client";

export const rosterCommand = defineCommand({
  meta: {
    name: "roster",
    description:
      "Print the Duty Roster — repository profiles from Mission Orders",
  },
  args: {
    repo: {
      type: "positional",
      description: "Optional repository name to look up on the Duty Roster",
      required: false,
    },
  },
  async run({ args }) {
    try {
      const { path } = resolveVaultConfig();
      await syncVaultBeforeCommand(path);
      const orders = loadResolvedMissionOrders();

      if (args.repo) {
        const { name, profile } = resolveRepoProfile(orders, args.repo);
        console.log(formatDutyRoster({ vault: orders.vault, repos: { [name]: profile } }));
        return;
      }

      console.log(formatDutyRoster(orders));
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
