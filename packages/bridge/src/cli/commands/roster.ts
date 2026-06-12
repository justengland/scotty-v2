import { defineCommand } from "citty";

export const rosterCommand = defineCommand({
  meta: {
    name: "roster",
    description:
      "Print the Duty Roster — repository profiles from Mission Orders",
  },
  async run() {
    console.log("roster: not yet implemented");
  },
});
