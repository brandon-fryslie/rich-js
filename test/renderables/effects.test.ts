// The effect catalogue: each effect rests on the untouched cell, and the two
// transitions start and end where they say they do.

import { describe, expect, it } from "vitest";
import {
  ColorDepth,
  ColorRgba,
  ColorSpec,
  EASES,
  cubicBezier,
  Effected,
  Oklch,
  RichText,
  Style,
  contrastRatio,
  relativeLuminance,
  renderToString,
  Console,
  DEFAULT_TERMINAL_THEME,
  JOINERS,
  TOKYO_NIGHT,
  Strip,
  Padding,
  confined,
  type CellColors,
  type Drawn,
  type Effect,
  type EffectCell,
  type Pair,
  type Placed,
  type Renderable,
  type Segment,
  type TerminalTheme,
} from "../../src/index.js";
import { CATPPUCCIN_LATTE, CATPPUCCIN_MOCHA } from "../../src/index.js";
import { drawnBy } from "../../src/core/anchor.js";
import { JOIN } from "../../src/core/strip.js";
import {
  EFFECT_CATALOGUE,
  EFFECT_CURVES,
  EFFECT_LIGHTS,
  SHIMMER_WIDTH,
  atShares,
  dissolveOut,
  fadeIn,
  light,
  onColors,
  pulse,
  shares,
  shimmer,
  sparkle,
  wheel,
  type Curve,
  type Loop,
  type LoopName,
} from "../../src/renderables/effects.js";

const curve = (seconds: number, swing: number): Curve => ({ seconds, ease: EASES.linear, swing });

const ink = new ColorRgba(205, 214, 244);
const ground = new ColorRgba(30, 30, 46);
const colors: CellColors = { fg: ink, bg: ground };
/** Neither colour the terminal's: both are the subject's own. */
const written = { fg: false, bg: false };
const cells: EffectCell[] = Array.from({ length: 40 }, (_, col) => ({ row: 0, col, seed: (col * 0.6180339) % 1, terminal: written, reverse: false, anchor: undefined }));

const sameColor = (a: ColorRgba, b: ColorRgba): boolean => a.red === b.red && a.green === b.green && a.blue === b.blue;
const distance = (a: ColorRgba, b: ColorRgba): number => Oklch.fromRgba(a).deltaE(Oklch.fromRgba(b));
const sun = EFFECT_LIGHTS.sun;
/** A frame of `cells` whose element sets `own` colours, `fills` of them as grounds: what an effect handed it reads. */
const frame = (own: ReadonlySet<string>, fills: ReadonlySet<string> = new Set(), pairs: readonly Pair[] = []): Drawn => ({
  cells: () => cells,
  pairs,
  colors: own,
  fills,
  depth: ColorDepth.TRUECOLOR,
  theme: CATPPUCCIN_MOCHA,
});
/** A frame of `cells` whose element sets no colours of its own: one a loop reads only the cells of. */
const NOTHING = frame(new Set());
/** `NOTHING`, listing `listed` instead: an element where those cells are. */
const listing = (listed: readonly Placed[]): Drawn => ({ ...NOTHING, cells: () => listed });
/** An effect's frames at each moment, every one drawing the same `Drawn`. */
type On = (t: number) => ReturnType<Effect>;
/** `effect` in frames that draw `drawn`. */
const on = (effect: Effect, drawn: Drawn): On => (t) => effect(t, drawn);
/** The ink at its whole share: the subject every curve here is tried on. */
const inkOn = new Map([[ink.hex, 1]]);
/** `loop` on the ink at its whole share. */
const onInk = (loop: Loop): Effect => atShares(loop, () => inkOn);
/** `color` under `loop` at a cell and moment, at its whole share. */
const under = (loop: Loop, color: ColorRgba, cell: EffectCell, t: number): ColorRgba => loop.touch(color, loop.field(t, NOTHING)(cell));
/** Every cell of `cells` in `effect`'s frame at `t`. */
const at = (effect: Effect, t: number): CellColors[] => {
  const shown = effect(t, NOTHING);
  return cells.map((cell) => shown(colors, cell));
};

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
    const breath = pulse(curve(3, 0.2), sun, z);
    expect(cells.map(breath.field(0, NOTHING))).toEqual(cells.map(() => 0));
    expect(drawn(onInk(breath), 0)).toBe(untouched);
  });

  it("shimmer before its band enters the row", () => {
    expect(drawn(onInk(shimmer(curve(2, 0.7), 8, sun, 0)), 0)).toBe(untouched);
  });

  it("fade-in once it has settled", () => {
    const fade = curve(2, 1);
    expect(drawn(fadeIn(fade, 0).effect, fade.seconds)).toBe(untouched);
  });

  it("dissolve-out as it starts", () => {
    expect(drawn(dissolveOut(curve(3, 1), 0).effect, 0)).toBe(untouched);
  });

  it("the wheel at the start of its turn", () => {
    expect(drawn(wheel(curve(907, 0.25), 0), 0)).toBe(untouched);
  });
});

describe("the wheel", () => {
  // Three fills a strip might draw, each a segment of its own, and the ink on them.
  const fills = [new ColorRgba(137, 180, 250), new ColorRgba(166, 227, 161), new ColorRgba(243, 139, 168)];
  const own = new Set([...fills.map((c) => c.hex), ink.hex]);
  const grounds = new Set(fills.map((c) => c.hex));
  const hue = (c: ColorRgba): number => Oklch.fromRgba(c).h;
  const turned = (from: ColorRgba, to: ColorRgba): number => (((hue(to) - hue(from)) % 360) + 360) % 360;
  const cell: EffectCell = { row: 0, col: 3, seed: 0, terminal: written, reverse: false, anchor: undefined };

  it("turns every hue the whole way round once a period, luminance and chroma kept", () => {
    const P = 907;
    const round = on(wheel(curve(P, 0), 0), frame(own, grounds));
    for (const fill of fills) {
      const at = (t: number) => round(t)({ fg: ink, bg: fill }, cell).bg;
      // A quarter of the way round, a quarter turn; at the end, back.
      // To a degree or so: the sRGB round trip lands a step off.
      expect(Math.abs(turned(fill, at(P / 4)) - 90)).toBeLessThan(2);
      expect(Math.abs(turned(fill, at(P / 2)) - 180)).toBeLessThan(2);
      expect(Math.min(turned(fill, at(P)), 360 - turned(fill, at(P)))).toBeLessThan(1);
      // Contrast is a ratio of luminances, so a turn that keeps luminance keeps every pair's.
      expect(relativeLuminance(at(P / 3))).toBeCloseTo(relativeLuminance(fill), 2);
      expect(Oklch.fromRgba(at(P / 3)).c).toBeCloseTo(Oklch.fromRgba(fill).c, 1);
    }
  });

  it("turns a cell's ink and fill together, and leaves the terminal's colour alone", () => {
    const round = on(wheel(curve(907, 0.25), 0), frame(own, grounds));
    const shown = round(300);
    const { fg, bg } = shown({ fg: ink, bg: fills[0]! }, cell);
    // The same turn, to a degree or so: the sRGB round trip lands a step off.
    expect(Math.abs(turned(ink, fg) - turned(fills[0]!, bg))).toBeLessThan(2);
    const text = shown({ fg: ink, bg: ground }, cell);
    expect(text.bg).toBe(ground);
    expect(turned(ink, text.fg)).toBeGreaterThan(0);
  });

  it("keeps a powerline cap the colour of the cell it caps: a fill turns at its own pace as ink too", () => {
    const round = on(wheel(curve(907, 0.25), 0), frame(own, grounds));
    const [a, b] = [fills[0]!, fills[1]!];
    const shown = round(300);
    const cellA = shown({ fg: ink, bg: a }, cell).bg;
    const cellB = shown({ fg: ink, bg: b }, { ...cell, col: 12 }).bg;
    const cap = shown({ fg: a, bg: b }, { ...cell, col: 11 });
    expect(cap.fg.hex).toBe(cellA.hex);
    expect(cap.bg.hex).toBe(cellB.hex);
    // The last cap, onto the terminal's ground, keeps its cell's colour too.
    expect(shown({ fg: b, bg: ground }, { ...cell, col: 20 }).fg.hex).toBe(cellB.hex);
  });

  it("lets each segment stray from the shared turn by its own amount, within the swing", () => {
    const P = 907;
    const swing = 0.25;
    const round = on(wheel(curve(P, swing), 0), frame(own, grounds));
    const shown = round(P / 2);
    const strays = fills.map((fill) => {
      const got = turned(fill, shown({ fg: ink, bg: fill }, cell).bg);
      return ((got - 180 + 540) % 360) - 180;
    });
    // Apart from one another, and none past half a turn times the swing.
    expect(new Set(strays.map((s) => s.toFixed(0))).size).toBe(fills.length);
    for (const stray of strays) expect(Math.abs(stray)).toBeLessThanOrEqual(180 * swing + 1);
    expect(Math.max(...strays.map(Math.abs))).toBeGreaterThan(3);
  });

  it("moves no cell more than the bar between frames at 1 fps, at every magnitude", () => {
    const round = on(wheel(curve(907, 1), 0), frame(own, grounds));
    let worst = 0;
    for (const fill of fills) {
      // From the first frame: the turn starts from the palette as drawn.
      let last = round(0)({ fg: ink, bg: fill }, cell);
      for (let t = 1; t < 1800; t++) {
        const next = round(t)({ fg: ink, bg: fill }, cell);
        worst = Math.max(worst, Oklch.fromRgba(last.bg).deltaE(Oklch.fromRgba(next.bg)), Oklch.fromRgba(last.fg).deltaE(Oklch.fromRgba(next.fg)));
        last = next;
      }
    }
    expect(worst).toBeLessThan(0.04);
  });
});

describe("the loops move", () => {
  it.each([0, 11.3, 22.6])("pulse warms toward its light and settles back to rest, over and over, at z %s", (z) => {
    const beat = pulse(curve(8, 0.4), sun, z);
    const series = Array.from({ length: 1200 }, (_, i) => beat.field(i / 4, NOTHING)(cells[0]!));
    expect(Math.max(...series)).toBeGreaterThan(0.4 * 0.7 * 0.9);
    expect(Math.max(...series)).toBeLessThanOrEqual(0.4);
    // Back at rest between beats, again and again: a run of rest after each.
    const rests = series.filter((w, i) => w < 1e-3 && (series[i - 1] ?? 0) >= 1e-3).length;
    expect(rests).toBeGreaterThan(20);
    // The colour it reaches is warmer toward the light, and rests as it was.
    expect(distance(under(beat, ink, cells[0]!, 0), ink)).toBe(0);
  });

  it("the element glows as one: every cell at once", () => {
    const beat = pulse(curve(8, 0.4), sun, 0);
    for (const t of [3, 17.5, 90]) expect(new Set(cells.map(beat.field(t, NOTHING))).size).toBe(1);
  });

  it("each element keeps a time of its own, and no beat is the last again", () => {
    const [a, b] = [pulse(curve(43, 0.5), sun, 3.7), pulse(curve(43, 0.5), sun, 7.4)];
    const apart = Array.from({ length: 400 }, (_, i) => Math.abs(a.field(i * 2, NOTHING)(cells[0]!) - b.field(i * 2, NOTHING)(cells[0]!)));
    expect(Math.max(...apart)).toBeGreaterThan(0.2);
    // Beats differ in depth: the tops of the first dozen are not one height.
    const tops = Array.from({ length: 12 }, (_, n) => Math.max(...Array.from({ length: 80 }, (_, i) => a.field(((n + i / 80) * 43) / 0.9, NOTHING)(cells[0]!))));
    expect(Math.max(...tops) - Math.min(...tops)).toBeGreaterThan(0.01);
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
    const fireflies = onInk(sparkle(curve(22, 0.5), EFFECT_LIGHTS.firefly, 0));
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

  it("two elements under one effect do not move in lockstep", () => {
    // Over two minutes, and lit within them: two dark elements draw alike
    // whatever their fireflies would have done.
    const at = (z: number) => {
      const loop = sparkle(curve(22, 0.5), EFFECT_LIGHTS.firefly, z);
      return Array.from({ length: 120 }, (_, t) => cells.map(loop.field(t, NOTHING))).flat();
    };
    expect(Math.max(...at(0))).toBeGreaterThan(0.25);
    expect(at(0)).not.toEqual(at(11.3));
  });

  it("shimmer lights only the columns under its band", () => {
    const band = 8;
    const P = 2;
    const loop = shimmer(curve(P, 0.7), band, sun, 0);
    // Each unbroken run of lit columns clear of both ends of the row is a band
    // standing wholly on it, or two overlapping: a band lights the columns
    // strictly within `band` of its centre, so one alone, its centre between
    // two columns, lights 2·band, and that is the run seen most often. The row
    // is never lit end to end.
    const rows = Array.from({ length: 400 }, (_, i) => cells.map(loop.field(i * 0.1, NOTHING)).map((w) => (w > 0 ? "x" : " ")).join(""));
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
    const loop = shimmer(curve(P, 0.7), 8, sun, 0);
    // Whether any light is on the row, second by second, over sixty periods.
    const on = Array.from({ length: 60 * P }, (_, t) => cells.map(loop.field(t, NOTHING)).some((w) => w > 0));
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

  it.each([
    ["shimmer", shimmer(curve(2, 0.7), 8, sun, 0)],
    ["sparkle", sparkle(curve(22, 0.5), EFFECT_LIGHTS.firefly, 0)],
  ])("%s lights every column of an element where its frame lists it, far from the screen's corner", (_, loop) => {
    // Three rows of forty columns, a hundred columns in and three rows down:
    // a padded or confined element. A width the caller stated would have
    // the light cross columns 0 to 40 and never reach it.
    const element = Array.from({ length: 120 }, (_, i): EffectCell => ({ row: 3 + (i % 3), col: 100 + Math.floor(i / 3), seed: 0, terminal: written, reverse: false, anchor: undefined }));
    const lit = new Set<number>();
    for (let t = 0; t < 400; t += 0.5) {
      const field = loop.field(t, listing(element));
      for (const cell of element) if (field(cell) > 0) lit.add(cell.col);
    }
    expect(lit.size).toBe(40);
  });

  /** An element `rows` deep and `columns` wide, drawn from row `top` and column `left`. */
  const block = (rows: number, columns: number, top = 0, left = 0): EffectCell[] =>
    Array.from({ length: rows * columns }, (_, i) => ({ row: top + Math.floor(i / columns), col: left + (i % columns), seed: 0, terminal: written, reverse: false, anchor: undefined }));

  it.each([
    ["a column", block(3, 28, 2, 50)],
    ["a row", block(4, 27, 2, 50)],
  ])("sparkle moves no light already on an element that gains %s", (_, grown) => {
    // A status line that streams one more character, or wraps onto one more
    // row, keeps every firefly it had where it was: 27 to 28 columns once
    // turned three fireflies into four, one of them mid-flash.
    const loop = sparkle(curve(22, 0.5), EFFECT_LIGHTS.firefly, 0);
    const element = block(3, 27, 2, 50);
    for (let t = 0; t < 200; t += 0.5) {
      const [was, now] = [loop.field(t, listing(element)), loop.field(t, listing(grown))];
      expect(element.map(now)).toEqual(element.map(was));
    }
  });

  it("sparkle lights every row of a tall element", () => {
    const loop = sparkle(curve(22, 0.5), EFFECT_LIGHTS.firefly, 0);
    const element = block(10, 40);
    const lit = new Set<number>();
    for (let t = 0; t < 400; t += 0.5) {
      const field = loop.field(t, listing(element));
      for (const cell of element) if (field(cell) > 0) lit.add(cell.row);
    }
    expect(lit.size).toBe(10);
  });

  it("shimmer draws a colour wherever the noise peaks", () => {
    // Perlin noise reaches 0.9997 under a caustic's ripple at row 15, column
    // 59, t 114.5, where a crest of 1 − hypot(noise, 0.12) went below zero and
    // its power was NaN.
    const glint = shimmer(curve(48, 1), 400, sun, 0);
    const wide = listing([0, 399].map((col) => ({ row: 0, col, anchor: undefined })));
    expect(Number.isFinite(glint.field(114.5, wide)({ row: 15, col: 59, seed: 0, terminal: written, reverse: false, anchor: undefined }))).toBe(true);
  });

  it("onColors and the wheel treat the terminal's colour as one outside the set, whatever its hex", () => {
    // The ground is in the set, but here it is the terminal's: a subject colour that shares its hex.
    const onTerminal = { fg: false, bg: true };
    const loop = pulse(curve(3, 0.2), sun, 0);
    const turn = curve(907, 0.25);
    const effects: [On, On][] = [
      [on(atShares(loop, () => new Map([[ink.hex, 1], [ground.hex, 1]])), NOTHING), on(onInk(loop), NOTHING)],
      [on(wheel(turn, 0), frame(new Set([ink.hex, ground.hex]), new Set([ground.hex]))), on(wheel(turn, 0), frame(new Set([ink.hex])))],
    ];
    for (const [effect, withoutGround] of effects) {
      const moments = Array.from({ length: 30 }, (_, i) => 100 + i / 10);
      const moved = moments.flatMap((t) => {
        const shown = effect(t);
        return cells.map((cell) => shown(colors, { ...cell, terminal: onTerminal }));
      });
      expect(moved).toEqual(moments.flatMap((t) => {
        const shown = withoutGround(t);
        return cells.map((cell) => shown(colors, cell));
      }));
      expect(moved.some(({ fg }) => !sameColor(fg, ink))).toBe(true);
    }
  });

  it("onColors leaves a colour not in its set alone", () => {
    // A beat starts at rest, so the turn is watched whole.
    const effect = on(atShares(pulse(curve(3, 0.2), sun, 0), () => new Map([[ground.hex, 1]])), NOTHING);
    const turn = Array.from({ length: 30 }, (_, i) => effect(i / 10)(colors, cells[0]!));
    expect(turn.every((moved) => moved.fg === ink)).toBe(true);
    expect(turn.some((moved) => !sameColor(moved.bg, ground))).toBe(true);
  });
});

describe("the catalogue makes every effect one way, by name", () => {
  const element = { z: 0 };
  const untouched = bytes(subject);
  /** Moments across `seconds`, where any loop has moved by. */
  const across = (seconds: number): number[] => Array.from({ length: 12 }, (_, i) => ((i + 1) / 12) * seconds);

  it("holds each effect a curve was signed off for (EFFECT_CURVES), and only those", () => {
    const names = [...Object.keys(EFFECT_CATALOGUE.loops), ...Object.keys(EFFECT_CATALOGUE.transitions)];
    expect(names.sort()).toEqual(Object.keys(EFFECT_CURVES).sort());
  });

  it.each(Object.entries(EFFECT_CATALOGUE.loops))("%s moves the element over its period, at its signed-off curve unless handed one", (name, make) => {
    const signed = EFFECT_CURVES[name as keyof typeof EFFECT_CATALOGUE.loops];
    const times = across(signed.seconds);
    const at = (effect: Effect): string[] => times.map((t) => drawn(effect, t));
    expect(at(make(element)).some((frame) => frame !== untouched)).toBe(true);
    expect(at(make(element))).toEqual(at(make(element, signed)));
    expect(at(make(element))).not.toEqual(at(make(element, { ...signed, seconds: signed.seconds / 3 })));
  });

  it.each(Object.entries(EFFECT_CATALOGUE.transitions))("%s is done at its signed-off duration unless handed another", (name, make) => {
    const { seconds } = EFFECT_CURVES[name as keyof typeof EFFECT_CATALOGUE.transitions];
    expect([seconds - 0.01, seconds].map((t) => make(element).done(t))).toEqual([false, true]);
    expect(make(element, curve(2, 1)).done(2)).toBe(true);
  });
});

describe("the transitions run start to end", () => {
  /** The ground of the terminal every frame here is drawn on: what a cell arrives from and leaves to. */
  const terminalGround = NOTHING.theme.backgroundColor;

  it("a fade-in starts with every cell's ink on its ground", () => {
    expect(at(fadeIn(curve(2, 1), 0).effect, 0).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a fade-in arrives cell by cell", () => {
    const halfway = at(fadeIn(curve(2, 1), 0).effect, 1).map((c) => c.fg.hex);
    expect(new Set(halfway).size).toBeGreaterThan(1);
  });

  it("a dissolve-out leaves every cell's ink on its ground", () => {
    const dissolve = curve(3, 1);
    expect(at(dissolveOut(dissolve, 0).effect, dissolve.seconds).every((c) => sameColor(c.fg, c.bg))).toBe(true);
  });

  it("a dissolve-out thins cells gradually, some gone while others are still whole", () => {
    const midway = at(dissolveOut(curve(8, 1), 0).effect, 2.5).map((c) => c.fg);
    const thinning = midway.filter((fg) => !sameColor(fg, ink) && !sameColor(fg, terminalGround));
    expect(thinning.length).toBeGreaterThan(0);
    expect(midway.some((fg) => sameColor(fg, ink))).toBe(true);
  });

  it("a cell with a fill of its own arrives from the terminal's ground, fill and ink together", () => {
    const fill = new ColorRgba(137, 180, 250);
    const filled = (effect: Effect, t: number) => effect(t, NOTHING)({ fg: ink, bg: fill }, cells[0]!);
    const fade = curve(2, 1);
    const start = filled(fadeIn(fade, 0).effect, 0);
    expect([start.fg.hex, start.bg.hex]).toEqual([terminalGround.hex, terminalGround.hex]);
    const end = filled(fadeIn(fade, 0).effect, fade.seconds);
    expect([end.fg.hex, end.bg.hex]).toEqual([ink.hex, fill.hex]);
  });

  it("the ground a cell arrives from and leaves to is that of the terminal the frame is drawn on", () => {
    const latte = { ...NOTHING, theme: CATPPUCCIN_LATTE };
    const ground = CATPPUCCIN_LATTE.backgroundColor.hex;
    const arriving = fadeIn(curve(2, 1), 0).effect(0, latte)(colors, cells[0]!);
    const gone = dissolveOut(curve(2, 1), 0).effect(2, latte)(colors, cells[0]!);
    expect([arriving.fg.hex, arriving.bg.hex, gone.fg.hex, gone.bg.hex]).toEqual([ground, ground, ground, ground]);
  });

  it("a dissolve-out lets some of what is left come back before it goes, and ends gone", () => {
    const dissolve = curve(30, 1);
    const effect = dissolveOut(dissolve, 0).effect;
    const wide: EffectCell[] = Array.from({ length: 120 }, (_, col) => ({ row: 0, col, seed: 0, terminal: written, reverse: false, anchor: undefined }));
    const of = { ...NOTHING, cells: () => wide };
    const shown = (cell: EffectCell, t: number): number => distance(effect(t, of)(colors, cell).fg, terminalGround);
    const risen = wide.filter((cell) => {
      const series = Array.from({ length: 600 }, (_, i) => shown(cell, i * 0.05));
      return series.some((v, i) => i > 0 && v - series[i - 1]! > 0.002);
    });
    // Some cells rise again; most are still only thinning.
    expect(risen.length).toBeGreaterThan(5);
    expect(risen.length).toBeLessThan(wide.length * 0.8);
    // Every cell rises from the first, whole, to the last, gone.
    for (const cell of wide) expect(sameColor(effect(dissolve.seconds, of)(colors, cell).fg, terminalGround)).toBe(true);
    for (const cell of wide) expect(sameColor(effect(0, of)(colors, cell).fg, ink)).toBe(true);
  });

  /** Draws a frame on a terminal whose ground a transition leaves to or arrives from. */
  const onGround = (ground: string) => {
    const theme = { ...CATPPUCCIN_MOCHA, backgroundColor: ColorSpec.parse(ground).getTruecolor() };
    return (renderable: Renderable, effect: Effect, t: number): string =>
      renderToString(new Effected(renderable, effect, { t, key: "p", theme }), { width: 40, colorSystem: ColorDepth.TRUECOLOR });
  };

  it.each([
    ["fade", " ◆ probe a ", "#33354e on #ff7825", "#eff1f5"],
    ["dissolve", " ◆ probe a ", "#1a1b26 on #ffb277", "#1a1b26"],
    ["fade", "x", "#33354e on #ff7825", "#eff1f5"],
    ["dissolve", "x", "#1a1b26 on #ffb277", "#1a1b26"],
  ] as const)("a %s over %j moves until its done, however few cells it has", (name, text, look, ground) => {
    const element = new RichText(text, { style: look, noWrap: true });
    const draw = onGround(ground);
    const { seconds } = EFFECT_CURVES[name];
    const transition = EFFECT_CATALOGUE.transitions[name]({ z: 0 });
    const at = (t: number) => draw(element, transition.effect, t);
    // It starts moving at once and is still moving shortly before done, which is when it stops.
    expect(at(seconds / 8)).not.toBe(at(0));
    expect(at(seconds - 3)).not.toBe(at(seconds));
    expect([transition.done(seconds - 3), transition.done(seconds)]).toEqual([false, true]);
    expect(at(1e6)).toBe(at(seconds));
  });

  it("a transition confined to one item of a strip moves that item until its done", () => {
    const items = ["#1e66f5", "#40a02b", "#d20f39"].map((fill) => new RichText(" item ", { style: `white on ${fill}`, end: "", noWrap: true }));
    const strip = new Strip(items, JOINERS.powerline);
    const draw = onGround("#1e1e2e");
    const { seconds } = EFFECT_CURVES.dissolve;
    const leaving = confined(EFFECT_CATALOGUE.transitions.dissolve({ z: 0 }).effect, items[1]!);
    expect(draw(strip, leaving, seconds - 2)).not.toBe(draw(strip, leaving, seconds));
    expect(draw(strip, leaving, 1e6)).toBe(draw(strip, leaving, seconds));
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("a fade at z %d over an element padded on the terminal's ground moves its glyph until it is done", (z) => {
    const element = new Padding(new RichText("x", { style: "#33354e on #ff7825", noWrap: true }), [0, 10]);
    const draw = onGround(DEFAULT_TERMINAL_THEME.backgroundColor.hex);
    const { seconds } = EFFECT_CURVES.fade;
    const { effect } = EFFECT_CATALOGUE.transitions.fade({ z });
    // What the glyph, ten cells in, is drawn in: the padding's bytes move too, with nothing in them to see.
    const glyph = (t: number): string => {
      let drawn = "";
      const reading: Effect = (at, frame) => {
        const moved = effect(at, frame);
        return (colors, cell) => {
          const out = moved(colors, cell);
          if (cell.col === 10) drawn = `${out.fg.hex}/${out.bg.hex}`;
          return out;
        };
      };
      draw(element, reading, t);
      return drawn;
    };
    expect(glyph(seconds - 3)).not.toBe(glyph(seconds));
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("a cell a fade at z %d has moved never goes back when the element gains cells as it moves", (z) => {
    const { effect } = fadeIn(curve(20, 1), z);
    const placed = (n: number): EffectCell[] => Array.from({ length: n }, (_, col) => ({ row: 0, col, seed: 0, terminal: written, reverse: false, anchor: undefined }));
    const [narrow, wide] = [placed(3), placed(12)];
    // The element gains its other columns halfway through; its first three are read throughout.
    const shown = (t: number): number[] => narrow.map((cell) => distance(effect(t, { ...NOTHING, cells: () => (t < 10 ? narrow : wide) })(colors, cell).fg, terminalGround));
    const series = Array.from({ length: 81 }, (_, i) => shown(i * 0.25));
    for (const [i, now] of series.entries()) {
      for (const [col, v] of now.entries()) if (i > 0) expect(v).toBeGreaterThanOrEqual(series[i - 1]![col]! - 1e-9);
    }
    expect(series.at(-1)!.every((v) => v > 0)).toBe(true);
  });

  it.each([0, 1, 2, 3, 4, 5, 6])("a cell a fade at z %d hands before it shows is spread over the order the element has once it does", (z) => {
    const placed = (n: number): EffectCell[] => Array.from({ length: n }, (_, col) => ({ row: 0, col, seed: 0, terminal: written, reverse: false, anchor: undefined }));
    const [narrow, grown] = [placed(3), placed(6)];
    const late = grown[5]!;
    const { effect } = fadeIn(curve(20, 1), z);
    // Handed while blank, listed by no frame yet.
    effect(2, { ...NOTHING, cells: () => narrow })(colors, late);
    const fresh = fadeIn(curve(20, 1), z).effect;
    expect(effect(8, { ...NOTHING, cells: () => grown })(colors, late).fg.hex).toBe(fresh(8, { ...NOTHING, cells: () => grown })(colors, late).fg.hex);
  });

  it("swing below 1 stops short of invisible", () => {
    expect(at(fadeIn(curve(2, 0.5), 0).effect, 0).some((c) => sameColor(c.fg, c.bg))).toBe(false);
  });

  it.each([
    ["fade-in", fadeIn],
    ["dissolve-out", dissolveOut],
  ])("a %s is done from the moment its last cell settles, and the cells stop changing then", (_, make) => {
    const transition = make(curve(6, 1), 0);
    expect([-1, 0, 5.99].map((t) => transition.done(t))).toEqual([false, false, false]);
    expect([6, 6.5, 1e6].map((t) => transition.done(t))).toEqual([true, true, true]);
    expect(at(transition.effect, 1e6)).toEqual(at(transition.effect, 6));
    expect(at(transition.effect, 2)).not.toEqual(at(transition.effect, 6));
  });

  it.each([
    ["fade-in", fadeIn],
    ["dissolve-out", dissolveOut],
  ])("a %s with no duration fails as it is made, not at its first frame", (_, make) => {
    expect(() => make(curve(0, 1), 0)).toThrow(/must be a positive number of seconds, got 0/);
  });

  it("an ease that overshoots saturates: the cells arrive whole, never past it", () => {
    const back = cubicBezier(0.34, 1.56, 0.64, 1);
    const fade = fadeIn({ seconds: 10, ease: back, swing: 1 }, 0);
    for (let t = 0; t <= 10; t += 0.1) for (const c of at(fade.effect, t)) expect(c.fg).toBeInstanceOf(ColorRgba);
    expect(at(fade.effect, 10)).toEqual(at(fade.effect, 1e6));
  });
});

describe("a curve is checked when its effect is made", () => {
  it.each([1.5, -0.1, Number.NaN])("a swing of %s, outside [0, 1], is refused", (swing) => {
    for (const make of [() => pulse(curve(4, swing), sun, 0), () => fadeIn(curve(4, swing), 0), () => wheel(curve(4, swing), 0)]) {
      expect(make).toThrow(/swing must be in \[0, 1\]/);
    }
  });

  it("a loop's field past 1, from an ease that overshoots, is drawn at full strength and no further", () => {
    const loop: Loop = { touch: light(sun), field: () => () => 1.3 };
    const full: Loop = { touch: light(sun), field: () => () => 1 };
    expect(onInk(loop)(0, NOTHING)(colors, cells[0]!)).toEqual(onInk(full)(0, NOTHING)(colors, cells[0]!));
  });
});

/**
 * Words in colours off any palette, seeded so every run draws the same
 * ones: half `reverse`, so the ink is written in the ground's slot, and a
 * fifth on the terminal's own ground. The theme's palettes are spaced for
 * reading and land where a touched colour is written alike either way;
 * arbitrary colours are where the shares and the wire part.
 */
function words(count: number): Style[] {
  let seed = 7;
  const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const rgb = (): ColorSpec => ColorSpec.fromRgba(new ColorRgba(Math.floor(next() * 256), Math.floor(next() * 256), Math.floor(next() * 256)));
  return Array.from({ length: count }, () => {
    const [color, bgcolor, reverse, terminalGround] = [rgb(), rgb(), next() < 0.5, next() < 0.2];
    return new Style({ color, bgcolor: terminalGround ? undefined : bgcolor, reverse });
  });
}

// Claude Code redraws once a second, so that is where a step is largest.
// A frame-to-frame move under two just-noticeable differences (dE_OK
// ~0.02 each) reads as drift, not as a tick.
const STEP = 0.04;

describe("the loops never jump", () => {
  // Fills and ink the strip draws, each at its whole share: the most any moves.
  // Near black is left out: there 8-bit steps are large in OKLab's lightness
  // and a display's black level shows none of them.
  const fills: ColorRgba[] = [new ColorRgba(137, 180, 250), new ColorRgba(166, 227, 161), new ColorRgba(69, 71, 90), ink];
  // The curves as the demo runs them with no flags.
  const curves = EFFECT_CURVES;
  const loops = {
    pulse: (z: number) => pulse(curves.pulse, sun, z),
    shimmer: (z: number) => shimmer(curves.shimmer, SHIMMER_WIDTH, sun, z),
    sparkle: (z: number) => sparkle(curves.sparkle, EFFECT_LIGHTS.firefly, z),
  };
  // No loop repeats, so any watch is a sample of the moves it makes: five
  // minutes passed loops that jumped later on. Half an hour is a status
  // line's sitting, and every one of its seconds is a frame checked, on two
  // elements two rows deep, the second's frames falling between the first's:
  // one the demo strip's width, one a wide terminal's, since a light keeps
  // its pace however wide the row. A sample still under-reads the worst
  // step, so any change that brightens or narrows a loop is measured over an
  // hour of these fills at 40, 104 and 240 columns, at z 0, 1.7, 9.9, 22.6
  // and 47.2, first.
  const WATCHED = 1800;
  const ELEMENTS = [
    { columns: 104, z: 0, offset: 0 },
    { columns: 240, z: 22.6, offset: 0.5 },
  ];
  it.each(Object.entries(loops))("%s moves no cell more than the bar between frames at 1 fps", (_, loop) => {
    let worst = 0;
    for (const { columns, z, offset } of ELEMENTS) {
      const strip: EffectCell[] = Array.from({ length: 2 * columns }, (_, i) => ({ row: i % 2, col: Math.floor(i / 2), seed: 0, terminal: written, reverse: false, anchor: undefined }));
      for (const color of fills) {
        const move = loop(z);
        const element = listing(strip);
        // A frame at a time, as a screen draws them.
        const frame = (t: number): ColorRgba[] => {
          const field = move.field(t, element);
          return strip.map((cell) => move.touch(color, field(cell)));
        };
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

describe("on a sixteen-colour terminal a loop holds still", () => {
  // Each element drawn on its own, as a share is settled against only what
  // one element draws: every slot as a ground under the slot half the
  // palette away as ink, and the strip that found it, a fill off the palette
  // that "ansi" writes as a slot.
  const slot = (i: number): ColorSpec => ColorSpec.parse(`color(${i})`);
  const elements = [
    ...Array.from({ length: 16 }, (_, i) => new RichText(" ab ", { style: Style.fromColor(slot((i + 8) % 16), slot(i)) })),
    new RichText("   menu   ", { style: Style.parse("black on #648ee1") }),
  ];
  const themes = [["default", DEFAULT_TERMINAL_THEME], ["tokyo-night", TOKYO_NIGHT]] as const;
  // Both depths that write the sixteen slots: the ANSI terminal's and the Windows console's.
  const depths = [["ansi", ColorDepth.STANDARD], ["windows", ColorDepth.WINDOWS]] as const;
  const cases = Object.entries(EFFECT_CATALOGUE.loops).flatMap(([name, make]) =>
    themes.flatMap(([theme, colors]) => depths.map(([depth, colorSystem]) => [name, theme, depth, make, colors, colorSystem] as const)),
  );

  it.each(cases)(
    "%s on %s at %s writes every cell on its slot at every second of its period",
    (name, _theme, _depth, make, theme, colorSystem) => {
      const seconds = EFFECT_CURVES[name as LoopName].seconds;
      const write = (renderable: Renderable): string => renderToString(renderable, { width: 20, colorSystem });
      const moved = elements.flatMap((element, e) => {
        const effect = make({ z: 7 });
        const rest = write(element);
        const t = Array.from({ length: seconds + 1 }, (_, t) => t).find((t) => write(new Effected(element, effect, { t, key: "k", theme })) !== rest);
        return t === undefined ? [] : [`element ${e} at t=${t}`];
      });
      expect(moved).toEqual([]);
    },
  );
});

describe("a cell under light still reads", () => {
  const AA = 4.5;
  const palette = (theme: typeof CATPPUCCIN_MOCHA, key: string): ColorRgba => theme.palette.get(key)!;
  const pair = (fg: ColorRgba, bg: ColorRgba, terminal = written): Pair => ({ fg, bg, terminal, reverse: false });
  const onTerminalGround = { fg: false, bg: true };
  const latteInk = palette(CATPPUCCIN_LATTE, "foreground-muted");
  const slate = new ColorRgba(48, 48, 48);
  const grey = new ColorRgba(160, 160, 160);
  const cases: [string, Pair[]][] = [
    ["pale lettering on Mocha's muted fills", ["primary", "secondary", "accent", "success", "warning", "error"].map((k) => pair(palette(CATPPUCCIN_MOCHA, "foreground"), palette(CATPPUCCIN_MOCHA, `${k}-muted`)))],
    ["white lettering on Latte's fills", (["primary", "error"] as const).map((k) => pair(palette(CATPPUCCIN_LATTE, `on-${k}`), palette(CATPPUCCIN_LATTE, k)))],
    ["dark ink on Latte's own ground", [pair(latteInk, CATPPUCCIN_LATTE.backgroundColor, onTerminalGround)]],
    // The fill moves and the terminal's ground of the same hex holds still: the ink is settled against both.
    // Settled as if that ground brightened with the fill, the ink would take light the still ground cannot spare.
    ["dark ink on a fill with the terminal ground's hex, and on that ground", [pair(slate, grey), pair(slate, grey, onTerminalGround)]],
  ];
  it.each(cases)("%s: no strength takes a cell below its resting contrast or AA", (_, pairs) => {
    const touch = light(sun);
    const colors = new Set(pairs.flatMap(({ fg, bg, terminal }) => [...(terminal.fg ? [] : [fg.hex]), ...(terminal.bg ? [] : [bg.hex])]));
    const effect = onColors({ touch, field: (t) => () => t });
    const drawn = frame(colors, new Set(), pairs);
    for (const { fg, bg, terminal } of pairs) {
      const floor = Math.min(contrastRatio(fg, bg), AA);
      for (let w = 0; w <= 1; w += 0.05) {
        const lit = effect(w, drawn)({ fg, bg }, { ...cells[0]!, terminal });
        expect(contrastRatio(lit.fg, lit.bg)).toBeGreaterThanOrEqual(floor - 0.02);
      }
    }
  });

  it("the lighter of a pair takes the whole light, and its darker partner what contrast is left", () => {
    const fg = palette(CATPPUCCIN_MOCHA, "foreground");
    const fill = palette(CATPPUCCIN_MOCHA, "secondary-muted");
    const share = shares(frame(new Set(), new Set(), [pair(fg, fill)]), new Set([fg.hex, fill.hex]), light(sun));
    expect(share.get(fg.hex)).toBe(1);
    expect(share.get(fill.hex)).toBeGreaterThan(0);
    expect(share.get(fill.hex)).toBeLessThan(1);
  });

  it("a colour no pair writes has nothing to stay legible against, and takes the whole touch", () => {
    const fg = palette(CATPPUCCIN_MOCHA, "foreground");
    const ground = CATPPUCCIN_MOCHA.backgroundColor;
    const accent = palette(CATPPUCCIN_MOCHA, "accent");
    expect(shares(frame(new Set(), new Set(), [pair(fg, ground, onTerminalGround)]), new Set([fg.hex, accent.hex]), light(sun)).get(accent.hex)).toBe(1);
    // The terminal's ground is in the pair, but the element never writes it.
    expect(shares(frame(new Set(), new Set(), [pair(fg, ground, onTerminalGround)]), new Set([fg.hex, ground.hex]), light(sun)).get(ground.hex)).toBe(1);
  });
});

describe("a loop lit on what Effected draws", () => {
  const AA = 4.5;
  const theme = CATPPUCCIN_MOCHA;
  const options = new Console({ width: 120, colorSystem: "truecolor" }).options;
  const keys = ["primary", "secondary", "accent", "success"];
  const items = keys.map(
    (key) =>
      new RichText(` ${key} `, {
        style: Style.fromColor(ColorSpec.fromRgba(theme.palette.get(`on-${key}`)!), ColorSpec.fromRgba(theme.palette.get(key)!)),
        end: "",
        noWrap: true,
      }),
  );
  const strip = new Strip(items, JOINERS.powerline);

  /** Each cell of `renderable` as the screen shows it: its glyph, its ink and ground, and whether it is lettering. */
  function cellsOf(renderable: Renderable): { glyph: string; fg: ColorRgba; bg: ColorRgba; lettered: boolean }[] {
    return [...renderable.render(options)].flatMap((segment) => {
      if (segment.isControl) return [];
      const style = segment.style ?? Style.null();
      const wire = style.drawnColors(ColorDepth.TRUECOLOR);
      const slots = { fg: wire.color?.getTruecolor(theme, true) ?? theme.foregroundColor, bg: wire.bgcolor?.getTruecolor(theme, false) ?? theme.backgroundColor };
      const { fg, bg } = style.reverse === true ? { fg: slots.bg, bg: slots.fg } : slots;
      // An item's lettering is the only text here a RichText drew: a seam is a join's, and carries its stamp.
      const lettered = style.anchor === undefined;
      return [...segment.text].filter((glyph) => glyph !== "\n").map((glyph) => ({ glyph, fg, bg, lettered: lettered && glyph.trim() !== "" }));
    });
  }
  const rest = cellsOf(strip);

  it("shimmer lights a strip with no pairs computed by the caller, and every word still reads", () => {
    const lit = onColors(shimmer({ ...EFFECT_CURVES.shimmer, swing: 1 }, SHIMMER_WIDTH, sun, 0));
    let moved = 0;
    for (let t = 0; t < 4 * EFFECT_CURVES.shimmer.seconds; t += 3) {
      const now = cellsOf(new Effected(strip, lit, { t, key: "strip", theme }));
      expect(now.map((c) => c.glyph).join("")).toBe(rest.map((c) => c.glyph).join(""));
      now.forEach((cell, i) => {
        const was = rest[i]!;
        if (was.lettered) expect(contrastRatio(cell.fg, cell.bg)).toBeGreaterThanOrEqual(Math.min(contrastRatio(was.fg, was.bg), AA) - 0.02);
        if (!sameColor(cell.fg, was.fg) || !sameColor(cell.bg, was.bg)) moved++;
      });
    }
    expect(moved).toBeGreaterThan(0);
  });

  it("a lit fill no word sits on lights whole: a frame drawing it only under blanks draws", () => {
    const words = new RichText(" hi ", { style: Style.fromColor(ColorSpec.fromRgba(theme.palette.get("on-primary")!), ColorSpec.fromRgba(theme.palette.get("primary")!)), end: "", noWrap: true });
    const fill = theme.palette.get("secondary")!;
    const blank = new RichText("   ", { style: Style.fromColor(ColorSpec.fromRgba(theme.palette.get("on-secondary")!), ColorSpec.fromRgba(fill)), end: "", noWrap: true });
    const bare = new Strip([words, blank], JOINERS.powerline);
    const lit = onColors({ touch: light(sun), field: () => () => 1 }, new Set([fill.hex]));
    const cells = [...new Effected(bare, lit, { t: 0, key: "bare", theme }).render(options)].flatMap((segment) =>
      segment.style?.bgcolor === undefined ? [] : [segment.style.bgcolor.getTruecolor(theme, false)],
    );
    expect(cells.some((bg) => !sameColor(bg, fill) && sameColor(bg, light(sun)(fill, 1)))).toBe(true);
  });

  it("the wheel turns each seam's ink with the fill of the cell it points out of, read off the strip", () => {
    const round = wheel(EFFECT_CURVES.wheel, 0);
    for (const t of [150, 400, 700]) {
      const now = cellsOf(new Effected(strip, round, { t, key: "strip", theme }));
      // A seam between two cells: the glyph whose ink, at rest, is the fill before it.
      const seams = rest.flatMap((was, i) => (i > 0 && !was.lettered && was.glyph.trim() !== "" && sameColor(was.fg, rest[i - 1]!.bg) ? [i] : []));
      // Three seams between the four cells, and the tail after the last.
      expect(seams).toHaveLength(keys.length);
      for (const i of seams) expect(now[i]!.fg.hex).toBe(now[i - 1]!.bg.hex);
      expect(now.some((cell, i) => !sameColor(cell.bg, rest[i]!.bg))).toBe(true);
    }
  });

  it("settles its shares once for what an element draws, not once a frame", () => {
    let touches = 0;
    const glow = light(sun);
    const loop: Loop = { touch: (color, w) => (touches++, glow(color, w)), field: () => () => 0.5 };
    const lit = onColors(loop);
    const frameAt = (t: number): number => {
      touches = 0;
      cellsOf(new Effected(strip, lit, { t, key: "strip", theme }));
      return touches;
    };
    const first = frameAt(0);
    // The first frame settles every colour; after it, a frame touches each slot of each cell at most once.
    expect(frameAt(1)).toBeLessThanOrEqual(2 * rest.length);
    expect(first).toBeGreaterThan(10 * frameAt(2));
  });
});

describe("a loop lit reads as the wire writes it", () => {
  const AA = 4.5;
  /**
   * Each depth with the only slack a word cell gets there: what 8-bit
   * rounding of an OKLCH round trip can cost a contrast ratio in truecolor,
   * and nothing at 256, where every colour written is one the depth holds
   * exactly. At 16 a loop holds still, which its own suite checks.
   */
  const depths = [
    ["truecolor", ColorDepth.TRUECOLOR, "truecolor", 0.01],
    ["256", ColorDepth.EIGHT_BIT, "256", 0],
  ] as const;
  const themes = [["Mocha", CATPPUCCIN_MOCHA], ["Latte", CATPPUCCIN_LATTE]] as const;
  /** The sun's light, and a touch that thins a colour, which the wire lays on what is beneath it. */
  const touches = [["sunlight", light(sun)], ["thinning", (c: ColorRgba, w: number) => new ColorRgba(c.red, c.green, c.blue, 1 - w / 2)]] as const;

  /** The worst contrast of a word cell of `segments` as the wire writes them at `depth`, read on `theme`. */
  function worst(segments: Iterable<Segment>, depth: ColorDepth, theme: TerminalTheme): number {
    return Math.min(
      ...[...segments].flatMap((segment) => {
        if (segment.isControl) return [];
        const style = segment.style ?? Style.null();
        const wire = style.drawnColors(depth);
        const slots = { fg: (wire.color ?? ColorSpec.default()).getTruecolor(theme, true), bg: (wire.bgcolor ?? ColorSpec.default()).getTruecolor(theme, false) };
        const { fg, bg } = style.reverse === true ? { fg: slots.bg, bg: slots.fg } : slots;
        return [contrastRatio(fg, bg)];
      }),
    );
  }

  it.each(touches.flatMap(([t, touch]) => themes.flatMap(([name, theme]) => depths.map(([d, depth, system, slack]) => [t, name, d, touch, theme, depth, system, slack] as const))))(
    "%s on %s at %s colours: no word cell falls below its resting contrast or AA",
    (_t, _name, _d, touch, theme, depth, system, slack) => {
      const options = new Console({ width: 40, colorSystem: system }).options;
      const strengths = Array.from({ length: 12 }, (_, i) => (i + 1) / 12);
      const failures = words(100).flatMap((style) => {
        const word = new RichText("ab", { style, end: "", noWrap: true });
        const floor = Math.min(worst(word.render(options), depth, theme), AA) - slack;
        return strengths.flatMap((w) => {
          const lit = new Effected(word, onColors({ touch, field: () => () => w }), { t: 0, key: "word", theme });
          const now = worst(lit.render(options), depth, theme);
          return now < floor ? [`${style} at ${w.toFixed(2)}: ${now.toFixed(3)} under ${floor.toFixed(3)}`] : [];
        });
      });
      expect(failures).toEqual([]);
    },
  );
});

describe("every loop keeps its words legible at every depth, the whole of its period", () => {
  const AA = 4.5;
  // At 16 colours a loop holds still, and holding still takes nothing away.
  const depths = [["truecolor", 0.01], ["256", 0], ["ansi", 0]] as const;
  const themes = [["default", DEFAULT_TERMINAL_THEME], ["tokyo-night", TOKYO_NIGHT]] as const;
  const mocha = (key: string): ColorSpec => ColorSpec.fromRgba(CATPPUCCIN_MOCHA.palette.get(key)!);
  const elements: [string, Renderable][] = [
    // The settings door cc-candybar found: dark ink on a mid blue, resting at 5.3:1.
    ["dark ink on a mid blue", new RichText(" menu ", { style: Style.parse("#1a1b26 on #648ee1"), end: "", noWrap: true })],
    // One fill under a lighter ink and a darker one, each resting under AA: the fill may move neither way.
    ["a fill between its inks", new RichText(" ab ", { style: Style.parse("#d0b080 on #7a5ea8"), end: "", noWrap: true }).append(" cd ", Style.parse("#1e2a1a on #7a5ea8"))],
    ["a powerline strip", new Strip(["primary", "secondary", "accent", "success"].map((key) => new RichText(` ${key} `, { style: Style.fromColor(mocha(`on-${key}`), mocha(key)), end: "", noWrap: true })), JOINERS.powerline)],
    ...words(12).map((style, i): [string, Renderable] => [`words ${i}`, new RichText(" ab ", { style, end: "", noWrap: true })]),
  ];

  /** Each cell `renderable` draws as the screen shows it at `colorSystem` on `theme`, and whether it is a word cell as `Drawn` counts one. */
  function screen(renderable: Renderable, colorSystem: (typeof depths)[number][0], theme: TerminalTheme): { fg: ColorRgba; bg: ColorRgba; word: boolean }[] {
    const options = new Console({ width: 80, colorSystem }).options;
    const depth = options.colorSystem!;
    return [...renderable.render(options)].flatMap((segment) => {
      if (segment.isControl) return [];
      const style = segment.style ?? Style.null();
      const wire = style.drawnColors(depth);
      const slots = { fg: (wire.color ?? ColorSpec.default()).getTruecolor(theme, true), bg: (wire.bgcolor ?? ColorSpec.default()).getTruecolor(theme, false) };
      const { fg, bg } = style.reverse === true ? { fg: slots.bg, bg: slots.fg } : slots;
      return [...segment.text].filter((glyph) => glyph !== "\n").map((glyph) => ({ fg, bg, word: glyph.trim() !== "" && !drawnBy(style.anchor, JOIN) }));
    });
  }

  const cases = Object.entries(EFFECT_CATALOGUE.loops).flatMap(([name, make]) =>
    themes.flatMap(([theme, colors]) => depths.map(([depth, slack]) => [name, theme, depth, make, colors, slack] as const)),
  );
  it.each(cases)("%s on %s at %s: no word cell falls below its resting contrast or AA, at any second", (name, _theme, depth, make, theme, slack) => {
    const seconds = EFFECT_CURVES[name as LoopName].seconds;
    const failures = elements.flatMap(([label, element]) => {
      const rest = screen(element, depth, theme);
      const effect = make({ z: 7 });
      for (let t = 0; t <= seconds; t++) {
        const now = screen(new Effected(element, effect, { t, key: label, theme }), depth, theme);
        const under = rest.findIndex((was, i) => was.word && contrastRatio(now[i]!.fg, now[i]!.bg) < Math.min(contrastRatio(was.fg, was.bg), AA) - slack);
        if (under >= 0) return [`${label} at t=${t}: ${now[under]!.fg.hex} on ${now[under]!.bg.hex}, rested ${rest[under]!.fg.hex} on ${rest[under]!.bg.hex}`];
      }
      return [];
    });
    expect(failures).toEqual([]);
  });

  // The wheel turns slowly, so a frame-to-frame step is only ever a colour
  // snapping: between its turn and its rest, where its rounding fits at one
  // hue and not the next. At 256 colours every step is to another indexed
  // colour, so it is measured where the rounding is finest.
  it("the wheel at truecolor moves no cell more than the bar between frames at 1 fps", () => {
    const theme = DEFAULT_TERMINAL_THEME;
    const failures = elements.flatMap(([label, element]) => {
      const effect = EFFECT_CATALOGUE.loops.wheel({ z: 7 });
      const at = (t: number) => screen(new Effected(element, effect, { t, key: label, theme }), "truecolor", theme);
      let last = at(0);
      for (let t = 1; t <= EFFECT_CURVES.wheel.seconds; t++) {
        const now = at(t);
        const jump = now.findIndex((cell, i) => Math.max(distance(cell.fg, last[i]!.fg), distance(cell.bg, last[i]!.bg)) >= STEP);
        if (jump >= 0) return [`${label} at t=${t}: ${last[jump]!.fg.hex} on ${last[jump]!.bg.hex} to ${now[jump]!.fg.hex} on ${now[jump]!.bg.hex}`];
        last = now;
      }
      return [];
    });
    expect(failures).toEqual([]);
  });
});
