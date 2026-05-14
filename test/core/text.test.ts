import { describe, it, expect } from "vitest";
import { Span, RichText } from "../../src/core/text.js";
import { Style, NULL_STYLE } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";

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
    expect(new RichText("hi").style.isNull).toBe(true);
  });

  it(".style setter updates the base style", () => {
    const t = new RichText("hi");
    const bold = Style.parse("bold");
    t.style = bold;
    expect(t.style.bold).toBe(true);
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
    expect(copy.style.bold).toBe(true);
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
    expect(blank.style.italic).toBe(true);
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

  it("adds ellipsis when overflow is ellipsis", () => {
    const t = new RichText("hello world");
    t.truncate(6, { overflow: "ellipsis" });
    expect(t.plain).toContain("\u2026");
    expect(t.cellLength).toBeLessThanOrEqual(6);
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
    expect(t.style.bold).toBe(true);
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
    const red  = RichText.styled("red",  "red");
    const blue = RichText.styled("blue", "blue");
    // RichText.styled puts style as a span, not as the wrapping style — so
    // reframe: make fragments where the wrapping style is what carries colour.
    const f1 = new RichText("hello", { style: "red" });
    const f2 = new RichText("world", { style: "blue" });
    const t = RichText.fromFragments([f1, f2]);
    expect(t.plain).toBe("helloworld");
    // Two spans: one over the red range, one over the blue range.
    expect(t.spans).toHaveLength(2);
    expect(t.spans[0]!.start).toBe(0);
    expect(t.spans[0]!.end).toBe(5);
    expect(t.spans[0]!.style.color?.name).toBe("red");
    expect(t.spans[1]!.start).toBe(5);
    expect(t.spans[1]!.end).toBe(10);
    expect(t.spans[1]!.style.color?.name).toBe("blue");
    // Silence unused locals (red/blue were sketches).
    void red; void blue;
  });

  it("preserves a fragment's internal spans, shifted by its offset", () => {
    const f1 = new RichText("ab");
    f1.stylize("bold", 0, 1);   // span: "a" bold
    const f2 = new RichText("cd");
    f2.stylize("italic", 1, 2); // span: "d" italic
    const t = RichText.fromFragments([f1, f2]);
    expect(t.plain).toBe("abcd");
    // Spans propagated and offset: "a" bold (0-1), "d" italic (3-4).
    const bold = t.spans.find((s) => s.style.bold === true);
    expect(bold).toBeDefined();
    expect(bold!.start).toBe(0);
    expect(bold!.end).toBe(1);
    const italic = t.spans.find((s) => s.style.italic === true);
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
    expect(t.spans[0]!.style.underline).toBe(true);
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

  it("renders empty text with just end segment", () => {
    const t = new RichText("", { end: "\n" });
    const segments = collect(t.render({ maxWidth: 80 }));
    expect(segments).toHaveLength(1);
    expect(segments[0]!.text).toBe("\n");
  });

  it("does not wrap when noWrap is set", () => {
    const t = new RichText("abcdefghij", { noWrap: true });
    const segments = collect(t.render({ maxWidth: 5 }));
    const text = segText(segments);
    expect(text).toContain("abcdefghij");
  });

  it("expands tabs using tabSize", () => {
    const t = new RichText("a\tb", { tabSize: 4 });
    const segments = collect(t.render({ maxWidth: 80 }));
    const text = segText(segments);
    // Tab should be expanded to spaces (4 spaces for tabSize=4)
    expect(text).toContain("a" + " ".repeat(4) + "b");
  });

  it("default tabSize is 8", () => {
    const t = new RichText("a\tb");
    expect(t.render).toBeDefined();
    const segments = collect(t.render({ maxWidth: 80 }));
    const text = segText(segments);
    expect(text).toContain("a" + " ".repeat(8) + "b");
  });
});

// =========================================================
// Measurable
// =========================================================

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

  it("handles multiline text", () => {
    const t = new RichText("short\na longer line");
    const m = t.measure({ maxWidth: 80 });
    expect(m.maximum).toBe(13); // "a longer line"
  });
});
