export class DispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchError";
  }
}

export class ClaudeNotFoundError extends DispatchError {
  constructor() {
    super(
      "claude is not on PATH. Install Claude Code to dispatch Tasks to Claude Team."
    );
    this.name = "ClaudeNotFoundError";
  }
}

export class CursorApiKeyMissingError extends DispatchError {
  constructor() {
    super(
      "CURSOR_API_KEY is not set. Add it to your environment to dispatch Tasks to CursorTeam."
    );
    this.name = "CursorApiKeyMissingError";
  }
}
