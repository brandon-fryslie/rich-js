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
  renderToString,
  type CellColors,
  type Effect,
  type EffectCell,
  type Renderable,
} from "../../../src/index.js";
import { CATPPUCCIN_MOCHA } from "../../../src/index.js";
import {
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

const curve = (seconds: number, swing: number): Curve => ({ seconds, ease: EASES.linear, swing });

const ink = new ColorRgba(205, 214, 244);
const ground = new ColorRgba(30, 30, 46);
const colors: CellColors = { fg: ink, bg: ground };
const cells: EffectCell[] = Array.from({ length: 40 }, (_, col) => ({ row: 0, col, seed: (col * 0.6180339) % 1 }));

const sameColor = (a: ColorRgba, b: ColorRgba): boolean => a.red === b.red && a.green === b.green && a.blue === b.blue;
const distance = (a: ColorRgba, b: ColorRgba): number => Oklch.fromRgba(a).deltaE(Oklch.fromRgba(b));
const warm = new ColorRgba(255, 228, 176);
const firefly = new ColorRgba(222, 245, 140);
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
    expect(drawn(onColors(new Set([ink.hex]), pulse(curve(3, 0.2), warm)), 0)).toBe(untouched);
  });

  it("shimmer before its band enters the row", () => {
    expect(drawn(onColors(new Set([ink.hex]), shimmer(curve(2, 0.7), 30, 8, new ColorRgba(255, 255, 255))), 0)).toBe(untouched);
  });

  it("fade-in once it has settled", () => {
    const fade = curve(2, 1);
    expect(drawn(fadeIn(fade, 5), settledAt(fade, 5))).toBe(untouched);
  });

  it("dissolve-out before it starts", () => {
    expect(drawn(dissolveOut(curve(3, 1), 5), 5)).toBe(untouched);
  });
});

describe("the loops move", () => {
  it("pulse warms toward its light on the inhale and settles back after the exhale", () => {
    const breath = pulse(curve(8, 0.4), warm);
    const top = breath(ink, cells[0]!, 3.4); // the inhale ends near 0.36 of a breath
    expect(distance(top, warm)).toBeLessThan(distance(ink, warm) - 0.02);
    expect(sameColor(breath(ink, cells[0]!, 7.6), ink)).toBe(true); // the rest before the next
  });

  it("sparkle lights a few cells at a time, each at its own strength", () => {
    const lit = at(onColors(new Set([ink.hex]), sparkle(curve(22, 0.5), true, firefly)), 9)
      .map((c) => c.fg)
      .filter((fg) => !sameColor(fg, ink));
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(cells.length / 2);
    expect(new Set(lit.map((fg) => fg.hex)).size).toBeGreaterThan(1);
  });

  it("drift shifts hue along the row", () => {
    const moved = at(onColors(new Set([ground.hex]), drift(curve(8, 40), 40)), 0).map((c) => c.bg.hex);
    expect(new Set(moved).size).toBeGreaterThan(1);
  });

  it("shimmer lights only the columns under its band", () => {
    const band = 8;
    // Halfway through a 2 s loop the band's centre is at the middle of span + 2·band.
    const lit = at(onColors(new Set([ink.hex]), shimmer(curve(2, 0.7), 40, band, new ColorRgba(255, 255, 255))), 1)
      .map((c, col) => (sameColor(c.fg, ink) ? -1 : col))
      .filter((col) => col >= 0);
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.length).toBeLessThan(2 * band);
    expect(lit).toContain(20);
  });

  it("onColors leaves a colour not in its set alone", () => {
    const moved = onColors(new Set([ground.hex]), pulse(curve(3, 0.2), warm))(colors, cells[0]!, 1.5);
    expect(moved.fg).toBe(ink);
    expect(sameColor(moved.bg, ground)).toBe(false);
  });
});

describe("the transitions run start to end", () => {
  it("a fade-in starts with every cell's ink on its ground", () => {
    expect(at(fadeIn(curve(2, 1), 4), 4).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a fade-in arrives cell by cell", () => {
    const halfway = at(fadeIn(curve(2, 1), 0), 1).map((c) => c.fg.hex);
    expect(new Set(halfway).size).toBeGreaterThan(1);
  });

  it("a dissolve-out leaves every cell's ink on its ground", () => {
    const dissolve = curve(3, 1);
    expect(at(dissolveOut(dissolve, 4), settledAt(dissolve, 4)).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a dissolve-out thins cells gradually, some gone while others are still whole", () => {
    const midway = at(dissolveOut(curve(8, 1), 0), 2.5).map((c) => c.fg);
    const thinning = midway.filter((fg) => !sameColor(fg, ink) && !sameColor(fg, ground));
    expect(thinning.length).toBeGreaterThan(0);
    expect(midway.some((fg) => sameColor(fg, ink))).toBe(true);
  });

  it("swing below 1 stops short of invisible", () => {
    expect(at(fadeIn(curve(2, 0.5), 0), 0).some((c) => sameColor(c.fg, c.bg))).toBe(false);
  });
});

describe("the loops never jump", () => {
  // Claude Code redraws once a second, so that is where a step is largest.
  // A frame-to-frame move under about two just-noticeable differences
  // (dE_OK ~0.02 each) reads as drift, not as a tick.
  const STEP = 0.06;
  const fills = [new ColorRgba(137, 180, 250), new ColorRgba(166, 227, 161), new ColorRgba(243, 139, 168), ink];
  const loops = {
    pulse: pulse(curve(8, 0.35), warm),
    shimmer: shimmer(curve(60, 0.75), 40, 12, warm),
    drift: drift(curve(30, 14), 40),
    sparkle: sparkle(curve(22, 0.5), true, firefly),
  };
  it.each(Object.entries(loops))("%s moves no cell more than the bar between frames at 1 fps", (_, move) => {
    let worst = 0;
    for (const color of fills) {
      for (const cell of cells) {
        for (let t = 1; t < 120; t++) worst = Math.max(worst, distance(move(color, cell, t - 1), move(color, cell, t)));
      }
    }
    expect(worst).toBeLessThan(STEP);
  });
});
