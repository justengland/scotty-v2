import { test, expect } from "bun:test";
import { formatHail } from "./format-hail";

test("formatHail includes Scotty Hail header and kind label", () => {
  const message = formatHail({
    kind: "test",
    summary: "Hailing Frequencies check.",
  });

  expect(message).toContain("Scotty Hail");
  expect(message).toContain("Test hail");
  expect(message).toContain("Hailing Frequencies check.");
});

test("formatHail includes repo when provided", () => {
  const message = formatHail({
    kind: "tricorder-failure",
    repo: "starbase-api",
    summary: "`bun test` failed.",
  });

  expect(message).toContain("starbase-api");
  expect(message).toContain("Tricorder failure");
});
