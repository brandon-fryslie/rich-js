import { describe, it, expect } from "vitest";
import { exportLines, parseHref, resolveLook } from "../../src/core/export-lines.js";
import { ColorRgba, ColorTable, STANDARD_TABLE, TerminalTheme } from "../../src/core/color.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { Palette } from "../../src/themes/palette.js";

// [LAW:behavior-not-structure] These pin what a styled run looks like under a
// theme — the contract both exporters draw — not how the resolution is written.

const PAPER = new ColorRgba(16, 32, 48);
const INK = new ColorRgba(200, 210, 220);
const RETINTED_RED = new ColorRgba(250, 100, 90);

/** A theme whose every answer is distinguishable from the internal fallback's. */
const THEME = new TerminalTheme(
  PAPER,
  INK,
  new ColorTable([STANDARD_TABLE.get(0), RETINTED_RED, ...Array.from({ length: 14 }, (_, i) => STANDARD_TABLE.get(i + 2))]),
  new Palette("probe", true, new Map()),
);

const look = (markup: string) => resolveLook(Style.parse(markup), THEME);

describe("resolveLook colours", () => {
  it("resolves default ink through the theme and lets the canvas show through", () => {
    const l = look("none");
    expect(l.foreground).toEqual(INK);
    expect(l.background).toBe("canvas");
  });

  it("resolves ANSI colours through the theme's table, not a fixed one", () => {
    expect(look("red").foreground).toEqual(RETINTED_RED);
  });

  it("paints an explicit background, and leaves `on default` to the canvas", () => {
    expect(look("on #ff0000").background).toEqual(new ColorRgba(255, 0, 0));
    expect(look("on default").background).toBe("canvas");
  });

  it("reverse swaps ink and paper and always paints", () => {
    const plain = look("reverse");
    expect(plain.foreground).toEqual(PAPER);
    expect(plain.background).toEqual(INK);

    const coloured = look("reverse #112233 on #445566");
    expect(coloured.foreground).toEqual(new ColorRgba(0x44, 0x55, 0x66));
    expect(coloured.background).toEqual(new ColorRgba(0x11, 0x22, 0x33));
  });

  it("dim fades the glyph toward the background it ends up on", () => {
    expect(look("dim #ffffff on #000000").foreground).toEqual(new ColorRgba(153, 153, 153));
    // reversed: the glyph is the old paper, fading toward the old ink
    expect(look("dim reverse #000000 on #ffffff").foreground).toEqual(new ColorRgba(153, 153, 153));
  });

  it("conceal paints the glyph in its background", () => {
    expect(look("conceal red on #0000ff").foreground).toEqual(new ColorRgba(0, 0, 255));
    expect(look("conceal").foreground).toEqual(PAPER);
  });

  it("flattens alpha — paper over the canvas, ink over the paper — before reverse, dim and conceal", () => {
    // ink #ff000080 over paper #0000ff, then swapped: an opaque background
    expect(look("reverse #ff000080 on #0000ff").background).toEqual(new ColorRgba(128, 0, 127));
    // paper #0000ff80 over the theme canvas (16, 32, 48), and the glyph hidden in it
    const concealed = look("conceal on #0000ff80");
    expect(concealed.background).toEqual(new ColorRgba(8, 16, 152));
    expect(concealed.foreground).toEqual(new ColorRgba(8, 16, 152));
  });

  it("falls back to black canvas and white ink without a theme", () => {
    const l = resolveLook(Style.parse("reverse"));
    expect(l.foreground).toEqual(new ColorRgba(0, 0, 0));
    expect(l.background).toEqual(new ColorRgba(255, 255, 255));
  });
});

describe("resolveLook attributes", () => {
  it("carries every text attribute", () => {
    expect(look("bold italic strike overline")).toMatchObject({
      bold: true,
      italic: true,
      strike: true,
      overline: true,
    });
    expect(look("none")).toMatchObject({
      bold: false,
      italic: false,
      underline: "none",
      strike: false,
      overline: false,
      blink: "none",
      outline: "none",
      href: null,
    });
  });

  it("names the underline, blink and outline variants, the stronger one winning", () => {
    expect(look("underline").underline).toBe("single");
    expect(look("underline2").underline).toBe("double");
    expect(look("underline underline2").underline).toBe("double");
    expect(look("blink").blink).toBe("slow");
    expect(look("blink2").blink).toBe("fast");
    expect(look("frame").outline).toBe("frame");
    expect(look("frame encircle").outline).toBe("encircle");
  });

  it("links a web target and keeps the run when it refuses one", () => {
    expect(look("link https://example.com/a?b=1").href).toBe("https://example.com/a?b=1");
    const refused = look("bold link javascript:alert(1)");
    expect(refused.href).toBeNull();
    expect(refused.bold).toBe(true);
  });
});

describe("parseHref", () => {
  it("admits the linkable schemes in canonical form", () => {
    expect(parseHref("HTTPS://Example.com")).toBe("https://example.com/");
    expect(parseHref("mailto:a@b.c")).toBe("mailto:a@b.c");
    expect(parseHref("file:///tmp/x.txt")).toBe("file:///tmp/x.txt");
  });

  it("refuses script, data, relative and unparseable targets", () => {
    for (const link of ["javascript:alert(1)", "data:text/html,<b>", "vbscript:x", "/relative", "", "not a url"]) {
      expect(parseHref(link)).toBeNull();
    }
  });
});

describe("exportLines", () => {
  const texts = (segments: Segment[]) =>
    exportLines(segments, THEME).map((line) => line.map((run) => run.text));

  it("ends a row at each newline without a phantom row after the last", () => {
    expect(texts([new Segment("a\nb\n")])).toEqual([["a"], ["b"]]);
  });

  it("keeps blank rows and an unterminated last row", () => {
    expect(texts([new Segment("a\n\nb")])).toEqual([["a"], [], ["b"]]);
  });

  it("joins segments on one row and splits a segment across rows", () => {
    const bold = Style.parse("bold");
    const rows = exportLines([new Segment("x"), new Segment("y\nz", bold)], THEME);
    expect(rows.map((line) => line.map((run) => [run.text, run.look.bold]))).toEqual([
      [["x", false], ["y", true]],
      [["z", true]],
    ]);
  });

  it("has no rows for no output", () => {
    expect(texts([])).toEqual([]);
    expect(texts([new Segment("")])).toEqual([]);
  });
});
