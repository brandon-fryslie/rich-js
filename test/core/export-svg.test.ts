import { describe, it, expect } from "vitest";
import { encodeSvg } from "../../src/core/export-svg.js";
import { exportCanvas } from "../../src/core/export-lines.js";
import { cellLen } from "../../src/core/cells.js";
import { ColorRgba, STANDARD_TABLE, TerminalTheme } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { Palette } from "../../src/themes/palette.js";
import { SOLARIZED_LIGHT } from "../../src/themes/terminalThemes.js";

// [LAW:behavior-not-structure] What a viewer of the exported image gets: where
// each glyph sits, what is painted under and over it, which colours and links
// it carries. What a look *is* under a theme is pinned in export-lines.test.ts;
// this pins its encoding.

const CELL = 12.2;
const PAPER = new ColorRgba(16, 32, 48);
const INK = new ColorRgba(200, 210, 220);
const THEME = new TerminalTheme(PAPER, INK, STANDARD_TABLE, new Palette("probe", true, new Map()));

const svg = (segments: Segment[], width = 10) => encodeSvg(segments, { theme: THEME, title: "t", width });
const styled = (style: string, text = "x") => svg([new Segment(text, Style.parse(style))]);

/** Every glyph element in the terminal area, with its attributes and text. */
const texts = (document: string) =>
  Array.from(document.matchAll(/<text (x="[^"]*"[^>]*)>([^<]*)<\/text>/g), ([, attrs, text]) => ({
    text: text!,
    x: Number(/x="([^"]*)"/.exec(attrs!)![1]),
    y: Number(/ y="([^"]*)"/.exec(attrs!)![1]),
    textLength: /textLength="([^"]*)"/.exec(attrs!)?.[1],
  }));

/** The rectangles inside the terminal area, as attribute strings. */
const rects = (document: string) =>
  Array.from(document.split('-matrix" transform')[1]!.matchAll(/<rect ([^>]*)\/>/g), ([, attrs]) => attrs!);

const decorations = (document: string) => rects(document).filter((r) => r.includes('height="1.5"'));

describe("encodeSvg positioning", () => {
  it("anchors each chunk at its column and stretches it to its cells, across ASCII, CJK and emoji", () => {
    const glyphs = texts(svg([new Segment("ab漢字"), new Segment("cd😀ef", Style.parse("bold"))]));
    expect(glyphs.map((g) => g.text)).toEqual(["ab", "漢", "字", "cd", "😀", "ef"]);
    let column = 0;
    for (const glyph of glyphs) {
      const cells = cellLen(glyph.text);
      expect(glyph.x).toBeCloseTo(column * CELL, 5);
      expect(Number(glyph.textLength)).toBeCloseTo(cells * CELL, 5);
      column += cells;
    }
    expect(column).toBe(12);
  });

  it("keeps a combining mark with its base, and a zero-width grapheme with the chunk before it", () => {
    expect(texts(svg([new Segment("é̂x")])).map((g) => [g.text, g.textLength])).toEqual([
      ["é̂x", "24.4"],
    ]);
    expect(texts(svg([new Segment("漢​ab")])).map((g) => [g.text, g.textLength])).toEqual([
      ["漢​", "24.4"],
      ["ab", "24.4"],
    ]);
  });

  it("gives a run that opens on a zero-cell grapheme a chunk with no textLength", () => {
    const glyphs = texts(svg([new Segment("a"), new Segment("́b", Style.parse("bold"))]));
    expect(glyphs.map((g) => [g.text, g.x, g.textLength])).toEqual([
      ["a", 0, "12.2"],
      ["́", 12.2, undefined],
      ["b", 12.2, "12.2"],
    ]);
  });

  it("puts each row's baseline 24.4 below the last, starting at 20", () => {
    expect(texts(svg([new Segment("a\n\nb\n")])).map((g) => g.y)).toEqual([20, 68.8]);
  });

  it("emits whitespace as selectable spaces, never as &#160;", () => {
    const document = svg([new Segment("a  b")]);
    expect(texts(document).map((g) => g.text)).toEqual(["a  b"]);
    expect(document).toContain('xml:space="preserve"');
    expect(document).not.toContain("&#160;");
  });

  it("sizes the window to the console width, and widens it for a longer row instead of clipping", () => {
    expect(svg([new Segment("ab")], 20)).toContain('width="260" height="72.4" rx="8"');
    expect(svg([new Segment("x".repeat(30))], 20)).toContain('width="382" height="72.4" rx="8"');
  });
});

describe("encodeSvg looks", () => {
  it("writes the resolved foreground into the run's class", () => {
    expect(styled("none")).toMatch(new RegExp(`\\.terminal-[0-9a-f]{8}-r1\\{fill:${INK.hex}\\}`));
    expect(styled("#12ab34")).toContain("{fill:#12ab34}");
  });

  it("gives each distinct look one class, shared by every run that has it", () => {
    const document = svg([new Segment("a", Style.parse("bold")), new Segment("b"), new Segment("c", Style.parse("bold"))]);
    expect(document.match(/-r\d+\{/g)).toHaveLength(2);
    expect(document.match(/<g class="terminal-[0-9a-f]+-r1">/g)).toHaveLength(2);
  });

  it("paints a background cell box only where one is painted, before any glyph", () => {
    expect(rects(styled("none"))).toEqual([]);
    const document = svg([new Segment("a"), new Segment("漢", Style.parse("on #ff0000"))]);
    expect(rects(document)).toEqual([
      'fill="#ff0000" x="12.2" y="1.5" width="24.4" height="24.65" shape-rendering="crispEdges"',
    ]);
    expect(document.indexOf('fill="#ff0000"')).toBeLessThan(document.indexOf("<text x="));
  });

  it("carries bold and italic as font properties of the class", () => {
    expect(styled("bold")).toContain(`{fill:${INK.hex};font-weight:bold}`);
    expect(styled("italic")).toContain(`{fill:${INK.hex};font-style:italic}`);
  });

  it("draws underlines, strike and overline as rectangles spanning the run's cells", () => {
    const at = (style: string) => decorations(styled(style, "ab")).map((r) => /y="([^"]*)"/.exec(r)![1]);
    expect(decorations(styled("none"))).toEqual([]);
    expect(at("underline")).toEqual(["22"]);
    expect(at("underline2")).toEqual(["22", "25"]);
    expect(at("strike")).toEqual(["14"]);
    expect(at("overline")).toEqual(["1.5"]);
    expect(decorations(styled("underline", "ab"))[0]).toBe('x="0" y="22" width="24.4" height="1.5"');
  });

  it("blinks the glyph and its lines together, slow at 1s and fast at 0.5s", () => {
    expect(styled("blink")).toMatch(/animation:terminal-[0-9a-f]+-blink 1s step-end infinite/);
    expect(styled("blink2")).toMatch(/animation:terminal-[0-9a-f]+-blink 0\.5s step-end infinite/);
    expect(styled("none")).not.toContain("animation:");
    expect(styled("none")).toMatch(
      /@media \(prefers-reduced-motion:no-preference\)\{@keyframes terminal-[0-9a-f]+-blink\{50%\{fill:transparent\}\}\}/,
    );
  });

  it("outlines a frame square and an encircle rounded, in the foreground colour", () => {
    expect(rects(styled("frame"))).toEqual([
      `x="0" y="1.5" width="12.2" height="24.65" rx="0" fill="none" stroke="${INK.hex}" stroke-width="1"`,
    ]);
    expect(rects(styled("encircle"))).toEqual([
      `x="0" y="1.5" width="12.2" height="24.65" rx="12.2" fill="none" stroke="${INK.hex}" stroke-width="1"`,
    ]);
  });

  it("wraps a linked run in an SVG 2 href, escaped", () => {
    const document = styled("link https://example.com/?a=1&b=2");
    expect(document).toMatch(/<a href="https:\/\/example\.com\/\?a=1&amp;b=2"><g class="[^"]+">.*<\/g><\/a>/);
    expect(document).not.toContain("xlink:href");
    expect(styled("link javascript:alert(1)")).not.toContain("<a ");
  });

  it("escapes glyphs and the title", () => {
    const document = encodeSvg([new Segment("<&>")], { title: 'a<b>&"', width: 10 });
    expect(texts(document).map((g) => g.text)).toEqual(["&lt;&amp;&gt;"]);
    expect(document).toContain('>a&lt;b&gt;&amp;"</text>');
  });
});

describe("encodeSvg chrome", () => {
  it("paints the window in the theme's canvas and titles it in the theme's ink", () => {
    const document = encodeSvg([new Segment("x")], { theme: SOLARIZED_LIGHT, title: "Rich", width: 10 });
    expect(document).toContain(`<rect fill="${SOLARIZED_LIGHT.backgroundColor.hex}" stroke="rgba(255,255,255,0.35)"`);
    expect(document).toMatch(new RegExp(`fill="${SOLARIZED_LIGHT.foregroundColor.hex}" text-anchor="middle"[^>]*>Rich</text>`));
  });

  it("falls back to the canvas export-lines resolves runs over", () => {
    const { background, foreground } = exportCanvas();
    const document = encodeSvg([new Segment("x")], { title: "Rich", width: 10 });
    expect(document).toContain(`<rect fill="${background.hex}" stroke=`);
    expect(document).toContain(`fill="${foreground.hex}" text-anchor="middle"`);
  });

  it("draws the three window buttons", () => {
    expect(styled("none")).toContain(
      '<g transform="translate(26,22)"><circle cx="0" cy="0" r="7" fill="#ff5f57"/>' +
        '<circle cx="22" cy="0" r="7" fill="#febc2e"/><circle cx="44" cy="0" r="7" fill="#28c840"/></g>',
    );
  });

  it("prefixes every class with a hash of what is drawn, so two exports inline without colliding", () => {
    const prefix = (document: string) => /class="(terminal-[0-9a-f]{8})-matrix"/.exec(document)![1];
    const a = encodeSvg([new Segment("x")], { title: "one", width: 10 });
    expect(prefix(a)).toBe(prefix(encodeSvg([new Segment("x")], { title: "one", width: 10 })));
    expect(prefix(a)).not.toBe(prefix(encodeSvg([new Segment("x")], { title: "two", width: 10 })));
    expect(prefix(a)).not.toBe(prefix(encodeSvg([new Segment("y")], { title: "one", width: 10 })));
  });
});

describe("Console.exportSvg", () => {
  const recording = () => {
    const c = new Console({ record: true, width: 20, file: { write: () => true } });
    c.print("[bold red]hello[/] 漢字 😀");
    return c;
  };

  it("exports the same bytes twice when the buffer is kept", () => {
    const c = recording();
    const first = c.exportSvg({ clear: false });
    expect(c.exportSvg({ clear: false })).toBe(first);
  });

  it("clears the recording by default, as exportText and exportHtml do", () => {
    const c = recording();
    expect(texts(c.exportSvg()).length).toBeGreaterThan(0);
    expect(texts(c.exportSvg())).toEqual([]);
  });

  it("titles the window Rich unless told otherwise, at the console's width", () => {
    const document = recording().exportSvg();
    expect(document).toMatch(/text-anchor="middle"[^>]*>Rich<\/text>/);
    expect(document).toContain('width="260"');
    expect(recording().exportSvg({ title: "Demo" })).toMatch(/>Demo<\/text>/);
  });

  it("draws in the theme it is given", () => {
    expect(recording().exportSvg({ theme: SOLARIZED_LIGHT })).toContain(
      `<rect fill="${SOLARIZED_LIGHT.backgroundColor.hex}"`,
    );
  });
});
