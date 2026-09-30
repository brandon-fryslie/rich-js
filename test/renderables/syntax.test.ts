import { describe, it, expect } from "vitest";
import { Syntax, type SyntaxOptions } from "../../src/renderables/syntax.js";
import { Segment } from "../../src/core/segment.js";
import { DEFAULT_THEME, Theme } from "../../src/core/style.js";
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

  // --- Tab Size ---

  it("expands tabs to specified tab size", () => {
    const s = new Syntax("\tindented", "text", { tabSize: 2 });
    expect(collectLines(s, { maxWidth: 80 })).toEqual(["  indented"]);
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

  // --- Removed options ---

  it("accepts no option it would ignore", () => {
    // @ts-expect-error theme is the console's Theme, not an option
    const theme: SyntaxOptions = { theme: "monokai" };
    // @ts-expect-error wrap a Syntax in Padding to pad it
    const padding: SyntaxOptions = { padding: 1 };
    // @ts-expect-error a language with no grammar here is a compile error
    const rust = new Syntax("fn main() {}", "rust");
    expect([theme, padding, rust]).toHaveLength(3);
    expect("fromPath" in Syntax).toBe(false);
  });

  // --- Measurement ---

  it("measures the lines it shows, gutter included", () => {
    const s = new Syntax("a\n\tbb\n" + "c".repeat(40), "text", { lineNumbers: true, lineRange: [1, 2], tabSize: 2 });
    expect(s.measure({ maxWidth: 80 }).maximum).toBe(4 + 4);
  });

  it("measurement is capped by the width offered", () => {
    const s = new Syntax("x".repeat(100), "text");
    expect(s.measure({ maxWidth: 80 }).maximum).toBe(80);
  });
});
