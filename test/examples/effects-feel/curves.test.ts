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

  it.each([0, 11.3, 22.6, 82.14])("pulse at the start of its period, at z %s", (z) => {
    const breath = pulse(curve(3, 0.2), 40, sun, z);
    expect(cells.map((cell) => breath.field(cell, 0))).toEqual(cells.map(() => 0));
    expect(drawn(onColors(inkOn, breath), 0)).toBe(untouched);
  });

  it("shimmer before its band enters the row", () => {
    expect(drawn(onColors(inkOn, shimmer(curve(2, 0.7), 30, 8, sun, 0)), 0)).toBe(untouched);
  });

  it("fade-in once it has settled", () => {
    const fade = curve(2, 1);
    expect(drawn(fadeIn(fade, 5, 0, ground), settledAt(fade, 5))).toBe(untouched);
  });

  it("dissolve-out before it starts", () => {
    expect(drawn(dissolveOut(curve(3, 1), 5, 0, ground), 5)).toBe(untouched);
  });
});

describe("the loops move", () => {
  it.each([0, 11.3, 22.6])("pulse warms toward its light on the inhale and settles back after the exhale, at z %s", (z) => {
    const breath = pulse(curve(8, 0.4), 40, sun, z);
    // Ten breaths: a shallow stretch can sit out a few shallow ones.
    const moments = Array.from({ length: 800 }, (_, i) => i / 10);
    for (const cell of cells) {
      // The warmest moment, wherever in its turn it comes.
      // Found in the first eight, so the rest after it falls inside the watch.
      const away = moments.map((t) => distance(under(breath, ink, cell, t), sun));
      const warmest = away.indexOf(Math.min(...away.slice(0, 640)));
      expect(away[warmest]).toBeLessThan(distance(ink, sun) - 0.02);
      // Every breath ends before the next begins, so after it each cell rests.
      expect(moments.slice(warmest).some((t) => sameColor(under(breath, ink, cell, t), ink))).toBe(true);
    }
  });

  it.each([40, 104, 1024])("a breath swells once and ebbs once in every cell, %s columns wide", (span) => {
    // However far the heart wanders, a cell's breath only ever moves on: it
    // never turns back partway up the inhale or down the exhale.
    const breath = pulse(parseSettings([])!.curves.pulse, span, sun, 11.3);
    for (let col = 0; col < span; col += span / 16) {
      const cell = { row: 0, col, seed: 0 };
      let [last, ebbing] = [0, false];
      for (let t = 0; t < 3600; t += 0.5) {
        const w = breath.field(cell, t);
        if (w === 0) ebbing = false;
        else if (w < last - 1e-4) ebbing = true;
        else if (w > last + 1e-4) expect(ebbing, `col ${col} at ${t}`).toBe(false);
        last = w;
      }
    }
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
    // Lit as an eye sees it: more than a just-noticeable difference from the
    // ink. A halo's faint edge changes a byte without lighting the cell.
    const moments = Array.from({ length: 60 }, (_, t) =>
      at(fireflies, t)
        .map((c) => c.fg)
        .filter((fg) => distance(fg, ink) > 0.02),
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
    // Over two minutes, and lit within them: two dark elements draw alike
    // whatever their fireflies would have done.
    const at = (z: number) => {
      const loop = sparkle(curve(22, 0.5), 40, LIGHTS.firefly, z);
      return Array.from({ length: 120 }, (_, t) => cells.map((cell) => loop.field(cell, t))).flat();
    };
    expect(Math.max(...at(0))).toBeGreaterThan(0.25);
    expect(at(0)).not.toEqual(at(11.3));
  });

  it("shimmer lights only the columns under its band", () => {
    const band = 8;
    // Halfway through a 2 s loop the band's centre is near the middle of
    // span + 2·band, its current carrying it a few columns either way.
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
    const moved = onColors(new Map([[ground.hex, 1]]), pulse(curve(3, 0.2), 40, sun, 0))(colors, cells[0]!, 1.5);
    expect(moved.fg).toBe(ink);
    expect(sameColor(moved.bg, ground)).toBe(false);
  });
});

describe("the transitions run start to end", () => {
  it("a fade-in starts with every cell's ink on its ground", () => {
    expect(at(fadeIn(curve(2, 1), 4, 0, ground), 4).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a fade-in arrives cell by cell", () => {
    const halfway = at(fadeIn(curve(2, 1), 0, 0, ground), 1).map((c) => c.fg.hex);
    expect(new Set(halfway).size).toBeGreaterThan(1);
  });

  it("a dissolve-out leaves every cell's ink on its ground", () => {
    const dissolve = curve(3, 1);
    expect(at(dissolveOut(dissolve, 4, 0, ground), settledAt(dissolve, 4)).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a dissolve-out thins cells gradually, some gone while others are still whole", () => {
    const midway = at(dissolveOut(curve(8, 1), 0, 0, ground), 2.5).map((c) => c.fg);
    const thinning = midway.filter((fg) => !sameColor(fg, ink) && !sameColor(fg, ground));
    expect(thinning.length).toBeGreaterThan(0);
    expect(midway.some((fg) => sameColor(fg, ink))).toBe(true);
  });

  it("a cell with a fill of its own arrives from the terminal's ground, fill and ink together", () => {
    const fill = new ColorRgba(137, 180, 250);
    const filled = (effect: Effect, t: number) => effect({ fg: ink, bg: fill }, cells[0]!, t);
    const fade = curve(2, 1);
    const start = filled(fadeIn(fade, 0, 0, ground), 0);
    expect([start.fg.hex, start.bg.hex]).toEqual([ground.hex, ground.hex]);
    const end = filled(fadeIn(fade, 0, 0, ground), settledAt(fade, 0));
    expect([end.fg.hex, end.bg.hex]).toEqual([ink.hex, fill.hex]);
  });

  it("swing below 1 stops short of invisible", () => {
    expect(at(fadeIn(curve(2, 0.5), 0, 0, ground), 0).some((c) => sameColor(c.fg, c.bg))).toBe(false);
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
    pulse: (z: number) => pulse(curves.pulse, SPAN, sun, z),
    shimmer: (z: number) => shimmer(curves.shimmer, SPAN, SHIMMER_WIDTH, sun, z),
    drift: (z: number) => drift(curves.drift, SPAN, z),
    sparkle: (z: number) => sparkle(curves.sparkle, SPAN, LIGHTS.firefly, z),
  };
  // No loop repeats, so any watch is a sample of the moves it makes: five
  // minutes passed loops that jumped later on. Half an hour is a status
  // line's sitting, and every one of its seconds is a frame checked, on two
  // elements, the second's frames falling between the first's. A sample
  // still under-reads the worst step, so the loops are tuned well under the
  // bar: an hour of four elements, at both offsets and at 40 columns as well,
  // took none past 0.037.
  const WATCHED = 1800;
  const ELEMENTS = [
    { z: 0, offset: 0 },
    { z: 22.6, offset: 0.5 },
  ];
  it.each(Object.entries(loops))("%s moves no cell more than the bar between frames at 1 fps", (_, loop) => {
    let worst = 0;
    for (const { z, offset } of ELEMENTS) for (const color of fills) {
      const move = loop(z);
      // A frame at a time, as a screen draws them.
      const frame = (t: number): ColorRgba[] => strip.map((cell) => under(move, color, cell, t));
      let last = frame(offset);
      for (let t = 1 + offset; t < WATCHED; t++) {
        const next = frame(t);
        next.forEach((now, i) => (worst = Math.max(worst, distance(last[i]!, now))));
        last = next;
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
