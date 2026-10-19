# Frames

Frames change *what* an element shows on a beat: a sequence of frames, each held for its own number of seconds and then replaced by the next, looping. An [effect](/effects) changes how an element's cells are coloured and may never change a glyph; frames are the other kind of motion, and the two compose by nesting.

Nothing here reads a clock. A `Frames` is drawn for a time `t` in seconds that its host hands in, so the same `t` always draws the same bytes, at one redraw a second or sixty.

The frames and the moment are two values. A `FrameSequence` is the frames prepared to draw, built once and kept; `new Frames(sequence, { t })` is that sequence at one moment, and finding which frame `t` lands on is all it does, so a frame costs the same over ninety frames as over one.

## A sequence of frames

Each frame is a `RichText`, free to carry its own style, and its hold in seconds. Ask the sequence for a moment and it hands back the frame in progress then, counted from the first frame at `t = 0` and wrapping every period:

```typescript
import { FrameSequence, RichText, Style } from "@promptctl/rich-js";

const chevrons = new FrameSequence(
  ["›", "››", "›››"].map((glyphs, i) => ({
    text: new RichText(glyphs, { style: Style.parse(["green", "yellow", "red"][i]!) }),
    seconds: 1,
  })),
);

for (const t of [0, 1.5, 2.2, 3]) {
  console.print(`t=${t}s  effort ${chevrons.at(t).plain} max`);
}
```

Every frame draws at one width, the widest frame's, padded on the right, so whatever sits beside the frames never moves as they turn; the sequence's `width` says what that is. A frame is a fragment of a line: it ends no line of its own, a newline inside one becomes a space, and it measures at exactly its width; a slot forced narrower crops it, and never folds or wraps it onto a second line.

A `FrameSequence` is an [animation](/animation) of the frame shown: `at(t)` is the frame in progress as a `RichText` of its own, a copy, for a line assembled from pieces, and `nextChange(t)` is when it gives way to the next. `Frames` is the renderable, so it can be printed or set in a table cell directly. The holds are the sequence's `beat`, whose `period` is their sum.

## Holds are seconds

A hold is a number of seconds, never a count of frames, so one sequence plays unchanged whatever the redraw rate. Redrawn sixty times a second, a one-second frame shows for exactly sixty frames. Redrawn once a second, as a status line is, the same sequence turns once a second: a frame held for less than a second is skipped, and a sequence whose period is a whole number of seconds shows one frame forever:

```typescript
import { FrameSequence, RichText } from "@promptctl/rich-js";

const quarters = new FrameSequence(["a", "b", "c", "d"].map((glyph) => ({ text: new RichText(glyph), seconds: 0.25 })));

const onceASecond = [0, 1, 2, 3].map((t) => quarters.at(t).plain);
const sixtyASecond = Array.from({ length: 60 }, (_, i) => quarters.at(i / 60).plain);

console.print(`once a second:  ${onceASecond.join(" ")}`);
console.print(`sixty a second: ${[...new Set(sixtyASecond)].join(" ")}`);
```

A sequence does not adapt to the rate: the rate belongs to whoever draws the frames, and so does the fix, which is holds that the host's rate can show. The [easing and phase vocabulary](/easing) is where the timing comes from, and the beat is part of it.

## When the frame next changes

What is drawn for a time says when it changes next. A frame drawn at `t` is drawn until the next frame begins, and its cells carry that moment: every cell of the frame is stamped with it on its `Style`, where it rides up through any container the frame sits in, as a cell's anchor does, and writes no byte. Whoever holds the composed frame reads the soonest off it with `Segment.nextChange`, so a host knows when to draw again without asking each container what it holds:

```typescript
import { FrameSequence, Frames, Panel, RichText, Segment } from "@promptctl/rich-js";

const quarters = new FrameSequence(["a", "b", "c", "d"].map((glyph) => ({ text: new RichText(glyph), seconds: 0.25 })));
const whole = new FrameSequence(["›", "››", "›››"].map((glyph) => ({ text: new RichText(glyph), seconds: 1 })));

for (const t of [0, 1, 2]) {
  const fast = Segment.nextChange(new Panel(new Frames(quarters, { t })).render({ maxWidth: 20 }));
  const slow = Segment.nextChange(new Panel(new Frames(whole, { t })).render({ maxWidth: 20 }));
  const still = Segment.nextChange(new Panel("effort").render({ maxWidth: 20 }));
  console.print(`t=${t}s  quarters change at ${fast}s, chevrons at ${slow}s, still text ${still === Infinity ? "never" : `at ${still}s`}`);
}
```

The stamp is the sequence's `nextChange(t)`, the answer every [animation](/animation) gives, and an [effect](/effects) stamps its frame the same way. Still content never changes, so it carries no stamp and the answer is `Infinity`. The stamp survives `at(t)` and whatever the frame is appended into, so a line assembled from fragments — a template's output among them — still says when it turns.

A host that draws once a second can read from the answers alone that it is skipping frames: at each `t` the quarters above change at `t + 0.25`, before its next draw at `t + 1`, while the chevrons change exactly at it. A host drawing sixty times a second sees the next change never come before its next frame. A [`Live`](/live#auto-refresh) reads the answer off every frame it draws and wakes then, so it draws each frame of a sequence rather than a sample of them.

## Spinners

A `Spinner` is an [animation](/animation) built on a `FrameSequence` over one of the named spinners — `dots`, `line`, `bouncingBall` and the rest of the cli-spinners set — each frame held for the spinner's interval, with an optional label after it. It is built once and asked for its frame at a time: `spinner.at(t)` is the renderable, the frame in progress at the time it is handed, as Rich's `Spinner.render(time)` is, and a spinner reads no clock. `speed` is a [timeline](/animation#playback-a-timeline) the frames run on from `t = 0`: `2` turns the spinner twice as fast, and a negative speed runs it backwards, and whichever way it turns, the cells it draws say when it turns next on the host's clock.

```typescript
import { Group, Spinner } from "@promptctl/rich-js";

const spinner = new Spinner("dots", "working", { style: "cyan" });
console.print(new Group(...[0, 0.1, 0.2, 0.3].map((t) => spinner.at(t))));
```

A `Progress` hands its `SpinnerColumn` each frame's time on the progress's clock, and a `Live` hands it to [a view](/live#a-view-drawn-for-a-time); a `Status` is that view over its message.

## Lit by an effect

An effect wraps whatever is up: `Effected` around `Frames` lights the frame in progress and still changes no glyph.

```typescript
import { CATPPUCCIN_MOCHA, EFFECT_CATALOGUE, Effected, FrameSequence, Frames, RichText, Style } from "@promptctl/rich-js";

const theme = CATPPUCCIN_MOCHA;
const frames = new FrameSequence(
  ["loading", "loading.", "loading..", "loading..."].map((text) => ({
    text: new RichText(text, { style: Style.parse("bold") }),
    seconds: 0.5,
  })),
);
const lit = EFFECT_CATALOGUE.loops.pulse({ z: 3 });

for (const t of [0, 0.5, 1]) {
  console.print(new Effected(new Frames(frames, { t }), lit, { t, key: "loading", theme }));
}
```

## In a template

A host that builds its text in templates registers `animationFuncs(frameTime)` from the [template bindings](/template-bindings), handing in the time the way `richTextFuncs` is handed the drawn depth. `frames <seconds> <frame> <seconds> <frame> …` is then the frame in progress at the moment the template is evaluated, and a frame is any fragment:

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { RichText } from "@promptctl/rich-js";
import { animationFuncs, richTextFuncs } from "@promptctl/rich-js/template-bindings";

let frameTime = 0;
const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...animationFuncs(() => frameTime) },
});

const gauge = engine.compile(`{{ "effort " | dim }}{{ frames 1 ("›" | fg "green") 1 ("››" | fg "yellow") 1 ("›››" | fg "red") }}{{ " max" | dim }}`);

for (frameTime of [0, 1.5, 2.2, 3]) {
  console.print(RichText.fromFragments(gauge({})));
}
```

The template is compiled once and reads the time each time it is evaluated, so a host that evaluates it on every redraw hands in each redraw's time and nothing else changes.

`stepped <seconds> <color> <seconds> <color> …` is the same beat for a colour: the colour in progress at the moment, as a [colour value](/template-bindings#colors-are-values), so it goes wherever a colour goes. Here the chevrons turn and their ink steps through three bright colours, each kept readable on the ground the template names:

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { RichText } from "@promptctl/rich-js";
import { animationFuncs, richTextFuncs } from "@promptctl/rich-js/template-bindings";

let frameTime = 0;
const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...animationFuncs(() => frameTime) },
});

const gauge = engine.compile(`{{- $bg := "#313244" -}}
{{- $ink := readableOn (stepped 1 "#ff5555" 1 "#f1fa8c" 1 "#50fa7b") $bg 4.5 -}}
{{ frames 1 "›" 1 "››" 1 "›››" | fg $ink | bg $bg }}`);

for (frameTime of [0, 1, 2, 3]) {
  console.print(RichText.fromFragments(gauge({})));
}
```
