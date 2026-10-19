import { describe, expect, it } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { cellLen } from "../../src/core/cells.js";
import { ColorRgba } from "../../src/core/color.js";
import { Measurement } from "../../src/core/measure.js";
import type { Renderable } from "../../src/core/protocol.js";
import { renderToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Effected, type Effect, type EffectFrame } from "../../src/renderables/effect.js";
import { GlyphEffected, type GlyphCell, type GlyphEffect, type GlyphFrame } from "../../src/renderables/glyph-effect.js";
import { Panel } from "../../src/renderables/panel.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";

const identity: GlyphEffect = () => Animation.constant<GlyphFrame>((cell) => cell.glyph);
const blanked: GlyphEffect = () => Animation.constant<GlyphFrame>((cell) => " ".repeat(cellLen(cell.glyph)));

function glyphed(child: Renderable, effect: GlyphEffect, t = 0, key = "k"): GlyphEffected {
  return new GlyphEffected(child, effect, { t, key });
}

/** A renderable yielding fixed segments, so nothing but the effect builds a segment. */
function fixed(...segments: Segment[]): Renderable {
  return { *render() { yield* segments; } };
}

const styled = new RichText("plain hot cool 漢字\nsecond line", { style: "bold red on blue" });

describe("GlyphEffected — the identity effect", () => {
  it("draws byte-identical output at every depth, no colour included", () => {
    for (const colorSystem of ["truecolor", "256", "ansi", null] as const) {
      expect(renderToString(glyphed(styled, identity), { width: 30, colorSystem })).toBe(renderToString(styled, { width: 30, colorSystem }));
    }
  });

  it("yields each segment it left as the same segment, stamped with when the frame changes", () => {
    const segment = new Segment("ab", Style.parse("bold"));
    const out = [...glyphed(fixed(segment), identity).render({ maxWidth: 10 })];
    expect(out.map((s) => s.text)).toEqual(["ab"]);
    expect(out[0]!.style?.bold).toBe(true);
    expect(Segment.nextChange(out)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("GlyphEffected — what a glyph effect is handed", () => {
  it("hands every cell in reading order, blanks included and line breaks not, a wide glyph as one cell", () => {
    let seen: readonly GlyphCell[] = [];
    const watch: GlyphEffect = (drawn) => ((seen = drawn.cells), Animation.constant<GlyphFrame>((cell) => cell.glyph));
    [...glyphed(fixed(new Segment("a 漢"), new Segment("\n"), new Segment("b")), watch).render({ maxWidth: 10 })];
    expect(seen.map(({ glyph, row, col, index }) => [glyph, row, col, index])).toEqual([
      ["a", 0, 0, 0],
      [" ", 0, 1, 1],
      ["漢", 0, 2, 2],
      ["b", 1, 0, 3],
    ]);
  });

  it("says whether the output draws ASCII alone", () => {
    const asked: boolean[] = [];
    const watch: GlyphEffect = (drawn) => (asked.push(drawn.asciiOnly), identity(drawn));
    for (const asciiOnly of [false, true]) [...glyphed(fixed(new Segment("a")), watch).render({ maxWidth: 10, asciiOnly })];
    expect(asked).toEqual([false, true]);
  });

  it("seeds a cell by its key and position, the same on every frame", () => {
    const seeds = (key: string, t: number): number[] => {
      let seen: readonly GlyphCell[] = [];
      [...glyphed(fixed(new Segment("abc")), (drawn) => ((seen = drawn.cells), identity(drawn)), t, key).render({ maxWidth: 10 })];
      return seen.map((cell) => cell.seed);
    };
    expect(seeds("k", 0)).toEqual(seeds("k", 9));
    expect(seeds("k", 0)).not.toEqual(seeds("other", 0));
    for (const seed of seeds("k", 0)) expect(seed >= 0 && seed < 1).toBe(true);
  });
});

describe("GlyphEffected — what it may not change", () => {
  it("applies with no colour output", () => {
    expect(renderToString(glyphed(fixed(new Segment("ab", Style.parse("red"))), blanked), { width: 10, colorSystem: null })).toBe("  ");
  });

  it("blanks a wide glyph whole, so the line keeps its width", () => {
    const out = [...glyphed(fixed(new Segment("漢x")), () => Animation.constant<GlyphFrame>((cell) => (cell.glyph === "漢" ? "  " : cell.glyph))).render({ maxWidth: 10 })];
    expect(out.map((s) => s.text).join("")).toBe("  x");
  });

  it("refuses text of another width, a line break or a control character, naming the cell", () => {
    const turning = (to: string): GlyphEffect => () => Animation.constant<GlyphFrame>(() => to);
    for (const to of ["ab", "漢", "\n", "\t", "\x1b", ""]) {
      expect(() => [...glyphed(fixed(new Segment("a")), turning(to)).render({ maxWidth: 10 })]).toThrow(/at row 0, column 0/);
    }
  });

  it("refuses text that joins the cell beside it into one character, naming the cell", () => {
    // Alone, "😀\u200d" is two cells, as the emoji it replaces; beside the next emoji it is one cluster, and the line would shrink.
    const joining: GlyphEffect = () => Animation.constant<GlyphFrame>((cell) => (cell.col === 0 ? "😀\u200d" : cell.glyph));
    expect(() => [...glyphed(fixed(new Segment("😀😀x")), joining).render({ maxWidth: 10 })]).toThrow(/at row 0, column 0 .* joins the cell beside it/);
    // A leading combining mark is one cell wide alone, and draws on the glyph before it.
    const marking: GlyphEffect = () => Animation.constant<GlyphFrame>((cell) => (cell.col === 1 ? "\u0301x" : cell.glyph));
    expect(() => [...glyphed(fixed(new Segment("ab")), marking).render({ maxWidth: 10 })]).toThrow(/at row 0, column 1 .* joins the cell beside it/);
  });

  it("draws a child that splits one character across two segments, as the child drew it", () => {
    const split = fixed(new Segment("ab👨\u200d"), new Segment("👩cd"));
    const out = [...glyphed(split, blanked).render({ maxWidth: 20 })].map((s) => s.text).join("");
    expect(out).toBe(" ".repeat(8));
  });

  it("keeps every cell's anchor, link and meta", () => {
    const owner = {};
    const base = Style.null().withLink("https://example.com").add(Style.fromMeta({ id: 7 }));
    const lines = Segment.anchorLines([[new Segment("ab", base), new Segment("cd")]], owner);
    const out = Segment.splitLines(glyphed(fixed(...lines[0]!), () => Animation.constant<GlyphFrame>((cell) => cell.glyph.toUpperCase())).render({ maxWidth: 10 }));
    expect(out[0]!.map((s) => s.text).join("")).toBe("ABCD");
    for (let x = 0; x < 4; x++) expect(Segment.anchorAt(out, x, 0)).toEqual(Segment.anchorAt(lines, x, 0));
    expect([out[0]![0]!.style?.link, out[0]![0]!.style?.meta]).toEqual(["https://example.com", { id: 7 }]);
  });

  it("stamps the frame's next change under the child's, the sooner winning", () => {
    const later: GlyphEffect = () => ({ at: () => (cell) => cell.glyph, nextChange: () => 5, lastChange: () => 0 });
    const child = fixed(new Segment("a", new Style({ nextChange: 3 })), new Segment("b"));
    const out = [...glyphed(child, later).render({ maxWidth: 10 })];
    expect(out.map((s) => s.style?.nextChange)).toEqual([3, 5]);
  });

  it("measures as its child does, and holds it as its contents", () => {
    const panel = new Panel("measured");
    const wrapped = glyphed(panel, blanked);
    expect(Measurement.get({ maxWidth: 40 }, wrapped)).toEqual(Measurement.get({ maxWidth: 40 }, panel));
    expect([...wrapped.contents()]).toEqual([panel]);
  });

  it("needs a finite t", () => {
    expect(() => glyphed(styled, identity, Number.NaN)).toThrow(RangeError);
  });
});

describe("GlyphEffected — under a colour effect", () => {
  it("has its changed glyphs drawn in the colours the colour effect moves them to", () => {
    const red: Effect = () => Animation.constant<EffectFrame>((colors) => ({ fg: new ColorRgba(255, 0, 0), bg: colors.bg }));
    const upper: GlyphEffect = () => Animation.constant<GlyphFrame>((cell) => cell.glyph.toUpperCase());
    const both = new Effected(glyphed(fixed(new Segment("ab")), upper), red, { t: 0, key: "k", theme: DEFAULT_TERMINAL_THEME });
    expect(renderToString(both, { colorSystem: "truecolor" })).toBe(renderToString(fixed(new Segment("AB", Style.parse("#ff0000"))), { colorSystem: "truecolor" }));
  });
});
