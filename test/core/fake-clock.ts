/**
 * A `Clock` whose time the test moves by hand: `advance` runs every tick that
 * falls due on the way, in time order, with `now()` reading each tick's own
 * moment — so frames are counted with no real timer, and `timers()` says
 * whether anything was left waiting.
 */

import type { Clock, FrameRate } from "../../src/core/clock.js";

export interface FakeClock extends Clock {
  advance(seconds: number): void;
  /**
   * Move the time on by `seconds` running nothing, as it passes while the
   * program is busy — inside a frame that costs time to draw, where no timer
   * can fire. What fell due runs on the next `advance`.
   */
  elapse(seconds: number): void;
  /** How many timers — `every` and `at` alike — are still running. */
  timers(): number;
}

// A frame due at the very end of an advance still lands in it, though summing
// a fractional interval drifts by a few ulps.
const SLACK = 1e-9;

interface Timer {
  /** Seconds from one tick to the next for an `every` timer; `undefined` for an `at`, which ticks once. */
  readonly interval: number | undefined;
  readonly tick: () => void;
  due: number;
}

export function fakeClock(start = 0): FakeClock {
  let now = start;
  const running = new Set<Timer>();
  const next = (until: number): Timer | undefined =>
    [...running].filter((timer) => timer.due <= until + SLACK).sort((a, b) => a.due - b.due)[0];
  const add = (timer: Timer): (() => void) => {
    running.add(timer);
    return () => running.delete(timer);
  };
  return {
    now: () => now,
    every: (rate: FrameRate, tick) => add({ interval: rate.interval, tick, due: now + rate.interval }),
    // A time already past is due now, as the platform's timer fires at once.
    at: (time, tick) => add({ interval: undefined, tick, due: Math.max(now, time) }),
    advance(seconds) {
      const until = now + seconds;
      for (let timer = next(until); timer !== undefined; timer = next(until)) {
        now = timer.due;
        if (timer.interval === undefined) running.delete(timer);
        else timer.due += timer.interval;
        timer.tick();
      }
      now = until;
    },
    elapse(seconds) {
      now += seconds;
    },
    timers: () => running.size,
  };
}
