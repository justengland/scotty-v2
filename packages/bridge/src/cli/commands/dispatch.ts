import { defineCommand } from "citty";

export const dispatchCommand = defineCommand({
  meta: {
    name: "dispatch",
    description:
      "Dispatch a Task to an Away Team with Starfleet Archive context injection",
  },
  args: {
    repo: {
      type: "positional",
      description: "Repository name from the Duty Roster",
      required: false,
    },
  },
  async run() {
    console.log("dispatch: not yet implemented");
  },
});
