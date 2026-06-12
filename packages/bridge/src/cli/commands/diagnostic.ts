import { defineCommand } from "citty";
import { createClaudeDiagnostic } from "../../diagnostic/claude-diagnostic";
import { DiagnosticError } from "../../diagnostic/errors";
import { runDiagnostic } from "../../diagnostic/run-diagnostic";
import { ClaudeNotFoundError } from "../../dispatch/errors";
import {
  loadResolvedMissionOrders,
  resolveVaultConfig,
  VaultConfigError,
} from "../../vault/resolve-vault-config";
import { syncVaultBeforeCommand } from "../../vault/vault-client";

export const diagnosticCommand = defineCommand({
  meta: {
    name: "diagnostic",
    description:
      "Run a Diagnostic Cycle to update the Starfleet Archive from repo changes",
  },
  args: {
    repo: {
      type: "positional",
      description: "Repository name from the Duty Roster",
      required: false,
    },
  },
  async run({ args }) {
    try {
      if (!args.repo) {
        throw new DiagnosticError(
          "Repository name required. Usage: bridge diagnostic <repo>",
        );
      }

      const { path } = resolveVaultConfig();
      await syncVaultBeforeCommand(path);
      const orders = loadResolvedMissionOrders();
      const agent = createClaudeDiagnostic();

      const result = await runDiagnostic({
        vaultPath: path,
        orders,
        repoName: args.repo,
        agent,
      });

      if (result.exitCode !== 0) {
        process.exitCode = result.exitCode;
      }
    } catch (error) {
      if (
        error instanceof VaultConfigError ||
        error instanceof DiagnosticError ||
        error instanceof ClaudeNotFoundError
      ) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  },
});
