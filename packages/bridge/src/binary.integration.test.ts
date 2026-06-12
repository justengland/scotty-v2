import { expect, test } from "bun:test";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");
const binaryPath = join(packageRoot, "dist", "bridge");

test("compiled bridge binary runs --help without bun on PATH", async () => {
  const build = await Bun.$`bun run build`.cwd(packageRoot).quiet().nothrow();
  expect(build.exitCode).toBe(0);

  const result = await Bun.$`${binaryPath} --help`
    .env({ ...process.env, PATH: "/usr/bin:/bin" })
    .quiet()
    .nothrow();

  expect(result.exitCode).toBe(0);
  const output = result.stdout.toString();
  expect(output).toContain("init");
  expect(output).toContain("roster");
  expect(output).toContain("dispatch");
  expect(output).toContain("diagnostic");
  expect(output).toContain("hail");
});
