import { describe, it, expect, vi, afterEach } from "vitest";
import { PassThrough, Writable } from "stream";
import { cellLen } from "../../src/core/cells.js";
import { ColorRgba, ColorSpec } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { renderToString } from "../../src/core/render.js";
import { Measurement } from "../../src/core/measure.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Effected, type CellColors, type Effect, type EffectCell } from "../../src/renderables/effect.js";
import { Group } from "../../src/renderables/group.js";
import { Panel } from "../../src/renderables/panel.js";
import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { Button } from "../../src/widgets/button.js";
import { WidgetApp } from "../../src/widgets/widget-app.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";

const THEME = DEFAULT_TERMINAL_THEME;
const DEFAULTS: CellColors = { fg: THEME.foregroundColor, bg: THEME.backgroundColor };
const RED = new ColorRgba(255, 0, 0);
const BLUE = new ColorRgba(0, 0, 255);

const identity: Effect = (colors) => colors;
/** A different foreground on every column: the effect that splits most. */
const perColumn: Effect = (colors, cell) => ({ fg: new ColorRgba((cell.col * 37) % 256, 0, 0), bg: colors.bg });

function effected(child: Renderable, effect: Effect, t = 0, key = "k"): Effected {
  return new Effected(child, effect, { t, key, theme: THEME });
}

/** A renderable yielding fixed segments, so nothing but the effect parses or builds a style. */
function fixed(...segments: Segment[]): Renderable {
  return { *render() { yield* segments; } };
}

const styled = new RichText("plain [bold red]hot[/] [on blue]cool[/] tail\nsecond line");

describe("Effected — the identity effect", () => {
  it("draws byte-identical output", () => {
    for (const colorSystem of ["truecolor", "256", "ansi", null] as const) {
      expect(renderToString(effected(styled, identity), { width: 30, colorSystem })).toBe(
        renderToString(styled, { width: 30, colorSystem }),
      );
    }
  });

  it("leaves an unstyled cell unstyled though it saw the default colours", () => {
    const seen: CellColors[] = [];
    const segments = [...effected(fixed(new Segment("ab")), (c) => (seen.push(c), c)).render({ maxWidth: 10 })];
    expect(seen).toEqual([DEFAULTS, DEFAULTS]);
    expect(segments).toHaveLength(1);
    expect(segments[0]!.style).toBeUndefined();
  });

  it("hands a cell the colours on screen: an ANSI colour from the theme, swapped under reverse", () => {
    const seen: CellColors[] = [];
    const record: Effect = (c) => (seen.push(c), c);
    const red = THEME.ansiColors.get(1);
    [...effected(fixed(new Segment("a", Style.parse("red")), new Segment("b", Style.parse("reverse red"))), record).render({ maxWidth: 10 })];
    expect(seen).toEqual([
      { fg: red, bg: THEME.backgroundColor },
      { fg: THEME.backgroundColor, bg: red },
    ]);
  });

  it("writes a reversed cell's new glyph colour into the slot the screen draws the glyph from", () => {
    const glyphBlue: Effect = (c) => ({ fg: BLUE, bg: c.bg });
    const [segment] = [...effected(fixed(new Segment("a", Style.parse("reverse red"))), glyphBlue).render({ maxWidth: 10 })];
    expect(segment!.style?.bgcolor?.getTruecolor()).toEqual(BLUE);
    expect(segment!.style?.color?.name).toBe("red");
  });
});

describe("Effected — segments are cut only where colours change", () => {
  it("keeps a segment whole when every cell gets the same new colours", () => {
    const flat: Effect = () => ({ fg: RED, bg: BLUE });
    const segments = [...effected(fixed(new Segment("abcdef", Style.parse("bold"))), flat).render({ maxWidth: 10 })];
    expect(segments.map((s) => s.text)).toEqual(["abcdef"]);
    expect(segments[0]!.style?.bold).toBe(true);
    expect(segments[0]!.style?.color?.value).toEqual(RED);
    expect(segments[0]!.style?.bgcolor?.value).toEqual(BLUE);
  });

  it("cuts per cell only for an effect that colours every cell differently", () => {
    const segments = [...effected(fixed(new Segment("abc")), perColumn).render({ maxWidth: 10 })];
    expect(segments.map((s) => s.text)).toEqual(["a", "b", "c"]);
  });

  it("never cuts a wide glyph, and counts it as the two cells it covers", () => {
    const cells: EffectCell[] = [];
    const effect: Effect = (colors, cell) => (cells.push(cell), perColumn(colors, cell, 0));
    const segments = [...effected(fixed(new Segment("a漢b")), effect).render({ maxWidth: 10 })];
    expect(cells.map((c) => c.col)).toEqual([0, 1, 3]);
    expect(segments.map((s) => s.text)).toEqual(["a", "漢", "b"]);
    expect(segments.map((s) => cellLen(s.text))).toEqual([1, 2, 1]);
  });
});

describe("Effected — positions and seeds", () => {
  it("counts rows and columns from the wrapped renderable's own top-left", () => {
    const cells: EffectCell[] = [];
    const record: Effect = (c, cell) => (cells.push(cell), c);
    [...effected(new RichText("ab\ncd"), record).render({ maxWidth: 10 })];
    expect(cells.map(({ row, col }) => [row, col])).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
  });

  it("gives a cell the same seed on every frame, in [0, 1), and another key other seeds", () => {
    const seeds = (key: string, t: number): number[] => {
      const out: number[] = [];
      [...effected(fixed(new Segment("abcd")), (c, cell) => (out.push(cell.seed), c), t, key).render({ maxWidth: 10 })];
      return out;
    };
    expect(seeds("strip", 0)).toEqual(seeds("strip", 12.5));
    for (const seed of seeds("strip", 0)) expect(seed >= 0 && seed < 1).toBe(true);
    expect(new Set(seeds("strip", 0)).size).toBe(4);
    expect(seeds("label", 0)).not.toEqual(seeds("strip", 0));
  });

  it("passes t through to the effect", () => {
    const times: number[] = [];
    [...effected(fixed(new Segment("a")), (c, _cell, t) => (times.push(t), c), 3.25).render({ maxWidth: 10 })];
    expect(times).toEqual([3.25]);
  });

  it("refuses a non-finite t", () => {
    expect(() => effected(fixed(), identity, Number.NaN)).toThrow(/finite t/);
  });
});

describe("Effected — composition", () => {
  it("nesting two effects draws what calling one after the other draws", () => {
    const warm: Effect = (c, cell) => ({ fg: new ColorRgba(255, (cell.col * 40) % 256, 0), bg: c.bg });
    const ground: Effect = (c, cell, t) => ({ fg: c.fg, bg: new ColorRgba(0, 0, (cell.row * 90 + t) % 256) });
    const both: Effect = (c, cell, t) => ground(warm(c, cell, t), cell, t);
    expect(renderToString(effected(effected(styled, warm, 7), ground, 7), { width: 30 })).toBe(
      renderToString(effected(styled, both, 7), { width: 30 }),
    );
  });
});

describe("Effected — what it may not change", () => {
  it("keeps every cell's anchor, link and meta", () => {
    const owner = {};
    const base = Style.null().withLink("https://example.com").add(Style.fromMeta({ id: 7 }));
    const lines = Segment.anchorLines([[new Segment("ab", base), new Segment("cd")]], owner);
    const child = fixed(...lines[0]!);
    const out = Segment.splitLines(effected(child, perColumn).render({ maxWidth: 10 }));
    for (let x = 0; x < 4; x++) expect(Segment.anchorAt(out, x, 0)).toEqual(Segment.anchorAt(lines, x, 0));
    expect(out[0]!.slice(0, 2).map((s) => [s.style?.link, s.style?.meta])).toEqual([
      ["https://example.com", { id: 7 }],
      ["https://example.com", { id: 7 }],
    ]);
  });

  it("passes the child through untouched when the output carries no colour", () => {
    const segments = [...styled.render({ maxWidth: 30, colorSystem: null })];
    expect([...effected(styled, perColumn).render({ maxWidth: 30, colorSystem: null })]).toEqual(segments);
  });

  it("measures as its child does", () => {
    const options: RenderOptions = { maxWidth: 40 };
    const panel = new Panel("measured");
    expect(Measurement.get(options, effected(panel, perColumn))).toEqual(Measurement.get(options, panel));
  });
});

describe("Effected — a thousand frames parse nothing", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds every new colour from its value, never from a string", () => {
    const colorParse = vi.spyOn(ColorSpec, "parse");
    const styleParse = vi.spyOn(Style, "parse");
    const child = fixed(new Segment("frame", new Style({ color: ColorSpec.fromRgba(RED) })));
    const moving: Effect = (c, cell, t) => ({ fg: new ColorRgba(t % 256, cell.col, Math.floor(t / 256)), bg: c.bg });
    for (let t = 0; t < 1000; t++) [...effected(child, moving, t).render({ maxWidth: 10 })];
    expect(colorParse).not.toHaveBeenCalled();
    expect(styleParse).not.toHaveBeenCalled();
  });
});

class CapturingStream extends Writable {
  isTTY = true;
  columns = 80;
  rows = 24;
  override _write(_chunk: unknown, _encoding: BufferEncoding, cb: (err?: Error | null) => void): void {
    cb();
  }
}

describe("Effected — widgets under an effect", () => {
  it("still take a click where they are drawn, and Tab still moves between them", async () => {
    const save = new Button({ label: "Save", id: "save" });
    const quit = new Button({ label: "Quit", id: "quit" });
    const stdin = new PassThrough();
    const host = new NodeTerminalHost({
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: new CapturingStream() as unknown as NodeJS.WriteStream,
      // A truecolour terminal, so the effect has colours to move.
      env: { COLORTERM: "truecolor", TERM: "xterm-256color" },
    });
    const view = effected(new Group(save, quit), perColumn);
    const app = new WidgetApp({ host, surface: "alternate", view: () => view });
    const submits: unknown[] = [];
    quit.onSubmit((w) => submits.push(w));
    void app.run();
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(app.focusManager.current).toBe(save);
      stdin.write(Buffer.from([0x09]));
      expect(app.focusManager.current).toBe(quit);

      const rows = app.frame.map((line) => line.map((s) => s.text).join(""));
      // Cut per cell by the effect, the frame still reads as it was drawn.
      expect(app.frame.some((line) => line.length > 3)).toBe(true);
      const y = rows.findIndex((row) => row.includes("Quit"));
      const x = rows[y]!.indexOf("Quit");
      stdin.write(`\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`);
      expect(submits).toEqual([quit]);
    } finally {
      app.stop();
    }
  });
});
