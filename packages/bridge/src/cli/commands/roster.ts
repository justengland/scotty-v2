import { defineCommand } from "citty";
import { prepareBridgeSession } from "../../bridge-context/bridge-context";
import { formatDutyRoster } from "../../roster/format-roster";
import {
  resolveRepoProfile,
  VaultConfigError,
} from "../../vault/resolve-vault-config";

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
      const { orders } = await prepareBridgeSession();

      if (args.repo) {
        const { name, profile } = resolveRepoProfile(orders, args.repo);
        console.log(
          formatDutyRoster({ vault: orders.vault, repos: { [name]: profile } })
        );
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
