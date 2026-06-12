import { expect, test } from "bun:test";
import { join } from "node:path";
import { createMarkdownVerifier } from "./markdown-verifier";

const fixturesDir = join(import.meta.dir, "../../test-fixtures");

test("MarkdownVerifier passes valid markdown fixture repo", async () => {
  const verifier = createMarkdownVerifier();
  const result = await verifier.verify(join(fixturesDir, "markdown-pass"));

  expect(result.passed).toBe(true);
  expect(result.summary).toContain("markdown");
});

test("MarkdownVerifier fails on lint and broken links", async () => {
  const verifier = createMarkdownVerifier();
  const result = await verifier.verify(join(fixturesDir, "markdown-fail"));

  expect(result.passed).toBe(false);
  expect(result.errors?.some((error) => error.includes("heading"))).toBe(true);
  expect(result.errors?.some((error) => error.includes("missing.md"))).toBe(
    true,
  );
});
