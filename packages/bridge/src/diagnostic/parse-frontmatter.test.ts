import { expect, test } from "bun:test";
import { parseFrontmatter, formatFrontmatter } from "./parse-frontmatter";

test("parseFrontmatter extracts archive fields", () => {
  const content = `---
entity: alpha-service
repo: alpha
updated: 2026-06-01
sources: ["alpha@abc123def456"]
---

# Alpha
`;

  const { frontmatter, body } = parseFrontmatter(content);
  expect(frontmatter.entity).toBe("alpha-service");
  expect(frontmatter.repo).toBe("alpha");
  expect(frontmatter.updated).toBe("2026-06-01");
  expect(frontmatter.sources).toEqual(["alpha@abc123def456"]);
  expect(body.trim()).toBe("# Alpha");
});

test("formatFrontmatter round-trips required fields", () => {
  const frontmatter = {
    entity: "alpha-service",
    repo: "alpha",
    updated: "2026-06-12",
    sources: ["alpha@deadbeef"],
  };

  const formatted = `${formatFrontmatter(frontmatter)}\n# Body\n`;
  const parsed = parseFrontmatter(formatted);
  expect(parsed.frontmatter).toEqual(frontmatter);
});
