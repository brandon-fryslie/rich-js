// steppedInk: a signal whose ink steps through colours on a beat, legible on
// its ground at every depth, at one redraw a second and at sixty.

import { describe, expect, it } from "vitest";
import {
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MOCHA,
  ColorDepth,
  ColorRgba,
  DEFAULT_TERMINAL_THEME,
  Effected,
  FrameSequence,
  Frames,
  Oklch,
  RichText,
  Style,
  TOKYO_NIGHT,
  contrastRatio,
  drawnOf,
  renderToString,
  steppedInk,
  type ColorStep,
  type Effect,
  type Pair,
  type Renderable,
  type Segment,
  type TerminalTheme,
} from "../../src/index.js";

// [LAW:behavior-not-structure] What is asserted is what a terminal is sent:
// which colour each cell's ink is written in, at which handed time, and how
// it reads against the ground it is drawn on.

const AA = 4.5;

/** Bright, as a signal is: Dracula's red, yellow and green, a second each. */
const BRIGHT = [new ColorRgba(255, 85, 85), new ColorRgba(241, 250, 140), new ColorRgba(80, 250, 123)];
const STEPS: ColorStep[] = BRIGHT.map((color) => ({ color, seconds: 1 }));
const signal = steppedInk(STEPS);

/**
 * Each depth with the only slack a word cell gets there: what 8-bit rounding
 * of an OKLCH round trip can cost a contrast ratio in truecolor, and nothing
 * below it, where every colour written is one the depth holds exactly.
 */
const depths = [
  ["truecolor", ColorDepth.TRUECOLOR, 0.01],
  ["256", ColorDepth.EIGHT_BIT, 0],
  ["16", ColorDepth.STANDARD, 0],
] as const;
const themes = [["Mocha", CATPPUCCIN_MOCHA], ["Latte", CATPPUCCIN_LATTE], ["default", DEFAULT_TERMINAL_THEME], ["Tokyo Night", TOKYO_NIGHT]] as const;

/** Grounds a signal might be drawn on, each one style so each draws one pair. */
const subjects: readonly (readonly [string, Style])[] = [
  ["pale ink on a bubble", Style.parse("bold #cdd6f4 on #313244")],
  ["dark ink on a light fill", Style.parse("#1e1e2e on #89b4fa")],
  ["the terminal's own ink and ground", Style.parse("bold")],
  ["ink in the ground's slot", Style.parse("#1e1e2e on #a6e3a1 reverse")],
  ["a mid grey on a mid grey, resting below AA", Style.parse("#808080 on #606060")],
];

const word = (style: Style): RichText => new RichText("›››", { style, end: "", noWrap: true });
const render = (renderable: Renderable, depth: ColorDepth): Segment[] => [...renderable.render({ maxWidth: 40, colorSystem: depth })];
const lit = (subject: Renderable, t: number, depth: ColorDepth, theme: TerminalTheme): Segment[] =>
  render(new Effected(subject, signal, { t, key: "k", theme }), depth);
/** The one pair the word cells of `segments` draw, as the screen shows them at `depth`. */
const pairOf = (segments: Segment[], depth: ColorDepth, theme: TerminalTheme): Pair => {
  const { pairs } = drawnOf(segments, depth, theme);
  expect(pairs).toHaveLength(1);
  return pairs[0]!;
};
const hue = (c: ColorRgba): number => Oklch.fromRgba(c).h;
const apart = (a: number, b: number): number => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

describe("steppedInk — each step's ink reads on its ground, as drawn, at every depth", () => {
  it.each(depths.flatMap(([d, depth, slack]) => themes.map(([name, theme]) => [d, name, depth, slack, theme] as const)))(
    "at %s on %s: no cell falls below its resting contrast or AA at any step",
    (_d, _name, depth, slack, theme) => {
      const failures = subjects.flatMap(([name, style]) => {
        const rest = pairOf(render(word(style), depth), depth, theme);
        const floor = Math.min(contrastRatio(rest.fg, rest.bg), AA) - slack;
        return STEPS.flatMap((_, i) => {
          const shown = pairOf(lit(word(style), i, depth, theme), depth, theme);
          const now = contrastRatio(shown.fg, shown.bg);
          return now < floor ? [`${name} at step ${i}: ${now.toFixed(3)} under ${floor.toFixed(3)}`] : [];
        });
      });
      expect(failures).toEqual([]);
    },
  );

  it("the ground is left as the cell draws it", () => {
    for (const [, depth] of depths) {
      for (const [, style] of subjects) {
        const rest = pairOf(render(word(style), depth), depth, CATPPUCCIN_MOCHA);
        for (const t of [0, 1, 2]) expect(pairOf(lit(word(style), t, depth, CATPPUCCIN_MOCHA), depth, CATPPUCCIN_MOCHA).bg.hex).toBe(rest.bg.hex);
      }
    }
  });

  it("in truecolor a step that reads on its ground at the floor is written as itself, and one that does not is moved", () => {
    // Red reads on Mocha's base and not, quite, on its bubble: 5.2 against 4.0.
    for (const ground of ["#1e1e2e", "#313244"]) {
      const dark = word(Style.parse(`#cdd6f4 on ${ground}`));
      const bg = pairOf(render(dark, ColorDepth.TRUECOLOR), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).bg;
      for (const [i, color] of BRIGHT.entries()) {
        const written = pairOf(lit(dark, i, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).fg.hex;
        if (contrastRatio(color, bg) >= AA - 0.01) expect(written).toBe(color.hex);
        else expect(written).not.toBe(color.hex);
      }
    }
  });

  it("in truecolor a step that does not read keeps its hue and moves its lightness until it does", () => {
    // Pale yellow on white reads at nothing like AA; the ink written is a darker yellow, not white's complement.
    const light = word(Style.parse("#1e1e2e on #ffffff"));
    const shown = pairOf(lit(light, 1, ColorDepth.TRUECOLOR, CATPPUCCIN_LATTE), ColorDepth.TRUECOLOR, CATPPUCCIN_LATTE);
    expect(shown.fg.hex).not.toBe(BRIGHT[1]!.hex);
    expect(apart(hue(shown.fg), hue(BRIGHT[1]!))).toBeLessThan(12);
    expect(contrastRatio(shown.fg, shown.bg)).toBeGreaterThanOrEqual(AA - 0.01);
  });

  it("on a sixteen-colour terminal it steps from slot to slot", () => {
    const chevrons = word(Style.parse("bold #cdd6f4 on #313244"));
    const written = [0, 1, 2].map((t) => renderToString(new Effected(chevrons, signal, { t, key: "k", theme: DEFAULT_TERMINAL_THEME }), { width: 10, colorSystem: ColorDepth.STANDARD }));
    expect(new Set(written).size).toBe(3);
    // Each step's ink is one of the sixteen: an SGR 30–37 or 90–97, never a 38;5 or 38;2.
    for (const bytes of written) {
      expect(bytes).toMatch(/\x1b\[[^m]*\b(3[0-7]|9[0-7])\b/);
      expect(bytes).not.toMatch(/38;[25]/);
    }
    // And each is the slot nearest the step: red, yellow and green by hue.
    const slots = [0, 1, 2].map((t) => pairOf(lit(chevrons, t, ColorDepth.STANDARD, DEFAULT_TERMINAL_THEME), ColorDepth.STANDARD, DEFAULT_TERMINAL_THEME).fg);
    slots.forEach((slot, i) => expect(apart(hue(slot), hue(BRIGHT[i]!))).toBeLessThan(30));
  });

  it("composes with Frames by nesting: the glyphs turn and the ink steps, and no glyph changes", () => {
    const sequence = new FrameSequence(["›", "››", "›››"].map((glyphs) => ({ text: new RichText(glyphs, { style: Style.parse("bold on #1e1e2e") }), seconds: 1 })));
    for (const [t, glyphs] of [[0, "›"], [1, "››"], [2.5, "›››"], [3, "›"]] as const) {
      const segments = lit(new Frames(sequence, { t }), t, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA);
      expect(segments.map((s) => s.text).join("").trimEnd()).toBe(glyphs);
      expect(pairOf(segments, ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).fg.hex).toBe(BRIGHT[Math.floor(t) % 3]!.hex);
    }
  });

  it("refuses no steps, and a hold that is not a positive number of seconds", () => {
    expect(() => steppedInk([])).toThrow(/at least one hold/);
    expect(() => steppedInk([{ color: BRIGHT[0]!, seconds: 0 }])).toThrow(/positive number of seconds/);
  });

  it("plays the steps it was given, whatever the caller does to its array afterwards", () => {
    const steps = [...STEPS];
    const kept = steppedInk(steps);
    steps.pop();
    steps[1] = { color: new ColorRgba(139, 233, 253), seconds: 9 };
    const inkAt = (t: number): string =>
      pairOf(render(new Effected(word(Style.parse("bold #cdd6f4 on #1e1e2e")), kept, { t, key: "k", theme: CATPPUCCIN_MOCHA }), ColorDepth.TRUECOLOR), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).fg.hex;
    expect([0, 1, 2].map(inkAt)).toEqual(BRIGHT.map((color) => color.hex));
  });
});

describe("steppedInk — at the host's rate, whatever it is", () => {
  // On Mocha's base every step reads as itself, so the ink written is the step's own colour.
  const chevrons = word(Style.parse("bold #cdd6f4 on #1e1e2e"));
  const inkAt = (effect: ReturnType<typeof steppedInk>, t: number): string =>
    pairOf(render(new Effected(chevrons, effect, { t, key: "k", theme: CATPPUCCIN_MOCHA }), ColorDepth.TRUECOLOR), ColorDepth.TRUECOLOR, CATPPUCCIN_MOCHA).fg.hex;

  it("sampled every 1/60 s over 3 s, each colour is drawn for exactly 60 consecutive samples", () => {
    const samples = Array.from({ length: 180 }, (_, i) => inkAt(signal, i / 60));
    const runs = samples.reduce<{ hex: string; count: number }[]>((runs, hex) => {
      const last = runs[runs.length - 1];
      if (last?.hex === hex) last.count++;
      else runs.push({ hex, count: 1 });
      return runs;
    }, []);
    expect(runs).toEqual(BRIGHT.map((color) => ({ hex: color.hex, count: 60 })));
  });

  it("sampled once a second, one-second steps change once a second, and a step shorter than a second is skipped", () => {
    expect([0, 1, 2, 3, 4].map((t) => inkAt(signal, t))).toEqual([...BRIGHT, BRIGHT[0]!, BRIGHT[1]!].map((c) => c.hex));
    // Four quarter-second steps: a period of one whole second, which once a second shows one colour forever.
    const quarters = steppedInk([...BRIGHT, new ColorRgba(139, 233, 253)].map((color) => ({ color, seconds: 0.25 })));
    expect(new Set([0, 1, 2, 3].map((t) => inkAt(quarters, t))).size).toBe(1);
    expect(new Set(Array.from({ length: 60 }, (_, i) => inkAt(quarters, i / 60))).size).toBe(4);
  });

  it("a frame inside a step costs no more than the step's first, and no more than twice an untouched frame, at t = 0 and far from it", () => {
    // 256 colours: the search weighs every colour the depth has an index for,
    // and the first frame of a step is the only one that runs it. A frame
    // inside the step is measured against the identity effect's, sampled in
    // turn with it, so a loaded box slows both alike: on a quiet one the
    // signal's frame is about 1.3× identity's, pulse's about 1.8×.
    const row = new RichText("›".repeat(120), { style: Style.parse("bold #cdd6f4 on #313244"), end: "", noWrap: true });
    const identity: Effect = () => (colors) => colors;
    const frame = (effect: Effect, t: number): number => {
      const began = performance.now();
      renderToString(new Effected(row, effect, { t, key: "row", theme: CATPPUCCIN_MOCHA }), { width: 120, colorSystem: ColorDepth.EIGHT_BIT });
      return performance.now() - began;
    };
    const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    frame(identity, 0);
    for (const base of [0, 1e6]) {
      // A signal built here, so the first frame at each base is the one that runs the search.
      const fresh = steppedInk(STEPS);
      const first = frame(fresh, base);
      const samples = Array.from({ length: 59 }, (_, i) => ({ untouched: frame(identity, base + (i + 1) / 60), signal: frame(fresh, base + (i + 1) / 60) }));
      const inside = median(samples.map((s) => s.signal));
      expect(inside).toBeLessThanOrEqual(first);
      expect(inside).toBeLessThanOrEqual(2 * median(samples.map((s) => s.untouched)));
    }
  });
});
