import { describe, expect, it } from "vitest";
import { Animation, ColorRamp, ColorRgba, EASES, spring, steps, tween, type Animation as AnimationOf } from "../../src/index.js";

// [LAW:behavior-not-structure] What is asserted is what a host sees: the value
// at each time it samples, that the value is the same at one sample a second
// and sixty, that it lands on its target exactly, and that the hold the tween
// names — `[lastChange(t), nextChange(t))` — is never wider than the truth.

const NEVER = Number.POSITIVE_INFINITY;
const ALWAYS = Number.NEGATIVE_INFINITY;

/** Every `t` a host sampling `hz` times a second asks for over `[0, until]`, exact in the host's own integers. */
const sampled = (hz: number, until: number): number[] => Array.from({ length: hz * until + 1 }, (_, i) => i / hz);

/** Whether `animation` holds `at(t)` over the hold it names at `t`, sampled inside. */
function holdsBetween<T>(animation: AnimationOf<T>, t: number, samples = 24): boolean {
  const value = animation.at(t);
  const next = animation.nextChange(t);
  const last = animation.lastChange(t);
  if (!(last <= t && t <= next)) return false;
  const lo = Number.isFinite(last) ? last : t - 10;
  const hi = Number.isFinite(next) ? next : t + 10;
  return Array.from({ length: samples }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / samples).every((u) => animation.at(u) === value);
}

const second = { seconds: 2, ease: EASES.linear };

describe("tween", () => {
  it("is `from` before it begins, eases to `to` over its seconds and holds there", () => {
    const fill = tween(10, 30, second);
    expect([-5, 0, 0.5, 1, 1.5, 2, 2.5, 1e6].map((t) => fill.at(t))).toEqual([10, 10, 15, 20, 25, 30, 30, 30]);
  });

  it("draws the same value for the same t at one sample a second and sixty", () => {
    const fill = tween(0, 100, { seconds: 3, ease: EASES["ease-in-out"] });
    const slow = sampled(1, 4).map((t) => fill.at(t));
    const fast = new Map(sampled(60, 4).map((t) => [t, fill.at(t)]));
    expect(sampled(1, 4).map((t) => fast.get(t))).toEqual(slow);
    // Sixty a second is monotone through an ease that is, and reaches the end.
    const sixty = sampled(60, 3).map((t) => fill.at(t));
    expect(sixty.every((v, i) => i === 0 || v >= sixty[i - 1]!)).toBe(true);
    expect(sixty.at(-1)).toBe(100);
  });

  it("shorter than a second, sampled once a second, is seen at its end and never mid-way", () => {
    const blink = tween(0, 1, { seconds: 0.3, ease: EASES["ease-out"] });
    expect(sampled(1, 3).map((t) => blink.at(t))).toEqual([0, 1, 1, 1]);
    expect(blink.nextChange(0)).toBe(0);
    expect(blink.nextChange(1)).toBe(NEVER);
  });

  it("lands exactly on `to` whatever the ease, and on `from` at the start", () => {
    for (const ease of [EASES.linear, EASES["ease-in-out"], EASES.elastic, EASES["back-out"], steps(4), spring().ease]) {
      const move = tween(3.3, 0.1, { seconds: 1, ease });
      expect(move.at(1)).toBe(0.1);
      expect(move.at(0)).toBe(3.3);
    }
    // `from + (to − from)·p` would have put it at 0.10000000000000009.
    expect(3.3 + (0.1 - 3.3)).not.toBe(0.1);
  });

  it("an ease that jumps at the start of its interval shows the jump before it begins, as a ramp does", () => {
    const jump = tween(0, 100, { seconds: 1, ease: EASES["step-start"] });
    expect([jump.at(-1), jump.at(0), jump.at(0.5), jump.at(1)]).toEqual([100, 100, 100, 100]);
    expect([jump.lastChange(-1), jump.nextChange(-1)]).toEqual([ALWAYS, 0]);
  });

  it("shows an overshooting ease as it is, past the target and back", () => {
    const snap = tween(0, 100, { seconds: 1, ease: EASES["back-out"] });
    expect(Math.max(...sampled(60, 1).map((t) => snap.at(t)))).toBeGreaterThan(100);
    expect(snap.at(1)).toBe(100);
  });

  it("a spring handed as it is settles on the target in the spring's own seconds", () => {
    const settle = spring({ stiffness: 300, damping: 20 });
    const count = tween(0, 50, settle);
    expect(count.at(settle.seconds)).toBe(50);
    expect(count.nextChange(settle.seconds)).toBe(NEVER);
    expect(count.nextChange(settle.seconds / 2)).toBe(settle.seconds / 2);
  });

  it("names its hold: until 0 before it begins, every frame while it moves, never after", () => {
    const fill = tween(0, 1, second);
    expect([fill.lastChange(-3), fill.nextChange(-3)]).toEqual([ALWAYS, 0]);
    expect([fill.lastChange(0.7), fill.nextChange(0.7)]).toEqual([0.7, 0.7]);
    expect([fill.lastChange(2), fill.nextChange(2)]).toEqual([2, NEVER]);
    expect([fill.lastChange(9), fill.nextChange(9)]).toEqual([2, NEVER]);
    for (const t of [-3, 0, 0.7, 2, 9]) expect(holdsBetween(fill, t)).toBe(true);
  });

  it("refuses an end that is not finite, and seconds that are not a positive number, where every one-shot's are checked", () => {
    expect(() => tween(Number.NaN, 1, second)).toThrow(/tween from must be finite, got NaN/);
    expect(() => tween(0, NEVER, second)).toThrow(/tween to must be finite, got Infinity/);
    expect(() => tween(0, 1, { seconds: 0, ease: EASES.linear })).toThrow(/Phase.once duration must be a positive number of seconds, got 0/);
  });
});

describe("retargeting", () => {
  it("a tween whose target changes mid-flight starts from where it is, with no state kept", () => {
    const first = tween(0, 100, second);
    const at = 1;
    const retargeted = Animation.sequence(first, at, tween(first.at(at), 20, second));
    expect(retargeted.at(0.5)).toBe(25);
    expect(retargeted.at(1)).toBe(50);
    // Half-way through the second move: from 50 toward 20.
    expect(retargeted.at(2)).toBe(35);
    expect(retargeted.at(3)).toBe(20);
    expect(retargeted.nextChange(3)).toBe(NEVER);
    expect(retargeted.at(1e6)).toBe(20);
    // Asking the old tween again changed nothing: it still heads for 100.
    expect(first.at(2)).toBe(100);
  });
});

describe("ColorRamp.over", () => {
  const red = new ColorRgba(255, 0, 0);
  const blue = new ColorRgba(0, 0, 255);
  const green = new ColorRgba(0, 255, 0);

  it("is a colour tween: the first stop before it begins, the last from its seconds on, byte for byte", () => {
    const fade = new ColorRamp(EASES["ease-in-out"], [{ at: 0, color: red }, { at: 1, color: blue }]).over(2);
    expect(fade.at(-1).hex).toBe(red.hex);
    expect(fade.at(0).hex).toBe(red.hex);
    expect(fade.at(2).hex).toBe(blue.hex);
    expect(fade.at(1e6).hex).toBe(blue.hex);
    const midway = fade.at(1);
    expect(midway.hex).not.toBe(red.hex);
    expect(midway.hex).not.toBe(blue.hex);
    expect([fade.lastChange(1), fade.nextChange(1)]).toEqual([1, 1]);
    expect([fade.lastChange(2), fade.nextChange(2)]).toEqual([2, NEVER]);
  });

  it("sweeps a ramp of more stops through each of them, the stops' positions crossed at a steady rate", () => {
    const sweep = new ColorRamp(EASES.linear, [{ at: 0, color: red }, { at: 50, color: green }, { at: 80, color: blue }]).over(8);
    expect(sweep.at(0).hex).toBe(red.hex);
    expect(sweep.at(5).hex).toBe(green.hex);
    expect(sweep.at(8).hex).toBe(blue.hex);
  });

  it("draws the same colour for the same t at one sample a second and sixty", () => {
    const fade = new ColorRamp(EASES.sine, [{ at: 0, color: red }, { at: 1, color: blue }]).over(3);
    const slow = sampled(1, 4).map((t) => fade.at(t).hex);
    const fast = new Map(sampled(60, 4).map((t) => [t, fade.at(t).hex]));
    expect(sampled(1, 4).map((t) => fast.get(t))).toEqual(slow);
  });
});
