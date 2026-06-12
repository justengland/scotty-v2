import { DispatchError } from "./errors";

export function parseTaskFile(content: string): {
  title: string;
  description: string;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new DispatchError("Task file is empty.");
  }

  const headingMatch = trimmed.match(/^#\s+(.+?)(?:\r?\n|$)/);
  if (headingMatch) {
    const title = headingMatch[1]!.trim();
    const description = trimmed.slice(headingMatch[0].length).trim();
    return { title, description };
  }

  const [firstLine, ...rest] = trimmed.split(/\r?\n/);
  return {
    title: firstLine!.trim(),
    description: rest.join("\n").trim(),
  };
}
