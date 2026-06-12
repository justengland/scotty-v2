import { createClaudeTeam, type ClaudeTeamDeps } from "./claude-team";
import { createCursorTeam, type CursorTeamDeps } from "./cursor-team";
import { DispatchError } from "../dispatch/errors";
import type { AwayTeam } from "../dispatch/types";

export interface AwayTeamRegistryDeps {
  claude?: ClaudeTeamDeps;
  cursor?: CursorTeamDeps;
}

export function resolveAwayTeam(
  agent: string,
  deps: AwayTeamRegistryDeps = {}
): AwayTeam {
  switch (agent) {
    case "claude-code":
      return createClaudeTeam(deps.claude);
    case "cursor":
      return createCursorTeam(deps.cursor);
    default:
      throw new DispatchError(
        `Away Team "${agent}" is not supported. Use agent = "claude-code" or agent = "cursor".`
      );
  }
}
