import { commitVaultLocally } from "../vault/commit-vault";

export async function pushVault(vaultPath: string): Promise<void> {
  const upstream = await Bun.$`git rev-parse --abbrev-ref @{upstream}`
    .cwd(vaultPath)
    .quiet()
    .nothrow();

  if (upstream.exitCode !== 0) {
    await Bun.$`git push`.cwd(vaultPath).quiet();
    return;
  }

  await Bun.$`git push`.cwd(vaultPath).quiet();
}

export async function commitAndPushVault(
  vaultPath: string,
  message: string,
): Promise<void> {
  await commitVaultLocally(vaultPath, message);
  await pushVault(vaultPath);
}
