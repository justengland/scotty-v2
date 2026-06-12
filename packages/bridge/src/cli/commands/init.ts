import { defineCommand } from "citty";
import {
  resolveVaultConfig,
  VaultConfigError,
} from "../../vault/resolve-vault-config";
import { initVault } from "../../vault/vault-client";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Clone the Scotty Vault remote or scaffold vault layout (archive/, log/, orders/)",
  },
  async run() {
    try {
      const { path, remote } = resolveVaultConfig();
      const result = await initVault({ path, remote });

      switch (result.action) {
        case "cloned":
          console.log(`Cloned Scotty Vault to ${path}`);
          break;
        case "scaffolded":
          console.log(`Scaffolded Scotty Vault at ${path}`);
          break;
        case "existing":
          console.log(`Scotty Vault ready at ${path}`);
          break;
      }
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
