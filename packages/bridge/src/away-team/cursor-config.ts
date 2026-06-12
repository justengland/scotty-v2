import { CursorApiKeyMissingError } from "../dispatch/errors";

export interface CursorTeamConfig {
  apiKey: string;
  model: string;
  streamLog: boolean;
  runtime: string;
  nodeBin?: string;
  cwdOverride?: string;
}

export function readCursorConfig(
  env: NodeJS.ProcessEnv = process.env
): CursorTeamConfig {
  const apiKey = env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new CursorApiKeyMissingError();
  }

  return {
    apiKey,
    model: env.SCOTTY_CURSOR_MODEL?.trim() || "composer-2.5",
    streamLog: (env.SCOTTY_CURSOR_STREAM_LOG ?? "1") === "1",
    runtime: env.SCOTTY_CURSOR_RUNTIME?.trim() || "node",
    nodeBin: env.SCOTTY_NODE_BIN?.trim() || undefined,
    cwdOverride: env.SCOTTY_CURSOR_CWD?.trim() || undefined,
  };
}

export function resolveCursorCwd(
  config: CursorTeamConfig,
  repoPath: string
): string {
  return config.cwdOverride ?? repoPath;
}
