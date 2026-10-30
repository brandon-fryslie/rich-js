/*
 * A strip's seams under an effect: every join cell is resolved again from the
 * item cells beside it as the effect left them, through the path the joiner
 * drew it by, lift included — never painted by the effect itself.
 */
import { describe, it, expect } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { drawnBy } from "../../src/core/anchor.js";
import { ColorDepth, ColorRgba, ColorSpec, blendRgb } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { renderToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { JOIN, JOINERS, Strip, joinedCell } from "../../src/core/strip.js";
import type { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Effected, confined, type Effect, type EffectFrame } from "../../src/renderables/effect.js";
import { FlexStrip } from "../../src/renderables/flexStrip.js";
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
    return joined !== undefined && joined.reads.left === left && joined.reads.right === right;
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

  it("keeps the colour it was drawn from on a side whose neighbour the frame does not draw", () => {
    const [a, b] = [trio()[0]!, trio()[2]!];
    // lead, " a ", the arrow — and " c " and the tail cut off by a narrower container
    const cut: Renderable = { render: (options: RenderOptions) => Segment.adjustLineLength(Segment.splitLines(new Strip([a, b], JOINERS.powerline).render(options))[0]!, 5, undefined, false) };
    const arrowOf = (frame: Segment[]) => seamOf(frame, a, b)[0]!.style;
    expect(hexes(arrowOf(drawn(effected(cut, confined(repaint(BLUE), a)))))).toEqual([BLUE.hex, "#b91c1c"]);
    expect(renderToString(effected(cut, confined(repaint(BLUE), b)), { colorSystem: "truecolor" })).toBe(renderToString(cut, { colorSystem: "truecolor" }));
  });

  it("moves on from the edges an effect inside another left it at", () => {
    const [a, b] = [trio()[0]!, trio()[2]!];
    const inner = new Effected(new Strip([a, b], JOINERS.powerline), confined(repaint(BLUE), b), { key: "inner", theme: THEME });
    const [arrow] = seamOf(drawn(effected(inner, confined(repaint(RED), a))), a, b);
    expect(hexes(arrow!.style)).toEqual([RED.hex, BLUE.hex]);
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
