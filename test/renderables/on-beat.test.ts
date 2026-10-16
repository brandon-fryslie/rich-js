// onBeat: any effect sampled and held on a beat — its time held at each
// hold's start — at one redraw a second and at sixty.

import { describe, expect, it } from "vitest";
import {
  CATPPUCCIN_MOCHA,
  ColorDepth,
  ColorRgba,
  EASES,
  Effected,
  Oklch,
  RichText,
  Style,
  beat,
  drawnOf,
  onBeat,
  wheel,
  type Effect,
} from "../../src/index.js";

// [LAW:behavior-not-structure] What is asserted is the colour a terminal is
// sent at each handed time: held within a hold, moved at each hold's start.

const label = new RichText(" rich-js ", { style: Style.parse("#1e1e2e on #89b4fa"), end: "", noWrap: true });
/** A wheel turning the whole way round in six seconds: a sixth of a turn a second, far from the catalogue's drift. */
const quick = wheel({ seconds: 6, ease: EASES.linear, swing: 0 }, 0);

/** The fill's hue at `t` under `effect`, in truecolor. */
function fillAt(effect: Effect, t: number): number {
  const segments = [...new Effected(label, effect, { t, key: "k", theme: CATPPUCCIN_MOCHA }).render({ maxWidth: 20, colorSystem: ColorDepth.TRUECOLOR })];
  const { pairs } = drawnOf(segments, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
  expect(pairs).toHaveLength(1);
  return Oklch.fromRgba(pairs[0]!.bg).h;
}
const turned = (from: number, to: number): number => (((to - from) % 360) + 360) % 360;

describe("onBeat — an effect sampled and held on a beat", () => {
  const walk = onBeat(quick, beat([1]));

  it("holds one colour within a step and changes at each step's start, sampled every 1/60 s", () => {
    const samples = Array.from({ length: 180 }, (_, i) => fillAt(walk, i / 60));
    const runs = samples.reduce<{ hue: number; count: number }[]>((runs, hue) => {
      const last = runs[runs.length - 1];
      if (last?.hue === hue) last.count++;
      else runs.push({ hue, count: 1 });
      return runs;
    }, []);
    expect(runs.map((run) => run.count)).toEqual([60, 60, 60]);
    // Each step is the wheel's frame at the step's start: a sixth of a turn on from the last.
    expect(turned(runs[0]!.hue, runs[1]!.hue)).toBeCloseTo(60, 0);
    expect(turned(runs[1]!.hue, runs[2]!.hue)).toBeCloseTo(60, 0);
  });

  it("draws the wheel's own frame at each hold's start, so sampled once a second the two agree", () => {
    for (const t of [0, 1, 2, 5, 1e6 + 3]) expect(fillAt(walk, t)).toBe(fillAt(quick, t));
  });

  it("a hold shorter than a second is skipped at one redraw a second, and seen at sixty", () => {
    const quarters = onBeat(quick, beat([0.25]));
    expect(new Set([0, 1, 2, 3].map((t) => fillAt(quarters, t))).size).toBe(4);
    for (const t of [0, 1, 2, 3]) expect(fillAt(quarters, t)).toBe(fillAt(quick, t));
    expect(new Set(Array.from({ length: 60 }, (_, i) => fillAt(quarters, i / 60))).size).toBe(4);
    const frozen = onBeat(quick, beat([0.25, 0.25, 0.25, 0.25]));
    expect(fillAt(frozen, 1.1)).toBe(fillAt(quick, 1));
  });

  it("holds may differ: each is drawn at its own start", () => {
    const uneven = onBeat(quick, beat([1, 0.5, 2.5]));
    expect(fillAt(uneven, 1.4)).toBe(fillAt(quick, 1));
    expect(fillAt(uneven, 1.5)).toBe(fillAt(quick, 1.5));
    expect(fillAt(uneven, 3.9)).toBe(fillAt(quick, 1.5));
    expect(fillAt(uneven, 4)).toBe(fillAt(quick, 4));
  });

  it("the held time reaches the effect as a time: an effect that reads nothing of it is unchanged", () => {
    const red: Effect = () => (colors) => ({ fg: new ColorRgba(255, 0, 0), bg: colors.bg });
    const held = onBeat(red, beat([1]));
    for (const t of [0, 0.3, 7.9]) expect(held(t, drawnOf([], ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA))({ fg: new ColorRgba(0, 0, 0), bg: new ColorRgba(0, 0, 0) }, { row: 0, col: 0, seed: 0, terminal: { fg: false, bg: false }, reverse: false, anchor: undefined }).fg.hex).toBe("#ff0000");
  });
});
