import { defineCommand } from "citty";
import { prepareBridgeSession } from "../../bridge-context/bridge-context";
import { formatLogEntries } from "../../log/format-log";
import { readEngineeringLog } from "../../log/read-log";
import { VaultConfigError } from "../../vault/resolve-vault-config";

export const logCommand = defineCommand({
  meta: {
    name: "log",
    description:
      "Print Engineering Log entries — dispatch outcomes from the Scotty Vault",
  },
  args: {
    repo: {
      type: "string",
      description: "Filter to a single Duty Roster repository name",
      alias: "r",
    },
    since: {
      type: "string",
      description:
        "Only include entries on or after this ISO date (YYYY-MM-DD)",
    },
    limit: {
      type: "string",
      description: "Maximum number of entries to print (default 50)",
    },
  },
  async run({ args }) {
    try {
      const { vaultPath } = await prepareBridgeSession();

      const limit = args.limit ? Number(args.limit) : undefined;
      if (limit !== undefined && (!Number.isFinite(limit) || limit < 1)) {
        console.error("--limit must be a positive number");
        process.exitCode = 1;
        return;
      }

      const entries = await readEngineeringLog(vaultPath, {
        repo: args.repo,
        since: args.since,
        limit,
      });

      if (entries.length === 0) {
        console.log("No Engineering Log entries found.");
        return;
      }

      console.log(formatLogEntries(entries));
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
