import { existsSync } from "node:fs";
import { join } from "node:path";

export async function commitVaultLocally(
  vaultPath: string,
  message: string,
): Promise<void> {
  if (!existsSync(join(vaultPath, ".git"))) {
    await Bun.$`git init`.cwd(vaultPath).quiet();
  }

  await Bun.$`git add -A`.cwd(vaultPath).quiet();
  const status = await Bun.$`git status --porcelain`.cwd(vaultPath).quiet();
  if (status.stdout.toString().trim().length === 0) {
    return;
  }

  await Bun.$`git commit -m ${message}`.cwd(vaultPath).quiet();
}
