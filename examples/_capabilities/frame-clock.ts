/**
 * A clock that counts frames: `now()` is how many ticks have fired, so a
 * view handed it is handed its frame number, and a repaint between ticks —
 * a key's, a resize's, a resume's — is handed the same one again. The ticks
 * come from `clock`, so an app that stops ticking, suspended say, stops the
 * count with it.
 */
import type { Clock } from "@promptctl/rich-js";

export function frameClock(clock: Clock): Clock {
  let frames = 0;
  return {
    now: () => frames,
    every: (rate, tick) =>
      clock.every(rate, () => {
        frames += 1;
        tick();
      }),
  };
}
