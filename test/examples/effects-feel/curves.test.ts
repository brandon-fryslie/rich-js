// The effects demo's curves: each rests on the untouched cell, and the two
// transitions start and end where they say they do.

import { describe, expect, it } from "vitest";
import {
  ColorRgba,
  ColorSpec,
  EASES,
  Effected,
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
    expect(drawn(onColors(new Set([ink.hex]), pulse(curve(3, 0.2), true)), 0)).toBe(untouched);
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
  it("pulse brightens away from a dark ground, and darkens away from a light one", () => {
    const peak = 1.5; // half of a 3 s ping-pong
    const up = onColors(new Set([ink.hex]), pulse(curve(3, 0.2), true))(colors, cells[0]!, peak).fg;
    const down = onColors(new Set([ink.hex]), pulse(curve(3, 0.2), false))(colors, cells[0]!, peak).fg;
    expect(up.red + up.green + up.blue).toBeGreaterThan(ink.red + ink.green + ink.blue);
    expect(down.red + down.green + down.blue).toBeLessThan(ink.red + ink.green + ink.blue);
  });

  it("sparkle's cells are out of step with one another", () => {
    const moved = at(onColors(new Set([ink.hex]), sparkle(curve(2, 0.2), true)), 0.3).map((c) => c.fg.hex);
    expect(new Set(moved).size).toBeGreaterThan(1);
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
    const moved = onColors(new Set([ground.hex]), pulse(curve(3, 0.2), true))(colors, cells[0]!, 1.5);
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

  it("a dissolve-out takes cells whole, one at a time", () => {
    const midway = at(dissolveOut(curve(3, 1), 0), 1.5);
    const gone = midway.filter((c) => sameColor(c.fg, c.bg)).length;
    expect(gone).toBeGreaterThan(0);
    expect(gone).toBeLessThan(cells.length);
    expect(midway.every((c) => sameColor(c.fg, c.bg) || sameColor(c.fg, ink))).toBe(true);
  });

  it("swing below 1 stops short of invisible", () => {
    expect(at(fadeIn(curve(2, 0.5), 0), 0).some((c) => sameColor(c.fg, c.bg))).toBe(false);
  });
});
