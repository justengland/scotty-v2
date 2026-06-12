import { expect, test } from "bun:test";
import { CursorApiKeyMissingError } from "../dispatch/errors";
import { readCursorConfig } from "./cursor-config";

test("readCursorConfig applies defaults from env template", () => {
  const config = readCursorConfig({
    CURSOR_API_KEY: "cursor_test_key",
  });

  expect(config).toEqual({
    apiKey: "cursor_test_key",
    model: "composer-2.5",
    streamLog: true,
    runtime: "node",
    nodeBin: undefined,
    cwdOverride: undefined,
  });
});

test("readCursorConfig reads SCOTTY_CURSOR_* overrides", () => {
  const config = readCursorConfig({
    CURSOR_API_KEY: "cursor_test_key",
    SCOTTY_CURSOR_MODEL: "gpt-5.3-codex",
    SCOTTY_CURSOR_STREAM_LOG: "0",
    SCOTTY_CURSOR_RUNTIME: "node",
    SCOTTY_NODE_BIN: "/opt/node/bin/node",
    SCOTTY_CURSOR_CWD: "/tmp/custom-cwd",
  });

  expect(config.model).toBe("gpt-5.3-codex");
  expect(config.streamLog).toBe(false);
  expect(config.runtime).toBe("node");
  expect(config.nodeBin).toBe("/opt/node/bin/node");
  expect(config.cwdOverride).toBe("/tmp/custom-cwd");
});

test("readCursorConfig throws when CURSOR_API_KEY is missing", () => {
  expect(() => readCursorConfig({})).toThrow(CursorApiKeyMissingError);
  expect(() => readCursorConfig({ CURSOR_API_KEY: "  " })).toThrow(
    CursorApiKeyMissingError
  );
});
