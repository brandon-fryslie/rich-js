import { describe, expect, it } from "vitest";
import { Animation, ColorDepth, FrameSequence, RichText, Segment, Spinner, beat, type Beat } from "../../src/index.js";

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

describe("Animation.constant", () => {
  it("is its value at every time and never changes", () => {
    const still = Animation.constant("x");
    for (const t of [-5, 0, 0.3, 1e6]) {
      expect(still.at(t)).toBe("x");
      expect(still.nextChange(t)).toBe(NEVER);
    }
  });
});

describe("Animation.continuous", () => {
  it("is its function's value, and moves at every moment", () => {
    const rising = Animation.continuous((t) => 2 * t);
    for (const t of [-1, 0, 0.25, 1e6]) {
      expect(rising.at(t)).toBe(2 * t);
      expect(rising.nextChange(t)).toBe(t);
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
    }
  });

  it("holds still while every part does, and moves while any part moves", () => {
    expect(Animation.all([Animation.constant(1), Animation.constant(2)]).nextChange(4)).toBe(NEVER);
    expect(Animation.all([Animation.constant(1), Animation.continuous((t) => t)]).nextChange(4)).toBe(4);
  });

  it("of none is nothing, never changing", () => {
    const none = Animation.all<number>([]);
    expect(none.at(3)).toEqual([]);
    expect(none.nextChange(3)).toBe(NEVER);
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
          expect(holdsUntilNext(steps, t), `t = ${t}`).toBe(true);
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
  });

  it("refuses a first part that is not a positive number of seconds", () => {
    for (const seconds of [0, -1, NEVER, Number.NaN]) {
      expect(() => Animation.sequence(first, seconds, then)).toThrow(/Animation.sequence seconds must be a positive number of seconds/);
    }
  });
});

describe("an animation is pure: sampled once a second or sixty times, it is the same at every time both see", () => {
  const visit = Animation.sequence(Animation.map(beat([0.25, 0.5]), (i) => `step ${i}`), 3, Animation.continuous((t) => `after ${Math.floor(t * 10)}`));
  const sampled = (rate: number, seconds: number): Map<number, [string, number]> =>
    new Map(Array.from({ length: seconds * rate + 1 }, (_, i) => i / rate).map((t) => [t, [visit.at(t), visit.nextChange(t)]]));

  it("the same value and the same answer at every second, whichever rate asked and in whichever order", () => {
    const slow = sampled(1, 8);
    const fast = sampled(60, 8);
    for (const [t, seen] of slow) expect(fast.get(t), `t = ${t}`).toEqual(seen);
    const backwards = [...slow.keys()].reverse().map((t) => [visit.at(t), visit.nextChange(t)]);
    expect(backwards.reverse()).toEqual([...slow.values()]);
  });

  it("a time a million seconds in is answered as the same point of an early pass is, with no walk through the time between", () => {
    const b = Animation.map(beat([0.25, 0.5]), (i) => i);
    // A whole number of 0.75 s passes, about a million seconds in.
    const far = 0.75 * 1_333_333;
    expect(b.at(far + 0.3)).toBe(b.at(0.3));
    expect(b.nextChange(far + 0.3) - far).toBeCloseTo(b.nextChange(0.3), 6);
  });
});

describe("the instances already in the tree", () => {
  it("a beat is an animation of the hold in progress", () => {
    const b: Animation<number> = beat([1, 0.5]) satisfies Beat;
    expect([0, 1, 1.5].map((t) => b.at(t))).toEqual([0, 1, 0]);
    expect([0, 1, 1.5].map((t) => b.nextChange(t))).toEqual([1, 1.5, 2.5]);
  });

  it("a frame sequence is an animation of the frame shown, and every cell of the frame carries its answer", () => {
    const frames: Animation<RichText> = new FrameSequence([
      { text: new RichText("a"), seconds: 1 },
      { text: new RichText("bb"), seconds: 0.5 },
    ]);
    for (const t of [0, 0.7, 1, 1.2, 1e6 + 0.1]) {
      const shown = frames.at(t);
      const stamps = [...shown.render({ maxWidth: 10 })].filter((s) => s.text !== "").map((s) => s.style?.nextChange);
      expect(stamps.length).toBeGreaterThan(0);
      for (const stamp of stamps) expect(stamp).toBe(frames.nextChange(t));
    }
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
