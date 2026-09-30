// The demo is a printed reference: whatever it prints stays in the terminal to
// be read. A line wider than the terminal is re-wrapped by the terminal itself,
// mid-word and blind to the styling, so what the reader sees is not what the
// demo drew. The browser shell's terminal is 100 columns.

import { it, expect } from "vitest";
import { runDemo } from "../../../examples/themes-and-color-studio/app.js";
import { cellLen } from "../../../src/index.js";
import { scriptedHost } from "../../host/scripted-host.js";

it("every line the themes demo prints fits the terminal it prints to", () => {
  const host = scriptedHost({ cols: 100, rows: 30 });
  const demo = runDemo(host, { record: true });
  const lines = demo.out.exportText().split("\n");
  expect(lines.length).toBeGreaterThan(30);
  expect(lines.filter((line) => cellLen(line) > 100)).toEqual([]);
});
