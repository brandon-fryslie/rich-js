// The demo is a printed reference: whatever it prints stays in the terminal to
// be read, at the size every demo page opens its terminal.

import { it, expect } from "vitest";
import { runDemo } from "../../../examples/themes-and-color-studio/app.js";
import { DEMO_TERMINAL } from "../../../examples/_browser-shell/demo-terminal.js";
import { cellLen, listThemePalettes } from "../../../src/index.js";
import { scriptedHost } from "../../host/scripted-host.js";

function printed(cols: number): string[] {
  const demo = runDemo(scriptedHost({ cols, rows: DEMO_TERMINAL.rows }), { record: true });
  return demo.out.exportText().split("\n");
}

// A line wider than the terminal is re-wrapped by the terminal itself, mid-word
// and blind to the styling, so what the reader sees is not what the demo drew.
it("every line the themes demo prints fits the terminal it prints to", () => {
  const lines = printed(DEMO_TERMINAL.cols);
  expect(lines.length).toBeGreaterThan(DEMO_TERMINAL.rows);
  expect(lines.filter((line) => cellLen(line) > DEMO_TERMINAL.cols)).toEqual([]);
});

// The console wraps a line to the terminal before the terminal can, which is
// right for prose. A strip of swatches is a picture, and wrapped it arrives in
// two pieces — so drawn with room to spare, each strip has to fit already.
it("every swatch strip the themes demo lays out fits the demo terminal as drawn", () => {
  const drawn = printed(1000);
  const strips: Array<{ strip: string; is: (line: string) => boolean }> = [
    ...listThemePalettes().map((name) => ({
      strip: `${name} gallery row`,
      is: (line: string) => line.startsWith(`  ${name} `),
    })),
    { strip: "named ramp row", is: (line) => line.includes('ref("primary-darken-3")') },
  ];
  const misfits = strips.flatMap(({ strip, is }) => {
    const line = drawn.find(is);
    if (line === undefined) return [`${strip}: not printed`];
    return cellLen(line) > DEMO_TERMINAL.cols ? [`${strip}: ${cellLen(line)} cells`] : [];
  });
  expect(misfits).toEqual([]);
});
