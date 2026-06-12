export class DispatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchError";
  }
}

export class ClaudeNotFoundError extends DispatchError {
  constructor() {
    super(
      "claude is not on PATH. Install Claude Code to dispatch Tasks to Claude Team.",
    );
    this.name = "ClaudeNotFoundError";
  }
}
