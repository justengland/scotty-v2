import { DispatchError } from "../dispatch/errors";
import { createBunVerifier } from "./bun-verifier";
import { createMarkdownVerifier } from "./markdown-verifier";
import type { Verifier } from "./types";

export function resolveVerifier(verifyKey: string): Verifier {
  switch (verifyKey) {
    case "bun":
      return createBunVerifier();
    case "markdown":
      return createMarkdownVerifier();
    default:
      throw new DispatchError(
        `Unknown Tricorder verifier "${verifyKey}". Supported: bun, markdown.`,
      );
  }
}
