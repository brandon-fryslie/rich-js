import { describe, it, expect } from "vitest";
import {
  asCellCol,
  cellLen,
  setCellSize,
  splitText,
  chopCells,
  cellStepFrom,
  cellFit,
  cellFitEnd,
  graphemes,
  asCodePoint,
  splitAtCells,
  cutCells,
  cellColToCodeUnitOffset,
  graphemeBoundary,
  nextGrapheme,
  prevGrapheme,
  asCodeUnit,
  expandTabs,
  parseTabSize,
} from "../../src/core/cells.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts (widths, invariants), not implementation details (caching, slicing)

describe("cellLen", () => {
  it("returns 0 for empty string", () => {
    expect(cellLen("")).toBe(0);
  });

  it("returns correct width for ASCII text", () => {
    expect(cellLen("hello")).toBe(5);
  });

  it("returns correct width for ASCII text with spaces", () => {
    expect(cellLen("hello world")).toBe(11);
  });

  it("returns 2 for a single CJK character", () => {
    expect(cellLen("中")).toBe(2);
  });

  it("returns correct width for multiple CJK characters", () => {
    expect(cellLen("中文")).toBe(4);
  });

  it("returns correct width for mixed ASCII and CJK", () => {
    expect(cellLen("a中b")).toBe(4); // 1 + 2 + 1
  });

  it("gives a line or paragraph separator no cells, as Rich's cell_len does", () => {
    // uv run --with 'rich>=14' python -c 'from rich.cells import cell_len; print(cell_len("a\u2028b"), cell_len("\u2029"))' → 2 0
    expect(cellLen("a\u2028b")).toBe(2);
    expect(cellLen("a\u2029b")).toBe(2);
    expect(cellLen("\u2028\u2029")).toBe(0);
    // A cluster of its own that adds nothing: the jamo either side, one syllable
    // without it, measure apart — as Rich's do, 2 + 0 there.
    expect(cellLen("\u1100\u2028\u1161")).toBe(cellLen("\u1100") + cellLen("\u1161"));
    expect(cellLen("a\u2029\u0301")).toBe(1);
  });

  // Each width below is Rich's: uv run --with 'rich==15' python -c 'from rich.cells import cell_len; print(cell_len("a\u00adb"))'
  it("counts every code point of a cluster, not only its first, as Rich's cell_len does", () => {
    expect(cellLen("\u0915\u093e")).toBe(1); // a Spacing_Mark gets no cell
    expect(cellLen("\u3042\u302e")).toBe(2);
    expect(cellLen("\u0915\u094d\u0937")).toBe(2); // a conjunct is both its consonants
    expect(cellLen("\u0d4e\u0d15")).toBe(2); // a Prepend letter and its base
    expect(cellLen("\u0600a")).toBe(2); // a Prepended_Concatenation_Mark
    expect(cellLen("\u0e01\u0e33")).toBe(2); // Thai sara am
  });

  it("gives Hangul jamo and the soft hyphen Rich's cells", () => {
    expect(cellLen("a\u00adb")).toBe(3);
    expect(cellLen("\u115fa")).toBe(3); // the choseong filler is wide
    expect(cellLen("a\u1161")).toBe(1); // a jungseong alone adds nothing
    expect(cellLen("\u1100\u1161\u11a8")).toBe(2);
  });

  it("lets a ZWJ take the code point after it into its glyph, and VS16 widen the one before, as Rich does", () => {
    expect(cellLen("\u0915\u094d\u200d\u0937")).toBe(1); // a half-form conjunct
    expect(cellLen("\u{1f468}\u200d\u{1f469}\u200d\u{1f467}")).toBe(2);
    expect(cellLen("\u2764")).toBe(1);
    expect(cellLen("\u2764\ufe0f")).toBe(2);
    expect(cellLen("1\ufe0f\u20e3")).toBe(2);
  });

  it("keeps a ZWJ or VS16 inside its own cluster, where Rich lets it reach across", () => {
    // Rich gives each 1 cell more: its ZWJ swallows the `b` of the next cluster,
    // and its VS16 widens the heart a cluster back. Summed by cluster, which
    // every cut between clusters needs, they measure as drawn.
    expect(cellLen("a\u200db")).toBe(2);
    expect(cellLen("\u2764\u1161\ufe0f")).toBe(1);
  });

  it("measures a string as the sum of its grapheme clusters", () => {
    const text = "\u0915\u094d\u0937\u093f \u0e01\u0e33 \u0600\u0661 \u1100\u1161\u11a8 a\u00adb";
    expect(cellLen(text)).toBe(15);
    expect(graphemes(text).reduce((n, g) => n + cellLen(g), 0)).toBe(15);
  });

  it("returns width >= 1 for emoji characters", () => {
    // Emoji are typically 2 cells wide, but at minimum 1
    expect(cellLen("😀")).toBeGreaterThanOrEqual(1);
  });
});

describe("setCellSize", () => {
  it("pads a short ASCII string with spaces", () => {
    const result = setCellSize("hi", asCellCol(5));
    expect(result).toBe("hi   ");
    expect(cellLen(result)).toBe(5);
  });

  it("returns empty string for width 0", () => {
    expect(setCellSize("hello", asCellCol(0))).toBe("");
  });

  it("returns the string unchanged when it already matches the target width", () => {
    expect(setCellSize("hello", asCellCol(5))).toBe("hello");
  });

  it("crops a long ASCII string to the target width", () => {
    const result = setCellSize("hello world", asCellCol(5));
    expect(cellLen(result)).toBe(5);
    expect(result).toBe("hello");
  });

  it("pads a CJK string to the target width", () => {
    const result = setCellSize("中", asCellCol(5));
    expect(cellLen(result)).toBe(5);
    expect(result).toBe("中   ");
  });

  it("crops a CJK string to the target width", () => {
    const result = setCellSize("中文测试", asCellCol(4));
    expect(cellLen(result)).toBe(4);
  });

  it("handles cropping CJK at a boundary that splits a wide character", () => {
    // "中文" is 4 cells; cropping to 3 can't split the second char,
    // so it should take "中" (2 cells) + 1 space pad = 3 cells
    const result = setCellSize("中文", asCellCol(3));
    expect(cellLen(result)).toBe(3);
  });

  it("satisfies invariant: cellLen(setCellSize(text, n)) === n", () => {
    const cases = [
      { text: "", n: asCellCol(5) },
      { text: "hello", n: asCellCol(3) },
      { text: "hello", n: asCellCol(10) },
      { text: "中文测试", n: asCellCol(6) },
      { text: "中文测试", n: asCellCol(3) },
      { text: "a中b", n: asCellCol(2) },
    ];
    for (const { text, n } of cases) {
      expect(cellLen(setCellSize(text, n))).toBe(n);
    }
  });

  it("returns empty string for n=0 (invariant exception per spec)", () => {
    // Spec: cellLen(setCellSize(text, n)) === n unless n is 0
    expect(setCellSize("hello", asCellCol(0))).toBe("");
    expect(setCellSize("中文", asCellCol(0))).toBe("");
    // cellLen("") is 0, so the invariant still holds trivially for n=0
    expect(cellLen(setCellSize("hello", asCellCol(0)))).toBe(0);
  });
});

describe("splitText", () => {
  it('splits at position 0 → ["", text]', () => {
    const [left, right] = splitText("hello", asCellCol(0));
    expect(left).toBe("");
    expect(right).toBe("hello");
  });

  it('splits at end → [text, ""]', () => {
    const [left, right] = splitText("hello", asCellCol(5));
    expect(left).toBe("hello");
    expect(right).toBe("");
  });

  it("splits ASCII text in the middle", () => {
    const [left, right] = splitText("hello", asCellCol(3));
    expect(left).toBe("hel");
    expect(right).toBe("lo");
  });

  it("splits at position beyond text length", () => {
    const [left, right] = splitText("hi", asCellCol(10));
    expect(left).toBe("hi");
    expect(right).toBe("");
  });

  it("splits CJK text at a wide-char boundary", () => {
    // "中文" = 4 cells, split at 2 should cleanly split after first char
    const [left, right] = splitText("中文", asCellCol(2));
    expect(cellLen(left)).toBe(2);
    expect(cellLen(right)).toBe(2);
  });

  it("splits CJK text between wide-char boundaries (padding needed)", () => {
    // "中文" = 4 cells, split at 3 lands in the middle of "文" (a 2-cell char).
    // The wide char stays in the right side; left is padded with a space to reach 3 cells.
    const [left, right] = splitText("中文", asCellCol(3));
    expect(cellLen(left)).toBe(3);
    expect(left).toBe("中 ");
    expect(right).toBe("文");
  });

  it("satisfies invariant: cellLen(left) + cellLen(right) === cellLen(text) for boundary-aligned splits", () => {
    const cases = [
      { text: "hello world", pos: asCellCol(5) },
      { text: "中文测试", pos: asCellCol(4) },
      { text: "中文测试", pos: asCellCol(2) },
      { text: "abc", pos: asCellCol(0) },
      { text: "abc", pos: asCellCol(3) },
    ];
    for (const { text, pos } of cases) {
      const [left, right] = splitText(text, pos);
      expect(cellLen(left) + cellLen(right)).toBe(cellLen(text));
    }
  });

  it("cellLen(left) + cellLen(right) > cellLen(text) for mid-wide-char splits (padding adds width)", () => {
    // When split falls inside a wide char, left gets padding and the wide char
    // stays in right, so the sum exceeds the original width by the padding amount.
    const text = "中文测试"; // 8 cells
    const [left, right] = splitText(text, asCellCol(3));
    expect(cellLen(left)).toBe(3);
    expect(cellLen(right)).toBe(6); // "文测试" = 6 cells
    expect(cellLen(left) + cellLen(right)).toBe(9); // > 8
    expect(cellLen(left) + cellLen(right)).toBeGreaterThan(cellLen(text));
  });

  it("preserves the wide char in right side when splitting mid-wide-character", () => {
    // "中文测试" = 8 cells. Split at 3 falls inside "文".
    // Left: "中" + " " pad = "中 " (3 cells). Right: "文测试" (6 cells).
    const [left, right] = splitText("中文测试", asCellCol(3));
    expect(left).toBe("中 ");
    expect(right).toBe("文测试");
    expect(cellLen(left)).toBe(3);
    expect(cellLen(right)).toBe(6);
  });

  it("splits ASCII text at position 2", () => {
    const [left, right] = splitText("hello", asCellCol(2));
    expect(left).toBe("he");
    expect(right).toBe("llo");
  });

  it('returns ["", text] for negative position', () => {
    const [left, right] = splitText("hello", asCellCol(-1));
    expect(left).toBe("");
    expect(right).toBe("hello");
  });

  it("never cuts inside a glyph built from several code points", () => {
    for (const c of ["⚠️", "👨‍👩‍👧", "👍🏽", "字\u0301"]) {
      expect(splitText(`a${c}b`, asCellCol(2))).toEqual(["a ", `${c}b`]);
    }
  });
});

// Each of these is one glyph built from several code points, and a sum of
// per-code-point widths disagrees with cellLen on every one of them.
const GLYPHS = ["❤️", "👨‍👩‍👧", "🇺🇸", "e\u0301"];

describe("cellFit / cellFitEnd", () => {
  it("keeps a cluster that fits whole", () => {
    for (const c of GLYPHS) {
      expect(cellFit(`${c}ab`, asCellCol(cellLen(c)))).toBe(c);
      expect(cellFitEnd(`ab${c}`, asCellCol(cellLen(c)))).toBe(c);
    }
  });
});

describe("cellStepFrom", () => {
  it("advances past every offset inside the text, at any budget", () => {
    // The guarantee both callers rely on to terminate. A budget narrower than
    // the widest glyph is the case that used to stall.
    for (const text of ["日本語", "a日b", "🎉x", "abc"]) {
      for (const cap of [0, 1, 2, 3]) {
        for (let i = 0; i < text.length; i++) {
          expect(cellStepFrom(text, asCodePoint(i), asCellCol(cap))).toBeGreaterThan(i);
        }
      }
    }
  });

  it("takes as much as fits when the budget allows", () => {
    expect(cellStepFrom("abcd", asCodePoint(0), asCellCol(3))).toBe(3);
    expect(cellStepFrom("中文", asCodePoint(0), asCellCol(3))).toBe(1);
  });

  it("force-takes a whole glyph too wide for the budget", () => {
    // Overflows cap by the glyph's own width rather than returning startCU.
    expect(cellStepFrom("中文", asCodePoint(0), asCellCol(1))).toBe(1);
    // Surrogate pair: the step covers both code units, never half of one.
    expect(cellStepFrom("🎉x", asCodePoint(0), asCellCol(1))).toBe(2);
  });

  it("does not advance past the end of the text", () => {
    expect(cellStepFrom("abc", asCodePoint(3), asCellCol(5))).toBe(3);
  });
});

describe("chopCells", () => {
  it("cuts between glyphs of several code points, never inside one", () => {
    const text = "👍🏽a漢👨‍👩‍👧字";
    expect(chopCells(text, asCellCol(2))).toEqual(["👍🏽", "a", "漢", "👨‍👩‍👧", "字"]);
  });

  it("returns single-element array when text fits within width", () => {
    const result = chopCells("hello", asCellCol(10));
    expect(result).toEqual(["hello"]);
  });

  it("returns single-element array when text exactly matches width", () => {
    const result = chopCells("hello", asCellCol(5));
    expect(result).toEqual(["hello"]);
  });

  it("splits into multiple lines when text exceeds width", () => {
    const result = chopCells("hello world", asCellCol(5));
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(5);
    }
  });

  it("returns [text] for empty string", () => {
    expect(chopCells("", asCellCol(5))).toEqual([""]);
  });

  it("returns [text] for width 0", () => {
    expect(chopCells("hello", asCellCol(0))).toEqual(["hello"]);
  });

  it("chops CJK text respecting character boundaries", () => {
    // "中文测试" = 8 cells, width=3 → lines of at most 3 cells each
    const result = chopCells("中文测试", asCellCol(3));
    expect(result.length).toBeGreaterThan(1);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(3);
    }
  });

  it("chops CJK text with even width preserving total width", () => {
    // "中文测试" = 8 cells, width=4 → splits on exact wide-char boundaries
    const result = chopCells("中文测试", asCellCol(4));
    expect(result.length).toBe(2);
    for (const line of result) {
      expect(cellLen(line)).toBeLessThanOrEqual(4);
    }
    const totalCells = result.reduce((sum, line) => sum + cellLen(line), 0);
    expect(totalCells).toBe(cellLen("中文测试"));
  });

  it("chops single-character-width lines", () => {
    const result = chopCells("abc", asCellCol(1));
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("preserves total content across lines for ASCII", () => {
    const text = "abcdefghij";
    const result = chopCells(text, asCellCol(3));
    const joined = result.join("");
    expect(joined).toBe(text);
  });

  it("force-takes a glyph wider than the whole budget", () => {
    // A 2-cell glyph cannot be split to fit 1 cell; each line overflows by its
    // own width rather than the loop stalling on an unsplittable remainder.
    expect(chopCells("日本語", asCellCol(1))).toEqual(["日", "本", "語"]);
  });

  it("never emits a line for zero consumed input", () => {
    // The regression this pins: a budget narrower than the widest glyph used to
    // emit a padded blank line forever, so the line count grew without bound
    // while the input never shrank.
    for (const text of ["日本語", "a日b", "🎉🎉", "中a中"]) {
      for (const width of [1, 2, 3]) {
        const lines = chopCells(text, asCellCol(width));
        expect(lines.join("")).toBe(text);
        expect(lines.every((line) => line.length > 0)).toBe(true);
      }
    }
  });

  it("returns [text] for a maxWidth of zero or less, overflowing by the whole string", () => {
    // The docstring's overflow bound covers this: no budget at all, so nothing
    // can be met and the text comes back whole.
    expect(chopCells("hello", asCellCol(0))).toEqual(["hello"]);
    expect(chopCells("hello", asCellCol(-3))).toEqual(["hello"]);
  });

  it("does not pad short lines out to the budget", () => {
    // splitText pads to land exactly on the requested column; chopping must not
    // — a padded line is content the caller never wrote.
    expect(chopCells("中文测试", asCellCol(3))).toEqual(["中", "文", "测", "试"]);
  });
});

describe("splitAtCells", () => {
  it("counts a glyph of several code points by the cells it takes", () => {
    expect(splitAtCells("👍🏽a漢", [asCellCol(2), asCellCol(3)])).toEqual(["👍🏽", "a", "漢"]);
  });
});

describe("cutCells", () => {
  const cases: [string, number[], string[]][] = [
    ["abc", [], ["abc"]],
    ["abc", [1, 1], ["a", "", "bc"]],
    ["a漢b", [1, 2], ["a", " ", " b"]],
    ["a漢b", [2, 2, 3], ["a ", "", " ", "b"]],
    ["a👨‍👩‍👧b", [1, 2, 3], ["a", " ", " ", "b"]],
    ["e\u0301x", [1], ["e\u0301", "x"]],
  ];
  for (const [text, positions, pieces] of cases) {
    it(`cuts ${JSON.stringify(text)} at ${JSON.stringify(positions)} into pieces as wide as the distance between cuts`, () => {
      expect(cutCells(text, positions.map(asCellCol))).toEqual(pieces);
    });
  }
});

describe("cellColToCodeUnitOffset", () => {
  it("never lands inside a glyph of several code points", () => {
    expect(cellColToCodeUnitOffset("👍🏽a", asCellCol(1))).toBe(0);
    expect(cellColToCodeUnitOffset("👍🏽a", asCellCol(2))).toBe("👍🏽".length);
  });
});

describe("every width walk cuts between grapheme clusters", () => {
  const text = `a${GLYPHS.join("b")}c`;
  const width = cellLen(text);
  // The code-unit offsets that fall between clusters, each with the cells
  // before it: the only places any walk may cut.
  const cuts = new Map<number, number>([[0, 0]]);
  let offset = 0;
  let cells = 0;
  for (const cluster of graphemes(text)) {
    offset += cluster.length;
    cells += cellLen(cluster);
    cuts.set(offset, cells);
  }
  const caps = Array.from({ length: width + 2 }, (_, cap) => asCellCol(cap));
  /** The cells before `at`, failing when `at` falls inside a cluster. */
  const cellsBefore = (at: number): number => {
    expect(cuts.has(at), `offset ${at} is inside a cluster`).toBe(true);
    return cuts.get(at)!;
  };

  it("cellFit and cellFitEnd take whole clusters within the cap", () => {
    for (const cap of caps) {
      const head = cellFit(text, cap);
      expect(cellsBefore(head.length)).toBeLessThanOrEqual(cap);
      const tail = cellFitEnd(text, cap);
      expect(width - cellsBefore(text.length - tail.length)).toBeLessThanOrEqual(cap);
    }
  });

  it("splitText and setCellSize cut between clusters and pad to exactly the cap", () => {
    for (const cap of caps.filter((c) => c <= width)) {
      const [left, right] = splitText(text, cap);
      const at = text.length - right.length;
      expect(cellsBefore(at)).toBeLessThanOrEqual(cap);
      expect(left).toBe(text.slice(0, at) + " ".repeat(cap - cellsBefore(at)));
      expect(setCellSize(text, cap)).toBe(left);
    }
  });

  it("cellFitFrom's callers stop between clusters, over the cap only to force-take one", () => {
    for (const [start, startCells] of cuts) {
      for (const cap of caps) {
        const end = cellStepFrom(text, asCodePoint(start), cap);
        const taken = cellsBefore(end) - startCells;
        const oneCluster = graphemes(text.slice(start, end)).length === 1;
        expect(taken <= cap || oneCluster, `${start}+${cap} took ${taken}`).toBe(true);
      }
    }
    for (const cap of caps) {
      expect(cellsBefore(cellColToCodeUnitOffset(text, cap))).toBeLessThanOrEqual(cap);
    }
    for (const cap of caps.filter((c) => c > 0)) {
      const lines = chopCells(text, cap);
      expect(lines.join("")).toBe(text);
      let at = 0;
      for (const line of lines) {
        const before = cellsBefore(at);
        at += line.length;
        expect(cellsBefore(at) - before <= cap || graphemes(line).length === 1).toBe(true);
      }
    }
  });

  it("splitAtCells cuts at the first cluster boundary at or past each cut", () => {
    for (const cap of caps) {
      const pieces = splitAtCells(text, [cap]);
      expect(pieces.join("")).toBe(text);
      const at = pieces[0]!.length;
      const first = [...cuts].find(([, c]) => c >= cap)?.[0] ?? text.length;
      expect(at).toBe(first);
    }
  });
});

describe("graphemeBoundary", () => {
  it("keeps a boundary, moves an offset inside a glyph to its end, and stops at the string's end", () => {
    const s = "a👍🏽b";
    expect([0, 1, 2, 3, 4, 5, 6, 40].map((cu) => graphemeBoundary(s, asCodeUnit(cu)))).toEqual([0, 1, 5, 5, 5, 5, 6, 6]);
  });
});

describe("nextGrapheme / prevGrapheme", () => {
  it("step over each whole glyph, and stop at either end", () => {
    for (const glyph of ["❤️", "👨‍👩‍👧", "🇺🇸", "e\u0301"]) {
      const s = `a${glyph}b`;
      expect(nextGrapheme(s, asCodePoint(1))).toBe(1 + glyph.length);
      expect(prevGrapheme(s, asCodePoint(1 + glyph.length))).toBe(1);
      expect(nextGrapheme(s, asCodePoint(s.length))).toBe(s.length);
      expect(prevGrapheme(s, asCodePoint(0))).toBe(0);
    }
  });
});

describe("expandTabs", () => {
  it("counts the column in cells, so a wide glyph moves the stop", () => {
    expect(expandTabs("日\tx", parseTabSize(4)).text).toBe("日  x");
  });

  it("moves each offset past every tab that widened before it", () => {
    const { text, offsetOf } = expandTabs("a\tb\tc", parseTabSize(4));
    expect(text).toBe("a   b   c");
    expect([0, 1, 2, 3, 4, 5].map(offsetOf)).toEqual([0, 1, 4, 5, 8, 9]);
  });

  it("leaves text without a tab as it is", () => {
    const { text, offsetOf } = expandTabs("plain", parseTabSize(8));
    expect(text).toBe("plain");
    expect(offsetOf(3)).toBe(3);
  });
});
