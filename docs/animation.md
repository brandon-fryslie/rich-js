# Animation

Anything in rich-js that changes with time is an `Animation`: a value for a time `t` in seconds, the first moment that value may change, the last moment it may have become what it is, and the same animation with its motion taken out. A beat, a sequence of [frames](/frames), a spinner and an [effect](/effects) are all one, and every other kind of motion is built from the same few pieces, so a host can hold a list of them and ask each the same questions.

```typescript shape
interface Animation<T> {
  at(t: number): T;
  nextChange(t: number): number;
  lastChange(t: number): number;
  reduced(): Animation<T>;
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

Each says its [reduced](#reduced-motion) form the same way: a constant is itself, a continuous animation holds its value at 0, as a loop holds its first, a mapped one is its source reduced through `f`, several at once are each reduced, and a sequence is each part reduced with the switch kept. A one-shot, such as a tween or a transition, cuts to its end when it starts.

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

A [`Progress`](/progress#easing-the-bar) given a `fill` timing eases each bar this way: every update retargets the bar's tween from where it is at that moment, on the `Progress` clock.

A template has a tween too, `tween`, and a colour tween is a ramp read at it ([Animating a template](/template-bindings#animating-a-template)).

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

The catalogue, `GLYPH_EFFECT_CATALOGUE`, has four transitions, which run once and say when they are `done` — two that bring text in and their two ways out, for an element [leaving](#enter-and-exit-an-element-arriving-staying-and-leaving) — and three loops:

- `typewriter(timing)`: the element's text blank until it is typed, in reading order, the last cell at `timing.seconds`, its ease setting the pace. The spaces between words are typed; the padding round the text is not, so no time is spent on it.
- `scramble(timing, z)`: random glyphs, a new one each fifteenth of a second, resolving to the words in reading order. Blanks stay blank, so the words keep their shape.
- `backspace(timing)` and `scrambleOut(timing, z)`: the two ways out — the text erased from its last cell to its first, or each cell churning in reading order before it blanks — whole at 0 and blank at `timing.seconds`.
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

## Enter and exit: an element arriving, staying and leaving

A row added to a table, a line appended to a log, a panel closing: each is one element that arrives, stays, and leaves, and whoever holds it must know when it is gone so it can drop it. `lifecycle(element, { enter, exit, key }, entered)` is that element on the host's clock, as an `Animation` of what it draws. `enter` and `exit` are its two halves, each a transition made for this element alone and bound to what draws it: `throughColors(transition, theme)` for a colour one, drawn on the terminal whose ground it arrives from and leaves to, and `throughGlyphs(transition)` for a [glyph](#a-glyph-effect-text-typed-scrambled-and-rained-on) one, which needs no theme and is written with no colour output too. An arrival starts from nothing — `fadeIn`, `typewriter`, `scramble` — and an exit ends at nothing — `dissolveOut`, `backspace`, `scrambleOut` — so the element is already out of sight when it is dropped. The two kinds mix, so a line can type itself in and dissolve out. `key` names the element for both halves' seeds. `entered` is the host time it arrived. `lifecycle.leave(at)` is the same element told to leave at host time `at`, a new value like a timeline operation's. Until it is told, its `left` is `Infinity`.

Both times are handed in, never read, so a host that says "leave at 5" and asks for the frame at 6 gets the element one second into leaving. At host time `t` it draws:

- before `entered`, nothing — a timeline run backwards asks for those times;
- arriving, the element through `enter`, handed the time since it entered;
- staying, the element itself, byte for byte, until it is told to leave;
- leaving, through `exit`, handed the time since it was told, over whatever arriving would draw then, so an element told to leave before it has arrived leaves from where it is;
- once `exit` is done, nothing, for good: `gone(t)` is true, and the host drops it.

While it arrives or leaves it changes when its transition does — every frame for a fade, once a hold for one on a beat (`onBeat(fadeIn(curve, 0), beat([0.25]))` arrives a quarter of a second at a time, and a host wakes on those quarters) — and it holds still while it stays and once it is gone, so a host still holding a gone element wakes for nothing. A transition says when its frame changes whatever the element draws, so this holds even with no colour output, where a colour half writes nothing. Drawn inside a function view, the frame says so through `frameAt(shown, t)`:

```typescript
import { DEFAULT_TERMINAL_THEME, EASES, RichText, dissolveOut, lifecycle, throughColors, throughGlyphs, typewriter } from "@promptctl/rich-js";

const typing = { seconds: 1, ease: EASES.linear };
const line = new RichText("compiling 214 modules", { style: "bold cyan" });
const halves = { enter: throughGlyphs(typewriter(typing)), exit: throughColors(dissolveOut({ ...typing, swing: 1 }, 0), DEFAULT_TERMINAL_THEME), key: "line" };
const shown = lifecycle(line, halves, 0).leave(3);

for (const t of [0, 0.5, 1, 2, 3.5, 4]) {
  const next = shown.nextChange(t);
  console.print(shown.at(t));
  console.print(`t=${t}s  gone ${shown.gone(t)}  next change ${next === t ? "every frame" : next === Infinity ? "never" : `at ${next}s`}`);
}
```

A list whose items come and go is the lifecycles it holds, each dropped once it is gone. Laid out together, as `Animation.all(items)` mapped to a `Group`, the list says when it changes as the soonest of its items does. To watch a log whose lines arrive and leave, run `npm run lifecycle` in a checkout of this repository.

## Scroll, marquee and slide

A long line panning across a fixed width, a log tail stepping down, a panel sliding into place: each is a window over content wider or taller than its slot, with the content's offset in the slot moving with time. `scroll(content, { width, height, col, row })` is that window as an `Animation` of what it draws. `col` is how many cells of the content sit left of the slot, and `row` how many rows sit above it. Each is an `Animation<number>`, 0 when not given, and is rounded to the nearest cell. A marquee, a scroll and a slide are the same window with a different offset handed in: a looping phase across a span, a beat, or a tween to 0.

The window is its slot. It measures as its width and draws exactly its rows of its width at every offset, cropped only to a narrower room it is given, so nothing beside it moves. An offset before or past the content shows blank cells instead of stopping at an edge, which is how a marquee enters from the right and a slide-in arrives from outside the slot. The content is drawn at its own natural width and length. Content that should wrap to the slot instead goes in a `Constrain` of the slot's width, and so does content with no natural width of its own, such as a `Rule`, which fills whatever it is given; the scroll refuses that content by name rather than draw it at an unbounded width. An offset that is not a finite number is refused the same way. A wide glyph cut by an edge is blanked, never halved, and each cell keeps its anchor in the content, so hit-testing finds its owner through a moving window. When it next changes is when either offset does: every frame while a marquee runs, on each beat of a stepped scroll, and never once a slide-in has arrived. A frame it draws also carries the soonest change of anything in its content, shown or not, because an element entering above the slot moves every row in it.

```typescript
import { Animation, EASES, Phase, RichText, cellLen, scroll, tween } from "@promptctl/rich-js";

const news = "every motion is one Animation ·";
const marquee = scroll(new RichText(news, { style: "bold yellow" }), {
  width: 16,
  height: 1,
  col: Animation.continuous((t) => ((Phase.loop(4)(t) * (cellLen(news) + 16) + 16) % (cellLen(news) + 16)) - 16),
});
const slide = scroll(new RichText("arrived", { style: "green" }), { width: 16, height: 1, col: tween(-16, 0, { seconds: 1, ease: EASES["ease-out"] }) });

for (const t of [0, 0.5, 1, 2, 3]) {
  console.print(marquee.at(t));
  console.print(slide.at(t));
  console.print(`t=${t}s  slide next change ${slide.nextChange(t) === t ? "every frame" : "never"}`);
}
```

Drawn inside a function view, a scroll's frame says when it changes through `frameAt(animation, t)`, which stamps its cells with the animation's `nextChange` at the host's time. To watch a marquee, a log tail and a slide-in, run `npm run scroll` in a checkout of this repository.

## Playback: a timeline

Because every animation is a pure function of its time, pausing, reversing, scrubbing and speeding one up are not things done to the animation: they are a change in which time it is asked for. A `Timeline` is that map from the host's clock to animation time, as a value — an animation time at a host time and a rate in animation seconds per host second, or, paused, one animation time at every host time. Every operation takes a timeline and a host time and gives a timeline back, so a paused timeline resumed later maps the moment it resumes to the time it froze at, and nothing here reads a clock.

- `Timeline.play(origin, rate = 1)` plays from host time `origin`, at which the animation is at `0`; a negative rate runs it backwards.
- `Timeline.pause(timeline, host)` holds it at the animation time it maps `host` to; `Timeline.resume(timeline, host)` plays on from there.
- `Timeline.seek(timeline, host, time)` puts the animation at `time` at host time `host`, playing or held as it was.
- `Timeline.withRate(timeline, host, rate)` changes the rate from `host` on, with no jump.
- `Timeline.at(timeline, host)` is the animation time at a host time.
- `Timeline.stagger(animations, delay)` runs each animation on a timeline offset by its index times `delay` ([below](#a-stagger-one-animation-across-children)).

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

The template functions draw on a timeline the host hands in the same way, so pausing a template's animations is one value too ([Animating a template](/template-bindings#pausing-reversing-and-reduced-motion)).

A `Spinner`'s `speed` is a timeline its frames run on, so a spinner drawn backwards at twice the speed with `drawnAt(t)` still says, on its cells, when it turns next on the host's clock.

## A stagger: one animation across children

Most motion looks right in cascade: a group's children pulsing in sequence, a light walking down a list. `Timeline.stagger(animations, delay)` is every one of `animations` at once, each on a timeline playing from its index times `delay` seconds after the earliest, their values in order. It is `Animation.all` of `Timeline.run`s, so it changes when the soonest child does, with each child's answer carried onto the stagger's clock, and it holds still in a gap between one child settling and the next one starting. The stagger runs on its own clock from 0, and its earliest child starts there: a delay of 0 starts them together, and a negative one starts the last child at 0 and the first last.

Before its turn, a child is asked for a time before 0. What that shows is the child's own business, and a loop is shifted in phase, which is what a staggered pulse is. Playing, pausing or reversing the whole group is one more timeline run over it.

A [lifecycle](#enter-and-exit-an-element-arriving-staying-and-leaving) is staggered by its own `entered` instead: rows arriving one after another are `Animation.all` of lifecycles entered at each row's index times the delay. Its `leave` and `gone` take the host's clock, so it has to stay on that clock, not move onto one shifted by its index. A row that has not arrived yet, or is gone, draws nothing, and a [`Tree`](/tree#labels) ends its branch at the last child that does draw.

No container knows that a stagger exists. A `Group`, a `Table`'s rows, a `Tree`'s children and a `Layout`'s panes take the children's frames the way they take any renderables, through `Animation.map`, and the frame drawn with `frameAt` says when it changes as the stagger does:

```typescript
import { Animation, Group, RichText, Timeline, beat, frameAt } from "@promptctl/rich-js";

const steps = ["resolving dependencies", "compiling 214 modules", "bundling the browser build"];
// Lit for half a second, dim for a second, looping: half a second apart, the light walks down the list.
const lit = steps.map((step) => Animation.map(beat([0.5, 1]), (hold) => new RichText(step, { style: hold === 0 ? "bold cyan" : "dim" })));
const log = Animation.map(Timeline.stagger(lit, 0.5), (frames) => new Group(...frames));

for (const t of [0.2, 0.7, 1.2]) {
  const next = log.nextChange(t);
  console.print(frameAt(log, t));
  console.print(`t=${t}s  next change at ${next}s`);
}
```

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

## Reduced motion

Terminals have no `prefers-reduced-motion`, so the program hands the reader's preference in, once: `reducedMotion: true` on a [`Console`](/console), which a `Live` draws through, or on an `App`, and as `animationFuncs(frameTime, { reducedMotion: true })` for the [template functions](/template-bindings). Nothing reads it from the environment; a program that wants an environment variable to decide reads it itself.

Under it every animation is drawn as its `reduced()` form: what it shows, and when it starts and stops showing it, are kept, and every moment of motion between is skipped. A loop holds its value at 0, so a loop that should rest on something starts there; a glyph loop draws the text as written. A one-shot cuts from its start to its end the moment it starts (`Animation.cut(before, after)`), a [transition](#a-transition-from-one-renderable-to-another) to its new state, a [stagger](#a-stagger-one-animation-across-children) has every child arrived, and an [element](#enter-and-exit-an-element-arriving-staying-and-leaving) is there from when it entered until it is told to leave, with no fade either way. A [timeline](#playback-a-timeline) still maps the time, so what shows follows it. A host wakes only when content changes: never for a spinner or a fade, once each for an element arriving and leaving. Text styled `blink` or `blink2` is written without it, because the terminal would blink it on its own. That holds for every output the preference reaches: a print, a `Live` or `App` frame, `renderToString`, and a recording console's exports.

A view that is an animation is drawn reduced. A function view is still asked for its frame at the time, so what the program computes from it — a log it appends to, an elapsed time — stays on time, and everything it builds for the time — an `Effected`, a `GlyphEffected`, a `Frames`, a spinner's `drawnAt`, `frameAt` of any renderable — is reduced where it is drawn. `Animation.continuous` says its value is motion, so a clock or a counter computed from `t` belongs in a function view, where it stays on time. What the function samples itself is its own and still moves: `tween.at(t)`, or a text frame spliced into a line with `frameAt`. To have those reduced too, draw the text with a `Frames`, or hand the host the animation, mapped to what shows it.

Here the same spinner and typewriter are drawn at three moments, with motion and reduced:

```typescript
import { Console, EASES, GlyphEffected, RichText, Spinner, Table, typewriter } from "@promptctl/rich-js";

const typing = typewriter({ seconds: 2, ease: EASES.linear });
const spinner = new Spinner("dots", "building");
const at = (reducedMotion: boolean, t: number): string => {
  const drawn = new Console({ reducedMotion, record: true, width: 30, colorSystem: null, file: { write: () => {} } });
  drawn.print(spinner.drawnAt(t));
  drawn.print(new GlyphEffected(new RichText("hello, world"), typing.effect, { t, key: "greeting" }));
  return drawn.exportText().trimEnd();
};

const table = new Table({ showHeader: true });
table.addColumn("t");
table.addColumn("moving");
table.addColumn("reduced motion");
for (const t of [0.2, 0.9, 1.6]) table.addRow(`${t}s`, at(false, t), at(true, t));
console.print(table);
```

## How a host knows when to draw again

Whoever draws an animation's value as cells at a host time stamps every cell it draws with the animation's `nextChange` at that time: the stamp is on the cell's `Style`, rides up through any container as an anchor does and writes no byte, and whoever holds the composed frame reads the soonest with `Segment.nextChange`. That is how a [`Live`](/live#auto-refresh) knows when to wake without asking each piece of its view what it holds — [Frames](/frames#when-the-frame-next-changes) shows it at work.

Only a renderable built for the time the host draws at stamps: `frameAt(animation, t)`, a `Frames`, a spinner's `drawnAt`, the template [`frames` function](/template-bindings), and an [`Effected`](/effects) or a `GlyphEffected`, each choosing its frame where it is drawn, so under [reduced motion](#reduced-motion) it draws its animation reduced and stamps only where content changes. An effect's answer is made from what the element draws, so a loop that holds still at the output's depth says it never changes there. Nothing an animation's `at` returns carries a stamp of its own — not a scroll's frame, a change's, a lifecycle's or a spinner's — because the time it is asked for may be one a timeline, a sequence or a lifecycle mapped from the host's, and a stamp made there would be a moment on a clock the host cannot read. What the frame does over time is the animation's `nextChange`, which every one of those maps carries back, so a change under a paused timeline says it never changes, and a lifecycle arriving on a beat wakes its host on the beats. A renderable that reads a clock of its own, a `Progress`, stamps the host's clock and belongs off the timeline.

A renderable that lives from one frame to the next, such as a [widget](/widgets), is not rebuilt for each frame's `t`. It reads the time instead from its render options: `frameTime` is the moment the frame is drawn for, on the clock its stamps are read on. That is the host's time for a renderable view and the timeline's for a view on it, so its stamps are right in either, and pausing holds it in a view on the timeline. A `print` passes no `frameTime`, and nothing drawn from it moves. A `TextInput`'s blinking cursor is one. Every event a `WidgetApp` hands a widget — a key, a click, a change of focus — carries the same `frameTime` as its `time`, so the field restarts its blink there without reading a clock.

An animation of a value that is never drawn as cells — a number, a colour — has no cell to carry a stamp, so its `nextChange` is the only way it says when to look again.
