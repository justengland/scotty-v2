import { DispatchError } from "./errors";

const WHAT_TO_BUILD_HEADING = /^##\s+What to build\s*$/im;

export function parseIssueFile(content: string): {
  title: string;
  description: string;
} {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new DispatchError("Issue file is empty.");
  }

  const headingMatch = trimmed.match(/^#\s+(.+?)(?:\r?\n|$)/);
  if (!headingMatch) {
    throw new DispatchError("Issue file is missing a title heading (# ...).");
  }

  const title = headingMatch[1]!.trim();
  const afterTitle = trimmed.slice(headingMatch[0].length);
  const sectionMatch = WHAT_TO_BUILD_HEADING.exec(afterTitle);
  if (!sectionMatch) {
    throw new DispatchError('Issue file is missing a "What to build" section.');
  }

  const bodyStart = sectionMatch.index! + sectionMatch[0].length;
  const rest = afterTitle.slice(bodyStart);
  const nextSection = rest.search(/^##\s/m);
  const description = (
    nextSection === -1 ? rest : rest.slice(0, nextSection)
  ).trim();

  if (!description) {
    throw new DispatchError('"What to build" section is empty.');
  }

  return { title, description };
}
