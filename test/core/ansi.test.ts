import { describe, it, expect } from "vitest";
import { AnsiDecoder, decodeAnsi } from "../../src/core/ansi.js";
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
      expect([tc.bold, tc.underline, tc.color!.value]).toEqual([true, true, new ColorRgba(1, 2, 3)]);
    }
    expect(styleAt(decodeAnsi("\x1b[48:5:200mx"), 0).bgcolor!.number).toBe(200);
  });

  it("reads 4:n as the underline a terminal draws, the curly kinds as plain underline", () => {
    for (const kind of [1, 3, 4, 5]) expect(styleAt(decodeAnsi(`\x1b[4:${kind}mx`), 0).underline).toBe(true);
    expect(styleAt(decodeAnsi("\x1b[4:2mx"), 0).doubleUnderline).toBe(true);
    const cleared = decodeAnsi("\x1b[4ma\x1b[4:0mb\x1b[21mc\x1b[4:0md");
    expect(styleAt(cleared, 1).underline).toBe(false);
    expect(styleAt(cleared, 3).doubleUnderline).toBe(false);
  });

  it("reads 4:n as the one underline kind, replacing the last", () => {
    const text = decodeAnsi("\x1b[4:2ma\x1b[4:1mb\x1b[4mc\x1b[4:2md");
    expect([styleAt(text, 1).underline, styleAt(text, 1).doubleUnderline]).toEqual([true, false]);
    expect([styleAt(text, 3).underline, styleAt(text, 3).doubleUnderline]).toEqual([false, true]);
  });

  it("reads the plain underline codes as one kind too", () => {
    const text = decodeAnsi("\x1b[21ma\x1b[4mb\x1b[21mc");
    expect([styleAt(text, 1).underline, styleAt(text, 1).doubleUnderline]).toEqual([true, false]);
    expect([styleAt(text, 2).underline, styleAt(text, 2).doubleUnderline]).toEqual([false, true]);
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
    expect([style.color, style.underline]).toEqual([undefined, true]);
  });

  it("lets no sub-parameter act as a code of its own", () => {
    const text = decodeAnsi("\x1b[58:2::1:3:4;9:1mx");
    expect(styleAt(text, 0).isNull).toBe(true);
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

  it("returns to the first column at a carriage return, and later text overwrites", () => {
    const text = decodeAnsi("10%\r\x1b[1m50%\r100%");
    expect(text.plain).toBe("100%");
    expect(styleAt(text, 0).bold).toBe(true);
    expect(decodeAnsi("Downloading\rDone").plain).toBe("Doneloading");
    expect(decodeAnsi("done\r").plain).toBe("done");
    expect(new AnsiDecoder().decodeLine("\x1b[32mok\r").plain).toBe("ok");
  });

  it("drops cursor movement, titles, charset designations and other escapes", () => {
    const text = decodeAnsi("\x1b[2K\x1b[1Aa\x1b]0;title\x07b\x1b(Bc\x1b7d\x1b[?25le\x1bcf\x1b)0g\x1b#8h\x1b%Gi");
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

  it("puts ASCII back in G0 and G1 at a full or soft reset, with the style", () => {
    expect(decodeAnsi("\x1b(0q\x1bcq").plain).toBe("─q");
    expect(decodeAnsi("\x1b)0\x0eq\x1b[!pq").plain).toBe("─q");
    const reset = decodeAnsi("\x1b[1ma\x1b[!pb");
    expect(reset.spans.map((span) => [span.start, span.end])).toEqual([[0, 1]]);
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
    // Vertical motion stays dropped.
    expect(decodeAnsi("ab\x1b[1Ac\x1b[2Bd\x1b[Ee").plain).toBe("abcde");
  });

  it("erases within the line from the cursor, up to it, or all of it", () => {
    expect(decodeAnsi("Downloading 100%\r\x1b[KDone").plain).toBe("Done");
    expect(decodeAnsi("Downloading\r\x1b[2KDone").plain).toBe("Done");
    expect(decodeAnsi("abcdef\rab\x1b[1K").plain).toBe("   def");
  });

  it("drops string escapes to their terminator, payload included", () => {
    expect(decodeAnsi("\x1b_Gf=100;AAAA\x1b\\hi\x1bPq#0;2\x1b\\!").plain).toBe("hi!");
  });

  it("spends an underline color's arguments without applying them", () => {
    expect(decodeAnsi("\x1b[58;2;1;2;3mx").spans).toEqual([]);
    expect(decodeAnsi("\x1b[58;5;196;1mx").spans.length).toBe(1);
  });

  it("clears both underlines at 24 and both blinks at 25", () => {
    const text = decodeAnsi("\x1b[21;6ma\x1b[24;25mb");
    expect([styleAt(text, 1).doubleUnderline, styleAt(text, 1).rapidBlink]).toEqual([false, false]);
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
