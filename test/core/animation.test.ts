import { describe, expect, it } from "vitest";
import { Animation, ColorDepth, EASES, FrameSequence, Phase, RichText, Segment, Spinner, Timeline, beat, frameAt, tween, type Beat } from "../../src/index.js";
import { nextDown } from "./next-down.js";

// [LAW:behavior-not-structure] What is asserted is the contract a host reads:
// the value at a time, and that it holds from `t` until `nextChange(t)` and
// not past it.

const NEVER = Number.POSITIVE_INFINITY;

/** Whether `animation` holds `at(t)` over `[t, nextChange(t))`, sampled at `samples` points inside; the answer is never before `t`. */
function holdsUntilNext<T>(animation: Animation<T>, t: number, samples = 16): boolean {
  const next = animation.nextChange(t);
  if (next < t) return false;
  const span = Number.isFinite(next) ? next - t : 10;
  return Array.from({ length: samples }, (_, i) => t + (span * i) / samples).every((u) => u >= next || animation.at(u) === animation.at(t));
}

const ALWAYS = Number.NEGATIVE_INFINITY;

/** Whether `animation` has held `at(t)` over `[lastChange(t), t]`, sampled at `samples` points inside; the answer is never after `t`. */
function heldSinceLast<T>(animation: Animation<T>, t: number, samples = 16): boolean {
  const last = animation.lastChange(t);
  if (last > t) return false;
  const span = Number.isFinite(last) ? t - last : 10;
  return Array.from({ length: samples }, (_, i) => t - (span * i) / samples).every((u) => animation.at(u) === animation.at(t));
}

describe("Animation.constant", () => {
  it("is its value at every time, never changes and always was", () => {
    const still = Animation.constant("x");
    for (const t of [-5, 0, 0.3, 1e6]) {
      expect(still.at(t)).toBe("x");
      expect(still.nextChange(t)).toBe(NEVER);
      expect(still.lastChange(t)).toBe(ALWAYS);
    }
  });
});

describe("Animation.continuous", () => {
  it("is its function's value, and moves at every moment, both ways", () => {
    const rising = Animation.continuous((t) => 2 * t);
    for (const t of [-1, 0, 0.25, 1e6]) {
      expect(rising.at(t)).toBe(2 * t);
      expect(rising.nextChange(t)).toBe(t);
      expect(rising.lastChange(t)).toBe(t);
    }
  });
});

describe("Animation.map", () => {
  it("is the value through the function, changing when the source does", () => {
    const b = beat([1, 0.5]);
    const named = Animation.map(b, (i) => ["a", "b"][i]!);
    for (const t of [0, 0.99, 1, 1.4, 1.5, 1e6 + 1.2]) {
      expect(named.at(t)).toBe(["a", "b"][b.at(t)]);
      expect(named.nextChange(t)).toBe(b.nextChange(t));
      expect(named.lastChange(t)).toBe(b.lastChange(t));
    }
  });

  it("two values mapped alike make an early answer, which the contract allows: the value still holds until it", () => {
    const flat = Animation.map(beat([1, 1]), () => "same");
    expect(flat.nextChange(0.5)).toBe(1);
    expect(holdsUntilNext(flat, 0.5)).toBe(true);
  });
});

describe("Animation.all", () => {
  it("is every value in order, changing when the soonest of them does", () => {
    const [slow, fast] = [beat([3]), beat([0.5, 0.25])];
    const both = Animation.all([slow, fast, Animation.constant(9)]);
    for (const t of [0, 0.4, 0.6, 2.9, 1e6 + 0.1]) {
      expect(both.at(t)).toEqual([slow.at(t), fast.at(t), 9]);
      expect(both.nextChange(t)).toBe(Math.min(slow.nextChange(t), fast.nextChange(t)));
      expect(both.lastChange(t)).toBe(Math.max(slow.lastChange(t), fast.lastChange(t)));
    }
  });

  it("holds still while every part does, and moves while any part moves", () => {
    const still = Animation.all([Animation.constant(1), Animation.constant(2)]);
    expect(still.nextChange(4)).toBe(NEVER);
    expect(still.lastChange(4)).toBe(ALWAYS);
    const moving = Animation.all([Animation.constant(1), Animation.continuous((t) => t)]);
    expect(moving.nextChange(4)).toBe(4);
    expect(moving.lastChange(4)).toBe(4);
  });

  it("of none is nothing, never changing", () => {
    const none = Animation.all<number[]>([]);
    expect(none.at(3)).toEqual([]);
    expect(none.nextChange(3)).toBe(NEVER);
    expect(none.lastChange(3)).toBe(ALWAYS);
  });
});

describe("Animation.sequence", () => {
  const first = Animation.continuous((t) => `first ${t}`);
  const then = Animation.continuous((t) => `then ${t}`);

  it("is the first part until the switch, then the next part on its own clock from 0", () => {
    const both = Animation.sequence(first, 2, then);
    expect(both.at(0)).toBe("first 0");
    expect(both.at(1.5)).toBe("first 1.5");
    expect(both.at(2)).toBe("then 0");
    expect(both.at(3.5)).toBe("then 1.5");
    expect(both.at(-1)).toBe("first -1");
  });

  it("before the switch it changes when the first part does or at the switch, whichever is sooner", () => {
    expect(Animation.sequence(first, 2, then).nextChange(1)).toBe(1);
    expect(Animation.sequence(Animation.constant("a"), 2, then).nextChange(1)).toBe(2);
    expect(Animation.sequence(beat([0.5]), 2, beat([1])).nextChange(1.2)).toBe(1.5);
    expect(Animation.sequence(beat([5]), 2, beat([1])).nextChange(1.2)).toBe(2);
  });

  it("after the switch it changes when the next part does, carried back onto the shared timeline", () => {
    expect(Animation.sequence(first, 2, then).nextChange(3)).toBe(3);
    expect(Animation.sequence(Animation.constant(-1), 2, beat([1, 0.5])).nextChange(3.2)).toBe(3.5);
    expect(Animation.sequence(first, 2, Animation.constant("done")).nextChange(9)).toBe(NEVER);
  });

  it("answers the first moment the next part's change shows, to the float, far from zero and on holds not exact in binary", () => {
    for (const seconds of [0.1, 0.3, 2.7]) {
      const steps = Animation.sequence(Animation.constant(-1), seconds, beat([0.1, 0.2, 0.3]));
      for (const base of [0, 1e3, 1e6]) {
        for (let i = 0; i < 30; i++) {
          const t = base + seconds + i * 0.037;
          const next = steps.nextChange(t);
          expect(next, `t = ${t}`).toBeGreaterThan(t);
          expect(steps.at(next), `t = ${t}`).not.toBe(steps.at(t));
          // Never late: the float before the answer still shows the old value.
          expect(steps.at(nextDown(next)), `t = ${t}`).toBe(steps.at(t));
          expect(holdsUntilNext(steps, t), `t = ${t}`).toBe(true);
        }
      }
    }
  });

  it("before the switch it became what it is when the first part did; after, at the switch or when the next part did since, whichever is later", () => {
    expect(Animation.sequence(first, 2, then).lastChange(1)).toBe(1);
    expect(Animation.sequence(Animation.constant("a"), 2, then).lastChange(1)).toBe(ALWAYS);
    expect(Animation.sequence(beat([0.5]), 2, beat([1])).lastChange(1.2)).toBe(1);
    expect(Animation.sequence(first, 2, Animation.constant("done")).lastChange(9)).toBe(2);
    expect(Animation.sequence(first, 2, Animation.constant("done")).lastChange(2)).toBe(2);
    expect(Animation.sequence(Animation.constant(-1), 2, beat([1, 0.5])).lastChange(3.2)).toBe(3);
    expect(Animation.sequence(Animation.constant(-1), 2, beat([1, 0.5])).lastChange(2.4)).toBe(2);
    expect(Animation.sequence(first, 2, then).lastChange(3)).toBe(3);
  });

  it("answers the first moment the next part's value shows, to the float, far from zero and on holds not exact in binary", () => {
    for (const seconds of [0.1, 0.3, 2.7]) {
      const steps = Animation.sequence(Animation.constant(-1), seconds, beat([0.1, 0.2, 0.3]));
      for (const base of [0, 1e3, 1e6]) {
        for (let i = 0; i < 30; i++) {
          const t = base + seconds + i * 0.037;
          const last = steps.lastChange(t);
          expect(last, `t = ${t}`).toBeLessThanOrEqual(t);
          expect(steps.at(last), `t = ${t}`).toBe(steps.at(t));
          expect(heldSinceLast(steps, t), `t = ${t}`).toBe(true);
        }
      }
    }
  });

  it("sequences nest, each part on its own clock", () => {
    const arrive = Animation.constant("arriving");
    const stay = Animation.constant("here");
    const leave = Animation.continuous((t) => `leaving ${t}`);
    const visit = Animation.sequence(arrive, 1, Animation.sequence(stay, 3, leave));
    expect([0.5, 1, 3.9, 4, 4.5].map((t) => visit.at(t))).toEqual(["arriving", "here", "here", "leaving 0", "leaving 0.5"]);
    expect([0.5, 2, 4.5].map((t) => visit.nextChange(t))).toEqual([1, 4, 4.5]);
    expect([0.5, 2, 4.5].map((t) => visit.lastChange(t))).toEqual([ALWAYS, 1, 4.5]);
  });

  it("refuses a first part that is not a positive number of seconds", () => {
    for (const seconds of [0, -1, NEVER, Number.NaN]) {
      expect(() => Animation.sequence(first, seconds, then)).toThrow(/Animation.sequence seconds must be a positive number of seconds/);
    }
  });
});

describe("Animation.repeat", () => {
  /** Turn `n` showing `n` throughout: every turn boundary is a change, and nothing else is. */
  const turns = (period: number): Animation<number> => Animation.repeat(period, (n) => Animation.constant(n));

  it("is the nth one-shot through the nth turn, each on its own clock from 0", () => {
    const played = Animation.repeat(2, (n) => Animation.continuous((t) => `${n}:${t}`));
    expect([0, 0.5, 2, 3.5, 6].map((t) => played.at(t))).toEqual(["0:0", "0:0.5", "1:0", "1:1.5", "3:0"]);
  });

  it("next changes when the turn's one-shot does or at the next turn, whichever is sooner", () => {
    expect(turns(2).nextChange(0.5)).toBe(2);
    expect(Animation.repeat(2, () => beat([0.5])).nextChange(1.2)).toBe(1.5);
    expect(Animation.repeat(2, () => Animation.continuous((t) => t)).nextChange(3.2)).toBe(3.2);
    expect(Animation.repeat(2, () => tween(0, 1, { seconds: 1, ease: EASES.linear })).nextChange(3.5)).toBe(4);
  });

  it("became what it is when the turn's one-shot did or at this turn's start, whichever is later", () => {
    expect(turns(2).lastChange(3.5)).toBe(2);
    expect(Animation.repeat(2, () => beat([0.5])).lastChange(3.2)).toBe(3);
    expect(Animation.repeat(2, () => Animation.continuous((t) => t)).lastChange(3.2)).toBe(3.2);
  });

  it("has turns before 0, so a timeline run back past the start is still in one", () => {
    expect([-0.5, -2, -2.5].map((t) => turns(2).at(t))).toEqual([-1, -1, -2]);
    expect(turns(2).nextChange(-0.5)).toBe(0);
    expect(turns(2).lastChange(-0.5)).toBe(-2);
  });

  it("names turn 0 as 0, never -0, for a time the wrap carries onto it from below", () => {
    for (const t of [-0, -1e-20]) expect(Object.is(turns(2).at(t), 0), `t = ${t}`).toBe(true);
  });

  it("answers each turn's boundary to the float both ways, far from zero and on periods not exact in binary", () => {
    for (const period of [0.1, 0.3, 2.7]) {
      const repeated = turns(period);
      for (const base of [10, 1e3, 1e6]) {
        for (let i = 0; i < 30; i++) {
          const t = base + i * 0.037;
          const next = repeated.nextChange(t);
          expect(repeated.at(next), `t = ${t}`).toBe(repeated.at(t) + 1);
          expect(repeated.at(nextDown(next)), `t = ${t}`).toBe(repeated.at(t));
          const last = repeated.lastChange(t);
          expect(repeated.at(last), `t = ${t}`).toBe(repeated.at(t));
          expect(repeated.at(nextDown(last)), `t = ${t}`).toBe(repeated.at(t) - 1);
          expect(holdsUntilNext(repeated, t) && heldSinceLast(repeated, t), `t = ${t}`).toBe(true);
        }
      }
    }
  });

  it("turns on the float a beat and a loop of the same period turn on, a period not exact in binary included", () => {
    const period = 0.1;
    const repeated = turns(period);
    const pass = beat([period]);
    const loop = Phase.loop(period);
    for (const base of [10, 1e3, 1e6]) {
      for (let i = 0; i < 40; i++) {
        const inside = base + i * period + period / 2;
        const begins = pass.nextChange(inside);
        expect(repeated.nextChange(inside), `t = ${inside}`).toBe(begins);
        expect(repeated.at(begins), `t = ${inside}`).toBe(repeated.at(inside) + 1);
        expect(loop(begins), `t = ${inside}`).toBeLessThan(0.5);
        expect(repeated.at(nextDown(begins)), `t = ${inside}`).toBe(repeated.at(inside));
        expect(loop(nextDown(begins)), `t = ${inside}`).toBeGreaterThan(0.5);
      }
    }
  });

  it("run backwards on a timeline, wakes its host where the turn began", () => {
    const repeated = turns(2);
    // At animation time 5 at host 0, running back a second a second: turn 2 until host 1.
    const backwards = Timeline.run(Timeline.seek(Timeline.play(0, -1), 0, 5), repeated);
    expect(backwards.at(0.5)).toBe(2);
    const wake = backwards.nextChange(0.5);
    expect(backwards.at(wake)).toBe(1);
    expect(backwards.at(nextDown(wake))).toBe(2);
    expect(wake).toBeCloseTo(1, 12);
  });

  it("reduced, keeps every turn and cuts each one-shot inside to its end where the turn begins", () => {
    const rising = Animation.repeat(3, (n) => tween(n, n + 1, { seconds: 1, ease: EASES.linear })).reduced();
    expect([0, 0.5, 2.9, 3, 3.2].map((t) => rising.at(t))).toEqual([1, 1, 1, 2, 2]);
    expect(rising.nextChange(3.2)).toBe(6);
    expect(rising.lastChange(3.2)).toBe(3);
  });

  it("is the same sampled once a second or sixty times, and a million seconds in is a turn like the first", () => {
    const pulse = Animation.repeat(1.5, () => Animation.map(beat([0.25, 0.5]), (i) => i));
    const sampled = (rate: number): Map<number, [number, number, number]> =>
      new Map(Array.from({ length: 8 * rate + 1 }, (_, i) => i / rate).map((t) => [t, [pulse.at(t), pulse.nextChange(t), pulse.lastChange(t)]]));
    const slow = sampled(1);
    const fast = sampled(60);
    for (const [t, seen] of slow) expect(fast.get(t), `t = ${t}`).toEqual(seen);
    const far = 1.5 * 666_666;
    expect(pulse.at(far + 0.3)).toBe(pulse.at(0.3));
    expect(pulse.nextChange(far + 0.3) - far).toBeCloseTo(pulse.nextChange(0.3), 6);
    expect(pulse.lastChange(far + 0.3) - far).toBeCloseTo(pulse.lastChange(0.3), 6);
  });

  it("refuses a period that is not a positive number of seconds", () => {
    for (const period of [0, -1, NEVER, Number.NaN]) {
      expect(() => turns(period)).toThrow(/Animation.repeat period must be a positive number of seconds/);
    }
  });
});

describe("an animation is pure: sampled once a second or sixty times, it is the same at every time both see", () => {
  const visit = Animation.sequence(Animation.map(beat([0.25, 0.5]), (i) => `step ${i}`), 3, Animation.continuous((t) => `after ${Math.floor(t * 10)}`));
  const sampled = (rate: number, seconds: number): Map<number, [string, number, number]> =>
    new Map(Array.from({ length: seconds * rate + 1 }, (_, i) => i / rate).map((t) => [t, [visit.at(t), visit.nextChange(t), visit.lastChange(t)]]));

  it("the same value and the same answer at every second, whichever rate asked and in whichever order", () => {
    const slow = sampled(1, 8);
    const fast = sampled(60, 8);
    for (const [t, seen] of slow) expect(fast.get(t), `t = ${t}`).toEqual(seen);
    const backwards = [...slow.keys()].reverse().map((t) => [visit.at(t), visit.nextChange(t), visit.lastChange(t)]);
    expect(backwards.reverse()).toEqual([...slow.values()]);
  });

  it("a time a million seconds in is answered as the same point of an early pass is, with no walk through the time between", () => {
    const b = Animation.map(beat([0.25, 0.5]), (i) => i);
    // A whole number of 0.75 s passes, about a million seconds in.
    const far = 0.75 * 1_333_333;
    expect(b.at(far + 0.3)).toBe(b.at(0.3));
    expect(b.nextChange(far + 0.3) - far).toBeCloseTo(b.nextChange(0.3), 6);
    expect(b.lastChange(far + 0.3) - far).toBeCloseTo(b.lastChange(0.3), 6);
  });
});

describe("the instances already in the tree", () => {
  it("a beat is an animation of the hold in progress", () => {
    const b: Animation<number> = beat([1, 0.5]) satisfies Beat;
    expect([0, 1, 1.5].map((t) => b.at(t))).toEqual([0, 1, 0]);
    expect([0, 1, 1.5].map((t) => b.nextChange(t))).toEqual([1, 1.5, 2.5]);
    expect([0, 1, 1.5, 2.9].map((t) => b.lastChange(t))).toEqual([0, 1, 1.5, 2.5]);
  });

  it("a frame sequence is an animation of the frame shown, on no clock: the frame drawn at a host time carries its answer, the frame alone carries none", () => {
    const frames: Animation<RichText> = new FrameSequence([
      { text: new RichText("a"), seconds: 1 },
      { text: new RichText("bb"), seconds: 0.5 },
    ]);
    const stampsOf = (shown: RichText): (number | undefined)[] =>
      [...shown.render({ maxWidth: 10 })].filter((s) => s.text !== "").map((s) => s.style?.nextChange);
    for (const t of [0, 0.7, 1, 1.2, 1e6 + 0.1]) {
      const shown = frames.at(t);
      for (const stamp of stampsOf(shown)) expect(stamp ?? Number.POSITIVE_INFINITY).toBe(Number.POSITIVE_INFINITY);
      const drawn = stampsOf(frameAt(frames, t));
      expect(drawn.length).toBeGreaterThan(0);
      for (const stamp of drawn) expect(stamp).toBe(frames.nextChange(t));
      expect(frames.lastChange(t)).toBeLessThanOrEqual(t);
      expect(frames.at(frames.lastChange(t)).plain).toBe(shown.plain);
    }
  });

  it("a frame sequence run on a timeline, or after a switch, is stamped on the host's clock where it is drawn", () => {
    const frames = new FrameSequence([
      { text: new RichText("a"), seconds: 0.1 },
      { text: new RichText("b"), seconds: 0.1 },
    ]);
    const fast = Timeline.run(Timeline.play(0, 4), frames);
    expect(Segment.nextChange(frameAt(fast, 0).render({ maxWidth: 10 }))).toBeCloseTo(0.025, 12);
    expect(fast.at(0.03).plain).toBe("b");
    const later = Animation.sequence(Animation.constant(new RichText("-")), 2, frames);
    expect(Segment.nextChange(frameAt(later, 2.05).render({ maxWidth: 10 }))).toBeCloseTo(2.1, 12);
  });

  it("stamps a copy: an animation handing back the one text it holds keeps it unstamped, so no draw outlives its moment", () => {
    const texts = [new RichText("x"), new RichText("y")];
    const shared = Animation.map(beat([1, 1]), (i) => texts[i]!);
    for (const t of [0.5, 2.5, 4.5]) expect(Segment.nextChange(frameAt(shared, t).render({ maxWidth: 10 }))).toBe(t + 0.5);
    for (const text of texts) expect(text.spans).toEqual([]);
  });

  it("a sum that rounds over the moment the next part's change shows is walked back onto it", () => {
    // 2.45 + 0.7 rounds to 3.1500000000000004, a float after the change showed at 3.15.
    const steps = Animation.sequence(Animation.constant("before"), 0.7, Animation.map(beat([0.3, 0.05]), (i) => `y${i}`));
    expect(steps.at(3.144)).toBe("y1");
    expect(steps.nextChange(3.144)).toBe(3.15);
    expect(steps.at(3.15)).toBe("y0");
  });

  it("an edge every finite host float is past, or none is, is always or never, not a hang", () => {
    const settled: Animation<string> = { at: () => "a", nextChange: () => Number.POSITIVE_INFINITY, lastChange: () => -Number.MAX_VALUE, reduced: () => Animation.constant("a") };
    expect(Timeline.run(Timeline.play(0, 1), settled).lastChange(0)).toBe(Number.NEGATIVE_INFINITY);
    const pending: Animation<string> = { at: () => "a", nextChange: () => Number.MAX_VALUE, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => Animation.constant("a") };
    expect(Timeline.run(Timeline.play(0, 1), pending).nextChange(0)).toBe(Number.MAX_VALUE);
    expect(Timeline.run(Timeline.play(0, 0.5), pending).nextChange(0)).toBe(Number.POSITIVE_INFINITY);
  });

  it("a paused run refuses a host time that is not finite, as a playing one does", () => {
    const paused = Timeline.run(Timeline.pause(Timeline.play(0), 1), beat([1]));
    expect(() => paused.nextChange(Number.NaN)).toThrow(/Timeline host time must be a finite number of seconds/);
    expect(() => paused.lastChange(Number.POSITIVE_INFINITY)).toThrow(/Timeline host time must be a finite number of seconds/);
  });

  it("an edge no host float reaches at this rate is never, not a hang", () => {
    const crawl = Timeline.run(Timeline.play(0, 1e-310), beat([1]));
    expect(crawl.nextChange(0.5)).toBe(Number.POSITIVE_INFINITY);
    // The start of the hold is within reach: host 0, to the floats the
    // product of a subnormal rate and a host time resolves.
    const began = crawl.lastChange(0.5);
    expect(began).toBeLessThanOrEqual(0);
    expect(began).toBeGreaterThan(-1e-12);
  });

  it("a spinner is an animation of the spinner drawn, never answering after the frame it drew turns, on any output", () => {
    const spinner = new Spinner("dots", "working");
    const animation: Animation<unknown> = spinner;
    for (const t of [0, 0.05, 0.5, 1e6 + 0.02]) {
      for (const options of [{ maxWidth: 30 }, { maxWidth: 30, asciiOnly: true, colorSystem: ColorDepth.STANDARD }]) {
        const drawn = Segment.nextChange(spinner.at(t).render(options));
        expect(animation.nextChange(t)).toBeGreaterThan(t);
        expect(animation.nextChange(t)).toBeLessThanOrEqual(drawn);
      }
    }
  });
});
