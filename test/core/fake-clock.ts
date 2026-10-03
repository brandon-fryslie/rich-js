/**
 * A `Clock` whose time the test moves by hand: `advance` runs every tick that
 * falls due on the way, in time order, with `now()` reading each tick's own
 * moment — so frames are counted with no real timer, and `timers()` says
 * whether anything was left ticking.
 */

import type { Clock, FrameRate } from "../../src/core/clock.js";

export interface FakeClock extends Clock {
  advance(seconds: number): void;
  /** How many `every` timers are still running. */
  timers(): number;
}

// A frame due at the very end of an advance still lands in it, though summing
// a fractional interval drifts by a few ulps.
const SLACK = 1e-9;

interface Timer {
  readonly rate: FrameRate;
  readonly tick: () => void;
  due: number;
}

export function fakeClock(start = 0): FakeClock {
  let now = start;
  const running = new Set<Timer>();
  const next = (until: number): Timer | undefined =>
    [...running].filter((timer) => timer.due <= until + SLACK).sort((a, b) => a.due - b.due)[0];
  return {
    now: () => now,
    every(rate, tick) {
      const timer: Timer = { rate, tick, due: now + rate.interval };
      running.add(timer);
      return () => running.delete(timer);
    },
    advance(seconds) {
      const until = now + seconds;
      for (let timer = next(until); timer !== undefined; timer = next(until)) {
        now = timer.due;
        timer.due += timer.rate.interval;
        timer.tick();
      }
      now = until;
    },
    timers: () => running.size,
  };
}
