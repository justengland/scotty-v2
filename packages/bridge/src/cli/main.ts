import { defineCommand } from "citty";
import { diagnosticCommand } from "./commands/diagnostic";
import { dispatchCommand } from "./commands/dispatch";
import { hailCommand } from "./commands/hail";
import { initCommand } from "./commands/init";
import { logCommand } from "./commands/log";
import { rosterCommand } from "./commands/roster";
import { statusCommand } from "./commands/status";

export const bridgeCommand = defineCommand({
  meta: {
    name: "bridge",
    description:
      "The Bridge — routes Tasks to Away Teams, runs Tricorder verification, and coordinates Diagnostic Cycles",
    version: "0.0.0",
  },
  subCommands: {
    init: initCommand,
    roster: rosterCommand,
    log: logCommand,
    status: statusCommand,
    dispatch: dispatchCommand,
    diagnostic: diagnosticCommand,
    hail: hailCommand,
  },
});
