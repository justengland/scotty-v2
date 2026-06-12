import { defineCommand } from "citty";
import { DispatchError } from "../../dispatch/errors";
import { runDispatch } from "../../dispatch/run-dispatch";
import {
  loadResolvedMissionOrders,
  resolveVaultConfig,
  VaultConfigError,
} from "../../vault/resolve-vault-config";
import { syncVaultBeforeCommand } from "../../vault/vault-client";

export const dispatchCommand = defineCommand({
  meta: {
    name: "dispatch",
    description:
      "Dispatch a Task to an Away Team with Starfleet Archive context injection",
  },
  args: {
    repo: {
      type: "positional",
      description: "Repository name from the Duty Roster",
      required: false,
    },
    title: {
      type: "string",
      description: "Task title",
      alias: "t",
    },
    description: {
      type: "string",
      description: "Task description",
      alias: "d",
    },
    file: {
      type: "string",
      description: "Path to a markdown Task file (title as # heading)",
      alias: "f",
    },
    priority: {
      type: "string",
      description: "Task priority (default 0)",
      alias: "p",
    },
    "context-depth": {
      type: "string",
      description:
        "Wiki-link traversal depth for Archive context (default 0; overrides Mission Orders)",
    },
    "skip-verify": {
      type: "boolean",
      description: "Skip Tricorder verification",
    },
  },
  async run({ args }) {
    try {
      if (!args.repo) {
        throw new DispatchError(
          'Repository name required. Usage: bridge dispatch <repo> --title "..." --description "..."'
        );
      }

      const priority =
        args.priority !== undefined ? Number(args.priority) : undefined;
      if (priority !== undefined && Number.isNaN(priority)) {
        throw new DispatchError("Priority must be a number.");
      }

      const contextDepth =
        args["context-depth"] !== undefined
          ? Number(args["context-depth"])
          : undefined;
      if (contextDepth !== undefined && Number.isNaN(contextDepth)) {
        throw new DispatchError("Context depth must be a number.");
      }

      const { path } = resolveVaultConfig();
      await syncVaultBeforeCommand(path);
      const orders = loadResolvedMissionOrders();

      const result = await runDispatch({
        vaultPath: path,
        orders,
        repoName: args.repo,
        title: args.title,
        description: args.description,
        file: args.file,
        priority,
        contextDepth,
        skipVerify: args["skip-verify"],
      });

      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    } catch (error) {
      if (error instanceof VaultConfigError || error instanceof DispatchError) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  },
});
