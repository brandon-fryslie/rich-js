import { describe, it, expect } from "vitest";
import { Markdown, type MarkdownOptions } from "../../src/renderables/markdown.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
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
    expect(text).toContain("1.");
    expect(text).toContain("2.");
  });

  it("renders links", () => {
    const md = new Markdown("[Click here](https://example.com)");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("Click here");
  });

  it("renders blockquotes with indented border", () => {
    const md = new Markdown("> A quote");
    const text = collectText(md, { maxWidth: 80 });
    expect(text).toContain("A quote");
    // Blockquotes have a vertical bar indicator
    expect(text).toContain("\u258e"); // left block element used as border
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

  it("keeps a list item's continuation lines in the item, hanging under its text", () => {
    const md = "- alpha beta gamma\n  delta epsilon\n- zeta";
    expect(rows(md, 18)).toEqual(["  • alpha beta", "    gamma delta", "    epsilon", "  • zeta", ""]);
  });

  it("ends every list item on its own row", () => {
    expect(rows("- Item A\n- Item B\n1. First\n2. Second", 80)).toEqual([
      "  • Item A",
      "  • Item B",
      "1. First",
      "2. Second",
      "",
    ]);
  });

  it("draws a nested list under its parent's text, however far the source indents it", () => {
    for (const md of ["- parent\n  - child", "- parent\n    - child"]) {
      expect(rows(md, 80)).toEqual(["  • parent", "      • child", ""]);
    }
    expect(rows("- parent\n  1. child", 80)).toEqual(["  • parent", "    1. child", ""]);
  });

  it("draws a quote's bar down every row it wraps to, with its lines joined", () => {
    expect(rows("> one two\n> three four", 12)).toEqual(["▎ one two", "▎ three four", ""]);
  });

  it("keeps every row inside its width when a list runs into a paragraph", () => {
    // A row wider than the width is cut off by whatever frames it, so its
    // tail is lost rather than wrapped.
    const out = rows("- first item\n  continues here\nand runs on\n\nafter the gap", 16);
    expect(out.every((row) => row.length <= 16)).toBe(true);
    expect(out).toEqual(["  • first item", "    continues", "    here and", "    runs on", "", "after the gap", ""]);
  });

  it("leaves a wrapped line that starts with a number other than 1 in its paragraph", () => {
    expect(rows("the total was\n2024. That year", 80)).toEqual(["the total was 2024. That year", ""]);
  });

  it("reads a paragraph underlined with = or - as a heading, not a rule", () => {
    expect(rows("Title\n===\nSub\n---\nbody", 11)).toEqual(["   Title", "Sub", "body", ""]);
  });

  it("keeps a hard line break, from two trailing spaces or a backslash", () => {
    expect(rows("one  \ntwo\\\nthree\nfour", 80)).toEqual(["one", "two", "three four", ""]);
  });

  it("keeps a quote's paragraph break at a bare > line without leaking the marker", () => {
    expect(rows("> a\n>\n>b", 80)).toEqual(["▎ a", "▎", "▎ b", ""]);
  });

  it("draws the blocks inside a quote as blocks, beside its bar", () => {
    expect(rows("> - a\n> - b\n> soft\n>\n> para two", 80)).toEqual([
      "▎   • a",
      "▎   • b soft",
      "▎",
      "▎ para two",
      "",
    ]);
  });

  it("draws a fenced block inside a quote line for line", () => {
    expect(rows("> ```\n> a = 1\n> b = 2\n> ```", 80)).toEqual(["▎ a = 1", "▎ b = 2", ""]);
  });

  it("ends a quote at an unmarked line after a bare >, and lazily continues its open paragraph", () => {
    expect(rows("> quoted\n>\nNot quoted", 80)).toEqual(["▎ quoted", "▎", "Not quoted", ""]);
    expect(rows("> the total was\nthat year", 80)).toEqual(["▎ the total was that year", ""]);
    // Outside the quote no paragraph is open, so an item opens whatever it counts from.
    expect(rows("> the total was\n2024. That year", 80)).toEqual(["▎ the total was", "2024. That year", ""]);
  });

  it("leaves a list item's wrapped line that starts with a number other than 1 in the item", () => {
    expect(rows("- item\n  2024. That year", 80)).toEqual(["  • item 2024. That year", ""]);
  });

  it("starts a sibling item at the marker's own column whatever it counts from", () => {
    expect(rows("1. a\n2. b", 80)).toEqual(["1. a", "2. b", ""]);
  });

  it("draws an empty item's bullet and an empty quote's bar", () => {
    expect(rows("1.  \n2. x\n\n>", 80)).toEqual(["1.", "2. x", "", "▎", ""]);
  });

  it("reads CRLF line endings as line endings", () => {
    expect(rows("## Title\r\n- item\r\n- next", 80)).toEqual(["Title", "  • item", "  • next", ""]);
  });

  it("indents a tab-nested item by the columns the tab spans, never a raw tab", () => {
    const out = rows("- parent\n\t- child text", 20);
    expect(out).toEqual(["  • parent", "      • child text", ""]);
  });

  it("counts a tab inside an item from the source's column 0, not the item's", () => {
    expect(rows("- a\n\n  \tb", 20)).toEqual(["  • a", "", "    b", ""]);
    expect(rows("- parent\n  \t- child", 20)).toEqual(["  • parent", "      • child", ""]);
  });

  it("reads a tab after a quote's marker as the space it may take, then indentation", () => {
    expect(rows(">\tfoo", 20)).toEqual(["▎ foo", ""]);
    expect(rows(">\t\tfoo", 20)).toEqual(["▎   foo", ""]);
  });

  it("draws a tab in code as spaces to the code's own stops, never a raw tab", () => {
    expect(rows("- a\n\n  ```\n  \tx\n  ```", 20)).toEqual(["  • a", "", "            x", ""]);
    expect(rows("    \tx", 20)).toEqual(["        x", ""]);
  });

  it("opens a fence or a quote indented up to three columns inside an item", () => {
    expect(rows("- step\n\n    ```\n    npm i\n    ```", 20)).toEqual(["  • step", "", "    npm i", ""]);
    expect(rows("- a\n   > q", 20)).toEqual(["  • a", "    ▎ q", ""]);
  });

  it("continues a parent's text with a marker indented four columns past it, as CommonMark does", () => {
    expect(rows("- parent\n      - child", 40)).toEqual(["  • parent - child", ""]);
  });

  it("reads a line of the list's own bullets as a thematic break, not an item", () => {
    const out = rows("* a\n* * *\n* b", 10);
    expect(out[0]).toBe("  • a");
    expect(out[1]).toMatch(/^─+$/);
    expect(out[2]).toBe("  • b");
    expect(rows("_ _ _", 5)[0]).toMatch(/^─+$/);
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

  it("keeps an item's text when its gutter is as wide as the width", () => {
    expect(rows("- hi", 3)).toEqual(["  • h", "    i", ""]);
  });

  // --- Lists hold blocks, as CommonMark reads them ---

  it("keeps a fence inside a list item, line for line under its hang", () => {
    expect(rows("- step:\n  ```sh\n  npm i\n  npm test\n  ```", 80)).toEqual([
      "  • step:",
      "    npm i",
      "    npm test",
      "",
    ]);
  });

  it("draws a quote inside a list item under its hang", () => {
    expect(rows("- item\n  > quoted", 80)).toEqual(["  • item", "    ▎ quoted", ""]);
  });

  it("makes a number short of the content column a sibling, numbered on from the first", () => {
    expect(rows("1. a\n  5. b", 80)).toEqual(["1. a", "2. b", ""]);
    expect(rows("1. a\n1. b\n1. c", 80)).toEqual(["1. a", "2. b", "3. c", ""]);
  });

  it("right-aligns a list's numbers so every item hangs at one column", () => {
    expect(rows("9. a\n10. b\n    more", 80)).toEqual([" 9. a", "10. b more", ""]);
  });

  it("reads a marker four columns in as indented code, not a list", () => {
    expect(rows("    - not a list", 80)).toEqual(["- not a list", ""]);
  });

  it("reads an empty item as an item", () => {
    expect(rows("- \n- x", 80)).toEqual(["  •", "  • x", ""]);
  });

  it("keeps a loose item's later paragraphs in the item", () => {
    expect(rows("- one\n\n  two\n\n- three", 80)).toEqual(["  • one", "", "    two", "", "  • three", ""]);
  });

  it("ends a list item at an unindented line once no paragraph is open", () => {
    expect(rows("- a\n\nafter", 80)).toEqual(["  • a", "", "after", ""]);
    expect(rows("- ```\n  code\nafter", 80)).toEqual(["  • code", "after", ""]);
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
  });

  it("draws an image as Rich does: a picture, then its alt text linked to the image", () => {
    expect(rows("![logo](a.png)", 80)).toEqual(["🌆 logo", ""]);
    expect(segment("![logo](a.png)", "logo").style?.link).toBe("a.png");
    expect(rows("![logo](a.png)", 80, { hyperlinks: false })).toEqual(["🌆 logo", ""]);
    expect(rows("![](img/a.png)", 80)).toEqual(["🌆 a.png", ""]);
  });

  it("leaves brackets that are not a link as they are", () => {
    expect(rows("[a] (b) and [c](d", 80)).toEqual(["[a] (b) and [c](d", ""]);
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

  it("makes a link's text the link by default", () => {
    expect(rows("[link](https://example.com)", 80)).toEqual(["link", ""]);
    expect(segment("[link](https://example.com)", "link").style?.link).toBe("https://example.com");
  });

  it("draws a style inside a link's text over the link's own, as Rich does", () => {
    const code = segment("[`foo()`](https://x)", "foo()");
    expect(code.style?.link).toBe("https://x");
    expect(code.style?.color).toEqual(segment("`foo()`", "foo()").style?.color);
  });

  it("writes a link's URL after its text when hyperlinks is false", () => {
    const md = "[link](https://example.com) here";
    expect(rows(md, 80, { hyperlinks: false })).toEqual(["link (https://example.com) here", ""]);
    expect(segment(md, "link", { hyperlinks: false }).style?.link).toBeUndefined();
    expect(segment(md, "https://example.com", { hyperlinks: false }).style?.link).toBe("https://example.com");
  });

  it("places paragraphs, list items and quotes by justify, and leaves headings where they are", () => {
    const md = "## Head\n\nbody\n\n- item\n\n> quote";
    expect(rows(md, 12, { justify: "right" })).toEqual([
      "Head",
      "",
      "        body",
      "",
      "  •     item",
      "",
      "▎      quote",
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
      expect(out.split("\n")).toEqual(["       Title        ", "Sub", "Six", ""]);
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
      expect(linked).toBe(options.hyperlinks === false ? "https://e.com" : "ab");
    }
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
