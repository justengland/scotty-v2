export class DiagnosticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiagnosticError";
  }
}

export class ArchiveValidationError extends DiagnosticError {
  constructor(message: string) {
    super(message);
    this.name = "ArchiveValidationError";
  }
}
