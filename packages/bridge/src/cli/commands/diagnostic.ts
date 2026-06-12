import { defineCommand } from "citty";
import {
  prepareBridgeSession,
  resolveRosterRepo,
} from "../../bridge-context/bridge-context";
import { createClaudeDiagnostic } from "../../diagnostic/claude-diagnostic";
import { DiagnosticError } from "../../diagnostic/errors";
import { runDiagnostic } from "../../diagnostic/run-diagnostic";
import { ClaudeNotFoundError } from "../../dispatch/errors";
import { VaultConfigError } from "../../vault/resolve-vault-config";

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
          "Repository name required. Usage: bridge diagnostic <repo>"
        );
      }

      const { vaultPath, orders } = await prepareBridgeSession();
      const { name, profile } = resolveRosterRepo(orders, args.repo);
      const agent = createClaudeDiagnostic();

      const result = await runDiagnostic({
        vaultPath,
        repoName: name,
        profile,
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
