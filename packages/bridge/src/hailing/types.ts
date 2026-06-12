export type HailKind =
  | "test"
  | "away-team-crash"
  | "tricorder-failure"
  | "diagnostic-failure";

export interface HailChannel {
  send(message: string): Promise<void>;
}
