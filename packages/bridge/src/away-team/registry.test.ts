import { expect, test } from "bun:test";
import { resolveAwayTeam } from "./registry";

test('resolveAwayTeam returns Claude Team for "claude-code"', () => {
  const team = resolveAwayTeam("claude-code");
  expect(team.id).toBe("claude-code");
});

test('resolveAwayTeam returns CursorTeam for "cursor"', () => {
  const team = resolveAwayTeam("cursor");
  expect(team.id).toBe("cursor");
});

test("resolveAwayTeam rejects unknown agents", () => {
  expect(() => resolveAwayTeam("copilot")).toThrow(/copilot/);
});
