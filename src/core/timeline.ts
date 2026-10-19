/**
 * Timeline — the map from the host's clock to the time an animation is
 * asked for: playback control, and nothing else.
 *
 * Every animation is a pure function of its time (`./animation.ts`), so
 * pausing, reversing, scrubbing and speeding one up are not things done to
 * it but a change in which time it is asked for. A timeline is that map, as
 * a value: an animation time at a host time, a rate — animation seconds per
 * host second, negative running it backwards — and whether it is held. Each
 * operation is a value in and a value out, so a paused timeline resumed at a
 * new host time is one that maps that host time to the time it froze at, and
 * two hosts holding equal timelines ask every animation for the same time.
 *
 * A paused timeline carries no host anchor: it maps every host time to the
 * one time it holds, so there is no origin for it to be wrong about.
 * [LAW:types-are-the-program]
 *
 * `run` is an animation on host time. Its `nextChange` is the host moment
 * the mapped time reaches the animation's own answer, which is what
 * `Spinner`'s speed scaled its holds for before this existed: an answer a
 * host reads is on the host's timeline, and a beat over scaled time answers
 * on the scaled one. Run backwards, the host next sees a change when the
 * mapped time drops under where the value began — the animation's
 * `lastChange` — so a reversed loop turns exactly at its hold boundaries,
 * and a reversed one-shot changes at its switch and never before its start.
 * Paused, nothing changes: never, and never did. The host moment is the sum
 * `origin + (edge - time) / rate` walked up to the first float the map
 * carries past the edge (`walkUp`), as `Beat` carries a hold's start, so a
 * host drawing at the answer draws the new value. A value moving at the
 * mapped time changes at the host time itself, with no walk to take.
 *
 * [LAW:no-ambient-temporal-coupling] Nothing here reads a clock. The host
 * time is an argument everywhere, and a timeline is built from one the host
 * hands in, so the same host time maps to the same animation time at one
 * sample a second or sixty.
 */

import type { Animation } from "./animation.js";
import { walkUp } from "./easing.js";

/**
 * A map from host time to animation time. Playing, it is `time` at `origin`
 * moving `rate` animation seconds a host second; paused, it is `time` at
 * every host time, with the rate it resumes at.
 */
export type Timeline =
  | {
      readonly playing: true;
      /** The host time, in seconds, at which the animation time is `time`. */
      readonly origin: number;
      /** The animation time, in seconds, at `origin`. */
      readonly time: number;
      /** Animation seconds per host second; negative runs the animation backwards. Never zero: a held timeline is paused. */
      readonly rate: number;
    }
  | {
      readonly playing: false;
      /** The animation time, in seconds, held at every host time. */
      readonly time: number;
      /** The rate the timeline resumes at. */
      readonly rate: number;
    };

/** Throws, naming `what`, unless `seconds` is a finite number of seconds. */
function finiteSeconds(what: string, seconds: number): number {
  if (!Number.isFinite(seconds)) throw new RangeError(`${what} must be a finite number of seconds, got ${seconds}`);
  return seconds;
}

/**
 * [LAW:parse-dont-validate] A rate is a finite number other than zero,
 * settled where it is given: a rate of zero would be a second way to hold a
 * timeline still, and `pause` is the one.
 */
function playbackRate(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) throw new RangeError(`Timeline rate must be finite and not zero, got ${rate}`);
  return rate;
}

/** `timeline` with `time` at host time `host`, at `rate`, held as it was. */
function anchored(timeline: Timeline, host: number, time: number, rate: number): Timeline {
  return timeline.playing ? { playing: true, origin: finiteSeconds("Timeline host time", host), time, rate } : { playing: false, time, rate };
}

/** `animation` asked at the time `playing` maps each host time to, saying on host time when it changes. */
function played<T>(animation: Animation<T>, { origin, time, rate }: Timeline & { playing: true }): Animation<T> {
  const mapped = (host: number): number => time + rate * (finiteSeconds("Timeline host time", host) - origin);
  // The first host moment the map carries past `edge`, an animation time:
  // the sum walked up until `past` holds of the mapped time, so a host
  // drawing then draws the far side. An edge at infinity is `never`.
  const hostOf = (edge: number, past: (mapped: number) => boolean, never: number, host: number): number =>
    Number.isFinite(edge)
      ? walkUp(
          origin + (edge - time) / rate,
          (x) => past(mapped(x)),
          () => `Timeline: a change at ${edge} s on the animation's timeline is finer than host time resolves near ${host} s at rate ${rate}`,
        )
      : never;
  const at = (host: number): T => animation.at(mapped(host));
  if (rate > 0) {
    return {
      at,
      nextChange(host) {
        const t = mapped(host);
        const next = animation.nextChange(t);
        return next <= t ? host : Math.max(host, hostOf(next, (x) => x >= next, Number.POSITIVE_INFINITY, host));
      },
      lastChange(host) {
        const t = mapped(host);
        const last = animation.lastChange(t);
        return last >= t ? host : Math.min(host, hostOf(last, (x) => x >= last, Number.NEGATIVE_INFINITY, host));
      },
    };
  }
  // Backwards, the host runs down the animation's timeline: it next sees a
  // change when the mapped time drops under where the value began, and the
  // value it sees began when the mapped time dropped under where the value
  // ends. A hold is `[lastChange, nextChange)`, so the far side is strictly
  // under either edge.
  return {
    at,
    nextChange(host) {
      const t = mapped(host);
      const last = animation.lastChange(t);
      return last >= t ? host : Math.max(host, hostOf(last, (x) => x < last, Number.POSITIVE_INFINITY, host));
    },
    lastChange(host) {
      const t = mapped(host);
      const next = animation.nextChange(t);
      return next <= t ? host : Math.min(host, hostOf(next, (x) => x < next, Number.NEGATIVE_INFINITY, host));
    },
  };
}

export const Timeline = {
  /** Playing from host time `origin`, at which the animation time is 0, at `rate` animation seconds a host second. */
  play(origin: number, rate = 1): Timeline {
    return { playing: true, origin: finiteSeconds("Timeline.play origin", origin), time: 0, rate: playbackRate(rate) };
  },

  /** The animation time at host time `host`. */
  at(timeline: Timeline, host: number): number {
    const h = finiteSeconds("Timeline host time", host);
    return timeline.playing ? timeline.time + timeline.rate * (h - timeline.origin) : timeline.time;
  },

  /** `timeline` held at the animation time it maps `host` to. Pausing a paused timeline holds the same time. */
  pause(timeline: Timeline, host: number): Timeline {
    return { playing: false, time: Timeline.at(timeline, host), rate: timeline.rate };
  },

  /** `timeline` playing from `host` at the animation time it maps `host` to, at its rate. Resuming a playing timeline is the same map. */
  resume(timeline: Timeline, host: number): Timeline {
    return { playing: true, origin: finiteSeconds("Timeline host time", host), time: Timeline.at(timeline, host), rate: timeline.rate };
  },

  /** `timeline` with the animation at `time` at host time `host`, playing or held as it was. */
  seek(timeline: Timeline, host: number, time: number): Timeline {
    return anchored(timeline, host, finiteSeconds("Timeline.seek time", time), timeline.rate);
  },

  /** `timeline` at `rate` from host time `host` on, with no jump: the animation time at `host` is what it was. */
  withRate(timeline: Timeline, host: number, rate: number): Timeline {
    return anchored(timeline, host, Timeline.at(timeline, host), playbackRate(rate));
  },

  /**
   * `animation` on host time: its value at the time `timeline` maps each
   * host time to, changing at the host moment the mapped time reaches the
   * animation's own answer — backwards, when it drops under where the value
   * began. Paused, the value never changes and never did.
   */
  run<T>(timeline: Timeline, animation: Animation<T>): Animation<T> {
    if (timeline.playing) return played(animation, timeline);
    return {
      at: (host) => animation.at(Timeline.at(timeline, host)),
      nextChange: () => Number.POSITIVE_INFINITY,
      lastChange: () => Number.NEGATIVE_INFINITY,
    };
  },
};
