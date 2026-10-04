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
  wheel,
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
/** A breath's turn as the demo runs it with no flags. */
const BREATH_SECONDS = parseSettings([])!.curves.pulse.seconds;
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

  it("the wheel at the start of its turn", () => {
    expect(drawn(wheel(curve(907, 0.25), new Set([ink.hex]), 0), 0)).toBe(untouched);
  });
});

describe("the wheel", () => {
  // Three fills a strip might draw, each a segment of its own, and the ink on them.
  const fills = [new ColorRgba(137, 180, 250), new ColorRgba(166, 227, 161), new ColorRgba(243, 139, 168)];
  const own = new Set([...fills.map((c) => c.hex), ink.hex]);
  const hue = (c: ColorRgba): number => Oklch.fromRgba(c).h;
  const turned = (from: ColorRgba, to: ColorRgba): number => (((hue(to) - hue(from)) % 360) + 360) % 360;
  const cell: EffectCell = { row: 0, col: 3, seed: 0 };

  it("turns every hue the whole way round once a period, lightness and chroma kept", () => {
    const P = 907;
    const round = wheel(curve(P, 0), own, 0);
    for (const fill of fills) {
      const at = (t: number) => round({ fg: ink, bg: fill }, cell, t).bg;
      // A quarter of the way round, a quarter turn; at the end, back.
      // To a degree or so: the sRGB round trip lands a step off.
      expect(Math.abs(turned(fill, at(P / 4)) - 90)).toBeLessThan(2);
      expect(Math.abs(turned(fill, at(P / 2)) - 180)).toBeLessThan(2);
      expect(Math.min(turned(fill, at(P)), 360 - turned(fill, at(P)))).toBeLessThan(1);
      const was = Oklch.fromRgba(fill);
      const is = Oklch.fromRgba(at(P / 3));
      expect(is.l).toBeCloseTo(was.l, 1);
      expect(is.c).toBeCloseTo(was.c, 1);
    }
  });

  it("turns a cell's ink and fill together, and leaves the terminal's colour alone", () => {
    const round = wheel(curve(907, 0.25), own, 0);
    const { fg, bg } = round({ fg: ink, bg: fills[0]! }, cell, 300);
    expect(turned(ink, fg)).toBeCloseTo(turned(fills[0]!, bg), 0);
    const text = round({ fg: ink, bg: ground }, cell, 300);
    expect(text.bg).toBe(ground);
    expect(turned(ink, text.fg)).toBeGreaterThan(0);
  });

  it("lets each segment stray from the shared turn by its own amount, within the swing", () => {
    const P = 907;
    const swing = 0.25;
    const round = wheel(curve(P, swing), own, 0);
    const strays = fills.map((fill) => {
      const got = turned(fill, round({ fg: ink, bg: fill }, cell, P / 2).bg);
      return ((got - 180 + 540) % 360) - 180;
    });
    // Apart from one another, and none past half a turn times the swing.
    expect(new Set(strays.map((s) => s.toFixed(0))).size).toBe(fills.length);
    for (const stray of strays) expect(Math.abs(stray)).toBeLessThanOrEqual(180 * swing + 1);
    expect(Math.max(...strays.map(Math.abs))).toBeGreaterThan(3);
  });

  it("moves no cell more than the bar between frames at 1 fps, at every magnitude", () => {
    const round = wheel(curve(907, 1), own, 0);
    let worst = 0;
    for (const fill of fills) {
      let last = round({ fg: ink, bg: fill }, cell, 0.5);
      for (let t = 1.5; t < 1800; t++) {
        const next = round({ fg: ink, bg: fill }, cell, t);
        worst = Math.max(worst, Oklch.fromRgba(last.bg).deltaE(Oklch.fromRgba(next.bg)), Oklch.fromRgba(last.fg).deltaE(Oklch.fromRgba(next.fg)));
        last = next;
      }
    }
    expect(worst).toBeLessThan(0.04);
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

  it.each([6, 12, 40, 104])("a breath keeps neighbouring cells one colour to the eye, %s columns wide", (span) => {
    // A fill drawn across two cells — a powerline seam and the cell it points
    // out of — reads as one colour (dE_OK 0.02) however narrow the element,
    // at the deepest swing and under every ease that does not step.
    const fill = new ColorRgba(137, 180, 250);
    const row = Array.from({ length: span }, (_, col) => ({ row: 0, col, seed: 0 }));
    const continuous = (["linear", "ease", "ease-in", "ease-out", "ease-in-out", "sine"] as const).map((name) => EASES[name]);
    let worst = 0;
    for (const ease of continuous) for (const z of [0, 11.3, 22.6]) {
      const breath = pulse({ seconds: BREATH_SECONDS, ease, swing: 1 }, span, sun, z);
      for (let t = 0; t < 1200; t += 0.5) {
        const drawn = row.map((cell) => under(breath, fill, cell, t));
        drawn.slice(1).forEach((color, i) => (worst = Math.max(worst, distance(drawn[i]!, color))));
      }
    }
    expect(worst).toBeLessThan(0.02);
  });

  it.each([40, 104, 1024])("between breaths the whole element rests, %s columns wide", (span) => {
    // Even a sigh is done at the farthest cell before the heart's next
    // breath begins, so each turn has a moment where nothing is lit.
    const row = Array.from({ length: span }, (_, col) => ({ row: 0, col, seed: 0 }));
    for (const z of [0, 11.3, 22.6]) {
      const breath = pulse(curve(BREATH_SECONDS, 0.5), span, sun, z);
      const still = (t: number): boolean => row.every((cell) => breath.field(cell, t) === 0);
      for (let turn = 0; turn < 20; turn++) {
        const moments = Array.from({ length: Math.round(BREATH_SECONDS * 10) }, (_, i) => turn * BREATH_SECONDS + i / 10);
        expect(moments.some(still), `z ${z}, turn ${turn}`).toBe(true);
      }
    }
  });

  it.each([0, 11.3, 22.6])("a sigh's inhale catches once and draws in again, at z %s", (z) => {
    // Somewhere in twenty minutes a cell's rise slows nearly to a stop
    // partway up and then climbs again before its peak; a plain breath's
    // rise only quickens and then eases into its peak.
    const breath = pulse(parseSettings([])!.curves.pulse, 82, sun, z);
    const cell = { row: 0, col: 41, seed: 0 };
    const w = Array.from({ length: 4800 }, (_, i) => breath.field(cell, i / 4));
    const caught = w.some((_, i) => {
      if (i < 8 || i + 8 >= w.length) return false;
      const rate = (j: number): number => w[j + 1]! - w[j]!;
      const before = Math.max(...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => rate(i - d)));
      const after = Math.max(...[1, 2, 3, 4, 5, 6, 7, 8].map((d) => rate(i + d)));
      return w[i]! > 0 && rate(i) >= 0 && rate(i) < 0.25 * Math.min(before, after);
    });
    expect(caught).toBe(true);
  });

  it("the breath after a sigh is a quiet one", () => {
    // A breath's height is the brightest any cell takes it to; a sigh is the
    // longest kind of breath, so the breaths are told apart by how long the
    // element is lit. Shallow breaths come in spells too, so the claim is
    // about the breaths after sighs taken together.
    const span = 82;
    const row = Array.from({ length: span }, (_, col) => ({ row: 0, col, seed: 0 }));
    const ratios = [0, 11.3, 22.6].flatMap((z) => {
      const breath = pulse(curve(BREATH_SECONDS, 1), span, sun, z);
      const breaths: { lit: number; peak: number }[] = [];
      let current: { lit: number; peak: number } | undefined;
      for (let t = 0; t < 40 * BREATH_SECONDS; t += 0.5) {
        const peak = Math.max(...row.map((cell) => breath.field(cell, t)));
        if (peak === 0) current = undefined;
        else if (current === undefined) breaths.push((current = { lit: 0.5, peak }));
        else [current.lit, current.peak] = [current.lit + 0.5, Math.max(current.peak, peak)];
      }
      const sigh = 0.9 * Math.max(...breaths.map((b) => b.lit));
      return breaths.slice(0, -1).flatMap((b, i) => (b.lit > sigh && breaths[i + 1]!.lit < sigh ? [breaths[i + 1]!.peak / b.peak] : []));
    });
    expect(ratios.length).toBeGreaterThan(5);
    expect(ratios.reduce((sum, r) => sum + r, 0) / ratios.length).toBeLessThan(0.6);
  });

  it.each([40, 104, 1024])("a breath swells once and ebbs once in every cell, %s columns wide", (span) => {
    // However far the heart wanders, a cell's breath only ever moves on: it
    // never turns back partway up the inhale or down the exhale.
    for (const z of [0, 11.3, 22.6]) for (let col = 0; col < span; col += Math.floor(span / 16)) {
      const breath = pulse(parseSettings([])!.curves.pulse, span, sun, z);
      const cell = { row: 0, col, seed: 0 };
      let [last, ebbing] = [0, false];
      for (let t = 0; t < 3600; t += 0.5) {
        const w = breath.field(cell, t);
        if (w === 0) ebbing = false;
        else if (w < last - 1e-4) ebbing = true;
        else if (w > last + 1e-4) expect(ebbing, `z ${z}, col ${col} at ${t}`).toBe(false);
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

  it("drift's wind gathers and slackens rather than running at one speed", () => {
    // The wind's pace at `t`, in columns a second: the shift, to a tenth of
    // a column, that best lines the row up with itself `GAP` seconds later.
    // Turbulence alone makes a steady wind's pace wander from one reading to
    // the next, so paces are averaged over half a minute, and the swing
    // between the stillest and the gustiest half-minute is what is read.
    const GAP = 3;
    const cols = Array.from({ length: 360 }, (_, i) => i + 20);
    const swings = [0, 11.3, 22.6].map((z) => {
      const gusts = drift(parseSettings([])!.curves.drift, z);
      const pace = (t: number): number => {
        const misfit = (d: number): number =>
          cols.reduce((sum, col) => sum + (gusts.field({ row: 0, col, seed: 0 }, t) - gusts.field({ row: 0, col: col + d, seed: 0 }, t + GAP)) ** 2, 0);
        const shifts = Array.from({ length: 61 }, (_, i) => i / 10);
        return shifts.reduce((best, d) => (misfit(d) < misfit(best) ? d : best), 0) / GAP;
      };
      const spells = Array.from({ length: 16 }, (_, i) => Array.from({ length: 8 }, (_, j) => pace(i * 75 + j * 4)).reduce((sum, p) => sum + p, 0) / 8);
      return Math.max(...spells) / Math.min(...spells);
    });
    expect(swings.reduce((sum, s) => sum + s, 0) / swings.length).toBeGreaterThan(2.5);
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
    const moved = at(onColors(new Map([[ground.hex, 1]]), drift(curve(8, 40), 0)), 0).map((c) => c.bg.hex);
    expect(new Set(moved).size).toBeGreaterThan(1);
  });

  it("drift silvers by how strong a gust is, not by how far its hue turns", () => {
    // A wide swing turns the hue further; it does not wash the colour out.
    const blue = new ColorRgba(137, 180, 250);
    const wide = drift(curve(30, 120), 0);
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
    const P = 2;
    const loop = shimmer(curve(P, 0.7), 40, band, sun, 0);
    // Each unbroken run of lit columns clear of both ends of the row is a band
    // standing wholly on it, or two overlapping: a band lights the columns
    // strictly within `band` of its centre, so one alone, its centre between
    // two columns, lights 2·band, and that is the run seen most often. The row
    // is never lit end to end.
    const rows = Array.from({ length: 400 }, (_, i) => cells.map((cell) => (loop.field(cell, i * 0.1) > 0 ? "x" : " ")).join(""));
    const runs = rows.flatMap((row) =>
      row
        .slice(1, -1)
        .split(" ")
        .slice(1, -1)
        .filter((run) => run.length > 0)
        .map((run) => run.length),
    );
    const seen = new Map<number, number>();
    for (const n of runs) seen.set(n, (seen.get(n) ?? 0) + 1);
    expect([...seen].sort((a, b) => b[1] - a[1])[0]?.[0]).toBe(2 * band);
    expect(rows.some((row) => !row.includes(" "))).toBe(false);
  });

  it("shimmer's passes come unevenly, as the sun goes in and out", () => {
    const P = 10;
    const loop = shimmer(curve(P, 0.7), 40, 8, sun, 0);
    // Whether any light is on the row, second by second, over sixty periods.
    const on = Array.from({ length: 60 * P }, (_, t) => cells.some((cell) => loop.field(cell, t) > 0));
    // The lengths of the unbroken runs where the light is `want`.
    const spells = (want: boolean): number[] =>
      on
        .map((now) => (now === want ? "x" : " "))
        .join("")
        .split(" ")
        .filter((run) => run.length > 0)
        .map((run) => run.length);
    // The first and last runs are cut by the window, so they measure it, not
    // the sky.
    const still = spells(false).slice(1, -1);
    const lit = spells(true).slice(1, -1);
    // Under cloud the row lies still for over a period, but never for long;
    // in sun, passes follow close enough that the light hardly leaves it.
    expect(Math.max(...still)).toBeGreaterThan(P);
    expect(Math.max(...still)).toBeLessThan(4 * P);
    expect(Math.min(...still)).toBeLessThan(P / 2);
    expect(Math.max(...lit)).toBeGreaterThan(2 * P);
  });

  it("shimmer draws a colour wherever the noise peaks", () => {
    // Perlin noise reaches 0.9997 under a caustic's ripple at row 15, column
    // 59, t 114.5, where a crest of 1 − hypot(noise, 0.12) went below zero and
    // its power was NaN.
    const glint = shimmer(curve(48, 1), 400, 400, sun, 0);
    expect(Number.isFinite(glint.field({ row: 15, col: 59, seed: 0 }, 114.5))).toBe(true);
  });

  it("onColors leaves a colour not in its set alone", () => {
    // A breath rests for part of its turn, so the turn is watched whole.
    const effect = onColors(new Map([[ground.hex, 1]]), pulse(curve(3, 0.2), 40, sun, 0));
    const turn = Array.from({ length: 30 }, (_, i) => effect(colors, cells[0]!, i / 10));
    expect(turn.every((moved) => moved.fg === ink)).toBe(true);
    expect(turn.some((moved) => !sameColor(moved.bg, ground))).toBe(true);
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
  // Fills and ink the strip draws, each at its whole share: the most any moves.
  // Near black is left out: there 8-bit steps are large in OKLab's lightness
  // and a display's black level shows none of them.
  const fills: ColorRgba[] = [new ColorRgba(137, 180, 250), new ColorRgba(166, 227, 161), new ColorRgba(69, 71, 90), ink];
  // The curves as the demo runs them with no flags.
  const { curves } = parseSettings([])!;
  const loops = {
    pulse: (span: number, z: number) => pulse(curves.pulse, span, sun, z),
    shimmer: (span: number, z: number) => shimmer(curves.shimmer, span, SHIMMER_WIDTH, sun, z),
    drift: (_span: number, z: number) => drift(curves.drift, z),
    sparkle: (span: number, z: number) => sparkle(curves.sparkle, span, LIGHTS.firefly, z),
  };
  // No loop repeats, so any watch is a sample of the moves it makes: five
  // minutes passed loops that jumped later on. Half an hour is a status
  // line's sitting, and every one of its seconds is a frame checked, on two
  // elements two rows deep, the second's frames falling between the first's:
  // one the demo strip's width, one a wide terminal's, since a light or a
  // gust keeps its pace however wide the row. A sample still under-reads the
  // worst step: an hour of these fills at 40, 104 and 240 columns, at z 0,
  // 1.7, 9.9, 22.6 and 47.2, takes pulse to 0.0395. That is the loop with
  // least room; any change that brightens or narrows one is measured over
  // that hour first.
  const WATCHED = 1800;
  const ELEMENTS = [
    { span: 104, z: 0, offset: 0 },
    { span: 240, z: 22.6, offset: 0.5 },
  ];
  it.each(Object.entries(loops))("%s moves no cell more than the bar between frames at 1 fps", (_, loop) => {
    let worst = 0;
    for (const { span, z, offset } of ELEMENTS) {
      const strip: EffectCell[] = Array.from({ length: 2 * span }, (_, i) => ({ row: i % 2, col: Math.floor(i / 2), seed: 0 }));
      for (const color of fills) {
        const move = loop(span, z);
        // A frame at a time, as a screen draws them.
        const frame = (t: number): ColorRgba[] => strip.map((cell) => under(move, color, cell, t));
        let last = frame(offset);
        for (let t = 1 + offset; t < WATCHED; t++) {
          const next = frame(t);
          next.forEach((now, i) => (worst = Math.max(worst, distance(last[i]!, now))));
          last = next;
        }
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
