// The demo is a printed reference: whatever it prints stays in the terminal to
// be read, at the size its card opens its terminal (its card.json).

import { it, expect } from "vitest";
import path from "node:path";
import { printTour } from "../../../examples/themes-and-color-studio/tour.js";
import { cardJson } from "../../../docs/.vitepress/demo-card.js";
import { REPO_ROOT } from "../../../scripts/repo-facts.js";
import { cellLen, Console, listThemePalettes } from "../../../src/index.js";

const TERMINAL = cardJson(path.join(REPO_ROOT, "examples/themes-and-color-studio")).screen.terminal;

function printed(width: number): string[] {
  const out = new Console({ width, height: TERMINAL.rows, record: true });
  printTour(out);
  return out.exportText().split("\n");
}

// A line wider than the terminal is re-wrapped by the terminal itself, mid-word
// and blind to the styling, so what the reader sees is not what the demo drew.
it("every line the themes demo prints fits the terminal it prints to", () => {
  const lines = printed(TERMINAL.columns);
  expect(lines.filter((line) => cellLen(line) > TERMINAL.columns)).toEqual([]);
});

// The card's terminal keeps no scrollback — the page scrolls, not the terminal
// (docs/.vitepress/theme/live-terminal.ts) — so a tour taller than its rows
// loses its top, title and all. Its card.json has to hold the whole of it.
it("the whole tour fits the rows of its card's terminal", () => {
  expect(printed(TERMINAL.columns).length).toBeLessThanOrEqual(TERMINAL.rows);
});

// The console wraps a line to the terminal before the terminal can, which is
// right for prose. A strip of swatches is a picture, and wrapped it arrives in
// two pieces — so drawn with room to spare, each strip has to fit already.
it("every swatch strip the themes demo lays out fits its card's terminal as drawn", () => {
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
    return cellLen(line) > TERMINAL.columns ? [`${strip}: ${cellLen(line)} cells`] : [];
  });
  expect(misfits).toEqual([]);
});
