# Animation

Anything in rich-js that changes with time is an `Animation`: a value for a time `t` in seconds, the first moment that value may change, and the last moment it may have become what it is. A beat, a sequence of [frames](/frames), a spinner and an [effect](/effects) are all one, and every other kind of motion is built from the same few pieces, so a host can hold a list of them and ask each the same questions.

```typescript shape
interface Animation<T> {
  at(t: number): T;
  nextChange(t: number): number;
  lastChange(t: number): number;
}
```

Nothing here reads a clock. `t` is handed in by whoever draws, so the same `t` gives the same value at one redraw a second or sixty, nothing is kept from one call to the next, and a call costs the same a second in as a million seconds in.

## When it next changes

`nextChange(t)` is never before `t`, and its answer is one of three things:

- a later time: the value is held until then;
- `Infinity`: it never changes again;
- `t` itself: it is moving at `t`, so it changes every frame however close together they are drawn.

An answer may be early — a host then draws a frame that looks like the last one — but never late, since a late answer skips a change. So an animation that cannot say when it holds still answers `t`.

`lastChange(t)` is the other end of the same hold: the last moment, never after `t`, at which the value may have become `at(t)` — `-Infinity` if it always was, `t` while it moves. Together the two bound the hold, `[lastChange(t), nextChange(t))`, and an answer may be narrower than the truth and never wider. It is what a host running the animation backwards reads: run down the timeline, the value next changes where it began.

## Building one

Five pieces build every animation, and each says how `nextChange` and `lastChange` compose, so an animation built from them answers them without its author doing anything:

- `Animation.constant(value)` is `value` at every time, and never changes.
- `Animation.continuous((t) => value)` is the function's value, moving at every moment.
- `Animation.map(animation, f)` is the value through `f`, changing when the source does.
- `Animation.all([a, b, …])` is every one's value at once, in order, changing when the soonest of them does — so several effects drawn as one hold still exactly while each of them does — and having become that when the latest of them did.
- `Animation.sequence(first, seconds, then)` is `first` until `seconds`, then `then`, handed the time since it began, so each part runs on its own clock from 0.

Here a light arrives, holds, and then blinks on a [beat](/easing):

```typescript
import { Animation, beat } from "@promptctl/rich-js";

const arriving = Animation.continuous((t) => `arriving ${Math.round(t * 100)}%`);
const blinking = Animation.map(beat([0.5, 0.5]), (i) => (i === 0 ? "on" : "off"));
const light = Animation.sequence(arriving, 1, Animation.sequence(Animation.constant("on"), 2, blinking));

for (const t of [0, 0.5, 1, 2.5, 3, 3.6]) {
  const next = light.nextChange(t);
  console.print(`t=${t}s  ${light.at(t).padEnd(13)} next change ${next === t ? "every frame" : next === Infinity ? "never" : `at ${next}s`}`);
}
```

## What is already an animation

- A `Beat` (`beat([…])`, from the [easing vocabulary](/easing)) is an animation of which hold is in progress: `at(t)` is its index, `lastChange(t)` when the hold began, `nextChange(t)` when it ends.
- A `FrameSequence` is an animation of the frame shown, and a `Spinner` of the spinner drawn ([Frames](/frames)).
- An `Effect` is, for what an element draws in a frame, an animation of what is done to its cells: `effect(drawn)` is an `Animation` whose value at `t` maps each cell's colours to new ones ([Effects](/effects)).

Because a beat is an animation, a signal that steps through colours is that beat mapped to colours:

```typescript
import { Animation, beat } from "@promptctl/rich-js";

const signal = Animation.map(beat([1, 1, 1]), (i) => ["red", "yellow", "green"][i]!);

for (const t of [0, 0.5, 1, 2.9, 3]) {
  console.print(`t=${t}s  [${signal.at(t)}]${signal.at(t)}[/] until ${signal.nextChange(t)}s`);
}
```

## Playback: a timeline

Because every animation is a pure function of its time, pausing, reversing, scrubbing and speeding one up are not things done to the animation: they are a change in which time it is asked for. A `Timeline` is that map from the host's clock to animation time, as a value — an animation time at a host time and a rate in animation seconds per host second, or, paused, one animation time at every host time. Every operation takes a timeline and a host time and gives a timeline back, so a paused timeline resumed later maps the moment it resumes to the time it froze at, and nothing here reads a clock.

- `Timeline.play(origin, rate = 1)` plays from host time `origin`, at which the animation is at `0`; a negative rate runs it backwards.
- `Timeline.pause(timeline, host)` holds it at the animation time it maps `host` to; `Timeline.resume(timeline, host)` plays on from there.
- `Timeline.seek(timeline, host, time)` puts the animation at `time` at host time `host`, playing or held as it was.
- `Timeline.withRate(timeline, host, rate)` changes the rate from `host` on, with no jump.
- `Timeline.at(timeline, host)` is the animation time at a host time.

`Timeline.run(timeline, animation)` is the animation on host time: its value at the mapped time, and its `nextChange` carried back onto the host's clock — forwards, the host moment the mapped time reaches the animation's own answer; backwards, the moment it drops under where the value began, which is what `lastChange` is for; paused, never. A host reads the answer in its own seconds whatever the rate:

```typescript
import { Animation, Timeline, beat } from "@promptctl/rich-js";

const signal = Animation.map(beat([1, 1, 1]), (i) => ["red", "yellow", "green"][i]!);
const say = (label: string, timeline: Timeline, host: number) => {
  const played = Timeline.run(timeline, signal);
  const next = played.nextChange(host);
  console.print(`${label.padEnd(22)} host ${host}s → ${Timeline.at(timeline, host)}s  [${played.at(host)}]${played.at(host)}[/]  next change ${next === Infinity ? "never" : `at host ${next}s`}`);
};

const playing = Timeline.play(10);
say("playing from 10", playing, 11.5);
say("at half speed", Timeline.withRate(playing, 11.5, 0.5), 12);
say("backwards", Timeline.withRate(playing, 11.5, -1), 12);
const paused = Timeline.pause(playing, 11.5);
say("paused at 11.5", paused, 100);
say("resumed at 100", Timeline.resume(paused, 100), 101);
say("sought to 2.5", Timeline.seek(playing, 11.5, 2.5), 11.5);
```

A `Spinner`'s `speed` is a timeline its frames run on, so a spinner drawn backwards at twice the speed still stamps its cells with when it turns next on the host's clock.

## How a host knows when to draw again

An animation whose value is drawn as cells carries its answer on every cell it draws: the cell's `Style` is stamped with `nextChange`, the stamp rides up through any container as an anchor does and writes no byte, and whoever holds the composed frame reads the soonest with `Segment.nextChange`. That is how a [`Live`](/live#auto-refresh) knows when to wake without asking each piece of its view what it holds — [Frames](/frames#when-the-frame-next-changes) shows it at work.

An animation of a value that is never drawn as cells — a number, a colour — has no cell to carry a stamp, so its `nextChange` is the only way it says when to look again.
