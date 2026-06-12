import type { Task } from "../dispatch/types";

export function buildTaskPrompt(task: Task): string {
  const sections = [
    `# Task: ${task.title}`,
    "",
    task.description,
    "",
    "## Starfleet Archive context",
    "",
  ];

  for (const file of task.contextFiles) {
    sections.push(`### ${file.path}`, "", file.content, "");
  }

  return sections.join("\n").trim();
}
