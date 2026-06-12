const EMPTY_TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function resolveRepoHeadSha(repoPath: string): Promise<string> {
  const result = await Bun.$`git rev-parse HEAD`.cwd(repoPath).quiet();
  return result.stdout.toString().trim();
}

export async function diffRepoSince(
  repoPath: string,
  sinceSha: string | undefined,
): Promise<string> {
  const base = sinceSha ?? EMPTY_TREE_SHA;
  const result = await Bun.$`git diff ${base} HEAD`.cwd(repoPath).quiet();
  return result.stdout.toString();
}
