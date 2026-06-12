import { defineCommand } from "citty";

export const hailCommand = defineCommand({
  meta: {
    name: "hail",
    description: "Send a test message via Hailing Frequencies",
  },
  async run() {
    console.log("hail: not yet implemented");
  },
});
