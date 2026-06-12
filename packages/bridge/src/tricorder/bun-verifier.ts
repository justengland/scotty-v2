import type { VerificationResult, Verifier } from "./types";

export interface BunVerifierDeps {
  resolveBunPath?: () => string;
}

function defaultResolveBunPath(): string {
  return process.env.SCOTTY_BUN_PATH ?? "bun";
}

function firstMeaningfulLine(text: string): string {
  const line = text.split(/\r?\n/).find((entry) => entry.trim().length > 0);
  return line?.trim() ?? "";
}

export function createBunVerifier(deps: BunVerifierDeps = {}): Verifier {
  const resolveBunPath = deps.resolveBunPath ?? defaultResolveBunPath;

  return {
    async verify(repoPath: string): Promise<VerificationResult> {
      const startedAt = Date.now();
      const proc = Bun.spawn([resolveBunPath(), "test"], {
        cwd: repoPath,
        stdout: "pipe",
        stderr: "pipe",
        env: process.env,
      });

      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);

      const combined = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      const passed = exitCode === 0;
      const headline = firstMeaningfulLine(combined);

      return {
        passed,
        summary: passed
          ? headline || "bun test passed"
          : headline || "bun test failed",
        errors: passed ? undefined : [combined || "bun test failed"],
        durationMs: Date.now() - startedAt,
      };
    },
  };
}
