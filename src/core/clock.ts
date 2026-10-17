/**
 * Clock — the time source and timer whoever draws frames is handed, and the
 * frame rate it ticks at.
 *
 * [LAW:no-ambient-temporal-coupling] Frame rate belongs to whoever draws the
 * frames — an `App`, a `Live` — never to what is drawn, and each ticks on the
 * `Clock` it was given. An `App` reads the frame's time through that clock and
 * hands it to its view as data, so nothing rendered reads a clock, and an
 * effect sampled thirty times a second or once every two seconds runs the
 * same code.
 *
 * [LAW:effects-at-boundaries] The clock is a capability passed in, like the
 * `TerminalHost`: a test hands over a clock whose time it moves by hand and
 * counts frames with no real timer, and nothing it starts can outlive the
 * thing that started it. `systemClock` is the one place the library reads the
 * platform's clock and timers, and it reads them only when called.
 */

import type { Unsubscribe } from "./subscription.js";

declare const parsed: unique symbol;

/**
 * How often frames are drawn: a positive, finite number of frames a second,
 * fractional included — 0.5 is one frame every two seconds.
 *
 * [LAW:parse-dont-validate] Only `frameRate` makes one, so holding a
 * `FrameRate` is the proof the number was checked, and nothing that takes one
 * checks it again.
 */
export interface FrameRate {
  readonly perSecond: number;
  /** Seconds from one frame to the next. */
  readonly interval: number;
  readonly [parsed]: true;
}

// The longest delay a platform timer holds, in seconds: setInterval clamps a
// longer one to a millisecond, which would turn the slowest rate into the
// fastest.
const LONGEST_INTERVAL = (2 ** 31 - 1) / 1000;

/**
 * `perSecond` as a `FrameRate`; anything but a positive, finite number throws,
 * and so does a rate whose frames are further apart than a timer can wait —
 * about 24.8 days.
 */
export function frameRate(perSecond: number): FrameRate {
  if (!(Number.isFinite(perSecond) && perSecond > 0 && 1 / perSecond <= LONGEST_INTERVAL)) {
    throw new RangeError(
      `a frame rate is a positive, finite number of frames a second, at most ${LONGEST_INTERVAL} s apart, not ${perSecond}`,
    );
  }
  return { perSecond, interval: 1 / perSecond } as FrameRate;
}

export interface Clock {
  /** The time now, in seconds, on this clock's own timeline, which never runs backwards. */
  now(): number;
  /** Call `tick` once a frame at `rate` until the returned function is called. */
  every(rate: FrameRate, tick: () => void): Unsubscribe;
  /**
   * Call `tick` once, when this clock reads `time` — as soon as it can for a
   * time already past — unless the returned function is called first. What
   * a host that knows when its frame next changes (`Segment.nextChange`)
   * waits on. A `time` further off than a timer can wait, about 24.8 days,
   * throws, as `frameRate` refuses the rate.
   */
  at(time: number, tick: () => void): Unsubscribe;
}

/** The platform's monotonic clock and its timers. */
export function systemClock(): Clock {
  const now = (): number => performance.now() / 1000;
  return {
    now,
    every: (rate, tick) => {
      const timer = setInterval(tick, rate.interval * 1000);
      return () => clearInterval(timer);
    },
    at: (time, tick) => {
      if (!(time - now() <= LONGEST_INTERVAL)) {
        throw new RangeError(`a clock waits at most ${LONGEST_INTERVAL} s, not until ${time} s from ${now()} s`);
      }
      // [LAW:single-enforcer] A platform timer is due by a whole millisecond
      // of the event loop's own time, truncated, so it can run while this
      // clock still reads under `time` — by most of a millisecond. The
      // contract is the clock's reading, and it is held here, once, for every
      // host: the wait is rounded up, and a timer that runs early is armed
      // again for what remains, so `tick` runs when `now()` has reached
      // `time` and not before. A host re-drawing at a frame's end would
      // otherwise draw the old frame again and wait again, every boundary.
      let timer: ReturnType<typeof setTimeout>;
      const arm = (): void => {
        timer = setTimeout(() => (now() < time ? arm() : tick()), Math.ceil(Math.max(0, time - now()) * 1000));
      };
      arm();
      return () => clearTimeout(timer);
    },
  };
}
