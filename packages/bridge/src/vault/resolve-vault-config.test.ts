import { expect, test } from "bun:test";
import type { MissionOrders } from "../mission-orders/types";
import { resolveRepoProfile, VaultConfigError } from "./resolve-vault-config";

const sampleOrders: MissionOrders = {
  vault: {
    path: "/vault",
    remote: "git@github.com:example/scotty-vault.git",
  },
  repos: {
    alpha: {
      agent: "claude-code",
      verify: "bun",
      path: "/tmp/alpha",
    },
  },
};

test("resolveRepoProfile returns profile for known repo", () => {
  const { name, profile } = resolveRepoProfile(sampleOrders, "alpha");
  expect(name).toBe("alpha");
  expect(profile.agent).toBe("claude-code");
});

test("resolveRepoProfile errors for unknown repo", () => {
  expect(() => resolveRepoProfile(sampleOrders, "missing")).toThrow(
    VaultConfigError,
  );
  expect(() => resolveRepoProfile(sampleOrders, "missing")).toThrow(
    'Repository "missing" is not on the Duty Roster',
  );
});
