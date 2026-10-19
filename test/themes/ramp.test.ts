import { describe, it, expect } from "vitest";
import { ColorRgba } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import { Animation } from "../../src/core/animation.js";
import { EASES, Phase, cubicBezier } from "../../src/core/easing.js";
import { tween } from "../../src/core/tween.js";
import { ColorRamp } from "../../src/themes/ramp.js";

const panel = new ColorRgba(40, 44, 52);
const warning = new ColorRgba(229, 192, 123);
const error = new ColorRgba(224, 108, 117);

// The bundled cc-candybar threshold cascade — `≥ 50 warning, ≥ 80 error,
// else panel` — spelled as data.
const cascade = new ColorRamp(EASES.step, [
  { at: 0, color: panel },
  { at: 50, color: warning },
  { at: 80, color: error },
]);

const gradient = new ColorRamp(EASES.linear, [
  { at: 0, color: panel },
  { at: 50, color: warning },
  { at: 80, color: error },
]);

describe("ColorRamp — shape is checked once, in the constructor", () => {
  it("refuses an empty ramp", () => {
    expect(() => new ColorRamp(EASES.linear, [])).toThrow(/at least one stop/);
  });

  it("refuses a non-finite position", () => {
    expect(
      () => new ColorRamp(EASES.linear, [{ at: Number.NaN, color: panel }]),
    ).toThrow(/stop 0 has a non-finite position NaN/);
  });

  it("refuses stops out of ascending order rather than sorting them", () => {
    // [LAW:no-silent-failure] `warning at 80, error at 50` read from a config
    // is an authoring mistake; a sorted ramp would render a ramp the author
    // never wrote.
    expect(
      () =>
        new ColorRamp(EASES.step, [
          { at: 0, color: panel },
          { at: 80, color: warning },
          { at: 50, color: error },
        ]),
    ).toThrow(/stop 2 at 50 follows stop 1 at 80/);
  });

  it("accepts two stops at one position as a hard edge, the later color winning there", () => {
    const hard = new ColorRamp(EASES.linear, [
      { at: 0, color: panel },
      { at: 50, color: panel },
      { at: 50, color: error },
      { at: 100, color: error },
    ]);
    expect(hard.at(49.999).hex).toBe(panel.hex);
    expect(hard.at(50).hex).toBe(error.hex);
  });
});

describe("ColorRamp.at", () => {
  it("is exactly each stop's color at that stop's position, byte for byte", () => {
    // The sRGB↔OKLCH round-trip is lossy by up to a channel unit; a ramp that
    // did not hit its own stops would paint colors the author never wrote.
    for (const ramp of [cascade, gradient]) {
      for (const stop of ramp.stops) {
        expect(ramp.at(stop.at)).toBe(stop.color);
      }
    }
  });

  it("clamps: below the first stop is the first color, at or above the last is the last", () => {
    for (const ramp of [cascade, gradient]) {
      expect(ramp.at(-1000)).toBe(panel);
      expect(ramp.at(80)).toBe(error);
      expect(ramp.at(1e9)).toBe(error);
    }
  });

  it("step holds each color until the next position — the `≥ threshold` cascade", () => {
    expect(cascade.at(0)).toBe(panel);
    expect(cascade.at(49)).toBe(panel);
    expect(cascade.at(49.999)).toBe(panel);
    expect(cascade.at(50)).toBe(warning);
    expect(cascade.at(79.5)).toBe(warning);
    expect(cascade.at(80)).toBe(error);
  });

  it("linear is Oklch.mix of the two enclosing stops at the segment's progress", () => {
    const expected = (from: ColorRgba, to: ColorRgba, t: number) =>
      Oklch.fromRgba(from).mix(Oklch.fromRgba(to), t).toRgba().hex;
    expect(gradient.at(25).hex).toBe(expected(panel, warning, 0.5));
    expect(gradient.at(10).hex).toBe(expected(panel, warning, 0.2));
    expect(gradient.at(65).hex).toBe(expected(warning, error, 0.5));
  });

  it("a one-stop ramp is that color everywhere", () => {
    const flat = new ColorRamp(EASES.linear, [{ at: 10, color: warning }]);
    expect(flat.at(-5)).toBe(warning);
    expect(flat.at(10)).toBe(warning);
    expect(flat.at(500)).toBe(warning);
  });

  it("refuses a non-finite value", () => {
    expect(() => cascade.at(Number.NaN)).toThrow(/finite value, got NaN/);
    expect(() => cascade.at(Number.POSITIVE_INFINITY)).toThrow(/finite value/);
  });
});

describe("ColorRamp — every ease in the vocabulary", () => {
  const stops = [
    { at: 0, color: panel },
    { at: 50, color: warning },
    { at: 80, color: error },
  ];

  it("paints each stop's own color on it whenever the ease starts at 0", () => {
    for (const [name, ease] of Object.entries(EASES)) {
      if (ease(0) !== 0) continue;
      const ramp = new ColorRamp(ease, stops);
      for (const stop of stops) expect(ramp.at(stop.at), `${name} at ${stop.at}`).toBe(stop.color);
    }
  });

  it("jumps at the start of the interval under step-start, as CSS defines it", () => {
    const ramp = new ColorRamp(EASES["step-start"], stops);
    expect(ramp.at(0)).toBe(warning);
    expect(ramp.at(50)).toBe(error);
    expect(ramp.at(80)).toBe(error);
  });

  it("holds the end colors where an ease overshoots, never painting outside its stops", () => {
    const two = [
      { at: 0, color: panel },
      { at: 100, color: error },
    ];
    // A CSS "back" curve: above 1 well before the end of the interval…
    expect(new ColorRamp(cubicBezier(0.34, 1.56, 0.64, 1), two).at(70)).toBe(error);
    // …and its mirror, below 0 just after the start.
    expect(new ColorRamp(cubicBezier(0.36, 0, 0.66, -0.56), two).at(30)).toBe(panel);
  });
});

describe("ColorRamp — scrolled along its span and rotated in hue", () => {
  const red = new ColorRgba(220, 38, 38);
  const blue = new ColorRgba(37, 99, 235);
  // A loop: its last stop is its first colour, so a scroll wraps seamlessly.
  const loop = new ColorRamp(EASES.linear, [
    { at: 0, color: red },
    { at: 50, color: blue },
    { at: 100, color: red },
  ]);
  const positions = [-10, 0, 10, 25, 49.9, 50, 75, 99.9, 100, 110];

  it("unmoved reads exactly as before, the jump-start eases included", () => {
    for (const ease of [EASES.linear, EASES["step-start"], EASES.step]) {
      const plain = new ColorRamp(ease, loop.stops);
      const zero = new ColorRamp(ease, loop.stops, 0, 0);
      for (const v of positions) expect(zero.at(v).hex, `${v}`).toBe(plain.at(v).hex);
    }
  });

  it("scrolled, reads the colour that many spans behind, wrapped round the span", () => {
    const quarter = new ColorRamp(EASES.linear, loop.stops, 0.25);
    expect(quarter.at(25)).toBe(loop.at(0));
    expect(quarter.at(75)).toBe(loop.at(50));
    expect(quarter.at(0).hex).toBe(loop.at(75).hex);
    expect(quarter.at(10).hex).toBe(loop.at(85).hex);
  });

  it("holds its end colours outside the span, however far it has scrolled", () => {
    const quarter = new ColorRamp(EASES.linear, loop.stops, 0.25);
    expect(quarter.at(-10)).toBe(red);
    expect(quarter.at(110)).toBe(red);
  });

  it("counts a scroll and a rotation in turns: a whole one is none, a negative one counts back", () => {
    expect(new ColorRamp(EASES.linear, loop.stops, 1).scroll).toBe(0);
    expect(new ColorRamp(EASES.linear, loop.stops, -0.25).scroll).toBe(0.75);
    expect(new ColorRamp(EASES.linear, loop.stops, 0, 3).hue).toBe(0);
    expect(new ColorRamp(EASES.linear, loop.stops, -1e-20).scroll).toBe(0);
  });

  it("refuses a non-finite scroll or rotation, naming which", () => {
    expect(() => new ColorRamp(EASES.linear, loop.stops, Number.NaN)).toThrow(/scroll must be finite/);
    expect(() => new ColorRamp(EASES.linear, loop.stops, 0, Number.POSITIVE_INFINITY)).toThrow(/hue must be finite/);
  });

  it("rotated, turns each colour round the OKLCH hue circle at its own lightness and chroma", () => {
    const half = new ColorRamp(EASES.linear, loop.stops, 0, 0.5);
    const from = Oklch.fromRgba(red);
    const turned = Oklch.fromRgba(half.at(0));
    expect(turned.l).toBeCloseTo(from.l, 2);
    // The signed hue difference, in (−180, 180]: half a turn is ±180.
    expect(Math.abs(((turned.h - from.h + 540) % 360) - 180)).toBeGreaterThan(178);
  });
});

describe("ColorRamp.moving — a ramp under an animation", () => {
  const red = new ColorRgba(220, 38, 38);
  const blue = new ColorRgba(37, 99, 235);
  const loop = new ColorRamp(EASES.linear, [
    { at: 0, color: red },
    { at: 1, color: blue },
    { at: 2, color: red },
  ]);
  const cells = (ramp: ColorRamp): string[] => Array.from({ length: 21 }, (_, i) => ramp.at(i / 10).hex);

  it("draws the same ramp at a shared t whether sampled once a second or sixty times, near 10⁶ too", () => {
    const moving = loop.moving({
      scroll: Animation.continuous(Phase.loop(4)),
      hue: Animation.continuous(Phase.pingPong(7)),
    });
    const expected = (t: number) => cells(new ColorRamp(loop.ease, loop.stops, Phase.loop(4)(t), Phase.pingPong(7)(t)));
    for (const base of [0, 1e6]) {
      // Each rate sampled in its own order, so nothing one read leaves behind can reach the next.
      const once = Array.from({ length: 5 }, (_, i) => base + i);
      const sixty = Array.from({ length: 4 * 60 + 1 }, (_, i) => base + (i * 60) / 3600);
      const atSixty = new Map(sixty.map((t) => [t, cells(moving.at(t))]));
      for (const t of once) {
        expect(cells(moving.at(t)), `${t}`).toEqual(expected(t));
        expect(atSixty.get(t), `${t} at sixty`).toEqual(expected(t));
      }
    }
  });

  it("a loop moves every frame", () => {
    const moving = loop.moving({ scroll: Animation.continuous(Phase.loop(4)) });
    expect(moving.nextChange(2.5)).toBe(2.5);
    expect(moving.lastChange(2.5)).toBe(2.5);
  });

  it("a ramp a tween settles never changes again once it arrives, and rests where the tween does", () => {
    const settling = loop.moving({ hue: tween(0, 0.25, { seconds: 2, ease: EASES["ease-out"] }) });
    expect(settling.nextChange(1)).toBe(1);
    expect(settling.nextChange(2)).toBe(Number.POSITIVE_INFINITY);
    expect(settling.at(5).hue).toBe(0.25);
    expect(cells(settling.at(0))).toEqual(cells(loop));
  });

  it("with no motion is the ramp, never changing", () => {
    const still = loop.moving({});
    expect(still.nextChange(3)).toBe(Number.POSITIVE_INFINITY);
    expect(cells(still.at(3))).toEqual(cells(loop));
  });

  it("moves on from however far the ramp was already moved", () => {
    const shifted = new ColorRamp(loop.ease, loop.stops, 0.5, 0.25);
    const moved = shifted.moving({ scroll: Animation.constant(0.75), hue: Animation.constant(0.25) }).at(0);
    expect([moved.scroll, moved.hue]).toEqual([0.25, 0.5]);
  });
});
