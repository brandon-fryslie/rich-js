import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { isBidi, lineLevels, paragraph, REMOVED, visualOrder, type ParagraphLevel } from "../../src/core/bidi.js";

// The Unicode Consortium's own conformance data, BidiCharacterTest.txt 17.0.0,
// the version scripts/bidi-data.py pins. Gzipped: 6.9 MB plain.
const CASES = gunzipSync(readFileSync(new URL("./BidiCharacterTest.txt.gz", import.meta.url)))
  .toString("utf-8")
  .split("\n")
  .filter((line) => line !== "" && !line.startsWith("#"));

describe("UAX #9 conformance", () => {
  test("BidiCharacterTest.txt, every case", () => {
    const failures: string[] = [];
    for (const line of CASES) {
      const [hex, direction, resolved, levels, order] = line.split(";") as [string, string, string, string, string];
      const codePoints = hex.split(" ").map((code) => parseInt(code, 16));
      const text = String.fromCodePoint(...codePoints);
      const stated = direction === "2" ? undefined : (Number(direction) as ParagraphLevel);
      const found = paragraph(text, stated);
      const units = lineLevels(text, found.levels, found.level);
      // The file counts code points; `levels` index code units.
      let unit = 0;
      const finished = codePoints.map((codePoint) => {
        const level = units[unit]!;
        unit += codePoint > 0xffff ? 2 : 1;
        return level;
      });

      const shown = finished.map((level) => (level === REMOVED ? "x" : String(level))).join(" ");
      const ordered = visualOrder(finished).join(" ");
      if (found.level !== Number(resolved) || shown !== levels || ordered !== order) failures.push(line);
    }
    expect(failures.slice(0, 5)).toEqual([]);
    expect(CASES).toHaveLength(91707);
  });
});

describe("isBidi", () => {
  test("answers for what the algorithm can act on", () => {
    expect(isBidi("plain ascii, 123 (brackets)")).toBe(false);
    expect(isBidi("héllo wörld")).toBe(false);
    expect(isBidi("א")).toBe(true);
    expect(isBidi("ا")).toBe(true);
    expect(isBidi("٠")).toBe(true);
    expect(isBidi("‬")).toBe(true);
    expect(isBidi("⁩")).toBe(true);
  });

  test("a line it refuses is level 0 throughout", () => {
    const { level, levels } = paragraph("abc 123, (x) -- 4.5");
    expect(level).toBe(0);
    expect(new Set(levels)).toEqual(new Set([0]));
  });
});

describe("levels index code units", () => {
  test("both units of a surrogate pair carry one level", () => {
    const { levels } = paragraph("א\u{1f600}ב", 1);
    expect(levels).toHaveLength(4);
    expect(levels[1]).toBe(levels[2]);
  });
});
