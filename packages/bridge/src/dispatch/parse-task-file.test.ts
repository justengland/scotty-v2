import { test, expect } from "bun:test";
import { parseTaskFile } from "./parse-task-file";

test("parseTaskFile reads title from markdown heading", () => {
  const result = parseTaskFile(`# Fix the widget

The widget is broken.
`);

  expect(result).toEqual({
    title: "Fix the widget",
    description: "The widget is broken.",
  });
});

test("parseTaskFile uses first line as title when no heading", () => {
  const result = parseTaskFile(`Quick fix
Second line`);

  expect(result).toEqual({
    title: "Quick fix",
    description: "Second line",
  });
});
