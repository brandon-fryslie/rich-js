import { describe, expect, it } from "vitest";

import { Recolored, cellAttributes } from "../../src/renderables/effect.js";
import {
  Animation,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MOCHA,
  ColorDepth,
  ColorRamp,
  ColorRgba,
  ColorSpec,
  EASES,
  EFFECT_CATALOGUE,
  EFFECT_CURVES,
  EFFECT_LIGHTS,
  Oklch,
  Segment,
  Style,
  TOKYO_NIGHT,
  confined,
  contrastRatio,
  dissolveOut,
  drawnOf,
  fadeIn,
  gradient,
  layered,
  onColors,
  pulse,
  shimmer,
  sparkle,
  steppedInk,
  wheel,
  type Effect,
  type EffectFrame,
  type Pair,
  type Renderable,
  type RenderOptions,
  type TerminalColors,
  type TerminalTheme,
} from "../../src/index.js";
import { stripSubject } from "../../examples/effects-feel/subjects.js";
import { render } from "../../src/core/protocol.js";
import { ATTRIBUTE_DEFAULTS, SHIMMER_WIDTH, blink, light } from "../../src/renderables/effects.js";

const identity: Effect = () => Animation.constant<EffectFrame>((look) => look);

/** An element of one line per style, each of `text`. */
const element = (styles: readonly Style[], text = "words here "): Renderable => ({
  *render() {
    for (const style of styles) {
      yield new Segment(text, style);
      yield new Segment("\n");
    }
  },
});

const options = (depth: ColorDepth): RenderOptions => ({ maxWidth: 80, colorSystem: depth });

const drawn = (subject: Renderable, effect: Effect, t: number, depth: ColorDepth, theme: TerminalColors): Segment[] =>
  [...render(new Recolored(subject, effect, { t, key: "layered", theme }), options(depth))];

const bytes = (segments: readonly Segment[], depth: ColorDepth): string[] =>
  segments.map(({ text, style }) => `${text}|${style?.drawnColors(depth).color?.getAnsiCodes(true).join(";")}|${style?.drawnColors(depth).color?.getAnsiCodes(false).join(";")}|${style?.drawnColors(depth).bgcolor?.getAnsiCodes(false).join(";")}|${style?.reverse}|${style?.blink}|${style?.bold}`);

/** Words in colours off any palette, a fifth on the terminal's ground, a tenth in its ink, seeded. */
function words(count: number, seed: number): Style[] {
  const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rgb = (): ColorSpec => ColorSpec.fromRgba(new ColorRgba(Math.floor(next() * 256), Math.floor(next() * 256), Math.floor(next() * 256)));
  return Array.from({ length: count }, () => {
    const [color, bgcolor, reverse, onTerminal, inTerminal] = [rgb(), rgb(), next() < 0.3, next() < 0.2, next() < 0.1];
    return new Style({ color: inTerminal ? undefined : color, bgcolor: onTerminal ? undefined : bgcolor, reverse });
  });
}

/** The layers folded with nothing held at a floor: what `layered` is measured against. */
const fold = (...effects: readonly Effect[]): Effect => (at) => Animation.map(Animation.all(effects.map((effect) => effect(at))), (frames): EffectFrame => (look, cell) => frames.reduce((under, frame) => frame(under, cell), look));

const z = 1.7;
const shimmering = onColors(shimmer(EFFECT_CURVES.shimmer, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, z));
const pulsing = onColors(pulse(EFFECT_CURVES.pulse, EFFECT_LIGHTS.sun, z));
const sparkling = onColors(sparkle(EFFECT_CURVES.sparkle, EFFECT_LIGHTS.firefly, z));
const turning = wheel(EFFECT_CURVES.wheel, z);
const ramp = gradient(Animation.constant(new ColorRamp(EASES.linear, [{ at: 0, color: new ColorRgba(255, 30, 20) }, { at: 1, color: new ColorRgba(255, 200, 40) }])));
const blinking = blink({ attribute: "blink", off: 1, on: 1 });
const stepped = steppedInk([{ color: new ColorRgba(255, 30, 20), seconds: 5 }, { color: new ColorRgba(30, 200, 255), seconds: 5 }]);

const depths = [["truecolor", ColorDepth.TRUECOLOR], ["256", ColorDepth.EIGHT_BIT]] as const;
const everyDepth = [...depths, ["sixteen", ColorDepth.STANDARD], ["windows", ColorDepth.WINDOWS]] as const;
const themes = [["mocha", CATPPUCCIN_MOCHA], ["latte", CATPPUCCIN_LATTE], ["tokyo", TOKYO_NIGHT]] as const;
const compositions = [
  ["wheel, shimmer", [turning, shimmering]],
  ["shimmer, wheel", [shimmering, turning]],
  ["wheel, pulse", [turning, pulsing]],
  ["pulse, sparkle", [pulsing, sparkling]],
  ["sparkle, wheel, pulse", [sparkling, turning, pulsing]],
  ["gradient, shimmer", [ramp, shimmering]],
  ["stepped, pulse", [stepped, pulsing]],
  ["sparkle, pulse", [sparkling, pulsing]],
  ["stepped, shimmer", [stepped, shimmering]],
] as const;
const times = Array.from({ length: 30 }, (_, i) => 11 + i * 37);

/** Each cell of `segments` as the screen shows it, in the order they are drawn: blanks too, so two frames line up cell for cell. */
function cellsOf(segments: readonly Segment[], depth: ColorDepth, theme: TerminalColors): { pair: Pair; word: boolean }[] {
  return segments.flatMap((segment) => {
    const [pair] = drawnOf([new Segment("x", segment.style)], depth, theme).pairs;
    // A strip's seam is no word's, so it has no pair: it is left out of every frame alike.
    return pair === undefined ? [] : [...segment.text].filter((ch) => ch !== "\n").map((ch) => ({ pair, word: ch !== " " }));
  });
}

const floorOf = (pair: Pair, depth: ColorDepth): number => Math.min(contrastRatio(pair.fg, pair.bg), 4.5) - (depth === ColorDepth.TRUECOLOR ? 0.01 : 0);

describe("layered", () => {
  describe.each(depths)("at %s", (_name, depth) => {
    it.each(compositions)("%s keeps every word at its floor", (_c, effects) => {
      for (const [, theme] of themes) {
        for (const seed of [3, 19, 101]) {
          const subject = element(words(5, seed));
          const rests = cellsOf(drawn(subject, identity, 0, depth, theme), depth, theme);
          for (const t of times) {
            const now = cellsOf(drawn(subject, layered(...effects), t, depth, theme), depth, theme);
            now.forEach(({ pair, word }, i) => {
              if (word) expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(floorOf(rests[i]!.pair, depth) - 1e-9);
            });
          }
        }
      }
    });

    it.each(compositions.filter(([, effects]) => !effects.includes(ramp) && !effects.includes(stepped)))("%s leaves a word with contrast to spare on the side of its ground it rested on", (_c, effects) => {
      const luminous = (c: ColorRgba): number => contrastRatio(c, new ColorRgba(0, 0, 0));
      for (const [, theme] of themes) {
        const subject = element(words(5, 19));
        const rests = cellsOf(drawn(subject, identity, 0, depth, theme), depth, theme);
        for (const t of times) {
          cellsOf(drawn(subject, layered(...effects), t, depth, theme), depth, theme).forEach(({ pair, word }, i) => {
            const rest = rests[i]!.pair;
            if (word && contrastRatio(rest.fg, rest.bg) > 1.2) expect(luminous(pair.fg) >= luminous(pair.bg)).toBe(luminous(rest.fg) >= luminous(rest.bg));
          });
        }
      }
    });

  });

  describe.each(everyDepth)("at %s", (_name, depth) => {
    it.each([["shimmer", shimmering], ["pulse", pulsing], ["sparkle", sparkling], ["wheel", turning], ["gradient", ramp], ["steppedInk", stepped], ["blink", blinking]] as const)("%s beside an identity layer draws what it draws alone", (_n, effect) => {
      for (const [, theme] of themes) {
        for (const seed of [3, 19, 101, 7, 53, 211, 307, 409, 503, 601]) {
          const subject = element(words(5, seed));
          for (const t of times) {
            const alone = bytes(drawn(subject, effect, t, depth, theme), depth);
            expect(bytes(drawn(subject, layered(effect, identity), t, depth, theme), depth)).toEqual(alone);
            expect(bytes(drawn(subject, layered(identity, effect), t, depth, theme), depth)).toEqual(alone);
            expect(bytes(drawn(subject, layered(effect), t, depth, theme), depth)).toEqual(alone);
          }
        }
      }
    });

    it("no layers leave every cell as drawn, and a plain element stays where it rests", () => {
      for (const [, theme] of themes) {
        const subject = element([...words(5, 3), Style.parse("on red"), Style.parse("on blue")]);
        expect(bytes(drawn(subject, layered(), 9, depth, theme), depth)).toEqual(bytes(drawn(subject, identity, 9, depth, theme), depth));
      }
    });
  });

  it("the catalogue's loops all compose", () => {
    const of = Object.values(EFFECT_CATALOGUE.loops).map((make) => make({ z }));
    expect(() => drawn(element(words(3, 5)), layered(...of), 100, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)).not.toThrow();
  });

  it("wheel and shimmer both move the frame", () => {
    const subject = element([new Style({ color: ColorSpec.parse("#cdd6f4"), bgcolor: ColorSpec.parse("#1e1e2e") })], "words here ".repeat(6));
    const moved = times.map((t) => {
      const both = bytes(drawn(subject, layered(turning, shimmering), t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR).join();
      return [both !== bytes(drawn(subject, turning, t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR).join(), both !== bytes(drawn(subject, shimmering, t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR).join()];
    });
    expect(moved.some(([a]) => a)).toBe(true);
    expect(moved.every(([, b]) => b)).toBe(true);
  });

  it("a colour one layer turned onto another of the element's is not taken for it", () => {
    const [a, b] = [new ColorRgba(200, 60, 60), new ColorRgba(60, 200, 60)];
    const onto: Effect = () => Animation.constant<EffectFrame>((look, { pair }) => (pair.fg.hex === a.hex ? { ...look, fg: b } : look));
    const recolourB: Effect = () => Animation.constant<EffectFrame>((look, { pair }) => (pair.fg.hex === b.hex ? { ...look, fg: new ColorRgba(137, 180, 250) } : look));
    const subject = element([new Style({ color: ColorSpec.fromRgba(a) }), new Style({ color: ColorSpec.fromRgba(b) })], "x");
    const inks = cellsOf(drawn(subject, layered(onto, recolourB), 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).map(({ pair }) => pair.fg.hex);
    expect(inks).toEqual([b.hex, "#89b4fa"]);
  });

  it("a colour the wheel turned onto another of the element's takes that colour's light not at all", () => {
    const rested = ColorSpec.parse("#a6e3a1");
    const alone = cellsOf(drawn(element([new Style({ color: rested })], "x"), turning, 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg;
    const subject = element([new Style({ color: rested }), new Style({ color: ColorSpec.fromRgba(alone) })], "x");
    const lightOnThat = onColors({ touch: light(EFFECT_LIGHTS.sun), field: () => () => 1 }, new Set([alone.hex]));
    const unlit = onColors({ touch: light(EFFECT_LIGHTS.sun), field: () => () => 0 }, new Set([alone.hex]));
    const inks = (effect: Effect): string[] => cellsOf(drawn(subject, effect, 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).map(({ pair }) => pair.fg.hex);
    expect(inks(layered(turning, lightOnThat))[0]).toBe(inks(layered(turning, unlit))[0]);
  });

  it("a gradient lights a cell by the ink the element drew, not the ink handed to it", () => {
    const [lit, other] = ["#a6e3a1", "#f38ba8"];
    const only = gradient(Animation.constant(new ColorRamp(EASES.linear, [{ at: 0, color: new ColorRgba(120, 200, 255) }])), [lit]);
    const paint = (hex: string): Effect => () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: ColorSpec.parse(hex).getTruecolor() }));
    const inkOn = (rests: string, effect: Effect): string => cellsOf(drawn(element([Style.parse(rests), Style.parse(other)], "x"), effect, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg.hex;
    expect(inkOn(other, layered(paint(lit), only))).toBe(lit);
    expect(inkOn(lit, layered(paint(other), only))).toBe("#78c8ff");
  });

  it("a painter reads the pair the element drew, whatever ink it is handed", () => {
    for (const [, depth] of everyDepth) {
      const subject = element([Style.parse("#cdd6f4 on #1e1e2e")], "x");
      const faint: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: new ColorRgba(36, 36, 52) }));
      const dim = steppedInk([{ color: new ColorRgba(70, 20, 20), seconds: 5 }]);
      const ramped = gradient(Animation.constant(new ColorRamp(EASES.linear, [{ at: 0, color: new ColorRgba(70, 20, 20) }])));
      for (const painter of [dim, ramped]) expect(bytes(drawn(subject, layered(faint, painter), 1, depth, CATPPUCCIN_MOCHA), depth)).toEqual(bytes(drawn(subject, painter, 1, depth, CATPPUCCIN_MOCHA), depth));
    }
  });

  it("the wheel holds a colour with no room still, whatever colour it is handed there", () => {
    // The middle colour is the darker of one tight pair and the lighter of another, so it has nowhere to land.
    const subject = element([Style.parse("#585b70 on #45475a"), Style.parse("#6c7086 on #585b70")], "x");
    const ground = new ColorRgba(30, 60, 30);
    const regrounded: Effect = () => Animation.constant<EffectFrame>((look, { pair }) => (pair.bg.hex === "#585b70" ? { ...look, bg: ground } : look));
    expect(cellsOf(drawn(subject, layered(regrounded, turning), 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[1]!.pair.bg.hex).toBe(ground.hex);
  });

  it("the wheel recognises a cell by what the element drew, and turns what a layer beneath left", () => {
    const repainted = new ColorRgba(180, 120, 90);
    const repaint: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: repainted }));
    const subject = element([new Style({ color: ColorSpec.parse("#cdd6f4"), bgcolor: ColorSpec.parse("#1e1e2e") })], "x");
    const [turned] = cellsOf(drawn(subject, layered(repaint, turning), 200, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
    expect(Math.abs(Oklch.fromRgba(turned!.pair.fg).h - Oklch.fromRgba(repainted).h)).toBeGreaterThan(30);
  });

  it("a layer that moves nothing leaves the hue the wheel left", () => {
    const subject = element([new Style({ color: ColorSpec.parse("#a6e3a1"), bgcolor: ColorSpec.parse("#1e1e2e") })], "x");
    const wheelAlone = cellsOf(drawn(subject, turning, 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg.hex;
    const lightAtRest = onColors({ touch: (color) => color, field: () => () => 0 });
    expect(cellsOf(drawn(subject, layered(turning, lightAtRest), 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg.hex).toBe(wheelAlone);
  });

  it("a light falls on the colour the wheel left, at the share of the colour the element drew", () => {
    const subject = element([new Style({ color: ColorSpec.parse("#a6e3a1"), bgcolor: ColorSpec.parse("#1e1e2e") })], "x");
    const full = onColors({ touch: light(EFFECT_LIGHTS.sun), field: () => () => 1 });
    const inkOf = (effect: Effect): ColorRgba => cellsOf(drawn(subject, effect, 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg;
    expect(inkOf(layered(turning, full)).hex).not.toBe(inkOf(turning).hex);
  });

  it("two inks on one fill draw one ground", () => {
    const fill = ColorSpec.parse("#45475a");
    const subject = element([new Style({ color: ColorSpec.parse("#f5e0dc"), bgcolor: fill }), new Style({ color: ColorSpec.parse("#bac2de"), bgcolor: fill })], "words ");
    for (const depth of [ColorDepth.TRUECOLOR, ColorDepth.EIGHT_BIT]) {
      for (const t of times) {
        const grounds = cellsOf(drawn(subject, layered(turning, pulsing), t, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA).map(({ pair }) => pair.bg.hex);
        expect(new Set(grounds).size).toBe(1);
      }
    }
  });

  it("confined layers that never meet draw what the plain fold draws", () => {
    const [a, b] = [new Segment("left ", new Style({ color: ColorSpec.parse("#cdd6f4"), bgcolor: ColorSpec.parse("#313244") })), new Segment("right", new Style({ color: ColorSpec.parse("#1e1e2e"), bgcolor: ColorSpec.parse("#89b4fa") }))];
    const [left, right] = [{ owner: {} }, { owner: {} }];
    const own = (segment: Segment, owner: object): Renderable => ({ render: () => Segment.anchorLines([[segment]], owner).flat() });
    const subject: Renderable = { *render(options) { yield* render(own(a, left), options); yield* render(own(b, right), options); } };
    const effects = [confined(pulsing, left), confined(onColors(pulse(EFFECT_CURVES.pulse, EFFECT_LIGHTS.sun, 9)), right)];
    for (const depth of [ColorDepth.TRUECOLOR, ColorDepth.EIGHT_BIT]) {
      for (const t of times) expect(bytes(drawn(subject, layered(...effects), t, depth, CATPPUCCIN_MOCHA), depth)).toEqual(bytes(drawn(subject, fold(...effects), t, depth, CATPPUCCIN_MOCHA), depth));
    }
  });

  it("the wheel keeps turning a colour a light has lifted out of its rested bounds", () => {
    const subject = element([new Style({ color: ColorSpec.parse("#6c7086"), bgcolor: ColorSpec.parse("#1e1e2e") })], "x");
    const lift = onColors({ touch: light(EFFECT_LIGHTS.sun), field: () => () => 1 });
    const inkOf = (effect: Effect, t: number): number => Oklch.fromRgba(cellsOf(drawn(subject, effect, t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg).h;
    const apart = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);
    for (const t of [200, 300, 400]) expect(apart(inkOf(layered(lift, turning), t), inkOf(lift, t))).toBeGreaterThan(20);
  });

  it("holds still where every layer does, and says so", () => {
    const composed = layered(turning, shimmering);
    const animation = composed(drawnOf(drawn(element(words(2, 5)), identity, 0, ColorDepth.STANDARD, CATPPUCCIN_MOCHA), ColorDepth.STANDARD, CATPPUCCIN_MOCHA));
    expect(animation.nextChange(40)).toBe(Number.POSITIVE_INFINITY);
    expect(composed(drawnOf(drawn(element(words(2, 5)), identity, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)).nextChange(40)).toBe(40);
  });

  it("sleeps at every depth on an element with none of the colours its loops light", () => {
    const plain = element([new Style({})]);
    for (const depth of [ColorDepth.TRUECOLOR, ColorDepth.EIGHT_BIT]) {
      const listed = drawnOf(drawn(plain, identity, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA);
      expect(layered(turning, shimmering, ramp)(listed).nextChange(40)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("sleeps where a loop names a colour no cell it is handed shows", () => {
    const words = element([new Style({ color: ColorSpec.parse("#a0c0e0") })]);
    const elsewhere = new Set(["#123456"]);
    const depth = ColorDepth.TRUECOLOR;
    const listed = drawnOf(drawn(words, identity, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA);
    const moving = Animation.continuous(() => new ColorRamp(EASES.linear, [{ at: 0, color: new ColorRgba(255, 30, 20) }, { at: 1, color: new ColorRgba(255, 200, 40) }]));
    expect(layered(onColors(pulse(EFFECT_CURVES.pulse, EFFECT_LIGHTS.sun, z), elsewhere))(listed).nextChange(40)).toBe(Number.POSITIVE_INFINITY);
    expect(gradient(moving, [...elsewhere])(listed).nextChange(40)).toBe(Number.POSITIVE_INFINITY);
    expect(confined(shimmering, {})(listed).nextChange(40)).toBe(Number.POSITIVE_INFINITY);
    const unstyled = drawnOf(drawn(element([new Style({})]), identity, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA);
    expect(onColors(pulse(EFFECT_CURVES.pulse, EFFECT_LIGHTS.sun, z), new Set([unstyled.pairs[0]!.fg.hex]))(unstyled).nextChange(40)).toBe(Number.POSITIVE_INFINITY);
  });

  it("keeps moving a colour named for its light that lies only under blanks, which no word cell lists", () => {
    const fill = new ColorRgba(40, 90, 200);
    const blanks = element([new Style({ bgcolor: ColorSpec.fromRgba(fill) })], "   ");
    const depth = ColorDepth.TRUECOLOR;
    const listed = drawnOf(drawn(blanks, identity, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA);
    expect(listed.colors.size).toBe(0);
    const named = onColors(pulse(EFFECT_CURVES.pulse, EFFECT_LIGHTS.sun, z), new Set([fill.hex]));
    expect(layered(named)(listed).nextChange(40)).toBe(40);
  });

  it("holds a ground a swap takes past its bounds at the floor, though its ink read better there", () => {
    const [ink, ground] = [new ColorRgba(205, 214, 244), new ColorRgba(30, 30, 46)];
    const subject = element([new Style({ color: ColorSpec.fromRgba(ink), bgcolor: ColorSpec.fromRgba(ground) })]);
    const swap: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: look.bg, bg: look.fg }));
    const depth = ColorDepth.TRUECOLOR;
    const contrastOf = (effect: Effect): number => {
      const { pair } = cellsOf(drawn(subject, effect, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA)[0]!;
      return contrastRatio(pair.fg, pair.bg);
    };
    expect(contrastOf(swap)).toBeGreaterThan(11);
    expect(contrastOf(layered(swap))).toBeCloseTo(4.5, 1);
  });

  it("lays a translucent ink on the ground as it landed, not as it was handed", () => {
    const fill = ColorSpec.fromRgba(new ColorRgba(30, 30, 46));
    // White at its floor bounds the fill; the tight grey on it reads wherever the fill lands.
    const subject = element([new Style({ color: ColorSpec.fromRgba(new ColorRgba(255, 255, 255)), bgcolor: fill }), new Style({ color: ColorSpec.fromRgba(new ColorRgba(70, 70, 80)), bgcolor: fill })]);
    const lifted: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: new ColorRgba(255, 255, 255, 0.5), bg: new ColorRgba(176, 176, 176) }));
    const depth = ColorDepth.TRUECOLOR;
    const cell = cellsOf(drawn(subject, layered(lifted), 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA).at(-1)!;
    const mix = (under: number): number => Math.round(0.5 * 255 + 0.5 * under);
    expect(cell.pair.bg.red).toBeLessThan(176);
    expect(cell.pair.fg.red).toBeCloseTo(mix(cell.pair.bg.red), -1);
    expect(cell.pair.fg.red).toBeLessThan(mix(176) - 8);
  });

  it("at sixteen colours a layer that moves a ground leaves its words on the theme's slots at their floor", () => {
    const lifts: readonly (readonly [string, Effect])[] = [
      ["lifted", () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: new ColorRgba(235, 235, 235) }))],
      ["sunk", () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: new ColorRgba(12, 12, 12) }))],
      ["mid", () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: new ColorRgba(128, 128, 128) }))],
    ];
    for (const depth of [ColorDepth.STANDARD, ColorDepth.WINDOWS]) {
      for (const [, theme] of themes) {
        for (const [, lift] of lifts) {
          const subject = element(words(6, 11));
          const rests = cellsOf(drawn(subject, identity, 0, depth, theme), depth, theme);
          cellsOf(drawn(subject, layered(lift, stepped), 1, depth, theme), depth, theme).forEach(({ pair, word }, i) => {
            if (word) expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(floorOf(rests[i]!.pair, depth) - 1e-9);
          });
        }
      }
    }
  });

  describe("under confined", () => {
    const [a, b] = [new Segment("left ", new Style({ color: ColorSpec.parse("#cdd6f4"), bgcolor: ColorSpec.parse("#313244") })), new Segment("right", new Style({ color: ColorSpec.parse("#1e1e2e"), bgcolor: ColorSpec.parse("#89b4fa") }))];
    const [left, right] = [{}, {}];
    const subject: Renderable = { render: () => [...Segment.anchorLines([[a]], left).flat(), ...Segment.anchorLines([[b]], right).flat()] };
    const ofCells = (effect: Effect, t: number): string[] => cellsOf(drawn(subject, effect, t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).map(({ pair }) => pair.bg.hex);

    it("a confined composition moves its owner's cells and no other", () => {
      const rest = ofCells(identity, 0);
      const now = ofCells(confined(layered(turning, pulsing), left), 300);
      expect(now.slice(0, 5)).not.toEqual(rest.slice(0, 5));
      expect(now.slice(5)).toEqual(rest.slice(5));
    });

    it("a confined layer moves its owner's cells while another moves them all", () => {
      const rest = ofCells(identity, 0);
      const alone = ofCells(turning, 300);
      const now = ofCells(layered(turning, confined(pulsing, right)), 300);
      expect(now.slice(0, 5)).toEqual(alone.slice(0, 5));
      expect(now.slice(5)).not.toEqual(alone.slice(5));
      expect(now.slice(0, 5)).not.toEqual(rest.slice(0, 5));
    });
  });

  it("a layered effect inside another keeps the floor as its layers do", () => {
    const subject = element(words(3, 5));
    const rests = cellsOf(drawn(subject, identity, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
    cellsOf(drawn(subject, layered(layered(turning, pulsing), sparkling), 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).forEach(({ pair, word }, i) => {
      if (word) expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(floorOf(rests[i]!.pair, ColorDepth.TRUECOLOR));
    });
  });

  describe("where an ink lands", () => {
    const luminous = (c: ColorRgba): number => contrastRatio(c, new ColorRgba(0, 0, 0));
    const lookOn = (ink: string, ground: string, effect: Effect, depth: ColorDepth): Pair =>
      cellsOf(drawn(element([Style.parse(`${ink} on ${ground}`)], "x"), effect, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA)[0]!.pair;
    const painting = (fg: string | undefined, bg: string | undefined): Effect => () =>
      Animation.constant<EffectFrame>((look) => ({ ...look, ...(fg === undefined ? {} : { fg: ColorSpec.parse(fg).getTruecolor() }), ...(bg === undefined ? {} : { bg: ColorSpec.parse(bg).getTruecolor() }) }));

    it("reaches black in a colour that cannot keep its chroma there", () => {
      const { fg, bg } = lookOn("#000088", "#ffffff", layered(painting("#000088", "#6a6a6a")), ColorDepth.TRUECOLOR);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.49);
      expect(luminous(fg)).toBeLessThan(luminous(bg));
    });

    it("goes across its ground where the side it stands on has no room", () => {
      const { fg, bg } = lookOn("#6f6f6f", "#ffffff", layered(painting("#f4f4f4", "#dddddd")), ColorDepth.TRUECOLOR);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.49);
      expect(luminous(fg)).toBeLessThan(luminous(bg));
    });

    it("stays on the side a painter stood it on, not the side it rested on", () => {
      const { fg, bg } = lookOn("#ffffff", "#8a8a8a", layered(painting("#555555", undefined)), ColorDepth.TRUECOLOR);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(3.3);
      expect(luminous(fg)).toBeLessThan(luminous(bg));
    });

    it("keeps its side below truecolor where the ground as written would take the room away", () => {
      const { fg, bg } = lookOn("#d0d0d0", "#303030", layered(painting(undefined, "#777656")), ColorDepth.EIGHT_BIT);
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
      expect(luminous(fg)).toBeGreaterThan(luminous(bg));
    });

    it("the floor is the words': a blank that shows no word is not held to it", () => {
      const hide: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: look.bg }));
      const subject: Renderable = { render: () => [new Segment("x", Style.parse("#cdd6f4 on #1e1e2e")), new Segment("   ", Style.parse("#f5e0dc on #313244"))] };
      const blank = (effect: Effect): string => cellsOf(drawn(subject, effect, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[1]!.pair.fg.hex;
      expect(blank(layered(hide))).toBe(blank(hide));
      expect(blank(hide)).toBe("#313244");
    });

    it("a white ink at a tight contrast leaves its ground where it rests, at 256", () => {
      const subject = element([Style.parse("#ffffff on #878787")], "x");
      for (const t of times) expect(bytes(drawn(subject, layered(identity, identity), t, ColorDepth.EIGHT_BIT, CATPPUCCIN_MOCHA), ColorDepth.EIGHT_BIT)).toEqual(bytes(drawn(subject, identity, t, ColorDepth.EIGHT_BIT, CATPPUCCIN_MOCHA), ColorDepth.EIGHT_BIT));
    });

    it("the wheel turns each lit colour of one region for itself", () => {
      const byColumn: Effect = () => Animation.constant<EffectFrame>((look, { col }) => ({ ...look, bg: col === 0 ? new ColorRgba(70, 40, 40) : new ColorRgba(40, 70, 40) }));
      const subject = element([Style.parse("#cdd6f4 on #1e1e2e")], "ab");
      const [a, b] = cellsOf(drawn(subject, layered(byColumn, turning), 300, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
      expect(a!.pair.bg.hex).not.toBe(b!.pair.bg.hex);
    });
  });

  it("a transition or a sink keeps every word at its floor at every depth", () => {
    const veils: readonly Effect[] = [
      fadeIn({ seconds: 10, ease: EASES.linear, swing: 1 }, z).effect,
      dissolveOut({ seconds: 10, ease: EASES.linear, swing: 1 }, z).effect,
      () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: look.fg })),
      () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: look.bg })),
    ];
    const named = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "bright_black", "bright_red", "bright_green", "bright_yellow", "bright_blue", "bright_magenta", "bright_cyan", "bright_white"];
    const plain = named.flatMap((name) => [`${name} on default`, `default on ${name}`, `white on ${name}`, `black on ${name}`]).map((style) => Style.parse(style));
    for (const [, depth] of everyDepth) {
      for (const [, theme] of themes) {
        for (const subject of [element(plain), element(words(6, 11)), element(words(6, 211))]) {
          const rests = cellsOf(drawn(subject, identity, 0, depth, theme), depth, theme);
          for (const veil of veils) {
            for (const t of [0, 2, 5, 8, 30]) {
              cellsOf(drawn(subject, layered(veil), t, depth, theme), depth, theme).forEach(({ pair, word }, i) => {
                if (word) expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(floorOf(rests[i]!.pair, depth) - 1e-6);
              });
            }
          }
        }
      }
    }
  });

  it("an ink's side is read against the ground that landed, not the one it was handed", () => {
    const sink: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: look.fg }));
    const [cell] = cellsOf(drawn(element([Style.parse("#101010 on #cccccc")], "x"), layered(sink), 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
    expect(contrastRatio(cell!.pair.fg, new ColorRgba(0, 0, 0))).toBeLessThan(contrastRatio(cell!.pair.bg, new ColorRgba(0, 0, 0)));
  });

  it("a ground a dark ink shares is barred by the stricter, in either order", () => {
    const sink: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: new ColorRgba(20, 20, 20) }));
    const [tight, roomy] = [Style.parse("#606070 on #a0a0b0"), Style.parse("#000000 on #a0a0b0")];
    for (const styles of [[tight, roomy], [roomy, tight]]) {
      const [cell] = cellsOf(drawn(element(styles, "x"), layered(sink), 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
      expect(contrastRatio(new ColorRgba(0, 0, 0), cell!.pair.bg)).toBeGreaterThanOrEqual(4.49);
    }
  });

  it("a ground shared by a light ink and a dark one is held by both, in either order", () => {
    const moves = [new ColorRgba(240, 240, 240), new ColorRgba(16, 16, 16)];
    const [light, dark] = [Style.parse("#ffffff on #787878"), Style.parse("#000000 on #787878")];
    for (const to of moves) {
      const move: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: to }));
      for (const styles of [[light, dark], [dark, light]]) {
        const [cell] = cellsOf(drawn(element(styles, "x"), layered(move), 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
        expect(contrastRatio(new ColorRgba(255, 255, 255), cell!.pair.bg)).toBeGreaterThanOrEqual(4.3);
        expect(contrastRatio(new ColorRgba(0, 0, 0), cell!.pair.bg)).toBeGreaterThanOrEqual(4.3);
      }
    }
  });

  it("a ground shared by a tight ink and a roomy one is capped by the stricter, in either order", () => {
    const lift: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: new ColorRgba(230, 230, 230) }));
    const [tight, roomy] = [Style.parse("#9a9aa6 on #606070"), Style.parse("#ffffff on #606070")];
    for (const styles of [[tight, roomy], [roomy, tight]]) {
      const [cell] = cellsOf(drawn(element(styles, "x"), layered(lift), 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
      expect(contrastRatio(new ColorRgba(255, 255, 255), cell!.pair.bg)).toBeGreaterThanOrEqual(4.49);
    }
  });

  it("a translucent colour is measured as it is written, on what lies beneath it", () => {
    const thin: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: new ColorRgba(255, 255, 255, 0.15) }));
    const bothThin: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, fg: new ColorRgba(255, 255, 255, 0.15), bg: new ColorRgba(255, 255, 255, 0.1) }));
    const subject = element([Style.parse("#ffffff on #1e1e2e"), Style.parse("#cdd6f4 on #313244")]);
    for (const [, depth] of everyDepth) {
      const rests = cellsOf(drawn(subject, identity, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA);
      for (const effect of [layered(thin), layered(bothThin)]) {
        cellsOf(drawn(subject, effect, 0, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA).forEach(({ pair, word }, i) => {
          if (word) expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(floorOf(rests[i]!.pair, depth) - 1e-6);
        });
      }
    }
  });

  it("a gradient chooses its ink against the ground the element drew, not one a layer beneath left", () => {
    const darker: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: new ColorRgba(16, 16, 24) }));
    const dusk = gradient(Animation.constant(new ColorRamp(EASES.linear, [{ at: 0, color: new ColorRgba(70, 20, 20) }])));
    const subject = element([Style.parse("#cdd6f4 on #1e1e2e")], "x");
    const ink = (effect: Effect): string => cellsOf(drawn(subject, effect, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair.fg.hex;
    expect(ink(layered(darker, dusk))).toBe(ink(dusk));
  });

  it("reduced motion holds a composition at its first frame", () => {
    const at = drawnOf(drawn(element(words(2, 5)), identity, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
    const still = layered(turning, shimmering)(at).reduced();
    expect(still.nextChange(40)).toBe(Number.POSITIVE_INFINITY);
    const look = { fg: new ColorRgba(200, 200, 200), bg: new ColorRgba(20, 20, 20), attributes: cellAttributes(Style.null()) };
    const cell = { row: 0, col: 0, seed: 0, anchor: undefined, pair: { ...look, terminal: { fg: false, bg: false }, reverse: false } };
    expect(still.at(40)(look, cell)).toEqual(still.at(900)(look, cell));
  });

  it("holds a veil at the floor at one layer as at two, right up to black", () => {
    const veil = fadeIn({ seconds: 10, ease: EASES.linear, swing: 1 }, z).effect;
    const sinking: Effect = () => Animation.constant<EffectFrame>((look) => ({ ...look, bg: look.fg }));
    const bar = element([Style.parse("#1e1e2e on #89b4fa")]);
    const rest = cellsOf(drawn(bar, identity, 0, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)[0]!.pair;
    for (const effect of [layered(veil), layered(veil, blink(ATTRIBUTE_DEFAULTS.blink)), layered(sinking), layered(sinking, pulsing)]) {
      for (const t of [0, 3, 7]) {
        for (const { pair, word } of cellsOf(drawn(bar, effect, t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA)) {
          if (word) expect(contrastRatio(pair.fg, pair.bg)).toBeGreaterThanOrEqual(floorOf(rest, ColorDepth.TRUECOLOR));
        }
      }
    }
  });

  it("a shared fill glows under a terminal's ink at a tight contrast as it does alone", () => {
    const fill = "#444455";
    const subject = element([new Style({ bgcolor: ColorSpec.parse(fill) }), new Style({ color: ColorSpec.parse("#f5e0dc"), bgcolor: ColorSpec.parse(fill) })]);
    for (const depth of [ColorDepth.TRUECOLOR, ColorDepth.EIGHT_BIT]) {
      for (const [, theme] of themes) {
        for (const t of times) expect(bytes(drawn(subject, layered(pulsing, identity), t, depth, theme), depth)).toEqual(bytes(drawn(subject, pulsing, t, depth, theme), depth));
      }
    }
  });

  it("a painter's ink under the wheel stays on its side instead of strobing across its ground", () => {
    const subject = element([new Style({ color: ColorSpec.parse("#eeeeee") })], "words here");
    for (const [, theme] of themes) {
      let last: Pair[] | undefined;
      let jumps = 0;
      for (let t = 200; t < 260; t++) {
        const now = cellsOf(drawn(subject, layered(ramp, turning), t, ColorDepth.TRUECOLOR, theme), ColorDepth.TRUECOLOR, theme).map(({ pair }) => pair);
        last?.forEach((was, i) => (jumps += Oklch.fromRgba(was.fg).deltaE(Oklch.fromRgba(now[i]!.fg)) > 0.3 ? 1 : 0));
        last = now;
      }
      expect(jumps).toBe(0);
    }
  });

  it.each([["random words", () => element(words(5, 19))], ["more words", () => element(words(5, 101))], ["the demo's strip", (theme: TerminalTheme) => stripSubject(theme).renderable]] as const)("over %s, a colour steps about as far between frames as the unfloored fold's", (_n, bodyOn) => {
    const step = (effect: Effect, depth: ColorDepth, theme: TerminalTheme): number => {
      const subject = bodyOn(theme);
      let largest = 0;
      let last: Pair[] | undefined;
      for (let t = 200; t < 260; t++) {
        const now = cellsOf(drawn(subject, effect, t, depth, theme), depth, theme).map(({ pair }) => pair);
        last?.forEach((was, i) => (largest = Math.max(largest, Oklch.fromRgba(was.fg).deltaE(Oklch.fromRgba(now[i]!.fg)), Oklch.fromRgba(was.bg).deltaE(Oklch.fromRgba(now[i]!.bg)))));
        last = now;
      }
      return largest;
    };
    for (const [, depth] of depths) {
      for (const [, theme] of themes) {
        for (const effects of [[pulsing, sparkling], [turning, pulsing], [turning, shimmering]]) expect(step(layered(...effects), depth, theme)).toBeLessThan(step(fold(...effects), depth, theme) * 1.25 + 0.02);
      }
    }
  });
});
