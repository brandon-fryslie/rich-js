/**
 * Terminals, modelled over the bytes rich-js writes: what each shows, as rows of
 * characters left to right. The tests that read a row do it here, so "reads
 * correctly" is a fact about the wire and not about a drawing step.
 *
 * `implicit` is a terminal that runs UAX #9 on each row with an LTR paragraph,
 * built on the algorithm `test/core/bidi.test.ts` proves on the UCD's own data.
 * `implicitVte` also discards every zero-width character at a row's column 0, as
 * VTE's `Terminal::insert_char` does. `none` shows characters as they arrive.
 */

import { lineLevels, mirrored, paragraph, visualOrder } from "../../src/core/bidi.js";
import { codePointWidth } from "../../src/core/cell-widths.js";

const ESCAPES = /\x1b\[[0-9;]*m|\x1b\]8;[^\x1b\x07]*(?:\x1b\\|\x07)/g;

/** `bytes` as rows of what a terminal keeps of them, escapes gone. */
export function rows(bytes: string): string[] {
  return bytes.replace(ESCAPES, "").split("\n");
}

/** A row on a terminal that shows characters as they arrive. */
export const none = (row: string): string => row;

/** A row on a terminal that runs UAX #9 on it, its paragraph left to right. */
export function implicit(row: string): string {
  const { level, levels } = paragraph(row, 0);
  const finished = lineLevels(row, levels, level);
  const shown = visualOrder(finished).map((unit) => row[unit]!);
  return shown.join("").replace(/[\u202a-\u202e\u2066-\u2069]/g, "");
}

/** `row` as VTE sees it: a zero-width character with no cell before it is discarded. */
export function atColumnZero(row: string): string {
  const characters = Array.from(row);
  let first = 0;
  while (first < characters.length && codePointWidth(characters[first]!.codePointAt(0)!) === 0) first += 1;
  return characters.slice(first).join("");
}

/** A row on VTE: `implicit`, after what column 0 discards. */
export const implicitVte = (row: string): string => implicit(atColumnZero(row));

/**
 * A row on kitty with its default `force_ltr no` (`kitty/fonts.c`): split at
 * every space into runs shaped alone, a run whose first character of a script
 * other than Common and Inherited is Arabic or Hebrew reversed by cluster and
 * mirrored, as HarfBuzz shapes it right to left. Modelled for one font, so a run
 * ends nowhere else.
 */
export function kitty(row: string): string {
  return row
    .split(/([  ])/)
    .map((run) => {
      const scripted = Array.from(run).find((character) => !/[\p{Script=Common}\p{Script=Inherited}]/u.test(character));
      if (scripted === undefined || !/[\p{Script=Arabic}\p{Script=Hebrew}]/u.test(scripted)) return run;
      const clusters = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(run), ({ segment }) => segment);
      return clusters.map((cluster) => String.fromCodePoint(mirrored(cluster.codePointAt(0)!)) + Array.from(cluster).slice(1).join("")).reverse().join("");
    })
    .join("");
}

/** Whether every explicit control in `row` stands in a balanced nest, so nothing reaches past the row. */
export function balancedControls(row: string): boolean {
  const open: string[] = [];
  for (const character of row) {
    if (/[\u202a\u202b\u202d\u202e]/.test(character)) open.push("embedding");
    else if (/[\u2066-\u2068]/.test(character)) open.push("isolate");
    else if (character === "\u202c" && open.pop() !== "embedding") return false;
    else if (character === "\u2069" && open.pop() !== "isolate") return false;
  }
  return open.length === 0;
}

