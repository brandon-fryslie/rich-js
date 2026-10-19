# Animation

Anything in rich-js that changes with time is an `Animation`: a value for a time `t` in seconds, and the first moment that value may change. A beat, a sequence of [frames](/frames), a spinner and an [effect](/effects) are all one, and every other kind of motion is built from the same few pieces, so a host can hold a list of them and ask each the same two questions.

```typescript shape
interface Animation<T> {
  at(t: number): T;
  nextChange(t: number): number;
}
```

Nothing here reads a clock. `t` is handed in by whoever draws, so the same `t` gives the same value at one redraw a second or sixty, nothing is kept from one call to the next, and a call costs the same a second in as a million seconds in.

## When it next changes

`nextChange(t)` is never before `t`, and its answer is one of three things:

- a later time: the value is held until then;
- `Infinity`: it never changes again;
- `t` itself: it is moving at `t`, so it changes every frame however close together they are drawn.

An answer may be early — a host then draws a frame that looks like the last one — but never late, since a late answer skips a change. So an animation that cannot say when it holds still answers `t`.

## Building one

Four pieces build every animation, and each says how `nextChange` composes, so an animation built from them answers it without its author doing anything:

- `Animation.constant(value)` is `value` at every time, and never changes.
- `Animation.continuous((t) => value)` is the function's value, moving at every moment.
- `Animation.map(animation, f)` is the value through `f`, changing when the source does.
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

- A `Beat` (`beat([…])`, from the [easing vocabulary](/easing)) is an animation of which hold is in progress: `at(t)` is its index, `nextChange(t)` when the hold ends.
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

## How a host knows when to draw again

An animation whose value is drawn as cells carries its answer on every cell it draws: the cell's `Style` is stamped with `nextChange`, the stamp rides up through any container as an anchor does and writes no byte, and whoever holds the composed frame reads the soonest with `Segment.nextChange`. That is how a [`Live`](/live#auto-refresh) knows when to wake without asking each piece of its view what it holds — [Frames](/frames#when-the-frame-next-changes) shows it at work.

An animation of a value that is never drawn as cells — a number, a colour — has no cell to carry a stamp, so its `nextChange` is the only way it says when to look again.
