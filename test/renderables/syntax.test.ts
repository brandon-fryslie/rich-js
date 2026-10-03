import { describe, it, expect } from "vitest";
import { Syntax, type SyntaxLanguage, type SyntaxOptions } from "../../src/renderables/syntax.js";
import { Segment } from "../../src/core/segment.js";
import { DEFAULT_THEME, Theme } from "../../src/core/style.js";
import { ColorDepth } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectLines(r: Renderable, opts: RenderOptions): string[] {
  const segs = [...r.render(opts)];
  return Segment.splitLines(segs).map((l) => l.map((s) => s.text).join(""));
}

/** The theme name each non-blank segment's style is, or "-" for none of them. */
function tokens(r: Renderable, opts: RenderOptions = { maxWidth: 80 }): [string, string][] {
  const names = ["keyword", "constant", "string", "number", "comment"].map((n) => `syntax.${n}`);
  return [...r.render(opts)]
    .filter((seg) => seg.text.trim() !== "")
    .map((seg) => [
      seg.text,
      names.find((name) => seg.style?.equals((opts.theme ?? DEFAULT_THEME).resolve(name))) ?? "-",
    ]);
}

describe("Syntax", () => {
  // --- Construction ---

  it("constructs from code string and language", () => {
    const s = new Syntax("const x = 42;", "javascript");
    const text = collectText(s, { maxWidth: 80 });
    expect(text).toContain("const");
    expect(text).toContain("42");
  });

  it("constructs with language defaulting to text", () => {
    const s = new Syntax("hello world");
    expect(s.language).toBe("text");
    expect(collectText(s, { maxWidth: 80 })).toContain("hello world");
  });

  it("keeps empty lines", () => {
    const s = new Syntax("a\n\nb", "text", { lineNumbers: true });
    expect(collectLines(s, { maxWidth: 80 }).map((l) => l.trimEnd())).toEqual(["1 │ a", "2 │", "3 │ b"]);
  });

  // --- Language ---

  it("tokenizes javascript", () => {
    expect(tokens(new Syntax("const s = 'x' // done", "javascript"))).toEqual([
      ["const", "syntax.keyword"],
      [" s = ", "-"],
      ["'x'", "syntax.string"],
      ["// done", "syntax.comment"],
    ]);
  });

  it("gives the language's own keywords: typescript has interface, javascript does not", () => {
    expect(tokens(new Syntax("interface", "typescript"))).toEqual([["interface", "syntax.keyword"]]);
    expect(tokens(new Syntax("interface", "javascript"))).toEqual([["interface", "-"]]);
  });

  it("reads // as floor division in python and # as its comment", () => {
    expect(tokens(new Syntax("x = a // 2  # half", "python"))).toEqual([
      ["x = a // ", "-"],
      ["2", "syntax.number"],
      ["# half", "syntax.comment"],
    ]);
  });

  it("reads a python triple-quoted string across lines as one string", () => {
    const lines = collectLines(new Syntax('s = """a\ndef b"""', "python"), { maxWidth: 80 });
    expect(lines).toEqual(['s = """a', 'def b"""']);
    expect(tokens(new Syntax('s = """a\ndef b"""', "python"))).toEqual([
      ["s = ", "-"],
      ['"""a', "syntax.string"],
      ['def b"""', "syntax.string"],
    ]);
  });

  it("takes # as a comment in bash only where a word starts", () => {
    expect(tokens(new Syntax("echo $# # count", "bash"))).toEqual([
      ["echo $# ", "-"],
      ["# count", "syntax.comment"],
    ]);
  });

  it("does not take a property named like a keyword for one", () => {
    expect(tokens(new Syntax("m.get(k); n.type; x.set(v)", "typescript"))).toEqual([
      ["m.get(k); n.type; x.set(v)", "-"],
    ]);
  });

  it("does not highlight text", () => {
    expect(tokens(new Syntax("return 'x' // 1", "text"))).toEqual([["return 'x' // 1", "-"]]);
  });

  it("does not take a keyword or a comment marker inside a string", () => {
    expect(tokens(new Syntax('"return // no"', "javascript"))).toEqual([['"return // no"', "syntax.string"]]);
  });

  // --- Theme ---

  it("takes its token colours from the render's theme", () => {
    const theme = new Theme({ "syntax.keyword": "#123456" });
    const [seg] = [...new Syntax("return", "javascript").render({ maxWidth: 80, theme })];
    expect(seg!.style!.equals(theme.resolve("#123456"))).toBe(true);
  });

  // --- Line Numbers ---

  it("renders with line numbers", () => {
    const s = new Syntax("line1\nline2\nline3", "text", { lineNumbers: true });
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["1 │ line1", "2 │ line2", "3 │ line3"]);
  });

  it("renders with custom start line", () => {
    const s = new Syntax("code", "text", { lineNumbers: true, startLine: 10 });
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["10 │ code"]);
  });

  // --- Line Range ---

  it("shows the lines in range, numbered as they are in the whole code", () => {
    const s = new Syntax("a\nb\nc\nd", "text", { lineNumbers: true, lineRange: [3, 4] });
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["3 │ c", "4 │ d"]);
  });

  it("counts a range from startLine", () => {
    const s = new Syntax("a\nb\nc\nd", "text", { lineNumbers: true, startLine: 10, lineRange: [3, 4] });
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["12 │ c", "13 │ d"]);
  });

  it("highlights a range that starts inside a multi-line string as that string", () => {
    const s = new Syntax('"""\ndoc if\nend"""\nx = 1', "python", { lineRange: [2, 3] });
    expect(tokens(s)).toEqual([
      ["doc if", "syntax.string"],
      ['end"""', "syntax.string"],
    ]);
  });

  it("shows the part of a range inside the code, which may be none", () => {
    const code = "a\nb\nc";
    const lines = (lineRange: [number, number]): string[] =>
      collectLines(new Syntax(code, "text", { lineNumbers: true, lineRange }), { maxWidth: 80 });
    expect(lines([0, 2])).toEqual(["1 │ a", "2 │ b"]);
    expect(lines([3, 9])).toEqual(["3 │ c"]);
    expect(lines([10, 12])).toEqual([]);
  });

  // --- Highlight Lines ---

  it("draws a highlighted line's number in syntax.line_number.highlight", () => {
    const s = new Syntax("a\nb\nc\nd", "text", { lineNumbers: true, lineRange: [2, 3], highlightLines: new Set([3]) });
    const numbers = [...s.render({ maxWidth: 80 })].filter((seg) => /\d/.test(seg.text));
    const highlight = DEFAULT_THEME.resolve("syntax.line_number.highlight");
    expect(numbers.map((seg) => [seg.text.trim(), seg.style!.equals(highlight)])).toEqual([
      ["2", false],
      ["3", true],
    ]);
  });

  it("draws a highlighted line's number on the terminal's own colours at 16 colours, as Rich does", () => {
    // Rich drops the line-number background below 256 colours; a fixed ground
    // rounded to a slot is drawn in whatever colour the terminal's theme gives it.
    const s = new Syntax("a\nb", "text", { lineNumbers: true, highlightLines: new Set([2]) });
    const number = (colorSystem: ColorDepth) =>
      [...s.render({ maxWidth: 80, colorSystem })].find((seg) => seg.text.trim() === "2")!.style!;
    const highlight = DEFAULT_THEME.resolve("syntax.line_number.highlight");
    expect(number(ColorDepth.STANDARD)).toEqual(highlight.withoutColor);
    expect(number(ColorDepth.WINDOWS)).toEqual(highlight.withoutColor);
    expect(number(ColorDepth.EIGHT_BIT)).toEqual(highlight);
  });

  // --- Tab Size ---

  it("expands tabs to specified tab size", () => {
    const s = new Syntax("\tindented", "text", { tabSize: 2 });
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["  indented"]);
  });

  it("expands a mid-line tab to the next tab stop", () => {
    expect(collectLines(new Syntax("a\tb", "text", { tabSize: 4 }), { maxWidth: 80 })).toEqual(["a   b"]);
  });

  it("uses default tab size of 4", () => {
    const s = new Syntax("\tindented", "text");
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["    indented"]);
  });

  // --- Word Wrap ---

  it("crops a long line to the width by default", () => {
    const s = new Syntax("x".repeat(30), "text", { lineNumbers: true });
    expect(collectLines(s, { maxWidth: 14 })).toEqual(["1 │ " + "x".repeat(10)]);
  });

  it("wraps a long line under wordWrap, its continuation rows unnumbered", () => {
    const s = new Syntax("x".repeat(25) + "\ny", "text", { lineNumbers: true, wordWrap: true });
    expect(collectLines(s, { maxWidth: 14 })).toEqual([
      "1 │ " + "x".repeat(10),
      "  │ " + "x".repeat(10),
      "  │ " + "x".repeat(5),
      "2 │ y",
    ]);
  });

  // --- Width ---

  it("keeps each line's indent whatever justify it is offered", () => {
    const s = new Syntax("if (x) {\n    y();\n}", "javascript");
    expect(collectLines(s, { maxWidth: 20, justify: "right" }).map((l) => l.trimEnd())).toEqual([
      "if (x) {",
      "    y();",
      "}",
    ]);
  });

  it("draws no row wider than the width, even when the gutter alone is", () => {
    const s = new Syntax("abcdef", "text", { lineNumbers: true, wordWrap: true });
    expect(collectLines(s, { maxWidth: 3 }).every((line) => line.length <= 3)).toBe(true);
  });

  // --- Removed options ---

  it("accepts no option it would ignore", () => {
    // @ts-expect-error theme is the console's Theme, not an option
    const theme: SyntaxOptions = { theme: "monokai" };
    // @ts-expect-error wrap a Syntax in Padding to pad it
    const padding: SyntaxOptions = { padding: 1 };
    expect([theme, padding]).toHaveLength(2);
    expect("fromPath" in Syntax).toBe(false);
  });

  it("refuses a language it has no grammar for, by name, when it is given", () => {
    // @ts-expect-error a language with no grammar here is a compile error
    expect(() => new Syntax("fn main() {}", "rust")).toThrow(/no grammar for "rust"/);
    // A runtime value that gets past the type, as a plain-JS caller's would.
    const fromFile = "toString" as SyntaxLanguage;
    expect(() => new Syntax("x", fromFile)).toThrow(/no grammar for "toString"/);
  });

  // --- Measurement ---

  it("measures the lines it shows, gutter included", () => {
    const s = new Syntax("a\n\tbb\n" + "c".repeat(40), "text", { lineNumbers: true, lineRange: [1, 2], tabSize: 2 });
    expect(s.measure({ maxWidth: 80 }).maximum).toBe(4 + 4);
  });

  it("measures no narrower than its gutter and never min over max", () => {
    expect(new Syntax("a").measure({ maxWidth: 80 })).toEqual({ minimum: 0, maximum: 1 });
    expect(new Syntax("abc", "text", { lineNumbers: true }).measure({ maxWidth: 80 })).toEqual({ minimum: 4, maximum: 7 });
    expect(new Syntax("a").measure({ maxWidth: NaN })).toEqual({ minimum: 0, maximum: 0 });
  });

  it("measures a file of many lines", () => {
    expect(new Syntax("\n".repeat(300_000), "text").measure({ maxWidth: 80 }).maximum).toBe(0);
  });

  it("measurement is capped by the width offered", () => {
    const s = new Syntax("x".repeat(100), "text");
    expect(s.measure({ maxWidth: 80 }).maximum).toBe(80);
  });
});
