import { describe, it, expect } from "vitest";
import { Segment, ControlType } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { ControlCode } from "../../src/core/segment.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

// --- Helpers ---

/** Collect an iterable into an array. */
function collect<T>(iter: Iterable<T>): T[] {
  return [...iter];
}

/** Extract text from segments for concise assertions. */
function texts(segments: Segment[]): string[] {
  return segments.map((s) => s.text);
}

// --- Construction ---

describe("Segment construction", () => {
  it("constructs with text only", () => {
    const seg = new Segment("hello");
    expect(seg.text).toBe("hello");
    expect(seg.style).toBeUndefined();
    expect(seg.control).toBeUndefined();
  });

  it("constructs with text and style", () => {
    const style = new Style({ bold: true });
    const seg = new Segment("hello", style);
    expect(seg.text).toBe("hello");
    expect(seg.style).toBe(style);
    expect(seg.control).toBeUndefined();
  });

  it("constructs with text, style, and control", () => {
    const style = new Style({ bold: true });
    const control: ControlCode[] = [[ControlType.BELL]];
    const seg = new Segment("", style, control);
    expect(seg.text).toBe("");
    expect(seg.style).toBe(style);
    expect(seg.control).toBe(control);
  });

  it("constructs a control segment with no style", () => {
    const control: ControlCode[] = [[ControlType.HOME]];
    const seg = new Segment("", undefined, control);
    expect(seg.style).toBeUndefined();
    expect(seg.control).toBe(control);
  });
});

// --- Properties ---

describe("Segment properties", () => {
  describe(".text", () => {
    it("returns the segment text", () => {
      expect(new Segment("abc").text).toBe("abc");
    });

    it("returns empty string for empty segment", () => {
      expect(new Segment("").text).toBe("");
    });
  });

  describe(".style", () => {
    it("returns undefined when no style provided", () => {
      expect(new Segment("x").style).toBeUndefined();
    });

    it("returns the style when provided", () => {
      const s = new Style({ italic: true });
      expect(new Segment("x", s).style).toBe(s);
    });
  });

  describe(".control", () => {
    it("returns undefined for text segments", () => {
      expect(new Segment("x").control).toBeUndefined();
    });

    it("returns the control codes for control segments", () => {
      const codes: ControlCode[] = [[ControlType.CLEAR]];
      expect(new Segment("", undefined, codes).control).toBe(codes);
    });
  });

  describe(".cellLength", () => {
    it("returns cell width for ASCII text", () => {
      expect(new Segment("hello").cellLength).toBe(5);
    });

    it("returns 0 for empty text", () => {
      expect(new Segment("").cellLength).toBe(0);
    });

    it("returns 0 for control segments regardless of text content", () => {
      const seg = new Segment("ignored", undefined, [[ControlType.BELL]]);
      expect(seg.cellLength).toBe(0);
    });

    it("returns correct width for CJK text", () => {
      expect(new Segment("中文").cellLength).toBe(4);
    });
  });

  describe(".hasText", () => {
    it("returns true when text is non-empty", () => {
      expect(new Segment("x").hasText).toBe(true);
    });

    it("returns false when text is empty", () => {
      expect(new Segment("").hasText).toBe(false);
    });
  });

  describe(".isControl", () => {
    it("returns false for text segments", () => {
      expect(new Segment("hello").isControl).toBe(false);
    });

    it("returns true when control codes are present", () => {
      expect(
        new Segment("", undefined, [[ControlType.HOME]]).isControl,
      ).toBe(true);
    });
  });
});

// --- .splitCells() ---

describe("Segment.splitCells()", () => {
  it("splits within ASCII text", () => {
    const seg = new Segment("hello", new Style({ bold: true }));
    const [left, right] = seg.splitCells(3);
    expect(left.text).toBe("hel");
    expect(right.text).toBe("lo");
    // Style is preserved on both halves
    expect(left.style).toBe(seg.style);
    expect(right.style).toBe(seg.style);
  });

  it("returns [self, empty] when position equals cellLength", () => {
    const seg = new Segment("hello");
    const [left, right] = seg.splitCells(5);
    expect(left).toBe(seg);
    expect(right.text).toBe("");
  });

  it("returns [self, empty] when position exceeds cellLength", () => {
    const seg = new Segment("hi");
    const [left, right] = seg.splitCells(99);
    expect(left).toBe(seg);
    expect(right.text).toBe("");
  });

  it("returns [empty, self] when position is 0", () => {
    const seg = new Segment("hello");
    const [left, right] = seg.splitCells(0);
    expect(left.text).toBe("");
    expect(right).toBe(seg);
  });

  it("returns [empty, self] when position is negative", () => {
    const seg = new Segment("hello");
    const [left, right] = seg.splitCells(-1);
    expect(left.text).toBe("");
    expect(right).toBe(seg);
  });

  it("splits CJK text at a double-width boundary", () => {
    const seg = new Segment("中文");
    const [left, right] = seg.splitCells(2);
    expect(left.cellLength).toBe(2);
    expect(right.cellLength).toBe(2);
  });
});

// --- Segment.line() ---

describe("Segment.line()", () => {
  it("returns a newline segment", () => {
    const nl = Segment.line();
    expect(nl.text).toBe("\n");
    expect(nl.style).toBeUndefined();
    expect(nl.control).toBeUndefined();
  });
});

// --- Segment.applyStyle() ---

describe("Segment.applyStyle()", () => {
  it("applies a style to text segments", () => {
    const bold = new Style({ bold: true });
    const seg = new Segment("hello");
    const result = collect(Segment.applyStyle([seg], bold));
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("hello");
    expect(result[0]!.style?.bold).toBe(true);
  });

  it("merges base style with segment style", () => {
    const base = new Style({ bold: true });
    const seg = new Segment("hello", new Style({ italic: true }));
    const result = collect(Segment.applyStyle([seg], base));
    expect(result[0]!.style?.bold).toBe(true);
    expect(result[0]!.style?.italic).toBe(true);
  });

  it("skips control segments (yields them unchanged)", () => {
    const bold = new Style({ bold: true });
    const ctrl = new Segment("", undefined, [[ControlType.BELL]]);
    const result = collect(Segment.applyStyle([ctrl], bold));
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ctrl);
  });

  it("applies postStyle after main style", () => {
    const base = new Style({ bold: true });
    const post = new Style({ italic: true });
    const seg = new Segment("hello");
    const result = collect(Segment.applyStyle([seg], base, post));
    expect(result[0]!.style?.bold).toBe(true);
    expect(result[0]!.style?.italic).toBe(true);
  });

  it("applies postStyle even when no base style", () => {
    const post = new Style({ underline: true });
    const seg = new Segment("hello");
    const result = collect(Segment.applyStyle([seg], undefined, post));
    expect(result[0]!.style?.underline).toBe(true);
  });

  it("yields unchanged segments when no styles given", () => {
    const seg = new Segment("hello", new Style({ bold: true }));
    const result = collect(Segment.applyStyle([seg]));
    expect(result[0]!.text).toBe("hello");
    expect(result[0]!.style?.bold).toBe(true);
  });
});

// --- Segment.filterControl() ---

describe("Segment.filterControl()", () => {
  const textSeg = new Segment("hello");
  const ctrlSeg = new Segment("", undefined, [[ControlType.BELL]]);
  const mixed = [textSeg, ctrlSeg, new Segment("world")];

  it("filters to text segments only (isControl=false)", () => {
    const result = collect(Segment.filterControl(mixed, false));
    expect(result).toHaveLength(2);
    expect(texts(result)).toEqual(["hello", "world"]);
  });

  it("filters to control segments only (isControl=true)", () => {
    const result = collect(Segment.filterControl(mixed, true));
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ctrlSeg);
  });

  it("returns empty for no matches", () => {
    const result = collect(Segment.filterControl([textSeg], true));
    expect(result).toHaveLength(0);
  });
});

// --- Segment.splitLines() ---

describe("Segment.splitLines()", () => {
  it("returns single line when no newlines", () => {
    const segs = [new Segment("hello"), new Segment(" world")];
    const lines = Segment.splitLines(segs);
    expect(lines).toHaveLength(1);
    expect(texts(lines[0]!)).toEqual(["hello", " world"]);
  });

  it("splits at newline within a single segment", () => {
    const lines = Segment.splitLines([new Segment("hello\nworld")]);
    expect(lines).toHaveLength(2);
    expect(texts(lines[0]!)).toEqual(["hello"]);
    expect(texts(lines[1]!)).toEqual(["world"]);
  });

  it("handles multiple newlines in one segment", () => {
    const lines = Segment.splitLines([new Segment("a\nb\nc")]);
    expect(lines).toHaveLength(3);
    expect(texts(lines[0]!)).toEqual(["a"]);
    expect(texts(lines[1]!)).toEqual(["b"]);
    expect(texts(lines[2]!)).toEqual(["c"]);
  });

  // Trailing newline is a line terminator, not a separator — consistent with
  // Python Rich's Segment.split_lines which does NOT emit a trailing empty line.
  it("trailing newline does not produce an empty trailing line", () => {
    const lines = Segment.splitLines([new Segment("hello\n")]);
    expect(lines).toHaveLength(1);
    expect(texts(lines[0]!)).toEqual(["hello"]);
  });

  it("preserves styles when splitting", () => {
    const style = new Style({ bold: true });
    const lines = Segment.splitLines([new Segment("a\nb", style)]);
    expect(lines[0]![0]!.style).toBe(style);
    expect(lines[1]![0]!.style).toBe(style);
  });

  it("handles multiple segments per line", () => {
    const segs = [
      new Segment("hello "),
      new Segment("world\n"),
      new Segment("foo"),
    ];
    const lines = Segment.splitLines(segs);
    expect(lines).toHaveLength(2);
    expect(texts(lines[0]!)).toEqual(["hello ", "world"]);
    expect(texts(lines[1]!)).toEqual(["foo"]);
  });

  it("returns empty array for empty input", () => {
    const lines = Segment.splitLines([]);
    expect(lines).toHaveLength(0);
  });

  // Bare newline produces a single empty line (line terminator semantics).
  it("bare newline produces one empty line", () => {
    const lines = Segment.splitLines([new Segment("\n")]);
    expect(lines).toHaveLength(1);
    expect(lines[0]!).toEqual([]);
  });
});

// --- Segment.adjustLineLength() ---

describe("Segment.adjustLineLength()", () => {
  it("pads a short line with spaces", () => {
    const line = [new Segment("hi")];
    const result = Segment.adjustLineLength(line, 5);
    const totalWidth = Segment.getLineLength(result);
    expect(totalWidth).toBe(5);
    // Pad segment is the second element
    expect(result).toHaveLength(2);
    expect(result[1]!.text).toBe("   ");
  });

  it("pads with the given style", () => {
    const padStyle = new Style({ bold: true });
    const line = [new Segment("hi")];
    const result = Segment.adjustLineLength(line, 5, padStyle);
    expect(result[1]!.style).toBe(padStyle);
  });

  it("crops a long line to width", () => {
    const line = [new Segment("hello world")];
    const result = Segment.adjustLineLength(line, 5);
    expect(Segment.getLineLength(result)).toBe(5);
  });

  it("returns the line unchanged when it matches width exactly", () => {
    const line = [new Segment("hello")];
    const result = Segment.adjustLineLength(line, 5);
    expect(result).toBe(line);
  });

  it("does not pad when pad=false", () => {
    const line = [new Segment("hi")];
    const result = Segment.adjustLineLength(line, 5, undefined, false);
    expect(result).toBe(line);
    expect(Segment.getLineLength(result)).toBe(2);
  });

  it("still crops when pad=false and line is too long", () => {
    const line = [new Segment("hello world")];
    const result = Segment.adjustLineLength(line, 5, undefined, false);
    expect(Segment.getLineLength(result)).toBe(5);
  });

  it("crops across multiple segments", () => {
    const line = [new Segment("hello"), new Segment(" world")];
    const result = Segment.adjustLineLength(line, 7);
    expect(Segment.getLineLength(result)).toBe(7);
  });
});

// --- Segment.getLineLength() ---

describe("Segment.getLineLength()", () => {
  it("returns total cell width of all segments", () => {
    const line = [new Segment("hello"), new Segment(" world")];
    expect(Segment.getLineLength(line)).toBe(11);
  });

  it("ignores control segments", () => {
    const line = [
      new Segment("hello"),
      new Segment("", undefined, [[ControlType.BELL]]),
    ];
    expect(Segment.getLineLength(line)).toBe(5);
  });

  it("returns 0 for empty line", () => {
    expect(Segment.getLineLength([])).toBe(0);
  });

  it("handles CJK characters", () => {
    const line = [new Segment("中文")]; // 4 cells
    expect(Segment.getLineLength(line)).toBe(4);
  });
});

// --- Segment.getShape() ---

describe("Segment.getShape()", () => {
  it("returns max width and height", () => {
    const lines = [
      [new Segment("hello")],       // 5
      [new Segment("hello world")], // 11
      [new Segment("hi")],          // 2
    ];
    expect(Segment.getShape(lines)).toEqual([11, 3]);
  });

  it("returns [0, 0] for empty input", () => {
    expect(Segment.getShape([])).toEqual([0, 0]);
  });

  it("returns [0, 1] for one empty line", () => {
    expect(Segment.getShape([[]])).toEqual([0, 1]);
  });

  it("handles single line", () => {
    expect(Segment.getShape([[new Segment("abc")]])).toEqual([3, 1]);
  });
});

// --- Segment.simplify() ---

describe("Segment.simplify()", () => {
  it("merges contiguous segments with same style", () => {
    const style = new Style({ bold: true });
    const segs = [
      new Segment("hello", style),
      new Segment(" world", style),
    ];
    const result = collect(Segment.simplify(segs));
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("hello world");
  });

  it("merges contiguous segments with no style (both undefined)", () => {
    const segs = [new Segment("hello"), new Segment(" world")];
    const result = collect(Segment.simplify(segs));
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("hello world");
  });

  it("keeps segments with different styles separate", () => {
    const bold = new Style({ bold: true });
    const italic = new Style({ italic: true });
    const segs = [new Segment("a", bold), new Segment("b", italic)];
    const result = collect(Segment.simplify(segs));
    expect(result).toHaveLength(2);
    expect(result[0]!.text).toBe("a");
    expect(result[1]!.text).toBe("b");
  });

  it("handles single segment", () => {
    const seg = new Segment("hello");
    const result = collect(Segment.simplify([seg]));
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe("hello");
  });

  it("handles empty input", () => {
    const result = collect(Segment.simplify([]));
    expect(result).toHaveLength(0);
  });
});

// --- Segment.stripLinks() ---

describe("Segment.stripLinks()", () => {
  it("removes link from styled segments", () => {
    const style = new Style({ bold: true, link: "https://example.com" });
    const seg = new Segment("click", style);
    const result = collect(Segment.stripLinks([seg]));
    expect(result[0]!.text).toBe("click");
    expect(result[0]!.style?.link).toBeUndefined();
    expect(result[0]!.style?.bold).toBe(true);
  });

  it("passes through segments without links unchanged", () => {
    const seg = new Segment("hello", new Style({ bold: true }));
    const result = collect(Segment.stripLinks([seg]));
    expect(result[0]).toBe(seg);
  });

  it("passes through segments with no style", () => {
    const seg = new Segment("hello");
    const result = collect(Segment.stripLinks([seg]));
    expect(result[0]).toBe(seg);
  });
});

// --- Segment.stripStyles() ---

describe("Segment.stripStyles()", () => {
  it("removes all styles from segments", () => {
    const style = new Style({ bold: true, italic: true });
    const seg = new Segment("hello", style);
    const result = collect(Segment.stripStyles([seg]));
    expect(result[0]!.text).toBe("hello");
    expect(result[0]!.style).toBeUndefined();
  });

  it("preserves text", () => {
    const seg = new Segment("hello");
    const result = collect(Segment.stripStyles([seg]));
    expect(result[0]!.text).toBe("hello");
  });
});

// --- Segment.removeColor() ---

describe("Segment.removeColor()", () => {
  it("removes color but preserves attributes", () => {
    const style = new Style({ color: "red", bold: true });
    const seg = new Segment("hello", style);
    const result = collect(Segment.removeColor([seg]));
    expect(result[0]!.style?.bold).toBe(true);
    expect(result[0]!.style?.color).toBeUndefined();
  });

  it("passes through unstyled segments unchanged", () => {
    const seg = new Segment("hello");
    const result = collect(Segment.removeColor([seg]));
    expect(result[0]).toBe(seg);
  });

});

// --- Segment.divide() ---

describe("Segment.divide()", () => {
  it("returns [segments] when no cuts given", () => {
    const segs = [new Segment("hello")];
    const result = Segment.divide(segs, []);
    expect(result).toEqual([segs]);
  });

  it("divides at a single cell position", () => {
    const segs = [new Segment("hello world")];
    const result = Segment.divide(segs, [5]);
    expect(result).toHaveLength(2);
    expect(texts(result[0]!)).toEqual(["hello"]);
    expect(texts(result[1]!)).toEqual([" world"]);
  });

  it("divides at multiple cell positions", () => {
    const segs = [new Segment("abcdef")];
    const result = Segment.divide(segs, [2, 4]);
    expect(result).toHaveLength(3);
    expect(texts(result[0]!)).toEqual(["ab"]);
    expect(texts(result[1]!)).toEqual(["cd"]);
    expect(texts(result[2]!)).toEqual(["ef"]);
  });

  it("handles cuts across multiple segments", () => {
    const segs = [new Segment("abc"), new Segment("def")];
    const result = Segment.divide(segs, [4]);
    // First section: "abc" + "d", second: "ef"
    expect(Segment.getLineLength(result[0]!)).toBe(4);
    expect(Segment.getLineLength(result[1]!)).toBe(2);
  });

  it("yields an empty section when cut is at position 0", () => {
    const segs = [new Segment("hello")];
    const result = Segment.divide(segs, [0, 3]);
    expect(result).toHaveLength(3);
    // First section is empty (cut at 0)
    expect(result[0]!).toEqual([]);
    // Second section: "hel"
    expect(texts(result[1]!)).toEqual(["hel"]);
    // Third section: "lo"
    expect(texts(result[2]!)).toEqual(["lo"]);
  });

});

// --- Layout: alignTop ---

describe("Segment.alignTop()", () => {
  const style = new Style({ bold: true });

  it("pads below to fill height", () => {
    const lines = [[new Segment("hi")]];
    const result = Segment.alignTop(lines, 5, 3, style);
    expect(result).toHaveLength(3);
    // First line adjusted to width 5
    expect(Segment.getLineLength(result[0]!)).toBe(5);
    // Blank padding lines
    expect(Segment.getLineLength(result[1]!)).toBe(5);
    expect(Segment.getLineLength(result[2]!)).toBe(5);
  });

  it("truncates lines exceeding height", () => {
    const lines = [
      [new Segment("a")],
      [new Segment("b")],
      [new Segment("c")],
    ];
    const result = Segment.alignTop(lines, 5, 2, style);
    expect(result).toHaveLength(2);
  });

  it("adjusts each line to target width", () => {
    const lines = [[new Segment("hello world")]];
    const result = Segment.alignTop(lines, 5, 1, style);
    expect(Segment.getLineLength(result[0]!)).toBe(5);
  });
});

// --- Layout: alignBottom ---

describe("Segment.alignBottom()", () => {
  const style = new Style({ bold: true });

  it("pads above to fill height, content at bottom", () => {
    const lines = [[new Segment("hi")]];
    const result = Segment.alignBottom(lines, 5, 3, style);
    expect(result).toHaveLength(3);
    // Last line has the content (adjusted)
    expect(Segment.getLineLength(result[2]!)).toBe(5);
    // First two are blank padding
    expect(result[0]![0]!.text).toBe("     ");
    expect(result[1]![0]!.text).toBe("     ");
  });

  it("truncates to height when more lines than height", () => {
    const lines = [
      [new Segment("a")],
      [new Segment("b")],
      [new Segment("c")],
    ];
    const result = Segment.alignBottom(lines, 5, 2, style);
    expect(result).toHaveLength(2);
  });
});

// --- Layout: alignMiddle ---

describe("Segment.alignMiddle()", () => {
  const style = new Style({ bold: true });

  it("centers content vertically", () => {
    const lines = [[new Segment("hi")]];
    const result = Segment.alignMiddle(lines, 5, 5, style);
    expect(result).toHaveLength(5);
    // Content should be in the middle (index 2 for 1 line in height 5)
    // padAbove = floor((5 - 1) / 2) = 2
    // So content is at index 2
    expect(result[2]![0]!.text).toContain("hi");
  });

  it("adjusts all lines to width", () => {
    const lines = [[new Segment("hi")]];
    const result = Segment.alignMiddle(lines, 5, 3, style);
    for (const line of result) {
      expect(Segment.getLineLength(line)).toBe(5);
    }
  });

  it("places 1 line at index 1 for width 5, height 3", () => {
    const lines = [[new Segment("hi")]];
    const result = Segment.alignMiddle(lines, 5, 3, style);
    expect(result).toHaveLength(3);
    // padAbove = floor((3 - 1) / 2) = 1 → content at index 1
    expect(result[1]![0]!.text).toContain("hi");
    // Indices 0 and 2 are blank padding
    expect(result[0]![0]!.text).toBe("     ");
    expect(result[2]![0]!.text).toBe("     ");
  });

  it("truncates to height", () => {
    const lines = Array.from({ length: 10 }, () => [new Segment("x")]);
    const result = Segment.alignMiddle(lines, 5, 3, style);
    expect(result).toHaveLength(3);
  });
});

// --- Layout: setShape ---

describe("Segment.setShape()", () => {
  it("forces lines to exactly width x height", () => {
    const lines = [[new Segment("hi")]];
    const result = Segment.setShape(lines, 5, 3);
    expect(result).toHaveLength(3);
    for (const line of result) {
      expect(Segment.getLineLength(line)).toBe(5);
    }
  });

  it("truncates excess lines", () => {
    const lines = Array.from({ length: 5 }, () => [new Segment("hello")]);
    const result = Segment.setShape(lines, 5, 2);
    expect(result).toHaveLength(2);
  });

  it("applies style to padding segments", () => {
    const style = new Style({ bold: true });
    const lines: Segment[][] = [];
    const result = Segment.setShape(lines, 3, 2, style);
    expect(result).toHaveLength(2);
    expect(result[0]![0]!.style).toBe(style);
  });
});

// --- Segment.splitAndCropLines() ---

describe("Segment.splitAndCropLines()", () => {
  it("splits at newlines and adjusts each line to width", () => {
    const segs = [new Segment("hello\nworld")];
    const result = Segment.splitAndCropLines(segs, 10);
    expect(result).toHaveLength(2);
    expect(Segment.getLineLength(result[0]!)).toBe(10);
    expect(Segment.getLineLength(result[1]!)).toBe(10);
  });

  it("crops long lines to width", () => {
    const segs = [new Segment("hello world")];
    const result = Segment.splitAndCropLines(segs, 5);
    expect(result).toHaveLength(1);
    expect(Segment.getLineLength(result[0]!)).toBe(5);
  });

  it("does not pad when pad=false", () => {
    const segs = [new Segment("hi")];
    const result = Segment.splitAndCropLines(segs, 10, false);
    expect(Segment.getLineLength(result[0]!)).toBe(2);
  });

  it("appends newline segments when includeNewLines=true", () => {
    const segs = [new Segment("hello\nworld")];
    const result = Segment.splitAndCropLines(segs, 10, true, true);
    expect(result).toHaveLength(2);
    // Each line's last segment should be a newline
    const lastOfFirst = result[0]![result[0]!.length - 1]!;
    expect(lastOfFirst.text).toBe("\n");
    const lastOfSecond = result[1]![result[1]!.length - 1]!;
    expect(lastOfSecond.text).toBe("\n");
  });

});
