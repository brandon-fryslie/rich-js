import { describe, it, expect } from "vitest";
import { AnsiDecoder, decodeAnsi, scanUndrawn } from "../../src/core/ansi.js";
import { ColorDepth, ColorRgba, ColorSpec, ColorTable, STANDARD_TABLE, TerminalTheme } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { exportLines } from "../../src/core/export-lines.js";
import { renderToString } from "../../src/core/render.js";
import { Style } from "../../src/core/style.js";
import { RichText, resolveStyle } from "../../src/core/text.js";
import type { Segment } from "../../src/core/segment.js";
import { Table } from "../../src/renderables/table.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";

// [LAW:behavior-not-structure] Bytes in, what the text looks like out: its
// plain string and the style at each character, never how the spans are cut.

/** The style in effect at one character: every span over it, later ones winning. */
function styleAt(text: RichText, index: number): Style {
  return Style.combine(
    text.spans
      .filter((span) => span.start <= index && index < span.end)
      .map((span) => resolveStyle({ maxWidth: 80 }, span.style)),
  );
}

describe("decodeAnsi round trip", () => {
  const url = "https://example.com/docs";
  const sample = new RichText();
  sample.append("plain ");
  sample.append("bold ", "bold");
  sample.append("red ", "bold red");
  sample.append("palette ", "italic color(200)");
  sample.append("true ", "underline #3a7bd5 on #102030");
  sample.append("link", new Style({ link: url, color: ColorSpec.parse("green") }));
  sample.append(" dim", "dim reverse strike on blue");
  sample.stylize("overline", 0, 11);

  for (const depth of [ColorDepth.TRUECOLOR, ColorDepth.EIGHT_BIT, ColorDepth.STANDARD]) {
    it(`re-renders byte-identically at ${ColorDepth[depth]}`, () => {
      const bytes = renderToString(sample, { colorSystem: depth, width: 200 });
      expect(bytes).toMatch(/\x1b\]8;/);
      expect(renderToString(decodeAnsi(bytes), { colorSystem: depth, width: 200 })).toBe(bytes);
    });
  }

  it("carries all three color kinds through at their own depth", () => {
    const bytes = renderToString(sample, { colorSystem: ColorDepth.TRUECOLOR, width: 200 });
    expect(bytes).toContain("38;2;58;123;213");
    expect(bytes).toContain("38;5;200");
    expect(bytes).toContain("\x1b[1;31m");
  });
});

describe("decodeAnsi colors", () => {
  it("keeps a standard color as the theme slot it names", () => {
    const color = styleAt(decodeAnsi("\x1b[31mx"), 0).color!;
    expect(color.type).toBe(ColorDepth.STANDARD);
    expect(color.number).toBe(1);
    expect(styleAt(decodeAnsi("\x1b[101mx"), 0).bgcolor!.number).toBe(9);
  });

  it("keeps a palette index and a truecolor as emitted", () => {
    const palette = styleAt(decodeAnsi("\x1b[38;5;200mx"), 0).color!;
    expect([palette.type, palette.number]).toEqual([ColorDepth.EIGHT_BIT, 200]);
    const tc = styleAt(decodeAnsi("\x1b[48;2;1;2;3mx"), 0).bgcolor!;
    expect([tc.type, tc.value]).toEqual([ColorDepth.TRUECOLOR, new ColorRgba(1, 2, 3)]);
  });

  it("exports one decoded run differently under two themes", () => {
    const theme = (red: ColorRgba) =>
      new TerminalTheme(
        new ColorRgba(0, 0, 0),
        new ColorRgba(255, 255, 255),
        new ColorTable([STANDARD_TABLE.get(0), red, ...Array.from({ length: 14 }, (_, i) => STANDARD_TABLE.get(i + 2))]),
        DEFAULT_TERMINAL_THEME.palette,
      );
    const segments = [...decodeAnsi("\x1b[31mred").render({ maxWidth: 80, isTerminal: false, asciiOnly: false })];
    const ink = (t: TerminalTheme) => exportLines(segments, t)[0]![0]!.look.foreground;
    expect(ink(theme(new ColorRgba(200, 0, 0)))).toEqual(new ColorRgba(200, 0, 0));
    expect(ink(theme(new ColorRgba(255, 90, 90)))).toEqual(new ColorRgba(255, 90, 90));
  });

  it("names no color for an extended color cut short, and spends what it read", () => {
    expect(styleAt(decodeAnsi("\x1b[38;5mx"), 0).isNull).toBe(true);
    expect(styleAt(decodeAnsi("\x1b[38;2;1;2mx"), 0).isNull).toBe(true);
    expect(styleAt(decodeAnsi("\x1b[38;9;1mx"), 0).bold).toBe(true);
  });
});

describe("decodeAnsi SGR parameters", () => {
  it("reads an empty parameter as reset and clamps above 255", () => {
    const text = decodeAnsi("\x1b[1ma\x1b[;3mb\x1b[38;2;300;0;0mc");
    expect(styleAt(text, 0).bold).toBe(true);
    expect(styleAt(text, 1).bold).toBeUndefined();
    expect(styleAt(text, 1).italic).toBe(true);
    expect(styleAt(text, 2).color!.value).toEqual(new ColorRgba(255, 0, 0));
  });

  it("reads a colon-form color with its arguments inside its own group", () => {
    const palette = styleAt(decodeAnsi("\x1b[1;38:5:200;3mx"), 0);
    expect([palette.bold, palette.italic, palette.color!.type, palette.color!.number]).toEqual([true, true, ColorDepth.EIGHT_BIT, 200]);
    for (const form of ["38:2::1:2:3", "38:2:0:1:2:3", "38:2:1:2:3"]) {
      const tc = styleAt(decodeAnsi(`\x1b[1;${form};4mx`), 0);
      expect([tc.bold, tc.underline, tc.color!.value]).toEqual([true, "single", new ColorRgba(1, 2, 3)]);
    }
    expect(styleAt(decodeAnsi("\x1b[48:5:200mx"), 0).bgcolor!.number).toBe(200);
  });

  it("reads 4:n as the underline kind it names, and 4:0 as none", () => {
    const kinds = [1, 2, 3, 4, 5].map((n) => styleAt(decodeAnsi(`\x1b[4:${n}mx`), 0).underline);
    expect(kinds).toEqual(["single", "double", "curly", "dotted", "dashed"]);
    const cleared = decodeAnsi("\x1b[4ma\x1b[4:0mb\x1b[21mc\x1b[4:0md");
    expect(styleAt(cleared, 1).underline).toBe(false);
    expect(styleAt(cleared, 3).underline).toBe(false);
  });

  it("skips a 4:n naming no kind", () => {
    expect(styleAt(decodeAnsi("\x1b[4:6mx"), 0).isNull).toBe(true);
  });

  it("reads 4:n as the one underline kind, replacing the last", () => {
    const text = decodeAnsi("\x1b[4:2ma\x1b[4:1mb\x1b[4mc\x1b[4:2md");
    expect([styleAt(text, 1).underline, styleAt(text, 3).underline]).toEqual(["single", "double"]);
  });

  it("reads the plain underline codes as one kind too", () => {
    const text = decodeAnsi("\x1b[21ma\x1b[4mb\x1b[21mc");
    expect([styleAt(text, 1).underline, styleAt(text, 2).underline]).toEqual(["single", "double"]);
  });

  it("tells the colour-space slot by the kind's value and trims empty trailing arguments", () => {
    expect(styleAt(decodeAnsi("\x1b[38:02::1:2:3mx"), 0).color!.value).toEqual(new ColorRgba(1, 2, 3));
    expect(styleAt(decodeAnsi("\x1b[38:2:1:2:3:mx"), 0).color!.value).toEqual(new ColorRgba(1, 2, 3));
  });

  it("names no color for a colon-form color cut short after an empty colour-space slot", () => {
    expect(styleAt(decodeAnsi("\x1b[38:2::1:2mx"), 0).isNull).toBe(true);
  });

  it("ends the ; arguments of 38 at a colon group", () => {
    const style = styleAt(decodeAnsi("\x1b[38;5;4:3mx"), 0);
    expect([style.color, style.underline]).toEqual([undefined, "curly"]);
  });

  it("lets no sub-parameter act as a code of its own", () => {
    const style = styleAt(decodeAnsi("\x1b[58:2::1:3:4;9:1mx"), 0);
    expect([style.underlineColor!.value, style.strike]).toEqual([new ColorRgba(1, 3, 4), undefined]);
  });

  it("turns attributes off with their 2x codes", () => {
    const text = decodeAnsi("\x1b[1;2;3mab\x1b[22;23mc");
    expect([styleAt(text, 0).bold, styleAt(text, 0).dim, styleAt(text, 0).italic]).toEqual([true, true, true]);
    expect([styleAt(text, 2).bold, styleAt(text, 2).dim, styleAt(text, 2).italic]).toEqual([false, false, false]);
  });
});

describe("decodeAnsi links", () => {
  it("links the text between an OSC 8 open and close, whatever terminates them", () => {
    const text = decodeAnsi("a \x1b]8;id=1;https://x.test\x07here\x1b]8;;\x9c b");
    expect(text.plain).toBe("a here b");
    expect(styleAt(text, 1).link).toBeUndefined();
    expect(styleAt(text, 2).link).toBe("https://x.test");
    expect(styleAt(text, 6).link).toBeUndefined();
  });

  it("draws what follows a CAN or SUB that aborts a link's open, as a terminal does", () => {
    for (const abort of ["\x18", "\x1a"]) {
      const text = decodeAnsi(`\x1b]8;;http://a${abort}visible\x07x`);
      expect(text.plain).toBe("visiblex");
      expect(styleAt(text, 0).link).toBeUndefined();
    }
  });

  it("drops a CSI or an escape a CAN or SUB aborts and draws what follows", () => {
    for (const abort of ["\x18", "\x1a"]) {
      expect(decodeAnsi(`\x1b[31${abort}mx`).plain).toBe("mx");
      expect(decodeAnsi(`\x9b31${abort}mx`).plain).toBe("mx");
      expect(decodeAnsi(`a\x1b(${abort}Bc`).plain).toBe("aBc");
      expect(decodeAnsi(`a\x1b${abort}Bc`).plain).toBe("aBc");
      expect(styleAt(decodeAnsi(`\x1b[31${abort}mx`), 1).color).toBeUndefined();
      expect(decodeAnsi(`\x1b]8;;http://a${abort}vis\x1b\\x`).plain).toBe("visx");
      expect(decodeAnsi(`\x9d8;;http://a${abort}vis\x9cx`).plain).toBe("visx");
    }
  });

  it("runs a C0 control inside a CSI or an escape and goes on with the sequence, as a VT500 parser does", () => {
    const red = decodeAnsi("\x1b[31\x07mx");
    expect(red.plain).toBe("x");
    expect(styleAt(red, 0).color?.number).toBe(1);
    expect(decodeAnsi("\x1b[31\x7fmx").plain).toBe("x");
    expect(decodeAnsi("ab\x1b[3\r1mc").plain).toBe("cb");
    expect(decodeAnsi("ab\x1b[1\bDc").plain).toBe("cb");
    for (const abort of ["\x18", "\x1a"]) {
      expect(decodeAnsi(`\x1b[31\x07${abort}mx`).plain).toBe("mx");
      expect(decodeAnsi(`a\x1b(\x07${abort}Bc`).plain).toBe("aBc");
      expect(decodeAnsi(`a\x1b\x01${abort}b`).plain).toBe("ab");
      expect(decodeAnsi(`\x1b[ 1${abort}x`).plain).toBe("x");
    }
    expect(decodeAnsi("a\x1b\x07Bc").plain).toBe("ac");
    expect(decodeAnsi("\x1b]0;t\x01i\x07x").plain).toBe("x");
    expect(new AnsiDecoder().decodeLine("\x1b[31\x07mx").plain).toBe("x");
    expect(new AnsiDecoder().decodeLine("ab\x1b[3\r\x18c").plain).toBe("cb");
    expect(decodeAnsi("a\x1b[3\x7fb").plain).toBe("aaaa");
  });

  it("runs a control inside an escape after the string escape that escape cuts off has ended", () => {
    expect(decodeAnsi("\x1b]8;;http://a\x1b\x07\\text").spans).toEqual([]);
    const red = decodeAnsi("a\x1b]0;t\x1b\x0c\x1b[31mb");
    expect(red.plain).toBe("a\nb");
    expect(styleAt(red, 2).color?.number).toBe(1);
  });

  it("reads a sequence a control interrupts as the sequence a terminal reads, wherever it is read", () => {
    // A line break spelled as a sequence still ends the line.
    expect(decodeAnsi("a\x1b\x07Eb").plain).toBe("a\nb");
    expect(decodeAnsi("a\x1b[\x072Eb").plain).toBe("a\nb");
    expect(scanUndrawn("a\x1b\x07Eb").undrawn).toBeNull();
    // An OSC 8 an interrupted ESC introduces opens a link.
    const link = decodeAnsi("\x1b\x07]8;;http://x\x1b\\link");
    expect(styleAt(link, 0).link).toBe("http://x");
    // A CSI an ESC or a C1 control cancels draws nothing.
    expect(decodeAnsi("x\x1b[31\x1bmy").plain).toBe("xy");
    expect(decodeAnsi("x\x1b[31\x84y").plain).toBe("xy");
  });

  it("runs a line break inside a sequence and finishes the sequence on the next line", () => {
    const red = decodeAnsi("\x1b[31\nmx");
    expect(red.plain).toBe("\nx");
    expect(styleAt(red, 1).color?.number).toBe(1);
    const after = decodeAnsi("a\x1b\x0c[31mb");
    expect(after.plain).toBe("a\nb");
    expect(styleAt(after, 2).color?.number).toBe(1);
    expect(decodeAnsi("\x1b\n[31\nmx").plain).toBe("\n\nx");
    expect(styleAt(decodeAnsi("\x1b\n[31\nmx"), 2).color?.number).toBe(1);
    // A VT inside a string escape's payload ends no line.
    expect(decodeAnsi("\x1b\n]0;a\x0bb\x07z").plain).toBe("\nz");
    // A tab ahead of the break moves the cursor on its own line, not the next.
    const bold = decodeAnsi("ab\x1b[\t\n1mc");
    expect(bold.plain).toBe("ab\t\nc");
    expect(styleAt(bold, 4).bold).toBe(true);
    // A final byte after the break completes the sequence there, as on a terminal.
    expect(decodeAnsi("ab\x1b[\r\ncd").plain).toBe("ab\nd");
  });

  it("keeps a link open across an SGR reset, as a terminal does", () => {
    const text = decodeAnsi("\x1b]8;;https://x.test\x1b\\\x1b[1mbold\x1b[0m plain\x1b]8;;\x1b\\");
    expect(styleAt(text, 0).bold).toBe(true);
    expect(styleAt(text, 6).bold).toBeUndefined();
    expect(styleAt(text, 6).link).toBe("https://x.test");
  });
});

describe("decodeAnsi lines and other escapes", () => {
  it("splits at newlines, and a final newline starts no line", () => {
    expect(new AnsiDecoder().decode("a\nb\n").map((t) => t.plain)).toEqual(["a", "b"]);
    expect(new AnsiDecoder().decode("a\r\n\nb").map((t) => t.plain)).toEqual(["a", "", "b"]);
    expect(new AnsiDecoder().decode("")).toEqual([]);
    expect(decodeAnsi("a\n\nb\n").plain).toBe("a\n\nb");
  });

  it("draws no byte of a finished CSI or escape, whatever its parameters, intermediates and final", () => {
    // The text around each sequence is drawn from letters outside ASCII, which
    // no sequence below holds, so a byte of one drawn as text is a byte outside
    // `é`, `ü`, the blanks an edit leaves and the break CNL or NEL makes. G0 goes back to
    // ASCII after each, since a designation changes the glyphs drawn after it.
    const finals = (from: number): string[] => Array.from({ length: 0x7f - from }, (_, at) => String.fromCharCode(from + at));
    const csis = ["\x1b[", "\x9b"].flatMap((introducer) =>
      ["", "1", "1;2", "?25", ">4:2", "38:2::1:2:3", " ", "1 ", " 1", "!"].flatMap((collected) => finals(0x40).map((final) => introducer + collected + final)),
    );
    const escapes = ["", "#", "(", ")", "(%", " "].flatMap((collected) =>
      finals(0x30).filter((final) => collected !== "" || !"[]P_^X".includes(final)).map((final) => `\x1b${collected}${final}`),
    );
    const drawn = [...csis, ...escapes].filter((sequence) => !/^[éü \n]*$/u.test(decodeAnsi(`éé${sequence}\x1b(Büü`).plain));
    expect(drawn).toEqual([]);
  });

  it("performs, and reports none of, every CSI and escape it decodes", () => {
    const performed = [
      "\x1b[1;31m", "\x1b[4:3m", "\x1b[2D", "\x9b3C", "\x1b[5G", "\x1b[I", "\x1b[Z", "\x1b[2X", "\x1b[P", "\x1b[3@",
      "\x1b[3b", "\x1b[K", "\x1b[2K", "\x1b[s", "\x1b[s\x1b[u", "\x1b7", "\x1b7\x1b8", "\x1b(0", "\x1b)B", "\x1b[!p",
      "\x1b[E", "\x1bE",
    ];
    expect(performed.filter((sequence) => scanUndrawn(`x${sequence}y`).undrawn !== null)).toEqual([]);
    expect(scanUndrawn("x\x1b[ 1my").undrawn).toBe("\x1b[ 1m");
  });

  it("runs a line feed inside a CSI or an escape, which goes on, and cuts a string escape's payload at one", () => {
    expect(decodeAnsi("abc\x1b[\nhello").plain).toBe("abc\nello");
    expect(scanUndrawn("abc\x1b[\nhello").undrawn).toBe("\x1b[h");
    expect(decodeAnsi("a\x1b]0;t\nb").plain).toBe("a\nb");
  });

  it("keeps an escape the bytes end inside on the line it began, across the breaks it ran", () => {
    expect(new AnsiDecoder().decode("foo\x1b\n").map((t) => t.plain)).toEqual(["foo"]);
    expect(new AnsiDecoder().decode("foo\x1b[31\n").map((t) => t.plain)).toEqual(["foo"]);
    expect(scanUndrawn("foo\x1b[31\n")).toMatchObject({ undrawn: null, unread: 3 });
  });

  it("ends a sequence undrawn at a byte above its grammar, which then draws", () => {
    expect(decodeAnsi("\x1b[31é").plain).toBe("é");
    expect(scanUndrawn("\x1b[31é").undrawn).toBe("\x1b[31");
  });

  it("returns to the first column at a carriage return, and later text overwrites", () => {
    const text = decodeAnsi("10%\r\x1b[1m50%\r100%");
    expect(text.plain).toBe("100%");
    expect(styleAt(text, 0).bold).toBe(true);
    expect(decodeAnsi("Downloading\rDone").plain).toBe("Doneloading");
    expect(decodeAnsi("done\r").plain).toBe("done");
    expect(new AnsiDecoder().decodeLine("\x1b[32mok\r").plain).toBe("ok");
  });

  it("drops cursor movement, titles and other escapes, and draws nothing for a designation", () => {
    const text = decodeAnsi("\x1b[2K\x1b[1Aa\x1b]0;title\x07b\x1b(Bc\x1b7d\x1b[?25lef\x1b)0g\x1b#8h\x1b%Gi");
    expect(text.plain).toBe("abcdefghi");
    expect(text.spans).toEqual([]);
  });

  it("draws DEC Special Graphics while G0 holds it, as a terminal does", () => {
    expect(decodeAnsi("\x1b(0qx\x1b(Bq").plain).toBe("─│q");
    expect(decodeAnsi("\x1b(0lqqk\x1b(B").plain).toBe("┌──┐");
    expect(decodeAnsi("\x1b(0`afgjkmnotuvwxyz{|}~_\x1b(B").plain).toBe("◆▒°±┘┐└┼⎺├┤┴┬│≤≥π≠£· ");
    // Outside the mapped range, and with its letters upper case, text is itself.
    expect(decodeAnsi("\x1b(0ABC 123\x1b(B").plain).toBe("ABC 123");
    // The set carries across lines and calls, as the SGR style does.
    expect(decodeAnsi("\x1b(0q\nq\x1b(B\nq").plain).toBe("─\n─\nq");
    const decoder = new AnsiDecoder();
    decoder.decode("\x1b(0");
    expect(decoder.decode("x")[0]!.plain).toBe("│");
    // The United Kingdom set draws # as £; any other set is ASCII.
    expect(decodeAnsi("\x1b(A#\x1b(B#").plain).toBe("£#");
    expect(decodeAnsi("\x1b(Kq").plain).toBe("q");
    // An overstruck character is drawn in the set too, overwritten rather than
    // emphasized: overstrike is nroff's, and nroff writes ASCII.
    const struck = decodeAnsi("\x1b(0x\bx_\bx");
    expect(struck.plain).toBe("││");
    expect(struck.spans).toEqual([]);
  });

  it("keeps overstrike's emphasis on a character the set leaves ASCII", () => {
    expect(decodeAnsi("\x1b(0A\bA").spans).not.toEqual([]);
    expect(decodeAnsi("\x1b(Ax\bx").spans).not.toEqual([]);
  });

  it("puts ASCII back in G0 and G1 at a soft reset, with the style, and keeps the link", () => {
    expect(decodeAnsi("\x1b)0\x0eq\x1b[!pq").plain).toBe("─q");
    const reset = decodeAnsi("\x1b[1ma\x1b[!pb");
    expect(reset.spans.map((span) => [span.start, span.end])).toEqual([[0, 1]]);
    const linked = decodeAnsi("\x1b]8;;http://x\x1b\\a\x1b[!pb\x1b]8;;\x1b\\");
    expect(styleAt(linked, 1).link).toBe("http://x");
  });

  it("clears the line and every state at a full reset, as a terminal clears its screen", () => {
    expect(decodeAnsi("\x1b(0q\x1bcq").plain).toBe("q");
    expect(decodeAnsi("\x1b(0qq\nq\x1bcq").plain).toBe("──\nq");
  });

  it("shifts G1 in at SO and G0 back at SI", () => {
    expect(decodeAnsi("\x1b)0a\x0eqqq\x0fq").plain).toBe("a───q");
    // SO with G1 unset draws ASCII, and shifting does not touch G0's designation.
    expect(decodeAnsi("\x0eq\x0f\x1b(0q").plain).toBe("q─");
  });

  it("erases, deletes and inserts cells at the cursor for ECH, DCH and ICH", () => {
    expect(decodeAnsi("abcdef\x1b[5G\x1b[2Xz").plain).toBe("abcdz");
    expect(decodeAnsi("abcdef\x1b[2G\x1b[2Xz").plain).toBe("az def");
    expect(decodeAnsi("abc\x1b[3D\x1b[3Xxy").plain).toBe("xy");
    expect(decodeAnsi("abcdef\x1b[2G\x1b[2P").plain).toBe("adef");
    expect(decodeAnsi("abcdef\x1b[2G\x1b[Pz").plain).toBe("azdef");
    expect(decodeAnsi("abc\x1b[2G\x1b[2@xy").plain).toBe("axybc");
    expect(decodeAnsi("abc\x1b[9@").plain).toBe("abc");
    // A wide character cut by an edit leaves a blank, as a draw there does.
    expect(decodeAnsi("日本\x1b[2G\x1b[P").plain).toBe(" 本");
    // What an insert pushes past the right margin is lost.
    expect(decodeAnsi("abcd\x1b[2G\x1b[2@", { width: 4 }).plain).toBe("a  b");
    expect(decodeAnsi(`ab\x1b[1G\x1b[${"9".repeat(400)}@`, { width: 4 }).plain).toBe("    ");
  });

  it("moves along the line for every move ECMA-48 names on it, as it does for a backspace", () => {
    expect(decodeAnsi("abc\x1b[2D\x1b[Kz").plain).toBe("az");
    expect(decodeAnsi("abc\x1b[Dz").plain).toBe("abz");
    expect(decodeAnsi("abc\x1b[0Dz").plain).toBe("abz");
    expect(decodeAnsi("ab\x1b[9Dz").plain).toBe("zb");
    expect(decodeAnsi("abcd\x1b[2Gz").plain).toBe("azcd");
    expect(decodeAnsi("abcd\x1b[Gz").plain).toBe("zbcd");
    expect(decodeAnsi("abcd\x1b[3`z").plain).toBe("abzd");
    expect(decodeAnsi("abcd\r\x1b[2Cz").plain).toBe("abzd");
    expect(decodeAnsi("ab\x1b[3Cz").plain).toBe("ab   z");
    expect(decodeAnsi("ab\x1b[2az").plain).toBe("ab  z");
    expect(decodeAnsi("ab\x1b[6Gz").plain).toBe("ab   z");
    expect(decodeAnsi("ab\x1b[3C").plain).toBe("ab");
    expect(decodeAnsi("\x9b2Cz").plain).toBe("  z");
    // A wide character half overwritten leaves a blank, as text drawn there does.
    expect(decodeAnsi("日本\x1b[2Gz").plain).toBe(" z本");
    // A move with further parameters reads its first, as a terminal does.
    expect(decodeAnsi("ab\x1b[2;5Gz").plain).toBe("az");
    expect(decodeAnsi("abc\x1b[1;Dz").plain).toBe("abz");
    // Back one cell, and by tab stops forward and back.
    expect(decodeAnsi("abc\x1b[jz").plain).toBe("abz");
    expect(decodeAnsi("abc\x1b[Iz").plain).toBe("abc     z");
    expect(decodeAnsi("abc\x1b[2Iz").plain).toBe(`abc${" ".repeat(13)}z`);
    expect(decodeAnsi("abcdefghij\x1b[Zz").plain).toBe("abcdefghzj");
    expect(decodeAnsi("abc\x1b[Zz").plain).toBe("zbc");
    // The gap a forward move leaves is unstyled, as a terminal leaves it.
    const gap = decodeAnsi("\x1b[44mab\x1b[3Cz");
    expect(styleAt(gap, 3).bgcolor).toBeUndefined();
    expect(styleAt(gap, 5).bgcolor).toEqual(styleAt(gap, 0).bgcolor);
    // A mark past the drawn end sits on the blank before it, as on a terminal.
    expect(decodeAnsi("a\x1b[Ć").plain).toBe("a ́");
    // A move forward stops at the right margin, so a short escape cannot pad a
    // line without end, and the right-edge idiom lands where a terminal puts it.
    expect(decodeAnsi(`\x1b[${"9".repeat(400)}Cz`).plain.length).toBe(80);
    expect(decodeAnsi("\x1b[4294967295Gz").plain.length).toBe(80);
    expect(decodeAnsi("ok\x1b[999C\x1b[3Ddone", { width: 20 }).plain).toBe(`ok${" ".repeat(14)}done`);
    expect(decodeAnsi("ab\x1b[Iz", { width: 4 }).plain).toBe("ab z");
    // A mark with nothing to sit on, moved away from, is gone.
    expect(decodeAnsi("́\x1b[3Cz").plain).toBe("   z");
    // The margin never turns a move around on a line already longer than it.
    const long = "x".repeat(12000);
    expect(decodeAnsi(`${long}\bz`).plain).toBe(`${"x".repeat(11999)}z`);
    expect(decodeAnsi(`${long}\x1b[Cz`).plain).toBe(`${long}z`);
    // Vertical motion stays dropped, CPL's upward move included.
    expect(decodeAnsi("ab\x1b[1Ac\x1b[2Bd\x1b[Fe").plain).toBe("abcde");
  });

  it("ends a line at CNL as at NEL, once whatever its count", () => {
    expect(decodeAnsi("a\x1b[Eb").plain).toBe("a\nb");
    expect(decodeAnsi("a\x9b0Eb").plain).toBe("a\nb");
    // No screen height is known, so a count invents no rows: `999E` is the
    // bottom-row idiom, and a terminal there moves no row at all.
    expect(decodeAnsi("a\x1b[3Eb").plain).toBe("a\nb");
    expect(decodeAnsi("status\x1b[999Edone").plain).toBe("status\ndone");
    // The style carries across, as across any line break.
    expect(decodeAnsi("\x1b[1ma\x1b[Eb").spans).toHaveLength(2);
  });

  it("draws REP as the preceding graphic character, count more times", () => {
    expect(decodeAnsi("a\x1b[3b").plain).toBe("aaaa");
    expect(decodeAnsi("a\x1b[bz\x9b0b").plain).toBe("aazz");
    expect(decodeAnsi("─\x1b[2b┐").plain).toBe("───┐");
    expect(decodeAnsi("字\x1b[2b").cellLength).toBe(6);
    expect(decodeAnsi("é\x1b[1b").plain).toBe("éé");
    const red = decodeAnsi("\x1b[31m-\x1b[4b\x1b[0m");
    expect(red.spans.map((span) => [span.start, span.end, String(span.style)])).toEqual([[0, 5, "color(1)"]]);
    // Overstrike's bold is the decoder's reading, so the repeats take the SGR style, as a terminal draws them.
    const struck = decodeAnsi("x\bx\x1b[2b");
    expect(struck.plain).toBe("xxx");
    expect(struck.spans.map((span) => [span.start, span.end, String(span.style)])).toEqual([[0, 1, "bold"]]);
  });

  it.each([
    ["at the start of a line", "\x1b[3b", ""],
    ["after an SGR", "a\x1b[1m\x1b[3b", "a"],
    ["after a move", "ab\x1b[D\x1b[3b", "ab"],
    ["after a dropped escape", "a\x1b[?25l\x1b[3b", "a"],
    ["after a tab", "a\t\x1b[3b", "a\t"],
    ["after a REP", "a\x1b[b\x1b[3b", "aa"],
  ])("repeats nothing %s, with no graphic character just before it", (_, ansi, plain) => {
    expect(decodeAnsi(ansi).plain).toBe(plain);
  });

  it("stops REP at the right margin, where a terminal would wrap", () => {
    for (const width of [Infinity, 0, 2.5, Number.NaN]) expect(() => new AnsiDecoder({ width })).toThrow(RangeError);
    expect(decodeAnsi("a\x1b[999999999b").cellLength).toBe(80);
    expect(decodeAnsi("字\x1b[99b", { width: 9 }).cellLength).toBe(8);
    expect(decodeAnsi("abcdef\x1b[5b", { width: 4 }).plain).toBe("abcdef");
  });

  it.each([
    ["DECSC and DECRC", "\x1b7", "\x1b8"],
    ["SCOSC and SCORC", "\x1b[s", "\x1b[u"],
    ["SCOSC and SCORC in C1", "\x9bs", "\x9bu"],
  ])("restores a column saved on the line, by %s", (_, save, restore) => {
    expect(decodeAnsi(`a${save}b${restore}c`).plain).toBe("ac");
    // `tput sc`, a status written, `tput rc`, and the line overwritten from the save.
    expect(decodeAnsi(`> ${save}working...${restore}done      `).plain).toBe("> done      ");
  });

  it("restores the style and the sets a save held, on any line", () => {
    const red = decodeAnsi("\x1b[31m\x1b7\x1b[0m\x1b8x");
    expect(red.spans.map((span) => String(span.style))).toEqual(["color(1)"]);
    expect(decodeAnsi("\x1b(0\x1b7\x1b(B\x1b8q").plain).toBe("─");
    expect(decodeAnsi("\x1b)0\x0e\x1b7\x0f\x1b8q").plain).toBe("─");
    // A later line: the rendition comes back, the column names a row gone by.
    expect(decodeAnsi("ab\x1b[1m\x1b7\x1b[0m\ncd\x1b8e").plain).toBe("ab\ncde");
    expect(String(decodeAnsi("ab\x1b[1m\x1b7\x1b[0m\ncd\x1b8e").spans.at(-1)!.style)).toBe("bold");
  });

  it("restores the default rendition, and no column, with nothing saved", () => {
    const text = decodeAnsi("ab\x1b[31m\x1b(0\x1b8q");
    expect(text.plain).toBe("abq");
    expect(text.spans).toEqual([]);
  });

  it.each([
    ["a soft reset, DECSTR", "\x1b[!p"],
    ["a full reset, RIS", "\x1bc"],
  ])("forgets a save at %s", (_, reset) => {
    const text = decodeAnsi(`a\x1b[1m\x1b7${reset}b\x1b8c`);
    expect(text.plain.endsWith("bc")).toBe(true);
    expect(text.spans).toEqual([]);
  });

  it("leaves margins and kitty's keyboard protocol, which share a save's and a restore's finals, dropped", () => {
    expect(decodeAnsi("a\x1b[1;5sb\x1b[uc").plain).toBe("abc");
    expect(decodeAnsi("a\x1b[sb\x1b[?uc\x1b[>1uc\x1b[97uc").plain).toBe("abccc");
    // DECALN carries an intermediate; it is no restore.
    expect(decodeAnsi("a\x1b7b\x1b#8c").plain).toBe("abc");
  });

  it("erases within the line from the cursor, up to it, or all of it", () => {
    expect(decodeAnsi("Downloading 100%\r\x1b[KDone").plain).toBe("Done");
    expect(decodeAnsi("Downloading\r\x1b[2KDone").plain).toBe("Done");
    expect(decodeAnsi("abcdef\rab\x1b[1K").plain).toBe("   def");
  });

  it("drops string escapes to their terminator, payload included", () => {
    expect(decodeAnsi("\x1b_Gf=100;AAAA\x1b\\hi\x1bPq#0;2\x1b\\!").plain).toBe("hi!");
  });

  it("reads an underline color with its arguments, and 59 as the glyph's again", () => {
    const text = decodeAnsi("\x1b[58;2;1;2;3ma\x1b[58;5;196;1mb\x1b[59mc");
    expect(styleAt(text, 0).underlineColor!.value).toEqual(new ColorRgba(1, 2, 3));
    expect([styleAt(text, 1).underlineColor!.number, styleAt(text, 1).bold]).toEqual([196, true]);
    expect(styleAt(text, 2).underlineColor!.isDefault).toBe(true);
  });

  it("round-trips every underline kind and its color through the encoder", () => {
    for (const kind of ["single", "double", "curly", "dotted", "dashed"] as const) {
      const style = new Style({ underline: kind, underlineColor: "#102030" });
      expect(styleAt(decodeAnsi(`\x1b[${style.toSgrCodes(ColorDepth.TRUECOLOR)}mx`), 0).equals(style)).toBe(true);
    }
  });

  it("clears the underline at 24 and both blinks at 25", () => {
    const text = decodeAnsi("\x1b[21;6ma\x1b[24;25mb");
    expect([styleAt(text, 1).underline, styleAt(text, 1).rapidBlink]).toEqual([false, false]);
  });

  it("drops a string escape whose payload holds a stray ESC", () => {
    expect(decodeAnsi("\x1b]0;bad\x1bXtitle\x07after").plain).toBe("after");
  });

  it("gives one span to one style split by an escape that changes nothing", () => {
    expect(decodeAnsi("\x1b[1mab\x1b[Kcd\x1b[1mef").spans.length).toBe(1);
  });

  it("drops an OSC the line cuts off", () => {
    expect(decodeAnsi("a\x1b]0;title").plain).toBe("a");
  });

  it("reads a CSI with a private marker as no SGR", () => {
    const text = decodeAnsi("\x1b[>4;2mhello");
    expect(text.plain).toBe("hello");
    expect(text.spans).toEqual([]);
  });

  it("carries the style across lines and across calls", () => {
    const decoder = new AnsiDecoder();
    const [first, second] = decoder.decode("\x1b[1ma\nb");
    const third = decoder.decodeLine("c\x1b[0md");
    expect([styleAt(first!, 0).bold, styleAt(second!, 0).bold, styleAt(third, 0).bold]).toEqual([true, true, true]);
    expect(styleAt(third, 1).bold).toBeUndefined();
  });

  it("describes the result with the options it is given", () => {
    const text = decodeAnsi("x", { justify: "right", end: "" });
    expect(text.justify).toBe("right");
    expect(text.end).toBe("");
  });
});

describe("decodeAnsi on a captured print", () => {
  it("draws the same cells as recording the print", () => {
    const table = new Table({ title: "Planets" });
    table.addColumn("Name", { style: "bold magenta" });
    table.addColumn("Moons", { justify: "right" });
    table.addRow("[link=https://en.wikipedia.org/wiki/Earth]Earth[/link]", "[#3a7bd5]1[/]");
    table.addRow("Mars", "[color(208)]2[/]");

    const chunks: string[] = [];
    const recording = new Console({
      file: { write: (chunk) => chunks.push(String(chunk)) },
      width: 40,
      colorSystem: "truecolor",
      record: true,
    });
    recording.print(table);

    const replay = new Console({ file: { write: () => undefined }, width: 40, colorSystem: "truecolor", record: true });
    replay.print(decodeAnsi(chunks.join("")));

    const cells = (segments: readonly Segment[]) =>
      exportLines(segments).map((row) => row.flatMap((run) => [...run.text].map((ch) => ({ ch, look: run.look }))));
    const expected = cells(recording["_recorded"].get());
    expect(expected.length).toBeGreaterThan(4);
    expect(cells(replay["_recorded"].get())).toEqual(expected);
  });
});
