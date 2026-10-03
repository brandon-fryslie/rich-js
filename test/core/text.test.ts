import { describe, it, expect } from "vitest";
import { Span, RichText, resolveStyle } from "../../src/core/text.js";
import { Style, NULL_STYLE } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { cellLen } from "../../src/core/cells.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { baseStyleOf } from "./base-style.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

/** Collect an iterable into an array. */
function collect<T>(iter: Iterable<T>): T[] {
  return [...iter];
}

/** Extract text from segments. */
function segText(segments: Segment[]): string {
  return segments.map((s) => s.text).join("");
}

// =========================================================
// Span
// =========================================================

describe("Span construction", () => {
  it("stores start, end, style", () => {
    const s = new Span(2, 7, "bold");
    expect(s.start).toBe(2);
    expect(s.end).toBe(7);
    expect(s.style).toBe("bold");
  });

  it("accepts Style instances", () => {
    const style = new Style({ bold: true });
    const s = new Span(0, 5, style);
    expect(s.style).toBe(style);
  });
});

describe("Span.hasLength", () => {
  it("returns true when end > start", () => {
    expect(new Span(0, 5, "bold").hasLength).toBe(true);
  });

  it("returns false when end === start", () => {
    expect(new Span(3, 3, "bold").hasLength).toBe(false);
  });
});

describe("Span.toString()", () => {
  it("contains 'Span', start, and end values", () => {
    const s = new Span(2, 7, "bold").toString();
    expect(s).toContain("Span");
    expect(s).toContain("2");
    expect(s).toContain("7");
  });
});

describe("Span.split()", () => {
  it("splits within range", () => {
    const s = new Span(2, 8, "bold");
    const [before, after] = s.split(5);
    expect(before.start).toBe(2);
    expect(before.end).toBe(5);
    expect(after!.start).toBe(5);
    expect(after!.end).toBe(8);
  });

  it("returns [self, undefined] when offset is outside range (left)", () => {
    const s = new Span(5, 10, "bold");
    const [before, after] = s.split(3);
    expect(before).toBe(s);
    expect(after).toBeUndefined();
  });

  it("returns [self, undefined] when offset is at end", () => {
    const s = new Span(5, 10, "bold");
    const [before, after] = s.split(10);
    expect(before).toBe(s);
    expect(after).toBeUndefined();
  });

  it("returns [self, undefined] when offset equals start", () => {
    const s = new Span(5, 10, "bold");
    const [before, after] = s.split(5);
    expect(before).toBe(s);
    expect(after).toBeUndefined();
  });
});

describe("Span.move()", () => {
  it("shifts by delta", () => {
    const s = new Span(5, 10, "bold").move(3);
    expect(s.start).toBe(8);
    expect(s.end).toBe(13);
  });

  it("preserves style", () => {
    const style = new Style({ italic: true });
    const s = new Span(0, 5, style).move(2);
    expect(s.style).toBe(style);
  });
});

describe("Span.rightCrop()", () => {
  it("crops end to offset", () => {
    const s = new Span(0, 10, "bold").rightCrop(7);
    expect(s.end).toBe(7);
    expect(s.start).toBe(0);
  });

  it("returns self when offset >= end", () => {
    const s = new Span(0, 5, "bold");
    expect(s.rightCrop(5)).toBe(s);
    expect(s.rightCrop(10)).toBe(s);
  });
});

describe("Span.extend()", () => {
  it("extends end by count", () => {
    const s = new Span(0, 5, "bold").extend(3);
    expect(s.end).toBe(8);
    expect(s.start).toBe(0);
  });
});

// =========================================================
// RichText Construction
// =========================================================

describe("RichText construction", () => {
  it("constructs with text", () => {
    const t = new RichText("Hello");
    expect(t.plain).toBe("Hello");
  });

  it("constructs empty", () => {
    const t = new RichText();
    expect(t.plain).toBe("");
    expect(t.length).toBe(0);
  });

  it("strips control characters except tab and newline", () => {
    const t = new RichText("hello\x00\x01world\t\n");
    expect(t.plain).toBe("helloworld\t\n");
  });

  it("strips Rich's STRIP_CONTROL_CODES, and every other C0 control and DEL as the port's extension", () => {
    // rich/control.py: BEL, BS, VT, FF, CR.
    const RICH_STRIPS = [7, 8, 11, 12, 13];
    // Port extension: the rest of C0 (ESC among them) and DEL, so content
    // cannot write an escape sequence.
    const PORT_STRIPS = [0, 1, 2, 3, 4, 5, 6, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127];
    const stripped = new Set([...RICH_STRIPS, ...PORT_STRIPS]);
    const codes = Array.from({ length: 128 }, (_, code) => code);
    const kept = (code: number): boolean => new RichText(`a${String.fromCharCode(code)}b`).plain.length === 3;
    expect(codes.filter((code) => !kept(code))).toEqual(codes.filter((code) => stripped.has(code)));
  });

  it("drops a carriage return from content set by the constructor, the plain setter and append, as Rich's Text does", () => {
    expect(new RichText("a\r\nb").plain).toBe("a\nb");
    expect(new RichText().append("a\r\nb").plain).toBe("a\nb");
    const t = new RichText();
    t.plain = "a\r\nb";
    expect(t.plain).toBe("a\nb");
  });

  it("accepts options", () => {
    const t = new RichText("test", {
      style: "bold",
      justify: "center",
      overflow: "ellipsis",
      end: "",
    });
    expect(t.justify).toBe("center");
    expect(t.overflow).toBe("ellipsis");
    expect(t.end).toBe("");
  });

  it("preserves tabs in text", () => {
    const t = new RichText("a\tb");
    expect(t.plain).toContain("\t");
  });

  it("preserves newlines in text", () => {
    const t = new RichText("a\nb");
    expect(t.plain).toBe("a\nb");
  });
});

// =========================================================
// Properties
// =========================================================

describe("RichText properties", () => {
  it(".plain get/set", () => {
    const t = new RichText("Hello");
    expect(t.plain).toBe("Hello");
    t.plain = "Hi";
    expect(t.plain).toBe("Hi");
  });

  it(".plain setter trims spans beyond new length", () => {
    const t = new RichText("Hello World");
    t.stylize("bold", 0, 11);
    t.plain = "Hi";
    // Span should be trimmed to new length
    expect(t.spans.length).toBeGreaterThan(0);
    expect(t.spans[0]!.end).toBeLessThanOrEqual(2);
  });

  it(".length returns character count", () => {
    expect(new RichText("hello").length).toBe(5);
    expect(new RichText("").length).toBe(0);
  });

  it(".cellLength returns terminal cell width", () => {
    expect(new RichText("hello").cellLength).toBe(5);
    expect(new RichText("中文").cellLength).toBe(4);
  });

  it(".hasContent", () => {
    expect(new RichText("hi").hasContent).toBe(true);
    expect(new RichText("").hasContent).toBe(false);
  });

  it(".style defaults to NULL_STYLE", () => {
    expect(new RichText("hi").style).toBe(NULL_STYLE);
  });

  it(".style setter updates the base style", () => {
    const t = new RichText("hi");
    const bold = Style.parse("bold");
    t.style = bold;
    expect(t.style).toBe(bold);
  });

  it(".justify defaults to undefined", () => {
    expect(new RichText("hi").justify).toBeUndefined();
  });

  it(".overflow defaults to undefined", () => {
    expect(new RichText("hi").overflow).toBeUndefined();
  });

  it(".end defaults to newline", () => {
    expect(new RichText("hi").end).toBe("\n");
  });

  it(".spans starts empty", () => {
    expect(new RichText("hi").spans).toHaveLength(0);
  });
});

// =========================================================
// Content Operations
// =========================================================

describe("RichText.append()", () => {
  it("appends string", () => {
    const t = new RichText("Hello");
    t.append(" World");
    expect(t.plain).toBe("Hello World");
  });

  it("appends string with style", () => {
    const t = new RichText("Hello");
    t.append(" World", "bold");
    expect(t.plain).toBe("Hello World");
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0]!.start).toBe(5);
    expect(t.spans[0]!.end).toBe(11);
  });

  it("appends RichText and remaps spans", () => {
    const a = new RichText("Hello");
    const b = new RichText(" World");
    b.stylize("italic", 0, 6);
    a.append(b);
    expect(a.plain).toBe("Hello World");
    expect(a.spans[0]!.start).toBe(5); // remapped
  });

  it("keeps an appended RichText's base style as a span under its own", () => {
    const a = new RichText("Hello");
    const b = new RichText(" World", { style: "bold" });
    b.stylize("italic", 1, 6);
    a.append(b);
    expect(a.spans.map((span) => [span.start, span.end, String(span.style)])).toEqual([
      [5, 11, "bold"],
      [6, 11, "italic"],
    ]);
  });

  // Rich's `Text.append` takes the other text's characters and spans and
  // leaves its `end` behind, which is what lets a label keep its own end and
  // still sit inside a line, as `Spinner` sets one (rich-embed-1r2m).
  it("keeps its own end and drops the appended RichText's", () => {
    const a = new RichText("Hello", { end: "" });
    a.append(new RichText(" World", { end: "!!" }));
    expect(a.end).toBe("");
    expect([...a.render({ maxWidth: 40 })].map((s) => s.text).join("")).toBe("Hello World");
  });

  it("throws when appending RichText with style argument", () => {
    const a = new RichText("Hello");
    const b = new RichText(" World");
    expect(() => a.append(b, "bold")).toThrow();
  });

  it("returns this for chaining", () => {
    const t = new RichText();
    const result = t.append("a").append("b");
    expect(result).toBe(t);
    expect(t.plain).toBe("ab");
  });
});

describe("RichText.contains()", () => {
  it("returns true for contained string", () => {
    expect(new RichText("Hello World").contains("World")).toBe(true);
  });

  it("returns false for missing string", () => {
    expect(new RichText("Hello").contains("xyz")).toBe(false);
  });

  it("works with RichText argument", () => {
    expect(new RichText("Hello World").contains(new RichText("World"))).toBe(true);
  });
});

describe("RichText.at()", () => {
  it("returns single character", () => {
    const t = new RichText("Hello");
    expect(t.at(0).plain).toBe("H");
    expect(t.at(4).plain).toBe("o");
  });

  it("supports negative index", () => {
    expect(new RichText("Hello").at(-1).plain).toBe("o");
  });
});

describe("RichText.slice()", () => {
  it("returns character range", () => {
    const t = new RichText("Hello World");
    expect(t.slice(0, 5).plain).toBe("Hello");
    expect(t.slice(6).plain).toBe("World");
  });

  it("preserves spans in range", () => {
    const t = new RichText("Hello World");
    t.stylize("bold", 0, 5);
    const sliced = t.slice(0, 5);
    expect(sliced.spans).toHaveLength(1);
    expect(sliced.spans[0]!.start).toBe(0);
    expect(sliced.spans[0]!.end).toBe(5);
  });

  it("supports negative indices", () => {
    expect(new RichText("Hello").slice(-3).plain).toBe("llo");
  });
});

// =========================================================
// Styling Operations
// =========================================================

describe("RichText.stylize()", () => {
  it("applies style to range", () => {
    const t = new RichText("Hello World");
    t.stylize("bold", 0, 5);
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0]!.start).toBe(0);
    expect(t.spans[0]!.end).toBe(5);
  });

  it("applies to entire text when no range given", () => {
    const t = new RichText("Hello");
    t.stylize("bold");
    expect(t.spans[0]!.start).toBe(0);
    expect(t.spans[0]!.end).toBe(5);
  });

  it("supports negative indices", () => {
    const t = new RichText("Hello World");
    t.stylize("bold", -5);
    expect(t.spans[0]!.start).toBe(6);
    expect(t.spans[0]!.end).toBe(11);
  });

  it("does nothing for empty style string", () => {
    const t = new RichText("Hello");
    t.stylize("");
    expect(t.spans).toHaveLength(0);
  });

  it("does nothing for NULL_STYLE", () => {
    const t = new RichText("Hello");
    t.stylize(NULL_STYLE);
    expect(t.spans).toHaveLength(0);
  });
});

describe("RichText.highlightRegex()", () => {
  it("highlights regex matches", () => {
    const t = new RichText("foo bar foo");
    const count = t.highlightRegex(/foo/g, "bold");
    expect(count).toBe(2);
    expect(t.spans).toHaveLength(2);
  });

  it("returns 0 for no matches", () => {
    const t = new RichText("hello");
    expect(t.highlightRegex(/xyz/g, "bold")).toBe(0);
  });

  it("applies named capture groups as style names", () => {
    const t = new RichText("hello world");
    const count = t.highlightRegex(/(?<bold>hello)/g);
    expect(count).toBe(1);
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0]!.style).toBe("bold");
    expect(t.spans[0]!.start).toBe(0);
    expect(t.spans[0]!.end).toBe(5);
  });
});

describe("RichText.highlightWords()", () => {
  it("highlights word occurrences", () => {
    const t = new RichText("The cat sat on the mat");
    const count = t.highlightWords(["cat", "mat"], "bold");
    expect(count).toBe(2);
  });

  it("supports case-insensitive matching", () => {
    const t = new RichText("Hello HELLO hello");
    const count = t.highlightWords(["hello"], "bold", { caseSensitive: false });
    expect(count).toBe(3);
  });

  it("counts every match, whatever its style resolves to", () => {
    // A name resolves against the theme of the render that draws it, which
    // does not exist yet, so the count cannot depend on it.
    const t = new RichText("The cat sat on the mat");
    expect(t.highlightWords(["cat", "mat"], "no.such.style")).toBe(2);
    expect(t.highlightWords(["cat", "mat"], "")).toBe(2);
  });
});

// =========================================================
// Copy Operations
// =========================================================

describe("RichText.copy()", () => {
  it("creates an independent deep copy with text, style, justify, and spans", () => {
    const original = new RichText("Hello", { style: "bold", justify: "center" });
    original.stylize("italic", 0, 5);
    const copy = original.copy();
    expect(copy.plain).toBe("Hello");
    expect(copy.spans).toHaveLength(1);
    expect(copy.style).toBe("bold");
    expect(copy.justify).toBe("center");

    // Modifying copy does not affect original
    copy.append(" World");
    expect(original.plain).toBe("Hello");
    expect(original.spans).toHaveLength(1);
  });
});

describe("RichText.blankCopy()", () => {
  it("copies metadata (style, justify) but no text or spans", () => {
    const original = new RichText("Hello", { style: "italic", justify: "center" });
    original.stylize("bold");
    const blank = original.blankCopy();
    expect(blank.plain).toBe("");
    expect(blank.spans).toHaveLength(0);
    expect(blank.justify).toBe("center");
    expect(blank.style).toBe("italic");
  });

  it("accepts text argument", () => {
    const blank = new RichText("Hello").blankCopy("World");
    expect(blank.plain).toBe("World");
    expect(blank.spans).toHaveLength(0);
  });
});

// =========================================================
// Splitting
// =========================================================

describe("RichText.split()", () => {
  it("splits at newlines by default", () => {
    const t = new RichText("hello\nworld");
    const parts = t.split();
    expect(parts).toHaveLength(2);
    expect(parts[0]!.plain).toBe("hello");
    expect(parts[1]!.plain).toBe("world");
  });

  it("splits at custom separator", () => {
    const t = new RichText("a,b,c");
    const parts = t.split(",");
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => p.plain)).toEqual(["a", "b", "c"]);
  });

  it("returns single-element for no matches", () => {
    const t = new RichText("hello");
    expect(t.split()).toHaveLength(1);
  });
});

describe("RichText.divide()", () => {
  it("divides at character offsets", () => {
    const t = new RichText("hello world");
    const parts = t.divide([5, 6]);
    expect(parts).toHaveLength(3);
    expect(parts[0]!.plain).toBe("hello");
    expect(parts[1]!.plain).toBe(" ");
    expect(parts[2]!.plain).toBe("world");
  });

  it("returns single copy for empty offsets", () => {
    const t = new RichText("hello");
    const parts = t.divide([]);
    expect(parts).toHaveLength(1);
    expect(parts[0]!.plain).toBe("hello");
  });

  it("splits spans correctly across division boundaries", () => {
    const t = new RichText("hello world");
    t.stylize("bold", 0, 11); // span covers entire text
    const parts = t.divide([5, 6]);
    expect(parts).toHaveLength(3);
    // Each part should carry the bold span for its range
    expect(parts[0]!.spans).toHaveLength(1);
    expect(parts[0]!.spans[0]!.start).toBe(0);
    expect(parts[0]!.spans[0]!.end).toBe(5);
    expect(parts[1]!.spans).toHaveLength(1);
    expect(parts[1]!.spans[0]!.start).toBe(0);
    expect(parts[1]!.spans[0]!.end).toBe(1);
    expect(parts[2]!.spans).toHaveLength(1);
    expect(parts[2]!.spans[0]!.start).toBe(0);
    expect(parts[2]!.spans[0]!.end).toBe(5);
  });
});

// =========================================================
// Whitespace Operations
// =========================================================

describe("RichText.rstrip()", () => {
  it("removes trailing whitespace", () => {
    const t = new RichText("hello   ");
    t.rstrip();
    expect(t.plain).toBe("hello");
  });

  it("does nothing when no trailing whitespace", () => {
    const t = new RichText("hello");
    t.rstrip();
    expect(t.plain).toBe("hello");
  });
});

describe("RichText.pad()", () => {
  it("pads both sides", () => {
    const t = new RichText("hi");
    t.pad(2);
    expect(t.plain).toBe("  hi  ");
  });

  it("shifts spans by count", () => {
    const t = new RichText("hi");
    t.stylize("bold");
    t.pad(3);
    expect(t.spans[0]!.start).toBe(3);
    expect(t.spans[0]!.end).toBe(5);
  });
});

describe("RichText.padLeft()", () => {
  it("pads left side only", () => {
    const t = new RichText("hi");
    t.padLeft(3);
    expect(t.plain).toBe("   hi");
  });
});

describe("RichText.padRight()", () => {
  it("pads right side only", () => {
    const t = new RichText("hi");
    t.padRight(3);
    expect(t.plain).toBe("hi   ");
  });
});

describe("RichText.setLength()", () => {
  it("pads if short", () => {
    const t = new RichText("hi");
    t.setLength(5);
    expect(t.plain).toBe("hi   ");
  });

  it("crops if long", () => {
    const t = new RichText("hello world");
    t.setLength(5);
    expect(t.plain).toBe("hello");
  });
});

describe("RichText.extendStyle()", () => {
  it("appends spaces and extends terminal spans", () => {
    const t = new RichText("hi");
    t.stylize("bold", 0, 2);
    t.extendStyle(3);
    expect(t.plain).toBe("hi   ");
    // Span that ended at old length should be extended
    expect(t.spans[0]!.end).toBe(5);
  });
});

// =========================================================
// Truncation
// =========================================================

describe("RichText.truncate()", () => {
  it("does nothing when text fits", () => {
    const t = new RichText("hi");
    t.truncate(10);
    expect(t.plain).toBe("hi");
  });

  it("truncates to width", () => {
    const t = new RichText("hello world");
    t.truncate(5);
    expect(t.cellLength).toBeLessThanOrEqual(5);
  });

  it("with no options, cuts on the right and marks the cut with \u2026", () => {
    const t = new RichText("hello world");
    t.truncate(6);
    expect(t.plain).toBe("hello\u2026");
    expect(t.cellLength).toBe(6);
  });

  it("mode: right with default marker", () => {
    const t = new RichText("hello world");
    t.truncate(6, { mode: "right" });
    expect(t.plain).toBe("hello\u2026");
    expect(t.cellLength).toBe(6);
  });

  it("mode: left prepends marker; keeps the right side", () => {
    const t = new RichText("hello world");
    t.truncate(6, { mode: "left" });
    expect(t.plain).toBe("\u2026world");
    expect(t.cellLength).toBe(6);
  });

  it("mode: middle keeps halves; inserts marker in the middle", () => {
    const t = new RichText("hello world!");
    t.truncate(6, { mode: "middle" });
    expect(t.plain).toBe("he\u2026ld!");
    expect(t.cellLength).toBe(6);
  });

  it("custom marker for mode: right", () => {
    const t = new RichText("hello world");
    t.truncate(7, { mode: "right", marker: ">>" });
    expect(t.plain).toBe("hello>>");
    expect(t.cellLength).toBe(7);
  });

  it("cuts a marker wider than the width down to the width", () => {
    expect(new RichText("hello world").truncate(1, { marker: ">>" }).plain).toBe(">");
    expect(new RichText("hello world").truncate(2, { marker: ">>>" }).plain).toBe(">>");
    expect(new RichText("hello world").truncate(2, { mode: "left", marker: ">>>" }).plain).toBe(">>");
    expect(new RichText("hello world").truncate(2, { mode: "middle", marker: ">>>" }).plain).toBe(">>");
  });

  it("a wide marker that cannot fit leaves the width to the text", () => {
    expect(new RichText("hello world").truncate(1, { marker: "中" }).plain).toBe("h");
  });

  it("keeps a many-code-point marker whole when it fits, and drops it whole when it does not", () => {
    for (const mode of ["right", "left", "middle"] as const) {
      expect(new RichText("hello world").truncate(4, { mode, marker: "👨‍👩‍👧" }).plain).toContain("👨‍👩‍👧");
      expect(new RichText("hello world").truncate(1, { mode, marker: "❤️" }).plain).toHaveLength(1);
      expect(new RichText("hello world").truncate(1, { mode, marker: "🇺🇸" }).plain).toHaveLength(1);
    }
  });

  it("cuts the text between grapheme clusters", () => {
    expect(new RichText("a❤️bcdef❤️g").truncate(2, { marker: "" }).plain).toBe("a");
    expect(new RichText("a❤️bcdef❤️g").truncate(2, { mode: "left", marker: "" }).plain).toBe("g");
    expect(new RichText("a❤️bcdef❤️g").truncate(3, { mode: "middle", marker: "" }).plain).toBe("ag");
    expect(new RichText("a❤️bcdef❤️g").truncate(6, { mode: "middle", marker: "" }).plain).toBe("a❤️❤️g");
  });

  it("is never wider than the width, for every mode and marker", () => {
    const modes = ["right", "left", "middle"] as const;
    const markers = ["", "…", ">>", ">>>", "中", "中>", "❤️", "👨‍👩‍👧", "🇺🇸"];
    for (const mode of modes) {
      for (const marker of markers) {
        for (let width = -2; width <= 16; width++) {
          const t = new RichText("hello 中文 ❤️ 🇺🇸 world").truncate(width, { mode, marker });
          expect(t.cellLength, `${mode} ${JSON.stringify(marker)} ${width}`)
            .toBeLessThanOrEqual(Math.max(width, 0));
        }
      }
    }
  });

  it("empty marker = raw crop", () => {
    const t = new RichText("hello world");
    t.truncate(5, { mode: "right", marker: "" });
    expect(t.plain).toBe("hello");
  });

  it("mode: left preserves spans on the kept right side", () => {
    const t = new RichText("hello world");
    t.stylize("red", 6, 11); // "world" is red
    t.truncate(6, { mode: "left" });
    expect(t.plain).toBe("\u2026world");
    // The "world" span should still cover "world" in the new text (chars 1..6).
    const redSpan = t.spans.find(
      (s) => resolveStyle({ maxWidth: 80 }, s.style).color?.name === "red",
    );
    expect(redSpan).toBeDefined();
    expect(redSpan!.start).toBe(1);
    expect(redSpan!.end).toBe(6);
  });

  it("mode: right preserves spans on the kept left side", () => {
    const t = new RichText("hello world");
    t.stylize("red", 0, 5); // "hello" is red
    t.truncate(6, { mode: "right" });
    expect(t.plain).toBe("hello\u2026");
    const redSpan = t.spans[0];
    expect(redSpan!.start).toBe(0);
    expect(redSpan!.end).toBe(5);
  });
});

// =========================================================
// Alignment
// =========================================================

describe("RichText.align()", () => {
  it("left-pads right for left alignment", () => {
    const t = new RichText("hi");
    t.align("left", 6);
    expect(t.plain).toBe("hi    ");
  });

  it("left-pads for right alignment", () => {
    const t = new RichText("hi");
    t.align("right", 6);
    expect(t.plain).toBe("    hi");
  });

  it("centers text", () => {
    const t = new RichText("hi");
    t.align("center", 6);
    expect(t.plain).toBe("  hi  ");
  });

  it("does nothing when text fills width", () => {
    const t = new RichText("hello");
    t.align("center", 5);
    expect(t.plain).toBe("hello");
  });
});

// =========================================================
// Suffix Removal
// =========================================================

describe("RichText.removeSuffix()", () => {
  it("removes matching suffix", () => {
    const t = new RichText("hello.txt");
    t.removeSuffix(".txt");
    expect(t.plain).toBe("hello");
  });

  it("does nothing when suffix not present", () => {
    const t = new RichText("hello");
    t.removeSuffix(".txt");
    expect(t.plain).toBe("hello");
  });
});

// =========================================================
// Token Appending
// =========================================================

describe("RichText.appendTokens()", () => {
  it("appends [text, style] pairs", () => {
    const t = new RichText();
    t.appendTokens([
      ["Hello", "bold"],
      [" "],
      ["World", "italic"],
    ]);
    expect(t.plain).toBe("Hello World");
    expect(t.spans).toHaveLength(2);
  });
});

// =========================================================
// Static Factories
// =========================================================

describe("RichText.assemble()", () => {
  it("builds from mixed parts", () => {
    const t = RichText.assemble([
      "hello",
      [" world", "bold"],
    ]);
    expect(t.plain).toBe("hello world");
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0]!.start).toBe(5);
  });

  it("accepts RichText parts", () => {
    const part = new RichText("world");
    part.stylize("italic");
    const t = RichText.assemble(["hello ", part]);
    expect(t.plain).toBe("hello world");
  });

  it("accepts style option", () => {
    const t = RichText.assemble(["hello"], { style: "bold" });
    expect(t.style).toBe("bold");
  });
});

describe("RichText.styled()", () => {
  it("creates fully-styled text", () => {
    const t = RichText.styled("hello", "bold red");
    expect(t.plain).toBe("hello");
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0]!.start).toBe(0);
    expect(t.spans[0]!.end).toBe(5);
  });
});

describe("RichText.fromFragments()", () => {
  it("empty input returns an empty RichText with end=''", () => {
    const t = RichText.fromFragments([]);
    expect(t.plain).toBe("");
    expect(t.end).toBe("");
    expect(t.spans).toHaveLength(0);
  });

  it("flattens each fragment's wrapping style onto a span over its range", () => {
    const f1 = new RichText("hello", { style: "red" });
    const f2 = new RichText("world", { style: "blue" });
    const t = RichText.fromFragments([f1, f2]);
    expect(t.plain).toBe("helloworld");
    // Two spans: one over the red range, one over the blue range.
    expect(t.spans).toHaveLength(2);
    expect(t.spans[0]!.start).toBe(0);
    expect(t.spans[0]!.end).toBe(5);
    expect(t.spans[0]!.style).toBe("red");
    expect(t.spans[1]!.start).toBe(5);
    expect(t.spans[1]!.end).toBe(10);
    expect(t.spans[1]!.style).toBe("blue");
  });

  it("preserves a fragment's internal spans, shifted by its offset", () => {
    const f1 = new RichText("ab");
    f1.stylize("bold", 0, 1);   // span: "a" bold
    const f2 = new RichText("cd");
    f2.stylize("italic", 1, 2); // span: "d" italic
    const t = RichText.fromFragments([f1, f2]);
    expect(t.plain).toBe("abcd");
    // Spans propagated and offset: "a" bold (0-1), "d" italic (3-4).
    const bold = t.spans.find((s) => s.style === "bold");
    expect(bold).toBeDefined();
    expect(bold!.start).toBe(0);
    expect(bold!.end).toBe(1);
    const italic = t.spans.find((s) => s.style === "italic");
    expect(italic).toBeDefined();
    expect(italic!.start).toBe(3);
    expect(italic!.end).toBe(4);
  });

  it("a fragment with no wrapping style adds no extra span", () => {
    const f1 = new RichText("hi");                // no wrapping style
    const f2 = new RichText("there", { style: "underline" });
    const t = RichText.fromFragments([f1, f2]);
    expect(t.plain).toBe("hithere");
    // Only one span — for f2's underline.
    expect(t.spans).toHaveLength(1);
    expect(t.spans[0]!.style).toBe("underline");
    expect(t.spans[0]!.start).toBe(2);
    expect(t.spans[0]!.end).toBe(7);
  });

  it("default end is '' (engine-output case rarely wants trailing newline)", () => {
    const t = RichText.fromFragments([new RichText("x")]);
    expect(t.end).toBe("");
  });

  it("end can be overridden via options", () => {
    const t = RichText.fromFragments([new RichText("x")], { end: "\n" });
    expect(t.end).toBe("\n");
  });
});

// =========================================================
// Renderable
// =========================================================

describe("RichText.render()", () => {
  it("produces segments with correct text", () => {
    const t = new RichText("Hello World");
    const segments = collect(t.render({ maxWidth: 80 }));
    const text = segText(segments);
    expect(text).toContain("Hello World");
  });

  it("produces styled segments", () => {
    const t = new RichText("Hello World");
    t.stylize("bold", 0, 5);
    const segments = collect(t.render({ maxWidth: 80 }));
    // First segment should be styled "Hello"
    const hello = segments.find((s) => s.text === "Hello");
    expect(hello).toBeDefined();
    expect(hello!.style?.bold).toBe(true);
  });

  it("handles fold overflow", () => {
    const t = new RichText("abcdefghij", { overflow: "fold" });
    const segments = collect(t.render({ maxWidth: 5 }));
    const text = segText(segments);
    expect(text).toContain("abcde");
    expect(text).toContain("fghij");
  });

  it("handles crop overflow", () => {
    const t = new RichText("abcdefghij", { overflow: "crop" });
    const segments = collect(t.render({ maxWidth: 5 }));
    const text = segText(segments);
    expect(text).toContain("abcde");
    expect(text).not.toContain("fghij");
  });

  it("handles ellipsis overflow", () => {
    const t = new RichText("abcdefghij", { overflow: "ellipsis" });
    const segments = collect(t.render({ maxWidth: 5 }));
    const text = segText(segments);
    expect(text).toContain("\u2026");
  });

  it("renders empty text as one empty segment and its end, as Rich does", () => {
    // Rich 9d8f9a3: `[s.text for s in console.render(Text(""))] == ["", "\n"]`.
    // The empty segment writes nothing; it is what makes empty text one line.
    const t = new RichText("", { end: "\n" });
    expect(collect(t.render({ maxWidth: 80 })).map((s) => s.text)).toEqual(["", "\n"]);
    expect(Segment.splitLines(t.render({ maxWidth: 80 }))).toHaveLength(1);
  });

  // rich-text-5ai: `end` used to mean two different things depending on
  // whether the text was empty — honored for empty text, dropped for
  // non-empty text unless it was a non-default value. One rule now: `end` is
  // its own trailing segment whenever it is a non-empty string, empty or
  // non-empty text alike — this pins all five rows of the ticket's table.
  describe("end is one rule for empty and non-empty text alike", () => {
    const segmentTexts = (t: RichText) =>
      collect(t.render({ maxWidth: 40 })).map((s) => s.text);

    it("non-empty text, default end: content, then the default terminator", () => {
      expect(segmentTexts(new RichText("a"))).toEqual(["a", "\n"]);
    });

    it("non-empty text, end \"\": content only, no terminator", () => {
      expect(segmentTexts(new RichText("a", { end: "" }))).toEqual(["a"]);
    });

    it("non-empty text, custom end: content, then the custom terminator", () => {
      expect(segmentTexts(new RichText("a", { end: "<<" }))).toEqual(["a", "<<"]);
    });

    it("empty text, default end: its one empty piece and the default terminator", () => {
      expect(segmentTexts(new RichText(""))).toEqual(["", "\n"]);
    });

    it("empty text, end \"\": its one empty piece, which writes nothing", () => {
      expect(segmentTexts(new RichText("", { end: "" }))).toEqual([""]);
    });

    // Flagged independently by two code-review passes on rich-text-5ai as a
    // "doubled newline" regression. It is not one: `end` and an embedded
    // trailing "\n" in the content are two different things stacking, the
    // same as Python's `print("hi\n")` producing two newlines. Pre-fix,
    // a *custom* end already stacked this way (`"hi\n<<"`) — only the
    // *default* "\n" end special-cased itself away when content already
    // ended in "\n", which is the same "two meanings for end" defect this
    // ticket exists to remove. Direct-render consumers who want exactly one
    // trailing newline pass `end: ""`; `Console.print` is unaffected either
    // way, since it clears a text item's own `end` before rendering.
    it("content already ending in \\n stacks with a non-empty end, same as a custom end always did", () => {
      expect(segmentTexts(new RichText("a\n"))).toEqual(["a", "\n", "\n"]);
      expect(segmentTexts(new RichText("a\n", { end: "<<" }))).toEqual(["a", "\n", "<<"]);
      expect(segmentTexts(new RichText("a\n", { end: "" }))).toEqual(["a", "\n"]);
    });
  });

  // noWrap is Rich's `no_wrap`: no line breaks, and a line still too wide is
  // cut at the width by the overflow method. Each expected value is what Rich
  // 9d8f9a3's `render_lines` gives for the same text at the same width.
  describe("noWrap", () => {
    const lines = (text: RichText, options: Partial<RenderOptions> = {}): string[] =>
      segText(collect(text.render({ maxWidth: 5, ...options }))).split("\n").filter((l) => l !== "");

    it("cuts a line at the width, folding being a cut once wrapping is off", () => {
      expect(lines(new RichText("abcdefghij", { noWrap: true }))).toEqual(["abcde"]);
      expect(lines(new RichText("abcdefghij", { noWrap: true, overflow: "crop" }))).toEqual(["abcde"]);
    });

    it("marks the cut under ellipsis", () => {
      expect(lines(new RichText("abcdefghij", { noWrap: true, overflow: "ellipsis" }))).toEqual(["abcd…"]);
    });

    it("keeps one line per line of text, each cut on its own", () => {
      expect(lines(new RichText("aaaa bbbb cccc\nxy", { noWrap: true }), { maxWidth: 6 }))
        .toEqual(["aaaa b", "xy"]);
    });

    it("still justifies at the width", () => {
      expect(lines(new RichText("hi", { noWrap: true, justify: "right" }))).toEqual(["   hi"]);
    });

    it("comes from the render options as well as the text", () => {
      expect(lines(new RichText("abcdefghij"), { noWrap: true })).toEqual(["abcde"]);
    });
  });

  // `"ignore"` is the absence of an edge: the reference's `Text.wrap` returns
  // the line untouched — not wrapped, not cut, not justified.
  describe("overflow ignore", () => {
    const render = (text: RichText): string => segText(collect(text.render({ maxWidth: 5 })));

    it("leaves a line at its natural width", () => {
      expect(render(new RichText("aaaa bbbb cccc", { overflow: "ignore", end: "" }))).toBe("aaaa bbbb cccc");
    });

    it("does not justify the line", () => {
      expect(render(new RichText("hi", { overflow: "ignore", justify: "right", end: "" }))).toBe("hi");
    });

    it("outranks noWrap, which would cut", () => {
      expect(render(new RichText("abcdefghij", { overflow: "ignore", noWrap: true, end: "" }))).toBe("abcdefghij");
    });
  });

  // Rich's `Text.expand_tabs`: a tab reaches the next multiple of tabSize.
  it("expands a mid-line tab to the next tab stop", () => {
    const render = (text: string, tabSize?: number): string =>
      segText(collect(new RichText(text, { tabSize, end: "" }).render({ maxWidth: 80 })));
    expect(render("a\tb", 4)).toBe("a   b");
    expect(render("abc\tb", 4)).toBe("abc b");
    expect(render("abcd\tb", 4)).toBe("abcd    b");
    expect(render("a\tb")).toBe("a" + " ".repeat(7) + "b");
    expect(render("ab\tc\nx\ty", 4)).toBe("ab  c\nx   y");
  });

  it("keeps a span after a tab on the characters it styled", () => {
    const t = new RichText("\tab", { tabSize: 4, end: "" });
    t.stylize("bold", 2, 3);
    const bold = collect(t.render({ maxWidth: 80 })).filter((s) => s.style?.bold);
    expect(bold.map((s) => s.text)).toEqual(["b"]);
  });
});

// The pieces a text is cut into are cut by the spans themselves, so a renderer
// that answers "which spans cover this piece?" by asking every span at every
// piece charges the square of the span count. A `ReprHighlighter` over a large
// value, `highlightRegex` over a common character, and `Pretty`'s indent guides
// all reach span counts where that is the whole render: 8,000 one-character
// spans took 211ms where 1,000 took 3.2ms.
describe("RichText.render() cost tracks the number of spans, not its square", () => {
  // Counting bound reads counts the traversal, which is why the scaling is
  // pinned against the data rather than against a stopwatch: the quadratic
  // version still looks fast at any input small enough to keep a test quick.
  function countingSpans(count: number): { text: RichText; reads: () => number } {
    let reads = 0;
    const text = new RichText("x".repeat(count));
    for (let i = 0; i < count; i++) text.stylize("bold", i, i + 1);
    for (const span of text.spans) {
      for (const edge of ["start", "end"] as const) {
        const offset = span[edge];
        Object.defineProperty(span, edge, {
          get: () => {
            reads++;
            return offset;
          },
        });
      }
    }
    return { text, reads: () => reads };
  }

  it("reads a span's bounds a fixed number of times however many spans there are", () => {
    // Asserted as a ratio between two sizes rather than against a constant:
    // whatever one span costs cancels out of the division, so there is no
    // number here to keep true as the renderer changes. Linear doubles, the
    // rescan this replaced quadrupled, and 3 is the only separator between them.
    const small = countingSpans(400);
    const large = countingSpans(800);
    collect(small.text.render({ maxWidth: 1000 }));
    collect(large.text.render({ maxWidth: 1000 }));

    expect(large.reads()).toBeLessThan(small.reads() * 3);
  });
});

// =========================================================
// Measurable
// =========================================================

describe("RichText tabSize", () => {
  // Refused where it is given, not at the first render that meets a tab — the
  // text need not hold one for the value to be wrong.
  it.each([0, -1, 2.5, Number.NaN])("refuses a tabSize of %s at construction", (tabSize) => {
    expect(() => new RichText("no tabs here", { tabSize })).toThrow(RangeError);
  });
});

describe("RichText.measure()", () => {
  it("returns reasonable min/max", () => {
    const t = new RichText("Hello World");
    const m = t.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeLessThanOrEqual(80);
    expect(m.maximum).toBe(11);
  });

  it("minimum is longest word width", () => {
    const t = new RichText("hi there");
    const m = t.measure({ maxWidth: 80 });
    expect(m.minimum).toBe(5); // "there"
  });

  // The wrapper keeps a line's indent on its first word, so the minimum does
  // too — a container paying less would cut the word (Rich drops the indent).
  it("counts a line's indent toward the minimum", () => {
    expect(new RichText("   $1,332,539,889").measure({ maxWidth: 80 }).minimum).toBe(17);
  });

  // Rich: with no word to keep whole, the whitespace is the content, and its
  // width is the minimum — a spacer cell is not squeezed to nothing.
  it("takes the whole width of whitespace-only text as its minimum", () => {
    expect(new RichText("    ").measure({ maxWidth: 80 })).toEqual({ minimum: 4, maximum: 4 });
  });

  it("handles multiline text", () => {
    const t = new RichText("short\na longer line");
    const m = t.measure({ maxWidth: 80 });
    expect(m.maximum).toBe(13); // "a longer line"
  });
});

// =========================================================
// OSC-terminator stripping at the trust boundary
// =========================================================

// [LAW:behavior-not-structure] Pin the architectural contract: RichText is
// the trust boundary for link URLs. Any URL bytes that could prematurely
// terminate an OSC 8 wrap (ESC \x1b, BEL \x07, ST \x9c) are stripped from
// any Style.link entering RichText (constructor, style setter, stylize,
// append, and the markup parser which routes through stylize). The Style
// value type itself stays a faithful container.

describe("OSC-terminator stripping at the RichText trust boundary", () => {
  const dirty = "https://evil.example/\x1b\\hostile\x07more\x9cend";
  const clean = "https://evil.example/\\hostilemoreend";

  it("strips ESC/BEL/ST from a link added via stylize()", () => {
    const t = new RichText("click");
    t.stylize(new Style({ link: dirty }));
    expect((t.spans[0]!.style as Style).link).toBe(clean);
  });

  it("strips ESC/BEL/ST from a link added via append(content, style)", () => {
    const t = new RichText("");
    t.append("click", new Style({ link: dirty }));
    expect((t.spans[0]!.style as Style).link).toBe(clean);
  });

  it("strips ESC/BEL/ST from options.style.link in the constructor", () => {
    const t = new RichText("click", { style: new Style({ link: dirty }) });
    expect(baseStyleOf(t).link).toBe(clean);
  });

  it("strips ESC/BEL/ST from a link assigned via the style setter", () => {
    const t = new RichText("click");
    t.style = new Style({ link: dirty });
    expect(baseStyleOf(t).link).toBe(clean);
  });

  it("returns the same Style reference when the URL is already clean (no needless clone)", () => {
    // [LAW:dataflow-not-control-flow] The sanitizer always runs; the data
    // (already-clean URL) decides that the result is the identity Style.
    // This is observable as referential identity, not a branch in callsites.
    const base = new Style({ link: "https://safe.example/" });
    const t = new RichText("click");
    t.stylize(base);
    expect(t.spans[0]!.style).toBe(base);
  });

  it("does NOT sanitize a raw `new Style({ link })` — Style is a faithful container", () => {
    // [LAW:locality-or-seam] Sanitization is the boundary's job, not the value
    // type's. Internal callers that already produced a sanitized URL must not
    // be silently re-mutated by Style itself.
    expect(new Style({ link: dirty }).link).toBe(dirty);
  });

  it("strips ESC/BEL/ST from a link added via highlightRegex(pattern, style)", () => {
    // [LAW:single-enforcer] Coverage of every style-accepting public method is
    // structural: `resolveStyle` is the canonical normalizer, and the
    // sanitizer lives inside it. New style-accepting APIs inherit the
    // invariant automatically.
    const t = new RichText("click here");
    t.highlightRegex(/click/, new Style({ link: dirty }));
    expect((t.spans[0]!.style as Style).link).toBe(clean);
  });

  it("strips ESC/BEL/ST from a link added via highlightWords(words, style)", () => {
    const t = new RichText("click here");
    t.highlightWords(["click"], new Style({ link: dirty }));
    expect((t.spans[0]!.style as Style).link).toBe(clean);
  });

  it("the rendered segment for a span with a (dirty-at-construction) link carries a sanitized URL", () => {
    // [LAW:behavior-not-structure] End-to-end: `_buildSegments` re-normalizes
    // span styles through `resolveStyle`, so any link reaching a Segment
    // emitted by render() is sanitized — independent of which API attached it.
    const t = new RichText("click");
    t.stylize(new Style({ link: dirty }));
    const segments = [...t.render({ maxWidth: 80 })];
    const linkSegment = segments.find((s) => s.style?.link !== undefined);
    expect(linkSegment).toBeDefined();
    expect(linkSegment!.style!.link).toBe(clean);
  });
});

// Rich measures a tab as no cells while drawing it to its stop; here every
// width a text is sized by is the width it draws (rich-text-d0gz).
describe("RichText widths count a tab as the cells it draws", () => {
  const drawn = (text: RichText): string => segText(collect(text.render({ maxWidth: 80 })));
  const tabbed = (): RichText => new RichText("ab\tcd", { tabSize: 8, end: "" });

  it("measures cellLength as render draws it", () => {
    const text = tabbed();
    expect(text.cellLength).toBe(10);
    expect(text.cellLength).toBe(cellLen(drawn(text)));
    expect(text.cellLength).toBe(text.measure({ maxWidth: 80 }).maximum);
  });

  it("truncates to the width it draws", () => {
    const text = tabbed();
    text.stylize("bold", 3, 5);
    text.truncate(6);
    expect(drawn(text)).toBe("ab   \u2026");
    expect(text.cellLength).toBe(6);
    const wide = tabbed();
    wide.stylize("bold", 3, 5);
    wide.truncate(9, { marker: "" });
    const bold = collect(wide.render({ maxWidth: 80 })).filter((s) => s.style?.bold);
    expect(bold.map((s) => s.text).join("")).toBe("c");
  });

  it("cuts from the left and the middle at the width it draws", () => {
    const left = tabbed();
    left.stylize("bold", 0, 2);
    left.stylize("italic", 3, 5);
    left.truncate(6, { mode: "left" });
    expect(drawn(left)).toBe("…   cd");
    expect(left.spans.map((s) => [left.plain.slice(s.start, s.end), s.style])).toEqual([["cd", "italic"]]);
    const middle = tabbed();
    middle.stylize("italic", 3, 5);
    middle.truncate(6, { mode: "middle" });
    expect(drawn(middle)).toBe("ab… cd");
    expect(middle.spans.map((s) => middle.plain.slice(s.start, s.end))).toEqual(["cd"]);
  });

  it("leaves a text it does not change with its tabs, free to be set after a prefix", () => {
    expect(tabbed().truncate(10).plain).toBe("ab\tcd");
    expect(tabbed().align("left", 10).plain).toBe("ab\tcd");
    const line = new RichText("xyz", { end: "" }).append(tabbed().truncate(80));
    expect(drawn(line)).toBe("xyzab   cd");
  });

  it("aligns to the width it draws, its tab stops where they were measured", () => {
    const right = tabbed().align("right", 12);
    expect(drawn(right)).toBe("  ab      cd");
    expect(drawn(tabbed().align("center", 10))).toBe("ab      cd");
  });
});

describe("RichText.expandTabs()", () => {
  it("widens each tab to its stop and moves spans with the characters they style", () => {
    const text = new RichText("a\tb");
    text.stylize("bold", 2, 3);
    text.expandTabs();
    expect(text.plain).toBe("a       b");
    expect(text.spans.map((s) => [s.start, s.end])).toEqual([[8, 9]]);
  });
});

// rich-embed-1r2m review: Rich's `Lines.justify` pads inside the `Text`, so the
// padding carries the base style. Python Rich 9d8f9a3 renders
// `Text("T", style="on red", justify=j)` at width 10 as one "on red" run of
// ten cells for each of these.
describe("RichText justify pads in its base style", () => {
  it.each([["center"], ["left"], ["right"]] as const)("%s", (justify) => {
    const segs = [...new RichText("T", { style: "on red", justify, end: "" }).render({ maxWidth: 10 })];
    expect(segs.map((s) => s.text).join("")).toHaveLength(10);
    expect(segs.every((s) => String(s.style) === "on red")).toBe(true);
  });
});
