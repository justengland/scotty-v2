import { defineCommand } from "citty";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description:
      "Clone the Scotty Vault remote or scaffold vault layout (archive/, log/, orders/)",
  },
  async run() {
    console.log("init: not yet implemented");
  },
});
