/**
 * A clock that counts frames: `now()` is how many ticks have fired, so a
 * view handed it is handed its frame number, and a repaint between ticks —
 * a key's, a resize's, a resume's — is handed the same one again. The ticks
 * come from `clock`, so an app that stops ticking, suspended say, stops the
 * count with it. `at(time, tick)` is a frame number to wake on: its tick
 * fires on the first frame the count reaches it, since nothing on this clock
 * happens between frames — so it wakes nothing unless something is running
 * `every` on this clock, as an `App` handed it does.
 */
import type { Clock } from "@promptctl/rich-js";

export function frameClock(clock: Clock): Clock {
  let frames = 0;
  const waking = new Set<{ readonly frame: number; readonly tick: () => void }>();
  return {
    now: () => frames,
    every: (rate, tick) =>
      clock.every(rate, () => {
        frames += 1;
        for (const wake of [...waking]) {
          if (frames < wake.frame) continue;
          waking.delete(wake);
          wake.tick();
        }
        tick();
      }),
    at: (time, tick) => {
      const wake = { frame: time, tick };
      waking.add(wake);
      return () => void waking.delete(wake);
    },
  };
}
