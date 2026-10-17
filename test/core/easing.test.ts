import { describe, it, expect } from "vitest";
import { EASES, Phase, beat, cubicBezier, parseEase, steps, type Ease } from "../../src/core/easing.js";

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
      /unknown ease "smooth"; expected one of "linear", "ease", "ease-in"/,
    );
    // Prototype names are not eases.
    expect(() => parseEase("toString")).toThrow(/unknown ease/);
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

describe("beat — holds in seconds, the hold in progress out, no clock read", () => {
  it("counts holds from t = 0 and wraps every period, before zero too", () => {
    const b = beat([1, 1, 1]);
    expect(b.period).toBe(3);
    expect(b.at(0)).toBe(0);
    expect(b.at(0.999)).toBe(0);
    expect(b.at(1)).toBe(1);
    expect(b.at(2.2)).toBe(2);
    expect(b.at(3)).toBe(0);
    expect(b.at(-0.5)).toBe(2);
  });

  it("holds may differ: each is in progress for its own seconds", () => {
    const b = beat([1, 0.25, 0.5]);
    expect(b.period).toBe(1.75);
    expect(b.at(0.99)).toBe(0);
    expect(b.at(1)).toBe(1);
    expect(b.at(1.24)).toBe(1);
    expect(b.at(1.25)).toBe(2);
    expect(b.at(1.75)).toBe(0);
  });

  it("with equal holds it is steps(n) read as an index", () => {
    const n = 4;
    const b = beat(Array.from({ length: n }, () => 0.5));
    const stepped = steps(n);
    for (let t = 0; t < 4; t += 0.01) expect(b.at(t)).toBe(Math.round(stepped(Phase.loop(b.period)(t)) * n));
  });

  it("sampled sixty times a second, a one-second hold is in progress for exactly sixty consecutive samples", () => {
    const b = beat([1, 1, 1]);
    const samples = Array.from({ length: 180 }, (_, i) => b.at(i / 60));
    expect(samples.join("")).toBe("0".repeat(60) + "1".repeat(60) + "2".repeat(60));
  });

  it("sampled once a second, a period of whole seconds shows one hold forever", () => {
    const b = beat([0.25, 0.25, 0.25, 0.25]);
    for (let t = 0; t < 100; t++) expect(b.at(t)).toBe(0);
  });

  it("answers the same far from zero: a lookup, never a walk through time", () => {
    const b = beat([1, 0.5, 2.5]);
    for (const t of [0, 1.2, 1.4, 3.6]) {
      expect(b.at(1e6 + t)).toBe(b.at(t));
      expect(b.at(1e9 + t)).toBe(b.at(t));
    }
  });

  it("a t exactly on a boundary lands on the hold that begins there, for holds that are not exact in binary", () => {
    // 0.1 is not a dyadic fraction; a wrap by a detour through `+ period`
    // lands 0.1 one ulp short and shows every frame one sample late.
    const tenths = beat([0.1, 0.1, 0.1]);
    expect([0, 0.1, 0.2].map((t) => tenths.at(t))).toEqual([0, 1, 2]);
    expect(beat([0.4, 0.4, 0.4]).at(0.4)).toBe(1);
    expect(beat([1 / 3, 1 / 3, 1 / 3]).at(1 / 3)).toBe(1);
  });

  it("refuses a t that is not finite, in at, and so does Phase.loop", () => {
    expect(() => beat([1, 1]).at(Number.NaN)).toThrow(/Beat.at needs a finite t, got NaN/);
    expect(() => beat([1, 1]).at(Number.POSITIVE_INFINITY)).toThrow(/finite t/);
    expect(() => Phase.loop(1)(Number.NaN)).toThrow(/Phase.loop needs a finite t/);
  });

  it("a negative epsilon wraps to 0, never to the period itself", () => {
    expect(Phase.loop(1)(-1e-17)).toBe(0);
    expect(beat([1, 1]).at(-1e-17)).toBe(0);
  });

  it("holds is a copy: a caller's later change to the array it passed changes nothing", () => {
    const holds = [1, 1];
    const b = beat(holds);
    holds.push(1);
    expect(b.holds).toEqual([1, 1]);
    expect(b.period).toBe(2);
    expect(b.at(2.5)).toBe(0);
  });

  it("start is when the hold in progress began, on t's own timeline, before zero too", () => {
    const b = beat([1, 0.5, 2.5]);
    expect(b.start(0)).toBe(0);
    expect(b.start(0.99)).toBe(0);
    expect(b.start(1)).toBe(1);
    expect(b.start(1.4)).toBe(1);
    expect(b.start(1.5)).toBe(1.5);
    expect(b.start(3.9)).toBe(1.5);
    expect(b.start(4)).toBe(4);
    expect(b.start(5.2)).toBe(5);
    expect(b.start(-0.5)).toBe(-2.5);
    expect(b.start(-3.9)).toBe(-4);
  });

  it("every t inside one hold answers the same start, to the bit, far from zero too", () => {
    const b = beat([0.1, 0.1, 0.1]);
    for (const base of [0, 1e6, 1e9]) {
      // Samples strictly inside the second hold: a tenth past its start, a tenth short of its end.
      const inside = Array.from({ length: 60 }, (_, i) => b.start(base + 0.11 + (i / 60) * 0.08));
      expect(new Set(inside).size).toBe(1);
      expect(inside[0]).toBeCloseTo(base + 0.1, 6);
    }
  });

  it("start of a t exactly on a boundary is that boundary, for holds that are not exact in binary", () => {
    const tenths = beat([0.1, 0.1, 0.1]);
    expect([0, 0.1, 0.2].map((t) => tenths.start(t))).toEqual([0, 0.1, 0.2]);
    expect(beat([0.4, 0.4, 0.4]).start(0.4)).toBe(0.4);
  });

  it("start and at agree: the start of a hold is a t at which that hold is in progress", () => {
    const b = beat([1, 0.5, 2.5]);
    for (const t of [0, 0.3, 1, 1.2, 1.5, 3, 4, 7.9, 1e6 + 1.3, -0.7]) expect(b.at(b.start(t))).toBe(b.at(t));
  });

  it("start and at agree for holds that are not exact in binary, at every sample, and start is never after t", () => {
    // A pass's start plus a hold's can round an ulp under the boundary, which
    // `at` would read as the hold before: for tenths, nearly half of all
    // samples did. Swept densely across many passes, before zero too.
    for (const holds of [[0.1, 0.1, 0.1], [0.3, 0.2, 0.1], [1.1, 0.9]]) {
      const b = beat(holds);
      const disagree: number[] = [];
      const after: number[] = [];
      for (let k = 0; k < 20_000; k++) {
        const t = (k / 20_000) * 50 - 5;
        const began = b.start(t);
        if (b.at(began) !== b.at(t)) disagree.push(t);
        if (began > t) after.push(t);
      }
      expect(disagree, `holds ${holds.join(",")}`).toEqual([]);
      expect(after, `holds ${holds.join(",")}`).toEqual([]);
    }
  });

  it("start refuses a t that is not finite", () => {
    expect(() => beat([1]).start(Number.NaN)).toThrow(/Beat.start needs a finite t, got NaN/);
  });

  // rich-animation-xi28.6rs: `end` is when what is drawn on the beat at `t`
  // next changes — what a host asks before drawing again.
  it("end is when the hold in progress ends: the next hold's start, into the next pass from the last, before zero too", () => {
    const b = beat([1, 0.5, 2.5]);
    expect(b.end(0)).toBe(1);
    expect(b.end(0.99)).toBe(1);
    expect(b.end(1)).toBe(1.5);
    expect(b.end(1.4)).toBe(1.5);
    expect(b.end(1.5)).toBe(4);
    expect(b.end(3.9)).toBe(4);
    expect(b.end(4)).toBe(5);
    expect(b.end(5.2)).toBe(5.5);
    expect(b.end(-0.5)).toBe(0);
    expect(b.end(-3.9)).toBe(-3);
  });

  it("every t inside one hold answers the same end, to the bit, far from zero too", () => {
    const b = beat([0.1, 0.1, 0.1]);
    for (const base of [0, 1e6, 1e9]) {
      const inside = Array.from({ length: 60 }, (_, i) => b.end(base + 0.11 + (i / 60) * 0.08));
      expect(new Set(inside).size).toBe(1);
      expect(inside[0]).toBeCloseTo(base + 0.2, 6);
    }
  });

  it("end and at agree at every sample: end is after t, the hold in progress at it is the next, and it is its own start", () => {
    for (const holds of [[0.1, 0.1, 0.1], [0.3, 0.2, 0.1], [1.1, 0.9], [1]]) {
      const b = beat(holds);
      const wrong: number[] = [];
      for (let k = 0; k < 20_000; k++) {
        const t = (k / 20_000) * 50 - 5;
        const ended = b.end(t);
        const next = (b.at(t) + 1) % holds.length;
        if (!(ended > t) || b.at(ended) !== next || b.start(ended) !== ended) wrong.push(t);
      }
      expect(wrong, `holds ${holds.join(",")}`).toEqual([]);
    }
  });

  it("sampled once a second, end says the next change comes before the next sample for quarter-second holds, and at it for whole ones", () => {
    const quarters = beat([0.25, 0.25, 0.25, 0.25]);
    const seconds = beat([1, 1, 1]);
    for (const t of [0, 1, 2, 3, 1e6]) {
      expect(quarters.end(t)).toBeCloseTo(t + 0.25, 6);
      expect(seconds.end(t)).toBe(t + 1);
    }
  });

  it("end refuses a t that is not finite", () => {
    expect(() => beat([1]).end(Number.POSITIVE_INFINITY)).toThrow(/Beat.end needs a finite t, got Infinity/);
  });

  it("refuses no holds, and a hold that is not a positive number of seconds", () => {
    expect(() => beat([])).toThrow(/at least one hold/);
    expect(() => beat([1, 0])).toThrow(/beat hold 1 must be a positive number of seconds, got 0/);
    expect(() => beat([Number.NaN])).toThrow(/beat hold 0/);
  });
});
