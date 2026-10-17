import { describe, it, expect } from "vitest";
import { Markdown, type MarkdownOptions } from "../../src/renderables/markdown.js";
import { linkHref } from "../../src/renderables/markdown-url.js";
import { Segment } from "../../src/core/segment.js";
import { DEFAULT_THEME, Style, Theme } from "../../src/core/style.js";
import { ColorDepth } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectSegments(r: Renderable, opts: RenderOptions): Segment[] {
  return [...r.render(opts)];
}

describe("Markdown", () => {
  // --- Supported Elements ---

  it("renders headings as bold, sized by level", () => {
    const md = new Markdown("# Title\n## Subtitle");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Title");
    expect(text).toContain("Subtitle");
  });

  it("renders bold text", () => {
    const md = new Markdown("This is **bold** text");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("bold");
    // Verify bold styling is applied
    const segs = collectSegments(md, { maxWidth: 80 });
    const boldSeg = segs.find((s) => s.text === "bold");
    expect(boldSeg).toBeDefined();
    expect(boldSeg!.style).toBeDefined();
  });

  it("renders italic text", () => {
    const md = new Markdown("This is *italic* text");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("italic");
    const segs = collectSegments(md, { maxWidth: 80 });
    const italicSeg = segs.find((s) => s.text === "italic");
    expect(italicSeg).toBeDefined();
    expect(italicSeg!.style).toBeDefined();
  });

  it("renders fenced code blocks with language detection", () => {
    const md = new Markdown("```python\ndef hello():\n    print(\"Hello, World!\")\n```");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("def hello():");
    expect(text).toContain('print("Hello, World!")');
  });

  it("renders inline code as styled", () => {
    const md = new Markdown("Use the `render` function");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("render");
  });

  it("renders unordered lists with bullets", () => {
    const md = new Markdown("- Item A\n- Item B");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Item A");
    expect(text).toContain("Item B");
    expect(text).toContain("\u2022"); // bullet character
  });

  it("renders ordered lists with numbers", () => {
    const md = new Markdown("1. First\n2. Second");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("First");
    expect(text).toContain("Second");
    expect(text).toContain(" 1 First");
    expect(text).toContain(" 2 Second");
  });

  it("renders links", () => {
    const md = new Markdown("[Click here](https://example.com)");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Click here");
  });

  it("draws a quote's bar, and everything it holds, in markdown.block_quote, as Rich's BlockQuote does", () => {
    // Rich 15, '> a\n> > b': every bar, a and b all magenta; '> *e*': e italic magenta.
    const styled = (markdown: string, theme?: Theme) =>
      collectSegments(new Markdown(markdown), { maxWidth: 20, theme })
        .filter((s) => s.text.trim() !== "")
        .map((s): [string, string | undefined] => [s.text.trim(), s.style?.color?.name]);
    expect(styled("> a\n> > b")).toEqual([["▌", "magenta"], ["a", "magenta"], ["▌", "magenta"], ["▌", "magenta"], ["b", "magenta"]]);
    expect(styled("> a", new Theme({ "markdown.block_quote": "green" }))).toEqual([["▌", "green"], ["a", "green"]]);
    const e = collectSegments(new Markdown("> *e*"), { maxWidth: 20 }).find((s) => s.text === "e")?.style;
    expect(e).toEqual(Style.parse("magenta italic"));
    expect(DEFAULT_THEME.resolve("markdown.block_quote")).toEqual(Style.parse("magenta"));
  });

  it("renders horizontal rules as line separator", () => {
    const md = new Markdown("---");
    const text = collectText(md, { maxWidth: 80 });
    expect(text.length).toBeGreaterThan(0);
  });

  // --- Reflow ---

  function rows(markdown: string, maxWidth: number, options?: MarkdownOptions): string[] {
    return collectText(new Markdown(markdown, options), { maxWidth }).split("\n").map((row) => row.trimEnd());
  }

  it("reflows a hard-wrapped paragraph instead of keeping its source line breaks", () => {
    expect(rows("one two\nthree four\n  five", 80)).toEqual(["one two three four five", ""]);
  });

  // Rich 15 (markdown-it-py 4.2) for every case below.
  it("keeps a no-break space at a line ending, where only spaces and tabs break softly", () => {
    expect(rows("q $__\u00a0\nab", 80)).toEqual(["q $__\u00a0 ab", ""]);
    expect(rows("a\n\u00a0b", 80)).toEqual(["a \u00a0b", ""]);
    expect(rows("a\n\t b", 80)).toEqual(["a b", ""]);
  });

  it("reads a line of no-break spaces as text, not as a blank line", () => {
    expect(rows("q\n\u00a0\n_*__", 80)).toEqual(["q \u00a0 *_", ""]);
    expect(rows("> a\n\u00a0\nb", 80)).toEqual(["", "▌ a \u00a0 b", ""]);
    expect(rows("- a\n\u00a0\n- b", 80)).toEqual(["", " • a", " • b", ""]);
    // An HTML block runs to a blank line; Rich draws none of it.
    expect(rows("<div>\n\u00a0\nx", 80)).toEqual([""]);
    // The line ends the indented code, and the paragraph it opens takes the
    // next indented line, which cannot interrupt it.
    expect(rows("    code\n\u00a0\n    more", 80)).toEqual(["", " code", "", "", "more", ""]);
  });

  it("opens a heading or a list item only at a space or tab after its marker", () => {
    expect(rows("#\u00a0x", 80)).toEqual(["#\u00a0x", ""]);
    expect(rows("-\u00a0a", 80)).toEqual(["-\u00a0a", ""]);
  });

  it("strips a paragraph, a heading and a table cell as Python's str.strip does", () => {
    expect(rows("\u00a0a\u00a0", 80)).toEqual(["a", ""]);
    // `rows` trims as JavaScript does, which would take the U+FEFF Python keeps.
    expect(collectText(new Markdown("\ufeffa\ufeff"), { maxWidth: 80 }).split("\n").map((row) => row.replace(/ +$/, ""))).toEqual([
      "\ufeffa\ufeff",
      "",
    ]);
    expect(rows("#  \u00a0x\u00a0", 80)).toEqual([`${" ".repeat(39)}x`, ""]);
    expect(rows("| a |\n|---|\n\u00a0b\u00a0\n\u00a0\nz", 80)).toEqual(["", "", " a", " ─", " b", "", "", "z", ""]);
  });

  it("opens an ATX heading at a space, a tab or the end of the line after its #s", () => {
    // markdown-it's empty heading holds an empty inline token, which Rich exits as an element of its own.
    for (const md of ["para\n#", "para\n# ", "para\n#  "]) expect(rows(md, 80)).toEqual(["para", "", "", ""]);
    // A paragraph separator is no line ending to markdown-it, which splits lines at \\n alone.
    expect(rows("# a\u2029", 80)).toEqual([`${" ".repeat(39)}a`, ""]);
  });

  it("cuts an ATX heading's closing #s where a space or tab comes before them, as Rich does", () => {
    const h1 = (text: string) => [`${" ".repeat(40 - Math.ceil(text.length / 2))}${text}`, ""];
    expect(rows("# x #", 80)).toEqual(h1("x"));
    expect(rows("# x ##  ", 80)).toEqual(h1("x"));
    expect(rows("# x\t#\t", 80)).toEqual(h1("x"));
    expect(rows("# x ####### ", 80)).toEqual(h1("x"));
    expect(rows("## x ###", 80)).toEqual(["x", ""]);
    expect(rows("> ## x ##", 80)).toEqual(["", "▌ x", ""]);
    // Only the last run is cut, and only a closing run: text after a # keeps it.
    expect(rows("# x # #", 80)).toEqual(h1("x #"));
    expect(rows("# x  #  y #", 80)).toEqual(h1("x  #  y"));
    // A run closes only with a space or tab before it and nothing but spaces and tabs after it. A letter or
    // an escape before it, or anything else after it — a letter, a no-break space — and it is text.
    expect(rows("# x#", 80)).toEqual(h1("x#"));
    expect(rows("# #x", 80)).toEqual(h1("#x"));
    expect(rows("# x \\#", 80)).toEqual(h1("x #"));
    expect(rows("# \\##", 80)).toEqual(h1("##"));
    expect(rows("# x #\u00a0", 80)).toEqual(h1("x #"));
    // A heading of nothing but its closing run is empty.
    for (const md of ["# #", "# ###", "#\t#", "#  #  ", "##### #####"]) expect(rows(md, 80)).toEqual(["", "", ""]);
    expect(rows("para\n# #", 80)).toEqual(["para", "", "", ""]);
  });

  it("strips a space from each side of a code span padded by one, unless it is all whitespace, as Rich does", () => {
    expect(rows("a ` b ` c", 80)).toEqual(["a b c", ""]);
    expect(rows("a `  b  ` c", 80)).toEqual(["a  b  c", ""]);
    expect(rows("a `` ` `` c", 80)).toEqual(["a ` c", ""]);
    expect(rows("a `\nb\n` c", 80)).toEqual(["a b c", ""]);
    // Padding is a space on both sides: one side, or a tab, a no-break or an ideographic space, pads nothing.
    expect(rows("a ` b` c", 80)).toEqual(["a  b c", ""]);
    expect(rows("a `b ` c", 80)).toEqual(["a b  c", ""]);
    expect(rows("a `\u00a0b\u00a0` c", 80)).toEqual(["a \u00a0b\u00a0 c", ""]);
    expect(rows("a ` b\u3000` c", 80)).toEqual(["a  b\u3000 c", ""]);
    expect(rows("a `\tb\t` c", 80)).toEqual(["a       b        c", ""]);
    // All whitespace, as Python's str.strip reads it, is kept whole; U+FEFF is not whitespace there, so it is padded.
    expect(rows("a ` ` c", 80)).toEqual(["a   c", ""]);
    expect(rows("a `  ` c", 80)).toEqual(["a    c", ""]);
    expect(rows("a `   ` c", 80)).toEqual(["a     c", ""]);
    expect(rows("a ` \u00a0 ` c", 80)).toEqual(["a  \u00a0  c", ""]);
    expect(rows("a ` \t ` c", 80)).toEqual(["a         c", ""]);
    expect(rows("a ` \u0085 ` c", 80)).toEqual(["a  \u0085  c", ""]);
    expect(rows("a ` \ufeff ` c", 80)).toEqual(["a \ufeff c", ""]);
  });

  it("keeps a paragraph line's indentation in a code span that crosses its line ending", () => {
    expect(rows("foo\n    bar `x\n  y`", 80)).toEqual(["foo bar x   y", ""]);
    expect(rows("> foo\n>     bar `x\n>   y`", 80)).toEqual(["", "▌ foo bar x   y", ""]);
    expect(rows("a\\\n   b", 80)).toEqual(["a", "b", ""]);
  });

  it("reads whitespace in an HTML block's tag as Python's re does", () => {
    expect(rows("<a>\u0085\nx", 80)).toEqual([""]);
    expect(rows("<div\ufeff\nx", 80)).toEqual(["<div\ufeff x", ""]);
  });

  it("keeps a list item's continuation lines in the item, hanging under its text", () => {
    const md = "- alpha beta gamma\n  delta epsilon\n- zeta";
    expect(rows(md, 18)).toEqual(["", " • alpha beta", "   gamma delta", "   epsilon", " • zeta", ""]);
  });

  it("ends every list item on its own row", () => {
    expect(rows("- Item A\n- Item B\n1. First\n2. Second", 80)).toEqual([
      "",
      " • Item A",
      " • Item B",
      "",
      " 1 First",
      " 2 Second",
      "",
    ]);
  });

  it("draws a nested list under its parent's text, however far the source indents it", () => {
    for (const md of ["- parent\n  - child", "- parent\n    - child"]) {
      expect(rows(md, 80)).toEqual(["", " • parent", "    • child", ""]);
    }
    expect(rows("- parent\n  1. child", 80)).toEqual(["", " • parent", "    1 child", ""]);
  });

  // Rich 15's own rows, trailing spaces kept: BlockQuote lays its content out
  // at the width less four beside a two-cell bar, so a quote's rows end two
  // cells short of the width.
  it.each<[string, number, MarkdownOptions | undefined, string[]]>([
    ["> one two\n> three four", 12, undefined, ["", "▌ one two ", "▌ three   ", "▌ four    ", ""]],
    ["> ---", 40, undefined, [`▌ ${"-".repeat(36)}`, `▌ ${" ".repeat(36)}`, ""]],
    ["> one two", 12, { justify: "right" }, ["", "▌  one two", ""]],
    ["> one two", 12, { justify: "center" }, ["", "▌ one two ", ""]],
    ["> one two three four five", 12, { justify: "full" }, ["", "▌ one  two", "▌ three   ", "▌ four    ", "▌ five    ", ""]],
    ["> > one two three", 12, undefined, ["", "▌ ▌ one   ", "▌ ▌ two   ", "▌ ▌ thre  ", "▌ ▌ e     ", ""]],
  ])("lays the quote in %j at width %i with %j out as Rich does", (source, width, options, expected) => {
    expect(collectText(new Markdown(source, options), { maxWidth: width }).split("\n")).toEqual(expected);
  });

  it("keeps every row inside its width when a list runs into a paragraph", () => {
    // A row wider than the width is cut off by whatever frames it, so its
    // tail is lost rather than wrapped.
    const out = rows("- first item\n  continues here\nand runs on\n\nafter the gap", 16);
    expect(out.every((row) => row.length <= 16)).toBe(true);
    expect(out).toEqual(["", " • first item", "   continues", "   here and runs", "   on", "", "after the gap", ""]);
  });

  it("leaves a wrapped line that starts with a number other than 1 in its paragraph", () => {
    expect(rows("the total was\n2024. That year", 80)).toEqual(["the total was 2024. That year", ""]);
  });

  it("reads a paragraph underlined with = or - as a heading, not a rule", () => {
    expect(rows("Title\n===\nSub\n---\nbody", 11)).toEqual(["   Title", "", "Sub", "", "body", ""]);
  });

  it("keeps a hard line break, from two trailing spaces or a backslash", () => {
    expect(rows("one  \ntwo\\\nthree\nfour", 80)).toEqual(["one", "two", "three four", ""]);
  });

  // Each row is Rich 14's drawing of the source: the inline pass reads each line ending, as markdown-it's does.
  it.each<[string, string[]]>([
    // An escaped backslash breaks nothing, and an escaped space is no part of two trailing spaces.
    ["x\\\\\ny", ["x\\ y", ""]],
    ["a\\  \nb", ["a\\  b", ""]],
    // A code span's line ending is a space, its trailing spaces kept.
    ["x `a  \nb` y", ["x a   b y", ""]],
    ["x `a \nb` y", ["x a  b y", ""]],
    ["[a](\nu) z", ["a (u) z", ""]],
    ["a\t\nb", ["a        b", ""]],
    ["![a\nb](u) z", ["🌆 a", "b  z", ""]],
  ])("reads the line endings of %j as markdown-it does", (source, expected) => {
    expect(rows(source, 80, { hyperlinks: false })).toEqual(expected);
  });

  // Rich draws the blocks inside a container one under the next, with no row between them.
  it("ends a quote's paragraph at a bare > line without leaking the marker", () => {
    expect(rows("> a\n>\n>b", 80)).toEqual(["", "▌ a", "▌ b", ""]);
  });

  it("draws the blocks inside a quote as blocks, beside its bar", () => {
    expect(rows("> - a\n> - b\n> soft\n>\n> para two", 80)).toEqual([
      "",
      "▌  • a",
      "▌  • b soft",
      "▌ para two",
      "",
    ]);
  });

  it("draws a fenced block inside a quote, its padding inside the quote's bar", () => {
    expect(rows("> ```\n> a = 1\n> b = 2\n> ```", 80)).toEqual(["", "▌", "▌  a = 1", "▌  b = 2", "▌", ""]);
  });

  it("ends a quote at an unmarked line after a bare >, and lazily continues its open paragraph", () => {
    expect(rows("> quoted\n>\nNot quoted", 80)).toEqual(["", "▌ quoted", "", "Not quoted", ""]);
    expect(rows("> the total was\nthat year", 80)).toEqual(["", "▌ the total was that year", ""]);
    // Outside the quote no paragraph is open, so an item opens whatever it counts from.
    expect(rows("> the total was\n2024. That year", 80)).toEqual(["", "▌ the total was", "", " 2024 That year", ""]);
  });

  it("leaves a list item's wrapped line that starts with a number other than 1 in the item", () => {
    expect(rows("- item\n  2024. That year", 80)).toEqual(["", " • item 2024. That year", ""]);
  });

  it("starts a sibling item at the marker's own column whatever it counts from", () => {
    expect(rows("1. a\n2. b", 80)).toEqual(["", " 1 a", " 2 b", ""]);
  });

  it("draws an empty quote as no row, and the row ahead of it", () => {
    expect(rows("1. x\n\n>", 80)).toEqual(["", " 1 x", "", ""]);
  });

  it("reads CRLF line endings as line endings", () => {
    expect(rows("## Title\r\n- item\r\n- next", 80)).toEqual(["Title", "", " • item", " • next", ""]);
  });

  it("indents a tab-nested item by the columns the tab spans, never a raw tab", () => {
    const out = rows("- parent\n\t- child text", 20);
    expect(out).toEqual(["", " • parent", "    • child text", ""]);
  });

  it("counts a tab inside an item from the source's column 0, not the item's", () => {
    expect(rows("- a\n\n  \tb", 20)).toEqual(["", " • a", "   b", ""]);
    expect(rows("- parent\n  \t- child", 20)).toEqual(["", " • parent", "    • child", ""]);
  });

  it("reads a tab after a quote's marker as the space it may take, then indentation", () => {
    expect(rows(">\tfoo", 20)).toEqual(["", "▌ foo", ""]);
    expect(rows(">\t\tfoo", 20)).toEqual(["", "▌", "▌    foo", "▌", ""]);
  });

  it("draws a tab in code as spaces to the code's own stops, never a raw tab", () => {
    expect(rows("- a\n\n  ```\n  \tx\n  ```", 20)).toEqual(["", " • a", "", "        x", "", ""]);
    expect(rows("    \tx", 20)).toEqual(["", "     x", "", ""]);
  });

  it("draws a code block as Rich's CodeBlock does: word-wrapped inside a padding of one cell, its trailing whitespace dropped", () => {
    const full = (markdown: string, maxWidth: number) => collectText(new Markdown(markdown), { maxWidth }).split("\n");
    // Rich 15's rows, trailing spaces and all.
    expect(full("```\naaa bbb ccc ddd eee fff ggg\n```", 20)).toEqual([" ".repeat(20), " aaa bbb ccc ddd    ", " eee fff ggg        ", " ".repeat(20), ""]);
    expect(full("```\n" + "x".repeat(20) + "\n```", 12)).toEqual([" ".repeat(12), " xxxxxxxxxx ", " xxxxxxxxxx ", " ".repeat(12), ""]);
    expect(full("```\n```", 6)).toEqual(["      ", "      ", "      ", ""]);
    expect(full("```\n\t\tx\ty\n```", 16)).toEqual([" ".repeat(16), "         x   y  ", " ".repeat(16), ""]);
    // Python's whitespace, not JavaScript's: NEL and U+001F go, U+FEFF stays.
    expect(full("```\nx \u0085\u001f\n\n```", 6)).toEqual(["      ", " x    ", "      ", ""]);
    expect(full("```\nx﻿\n```", 6)).toEqual(["      ", " x﻿    ", "      ", ""]);
    // Squeezed, the code keeps a column before the padding does, as every
    // Padding does; Rich draws only the padding's rows here.
    expect(full("```\nab\n```", 2)).toEqual(["  ", " a", " b", "  ", ""]);
    expect(full("```\nab\n```", 1)).toEqual([" ", "a", "b", " ", ""]);
  });

  it("parses the width once, as every renderable does, before a code block draws in it", () => {
    expect(rows("```\nab\n```", -1)).toEqual(["", "", "", ""]);
    expect(rows("```\nab\n```", 4.5)).toEqual(["", " ab", "", ""]);
  });

  it("draws every cell of a code block, its padding included, in the code's style", () => {
    const styles = collectSegments(new Markdown("```\nab\n```"), { maxWidth: 6 }).filter((s) => s.text !== "\n").map((s) => s.style);
    expect(styles).toEqual(styles.map(() => DEFAULT_THEME.resolve("markdown.code")));
  });

  it("opens a fence or a quote indented up to three columns inside an item", () => {
    expect(rows("- step\n\n    ```\n    npm i\n    ```", 20)).toEqual(["", " • step", "", "    npm i", "", ""]);
    expect(rows("- a\n   > q", 20)).toEqual(["", " • a", "   ▌ q", ""]);
  });

  it("continues a parent's text with a marker indented four columns past it, as CommonMark does", () => {
    expect(rows("- parent\n      - child", 40)).toEqual(["", " • parent - child", ""]);
  });

  it("reads a line of the list's own bullets as a thematic break, not an item", () => {
    // Rich 15's own rows.
    expect(rows("* a\n* * *\n* b", 10)).toEqual(["", " • a", "", "-".repeat(10), "", "", " • b", ""]);
    expect(rows("_ _ _", 5)).toEqual(["-----", "", ""]);
  });

  it("reads a lazy line of `=` as paragraph text, never as an underline, and a lazy indented marker as text", () => {
    expect(rows("> foo\n===", 20)).toEqual(["", "▌ foo ===", ""]);
    expect(rows("- foo\n===", 20)).toEqual(["", " • foo ===", ""]);
    expect(rows("> foo\n    - bar", 20)).toEqual(["", "▌ foo - bar", ""]);
  });

  it("reads a line of `=` on its own as text", () => {
    expect(rows("para\n\n===", 20)).toEqual(["para", "", "===", ""]);
  });

  it("reads long lazy and deeply nested hard-wrapped text in time linear in its length", () => {
    const wrapped = Array.from({ length: 2000 }, (_, n) => `word${n}`).join("\n");
    const started = performance.now();
    rows(`> ${wrapped}`, 80);
    rows(`- - - ${wrapped}`, 80);
    rows(`text ${"[1, ".repeat(5000)}`, 80);
    // The quadratic reader took over a second for a tenth of this input; linear takes milliseconds.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("reads a run of quotes in time linear in its length, whether each takes its lazy line or not", () => {
    const started = performance.now();
    new Markdown("> # h\nx\n".repeat(4000));
    // Copying every line a quote might take before reading it took eight seconds here.
    new Markdown("> a\nb\n".repeat(4000));
    // Reading a quote again for each lazy line it took took nine seconds here.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("reads a paragraph behind unclosed brackets in time linear in its length", () => {
    const started = performance.now();
    new Markdown("[".repeat(19) + "a".repeat(2_000_000));
    // A label scan stepping a character at a time, once per bracket, took ten seconds here.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("reads a long run of spaces in time linear in its length", () => {
    const started = performance.now();
    new Markdown(`a${" ".repeat(100_000)}b`);
    // Scanning ahead from each space for a line ending took over four seconds here.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("reads a run of unclosed links in time linear in its length", () => {
    const started = performance.now();
    rows("[*a](".repeat(20_000), 80);
    // A destination scanned to the end of the text from every `](` took fourteen seconds here.
    rows(`[a](b${" ".repeat(100_000)}x`, 80);
    // A tail splitting the space after a destination every way it could took six seconds here.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("keeps an item's text when its gutter is as wide as the width", () => {
    expect(rows("- hi", 3)).toEqual(["", " • h", "   i", ""]);
  });

  // --- Lists hold blocks, as CommonMark reads them ---

  it("keeps a fence inside a list item, line for line under its hang", () => {
    expect(rows("- step:\n  ```sh\n  npm i\n  npm test\n  ```", 80)).toEqual([
      "",
      " • step:",
      "",
      "    npm i",
      "    npm test",
      "",
      "",
    ]);
  });

  it("draws a quote inside a list item under its hang", () => {
    expect(rows("- item\n  > quoted", 80)).toEqual(["", " • item", "   ▌ quoted", ""]);
  });

  it("makes a number short of the content column a sibling, numbered on from the first", () => {
    expect(rows("1. a\n  5. b", 80)).toEqual(["", " 1 a", " 2 b", ""]);
    expect(rows("1. a\n1. b\n1. c", 80)).toEqual(["", " 1 a", " 2 b", " 3 c", ""]);
  });

  it("reads a number closed by ')' as an ordered item, and a change of delimiter as a new list, as Rich does", () => {
    expect(rows("3) a\n4) b", 80)).toEqual(["", " 3 a", " 4 b", ""]);
    expect(rows("10) a\n11) b", 80)).toEqual(["", " 10 a", " 11 b", ""]);
    expect(rows("1) a\n\n2) b", 80)).toEqual(["", " 1 a", " 2 b", ""]);
    expect(rows("1. a\n2) b", 80)).toEqual(["", " 1 a", "", " 2 b", ""]);
    expect(rows("1) a\n2. b", 80)).toEqual(["", " 1 a", "", " 2 b", ""]);
    expect(rows("- a\n1) b", 80)).toEqual(["", " • a", "", " 1 b", ""]);
    // Inside an item, or a quote, the change of delimiter still opens a new list, counting from its own number.
    expect(rows("1) a\n   1. b\n   5) c", 80)).toEqual(["", " 1 a", "    1 b", "    5 c", ""]);
    expect(rows("> 1) a\n> 2) b\n> 7. c", 80)).toEqual(["", "▌  1 a", "▌  2 b", "▌  7 c", ""]);
    // Under a paragraph only a 1 opens a list, whichever the delimiter.
    expect(rows("x\n1) b", 80)).toEqual(["x", "", " 1 b", ""]);
    expect(rows("x\n2) b", 80)).toEqual(["x 2) b", ""]);
    // No space after the marker, or ten digits, is text.
    expect(rows("1)a", 80)).toEqual(["1)a", ""]);
    expect(rows("1234567890) a", 80)).toEqual(["1234567890) a", ""]);
  });

  it("right-aligns a list's numbers in a column sized for one past the last, as Rich does", () => {
    // Ten columns' worth for nine items from 1 — Rich sizes the column by
    // `last_number`, one past the last.
    expect(rows("9. a\n10. b\n    more", 80)).toEqual(["", "  9 a", " 10 b more", ""]);
    expect(rows(Array.from({ length: 9 }, (_, n) => `${n + 1}. x`).join("\n"), 80)[1]).toBe("  1 x");
    expect(rows("7. a\n8. b", 80)).toEqual(["", " 7 a", " 8 b", ""]);
  });

  it("draws a bullet and its hang in markdown.item.bullet, a number and its hang in markdown.item.number, and the item in markdown.item", () => {
    const theme = new Theme({ "markdown.item.bullet": "red", "markdown.item.number": "green", "markdown.item": "italic" });
    const segs = collectSegments(new Markdown("- a b\n\n1. c d"), { maxWidth: 5, theme });
    const styleOf = (text: string) => segs.filter((s) => s.text === text).map((s) => s.style?.color?.name);
    expect(styleOf(" • ")).toEqual(["red"]);
    expect(styleOf(" 1 ")).toEqual(["green"]);
    expect(styleOf("   ")).toEqual(["red", "green"]);
    // The item's whole width, its padding with its text, as Rich's render_lines pads it.
    const body = segs.filter((s) => s.text !== "" && s.text !== "\n" && ![" • ", " 1 ", "   "].includes(s.text));
    expect(body.map((s) => s.text).join("")).toBe("a b c d ");
    expect(body.every((s) => s.style?.italic)).toBe(true);
    // Rich's defaults.
    expect(DEFAULT_THEME.resolve("markdown.item.bullet")).toEqual(Style.parse("bold"));
    expect(DEFAULT_THEME.resolve("markdown.item.number")).toEqual(Style.parse("cyan"));
  });

  it("reads a marker four columns in as indented code, not a list", () => {
    expect(rows("    - not a list", 80)).toEqual(["", " - not a list", "", ""]);
  });

  it("reads an empty item as an item, and draws nothing for it, as Rich does", () => {
    expect(rows("- \n- x", 80)).toEqual(["", " • x", ""]);
    expect(rows("1.  \n2. x", 80)).toEqual(["", " 2 x", ""]);
    expect(rows("- a\n-\n- b", 80)).toEqual(["", " • a", " • b", ""]);
    // A loose list's empty item stacks no row on either side of it.
    expect(rows("- a\n\n-\n\n- b", 80)).toEqual(["", " • a", " • b", ""]);
  });

  it("ends a list at the second blank line after an empty item, as Rich does", () => {
    // markdown-it's list rule reads the line two past an empty item followed by a blank one, skipping no more.
    expect(rows("-\n\n- a", 80)).toEqual(["", " • a", ""]);
    expect(rows("-\n\n\n- a", 80)).toEqual(["", "", " • a", ""]);
    expect(rows("-\n\n\n\n- a", 80)).toEqual(["", "", " • a", ""]);
    expect(rows("-\n\t\n\n- a", 80)).toEqual(["", "", " • a", ""]);
    expect(rows("1.\n\n\n2. a", 80)).toEqual(["", "", " 2 a", ""]);
    expect(rows("- a\n\n-\n\n\n- b", 80)).toEqual(["", " • a", "", " • b", ""]);
    // Inside a container too; a second list numbers from its own start, where the first would go on.
    expect(rows("> 1.\n>\n>\n> 1. a", 80)).toEqual(["", "▌  1 a", ""]);
    expect(rows("> 1.\n>\n> 1. a", 80)).toEqual(["", "▌  2 a", ""]);
    expect(rows("- 1.\n\n\n  1. b", 80)).toEqual(["", " •  1 b", ""]);
    expect(rows("- 1.\n\n  1. b", 80)).toEqual(["", " •  2 b", ""]);
    // An item whose content starts on its second line is not empty.
    expect(rows("1.\n   foo\n\n\n1. b", 80)).toEqual(["", " 1 foo", " 2 b", ""]);
    expect(rows("1.\n   foo\n\n   bar\n\n\n1. b", 80)).toEqual(["", " 1 foo", "   bar", " 2 b", ""]);
  });

  it("keeps a loose item's later paragraphs in the item, with no row between them, as Rich draws them", () => {
    expect(rows("- one\n\n  two\n\n- three", 80)).toEqual(["", " • one", "   two", " • three", ""]);
  });

  it("ends a list item at an unindented line once no paragraph is open", () => {
    expect(rows("- a\n\nafter", 80)).toEqual(["", " • a", "", "after", ""]);
    expect(rows("- ```\n  code\nafter", 80)).toEqual(["", " •", "    code", "", "", "after", ""]);
  });

  // markdown-it-py 4.2's fence tokens, and Rich 15's rows, for every case below.
  it.each<[string, string[]]>([
    // A backtick fence's info string holds no backtick; a tilde fence's holds anything.
    ["```_ xaa`", ["```_ xaa`", ""]],
    ["para\n```a`\nmore", ["para ```a` more", ""]],
    ["~~~a~~~", ["", "", "", ""]],
    ["~~~~a~~ b~~", ["", "", "", ""]],
    ["~~~ `x`\ncode\n~~~\nafter", ["", " code", "", "", "after", ""]],
    ["para\n~~~\ncode\n~~~", ["para", "", "", " code", "", ""]],
    // Only a run of the opener's marker at least as long closes it, then only spaces and tabs.
    ["````\ncode\n```\nmore\n````\nafter", ["", " code", " ```", " more", "", "", "after", ""]],
    ["```\ncode\n~~~\n```\nafter", ["", " code", " ~~~", "", "", "after", ""]],
    ["```\ncode\n```` \nafter", ["", " code", "", "", "after", ""]],
    ["```\ncode\n```\t\n- after", ["", " code", "", "", " • after", ""]],
    ["```\ncode\n``` x\n```\nafter", ["", " code", " ``` x", "", "", "after", ""]],
    ["```\ncode\n```\u00a0\n- after\n```", ["", " code", " ```", " - after", "", ""]],
    ["```\ncode\n    ```\nafter", ["", " code", "     ```", " after", "", ""]],
  ])("opens and closes the fence in %j as markdown-it does, as Rich does", (source, expected) => {
    expect(rows(source, 80)).toEqual(expected);
  });

  // --- Inline links and images, as Rich draws them ---

  it("keeps parentheses that balance inside a link's URL", () => {
    const md = "[wiki](https://en.wikipedia.org/wiki/Foo_(bar))";
    expect(rows(md, 80)).toEqual(["wiki", ""]);
    expect(segment(md, "wiki").style?.link).toBe("https://en.wikipedia.org/wiki/Foo_(bar)");
    expect(rows(md, 80, { hyperlinks: false })).toEqual(["wiki (https://en.wikipedia.org/wiki/Foo_(bar))", ""]);
  });

  it("parses a link's text as inline Markdown", () => {
    const md = "[**bold** docs](https://x)";
    expect(rows(md, 80)).toEqual(["bold docs", ""]);
    expect(rows(md, 80, { hyperlinks: false })).toEqual(["bold docs (https://x)", ""]);
    const bold = segment(md, "bold").style;
    expect(bold?.bold).toBe(true);
    expect(bold?.link).toBe("https://x");
    // Without hyperlinks, Rich writes the label's text plain in markdown.link.
    expect(segment(md, "bold docs", { hyperlinks: false }).style?.bold).toBeFalsy();
  });

  it("draws an image as Rich does: a picture, then its alt text linked to the image", () => {
    expect(rows("![logo](a.png)", 80)).toEqual(["🌆 logo", ""]);
    expect(segment("![logo](a.png)", "logo").style?.link).toBe("a.png");
    expect(rows("![logo](a.png)", 80, { hyperlinks: false })).toEqual(["🌆 logo", ""]);
    expect(rows("![](img/a.png)", 80)).toEqual(["🌆 a.png", ""]);
  });

  // Each case below is Rich 14's own output for its source, at width 40: every
  // image in a block drawn ahead of the block, where Rich's render loop meets it.
  it.each([
    ["a ![i](p.png) b", ["🌆 i a  b", ""]],
    ["a ![i](p.png) b ![j](q.png) c", ["🌆 i 🌆 j a  b  c", ""]],
    ["p1\n\np2 ![i](p.png) q", ["p1", "", "🌆 i p2  q", ""]],
    ["# h ![i](p.png) t", ["🌆 i                   h  t", ""]],
    ["[x ![img](a.png) y](http://out) c", ["🌆 img x  y c", ""]],
    // Rich 15 skips inline HTML; Rich 14 drew it as an element, which broke the image's row.
    ["a ![i](p.png) <b>x</b> c", ["🌆 i a  x c", ""]],
    // A table's cells are elements of their own, so each image after the
    // first, and the table itself, starts a row.
    ["| h ![i](p.png) |\n|---|\n| c ![j](q.png) |", ["🌆 i", "🌆 j", "", " h", " ──", " c", "", ""]],
  ])("draws the images in %j ahead of their block, as Rich does", (source, expected) => {
    expect(rows(source, 40)).toEqual(expected);
  });

  it("owes no newline after a rule, as Rich's render loop does not", () => {
    // Rich 15: ["🌆 i ▌ x", "▌ " + 36×"-", "▌", ""].
    expect(rows("> x ![i](p.png)\n>\n> ***", 40)).toEqual(["🌆 i ▌ x", `▌ ${"-".repeat(36)}`, "▌", ""]);
  });

  // --- Blank rows between blocks ---

  // Rich 15's own output for each source at width 40. Rich reads no blank line
  // of the source: every element it exits sets `new_line` but a rule and an
  // image, and a blank row goes ahead of whatever it draws next while it is set.
  it.each<[string, string[]]>([
    ["a\n\nb", ["a", "", "b", ""]],
    ["a\n\n\nb", ["a", "", "b", ""]],
    ["a\n  \n\nb", ["a", "", "b", ""]],
    ["a\n\t\n \nb", ["a", "", "b", ""]],
    ["## h\nb", ["h", "", "b", ""]],
    // A list, a quote or a table draws as it closes, after the blocks inside it set the flag.
    ["- a", ["", " • a", ""]],
    ["x\n- a", ["x", "", " • a", ""]],
    ["> q", ["", "▌ q", ""]],
    ["x\n> q", ["x", "", "▌ q", ""]],
    ["| a |\n|---|\n|  |", ["", "", " a", " ─", "", "", ""]],
    // Inside a container the blocks stack with no row between them.
    ["- a\n\n\n- b", ["", " • a", " • b", ""]],
    ["> a\n>\n>\n> b", ["", "▌ a", "▌ b", ""]],
    // An image draws the moment it is met, the flag checked ahead of it.
    ["- a\n\n  ![i](p.png)", ["", "🌆 i", " • a", "", ""]],
    ["- a\n- b ![i](p.png)", ["", "🌆 i", " • a", " • b", ""]],
    // An empty heading holds an empty inline token, an element of its own, which sets the flag.
    ["#", ["", "", ""]],
    // An empty quote draws no row, and the flag its exit sets still puts one ahead of the next block.
    [">", [""]],
    [">\nb", ["", "b", ""]],
    ["p\n\n>\n\nb", ["p", "", "", "b", ""]],
    ["> " + "- ".repeat(10) + "x\n> y\nb", ["", ""]],
    ["p\n\n" + ">".repeat(20) + " x\n" + ">".repeat(20) + "\ny", ["p", "", "", "y", ""]],
  ])("draws the blank rows in %j as Rich does", (source, expected) => {
    expect(rows(source, 40)).toEqual(expected);
  });

  it("draws a rule's own blank row after it, and none from the flag, as Rich does", () => {
    // Rich 15's own rows, its HorizontalRule drawn in `-`.
    const rule = "-".repeat(40);
    expect(rows("---\nx", 40)).toEqual([rule, "", "x", ""]);
    expect(rows("x\n\n\n---\n\n\ny", 40)).toEqual(["x", "", rule, "", "y", ""]);
    expect(rows("---\n#", 40)).toEqual([rule, "", "", "", ""]);
    expect(rows("---\n# ![i](p.png)", 40)).toEqual([rule, "", "🌆 i", ""]);
  });

  it("pads every row of an item to its width, a rule's blank row included, as Rich's render_lines does", () => {
    // Rich 15 at width 20, trailing spaces kept.
    const text = collectText(new Markdown("- a\n\n  ---\n\n  b"), { maxWidth: 20 }).split("\n");
    expect(text).toEqual(["", ` • a${" ".repeat(16)}`, `   ${"-".repeat(17)}`, " ".repeat(20), `   b${" ".repeat(16)}`, ""]);
  });

  it("draws an image in a list ahead of the whole list, as Rich does", () => {
    // Rich 14: ["text", "", "🌆 i", " • a", " • b", "", "after", ""].
    expect(rows("text\n\n- a\n- b ![i](p.png)\n\nafter", 40)).toEqual(["text", "", "🌆 i", " • a", " • b", "", "after", ""]);
  });

  it("links an image inside a link to the link, as Rich does", () => {
    expect(rows("[![img](a.png)](http://out) c", 80)).toEqual(["🌆 img  c", ""]);
    expect(links("[![img](a.png)](http://out) c")).toEqual([["img", "http://out"]]);
    expect(links("[x ![img](a.png) y](http://out) c")).toEqual([["img", "http://out"], ["x  y", "http://out"]]);
    // Without hyperlinks the image takes nothing from the link, and the link's text loses it.
    expect(rows("[![img](a.png)](http://out) c", 80, { hyperlinks: false })).toEqual(["🌆 img  (http://out) c", ""]);
    expect(links("[![img](a.png)](http://out) c", { hyperlinks: false })).toEqual([]);
  });

  it("draws an image's alt text in the styles it sits in, and its file name and glyph in none, as Rich does", () => {
    const alt = segment("*a ![i](p.png) b*", "i").style;
    expect(alt?.italic).toBe(true);
    expect(alt?.link).toBe("p.png");
    expect(segment("*a ![i](p.png) b*", "🌆 ").style).toBeUndefined();
    expect(segment("**[![i](p.png)](http://o)**", "i").style).toEqual(
      Style.parse("bold").add(DEFAULT_THEME.resolve("markdown.link_url")).add(new Style({ link: "http://o" })),
    );
    // Rich 15: 'magenta link p.png'.
    expect(segment("> x ![i](p.png)", "i").style).toEqual(Style.parse("magenta").add(new Style({ link: "p.png" })));
    expect(segment("*![](d/a.png)*", "a.png").style).toEqual(new Style({ link: "d/a.png" }));
  });

  it("draws an image's alt text as written, never parsed as Markdown, as Rich does", () => {
    expect(rows("![**a** `c` <a@b.co> \\*b &amp; [y]](q)", 80)[0]).toBe("🌆 **a** `c` <a@b.co> \\*b &amp; [y]");
    expect(links("![<http://x>](y)")).toEqual([["<http://x>", "y"]]);
  });

  it("leaves brackets that are not a link as they are", () => {
    expect(rows("[a] (b) and [c](d", 80)).toEqual(["[a] (b) and [c](d", ""]);
  });

  // Each case below is Rich 15's own first row for its source, without hyperlinks.
  it.each([
    // A bare destination holds at most 32 parentheses open, and must close them all.
    [`[a](${"(".repeat(32)}x${")".repeat(32)})`, `a (${"(".repeat(32)}x${")".repeat(32)})`],
    [`[a](${"(".repeat(33)}x${")".repeat(33)})`, `[a](${"(".repeat(33)}x${")".repeat(33)})`],
    ["[a]((b )", "[a]((b )"],
    ["[a]((b)", "[a]((b)"],
    // Only an ASCII space or control ends one, and a backslash before a space ends it too.
    ["[a](b\u00a0c)", "a (b%C2%A0c)"],
    ["[a](b\u3000c)", "a (b%E3%80%80c)"],
    ["[a](b\\ c)", "[a](b\\ c)"],
    ["[a](\\()", "a (()"],
    // An angled one ends at its first unescaped `>`, and is no destination without one.
    ["[a](<b)", "[a](<b)"],
    ["[a](<a\\>b>)", "a (a%3Eb)"],
    // A title follows only after a space, and a backslash in it takes the next character.
    ['[a](<b>"t")', '[a]("t")'],
    ['[a](b "t\\"u")', "a (b)"],
    ["[a](b (t\\(u))", "a (b)"],
    ["[a](b (t(u)))", "[a](b (t(u)))"],
    ['[a](b "t"\u00a0)', '[a](b "t"\u00a0)'],
    // A lone carriage return is a line ending, so it is space between a destination and its title.
    ['[a](b\r"t")', "a (b)"],
    ["[a](b\r)", "a (b)"],
  ])("reads the link in %j as Rich does", (source, expected) => {
    expect(rows(source, 80, { hyperlinks: false })[0]).toBe(expected);
  });

  it("ends a line at a lone carriage return, as Rich does", () => {
    expect(rows("a\r\rb", 80)).toEqual(["a", "", "b", ""]);
    expect(rows("- x\r- y", 80)).toEqual(["", " • x", " • y", ""]);
  });

  it("reads no link where an ASCII control character sits in or after its destination, as Rich does", () => {
    // Rich draws these as they are written; the port strips C0 controls from
    // drawn text (core/text.ts), so only whether they link is pinned here.
    expect(links("[a](b\u0001c)")).toEqual([]);
    expect(links("[a](b\u007fc)")).toEqual([]);
    expect(links("[a](\u000b)")).toEqual([]);
    expect(links("[a](b\u000b)")).toEqual([]);
  });

  // --- Reference links and their definitions, as Rich draws them ---

  it("links full, collapsed and shortcut references to their definition, and draws the definition as nothing", () => {
    // Rich 15: one row, both linked to http://a.
    expect(rows('[x][r] and [r]\n\n[r]: http://a "t"', 80)).toEqual(["x and r", ""]);
    expect(links('[x][r] and [r]\n\n[r]: http://a "t"')).toEqual([["x", "http://a"], ["r", "http://a"]]);
    expect(links("![i][r]\n\n[r]: http://a")).toEqual([["i", "http://a"]]);
    expect(rows("![i][r]\n\n[r]: http://a", 80, { hyperlinks: false })).toEqual(["🌆 i", ""]);
  });

  // Each case below is Rich 15's own output for its source, without hyperlinks.
  it.each([
    ["[r][] x\n\n[r]: /u", ["r (/u) x", ""]],
    ["![i][]\n\n[i]: a.png", ["🌆 i", ""]],
    // A label matches stripped, each run of whitespace one space, case-folded.
    ["[Foo  Bar][]\n\n[foo bar]: /u", ["Foo  Bar (/u)", ""]],
    ["[A]\n\n[a]: /u", ["A (/u)", ""]],
    ["[ẞ]\n\n[SS]: /u", ["ẞ (/u)", ""]],
    ["[a b]\n\n[a b]: /u", ["a b (/u)", ""]],
    ["[a\nb]: /u\n\n[a b]", ["a b (/u)", ""]],
    // A label matches as written, escapes and all; the first definition of it wins.
    ["[\\*a\\*]: /u\n\n[*a*] [\\*a\\*]", ["[a] *a* (/u)", ""]],
    ["[a]\n\n[a]: /1\n[a]: /2", ["a (/1)", ""]],
    ["[a]: /1\n[b]: /2\n\n[a] [b]", ["a (/1) b (/2)", ""]],
    // Each part may run onto the lines after it.
    ['[a]:\n/u\n"t"\n\n[a]', ["a (/u)", ""]],
    ['[a]: /u "t\nu"\n\n[a]', ["a (/u)", ""]],
    ["[a]: <>\n\n[a]", ["a ()", ""]],
    ["[a]\n\n[a]: <b c>", ["a (b%20c)", ""]],
    ["[a]: http://ÄB.com\n\n[a]", ["a (http://xn--B-5da.com)", ""]],
    // A title followed by more on its line is given up, and the definition ends with its destination.
    ['[a]: /u\n"t" x\n\n[a]', ['"t" x', "", "a (/u)", ""]],
    ["[a]: /u\n===\n\n[a]", ["===", "", "a (/u)", ""]],
    // Not a definition: an empty title then more, more after the destination, a refused scheme, a
    // bracket in the label, an empty label, a line that opens a block, or a paragraph to interrupt.
    ['[a]: /u\n"" x\n\n[a]', ['[a]: /u "" x', "", "[a]", ""]],
    ["[a]: /u x\n\n[a]", ["[a]: /u x", "", "[a]", ""]],
    ['[a]: /u "t"x\n\n[a]', ['[a]: /u "t"x', "", "[a]", ""]],
    ["[a]: javascript:x\n\n[a]", ["[a]: javascript:x", "", "[a]", ""]],
    ["[a[b]]: /u\n\n[a[b]]", ["[a[b]]: /u", "", "[a[b]]", ""]],
    ["[ ]: /u\n\n[ ]", ["[ ]: /u", "", "[ ]", ""]],
    ["[a]:\n- /u\n\n[a]", ["[a]:", "", " • /u", "", "[a]", ""]],
    ["p\n[a]: /u\n\n[a]", ["p [a]: /u", "", "[a]", ""]],
    // A definition in a container defines its label for the whole document.
    ["- [a]\n\n> [a]: /q", ["", " • a (/q)", "", ""]],
    ["- [a]: /u\n- b", ["", " • b", ""]],
    // A full reference to no definition is no link, and neither is its first label alone.
    ["[a][b]\n\n[a]: /u", ["[a][b]", ""]],
    ["[x]: /u\n\n[x][ ]", ["[x][ ]", ""]],
    ["[foo][bar][baz]\n\n[baz]: /url1\n[bar]: /url2", ["foo (/url2)baz (/url1)", ""]],
    // A label holding a link is refused, so only the inner one links.
    ["[a [b] c][r]\n\n[b]: /b\n[r]: /r", ["[a b (/b) c]r (/r)", ""]],
    ["[x]: /u\n\n[[x]]", ["[x (/u)]", ""]],
    ["![a [b] c][r]\n\n[b]: /b\n[r]: /r", ["🌆 a [b] c", ""]],
  ])("reads the references in %j as Rich does", (source, expected) => {
    expect(rows(source, 80, { hyperlinks: false })).toEqual(expected);
  });

  it("falls back from a refused inline link to a reference, read from where the refusal stopped, as Rich does", () => {
    expect(rows("[x](not a link)\n\n[x]: /u", 80, { hyperlinks: false })).toEqual(["x (/u)(not a link)", ""]);
    // markdown-it reads `b` as no title, and looks for a reference's label one past it.
    expect(rows("[x](a b[y] z\n\n[y]: /u", 80, { hyperlinks: false })).toEqual(["x (/u) z", ""]);
    // An image does not fall back, and a `(` with only space after it is neither.
    expect(rows("![x](a b)\n\n[x]: /u", 80, { hyperlinks: false })).toEqual(["!x (/u)(a b)", ""]);
    expect(rows("[x]: /u\n\n[x](", 80, { hyperlinks: false })).toEqual(["[x](", ""]);
    expect(rows("[x]: /u\n\n[x]( ", 80, { hyperlinks: false })).toEqual(["[x](", ""]);
  });

  it("ends a container where a lazy line follows a definition that does not take it, as Rich does", () => {
    // The definition takes a lazy title, and the quote with it.
    expect(rows('> [a]: /u\n"t"\n\n[a]', 80, { hyperlinks: false })).toEqual(["", "a (/u)", ""]);
    // A lazy line no definition or paragraph takes is not the quote's.
    expect(rows("> [a]: /u\nfoo\n\n[a]", 80, { hyperlinks: false })).toEqual(["", "foo", "", "a (/u)", ""]);
    // A quote's lazy line is short of an item's indentation however far it is indented.
    expect(rows("> - -|-\n\t===", 80)).toEqual(["", "▌  • -|- ===", ""]);
  });

  it("reads a line lazy to a quote's container as indented less than any block, as Rich does", () => {
    // Rich 15's own rows: the inner quote ends at the block the line opens, and the outer quote with it.
    const ended = (line: string) => ["", "▌ ▌ b", "", "", ` ${line}`, "", ""];
    expect(rows("> > b\n    ---", 40)).toEqual(ended("---"));
    expect(rows("> > b\n\t<!-- c -->", 40)).toEqual(ended("<!-- c -->"));
    expect(rows("> > b\n    ```", 40)).toEqual(ended("```"));
    expect(rows("> > b\n    # h", 40)).toEqual(ended("# h"));
    expect(rows("> > b\n    - c", 40)).toEqual(ended("- c"));
    expect(rows("> > > b\n    ---", 40)).toEqual(["", "▌ ▌ ▌ b", "", "", " ---", "", ""]);
    // A line lazy to a list item is short of its indentation too.
    expect(rows("100. > b\n    ---", 40)).toEqual(["", " 100 ▌ b", "", "", " ---", "", ""]);
    // Text it continues, and a quote directly under it reads it at its own indentation.
    expect(rows("> > b\n    c", 40)).toEqual(["", "▌ ▌ b c", ""]);
    expect(rows("> b\n    ---", 40)).toEqual(["", "▌ b ---", ""]);
    expect(rows("> - a\n    ---", 40)).toEqual(["", "▌  • a ---", ""]);
    // A list item on a line lazy only to list items sits where the line does: a code indent past the list, it is text.
    expect(rows("1.   > b\n    - c", 40)).toEqual(["", " 1 ▌ b - c", ""]);
    expect(rows("1.   > b\n    1. ", 40)).toEqual(["", " 1 ▌ b 1.", ""]);
    expect(rows("10.   > b\n \t- c", 40)).toEqual(["", " 10 ▌ b - c", ""]);
    expect(rows("1.   > b\n   - c", 40)).toEqual(["", " 1 ▌ b", "", " • c", ""]);
    // Lazy to a quote on the way, it is indented less than any block again.
    expect(rows("> 1.   > b\n    - c", 40)).toEqual(["", "▌  1 ▌ b", "", "", " - c", "", ""]);
  });

  it("reads a line short of a list item as indented less than any block, as Rich does", () => {
    // Rich 15's own rows: the item ends at the block the line opens, which the top level reads as indented code.
    expect(rows("100. a\n    ---", 40)).toEqual(["", " 100 a", "", "", " ---", "", ""]);
    expect(rows("  1. d\n    # h", 40)).toEqual(["", " 1 d", "", "", " # h", "", ""]);
    expect(rows("  2. f\n\t---", 40)).toEqual(["", " 2 f", "", "", " ---", "", ""]);
    expect(rows("  1. d\n    ```", 40)).toEqual(["", " 1 d", "", "", " ```", "", ""]);
    expect(rows("  1. d\n    <!-- x -->", 40)).toEqual(["", " 1 d", "", "", " <!-- x -->", "", ""]);
    expect(rows("  -    a\n      > b", 40)).toEqual(["", " • a", "", "", "   > b", "", ""]);
    // A list item on it is measured from the innermost list's container: a code indent past it, it is text.
    expect(rows("100. a\n    - c", 40)).toEqual(["", " 100 a - c", ""]);
    expect(rows("1.   - a\n    - c", 40)).toEqual(["", " 1  • a", "", "", " - c", "", ""]);
    expect(rows("  -    - c\n    - c", 40)).toEqual(["", " •  • c", "", "", " - c", "", ""]);
    expect(rows("1.   - > b\n    - c", 40)).toEqual(["", " 1  • ▌ b", "", "", " - c", "", ""]);
    expect(rows("1.   1.    - c\n    > - c", 40)).toEqual(["", " 1  1  • c", "", "", " > - c", "", ""]);
  });

  it("takes a `>` line after a quote's first however far it is indented, as Rich does", () => {
    expect(rows("> a\n    > b", 40)).toEqual(["", "▌ a b", ""]);
    expect(rows("> a\n\t> b", 40)).toEqual(["", "▌ a b", ""]);
    expect(rows("> a\n    >", 40)).toEqual(["", "▌ a", ""]);
    expect(rows("- > a\n      > b", 40)).toEqual(["", " • ▌ a b", ""]);
    expect(rows("> > b\n    > c", 40)).toEqual(["", "▌ ▌ b c", ""]);
    // Only a quote's first line must sit less than a code indent in.
    expect(rows("    > a", 40)).toEqual(["", " > a", "", ""]);
  });

  it("indents a quote's line from its own `>`, wherever the `>` sits, as Rich does", () => {
    // The item's lines are measured past each one's marker: short of the item, the line is the quote's.
    expect(rows("> - a\n>\n    > b", 40)).toEqual(["", "▌  • a", "▌ b", ""]);
    expect(rows("> - a\n>\n  > b", 40)).toEqual(["", "▌  • a", "▌ b", ""]);
    expect(rows("> - a\n>\n \t> b", 40)).toEqual(["", "▌  • a", "▌ b", ""]);
    expect(rows("- a\n\n  > - b\n  >\n      > c", 40)).toEqual(["", " • a", "   ▌  • b", "   ▌ c", ""]);
    // Indented to the item past its marker, the line is the item's, not code.
    expect(rows("> - a\n>\n      >   b", 40)).toEqual(["", "▌  • a", "▌    b", ""]);
    expect(rows("> - a\n>\n   >   b", 40)).toEqual(["", "▌  • a", "▌    b", ""]);
    expect(rows("> - a\n>\n\t>   b", 40)).toEqual(["", "▌  • a", "▌    b", ""]);
    expect(rows("> 1. a\n>\n     >    b", 40)).toEqual(["", "▌  1 a", "▌    b", ""]);
    // With no blank line between, where the line's text sits in the source decides nothing either.
    // Each item is a heading so no paragraph is open: after a paragraph, a line short of the item
    // continues it lazily ("> - a\n   > z" is "▌  • a z"), and which container holds it goes untested.
    expect(rows("> - # h\n   > z", 40)).toEqual(["", "▌  •                 h", "▌ z", ""]);
    expect(rows("> - # h\n  >  z", 40)).toEqual(["", "▌  •                 h", "▌ z", ""]);
    expect(rows("> 1. # h\n     >   z", 40)).toEqual(["", "▌  1                 h", "▌ z", ""]);
    expect(rows("> - # h\n  >   z", 40)).toEqual(["", "▌  •                 h", "▌    z", ""]);
    expect(rows("> 1. # h\n >    z", 40)).toEqual(["", "▌  1                 h", "▌    z", ""]);
  });

  it("ends a definition at a backslash that escapes its destination's line ending, as Rich does", () => {
    // markdown-it reads a destination in the text it holds, which ends with the destination's line.
    expect(rows("[a]: x\\\ny\n\n[a]", 40, { hyperlinks: false })).toEqual(["y", "", "a (x%5C)", ""]);
    expect(rows('[a]: x\\\n"t"\n\n[a]', 40, { hyperlinks: false })).toEqual(['"t"', "", "a (x%5C)", ""]);
    // However many lines a label running over several took on before it.
    expect(rows("[a\nb\nc\nd\ne]:\nx\\\ny\nz\n\n[a b c d e]", 40, { hyperlinks: false })).toEqual(["y z", "", "a b c d e (x%5C)", ""]);
    expect(rows("[a\nb\nc\nd\ne]:\n<x\\\ny>\n\n[a b c d e]", 40, { hyperlinks: false })).toEqual(["[a b c d e]: <x", "y>", "", "[a b c d e]", ""]);
  });

  it("reads a definition's label or title left open across many lines in time linear in their number", () => {
    for (const opening of ["[a", '[a]: /u "']) {
      const started = performance.now();
      new Markdown(opening + "x\n".repeat(200_000));
      // Text grown a line at a time, and read after each, took over five seconds here.
      expect(performance.now() - started).toBeLessThan(2000);
    }
  });

  /** Each run of drawn text that is a link, and the href it links to. */
  function links(markdown: string, options?: MarkdownOptions): [string, string][] {
    const runs: [string, string][] = [];
    let last: string | undefined;
    for (const { text, style } of collectSegments(new Markdown(markdown, options), { maxWidth: 80 })) {
      const href = style?.link;
      if (href !== undefined && href === last) runs[runs.length - 1]![0] += text;
      else if (href !== undefined) runs.push([text, href]);
      last = href;
    }
    return runs;
  }

  // Each case below is Rich 14's own output for its source.

  it("draws an autolink as Rich does: its URL or address without the brackets, and the link", () => {
    expect(rows("x <http://e.com> y", 80)).toEqual(["x http://e.com y", ""]);
    expect(links("x <http://e.com> y")).toEqual([["http://e.com", "http://e.com"]]);
    expect(links("x <a@b.co> y")).toEqual([["a@b.co", "mailto:a@b.co"]]);
    expect(segment("<http://e.com>", "http://e.com").style).toEqual(segment("[a](http://e.com)", "a").style);
    expect(rows("x <http://e.com> y", 80, { hyperlinks: false })).toEqual(["x http://e.com (http://e.com) y", ""]);
    expect(rows("x <a@b.co> y", 80, { hyperlinks: false })).toEqual(["x a@b.co (mailto:a@b.co) y", ""]);
    expect(rows("<made-up-scheme://foo,bar> <a+b:c> <localhost:5001/foo> <a@b>", 80)[0]).toBe(
      "made-up-scheme://foo,bar a+b:c localhost:5001/foo a@b",
    );
  });

  it("reads an autolink's text as written, binding it tighter than emphasis or a link's brackets", () => {
    expect(links("<http://e.com/*a*>")).toEqual([["http://e.com/*a*", "http://e.com/*a*"]]);
    expect(rows("*a <http://e.com/*> b*", 80)[0]).toBe("a http://e.com/* b");
    expect(links("[a <http://e.com/]> b](u)")).toEqual([
      ["a ", "u"],
      ["http://e.com/]", "http://e.com/%5D"],
      [" b", "u"],
    ]);
    expect(segment("**<http://e.com>**", "http://e.com").style?.bold).toBe(true);
    expect(rows("`<http://e.com>`", 80)[0]).toBe("<http://e.com>");
    expect(rows("[a <http://x> b](u)", 80, { hyperlinks: false })[0]).toBe("a http://x (http://x) b (u)");
  });

  it("leaves a `<` that opens no autolink as it is", () => {
    for (const source of ["< http://e.com>", "<m:abc>", "<//x>", "<a@ö.com>", "<a@-b.c>"]) {
      expect(rows(source, 80)[0]).toBe(source);
      expect(links(source)).toEqual([]);
    }
    expect(rows("<http://e.com\nx>", 80)[0]).toBe("<http://e.com x>");
    expect(rows("<x <http://e.com>>", 80)[0]).toBe("<x http://e.com>");
  });

  it("makes every link's href as markdown-it does: its host punycoded, the rest percent-encoded", () => {
    expect(links("<http://e.com/a(b)c?q=1&r=[2]>")).toEqual([["http://e.com/a(b)c?q=1&r=[2]", "http://e.com/a(b)c?q=1&r=%5B2%5D"]]);
    expect(links("<http://e.com/`x`>")).toEqual([["http://e.com/`x`", "http://e.com/%60x%60"]]);
    expect(links("<http://e.com/%2F%zz>")).toEqual([["http://e.com/%2F%zz", "http://e.com/%2F%25zz"]]);
    expect(links("<http://[::1]/ä>")).toEqual([["http://[::1]/ä", "http://%5B::1%5D/%C3%A4"]]);
    expect(links("<http://ÄB.com>")).toEqual([["http://ÄB.com", "http://xn--B-5da.com"]]);
    expect(links("<http://müller-straße.de>")).toEqual([["http://müller-straße.de", "http://xn--mller-strae-46a18a.de"]]);
    expect(links("<http://😀.com/😀>")).toEqual([["http://😀.com/😀", "http://xn--e28h.com/%F0%9F%98%80"]]);
    expect(links("<http://日本。例え.jp/>")).toEqual([["http://日本.例え.jp/", "http://xn--wgv71a.xn--r8jz45g.jp/"]]);
    expect(links("<https://user:pw@ä.com:8080/p?q#f>")).toEqual([["https://user:pw@ä.com:8080/p?q#f", "https://user:pw@xn--4ca.com:8080/p?q#f"]]);
    expect(links("<mailto:Ä@ö.com>")).toEqual([["mailto:Ä@ö.com", "mailto:%C3%84@xn--nda.com"]]);
    expect(links("<mailto:a@ä.com?subject=ä>")).toEqual([["mailto:a@ä.com?subject=ä", "mailto:a@xn--4ca.com?subject=%C3%A4"]]);
    // Only an http, https or mailto host is punycoded.
    expect(links("<ftp://ä.com> <HTTP://ä.com>")).toEqual([
      ["ftp://ä.com", "ftp://%C3%A4.com"],
      ["HTTP://ä.com", "HTTP://%C3%A4.com"],
    ]);
    // A host is cut where a part stops being a host label.
    expect(links("<http://[ä]/x> <http://e.com::/x>")).toEqual([
      ["http://ä/x", "http://xn--4ca/x"],
      ["http://e.com:/x", "http://e.com:/x"],
    ]);
    expect(links("[a](http://e.com/ä%20x) [b](<http://e.com/a b>) [c](//ä.com) [d](ä.com/b)")).toEqual([
      ["a", "http://e.com/%C3%A4%20x"],
      ["b", "http://e.com/a%20b"],
      ["c", "//xn--4ca.com"],
      ["d", "%C3%A4.com/b"],
    ]);
    expect(links("![i](http://e.com/ä.png)")).toEqual([["i", "http://e.com/%C3%A4.png"]]);
    // A scheme is read as Python's IGNORECASE reads [a-z], which folds İ into it.
    expect(links("[a](İmailto:@/2İ.http:///c)")).toEqual([["a", "%C4%B0mailto:/2%C4%B0.http:///c"]]);
  });

  it("decodes an autolink's escapes and punycoded host for reading, but not a reserved character", () => {
    expect(links("<http://e.com/ä%20>")).toEqual([["http://e.com/ä ", "http://e.com/%C3%A4%20"]]);
    expect(links("<http://e.com/%C3%A4%2f%3F>")).toEqual([["http://e.com/ä%2F%3F", "http://e.com/%C3%A4%2f%3F"]]);
    expect(links("<http://xn--4ca.com/x> <http://xn--mller-kva.de>")).toEqual([
      ["http://ä.com/x", "http://xn--4ca.com/x"],
      ["http://müller.de", "http://xn--mller-kva.de"],
    ]);
    // A label that is no punycode is drawn as written; xn-- with nothing after it is the empty label.
    expect(links("<http://xn--zz.com> <http://xn--.com>")).toEqual([
      ["http://xn--zz.com", "http://xn--zz.com"],
      ["http://.com", "http://xn--.com"],
    ]);
    // A byte that is no part of well-formed UTF-8 reads as U+FFFD.
    expect(links("<http://e.com/%E2%82>")).toEqual([["http://e.com/��", "http://e.com/%E2%82"]]);
    expect(links("<http://e.com/%C0%80%ED%A0%80%F4%90%80%80>")[0]![0]).toBe(`http://e.com/${"�".repeat(9)}`);
  });

  it("strips a URL's whitespace in one pass, however long a run of it the URL holds", () => {
    // Linear takes ~10 ms here; the backtracking strip it replaced took ~10 s.
    const started = performance.now();
    expect(linkHref(`http://e.com/${"\u3000".repeat(100_000)}x`)).toBe(`http://e.com/${"%E3%80%80".repeat(100_000)}x`);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("draws no link to a script, a file, or data that is not an image, as markdown-it refuses one", () => {
    for (const source of ["<javascript:alert(1)>", "<vbscript:x>", "<file:///etc>", "[a](javascript:x)", "[a](JAVASCRIPT:x)", "[a](data:text/html,x)"]) {
      expect(rows(source, 80)[0]).toBe(source);
      expect(links(source)).toEqual([]);
    }
    expect(links("<data:image/png;base64,x>")).toEqual([["data:image/png;base64,x", "data:image/png;base64,x"]]);
    expect(links("![a](data:image/gif;x)")).toEqual([["a", "data:image/gif;x"]]);
  });

  // --- Options ---

  function segment(markdown: string, text: string, options?: MarkdownOptions): Segment {
    const found = collectSegments(new Markdown(markdown, options), { maxWidth: 80 }).find((s) => s.text === text);
    expect(found, `no segment ${JSON.stringify(text)}`).toBeDefined();
    return found!;
  }

  it("draws inline code in inlineCodeStyle, given as a style definition", () => {
    expect(segment("Use `code` here", "code", { inlineCodeStyle: "bold red" }).style).toEqual(Style.parse("bold red"));
  });

  it("draws inline code in inlineCodeStyle, given as a Style", () => {
    const style = Style.parse("bold green");
    expect(segment("Use `code` here", "code", { inlineCodeStyle: style }).style).toEqual(style);
  });

  it("draws code on the terminal's own colours at 16 colours, where a fixed ground cannot be promised", () => {
    const code = DEFAULT_THEME.resolve("markdown.code");
    const drawn = (markdown: string, colorSystem: ColorDepth) =>
      collectSegments(new Markdown(markdown), { maxWidth: 80, colorSystem })
        .filter((s) => s.text === "code" || s.text === "block")
        .map((s) => s.style);
    // Bold, as Rich's own `markdown.code` is, so code stays set apart once its colours go.
    expect(code.bold).toBe(true);
    const grounded = code.add(Style.parse("default on default"));
    expect(drawn("Use `code` here\n\n```\nblock\n```", ColorDepth.STANDARD)).toEqual([grounded, grounded]);
    expect(drawn("Use `code` here\n\n```\nblock\n```", ColorDepth.EIGHT_BIT)).toEqual([code, code]);
    // In a quote too: the quote's magenta lies under its blocks, and code keeps its own colours over it.
    const quoted = DEFAULT_THEME.resolve("markdown.block_quote");
    expect(drawn("> Use `code` here\n>\n> ```\n> block\n> ```", ColorDepth.STANDARD)).toEqual([
      quoted.add(grounded),
      quoted.add(grounded),
    ]);
  });

  it("draws an inline code style written in the terminal's own colours as written at 16 colours", () => {
    const drawn = (inlineCodeStyle: string) =>
      collectSegments(new Markdown("Use `code` here", { inlineCodeStyle }), { maxWidth: 80, colorSystem: ColorDepth.STANDARD })
        .find((s) => s.text === "code")!.style;
    expect(drawn("bold magenta")).toEqual(Style.parse("bold magenta"));
    expect(drawn("white on blue")).toEqual(Style.parse("white on blue"));
  });

  it("reports a bad inline code style to onStyleError and draws the code unstyled", () => {
    const heard: string[] = [];
    const segments = collectSegments(new Markdown("a `b` c", { inlineCodeStyle: "bold rd" }), {
      maxWidth: 80,
      onStyleError: (_error, style) => heard.push(style),
    });
    expect(heard).toEqual(["bold rd"]);
    expect(segments.map((s) => s.text).join("")).toContain("a b c");
    expect(segments.some((s) => s.style?.bold)).toBe(false);
  });

  it("makes a link's text the link by default", () => {
    expect(rows("[link](https://example.com)", 80)).toEqual(["link", ""]);
    expect(segment("[link](https://example.com)", "link").style?.link).toBe("https://example.com");
  });

  it("draws a style inside a link's text over the link's own, as Rich does", () => {
    const code = segment("[`foo()`](https://x)", "foo()");
    expect(code.style?.link).toBe("https://x");
    expect(code.style?.color).toEqual(segment("`foo()`", "foo()").style?.color);
  });

  it("writes a link's URL after its text, and links nothing, when hyperlinks is false, as Rich does", () => {
    const md = "[link](https://example.com) here <a@b.co>";
    expect(rows(md, 80, { hyperlinks: false })).toEqual(["link (https://example.com) here a@b.co (mailto:a@b.co)", ""]);
    expect(links(md, { hyperlinks: false })).toEqual([]);
  });

  it("links nothing to an empty URL, as Rich does", () => {
    expect(rows("[a](<>)", 80)[0]).toBe("a");
    expect(links("[a](<>)")).toEqual([]);
    expect(links("![x](<>)")).toEqual([]);
    expect(rows("[a](<>)", 80, { hyperlinks: false })[0]).toBe("a ()");
  });

  it("places paragraphs, list items and quotes by justify, and leaves headings where they are", () => {
    const md = "## Head\n\nbody\n\n- item\n\n> quote";
    expect(rows(md, 12, { justify: "right" })).toEqual([
      "Head",
      "",
      "        body",
      "",
      " •      item",
      "",
      "▌    quote",
      "",
    ]);
  });

  it("places body text left when no justify is given, whatever it is rendered with", () => {
    const md = new Markdown("## Head\n\nbody");
    const text = collectText(md, { maxWidth: 12, justify: "right" });
    expect(text.split("\n")).toEqual(["Head", "", "body        ", ""]);
  });

  it("centres an h1 and leaves h2 and below left, whatever justify says", () => {
    for (const justify of [undefined, "left", "right", "full"] as const) {
      const out = collectText(new Markdown("# Title\n## Sub\n###### Six", { justify }), { maxWidth: 20, justify });
      expect(out.split("\n")).toEqual(["       Title        ", "", "Sub", "", "Six", ""]);
    }
  });

  it("centres each row of a wrapped h1", () => {
    expect(rows("# one two three", 9)).toEqual([" one two", "  three", ""]);
  });

  it("styles a heading's text and not the padding that centres it", () => {
    const segs = collectSegments(new Markdown("# Title"), { maxWidth: 20 }).filter((s) => s.text.trim() === "" && s.text !== "\n");
    expect(segs.length).toBeGreaterThan(0);
    expect(segs.every((s) => !s.style?.underline && !s.style?.bold)).toBe(true);
    expect(segment("# Title", "Title").style?.bold).toBe(true);
  });

  it("spans a link over exactly its text when the source carries a control character", () => {
    for (const options of [{}, { hyperlinks: false }] satisfies MarkdownOptions[]) {
      const linked = collectSegments(new Markdown("x[a\x01b](https://e.com)", options), { maxWidth: 80 })
        .filter((s) => s.style?.link === "https://e.com")
        .map((s) => s.text)
        .join("");
      expect(linked).toBe(options.hyperlinks === false ? "" : "ab");
    }
  });

  // --- Tables ---

  it("draws a GFM pipe table as Rich's Table, its cells placed by the delimiter row's colons", () => {
    // Rich 14's own output for this source at 40 columns, the blank it draws
    // between the paragraph and the table aside.
    const md = [
      "Intro text",
      "| Left | Centre | Right | Plain |",
      "|:-----|:------:|------:|-------|",
      "| a | **bold** | `code` | x \\| y |",
      "| longer cell | b |",
      "| 1 | 2 | 3 | 4 | 5 |",
      "after",
    ].join("\n");
    expect(rows(md, 40)).toEqual([
      "Intro text",
      "",
      "",
      " Left         Centre  Right  Plain",
      " ─────────────────────────────────",
      " a             bold    code  x | y",
      " longer cell    b",
      " 1              2         3  4",
      " after",
      "",
      "",
    ]);
  });

  it("draws a table cell's inline Markdown, and its header in markdown.table.header", () => {
    const segs = collectSegments(new Markdown("| **h** | k |\n|---|---|\n| *i* | `c` |"), { maxWidth: 40 });
    const styleOf = (text: string) => segs.find((s) => s.text === text)?.style;
    expect(styleOf("h")).toEqual(DEFAULT_THEME.resolve("table.header").add(Style.parse("bold")).add(DEFAULT_THEME.resolve("markdown.table.header")));
    expect(styleOf("i")?.italic).toBe(true);
    expect(styleOf("c")?.color).toEqual(DEFAULT_THEME.resolve("markdown.code").color);
  });

  it("reads a table where markdown-it does, and leaves one where it does not", () => {
    // A header row is tried before any other block, so a quote's marker is a cell.
    expect(rows("> a | b\n--|--", 30)).toEqual(["", "", " > a  b", " ──────", "", ""]);
    expect(rows("a|b\n-|-\n1|2", 30)).toEqual(["", "", " a  b", " ────", " 1  2", "", ""]);
    // A delimiter row naming another count of columns is no table: this is a setext heading.
    expect(rows("a | b\n---", 30)).toEqual(["a | b", ""]);
    // A quote's lazy line is only ever paragraph text.
    expect(rows("> a | b\n> more\n--|--", 30)).toEqual(["", "▌ a | b more --|--", ""]);
    // A table ends a paragraph, and a line that opens a block ends the table.
    expect(rows("| a |\n|---|\n| 1 |\n> q", 30)).toEqual(["", "", " a", " ─", " 1", "", "", "▌ q", ""]);
  });

  it("ends a list item's paragraph at a lazy header row over a delimiter row the item holds, as markdown-it does", () => {
    // The item ends at the header row, short of it, and the table opens where the item sat.
    expect(rows("- a\n| x |\n  | - |", 30)).toEqual(["", " • a", "", "", " x", " ─", "", ""]);
    expect(rows("1. a\n| x |\n   | - |\n| y |", 30)).toEqual(["", " 1 a", "", "", " x", " ─", " y", "", ""]);
    // The delimiter row the item does not hold leaves the header row lazy text.
    expect(rows("- a\n| x |\n| - |", 30)).toEqual(["", " • a | x | | - |", ""]);
    // An inner item's delimiter row is code where the table would open, so there the two are a paragraph.
    expect(rows("- a\n  - b\n| x |\n    | - |", 30)).toEqual(["", " • a", "    • b", "", "| x | | - |", ""]);
    // A definition waiting on its destination ends at the header row too, and is paragraph text.
    expect(rows("- [a]:\n| x |\n  | - |\n\n[a]", 30)).toEqual(["", " • [a]:", "", "", " x", " ─", "", "", "[a]", ""]);
    // A quote's lazy line inside an item is never a header row.
    expect(rows("- > a\n| x |\n  | - |", 30)).toEqual(["", " • ▌ a | x | | - |", ""]);
  });

  it("ends a table at the row that fills out more than markdown-it's 65536 empty cells", () => {
    // 257 columns over one-cell rows: each row fills out 256, so the 256th row
    // reaches 65536 and is kept, and the 257th passes it and is paragraph text.
    // Wide enough that every column has room to show its cell.
    const lastRows = (bodyRows: number) =>
      rows([`|${" h |".repeat(257)}`, `|${"---|".repeat(257)}`, ...Array<string>(bodyRows).fill("| a |"), "stop"].join("\n"), 1100)
        .slice(-4)
        .map((row) => row.trimEnd());
    expect(lastRows(255)).toEqual([" a", " stop", "", ""]);
    expect(lastRows(256)).toEqual(["", "", "stop", ""]);
  });

  it("draws a table inside a list item, under its hang", () => {
    expect(rows("- x\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |", 30)).toEqual([
      "",
      " • x",
      "",
      "    a  b",
      "    ────",
      "    1  2",
      "",
      "",
    ]);
  });

  // --- HTML blocks ---

  // Rich 14's own output for each source at 40 columns. An HTML block is an
  // element Rich draws nothing for, so the blank row ahead of it is drawn and
  // the one ahead of the block after it as well.

  it("draws an HTML block as Rich does, not at all, and ends a paragraph at one", () => {
    expect(rows("para one\n<div>\nhello\n</div>\n\nafter", 40)).toEqual(["para one", "", "", "after", ""]);
  });

  it("ends a paragraph at every kind of HTML block but a lone tag, which continues it", () => {
    const kinds = [
      ["<script>", "</script>"],
      ["<!-- c", "-->"],
      ["<?php", "?>"],
      ["<!DOCTYPE html", ">"],
      ["<![CDATA[", "]]>"],
    ];
    for (const [open, close] of kinds) expect(rows(`para\n${open}\nbody\n${close}\n\nafter`, 40)).toEqual(["para", "", "", "after", ""]);
    // The sixth kind, a block-level element, ends at a blank line instead of a closing one.
    expect(rows('para\n<DIV class="x">\nbody\n\nafter', 40)).toEqual(["para", "", "", "after", ""]);
    // Any other tag alone on a line opens a block only where no paragraph is open,
    // and neither it nor a lowercase `<!doctype`, which markdown-it-py does not
    // read as a declaration block, ends one: both are the paragraph's inline HTML.
    expect(rows("para\n<span>\nafter", 40)).toEqual(["para  after", ""]);
    expect(rows("para\n<!doctype html>\nafter", 40)).toEqual(["para  after", ""]);
    expect(rows("<span>\nhello\n\nafter", 40)).toEqual(["", "after", ""]);
  });

  it("runs an HTML block to the line that closes its kind, or to the end without one", () => {
    // A blank line inside `<pre>` does not end it; the line after `</pre>` is a paragraph.
    expect(rows("<pre>\nx\n\ny\n</pre>\nafter", 40)).toEqual(["", "after", ""]);
    expect(rows("a\n\n<!-- open\n\nstill", 40)).toEqual(["a", "", ""]);
  });

  it("ends a table at an HTML block, as markdown-it does", () => {
    expect(rows("| a |\n| - |\n| 1 |\n<!-- c -->\nafter", 40)).toEqual(["", "", " a", " ─", " 1", "", "", "", "after", ""]);
  });

  it("draws inline HTML as Rich does, not at all, wherever inline Markdown is read", () => {
    const dropped = [
      "a <b>bold</b> c",
      "x <a href=\"q\" title='t'/> y",
      "x <span\nclass=\"a\"> y",
      "x </b > y",
      "x <!-- a -- b --> y",
      "x <!---> y",
      "x <?php echo ?> y",
      "x <!doctype a> y",
      "x <![CDATA[ z ]]> y",
    ];
    expect(dropped.map((source) => rows(source, 40)[0])).toEqual([
      "a bold c",
      "x  y",
      "x  y",
      "x  y",
      "x  y",
      "x  y",
      "x  y",
      "x  y",
      "x  y",
    ]);
    expect(rows("[a <i>b</i>](http://u) c", 40)[0]).toBe("a b c");
    // A bracket inside a tag or a code span, which bind tighter, opens or closes no link.
    for (const source of ["[a <b x=']'>](u) c", "[a <!-- ] -->](u) c"]) {
      expect(rows(source, 40, { hyperlinks: false })[0]).toBe("a  (u) c");
    }
    expect(rows("[`]`](u) c", 40, { hyperlinks: false })[0]).toBe("] (u) c");
    expect(rows("x <b x='['> [y](u)", 40, { hyperlinks: false })[0]).toBe("x  y (u)");
    expect(rows("| a | b |\n| - | - |\n| 1 | 2 |\n<span>", 40)).toEqual(["", "", " a  b", " ────", " 1  2", "", "", ""]);
  });

  it("leaves text that is not HTML as it is: a `<` no tag follows, an unclosed construct, a code span", () => {
    for (const source of ["x <3 y", "x < b> y", "x <a b='c> y", "x <!-- a --- y", "x <? never y"]) expect(rows(source, 40)[0]).toBe(source);
    expect(rows("`<b>` x", 40)[0]).toBe("<b> x");
  });

  it("draws a backslash-escaped punctuation character as itself, and any other backslash as written", () => {
    expect(rows("x \\<span> y", 40)[0]).toBe("x <span> y");
    expect(rows("x \\*a\\* y \\[a](b)", 40)[0]).toBe("x *a* y [a](b)");
    expect(rows("x \\\\ \\a y", 40)[0]).toBe("x \\ \\a y");
    expect(rows("[a](u\\)v)", 40, { hyperlinks: false })[0]).toBe("a (u)v)");
    expect(segment("[a](http://x/\\_y)", "a").style?.link).toBe("http://x/_y");
    expect(segment("![p](a\\_b.png)", "p").style?.link).toBe("a_b.png");
  });

  // Each case below is Rich 14's own output for its source.

  it("draws a named, decimal or hex character reference as the characters it names, as Rich does", () => {
    expect(rows("x &amp; &copy; &#65; y", 80)[0]).toBe("x & © A y");
    expect(rows("&#x41; &#X41; &#x1F600; &NotEqualTilde; &AMP;", 80)[0]).toBe("A A 😀 ≂̸ &");
    expect(rows("&lt;b&gt;bold&lt;/b&gt; &lt;http://e.com&gt;", 80)[0]).toBe("<b>bold</b> <http://e.com>");
    expect(rows("a&#10;b c&#9;d e&Tab;f", 80)).toEqual(["a", "b c     d e     f", ""]);
    expect(segment("**&copy;**", "©").style?.bold).toBe(true);
    expect(links("[&copy; x](u)")).toEqual([["© x", "u"]]);
    expect(rows("# &copy; head", 80)[0]!.trim()).toBe("© head");
    expect(rows("| a &amp; | b |\n|---|---|\n| &lt; | &#124; |", 80).slice(2, 5)).toEqual([" a &  b", " ──────", " <    |"]);
  });

  it("draws U+FFFD for a numeric reference to no character markdown-it accepts, and too many digits as written", () => {
    expect(rows("&#0; &#xD800; &#1114112; &#x110000; &#99999999; &#x1234567; &#; &#x;", 80)[0]).toBe(
      "� � � � &#99999999; &#x1234567; &#; &#x;",
    );
  });

  it("draws a reference HTML does not name as written, whatever an object's prototype holds", () => {
    expect(rows("&foo; &a; &amp &constructor; &toString; &hasOwnProperty; & alone &;", 80)[0]).toBe(
      "&foo; &a; &amp &constructor; &toString; &hasOwnProperty; & alone &;",
    );
  });

  it("reads a decoded reference as text, never as a delimiter, and leaves one in a code span, after an escape, in an autolink or in an image's alt text as written", () => {
    expect(rows("&#42;a&#42; *a&#42; b*", 80)[0]).toBe("*a* a* b");
    expect(segment("*a&#42; b*", "a* b").style?.italic).toBe(true);
    expect(rows("`&amp;` \\&amp; &#92;*x*", 80)[0]).toBe("&amp; &amp; \\x");
    expect(links("<http://e.com/?a&amp;b>")).toEqual([["http://e.com/?a&amp;b", "http://e.com/?a&amp;b"]]);
    expect(links("![&amp; *i*](x.png)")).toEqual([["&amp; *i*", "x.png"]]);
  });

  it("decodes the references in a link's destination before making its href, as markdown-it's unescapeAll does", () => {
    expect(rows("[a](&#x6A;avascript:x) b", 80)[0]).toBe("[a](javascript:x) b");
    expect(links("[a](&#x6A;avascript:x)")).toEqual([]);
    expect(links("[b](http://x?a=1&amp;amp;b=2) [c](<&amp;x>) [d](&#0;y) [e](&foo;z) [f](u \"&amp;\")")).toEqual([
      ["b", "http://x?a=1&amp;b=2"],
      ["c", "&x"],
      ["d", "&#0;y"],
      ["e", "&foo;z"],
      ["f", "u"],
    ]);
    // Eight digits of either base, where text takes seven decimal or six hex.
    expect(links("[a](\\&amp;) [b](&#x26;amp;) [c](&#X41;) [d](&#x00000041;) [e](&#000000065;)")).toEqual([
      ["a", "&amp;"],
      ["b", "&amp;"],
      ["c", "A"],
      ["d", "A"],
      ["e", "&#000000065;"],
    ]);
    expect(links("![](a&amp;b.png)")).toEqual([["a&b.png", "a&b.png"]]);
  });

  it("closes emphasis on no delimiter inside an escape, a code span, inline HTML or a link, as Rich does", () => {
    const italic = (source: string): string[] =>
      collectSegments(new Markdown(source, { hyperlinks: false }), { maxWidth: 80 })
        .filter((s) => s.style?.italic)
        .map((s) => s.text);
    expect(italic("*a \\* b*")).toEqual(["a * b"]);
    // A line ending is a token of its own, as markdown-it's softbreak and hardbreak are.
    expect(italic("*a\nb*")).toEqual(["a", " ", "b"]);
    expect(italic("*a  \nb*")).toEqual(["a", "b"]);
    // Rich 14's segments: the tag between the two runs of text splits them.
    expect(italic("*a <b title='*'>c*")).toEqual(["a ", "c"]);
    expect(rows("*a `*` b*", 40)[0]).toBe("a * b");
    expect(italic("*a `*` b*")).toEqual(expect.arrayContaining(["a ", " b"]));
    expect(rows("*[a*](http://u) b*", 40)[0]).toBe("a* b");
    expect(rows("**a <b x='**'> c**", 40)[0]).toBe("a  c");
    expect(segment("**a <b x='**'> c**", " c").style?.bold).toBe(true);
  });

  /** `markdown`'s first row, and each segment of it drawn bold, italic or struck through, with `B`, `I` and `S` for each. */
  function emphasis(markdown: string): [string, [string, string][]] {
    const segments = collectSegments(new Markdown(markdown, { hyperlinks: false }), { maxWidth: 80 });
    const styled = segments
      .filter((s) => s.style?.bold || s.style?.italic || s.style?.strike)
      .map((s): [string, string] => [s.text, `${s.style?.bold ? "B" : ""}${s.style?.italic ? "I" : ""}${s.style?.strike ? "S" : ""}`]);
    return [rows(markdown, 80, { hyperlinks: false })[0]!, styled];
  }

  // Each row is Rich 14's drawing of the source, with markdown-it-py 4.2.
  it.each<[string, string, [string, string][]]>([
    ["x _a_ y", "x a y", [["a", "I"]]],
    ["x __a__ y", "x a y", [["a", "B"]]],
    // A `*` before a space opens nothing, and one after a space closes nothing.
    ["a * b*", "a * b*", []],
    ["x *a b * c", "x *a b * c", []],
    // A `*` opens and closes inside a word; a `_` does neither.
    ["*foo*bar", "foobar", [["foo", "I"]]],
    ["π*a*π", "πaπ", [["a", "I"]]],
    ["snake_case_name", "snake_case_name", []],
    ["_foo_bar", "_foo_bar", []],
    ["foo_bar_", "foo_bar_", []],
    ["π_a_π", "π_a_π", []],
    // Punctuation is Unicode's, and a run next to it flanks only from a space or more punctuation.
    ['a**"b"**', 'a**"b"**', []],
    ["a_“b”_c", "a_“b”_c", []],
    ["_(_a_)_", "(a)", [["(", "I"], ["a", "I"], [")", "I"]]],
    ["a *b* c", "a b c", [["b", "I"]]],
    // The rule of 3: a run that can both open and close does not pair where the lengths sum to a multiple of 3.
    ["*foo**bar*", "foo**bar", [["foo**bar", "I"]]],
    ["*foo**bar**baz*", "foobarbaz", [["foo", "I"], ["bar", "BI"], ["baz", "I"]]],
    ["foo******bar*********baz", "foobar***baz", [["bar", "B"]]],
    ["***a***", "a", [["a", "BI"]]],
    ["**a*", "*a", [["a", "I"]]],
    ["*a**", "a*", [["a", "I"]]],
    ["__foo, __bar__, baz__", "foo, bar, baz", [["foo, ", "B"], ["bar", "B"], [", baz", "B"]]],
    // Pairs nest, a marker pairs only with its own kind, and a link's label pairs only within itself.
    ["*a _b* c_", "a _b c_", [["a _b", "I"]]],
    ["_a*_b*", "_a*_b*", []],
    ["[_a_](u)b_", "a (u)b_", []],
    // A run reads the backslash of a hard break as the punctuation it is, and an escaped one as no break.
    ["foo.*\\\nbar*", "foo.", [["bar", "I"]]],
    ['a "*\\\nb*', 'a "', [["b", "I"]]],
    ["x\\\\\n*a*", "x\\ a", [["a", "I"]]],
  ])("pairs the delimiters of %j as markdown-it's flanking rules do", (source, row, styled) => {
    expect(emphasis(source)).toEqual([row, styled]);
  });

  // Each row is Rich 14's drawing of the source, with markdown-it-py 4.2. Rich
  // reads a line opening with `~~~` as a fence, which ours does not yet
  // (rich-unfiled-791c.fxsx), so the odd runs sit after text.
  it.each<[string, string, [string, string][]]>([
    ["x ~~a~~ y", "x a y", [["a", "S"]]],
    // One `~` strikes nothing; a `~` run flanks as a `*` run does, inside a word too.
    ["~a~", "~a~", []],
    ["~~a~b~~", "a~b", [["a~b", "S"]]],
    ["a~~b~~c", "abc", [["b", "S"]]],
    ["~~ a~~", "~~ a~~", []],
    ["x~~(a)~~y", "x~~(a)~~y", []],
    // Tildes pair two at a time; an odd run's spare `~` is text, moved past the run that closes.
    ["x ~~~a~~~", "x ~a~", [["a", "S"]]],
    ["x ~~a~~~", "x a~", [["a", "S"]]],
    ["x ~~~~~a~~~", "x ~~~a~", [["a", "S"]]],
    ["foo~~~~bar~~", "foo~~bar", [["bar", "S"]]],
    // An escaped `~` is no spare and stays where it is written.
    ["~~a\\~~~", "a~", [["a~", "S"]]],
    ["~~a\\~~b~~", "a~~b", [["a~~b", "S"]]],
    // Two pairs nested tight are struck once, never merged as `**` merges into strong.
    ["x ~~~~a~~~~", "x a", [["a", "S"]]],
    // Strikethrough nests with emphasis, and pairs only with its own kind.
    ["**~~a~~**", "a", [["a", "BS"]]],
    ["~~_a_~~", "a", [["a", "IS"]]],
    ["~~a *b~~ c*", "a *b c*", [["a *b", "S"]]],
    ["*a~~b*~~", "a~~b~~", [["a~~b", "I"]]],
    ["~~a `~~` b~~", "a ~~ b", [["a ", "S"], ["~~", "BS"], [" b", "S"]]],
  ])("strikes through the ~~ pairs of %j as Rich does", (source, row, styled) => {
    expect(emphasis(source)).toEqual([row, styled]);
  });

  it("draws emphasis in markdown.em, strong in markdown.strong and strikethrough in markdown.s", () => {
    const theme = new Theme({ "markdown.em": "red", "markdown.strong": "green", "markdown.s": "blue" });
    const segs = collectSegments(new Markdown("*a* **b** ~~c~~"), { maxWidth: 40, theme });
    const colorOf = (text: string) => segs.find((s) => s.text === text)?.style?.color?.name;
    expect([colorOf("a"), colorOf("b"), colorOf("c")]).toEqual(["red", "green", "blue"]);
    // Rich's defaults.
    expect(["markdown.em", "markdown.strong", "markdown.s"].map((name) => DEFAULT_THEME.resolve(name))).toEqual(
      ["italic", "bold", "strike"].map((style) => Style.parse(style)),
    );
  });

  it("takes no lazy line into a container that ends in an HTML block", () => {
    expect(rows("> q\n> <div>\nlazy", 40)).toEqual(["", "▌ q", "", "lazy", ""]);
    expect(rows("- item\n  <!-- c -->\nlazy", 40)).toEqual(["", " • item", "", "lazy", ""]);
  });

  // --- Nesting, as deep as markdown-it reads it ---

  // Each case below is Rich 14's own output for its source.

  it("refuses a link whose text holds a link, so only the inner one links, as Rich does", () => {
    expect(rows("[a [b](v) c](u)", 80, { hyperlinks: false })).toEqual(["[a b (v) c](u)", ""]);
    expect(links("[a [b](v) c](u)")).toEqual([["b", "v"]]);
    expect(rows("[a [b [c](u) d](v) e](w)", 80)).toEqual(["[a [b c d](v) e](w)", ""]);
    // An image's alt text may hold a link.
    expect(rows("![a [b](v) c](u)", 80)).toEqual(["🌆 a [b](v) c", ""]);
  });

  it.each([
    [20, "[".repeat(19) + "x (u)" + "](u)".repeat(19)],
    // One bracket past maxNesting, markdown-it's scan leaps past the end of the text and no bracket links.
    [21, "[".repeat(21) + "x" + "](u)".repeat(21)],
    [22, "[".repeat(21) + "x (u)" + "](u)".repeat(21)],
  ])("follows %i nested link brackets only as deep as markdown-it does, as Rich does", (depth, row) => {
    expect(rows("[".repeat(depth) + "x" + "](u)".repeat(depth), 200, { hyperlinks: false })).toEqual([row, ""]);
  });

  it.each([
    ["p\n\n" + ">".repeat(19) + " x\ny", ["p", "", "▌ ".repeat(19) + "x y", ""]],
    // At 20 levels a quote's content, and the lazy line after it, are read as nothing.
    ["p\n\n" + ">".repeat(20) + " x\ny\n\nafter", ["p", "", "", "after", ""]],
    ["p\n\n" + ">".repeat(21) + " x\n\nafter", ["p", "", "", "after", ""]],
    ["p\n\n" + "- ".repeat(9) + "x\n\nafter", ["p", "", " • ".repeat(9) + "x", "", "after", ""]],
    // An item 20 levels deep takes every line to the end of the quote it sits in, or of the document.
    ["p\n\n" + "- ".repeat(10) + "x\n\nafter", ["p", "", ""]],
    ["p\n\n" + "- ".repeat(10) + "x\n- second", ["p", "", ""]],
    ["p\n\n> " + "- ".repeat(10) + "x\n> y\n\nafter", ["p", "", "", "after", ""]],
    // An empty item that deep leaves nothing unread, so it takes no line after it.
    ["p\n\n" + "- + ".repeat(5).trimEnd() + "\n- next", ["p", "", " • next", ""]],
    ["p\n\n" + "- + ".repeat(5).trimEnd() + "\n\nafter", ["p", "", "", "after", ""]],
    ["p\n\n" + "- + ".repeat(5) + "\n  x\n\nafter", ["p", "", " • x", "", "after", ""]],
    ["p\n\n> " + "- + ".repeat(5).trimEnd() + "\n> after", ["p", "", "▌ after", ""]],
  ])("reads the blocks of %j no deeper than markdown-it does, as Rich does", (source, expected) => {
    expect(rows(source, 200)).toEqual(expected);
  });

  it("ends a quote at a blank marked line after an item it nests 20 levels deep, as Rich does", () => {
    expect(rows("> " + "- ".repeat(10) + "x\n>\nb", 200)).toEqual(["", "", "b", ""]);
    expect(rows("> > " + "- ".repeat(9) + "x\n> >\n> b\nc", 200)).toEqual(["", "▌ b c", ""]);
  });

  it("draws Markdown nested ten thousand levels deep, as Rich does", () => {
    const depth = 10_000;
    expect(rows(">".repeat(depth) + " x", 80)).toEqual(["", ""]);
    expect(rows("- ".repeat(depth) + "x", 80)).toEqual(["", ""]);
    expect(rows("[".repeat(depth) + "x" + "](u)".repeat(depth), 50_000, { hyperlinks: false })).toEqual([
      "[".repeat(depth - 1) + "x (u)" + "](u)".repeat(depth - 1),
      "",
    ]);
    const emphasis = "*a ".repeat(depth) + "x" + " a*".repeat(depth);
    expect(rows(emphasis, 80).join(" ").trim()).toBe("a ".repeat(depth) + "x" + " a".repeat(depth));
    expect(collectSegments(new Markdown(emphasis), { maxWidth: 50_000 }).find((s) => s.text.includes("x"))?.style?.italic).toBe(true);
  });

  // --- Measurement ---

  it("measurement returns valid values", () => {
    const md = new Markdown("# Hello");
    const m = md.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeLessThanOrEqual(80);
  });

  // --- Construction ---

  it("constructs with markdown string only", () => {
    const md = new Markdown("Hello");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Hello");
  });

  it("constructs with markdown string and options", () => {
    const md = new Markdown("Hello", { justify: "center" });
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Hello");
  });
});
