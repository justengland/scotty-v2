#!/usr/bin/env bun
import { runMain } from "citty";
import { bridgeCommand } from "./cli/main";

await runMain(bridgeCommand);
