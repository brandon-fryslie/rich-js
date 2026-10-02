import { describe, it, expect } from "vitest";
import { EASES, Phase, cubicBezier, parseEase, steps, type Ease } from "../../src/core/easing.js";

/**
 * The CSS reference curve, straight from its definition: the cubic Bézier
 * through (0,0), (x1,y1), (x2,y2), (1,1), evaluated in Bernstein form at
 * parameter s. Independent of the implementation's power-basis solver, so a
 * point on it is a point the ease must pass through.
 */
function bezierPoint(x1: number, y1: number, x2: number, y2: number, s: number): [number, number] {
  const u = 1 - s;
  const b1 = 3 * u * u * s;
  const b2 = 3 * u * s * s;
  const b3 = s * s * s;
  return [b1 * x1 + b2 * x2 + b3, b1 * y1 + b2 * y2 + b3];
}

const CSS_NAMED: readonly [keyof typeof EASES, [number, number, number, number]][] = [
  ["ease", [0.25, 0.1, 0.25, 1]],
  ["ease-in", [0.42, 0, 1, 1]],
  ["ease-out", [0, 0, 0.58, 1]],
  ["ease-in-out", [0.42, 0, 0.58, 1]],
];

describe("cubicBezier matches CSS's reference curves", () => {
  for (const [name, [x1, y1, x2, y2]] of CSS_NAMED) {
    it(`${name} = cubic-bezier(${x1}, ${y1}, ${x2}, ${y2}) at sampled points`, () => {
      const ease = EASES[name];
      for (let i = 0; i <= 40; i++) {
        const [x, y] = bezierPoint(x1, y1, x2, y2, i / 40);
        expect(ease(x)).toBeCloseTo(y, 6);
      }
    });
  }

  it("ease at its midpoint is the value browsers compute", () => {
    // `ease` is front-loaded: halfway through the time, ~80% of the way there.
    expect(EASES.ease(0.5)).toBeCloseTo(0.8024033877, 6);
  });

  it("a curve with collinear control points is linear", () => {
    const straight = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const x of [0, 0.1, 0.37, 0.5, 0.9, 1]) expect(straight(x)).toBeCloseTo(x, 9);
  });

  it("overshooting y is allowed, as CSS allows it", () => {
    const back = cubicBezier(0.34, 1.56, 0.64, 1);
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => back(i / 100)));
    expect(peak).toBeGreaterThan(1);
  });

  it("refuses control points whose x leaves [0, 1], as CSS does", () => {
    expect(() => cubicBezier(-0.1, 0, 0.5, 1)).toThrow(/x1 and x2 must lie in \[0, 1\]/);
    expect(() => cubicBezier(0.5, 0, 1.2, 1)).toThrow(/x1 and x2 must lie in \[0, 1\]/);
    expect(() => cubicBezier(0.5, Number.NaN, 0.5, 1)).toThrow(/y1 must be finite/);
  });
});

describe("steps matches CSS's jump terms", () => {
  // Expected values are CSS Easing Level 1's step algorithm, at 0, ½ and 1
  // for three steps: the jump term decides where the n intervals land.
  const cases: readonly [Ease, string, [number, number, number]][] = [
    [steps(3, "jump-start"), "jump-start", [1 / 3, 2 / 3, 1]],
    [steps(3, "start"), "start", [1 / 3, 2 / 3, 1]],
    [steps(3, "jump-end"), "jump-end", [0, 1 / 3, 1]],
    [steps(3, "end"), "end", [0, 1 / 3, 1]],
    [steps(3), "default (jump-end)", [0, 1 / 3, 1]],
    [steps(3, "jump-none"), "jump-none", [0, 1 / 2, 1]],
    [steps(3, "jump-both"), "jump-both", [1 / 4, 2 / 4, 1]],
  ];
  for (const [ease, label, [at0, atHalf, at1]] of cases) {
    it(`steps(3, ${label})`, () => {
      expect(ease(0)).toBeCloseTo(at0, 12);
      expect(ease(0.5)).toBeCloseTo(atHalf, 12);
      expect(ease(1)).toBeCloseTo(at1, 12);
    });
  }

  it("holds flat inside an interval and jumps at its edge", () => {
    const four = steps(4);
    expect(four(0.24)).toBe(0);
    expect(four(0.25)).toBe(0.25);
    expect(four(0.99)).toBe(0.75);
  });

  it("step-start and step-end are steps(1) with CSS's jumps", () => {
    expect(EASES["step-start"](0)).toBe(1);
    expect(EASES["step-end"](0.999)).toBe(0);
    expect(EASES["step-end"](1)).toBe(1);
  });

  it("refuses a step count the jump term cannot draw", () => {
    expect(() => steps(0)).toThrow(/whole number of steps ≥ 1/);
    expect(() => steps(2.5)).toThrow(/whole number of steps ≥ 1/);
    expect(() => steps(1, "jump-none")).toThrow(/whole number of steps ≥ 2/);
  });
});

describe("the built-in names", () => {
  it("step keeps its old ramp behaviour: the left stop for the whole segment", () => {
    for (const x of [0, 0.25, 0.5, 0.999]) expect(EASES.step(x)).toBe(0);
  });

  it("linear is the identity and sine is flat at both ends", () => {
    for (const x of [0, 0.3, 1]) expect(EASES.linear(x)).toBe(x);
    expect(EASES.sine(0)).toBe(0);
    expect(EASES.sine(0.5)).toBeCloseTo(0.5, 12);
    expect(EASES.sine(1)).toBe(1);
  });

  it("parseEase hands back the function for every listed name and nothing else", () => {
    for (const name of Object.keys(EASES) as (keyof typeof EASES)[]) {
      expect(parseEase(name)).toBe(EASES[name]);
    }
    expect(() => parseEase("smooth")).toThrow(
      /unknown easing "smooth"; expected one of "linear", "ease", "ease-in"/,
    );
    // Prototype names are not eases.
    expect(() => parseEase("toString")).toThrow(/unknown easing/);
  });
});

describe("Phase — seconds in, progress out, no clock read", () => {
  it("once rises from start over its duration, then holds", () => {
    const fadeIn = Phase.once(2, 4);
    expect(fadeIn(0)).toBe(0);
    expect(fadeIn(2)).toBe(0);
    expect(fadeIn(3)).toBe(0.25);
    expect(fadeIn(6)).toBe(1);
    expect(fadeIn(600)).toBe(1);
  });

  it("loop wraps every period, before zero too", () => {
    const sweep = Phase.loop(2);
    expect(sweep(0)).toBe(0);
    expect(sweep(0.5)).toBe(0.25);
    expect(sweep(2)).toBe(0);
    expect(sweep(5)).toBe(0.5);
    expect(sweep(-0.5)).toBe(0.75);
  });

  it("pingPong goes there in the first half of its period and back in the second", () => {
    const pulse = Phase.pingPong(2);
    expect(pulse(0)).toBe(0);
    expect(pulse(0.5)).toBe(0.5);
    expect(pulse(1)).toBe(1);
    expect(pulse(1.5)).toBe(0.5);
    expect(pulse(2)).toBe(0);
  });

  it("refuses a span that is not a positive number of seconds", () => {
    expect(() => Phase.once(0, 0)).toThrow(/positive number of seconds, got 0/);
    expect(() => Phase.loop(-1)).toThrow(/Phase.loop period/);
    expect(() => Phase.pingPong(Number.POSITIVE_INFINITY)).toThrow(/Phase.pingPong period/);
    expect(() => Phase.once(Number.NaN, 1)).toThrow(/start must be finite/);
  });
});
