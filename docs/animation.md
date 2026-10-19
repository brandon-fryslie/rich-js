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
- An `Effect` is, for what an element draws in a frame, an animation of what is done to its cells: `effect(drawn)` is an `Animation` whose value at `t` maps each cell's look — its colours and its attributes — to a new one ([Effects](/effects)). A blink is one: `blink({ attribute: "bold", off: 0.7, on: 0.3 })` is a beat mapped to a frame that sets bold in its second hold and leaves every cell as drawn in its first ([Effects](/effects#an-attribute-on-a-beat)).

Because a beat is an animation, a signal that steps through colours is that beat mapped to colours:

```typescript
import { Animation, beat } from "@promptctl/rich-js";

const signal = Animation.map(beat([1, 1, 1]), (i) => ["red", "yellow", "green"][i]!);

for (const t of [0, 0.5, 1, 2.9, 3]) {
  console.print(`t=${t}s  [${signal.at(t)}]${signal.at(t)}[/] until ${signal.nextChange(t)}s`);
}
```

## A tween: a value moving to its target

`tween(from, to, timing)` is a number eased from `from` to `to` over `timing` — an ease and its seconds, the pair `spring()` returns and an effect's `Curve` carries — and held at `to` from then on. It is what a progress bar's fill, a counter or a width is handed so it moves to its new value instead of jumping, and it is the first animation here of a value that is never drawn as cells, so its `nextChange` is its only way of saying when to look again: until `0` before it begins, every frame while it moves, never once it has arrived. It begins at `0` on its own clock; starting it later is `Animation.sequence`'s job, or a timeline's.

A tween lands on its target exactly, whatever the ease, and an ease that overshoots is shown as it is — a count eased by `back-out` passes its value and comes back. A tween shorter than the gap between a host's frames is simply seen at its end, never mid-way, which is correct at one frame a second and at sixty:

```typescript
import { EASES, spring, tween } from "@promptctl/rich-js";

const fill = tween(0, 100, { seconds: 2, ease: EASES["ease-out"] });
const settle = spring({ stiffness: 300, damping: 20 });
const count = tween(0, 50, settle);

for (const t of [0, 0.5, 1, 2, 3]) {
  const next = fill.nextChange(t);
  console.print(`t=${t}s  fill ${fill.at(t).toFixed(1).padStart(5)}%  count ${count.at(t).toFixed(1).padStart(5)}  fill next change ${next === t ? "every frame" : next === Infinity ? "never" : `at ${next}s`}`);
}
console.print(`the spring settles on 50 at ${settle.seconds.toFixed(2)}s: ${count.at(settle.seconds)}`);
```

A tween keeps nothing from one call to the next, so retargeting it is not a change to it. A tween whose target moves at `t₁` is the old tween until `t₁`, then a new one built from the old one's value there, which is why it starts from where it is and not from its original `from`:

```typescript
import { Animation, EASES, tween } from "@promptctl/rich-js";

const timing = { seconds: 2, ease: EASES.linear };
const first = tween(0, 100, timing);
const retargetedAt = 1;
const fill = Animation.sequence(first, retargetedAt, tween(first.at(retargetedAt), 20, timing));

for (const t of [0.5, 1, 2, 3]) console.print(`t=${t}s  ${fill.at(t)}`);
```

Over colours, a tween is a [`ColorRamp`](/easing#in-a-color-ramp) read over time: `ramp.over(seconds)` crosses the ramp's span of positions at a steady rate in `seconds` and holds at its last stop, each colour along the way the ramp's own. A colour tween is a two-stop ramp over its seconds, the ramp's ease shaping the move, and a ramp of more stops over time is a sweep through all of them — the blending stays the ramp's, in OKLCH, and nothing here blends a second time:

```typescript
import { ColorRamp, ColorRgba, EASES } from "@promptctl/rich-js";

const fade = new ColorRamp(EASES["ease-in-out"], [
  { at: 0, color: new ColorRgba(220, 38, 38) },
  { at: 1, color: new ColorRgba(22, 163, 74) },
]).over(2);

for (const t of [0, 0.5, 1, 1.5, 2]) {
  const hex = fade.at(t).hex;
  console.print(`t=${t}s  [on ${hex}]      [/] ${hex}  next change ${fade.nextChange(t) === t ? "every frame" : "never"}`);
}
```

## A ramp that moves

A `ColorRamp` carries how far it has been moved: `scroll`, in spans, how far its colours have travelled along it from the first stop to the last, and `hue`, in turns, how far every colour is rotated round the OKLCH hue circle at its own lightness and chroma. Both are constructor arguments after the stops, and both default to 0. A scrolled ramp reads, inside its span, the colour that far behind, wrapped round as a repeating gradient. It has no seam when its first and last stops are one colour. Outside its span its end colours hold. Unmoved, every read is the ramp's own, stop colours byte for byte.

`ramp.moving({ scroll, hue })` is that ramp as an `Animation<ColorRamp>`: at each `t`, moved by both parts at `t`, on top of however far it was already moved. Each part is an `Animation<number>`, or 0 when not given. Both are fractions, so a phase plugs straight in. `Animation.continuous(Phase.loop(4))` scrolls the whole span every four seconds, and a `tween` to a quarter turn rotates the hues and settles. When the moving ramp next changes is the combinators' answer: every frame while a loop runs, and never again once every part has settled.

```typescript
import { Animation, ColorRamp, ColorRgba, EASES, Phase, tween } from "@promptctl/rich-js";

const hues = new ColorRamp(EASES.linear, [
  { at: 0, color: new ColorRgba(255, 120, 100) },
  { at: 0.5, color: new ColorRgba(110, 190, 255) },
  { at: 1, color: new ColorRgba(255, 120, 100) },
]);
const moving = hues.moving({ scroll: Animation.continuous(Phase.loop(4)), hue: tween(0, 0.25, { seconds: 2, ease: EASES["ease-out"] }) });

for (const t of [0, 1, 2, 3]) {
  const ramp = moving.at(t);
  const swatches = [0, 0.25, 0.5, 0.75].map((v) => `[on ${ramp.at(v).hex}]    [/]`).join("");
  console.print(`t=${t}s  ${swatches}  scroll ${ramp.scroll.toFixed(2)}  hue ${ramp.hue.toFixed(2)}  next change ${moving.nextChange(t) === t ? "every frame" : "never"}`);
}
```

Anything that reads a ramp reads a moved one, since it is still a `ColorRamp`. Laid across what an element draws, it is the [`gradient` effect](/effects#a-ramp-across-an-element): a rule's line or a panel's border that flows and turns. A gradient holds still on a sixteen-colour terminal, where a move would be a jump between slots. That is decided where the gradient is drawn, from the depth the output is written at.

## A glyph effect: text typed, scrambled and rained on

An [effect](/effects) moves the colours of what an element draws. A `GlyphEffect` changes the glyphs instead, and it has the same shape. Handed every cell the element draws in a frame, it gives an `Animation` whose value at `t` maps each cell to the text it shows. Colour and glyph are not two kinds of animation: both are a per-cell map that changes with time. `GlyphEffected` wraps any renderable and draws it through a glyph effect at one moment:

```typescript
import { EASES, GlyphEffected, RichText, typewriter } from "@promptctl/rich-js";

const typing = typewriter({ seconds: 2, ease: EASES.linear });
const line = new RichText("typed one cell at a time");

for (const t of [0, 0.5, 1, 1.5, 2]) {
  console.print(new GlyphEffected(line, typing.effect, { t, key: "line" }));
}
console.print(`done at 2s: ${typing.done(2)}`);
```

A glyph effect changes what a cell shows, never which cells exist, where they are or who drew them. The text it returns for a cell must be exactly as wide as the glyph it replaces, hold no line break or control character, and not join the cell beside it into one character, as a trailing zero-width joiner would. Otherwise the render throws and names the cell or the line. So nothing beside the element ever moves, and a wide glyph like `漢` is blanked as two spaces or scrambled as two narrow glyphs, never cut in half. A cell that comes back unchanged is drawn byte for byte as it was, and a changed cell keeps its link and its owner. Glyphs are written at every colour depth, so a glyph effect moves even with no colour output, where a colour effect does nothing.

The catalogue, `GLYPH_EFFECT_CATALOGUE`, has two transitions, which run once and say when they are `done`, and three loops:

- `typewriter(timing)`: the element's text blank until it is typed, in reading order, the last cell at `timing.seconds`, its ease setting the pace. The spaces between words are typed; the padding round the text is not, so no time is spent on it.
- `scramble(timing, z)`: random glyphs, a new one each fifteenth of a second, resolving to the words in reading order. Blanks stay blank, so the words keep their shape.
- `caseWave({ step, width }, z)`: a band of swapped case crossing the element one column a `step`.
- `particles(spec, z)`: particles on the element's blank cells, never over its words. `rain` falls a row a step, and `stars` are drawn afresh each life. Both are values of the one `particles` function, and their specs are in `GLYPH_DEFAULTS`. Each spec names an ASCII set too, which is drawn instead on an output that draws ASCII alone.

A transition moves every frame until it is done, then never. A loop moves in steps, because a cell shows one glyph or another, and its `nextChange` is when its next step begins. A glyph effect and a colour effect compose by nesting: the outer wrapper is drawn over what the inner one drew, so here a wave of capitals crosses a line that is turning red:

```typescript
import { Animation, ColorRgba, DEFAULT_TERMINAL_THEME, Effected, GlyphEffected, RichText, caseWave, type Effect } from "@promptctl/rich-js";

const red = new ColorRgba(220, 38, 38);
const reddening: Effect = () => Animation.continuous((t) => (look) => ({ ...look, fg: t >= 1 ? red : look.fg }));
const wave = caseWave({ step: 0.25, width: 3 }, 0);

for (const t of [0.6, 1.1, 1.6]) {
  const glyphs = new GlyphEffected(new RichText("a wave of capitals"), wave, { t, key: "wave" });
  console.print(new Effected(glyphs, reddening, { t, key: "wave", theme: DEFAULT_TERMINAL_THEME }));
}
```

To watch every one move, run `npm run glyph-effects` in a checkout of this repository.

## A transition from one renderable to another

A fade-in or a dissolve is one element arriving or leaving. When the same slot changes from one renderable to another — a status going from "building" to "done", a number becoming a different number — `crossfade(curve)` and `wipe(curve)` draw the change instead of a cut. Each is a `Transition` like the others, so it says when it is `done`, and its value is a `Change`: handed the renderable drawn until now, the one drawn from now on and the terminal they are drawn on, it gives an `Animation` of what to draw, from `t = 0` on its own clock.

Every cell goes through the terminal's ground on its way. Until it is halfway it shows the old renderable, fading out, and from then the new one, fading in, so no cell jumps from one glyph to another. A crossfade turns every cell together. A wipe sends a front across the columns from left to right, with the new renderable behind it and a soft edge six columns wide, or as many as its second argument says.

The change is drawn at the new renderable's size from its first frame. The old one is cut or padded to the new one's rows, so what sits beside it moves once, at the cut, and never while the change runs. It moves every frame until it is done, then it is the new renderable itself, byte for byte, and never changes again. A change shorter than the gap between frames is seen at its end:

```typescript
import { DEFAULT_TERMINAL_THEME, EASES, RichText, wipe } from "@promptctl/rich-js";

const change = wipe({ seconds: 2, ease: EASES.linear, swing: 1 });
const moving = change.effect({
  from: new RichText("building the project", { style: "yellow" }),
  to: new RichText("done: 1,204 tests passed", { style: "green" }),
  theme: DEFAULT_TERMINAL_THEME,
});

for (const t of [0, 0.5, 1, 1.5, 2]) {
  console.print(moving.at(t));
}
console.print(`done at 2s: ${change.done(2)}, next change ${moving.nextChange(2)}`);
```

To watch both run, run `npm run transitions` in a checkout of this repository.

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

## Playing in a Live or an App

A [`Live`](/live#a-view-drawn-for-a-time) and an [`App`](/app#animating-at-a-frame-rate) each hold a timeline, playing from 0 when the host is made, at the clock's pace, unless the `timeline` option gives another. Each frame, the host reads its clock once, draws its view for the time the timeline maps that moment to, and carries what the frame says about when it changes back onto the clock through `Timeline.run`. So pausing, reversing, scrubbing and speeding up what a host shows means replacing `host.timeline`, and `host.clock` is where the host time those operations take is read. Replacing it draws one frame for the new time. A paused timeline then holds that frame: the host waits on nothing for an animation until the timeline plays again, though `refresh()` still draws. A function view may also read state, so a `Live` still polls it at its rate, drawn at the held time. A renderable view is never handed a time, so it is off the timeline: what its cells say is on the host's clock, and pausing holds none of it. A renderable that reads a clock of its own, such as a `Progress`, belongs there and not inside a function view, whose cells are read on the timeline's clock.

The view can be an `Animation` of a renderable as well as a renderable or a function of the time. That is how a value that is never drawn as cells tells the host when to look again: a tween mapped to the bar that shows it moves every frame until it arrives, then never again, and the host draws exactly that long. An `App` needs no `animate()` for it, and a held sequence wakes the host once, at its switch. Here a `Live` on a paused timeline is sought to a moment and drawn there. Its console is not interactive, so it writes the frame once, at `stop()`, and the recording is printed below:

```typescript
import { Animation, Console, EASES, Live, RichText, Timeline, tween } from "@promptctl/rich-js";

const width = tween(0, 20, { ease: EASES.linear, seconds: 2 });
const bar = Animation.map(width, (w) => new RichText(`${"█".repeat(Math.round(w)).padEnd(20, "·")} ${w.toFixed(1)}`));

const recording = new Console({ forceInteractive: false, record: true, width: 40, file: { write: () => {} } });
const live = new Live(bar, { console: recording, timeline: Timeline.pause(Timeline.play(0), 0) });
live.start();
live.timeline = Timeline.seek(live.timeline, live.clock.now(), 1.5);
live.stop();
console.print(recording.exportText());
```

## How a host knows when to draw again

Whoever draws an animation's value as cells at a host time stamps every cell it draws with the animation's `nextChange` at that time: the stamp is on the cell's `Style`, rides up through any container as an anchor does and writes no byte, and whoever holds the composed frame reads the soonest with `Segment.nextChange`. The animation's `at` hands over the value alone, so a value a timeline asked for at a mapped time is stamped on the host's clock, not the timeline's. That is how a [`Live`](/live#auto-refresh) knows when to wake without asking each piece of its view what it holds — [Frames](/frames#when-the-frame-next-changes) shows it at work.

An animation of a value that is never drawn as cells — a number, a colour — has no cell to carry a stamp, so its `nextChange` is the only way it says when to look again.
