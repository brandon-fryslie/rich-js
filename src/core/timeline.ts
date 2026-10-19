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
 * Paused, nothing changes: never, and never did. The host moment is the
 * first host float the map carries past the edge, searched out from the sum
 * `origin + (edge - time) / rate` (`firstReaching`): a host float is a step
 * of `rate` on the animation's clock, so the floats between that sum and
 * the first one past the edge are as many as the two clocks' resolutions
 * are apart — unbounded, far from the origin or at a slow rate — which is
 * why it is a search and not the ulp walk a sum on one clock takes. A value
 * moving at the mapped time changes at the host time itself.
 *
 * A stagger — a Group's children pulsing in sequence, a light walking down
 * a Table's rows — is the same map once per child: `stagger` runs each
 * child's animation on a timeline playing from its index times the delay,
 * and the group changes when the soonest child does, each child's answer
 * carried onto the group's clock by `run`. Before its turn a child is asked
 * for a time before 0, which is its own business: a loop is shifted in
 * phase. Tree, Table, Group and Layout take the children's frames as they
 * take any renderables, through `Animation.map`, so none of them knows a
 * stagger exists. [LAW:composability] A lifecycle is not staggered here: it
 * carries its turn as `entered`, on the host's clock its `leave` and `gone`
 * take, so moving it onto a shifted clock would lose them
 * ([LAW:one-source-of-truth] for when it arrives).
 *
 * [LAW:no-ambient-temporal-coupling] Nothing here reads a clock. The host
 * time is an argument everywhere, and a timeline is built from one the host
 * hands in, so the same host time maps to the same animation time at one
 * sample a second or sixty.
 */

import { Animation } from "./animation.js";
import { firstReaching } from "./easing.js";

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

/** [LAW:single-enforcer] A host time is a finite number of seconds, refused once, at every operation that takes one. */
const hostTime = (host: number): number => finiteSeconds("Timeline host time", host);

/**
 * [LAW:parse-dont-validate] A rate is a finite number other than zero,
 * settled where it is given: a rate of zero would be a second way to hold a
 * timeline still, and `pause` is the one.
 */
function playbackRate(rate: number): number {
  if (!Number.isFinite(rate) || rate === 0) throw new RangeError(`Timeline rate must be finite and not zero, got ${rate}`);
  return rate;
}

/** `timeline` with `time` at host time `host`, at `rate`, held as it was. A paused timeline keeps no origin, and refuses a host time it cannot use all the same. */
function anchored(timeline: Timeline, host: number, time: number, rate: number): Timeline {
  const origin = hostTime(host);
  return timeline.playing ? { playing: true, origin, time, rate } : { playing: false, time, rate };
}

/** `animation` asked at the time `playing` maps each host time to, saying on host time when it changes. */
function played<T>(animation: Animation<T>, { origin, time, rate }: Timeline & { playing: true }): Animation<T> {
  const mapped = (host: number): number => time + rate * (host - origin);
  const forward = rate > 0;
  // Forwards, the host next sees the animation's own next change, and the
  // value began when the animation says it did; backwards, it next sees a
  // change where the value began, and the value began where the animation
  // says it ends. A hold is `[lastChange, nextChange)`, so the far side of
  // an edge is at it going up and strictly under it coming down.
  const ahead = forward ? (t: number) => animation.nextChange(t) : (t: number) => animation.lastChange(t);
  const behind = forward ? (t: number) => animation.lastChange(t) : (t: number) => animation.nextChange(t);
  const past = forward ? (t: number, edge: number) => t >= edge : (t: number, edge: number) => t < edge;
  // The first host moment the map carries past `edge`, an animation time.
  // An edge at infinity, or one so far off at this rate that no host float
  // reaches it, is never reached, forwards or backwards: the sum's own sign
  // says which, as a host moment past either end of the host's clock.
  const hostOf = (edge: number): number => {
    const sum = origin + (edge - time) / rate;
    return Number.isFinite(sum) ? firstReaching(sum, (host) => past(mapped(host), edge)) : sum;
  };
  return {
    at: (host) => animation.at(mapped(hostTime(host))),
    nextChange(host) {
      const h = hostTime(host);
      const t = mapped(h);
      const edge = ahead(t);
      return edge === t ? h : Math.max(h, hostOf(edge));
    },
    lastChange(host) {
      const h = hostTime(host);
      const t = mapped(h);
      const edge = behind(t);
      return edge === t ? h : Math.min(h, hostOf(edge));
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
    const h = hostTime(host);
    return timeline.playing ? timeline.time + timeline.rate * (h - timeline.origin) : timeline.time;
  },

  /** `timeline` held at the animation time it maps `host` to. Pausing a paused timeline holds the same time. */
  pause(timeline: Timeline, host: number): Timeline {
    return { playing: false, time: Timeline.at(timeline, host), rate: timeline.rate };
  },

  /** `timeline` playing from `host` at the animation time it maps `host` to, at its rate. Resuming a playing timeline is the same map. */
  resume(timeline: Timeline, host: number): Timeline {
    return { playing: true, origin: hostTime(host), time: Timeline.at(timeline, host), rate: timeline.rate };
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
   * began. Paused, the value never changes and never did. The value is the
   * animation's own, on no clock: what a drawn value's cells say about when
   * they change is stamped by whoever draws it at a host time
   * (`../renderables/frames.ts`, `frameAt`), never carried in from here.
   */
  run<T>(timeline: Timeline, animation: Animation<T>): Animation<T> {
    if (timeline.playing) return played(animation, timeline);
    return {
      at: (host) => animation.at(Timeline.at(timeline, host)),
      nextChange: (host) => (hostTime(host), Number.POSITIVE_INFINITY),
      lastChange: (host) => (hostTime(host), Number.NEGATIVE_INFINITY),
    };
  },

  /**
   * Every one of `animations` at once, each on a timeline playing from its
   * index times `delay` seconds after the earliest, their values in order, on
   * a clock of the stagger's own from 0. It changes when the soonest of them
   * does, on that clock (`Animation.all` of `run`s). A delay of 0 starts them
   * together and a negative one starts the last at 0 and the first last.
   */
  stagger<T>(animations: readonly Animation<T>[], delay: number): Animation<readonly T[]> {
    finiteSeconds("Timeline.stagger delay", delay);
    const span = finiteSeconds("Timeline.stagger delay times the last index", Math.max(0, animations.length - 1) * delay);
    // [LAW:dataflow-not-control-flow] Whichever way the cascade runs, every
    // origin is shifted by the lowest of them, so the earliest child plays from 0.
    const earliest = Math.min(0, span);
    return Animation.all(animations.map((animation, i) => Timeline.run(Timeline.play(i * delay - earliest), animation)));
  },
};
