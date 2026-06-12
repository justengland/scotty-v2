export interface ArchiveFrontmatter {
  entity?: string;
  repo?: string;
  updated?: string;
  sources?: string[];
}

export function parseFrontmatter(content: string): {
  frontmatter: ArchiveFrontmatter;
  body: string;
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yaml = match[1] ?? "";
  const body = match[2] ?? "";
  const frontmatter: ArchiveFrontmatter = {};

  for (const line of yaml.split(/\r?\n/)) {
    const entityMatch = line.match(/^entity:\s*(.+)$/);
    if (entityMatch) {
      frontmatter.entity = entityMatch[1]!.trim();
      continue;
    }

    const repoMatch = line.match(/^repo:\s*(.+)$/);
    if (repoMatch) {
      frontmatter.repo = repoMatch[1]!.trim();
      continue;
    }

    const updatedMatch = line.match(/^updated:\s*(.+)$/);
    if (updatedMatch) {
      frontmatter.updated = updatedMatch[1]!.trim();
      continue;
    }

    const sourcesMatch = line.match(/^sources:\s*\[(.*)\]$/);
    if (sourcesMatch) {
      const inner = sourcesMatch[1] ?? "";
      frontmatter.sources = inner
        .split(",")
        .map((part) => part.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
  }

  return { frontmatter, body };
}

export function formatFrontmatter(frontmatter: ArchiveFrontmatter): string {
  const lines = ["---"];
  if (frontmatter.entity !== undefined) {
    lines.push(`entity: ${frontmatter.entity}`);
  }
  if (frontmatter.repo !== undefined) {
    lines.push(`repo: ${frontmatter.repo}`);
  }
  if (frontmatter.updated !== undefined) {
    lines.push(`updated: ${frontmatter.updated}`);
  }
  if (frontmatter.sources !== undefined) {
    const quoted = frontmatter.sources.map((source) => `"${source}"`).join(", ");
    lines.push(`sources: [${quoted}]`);
  }
  lines.push("---");
  return lines.join("\n");
}
