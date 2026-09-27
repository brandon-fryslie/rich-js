import { describe, it, expect } from "vitest";
import { AnsiDecoder, decodeAnsi } from "../../src/core/ansi.js";
import { ColorDepth, ColorRgba, ColorSpec, ColorTable, STANDARD_TABLE, TerminalTheme } from "../../src/core/color.js";
import { Console } from "../../src/core/console.js";
import { exportLines } from "../../src/core/export-lines.js";
import { renderToString } from "../../src/core/render.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import type { Segment } from "../../src/core/segment.js";
import { Table } from "../../src/renderables/table.js";
import { Palette } from "../../src/themes/palette.js";

// [LAW:behavior-not-structure] Bytes in, what the text looks like out: its
// plain string and the style at each character, never how the spans are cut.

/** The style in effect at one character: every span over it, later ones winning. */
function styleAt(text: RichText, index: number): Style {
  return Style.combine(
    text.spans
      .filter((span) => span.start <= index && index < span.end)
      .map((span) => (typeof span.style === "string" ? Style.parse(span.style) : span.style)),
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

  it("carries all three colour kinds through at their own depth", () => {
    const bytes = renderToString(sample, { colorSystem: ColorDepth.TRUECOLOR, width: 200 });
    expect(bytes).toContain("38;2;58;123;213");
    expect(bytes).toContain("38;5;200");
    expect(bytes).toContain("\x1b[31;1m");
  });
});

describe("decodeAnsi colours", () => {
  it("keeps a standard colour as the theme slot it names", () => {
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
        new Palette("probe", true, new Map()),
      );
    const segments = [...decodeAnsi("\x1b[31mred").render({ maxWidth: 80, isTerminal: false, encoding: "utf-8", asciiOnly: false })];
    const ink = (t: TerminalTheme) => exportLines(segments, t)[0]![0]!.look.foreground;
    expect(ink(theme(new ColorRgba(200, 0, 0)))).toEqual(new ColorRgba(200, 0, 0));
    expect(ink(theme(new ColorRgba(255, 90, 90)))).toEqual(new ColorRgba(255, 90, 90));
  });

  it("names no colour for an extended colour cut short, and spends what it read", () => {
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

  it("skips parameters that are not numbers", () => {
    const text = decodeAnsi("\x1b[1;38:5:3mx");
    expect(styleAt(text, 0).bold).toBe(true);
    expect(styleAt(text, 0).color).toBeUndefined();
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

  it("erases within the line from the cursor, up to it, or all of it", () => {
    expect(decodeAnsi("Downloading 100%\r\x1b[KDone").plain).toBe("Done");
    expect(decodeAnsi("Downloading\r\x1b[2KDone").plain).toBe("Done");
    expect(decodeAnsi("abcdef\rab\x1b[1K").plain).toBe("   def");
  });

  it("drops string escapes to their terminator, payload included", () => {
    expect(decodeAnsi("\x1b_Gf=100;AAAA\x1b\\hi\x1bPq#0;2\x1b\\!").plain).toBe("hi!");
  });

  it("spends an underline colour's arguments without applying them", () => {
    expect(decodeAnsi("\x1b[58;2;1;2;3mx").spans).toEqual([]);
    expect(decodeAnsi("\x1b[58;5;196;1mx").spans.length).toBe(1);
  });

  it("clears both underlines at 24 and both blinks at 25", () => {
    const text = decodeAnsi("\x1b[21;6ma\x1b[24;25mb");
    expect([styleAt(text, 1).underline2, styleAt(text, 1).blink2]).toEqual([false, false]);
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

    const cells = (segments: Segment[]) =>
      exportLines(segments).map((row) => row.flatMap((run) => [...run.text].map((ch) => ({ ch, look: run.look }))));
    const expected = cells(recording["_recorded"]);
    expect(expected.length).toBeGreaterThan(4);
    expect(cells(replay["_recorded"])).toEqual(expected);
  });
});
