/// <reference lib="dom" />
/**
 * Every glyph of an exported SVG is drawn on its terminal cells, whatever font
 * the browser draws it in. The numbers `encodeSvg` writes are pinned in
 * test/core/export-svg.test.ts and the golden files beside it; whether a
 * browser honours them — `textLength` stretching each chunk to its cells, a CJK
 * glyph from a fallback font filling exactly two — is the property only a
 * browser can show.
 *
 * Both edges of every grapheme are checked. A wide grapheme is a chunk of its
 * own, so its left edge is only the `x` written for it read back; its right
 * edge is where the stretch shows. The long ASCII row is one chunk, so a font
 * advance a fraction of a pixel off 12.2 adds up along it to several pixels —
 * far past the tolerance — if the stretch is lost.
 *
 * Chromium only: this config defines one project, so alignment in Firefox and
 * WebKit is unverified.
 */
import { test, expect } from "@playwright/test";
import { Console } from "../src/core/console.js";

const CELL_WIDTH = 12.2;

// Each row's graphemes with the column each starts at and the cells it
// covers, counted by hand rather than by `cellLen`, so the check does not
// share the arithmetic it checks: CJK and the emoji take two cells, `e` with
// its two combining marks takes one.
type Cell = readonly [grapheme: string, column: number, cells: number];

const MIXED: readonly Cell[] = [
  ["a", 0, 1], ["b", 1, 1], ["漢", 2, 2], ["字", 4, 2], ["c", 6, 1], ["d", 7, 1], ["😀", 8, 2],
  ["e", 10, 1], ["f", 11, 1], [" ", 12, 1], ["é̂", 13, 1], ["x", 14, 1],
];
const ASCII: readonly Cell[] = Array.from("the quick brown fox jumps over", (grapheme, column) => [grapheme, column, 1]);

test("every grapheme's glyph spans its columns × 12.2", async ({ page }) => {
  const terminal = new Console({ record: true, width: 40, highlight: false, environment: { env: {} }, file: { write: () => true } });
  for (const row of [MIXED, ASCII]) terminal.print(row.map(([grapheme]) => grapheme).join(""));
  await page.setContent(terminal.exportSvg());

  const drawn = await page.evaluate(() => {
    const segmenter = new Intl.Segmenter();
    const texts = document.querySelectorAll<SVGTextElement>('[class$="-matrix"] text');
    return Array.from(texts).flatMap((text) =>
      Array.from(segmenter.segment(text.textContent ?? ""), ({ segment, index }) => {
        const { x, width } = text.getExtentOfChar(index);
        return [segment, x, x + width] as const;
      }),
    );
  });

  const expected = [...MIXED, ...ASCII];
  expect(drawn.map(([grapheme]) => grapheme)).toEqual(expected.map(([grapheme]) => grapheme));
  drawn.forEach(([grapheme, left, right], i) => {
    const [, column, cells] = expected[i]!;
    const at = `${JSON.stringify(grapheme)} at columns ${column}–${column + cells} drawn at x=${left}–${right}`;
    expect(Math.abs(left - column * CELL_WIDTH), at).toBeLessThanOrEqual(0.5);
    expect(Math.abs(right - (column + cells) * CELL_WIDTH), at).toBeLessThanOrEqual(0.5);
  });
});
