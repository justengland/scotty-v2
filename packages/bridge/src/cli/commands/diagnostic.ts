import { defineCommand } from "citty";

export const diagnosticCommand = defineCommand({
  meta: {
    name: "diagnostic",
    description:
      "Run a Diagnostic Cycle to update the Starfleet Archive from repo changes",
  },
  args: {
    repo: {
      type: "positional",
      description: "Repository name from the Duty Roster",
      required: false,
    },
  },
  async run() {
    console.log("diagnostic: not yet implemented");
  },
});
