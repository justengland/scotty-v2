import { defineCommand } from "citty";
import {
  prepareBridgeSession,
  resolveRosterRepo,
} from "../../bridge-context/bridge-context";
import { DispatchError } from "../../dispatch/errors";
import { runDispatch } from "../../dispatch/run-dispatch";
import { VaultConfigError } from "../../vault/resolve-vault-config";

function parseOptionalNumber(
  value: string | undefined,
  label: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new DispatchError(`${label} must be a number.`);
  }
  return parsed;
}

function validateDispatchArgs(args: {
  repo?: string;
  title?: string;
  description?: string;
  file?: string;
  issue?: string;
}): string {
  if (!args.repo) {
    throw new DispatchError(
      'Repository name required. Usage: bridge dispatch <repo> --title "..." --description "..."'
    );
  }

  if (args.issue && (args.title || args.description || args.file)) {
    throw new DispatchError(
      "--issue cannot be combined with --title, --description, or --file"
    );
  }

  return args.repo;
}

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
    issue: {
      type: "string",
      description:
        "Path to a markdown issue file (title from H1, description from What to build)",
      alias: "i",
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
      const repoName = validateDispatchArgs(args);

      const priority = parseOptionalNumber(args.priority, "Priority");
      const contextDepth = parseOptionalNumber(
        args["context-depth"],
        "Context depth"
      );

      const { vaultPath, orders } = await prepareBridgeSession();
      const { name, profile } = resolveRosterRepo(orders, repoName);

      const result = await runDispatch({
        vaultPath,
        repoName: name,
        profile,
        title: args.title,
        description: args.description,
        file: args.file,
        issue: args.issue,
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
