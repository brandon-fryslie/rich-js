import { describe, it, expect } from "vitest";
import { Markdown, type MarkdownOptions } from "../../src/renderables/markdown.js";
import { linkHref } from "../../src/renderables/markdown-url.js";
import { Segment } from "../../src/core/segment.js";
import { DEFAULT_THEME, Style } from "../../src/core/style.js";
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

  it("reads a lazy line of `=` as paragraph text, never as an underline, and a lazy indented marker as text", () => {
    expect(rows("> foo\n===", 20)).toEqual(["▎ foo ===", ""]);
    expect(rows("- foo\n===", 20)).toEqual(["  • foo ===", ""]);
    expect(rows("> foo\n    - bar", 20)).toEqual(["▎ foo - bar", ""]);
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

  it("reads a long run of spaces in time linear in its length", () => {
    const started = performance.now();
    new Markdown(`a${" ".repeat(100_000)}b`);
    // Scanning ahead from each space for a line ending took over four seconds here.
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
    // Rich 14: ["🌆 i ▌ x", "▌ ---…", "▌", ""]. Only the first row is pinned: the
    // quote's bar, and the rows of the rule, are the port's own.
    expect(rows("> x ![i](p.png)\n>\n> ***", 40)[0]).toBe("🌆 i ▎ x");
  });

  it("draws an image in a list ahead of the whole list, as Rich does", () => {
    // Rich 14: ["text", "", "🌆 i", " • a", " • b", "", "after", ""] — its list
    // markers are rich-unfiled-791c.s3d1's.
    expect(rows("text\n\n- a\n- b ![i](p.png)\n\nafter", 40)).toEqual(["text", "", "🌆 i", "  • a", "  • b", "", "after", ""]);
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
    expect(segment("> x ![i](p.png)", "i").style?.italic).toBe(true);
    expect(segment("*![](d/a.png)*", "a.png").style).toEqual(new Style({ link: "d/a.png" }));
  });

  it("draws an image's alt text as written, never parsed as Markdown, as Rich does", () => {
    expect(rows("![**a** `c` <a@b.co> \\*b &amp; [y]](q)", 80)[0]).toBe("🌆 **a** `c` <a@b.co> \\*b &amp; [y]");
    expect(links("![<http://x>](y)")).toEqual([["<http://x>", "y"]]);
  });

  it("leaves brackets that are not a link as they are", () => {
    expect(rows("[a] (b) and [c](d", 80)).toEqual(["[a] (b) and [c](d", ""]);
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
    const drawn = (colorSystem: ColorDepth) =>
      collectSegments(new Markdown("Use `code` here\n\n```\nblock\n```"), { maxWidth: 80, colorSystem })
        .filter((s) => s.text === "code" || s.text === "block")
        .map((s) => s.style);
    // Bold, as Rich's own `markdown.code` is, so code stays set apart once its colours go.
    expect(code.bold).toBe(true);
    expect(drawn(ColorDepth.STANDARD)).toEqual([code.withoutColor, code.withoutColor]);
    expect(drawn(ColorDepth.EIGHT_BIT)).toEqual([code, code]);
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
    expect(rows("> a | b\n--|--", 30)).toEqual(["", " > a  b", " ──────", "", ""]);
    expect(rows("a|b\n-|-\n1|2", 30)).toEqual(["", " a  b", " ────", " 1  2", "", ""]);
    // A delimiter row naming another count of columns is no table: this is a setext heading.
    expect(rows("a | b\n---", 30)).toEqual(["a | b", ""]);
    // A lazy line is only ever paragraph text.
    expect(rows("> a | b\n> more\n--|--", 30)).toEqual(["▎ a | b more --|--", ""]);
    // A table ends a paragraph, and a line that opens a block ends the table.
    expect(rows("| a |\n|---|\n| 1 |\n> q", 30)).toEqual(["", " a", " ─", " 1", "", "▎ q", ""]);
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
    expect(lastRows(256)).toEqual([" a", "", "stop", ""]);
  });

  it("draws a table inside a list item, under its hang", () => {
    expect(rows("- x\n\n  | a | b |\n  |---|---|\n  | 1 | 2 |", 30)).toEqual([
      "  • x",
      "",
      "",
      "     a  b",
      "     ────",
      "     1  2",
      "",
      "",
    ]);
  });

  // --- HTML blocks ---

  // Rich 14's own output for each source at 40 columns, but for the blank Rich
  // draws before every block after the first, which this renderer leaves to
  // the source's own blank lines — as the table test above sets it aside.

  it("draws an HTML block as Rich does, not at all, and ends a paragraph at one", () => {
    expect(rows("para one\n<div>\nhello\n</div>\n\nafter", 40)).toEqual(["para one", "", "after", ""]);
  });

  it("ends a paragraph at every kind of HTML block but a lone tag, which continues it", () => {
    const kinds = [
      ["<script>", "</script>"],
      ["<!-- c", "-->"],
      ["<?php", "?>"],
      ["<!DOCTYPE html", ">"],
      ["<![CDATA[", "]]>"],
    ];
    for (const [open, close] of kinds) expect(rows(`para\n${open}\nbody\n${close}\n\nafter`, 40)).toEqual(["para", "", "after", ""]);
    // The sixth kind, a block-level element, ends at a blank line instead of a closing one.
    expect(rows('para\n<DIV class="x">\nbody\n\nafter', 40)).toEqual(["para", "", "after", ""]);
    // Any other tag alone on a line opens a block only where no paragraph is open,
    // and neither it nor a lowercase `<!doctype`, which markdown-it-py does not
    // read as a declaration block, ends one: both are the paragraph's inline HTML.
    expect(rows("para\n<span>\nafter", 40)).toEqual(["para  after", ""]);
    expect(rows("para\n<!doctype html>\nafter", 40)).toEqual(["para  after", ""]);
    expect(rows("<span>\nhello\n\nafter", 40)).toEqual(["", "after", ""]);
  });

  it("runs an HTML block to the line that closes its kind, or to the end without one", () => {
    // A blank line inside `<pre>` does not end it; the line after `</pre>` is a paragraph.
    expect(rows("<pre>\nx\n\ny\n</pre>\nafter", 40)).toEqual(["after", ""]);
    expect(rows("a\n\n<!-- open\n\nstill", 40)).toEqual(["a", "", ""]);
  });

  it("ends a table at an HTML block, as markdown-it does", () => {
    expect(rows("| a |\n| - |\n| 1 |\n<!-- c -->\nafter", 40)).toEqual(["", " a", " ─", " 1", "", "after", ""]);
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
    expect(rows("| a | b |\n| - | - |\n| 1 | 2 |\n<span>", 40)).toEqual(["", " a  b", " ────", " 1  2", "", "", ""]);
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
    expect(rows("| a &amp; | b |\n|---|---|\n| &lt; | &#124; |", 80).slice(1, 4)).toEqual([" a &  b", " ──────", " <    |"]);
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
    expect(italic("*a <b title='*'>c*")).toEqual(["a c"]);
    expect(rows("*a `*` b*", 40)[0]).toBe("a * b");
    expect(italic("*a `*` b*")).toEqual(expect.arrayContaining(["a ", " b"]));
    expect(rows("*[a*](http://u) b*", 40)[0]).toBe("a* b");
    expect(rows("**a <b x='**'> c**", 40)[0]).toBe("a  c");
    expect(segment("**a <b x='**'> c**", "a  c").style?.bold).toBe(true);
  });

  /** `markdown`'s first row, and each segment of it drawn bold or italic, with `B` for bold and `I` for italic. */
  function emphasis(markdown: string): [string, [string, string][]] {
    const segments = collectSegments(new Markdown(markdown, { hyperlinks: false }), { maxWidth: 80 });
    const styled = segments
      .filter((s) => s.style?.bold || s.style?.italic)
      .map((s): [string, string] => [s.text, `${s.style?.bold ? "B" : ""}${s.style?.italic ? "I" : ""}`]);
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

  it("takes no lazy line into a container that ends in an HTML block", () => {
    expect(rows("> q\n> <div>\nlazy", 40)).toEqual(["▎ q", "lazy", ""]);
    expect(rows("- item\n  <!-- c -->\nlazy", 40)).toEqual(["  • item", "lazy", ""]);
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
