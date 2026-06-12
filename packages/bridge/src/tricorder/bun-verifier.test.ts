import { expect, test } from "bun:test";
import { join } from "node:path";
import { createBunVerifier } from "./bun-verifier";

const fixturesDir = join(import.meta.dir, "../../test-fixtures");

test("BunVerifier passes when bun test succeeds in fixture repo", async () => {
  const verifier = createBunVerifier();
  const result = await verifier.verify(join(fixturesDir, "bun-pass"));

  expect(result.passed).toBe(true);
  expect(result.summary.length).toBeGreaterThan(0);
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
});

test("BunVerifier fails when bun test fails in fixture repo", async () => {
  const verifier = createBunVerifier();
  const result = await verifier.verify(join(fixturesDir, "bun-fail"));

  expect(result.passed).toBe(false);
  expect(result.errors?.length).toBeGreaterThan(0);
});
