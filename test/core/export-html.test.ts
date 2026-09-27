import { describe, it, expect } from "vitest";
import { encodeHtml, encodeHtmlFragment, HTML_FRAGMENT_CSS } from "../../src/core/export-html.js";
import { exportCanvas } from "../../src/core/export-lines.js";
import { ColorRgba, STANDARD_TABLE, TerminalTheme } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { Palette } from "../../src/themes/palette.js";
import { SOLARIZED_LIGHT } from "../../src/themes/terminalThemes.js";

// [LAW:behavior-not-structure] What a reader of the exported page gets: which
// colours paint it, which CSS each run carries, where links go. What a look
// *is* under a theme is pinned in export-lines.test.ts; this pins its encoding.

const PAPER = new ColorRgba(16, 32, 48);
const INK = new ColorRgba(200, 210, 220);
const THEME = new TerminalTheme(PAPER, INK, STANDARD_TABLE, new Palette("probe", true, new Map()));

const html = (style: Style, text = "x") => encodeHtml([new Segment(text, style)], THEME);

/** The inline CSS on the span wrapping `text`. */
const cssOf = (document: string, text = "x"): string => {
  const match = new RegExp(`<span style="([^"]*)">${text}</span>`).exec(document);
  if (match === null) throw new Error(`no span around ${JSON.stringify(text)} in:\n${document}`);
  return match[1]!;
};

describe("encodeHtml page", () => {
  it("paints body with the theme's canvas and ink, not a fixed black and white", () => {
    const c = new Console({ record: true, width: 20, file: { write: () => true } });
    c.print("hello");
    const page = c.exportHtml({ theme: SOLARIZED_LIGHT });
    expect(page).toContain(
      `body{background:${SOLARIZED_LIGHT.backgroundColor.hex};color:${SOLARIZED_LIGHT.foregroundColor.hex};`,
    );
  });

  it("falls back to the same canvas export-lines resolves runs over", () => {
    const { background, foreground } = exportCanvas();
    expect(encodeHtml([new Segment("x")])).toContain(`body{background:${background.hex};color:${foreground.hex};`);
  });

  it("lays rows out as recorded, without re-wrapping", () => {
    expect(html(Style.parse("none"))).toContain("white-space:pre;overflow-x:auto");
  });

  it("keeps a leading blank row past the newline an HTML parser drops after <pre>", () => {
    expect(encodeHtml([new Segment("\nx")], THEME)).toMatch(/<pre [^>]*>\n\n<span/);
  });

  it("ends every row with a newline, so a trailing blank row is drawn", () => {
    expect(encodeHtml([new Segment("x\n\n")], THEME)).toContain("x</span>\n\n</pre>");
    expect(encodeHtml([new Segment("x")], THEME)).toContain("x</span>\n</pre>");
  });
});

describe("encodeHtml runs", () => {
  it("always writes the resolved foreground and leaves the canvas unpainted", () => {
    expect(cssOf(html(Style.parse("none")))).toBe(`color:${INK.hex}`);
  });

  it("paints a requested background", () => {
    expect(cssOf(html(Style.parse("on #ff0000")))).toBe(`color:${INK.hex};background-color:#ff0000`);
  });

  it("swaps a reversed run's ink and paper", () => {
    expect(cssOf(html(Style.parse("reverse")))).toBe(`color:${PAPER.hex};background-color:${INK.hex}`);
  });

  it("draws dim as a blended colour, never opacity", () => {
    const css = cssOf(html(Style.parse("dim on #ff0000")));
    expect(css).not.toContain("opacity");
    expect(css).not.toContain(`color:${INK.hex};`);
    expect(css).toContain("background-color:#ff0000");
  });

  it("writes weight and slant", () => {
    expect(cssOf(html(Style.parse("bold italic")))).toBe(`color:${INK.hex};font-weight:bold;font-style:italic`);
  });

  it("lists every single-style decoration line on the glyph's span", () => {
    expect(cssOf(html(Style.parse("underline strike overline")))).toBe(
      `color:${INK.hex};text-decoration-line:underline line-through overline`,
    );
    expect(html(Style.parse("underline"))).not.toContain("text-decoration-style");
  });

  it("doubles only the underline, on an outer span that carries the paint and the blink", () => {
    expect(html(Style.parse("underline2 strike overline blink on #ff0000"))).toContain(
      `<span style="color:${INK.hex};background-color:#ff0000;text-decoration-line:underline;` +
        `text-decoration-style:double;animation:rich-blink 1s step-end infinite">` +
        `<span style="color:${INK.hex};text-decoration-line:line-through overline;` +
        `animation:rich-blink 1s step-end infinite">x</span></span>`,
    );
  });

  it("blinks slow and fast against keyframes that hide the glyph", () => {
    expect(cssOf(html(Style.parse("blink")))).toContain("animation:rich-blink 1s step-end infinite");
    expect(cssOf(html(Style.parse("blink2")))).toContain("animation:rich-blink 0.5s step-end infinite");
    expect(html(Style.parse("blink"))).toContain("@keyframes rich-blink{50%{color:transparent}}");
  });

  it("frames and encircles in the glyph's own colour", () => {
    expect(cssOf(html(Style.parse("frame")))).toBe(`color:${INK.hex};box-shadow:inset 0 0 0 1px currentColor`);
    expect(cssOf(html(Style.parse("encircle")))).toBe(
      `color:${INK.hex};box-shadow:inset 0 0 0 1px currentColor;border-radius:0.5em`,
    );
  });
});

describe("encodeHtml links and escaping", () => {
  it("wraps a linkable run in an anchor that inherits the run's look", () => {
    const page = html(new Style({ link: "https://example.com/a?b=1&c=2", bold: true }));
    expect(page).toContain(
      `<a href="https://example.com/a?b=1&amp;c=2" style="all:unset;cursor:revert;outline:revert">` +
        `<span style="color:${INK.hex};font-weight:bold">x</span></a>`,
    );
  });

  it("exports a refused link as its styled text with no anchor", () => {
    const page = html(new Style({ link: "javascript:alert(1)", bold: true }));
    expect(page).not.toContain("<a ");
    expect(cssOf(page)).toBe(`color:${INK.hex};font-weight:bold`);
  });

  it("escapes markup characters in text", () => {
    expect(html(Style.parse("none"), `<b> & "q"`)).toContain(`>&lt;b&gt; &amp; "q"</span>`);
  });
});

describe("encodeHtmlFragment", () => {
  const segments = [new Segment("a\n"), new Segment("x", new Style({ link: "https://example.com", blink: true }))];

  it("is exactly what the document's body holds", () => {
    const fragment = encodeHtmlFragment(segments, THEME);
    expect(encodeHtml(segments, THEME)).toContain(`<body>${fragment}</body>`);
  });

  it("is one pre painted in the theme's canvas, styled only inline", () => {
    const fragment = encodeHtmlFragment(segments, THEME);
    expect(fragment).toMatch(new RegExp(`^<pre style="[^"]*background:${PAPER.hex};color:${INK.hex};[^"]*">[^]*</pre>$`));
    expect(fragment.match(/<pre/g)).toHaveLength(1);
    expect(fragment).not.toContain("<style");
  });

  it("leaves the blink keyframes to the page, included once by the document", () => {
    expect(encodeHtmlFragment(segments, THEME)).not.toContain("@keyframes");
    expect(encodeHtml(segments, THEME).split(HTML_FRAGMENT_CSS)).toHaveLength(2);
  });
});
