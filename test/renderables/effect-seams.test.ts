/*
 * A strip's seams under an effect: every join cell is resolved again from the
 * item cells beside it as the effect left them, through the path the joiner
 * drew it by, lift included — never painted by the effect itself.
 */
import { describe, it, expect } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { drawnBy } from "../../src/core/anchor.js";
import { ColorDepth, ColorRgba, ColorSpec, TerminalTheme, blendRgb } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { renderToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { CAPS, CellJoiner, JOIN, JOINERS, Strip, gradientSeam, joinedCell } from "../../src/core/strip.js";
import type { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Effected, confined, type Effect, type EffectFrame } from "../../src/renderables/effect.js";
import { FlexStrip } from "../../src/renderables/flexStrip.js";
import * as TERMINAL_THEMES from "../../src/themes/terminalThemes.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/themes/terminalThemes.js";
import { standsOffAsDrawn } from "../core/stands-off.js";
import { inFrame } from "./in-frame.js";

const THEME = DEFAULT_TERMINAL_THEME;
const DEPTHS = { truecolor: ColorDepth.TRUECOLOR, "256": ColorDepth.EIGHT_BIT, ansi: ColorDepth.STANDARD } as const;

const item = (label: string, style: string): RichText => new RichText(` ${label} `, { style, end: "", noWrap: true });
/** Three items whose fills stand well apart, so no seam between them lifts at rest. */
const trio = (): RichText[] => [item("a", "#e0e0e0 on #1d4ed8"), item("b", "#1a1a1a on #f0f0f0"), item("c", "#e0e0e0 on #b91c1c")];

function effected(child: Renderable, effect: Effect, t = 0): Renderable {
  return inFrame(new Effected(child, effect, { key: "seams", theme: THEME }), t);
}

/** An effect that paints every cell it is handed `fill`, lettered in `text`. */
const paint = (fill: ColorRgba, text: ColorRgba): Effect => () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: text, bg: fill }));

const drawn = (renderable: Renderable, colorSystem: ColorDepth = ColorDepth.TRUECOLOR, maxWidth = 80): Segment[] => [...renderable.render({ maxWidth, colorSystem })];

/** A join cell's two colours as truecolor draws them, by hex. */
const hexes = (style: Style | undefined): [string, string] => {
  const { color, bgcolor } = style!.drawnColors(ColorDepth.TRUECOLOR);
  return [color!.getTruecolor(THEME, true).hex, bgcolor!.getTruecolor(THEME, false).hex];
};

/** The cells of `segments` a joiner drew between `left` and `right`: its seam, caps left out. */
const seamOf = (segments: readonly Segment[], left: object, right: object): Segment[] =>
  segments.filter((s) => {
    const joined = joinedCell(s.style?.anchor);
    return joined !== undefined && joined.reads.left?.owner === left && joined.reads.right?.owner === right;
  });

describe("an effect that paints two neighbours one colour", () => {
  const FILLS = ["#303030", "#336699", "#000000", "#fafafa", "#c0392b"] as const;
  const TEXT = ColorSpec.parse("#e0e0e0").value!;
  const CASES = (Object.keys(JOINERS) as (keyof typeof JOINERS)[]).flatMap((name) => Object.entries(DEPTHS).map(([depth, colorSystem]) => [name, depth, colorSystem] as const));

  it.each(CASES)("leaves every cell %s draws at %s with its ink standing off its ground", (name, _, colorSystem) => {
    const failures: string[] = [];
    for (const fill of FILLS) {
      const items = trio();
      const filled = confined(paint(ColorSpec.parse(fill).value!, TEXT), items[0]!, items[1]!);
      for (const [at, { style }] of drawn(effected(new Strip(items, JOINERS[name]), filled), colorSystem).entries()) {
        // A cell on the terminal's ground, or reversed out of it, has a side nobody knows.
        const measured = drawnBy(style?.anchor, JOIN) && style !== undefined && !style.reverse && style.color !== undefined && style.bgcolor !== undefined;
        if (measured && !standsOffAsDrawn(style, colorSystem)) failures.push(`${fill}: segment ${at} ${style.toString()}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("reaches the seam between them: the arrow is drawn on the fill, its ink lifted off it", () => {
    for (const fill of FILLS) {
      const items = trio();
      const ground = ColorSpec.parse(fill).value!;
      const confinedTo = drawn(effected(new Strip(items, JOINERS.powerline), confined(paint(ground, TEXT), items[0]!, items[1]!)));
      const whole = drawn(effected(new Strip(items, JOINERS.powerline), paint(ground, TEXT)));
      for (const frame of [confinedTo, whole]) {
        const [arrow] = seamOf(frame, items[0]!, items[1]!);
        expect(hexes(arrow!.style)[1]).toBe(fill);
        expect(standsOffAsDrawn(arrow!.style!)).toBe(true);
      }
    }
  });
});

describe("a seam under an effect drawn on a terminal of its own", () => {
  // Every bundled terminal but two draws its sixteen colours far from the
  // ones a depth rounds a fixed colour against, so a slot read back as its RGB
  // through either set lands on another slot.
  const THEMES = Object.entries(TERMINAL_THEMES).filter((entry): entry is [string, TerminalTheme] => entry[1] instanceof TerminalTheme);
  const CASES = THEMES.flatMap(([name, theme]) => (["256", "ansi"] as const).map((depth) => [name, depth, theme] as const));
  /** A written colour as the identity the depth writes: a slot by its number, any other by its name. */
  const written = (spec: ColorSpec | undefined): string => `${spec?.type}:${spec?.number ?? spec?.name}`;

  it.each(CASES)("under %s at %s, draws each seam in the slots its neighbours are written in, lifted only where they share one", (_, depth, theme) => {
    const colorSystem = DEPTHS[depth];
    const failures: string[] = [];
    for (let l = 1; l <= 6; l++) {
      for (let r = 1; r <= 6; r++) {
        const [a, b] = [item("a", "#e0e0e0 on #1d4ed8"), item("c", "#e0e0e0 on #b91c1c")];
        const slots: Effect = () => Animation.constant<EffectFrame>((look, cell) => ({ ...look, bg: theme.ansiColors.get(drawnBy(cell.anchor, a) ? l : r) }));
        const frame = [...inFrame(new Effected(new Strip([a, b], JOINERS.powerline), confined(slots, a, b), { key: "slots", theme }), 0).render({ maxWidth: 80, colorSystem })];
        const ground = (owner: object): ColorSpec | undefined => frame.find((s) => drawnBy(s.style?.anchor, owner))!.style!.drawnColors(colorSystem).bgcolor;
        const [arrow] = seamOf(frame, a, b);
        const { color: ink, bgcolor: under } = arrow!.style!.drawnColors(colorSystem);
        const [left, right] = [ground(a), ground(b)];
        expect([left?.number, right?.number].every((n) => n !== undefined)).toBe(true);
        const shared = written(left) === written(right);
        const ok = written(under) === written(right) && (shared ? standsOffAsDrawn(arrow!.style!, colorSystem) : written(ink) === written(left));
        if (!ok) failures.push(`${l}|${r}: ${written(left)} | ${written(ink)} on ${written(under)} | ${written(right)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it.each(CASES)("under %s at %s, never writes a lifted ink in its ground's slot, though the terminal draws two slots alike", (_, depth, theme) => {
    const colorSystem = DEPTHS[depth];
    const failures: string[] = [];
    for (let n = 0; n < 16; n++) {
      const [a, b] = [item("a", "#e0e0e0 on #1d4ed8"), item("c", "#e0e0e0 on #b91c1c")];
      const slot: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: theme.ansiColors.get(n) }));
      const frame = [...inFrame(new Effected(new Strip([a, b], JOINERS.powerline), confined(slot, a, b), { key: "slots", theme }), 0).render({ maxWidth: 80, colorSystem })];
      const right = frame.find((s) => drawnBy(s.style?.anchor, b))!.style!.drawnColors(colorSystem).bgcolor;
      const { color: ink, bgcolor: under } = seamOf(frame, a, b)[0]!.style!.drawnColors(colorSystem);
      if (written(ink) === written(under) || written(under) !== written(right)) failures.push(`${n}: ${written(ink)} on ${written(under)} | ${written(right)}`);
    }
    expect(failures).toEqual([]);
  });

  // Terminals whose sixteen sit far from the ones a depth rounds against, or
  // that draw two slots alike, or whose own text is a blend of two of them,
  // beside the default one.
  const SOME = ["DEFAULT_TERMINAL_THEME", "NORD", "GRUVBOX", "ATOM_ONE_DARK", "CATPPUCCIN_MOCHA", "TEXTUAL_DARK"].map((name) => [name, THEMES.find(([n]) => n === name)![1]] as const);
  const JOINER_CASES = (Object.keys(JOINERS) as (keyof typeof JOINERS)[]).flatMap((name) => (["256", "ansi"] as const).map((depth) => [name, depth] as const));

  it.each(JOINER_CASES)("writes every cell %s draws at %s with its ink standing off its ground, between any two of a terminal's colours", (name, depth) => {
    const colorSystem = DEPTHS[depth];
    const failures: string[] = [];
    for (const [themeName, theme] of SOME) {
      for (let l = 0; l < 16; l++) {
        for (let r = 0; r < 16; r++) {
          const [a, b] = [item("a", "#e0e0e0 on #1d4ed8"), item("c", "#e0e0e0 on #b91c1c")];
          const slots: Effect = () => Animation.constant<EffectFrame>((look, cell) => ({ ...look, bg: theme.ansiColors.get(drawnBy(cell.anchor, a) ? l : r) }));
          for (const { style } of inFrame(new Effected(new Strip([a, b], JOINERS[name]), confined(slots, a, b), { key: "slots", theme }), 0).render({ maxWidth: 80, colorSystem })) {
            // A cell on the terminal's ground, or reversed out of it, has a side nobody knows.
            const measured = joinedCell(style?.anchor)?.follows === true && style !== undefined && !style.reverse && style.color !== undefined && style.bgcolor !== undefined;
            if (measured && !standsOffAsDrawn(style, colorSystem)) failures.push(`${themeName} ${l}|${r}: ${style.toString()}`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("prism under an effect on one neighbour", () => {
  const A = "#1e66f5";
  const left = (): RichText => item("a", `#e0e0e0 on ${A}`);
  const right = (): RichText => item("b", "#e0e0e0 on #d20f39");
  const shade = (t: number): ColorRgba => new ColorRgba(40 + 100 * t, 160, 60);
  const breathing: Effect = () => Animation.continuous((t) => (look) => ({ ...look, bg: shade(t) }));

  it("moves its inner thirds with the effected ground, frame to frame as its arrows", () => {
    const [a, b] = [left(), right()];
    const at = (t: number): [string, string][] => seamOf(drawn(effected(new Strip([a, b], JOINERS.prism), confined(breathing, b), t)), a, b).map((s) => hexes(s.style));
    const thirds = (t: number): [string, string][] => {
      const [from, to] = [ColorSpec.parse(A).value!, shade(t)];
      const [one, two] = [blendRgb(from, to, 1 / 3).hex, blendRgb(from, to, 2 / 3).hex];
      return [
        [A, one],
        [one, two],
        [two, to.hex],
      ];
    };
    expect(at(0)).toEqual(thirds(0));
    expect(at(1)).toEqual(thirds(1));
    // Every colour of the seam the moved ground reaches changes between the frames; the ink out of the still neighbour does not.
    expect(at(0).flat().map((hex, i) => hex !== at(1).flat()[i])).toEqual([false, true, true, true, true, true]);
  });
});

describe("gradientSeam under an effect", () => {
  const A = "#1e66f5";
  const shade = (t: number): ColorRgba => new ColorRgba(40 + 100 * t, 160, 60);
  const breathing: Effect = () => Animation.continuous((t) => (look) => ({ ...look, bg: shade(t) }));
  const ramp = new CellJoiner(gradientSeam(4), CAPS.flat);
  // A ramp cell is a space reversed out of the terminal's ground, so its one colour is its style's `color`.
  const fills = (segments: readonly Segment[], left: object, right: object): string[] =>
    seamOf(segments, left, right).map(({ style }) => {
      expect(style!.reverse).toBe(true);
      return style!.drawnColors(ColorDepth.TRUECOLOR).color!.getTruecolor(THEME, false).hex;
    });

  it("draws every cell as the blend of the grounds the effect left beside it, frame to frame", () => {
    const [a, b] = [item("a", `#e0e0e0 on ${A}`), item("b", "#e0e0e0 on #d20f39")];
    const at = (t: number): string[] => fills(drawn(effected(new Strip([a, b], ramp), confined(breathing, b), t)), a, b);
    const blends = (t: number): string[] => [1, 3, 5, 7].map((k) => blendRgb(ColorSpec.parse(A).value!, shade(t), k / 8).hex);
    expect(at(0)).toEqual(blends(0));
    expect(at(1)).toEqual(blends(1));
  });

  it("is the one colour an effect paints both its neighbours, a fill with nothing to lift", () => {
    const items = trio();
    const ground = new ColorRgba(48, 48, 48);
    const frame = drawn(effected(new Strip(items, ramp), confined(paint(ground, ColorSpec.parse("#e0e0e0").value!), items[0]!, items[1]!)));
    expect(fills(frame, items[0]!, items[1]!)).toEqual(Array.from({ length: 4 }, () => ground.hex));
  });
});

describe("where a seam finds the cells beside it", () => {
  const BLUE = new ColorRgba(0, 0, 255);
  const RED = new ColorRgba(255, 0, 0);
  const repaint = (bg: ColorRgba): Effect => () => Animation.constant<EffectFrame>((look) => ({ ...look, bg }));

  it("reads its neighbours by who drew them, past a gap a FlexStrip sets between them", () => {
    const [a, b] = [trio()[0]!, trio()[2]!];
    const flex = new FlexStrip([a, b], { joiner: JOINERS.powerline, gap: 1 });
    const [arrow] = seamOf(drawn(effected(flex, confined(repaint(BLUE), b))), a, b);
    expect(hexes(arrow!.style)).toEqual(["#1d4ed8", BLUE.hex]);
  });

  it("has the effect paint a neighbour the frame does not draw where the seam shows it", () => {
    const [a, b] = [trio()[0]!, trio()[2]!];
    // lead, " a ", the arrow — and " c " and the tail cut off by a narrower container
    const cut: Renderable = { render: (options: RenderOptions) => Segment.adjustLineLength(Segment.splitLines(new Strip([a, b], JOINERS.powerline).render(options))[0]!, 5, undefined, false) };
    const arrowOf = (frame: Segment[]) => seamOf(frame, a, b)[0]!.style;
    // Confined to the items, the seam is no owner's, so the side the frame cuts off stays as drawn.
    expect(hexes(arrowOf(drawn(effected(cut, confined(repaint(BLUE), a)))))).toEqual([BLUE.hex, "#b91c1c"]);
    expect(renderToString(effected(cut, confined(repaint(BLUE), b)), { colorSystem: "truecolor" })).toBe(renderToString(cut, { colorSystem: "truecolor" }));
    // Over the whole element, it is painted as the effect paints everything there, and the seam's ink is lifted off the one fill.
    const whole = arrowOf(drawn(effected(cut, repaint(BLUE))));
    expect(hexes(whole)[1]).toBe(BLUE.hex);
    expect(standsOffAsDrawn(whole!)).toBe(true);
  });

  it("lifts a seam at the depth the effect writes, whatever depth its strip was drawn at", () => {
    const items = trio();
    // Drawn once at truecolor, then held and drawn again under an effect at 256 colours.
    const held = [...new Strip(items, JOINERS.powerline).render({ maxWidth: 80, colorSystem: ColorDepth.TRUECOLOR })];
    const replay: Renderable = { render: () => held };
    const frame = drawn(effected(replay, confined(paint(new ColorRgba(60, 60, 60), new ColorRgba(224, 224, 224)), items[0]!, items[1]!)), ColorDepth.EIGHT_BIT);
    expect(standsOffAsDrawn(seamOf(frame, items[0]!, items[1]!)[0]!.style!, ColorDepth.EIGHT_BIT)).toBe(true);
  });

  it("moves on from the edges an effect inside another left it at", () => {
    const [a, b] = [trio()[0]!, trio()[2]!];
    const inner = new Effected(new Strip([a, b], JOINERS.powerline), confined(repaint(BLUE), b), { key: "inner", theme: THEME });
    const [arrow] = seamOf(drawn(effected(inner, confined(repaint(RED), a))), a, b);
    expect(hexes(arrow!.style)).toEqual([RED.hex, BLUE.hex]);
  });
});

describe("what an effect over a whole strip is shown and handed", () => {
  it("lists every seam and cap in the strip's extent, and hands none of them: each follows the items beside it", () => {
    const listed: number[] = [];
    const handed: number[] = [];
    const recording: Effect = (drawn) => {
      listed.push(...drawn.cells().map((cell) => cell.col));
      return Animation.constant<EffectFrame>((look, cell) => (handed.push(cell.col), look));
    };
    drawn(effected(new Strip(trio(), JOINERS.powerline), recording));
    // lead, " a ", the arrow, " b ", the arrow, " c ", tail
    expect(listed).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(handed).toEqual([1, 2, 3, 5, 6, 7, 9, 10, 11]);
  });

  it("hands a separator painted from a style name as it hands any cell: it follows no item", () => {
    const listed: number[] = [];
    const handed: number[] = [];
    const recording: Effect = (drawn) => {
      listed.push(...drawn.cells().map((cell) => cell.col));
      return Animation.constant<EffectFrame>((look, cell) => (handed.push(cell.col), look));
    };
    drawn(effected(new Strip(trio(), JOINERS.plain), recording));
    // " a ", " | ", " b ", " | ", " c ": a blank of the separator, on the terminal's ground, is handed and not listed
    expect(handed).toEqual(Array.from({ length: 15 }, (_, col) => col));
    expect(listed).toEqual([0, 1, 2, 4, 6, 7, 8, 10, 12, 13, 14]);
  });

  it.each(["plain", "metro"] as const)("paints %s's separators under an effect over the whole strip, and leaves them under one confined to its items", (name) => {
    const ink = new ColorRgba(255, 0, 0);
    const fill = new ColorRgba(0, 0, 255);
    const items = trio();
    const strip = new Strip(items, JOINERS[name]);
    const ownerless = (frame: Segment[]): Segment[] => frame.filter((s) => drawnBy(s.style?.anchor, JOIN) && joinedCell(s.style?.anchor)?.follows !== true);
    const whole = ownerless(drawn(effected(strip, paint(fill, ink))));
    expect(whole.length).toBeGreaterThan(0);
    for (const separator of whole) expect(hexes(separator.style)).toEqual([ink.hex, fill.hex]);
    const confinedTo = ownerless(drawn(effected(strip, confined(paint(fill, ink), ...items))));
    expect(confinedTo.map((s) => s.style?.toString())).toEqual(ownerless(drawn(strip)).map((s) => s.style?.toString()));
  });
});

describe("a strip under an effect that moves nothing", () => {
  const identity: Effect = () => Animation.constant<EffectFrame>((look) => look);
  // Neighbours far apart, and two of one fill, whose seam is lifted at rest.
  const PALETTES = { apart: trio, alike: () => [item("a", "#e0e0e0 on #336699"), item("b", "#e0e0e0 on #336699"), item("c", "#e0e0e0 on #b91c1c")] };

  it.each(Object.keys(JOINERS) as (keyof typeof JOINERS)[])("draws %s's bytes as it draws with no effect", (name) => {
    for (const items of Object.values(PALETTES).map((make) => make())) {
      for (const colorSystem of ["truecolor", "256", "ansi"] as const) {
        const strip = new Strip(items, JOINERS[name]);
        expect(renderToString(effected(strip, identity), { colorSystem, width: 80 })).toBe(renderToString(strip, { colorSystem, width: 80 }));
      }
    }
  });
});
