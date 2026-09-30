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

  it("indents a nested list item under its parent", () => {
    expect(rows("- parent\n  - child", 80)).toEqual(["  • parent", "    • child", ""]);
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
    expect(rows("Title\n===\nSub\n---\nbody", 80)).toEqual(["Title", "Sub", "body", ""]);
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
    expect(rows("> the total was\n2024. That year", 80)).toEqual(["▎ the total was 2024. That year", ""]);
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
    expect(rows("# Title\r\n- item\r\n- next", 80)).toEqual(["Title", "  • item", "  • next", ""]);
  });

  it("indents a tab-nested item by the columns the tab spans, never a raw tab", () => {
    const out = rows("- parent\n\t- child text", 20);
    expect(out).toEqual(["  • parent", "      • child text", ""]);
  });

  it("keeps an item's text when its gutter is as wide as the width", () => {
    expect(rows("- hi", 3)).toEqual(["  • h", "    i", ""]);
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

  it("writes a link's URL after its text when hyperlinks is false", () => {
    const md = "[link](https://example.com) here";
    expect(rows(md, 80, { hyperlinks: false })).toEqual(["link (https://example.com) here", ""]);
    expect(segment(md, "link", { hyperlinks: false }).style?.link).toBeUndefined();
    expect(segment(md, "https://example.com", { hyperlinks: false }).style?.link).toBe("https://example.com");
  });

  it("places paragraphs, list items and quotes by justify, and leaves headings where they are", () => {
    const md = "# Head\n\nbody\n\n- item\n\n> quote";
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

  it("follows the justify it is rendered with when none is given, and still leaves headings left", () => {
    const md = new Markdown("# Head\n\nbody");
    const text = collectText(md, { maxWidth: 12, justify: "right" });
    expect(text.split("\n").map((row) => row.trimEnd())).toEqual(["Head", "", "        body", ""]);
  });

  it("draws a heading at its natural width, so its style stops where its text does", () => {
    for (const justify of [undefined, "left", "full"] as const) {
      const heading = collectText(new Markdown("# Head\n\nbody", { justify }), { maxWidth: 20, justify }).split("\n")[0];
      expect(heading).toBe("Head");
    }
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
