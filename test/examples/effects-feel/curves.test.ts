// The effects demo's curves: each rests on the untouched cell, and the two
// transitions start and end where they say they do.

import { describe, expect, it } from "vitest";
import {
  ColorRgba,
  ColorSpec,
  EASES,
  Effected,
  Oklch,
  RichText,
  Style,
  contrastRatio,
  renderToString,
  type CellColors,
  type Effect,
  type EffectCell,
  type Renderable,
} from "../../../src/index.js";
import { CATPPUCCIN_LATTE, CATPPUCCIN_MOCHA } from "../../../src/index.js";
import {
  dissolveOut,
  drift,
  fadeIn,
  light,
  onColors,
  pulse,
  settledAt,
  shares,
  shimmer,
  sparkle,
  type Curve,
  type Loop,
  type Pair,
} from "../../../examples/effects-feel/curves.js";
import { LIGHTS, SHIMMER_WIDTH } from "../../../examples/effects-feel/app.js";
import { parseSettings } from "../../../examples/effects-feel/settings.js";

const curve = (seconds: number, swing: number): Curve => ({ seconds, ease: EASES.linear, swing });

const ink = new ColorRgba(205, 214, 244);
const ground = new ColorRgba(30, 30, 46);
const colors: CellColors = { fg: ink, bg: ground };
const cells: EffectCell[] = Array.from({ length: 40 }, (_, col) => ({ row: 0, col, seed: (col * 0.6180339) % 1 }));

const sameColor = (a: ColorRgba, b: ColorRgba): boolean => a.red === b.red && a.green === b.green && a.blue === b.blue;
const distance = (a: ColorRgba, b: ColorRgba): number => Oklch.fromRgba(a).deltaE(Oklch.fromRgba(b));
const sun = LIGHTS.sun;
/** The ink at its whole share: the subject every curve here is tried on. */
const inkOn = new Map([[ink.hex, 1]]);
/** `color` under `loop` at a cell and moment, at its whole share. */
const under = (loop: Loop, color: ColorRgba, cell: EffectCell, t: number): ColorRgba => loop.touch(color, loop.field(cell, t));
const at = (effect: Effect, t: number): CellColors[] => cells.map((cell) => effect(colors, cell, t));

function bytes(renderable: Renderable): string {
  return renderToString(renderable, { width: 60 });
}

const subject = new RichText("a run of text under an effect", {
  style: Style.fromColor(ColorSpec.fromRgba(ink), ColorSpec.fromRgba(ground)),
  noWrap: true,
});
const drawn = (effect: Effect, t: number): string =>
  bytes(new Effected(subject, effect, { t, key: "test", theme: CATPPUCCIN_MOCHA }));

describe("each curve at rest draws the cells as they were, byte for byte", () => {
  const untouched = bytes(subject);

  it("pulse at the start of its period", () => {
    expect(drawn(onColors(inkOn, pulse(curve(3, 0.2), sun)), 0)).toBe(untouched);
  });

  it("shimmer before its band enters the row", () => {
    expect(drawn(onColors(inkOn, shimmer(curve(2, 0.7), 30, 8, sun, 0)), 0)).toBe(untouched);
  });

  it("fade-in once it has settled", () => {
    const fade = curve(2, 1);
    expect(drawn(fadeIn(fade, 5, 0), settledAt(fade, 5))).toBe(untouched);
  });

  it("dissolve-out before it starts", () => {
    expect(drawn(dissolveOut(curve(3, 1), 5, 0), 5)).toBe(untouched);
  });
});

describe("the loops move", () => {
  it("pulse warms toward its light on the inhale and settles back after the exhale", () => {
    const breath = pulse(curve(8, 0.4), sun);
    const top = under(breath, ink, cells[0]!, 3.4); // the inhale ends near 0.36 of a breath
    expect(distance(top, sun)).toBeLessThan(distance(ink, sun) - 0.02);
    expect(sameColor(under(breath, ink, cells[0]!, 7.6), ink)).toBe(true); // the rest before the next
  });

  it("light never darkens a colour, white included", () => {
    const white = new ColorRgba(255, 255, 255);
    for (const color of [white, ground, ink]) {
      expect(Oklch.fromRgba(light(sun)(color, 1)).l).toBeGreaterThanOrEqual(Oklch.fromRgba(color).l - 1e-3);
    }
  });

  it("a glint lifts light ink away from a dark ground", () => {
    expect(contrastRatio(ground, light(sun)(ink, 1))).toBeGreaterThan(contrastRatio(ground, ink));
  });

  it("sparkle lights a few cells at a time, each at its own strength", () => {
    const fireflies = onColors(inkOn, sparkle(curve(22, 0.5), 40, LIGHTS.firefly, 0));
    const moments = Array.from({ length: 60 }, (_, t) =>
      at(fireflies, t)
        .map((c) => c.fg)
        .filter((fg) => !sameColor(fg, ink)),
    );
    expect(moments.some((lit) => lit.length > 0)).toBe(true);
    expect(moments.every((lit) => lit.length < cells.length / 2)).toBe(true);
    // A glow is a halo, brightest where the firefly is: one moment's lit cells differ.
    expect(moments.some((lit) => new Set(lit.map((fg) => fg.hex)).size > 1)).toBe(true);
  });

  it("drift shifts hue along the row", () => {
    const moved = at(onColors(new Map([[ground.hex, 1]]), drift(curve(8, 40), 40, 0)), 0).map((c) => c.bg.hex);
    expect(new Set(moved).size).toBeGreaterThan(1);
  });

  it("drift silvers by how strong a gust is, not by how far its hue turns", () => {
    // A wide swing turns the hue further; it does not wash the colour out.
    const blue = new ColorRgba(137, 180, 250);
    const wide = drift(curve(30, 120), 104, 0);
    let palest = 0;
    for (let t = 0; t < 300; t += 3) for (const cell of cells) palest = Math.max(palest, Oklch.fromRgba(under(wide, blue, cell, t)).l);
    expect(palest).toBeLessThan(Oklch.fromRgba(blue).l + 0.09);
  });

  it("two elements under one effect do not move in lockstep", () => {
    const at = (z: number) => cells.map((cell) => sparkle(curve(22, 0.5), 40, LIGHTS.firefly, z).field(cell, 30)).join();
    expect(at(0)).not.toBe(at(11.3));
  });

  it("shimmer lights only the columns under its band", () => {
    const band = 8;
    // Halfway through a 2 s loop the band's centre is at the middle of span + 2·band.
    const lit = at(onColors(inkOn, shimmer(curve(2, 0.7), 40, band, sun, 0)), 1)
      .map((c, col) => (sameColor(c.fg, ink) ? -1 : col))
      .filter((col) => col >= 0);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(2 * band);
    expect(lit).toContain(20);
  });

  it("shimmer draws a colour wherever the noise peaks", () => {
    // Perlin noise reaches 0.9997 under a caustic's ripple at row 15, column
    // 59, t 114.5, where a crest of 1 − hypot(noise, 0.12) went below zero and
    // its power was NaN.
    const glint = shimmer(curve(48, 1), 400, 400, sun, 0);
    expect(Number.isFinite(glint.field({ row: 15, col: 59, seed: 0 }, 114.5))).toBe(true);
  });

  it("onColors leaves a colour not in its set alone", () => {
    const moved = onColors(new Map([[ground.hex, 1]]), pulse(curve(3, 0.2), sun))(colors, cells[0]!, 1.5);
    expect(moved.fg).toBe(ink);
    expect(sameColor(moved.bg, ground)).toBe(false);
  });
});

describe("the transitions run start to end", () => {
  it("a fade-in starts with every cell's ink on its ground", () => {
    expect(at(fadeIn(curve(2, 1), 4, 0), 4).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a fade-in arrives cell by cell", () => {
    const halfway = at(fadeIn(curve(2, 1), 0, 0), 1).map((c) => c.fg.hex);
    expect(new Set(halfway).size).toBeGreaterThan(1);
  });

  it("a dissolve-out leaves every cell's ink on its ground", () => {
    const dissolve = curve(3, 1);
    expect(at(dissolveOut(dissolve, 4, 0), settledAt(dissolve, 4)).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a dissolve-out thins cells gradually, some gone while others are still whole", () => {
    const midway = at(dissolveOut(curve(8, 1), 0, 0), 2.5).map((c) => c.fg);
    const thinning = midway.filter((fg) => !sameColor(fg, ink) && !sameColor(fg, ground));
    expect(thinning.length).toBeGreaterThan(0);
    expect(midway.some((fg) => sameColor(fg, ink))).toBe(true);
  });

  it("swing below 1 stops short of invisible", () => {
    expect(at(fadeIn(curve(2, 0.5), 0, 0), 0).some((c) => sameColor(c.fg, c.bg))).toBe(false);
  });
});

describe("the loops never jump", () => {
  // Claude Code redraws once a second, so that is where a step is largest.
  // A frame-to-frame move under two just-noticeable differences (dE_OK
  // ~0.02 each) reads as drift, not as a tick.
  const STEP = 0.04;
  // About the demo strip's width: a sweep crosses its span once a period, so
  // the wider the element the faster the band, and the strip is the widest.
  const SPAN = 104;
  const strip: EffectCell[] = Array.from({ length: 2 * SPAN }, (_, i) => ({ row: i % 2, col: Math.floor(i / 2), seed: 0 }));
  // Fills and ink the strip draws, each at its whole share: the most any moves.
  // Near black is left out: there 8-bit steps are large in OKLab's lightness
  // and a display's black level shows none of them.
  const fills: ColorRgba[] = [new ColorRgba(137, 180, 250), new ColorRgba(166, 227, 161), new ColorRgba(69, 71, 90), ink];
  // The curves as the demo runs them with no flags.
  const { curves } = parseSettings([])!;
  const loops = {
    pulse: pulse(curves.pulse, sun),
    shimmer: shimmer(curves.shimmer, SPAN, SHIMMER_WIDTH, sun, 0),
    drift: drift(curves.drift, SPAN, 0),
    sparkle: sparkle(curves.sparkle, SPAN, LIGHTS.firefly, 0),
  };
  it.each(Object.entries(loops))("%s moves no cell more than the bar between frames at 1 fps", (_, move) => {
    let worst = 0;
    for (const color of fills) {
      for (let t = 1; t < 300; t++) {
        for (const cell of strip) worst = Math.max(worst, distance(under(move, color, cell, t - 1), under(move, color, cell, t)));
      }
    }
    expect(worst).toBeLessThan(STEP);
  });
});

describe("a cell under light still reads", () => {
  const AA = 4.5;
  const palette = (theme: typeof CATPPUCCIN_MOCHA, key: string): ColorRgba => theme.palette.get(key)!;
  const cases: [string, Pair[], ColorRgba[]][] = [
    ["pale lettering on Mocha's muted fills", ["primary", "secondary", "accent", "success", "warning", "error"].map((k) => [palette(CATPPUCCIN_MOCHA, "foreground"), palette(CATPPUCCIN_MOCHA, `${k}-muted`)] as Pair), []],
    ["white lettering on Latte's fills", (["primary", "error"] as const).map((k) => [palette(CATPPUCCIN_LATTE, `on-${k}`), palette(CATPPUCCIN_LATTE, k)] as Pair), []],
    ["dark ink on Latte's own ground", [[palette(CATPPUCCIN_LATTE, "foreground-muted"), CATPPUCCIN_LATTE.backgroundColor]], [CATPPUCCIN_LATTE.backgroundColor]],
  ];
  it.each(cases)("%s: no strength takes a cell below its resting contrast or AA", (_, pairs, terminal) => {
    const touch = light(sun);
    const colors = new Set(pairs.flat().filter((c) => !terminal.includes(c)).map((c) => c.hex));
    const share = shares(pairs, colors, touch);
    for (const [fg, bg] of pairs) {
      const floor = Math.min(contrastRatio(fg, bg), AA);
      for (let w = 0; w <= 1; w += 0.05) {
        const lit = (c: ColorRgba) => touch(c, (share.get(c.hex) ?? 0) * w);
        expect(contrastRatio(lit(fg), lit(bg))).toBeGreaterThanOrEqual(floor - 0.02);
      }
    }
  });

  it("the lighter of a pair takes the whole light, and its darker partner what contrast is left", () => {
    const fg = palette(CATPPUCCIN_MOCHA, "foreground");
    const fill = palette(CATPPUCCIN_MOCHA, "secondary-muted");
    const share = shares([[fg, fill]], new Set([fg.hex, fill.hex]), light(sun));
    expect(share.get(fg.hex)).toBe(1);
    expect(share.get(fill.hex)).toBeGreaterThan(0);
    expect(share.get(fill.hex)).toBeLessThan(1);
  });
});
