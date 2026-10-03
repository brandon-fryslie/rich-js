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
import { CATPPUCCIN_MOCHA } from "../../../src/index.js";
import {
  catches,
  dissolveOut,
  drift,
  fadeIn,
  onColors,
  pulse,
  settledAt,
  shimmer,
  sparkle,
  type Curve,
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
/** The ink, read against the ground: the subject every curve here is tried on. */
const inkOn = new Map([[ink.hex, catches(ink, ground)]]);
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
    const top = breath(ink, catches(ink, ground), cells[0]!, 3.4); // the inhale ends near 0.36 of a breath
    expect(distance(top, sun)).toBeLessThan(distance(ink, sun) - 0.02);
    expect(sameColor(breath(ink, catches(ink, ground), cells[0]!, 7.6), ink)).toBe(true); // the rest before the next
  });

  it.each(["primary", "secondary", "accent", "success", "warning", "error"])(
    "a glint lifts the %s-muted fill and its lettering together, the fill less, so the lettering stays legible",
    (key) => {
      // Swing 1 at the top of a breath: as far into the light as any glint goes.
      const fill = CATPPUCCIN_MOCHA.palette.get(`${key}-muted`)!;
      const breath = pulse(curve(8, 1), sun);
      const litFill = breath(fill, catches(fill, ink), cells[0]!, 3.4);
      const litInk = breath(ink, catches(ink, fill), cells[0]!, 3.4);
      expect(Oklch.fromRgba(litFill).l).toBeGreaterThan(Oklch.fromRgba(fill).l);
      expect(contrastRatio(litInk, litFill)).toBeGreaterThan(0.8 * contrastRatio(ink, fill));
    },
  );

  it("light never darkens a colour, white included", () => {
    const white = new ColorRgba(255, 255, 255);
    const breath = pulse(curve(8, 1), sun);
    for (const [color, against] of [[white, ground], [ground, white], [ink, ground]] as const) {
      expect(Oklch.fromRgba(breath(color, catches(color, against), cells[0]!, 3.4)).l).toBeGreaterThanOrEqual(Oklch.fromRgba(color).l - 1e-3);
    }
  });

  it("a glint lifts light ink away from a dark ground", () => {
    const top = pulse(curve(8, 1), sun)(ink, catches(ink, ground), cells[0]!, 3.4);
    expect(contrastRatio(ground, top)).toBeGreaterThan(contrastRatio(ground, ink));
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
    const moved = at(onColors(new Map([[ground.hex, catches(ground, ink)]]), drift(curve(8, 40), 40, 0)), 0).map((c) => c.bg.hex);
    expect(new Set(moved).size).toBeGreaterThan(1);
  });

  it("drift silvers by how strong a gust is, not by how far its hue turns", () => {
    // A wide swing turns the hue further; it does not wash the colour out.
    const blue = new ColorRgba(137, 180, 250);
    const wide = drift(curve(30, 120), 104, 0);
    let palest = 0;
    for (let t = 0; t < 300; t += 3) for (const cell of cells) palest = Math.max(palest, Oklch.fromRgba(wide(blue, catches(blue, ground), cell, t)).l);
    expect(palest).toBeLessThan(Oklch.fromRgba(blue).l + 0.05);
  });

  it("two elements under one effect do not move in lockstep", () => {
    const at = (z: number) => cells.map((cell) => sparkle(curve(22, 0.5), 40, LIGHTS.firefly, z)(ink, catches(ink, ground), cell, 30).hex).join();
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
    expect(() => glint(ink, catches(ink, ground), { row: 15, col: 59, seed: 0 }, 114.5)).not.toThrow();
  });

  it("onColors leaves a colour not in its set alone", () => {
    const moved = onColors(new Map([[ground.hex, catches(ground, ink)]]), pulse(curve(3, 0.2), sun))(colors, cells[0]!, 1.5);
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
  // Each fill the strip draws, with the ink it is read against.
  const fills: [ColorRgba, ColorRgba][] = [
    [new ColorRgba(137, 180, 250), ground],
    [new ColorRgba(166, 227, 161), ground],
    [new ColorRgba(69, 71, 90), ink],
    [ink, ground],
  ];
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
    for (const [color, against] of fills) {
      for (let t = 1; t < 300; t++) {
        for (const cell of strip) worst = Math.max(worst, distance(move(color, catches(color, against), cell, t - 1), move(color, catches(color, against), cell, t)));
      }
    }
    expect(worst).toBeLessThan(STEP);
  });
});
