export interface VerificationResult {
  passed: boolean;
  summary: string;
  errors?: string[];
  durationMs: number;
}

export interface Verifier {
  verify(repoPath: string): Promise<VerificationResult>;
}
