import { describe, expect, it } from "vitest";
import { Animation, FrameSequence, RichText, Segment, Spinner, Timeline, beat } from "../../src/index.js";
import { SPINNERS } from "../../src/core/spinnerData.js";

// [LAW:behavior-not-structure] What is asserted is what a host sees through a
// timeline: the animation time each host time maps to, the value there, and
// that the value holds on the host's clock from `lastChange` to `nextChange`
// and not past either, whichever way and however fast the timeline runs.

const NEVER = Number.POSITIVE_INFINITY;
const ALWAYS = Number.NEGATIVE_INFINITY;

/** A looping animation of three named holds and a one-shot that settles, the two shapes a timeline is run over. */
const signal = Animation.map(beat([1, 0.5, 2.5]), (i) => ["a", "b", "c"][i]!);
const oneShot = Animation.sequence(Animation.map(beat([0.5, 0.5]), (i) => `step ${i}`), 2, Animation.constant("done"));

/**
 * Whether `animation` holds `at(h)` over `[lastChange(h), nextChange(h))` on
 * the host's clock, sampled inside — the contract: the hold an animation
 * names may be narrower than the truth and never wider. Where a boundary is
 * exact, the tests say so with the host time it falls at.
 */
function holdsBetween<T>(animation: Animation<T>, h: number, samples = 24): boolean {
  const value = animation.at(h);
  const next = animation.nextChange(h);
  const last = animation.lastChange(h);
  if (!(last <= h && h <= next)) return false;
  const lo = Number.isFinite(last) ? last : h - 10;
  const hi = Number.isFinite(next) ? next : h + 10;
  return Array.from({ length: samples }, (_, i) => lo + ((hi - lo) * (i + 0.5)) / samples).every((u) => animation.at(u) === value);
}

describe("Timeline.play and Timeline.at", () => {
  it("maps the origin to 0 and every host time on by the rate, backwards for a negative one", () => {
    const forward = Timeline.play(10);
    expect([10, 11.5, 9].map((h) => Timeline.at(forward, h))).toEqual([0, 1.5, -1]);
    const fast = Timeline.play(10, 2);
    expect(Timeline.at(fast, 11.5)).toBe(3);
    const backwards = Timeline.play(10, -1);
    expect(Timeline.at(backwards, 11.5)).toBe(-1.5);
  });

  it("refuses a rate that is not finite or is zero, and an origin or host time that is not finite", () => {
    for (const rate of [0, NEVER, Number.NaN]) expect(() => Timeline.play(0, rate)).toThrow(/Timeline rate must be finite and not zero/);
    expect(() => Timeline.play(Number.NaN)).toThrow(/Timeline.play origin must be a finite number of seconds/);
    expect(() => Timeline.at(Timeline.play(0), NEVER)).toThrow(/Timeline host time must be a finite number of seconds/);
    expect(() => Timeline.at(Timeline.pause(Timeline.play(0), 1), Number.NaN)).toThrow(/Timeline host time must be a finite number of seconds/);
  });
});

describe("pause, resume, seek and rate are values in and values out", () => {
  const playing = Timeline.play(10);

  it("paused, every host time maps to the time it froze at; resumed, that time is at the moment of resuming", () => {
    const paused = Timeline.pause(playing, 11.5);
    expect(paused.playing).toBe(false);
    expect([0, 11.5, 1e6].map((h) => Timeline.at(paused, h))).toEqual([1.5, 1.5, 1.5]);
    expect(Timeline.at(playing, 11.5)).toBe(1.5);
    const resumed = Timeline.resume(paused, 100);
    expect(Timeline.at(resumed, 100)).toBe(1.5);
    expect(Timeline.at(resumed, 101)).toBe(2.5);
  });

  it("pausing a paused timeline holds the same time, and resuming a playing one is the same map", () => {
    const paused = Timeline.pause(playing, 11.5);
    expect(Timeline.at(Timeline.pause(paused, 50), 60)).toBe(1.5);
    const same = Timeline.resume(playing, 20);
    for (const h of [0, 10, 20, 35.25]) expect(Timeline.at(same, h)).toBe(Timeline.at(playing, h));
  });

  it("seek puts the animation at a time at a host time, keeping the rate and whether it plays", () => {
    const sought = Timeline.seek(playing, 11.5, 2.5);
    expect(Timeline.at(sought, 11.5)).toBe(2.5);
    expect(Timeline.at(sought, 12.5)).toBe(3.5);
    const held = Timeline.seek(Timeline.pause(playing, 11.5), 11.5, 7);
    expect(held.playing).toBe(false);
    expect(Timeline.at(held, 1e6)).toBe(7);
    expect(() => Timeline.seek(playing, 11.5, NEVER)).toThrow(/Timeline.seek time must be a finite number of seconds/);
    // A paused timeline has no use for the host time and refuses a bad one all the same.
    expect(() => Timeline.seek(Timeline.pause(playing, 11.5), Number.NaN, 7)).toThrow(/Timeline host time must be a finite number of seconds/);
  });

  it("a new rate bends the map from the host time it is set at, with no jump", () => {
    const slowed = Timeline.withRate(playing, 11.5, 0.5);
    expect(Timeline.at(slowed, 11.5)).toBe(1.5);
    expect(Timeline.at(slowed, 12.5)).toBe(2);
    const reversed = Timeline.withRate(playing, 11.5, -1);
    expect(Timeline.at(reversed, 11.5)).toBe(1.5);
    expect(Timeline.at(reversed, 13)).toBe(0);
    const heldRate = Timeline.withRate(Timeline.pause(playing, 11.5), 50, 4);
    expect(heldRate.rate).toBe(4);
    expect(Timeline.at(Timeline.resume(heldRate, 60), 61)).toBe(5.5);
    expect(() => Timeline.withRate(playing, 11.5, 0)).toThrow(/Timeline rate must be finite and not zero/);
  });

  it("a timeline is a value: no operation changes the one it was given", () => {
    const before = { ...playing };
    Timeline.pause(playing, 11);
    Timeline.resume(playing, 12);
    Timeline.seek(playing, 13, 9);
    Timeline.withRate(playing, 14, 3);
    expect(playing).toEqual(before);
  });
});

describe("Timeline.run: an animation on host time", () => {
  it("is the animation's value at the mapped time", () => {
    const run = Timeline.run(Timeline.play(10, 2), signal);
    for (const h of [10, 10.4, 10.5, 11, 12.1]) expect(run.at(h)).toBe(signal.at(2 * (h - 10)));
  });

  it("forwards, changes at the host moment the mapped time reaches the animation's answer, at any rate", () => {
    for (const rate of [1, 2, 0.5, 1 / 3]) {
      const timeline = Timeline.play(10, rate);
      const run = Timeline.run(timeline, signal);
      for (const h of [10, 10.3, 10.9, 11.2, 12.7, 13.99]) {
        const next = run.nextChange(h);
        expect(Timeline.at(timeline, next), `rate ${rate} h ${h}`).toBeCloseTo(signal.nextChange(Timeline.at(timeline, h)), 9);
        expect(holdsBetween(run, h), `rate ${rate} h ${h}`).toBe(true);
      }
    }
  });

  it("backwards, changes at the host moment the mapped time drops under where the value began: a reversed loop turns at its hold boundaries", () => {
    const timeline = Timeline.play(10, -1);
    const run = Timeline.run(timeline, signal);
    // Host 10 is animation 0, the first instant of hold a; the next host
    // instant is in hold c of the pass before, so the value is moving.
    expect(run.at(10)).toBe("a");
    expect(run.nextChange(10)).toBe(10);
    expect(run.at(10.5)).toBe("c");
    expect(run.nextChange(10.5)).toBeCloseTo(12.5, 9);
    expect(run.at(12.6)).toBe("b");
    expect(run.nextChange(12.6)).toBeCloseTo(13, 9);
    expect(run.at(13.2)).toBe("a");
    expect(run.nextChange(13.2)).toBeCloseTo(14, 9);
    for (const h of [10.5, 12.6, 13.2, 14.25, 1e6 + 0.3]) expect(holdsBetween(run, h), `h ${h}`).toBe(true);
  });

  it("backwards through a one-shot, the settled value changes at the switch and the first part's start is where it began, never before", () => {
    // From host 0.3, so no hold boundary lands on host 0, where the float
    // after it is subnormal and finer than a beat's wrap resolves.
    const run = Timeline.run(Timeline.play(0.3, -1), oneShot);
    // Animation time 1e6 (host 0.3 - 1e6): settled since the switch at 2, which the host reaches at -1.7.
    expect(run.at(0.3 - 1e6)).toBe("done");
    expect(run.nextChange(0.3 - 1e6)).toBeCloseTo(-1.7, 9);
    expect(run.lastChange(0.3 - 1e6)).toBe(ALWAYS);
    expect(run.at(-1.4)).toBe("step 1");
    expect(run.nextChange(-1.4)).toBeCloseTo(-1.2, 9);
    expect(run.lastChange(-1.4)).toBeCloseTo(-1.7, 9);
    for (const h of [0.3 - 1e6, -1.4, 0.05, 1]) expect(holdsBetween(run, h), `h ${h}`).toBe(true);
  });

  it("lastChange is the start of the host hold, forwards and backwards, and is never after the host time", () => {
    for (const rate of [1, 2.5, -1, -0.5]) {
      const timeline = Timeline.play(10, rate);
      const run = Timeline.run(timeline, signal);
      for (const h of [10.2, 11.5, 12.75, 15.1, 1e6 + 0.3]) {
        const last = run.lastChange(h);
        expect(last, `rate ${rate} h ${h}`).toBeLessThanOrEqual(h);
        expect(run.at(last), `rate ${rate} h ${h}`).toBe(run.at(h));
        expect(holdsBetween(run, h), `rate ${rate} h ${h}`).toBe(true);
      }
    }
  });

  it("a value moving at its time moves on the host's clock too, whichever way", () => {
    const rising = Animation.continuous((t) => t);
    for (const rate of [1, -1, 1e-4, -1e-4]) {
      const run = Timeline.run(Timeline.play(0, rate), rising);
      for (const h of [0, 3.3, 1e6]) {
        expect(run.nextChange(h)).toBe(h);
        expect(run.lastChange(h)).toBe(h);
      }
    }
  });

  it("paused, the value is the held time's, and it never changes and never did", () => {
    const run = Timeline.run(Timeline.pause(Timeline.play(10), 11.2), signal);
    for (const h of [0, 11.2, 1e6]) {
      expect(run.at(h)).toBe(signal.at(1.2));
      expect(run.nextChange(h)).toBe(NEVER);
      expect(run.lastChange(h)).toBe(ALWAYS);
    }
  });

  it("a value that never changes again, or always was, is never and always on the host's clock whichever way the timeline runs", () => {
    const run = Timeline.run(Timeline.play(0, -2), oneShot);
    expect(run.nextChange(-1e6)).toBeCloseTo(-1, 9);
    expect(run.lastChange(-1e6)).toBe(ALWAYS);
    expect(Timeline.run(Timeline.play(0, 3), oneShot).nextChange(5)).toBe(NEVER);
    expect(Timeline.run(Timeline.play(0, 3), Animation.constant(1)).lastChange(5)).toBe(ALWAYS);
  });

  it("sampled once a second or sixty times, answers the same at every host time both see, near zero and near 10⁶", () => {
    for (const rate of [1.5, -0.75]) {
      for (const base of [10, 1e6]) {
        const run = Timeline.run(Timeline.seek(Timeline.play(base, rate), base, 0.3), signal);
        const sampled = (perSecond: number): Map<number, [string, number, number]> =>
          new Map(Array.from({ length: 6 * perSecond + 1 }, (_, i) => base + i / perSecond).map((h) => [h, [run.at(h), run.nextChange(h), run.lastChange(h)]]));
        const slow = sampled(1);
        const fast = sampled(60);
        for (const [h, seen] of slow) expect(fast.get(h), `rate ${rate} base ${base} h ${h}`).toEqual(seen);
        for (const h of slow.keys()) expect(holdsBetween(run, h), `rate ${rate} base ${base} h ${h}`).toBe(true);
      }
    }
  });

  it("answers far from the origin and at a slow rate, where a host float is many of the animation's or a fraction of one, either way", () => {
    // Host floats near 0.5 are finer than animation floats near 1000 by
    // thousands, and at a rate of 0.01 each host float is a hundredth of an
    // animation one: the host moment is a search, not a walk of a few ulps.
    const far = [1000, 1e6];
    for (const rate of [1, -1, 0.01, -0.01, 1 / 3, -1 / 3]) {
      for (const time of far) {
        const run = Timeline.run(Timeline.seek(Timeline.play(0, rate), 0, time), signal);
        for (const h of [0.5, 7.25]) {
          const next = run.nextChange(h);
          const last = run.lastChange(h);
          expect(next, `rate ${rate} time ${time} h ${h}`).toBeGreaterThanOrEqual(h);
          expect(last, `rate ${rate} time ${time} h ${h}`).toBeLessThanOrEqual(h);
          expect(run.at(next), `rate ${rate} time ${time} h ${h}`).not.toBe(run.at(h));
          expect(holdsBetween(run, h), `rate ${rate} time ${time} h ${h}`).toBe(true);
        }
      }
    }
  });

  it("the host moment is exact to the float: the float before it still draws the old value", () => {
    const double = new Float64Array(1);
    const bits = new BigUint64Array(double.buffer);
    // The float under a positive `x`, read through its bits.
    const nextDown = (x: number): number => {
      double[0] = x;
      bits[0] = bits[0]! - 1n;
      return double[0]!;
    };
    for (const rate of [1, -1, 0.01, -1 / 3]) {
      const run = Timeline.run(Timeline.seek(Timeline.play(0, rate), 0, 1000), signal);
      const next = run.nextChange(0.5);
      expect(run.at(next)).not.toBe(run.at(0.5));
      expect(run.at(nextDown(next))).toBe(run.at(0.5));
    }
  });

  it("a timeline over a timeline composes: the inner run is one more animation", () => {
    const inner = Timeline.run(Timeline.play(0, 2), signal);
    const outer = Timeline.run(Timeline.play(100, -1), inner);
    // Host 100.25 → inner -0.25 → animation -0.5: the last hold, c.
    expect(outer.at(100.25)).toBe("c");
    expect(holdsBetween(outer, 100.25)).toBe(true);
    expect(holdsBetween(outer, 101.6)).toBe(true);
  });
});

describe("a spinner's speed is a timeline", () => {
  const interval = SPINNERS["dots"]!.interval / 1000;
  const frames = SPINNERS["dots"]!.frames;
  const shown = (spinner: Spinner, t: number): { frame: string; next: number } => {
    const segments = [...spinner.at(t).render({ maxWidth: 40 })];
    return { frame: segments.map((s) => s.text).join("").trim(), next: Segment.nextChange(segments) };
  };

  it("draws the frame at the mapped time and stamps its cells with when it turns on the host's clock, forwards and backwards", () => {
    const fast = new Spinner("dots", "", { speed: 2 });
    expect(shown(fast, interval * 0.6)).toEqual({ frame: frames[1], next: expect.closeTo(interval, 9) });
    const slow = new Spinner("dots", "", { speed: 0.25 });
    expect(shown(slow, interval * 5)).toEqual({ frame: frames[1], next: expect.closeTo(interval * 8, 9) });
    const back = new Spinner("dots", "", { speed: -1 });
    expect(shown(back, interval * 2.5)).toEqual({ frame: frames[7], next: expect.closeTo(interval * 3, 9) });
    for (const t of [0.01, interval * 2.5, 1e6 + 0.1]) {
      for (const spinner of [fast, slow, back]) {
        expect(spinner.nextChange(t)).toBeGreaterThan(t);
        expect(spinner.nextChange(t)).toBeLessThanOrEqual(shown(spinner, t).next);
        expect(spinner.lastChange(t)).toBeLessThanOrEqual(t);
      }
    }
  });

  it("the stamp is the host's answer and not the sequence's own: at a quarter speed, a frame turns later than its interval", () => {
    const slow = new Spinner("dots", "", { speed: 0.25 });
    const sequence = new FrameSequence(frames.map((frame) => ({ text: new RichText(frame), seconds: interval })));
    expect(shown(slow, 0).next).toBeCloseTo(interval * 4, 9);
    expect(sequence.nextChange(0)).toBeCloseTo(interval, 9);
  });
});
