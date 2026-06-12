import { defineCommand } from "citty";
import { HailConfigError, runBridgeHail } from "../../hailing/send-hail";

export const hailCommand = defineCommand({
  meta: {
    name: "hail",
    description: "Send a test message via Hailing Frequencies",
  },
  async run() {
    try {
      await runBridgeHail();
      console.log("Test hail sent via Hailing Frequencies.");
    } catch (error) {
      if (error instanceof HailConfigError) {
        console.error(error.message);
        process.exitCode = 1;
        return;
      }
      throw error;
    }
  },
});
