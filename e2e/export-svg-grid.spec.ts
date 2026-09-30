/// <reference lib="dom" />
/**
 * Every glyph of an exported SVG is drawn on its terminal cell, whatever font
 * the browser draws it in. The numbers `encodeSvg` writes are pinned in
 * test/core/export-svg.test.ts and the golden files beside it; whether a
 * browser honours them — `textLength` stretching each chunk to its cells, a CJK
 * glyph from a fallback font landing two cells on — is the property only a
 * browser can show.
 *
 * Chromium only: this config defines one project, so alignment in Firefox and
 * WebKit is unverified.
 */
import { test, expect } from "@playwright/test";
import { Console } from "../src/core/console.js";

const CELL_WIDTH = 12.2;

// Every grapheme of the row and the column it starts at, counted by hand
// rather than by `cellLen`, so the check does not share the arithmetic it
// checks: CJK and the emoji take two cells, `e` with its two marks takes one.
const ROW = "ab漢字cd😀ef é̂x";
const COLUMNS: readonly (readonly [string, number])[] = [
  ["a", 0], ["b", 1], ["漢", 2], ["字", 4], ["c", 6], ["d", 7], ["😀", 8],
  ["e", 10], ["f", 11], [" ", 12], ["é̂", 13], ["x", 14],
];

test("every grapheme's glyph starts at its column × 12.2", async ({ page }) => {
  const terminal = new Console({ record: true, width: 20, highlight: false, environment: { env: {} }, file: { write: () => true } });
  terminal.print(ROW);
  await page.setContent(terminal.exportSvg());

  const drawn = await page.evaluate(() => {
    const segmenter = new Intl.Segmenter();
    const texts = document.querySelectorAll<SVGTextElement>('[class$="-matrix"] text');
    return Array.from(texts).flatMap((text) =>
      Array.from(segmenter.segment(text.textContent ?? ""), ({ segment, index }) =>
        [segment, text.getExtentOfChar(index).x] as const),
    );
  });

  expect(drawn.map(([grapheme]) => grapheme)).toEqual(COLUMNS.map(([grapheme]) => grapheme));
  drawn.forEach(([grapheme, x], i) => {
    const column = COLUMNS[i]![1];
    expect(Math.abs(x - column * CELL_WIDTH), `${grapheme} at column ${column} drawn at x=${x}`).toBeLessThanOrEqual(0.5);
  });
});
