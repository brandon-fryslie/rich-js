# Frames

Frames change *what* an element shows on a beat: a sequence of frames, each held for its own number of seconds and then replaced by the next, looping. An [effect](/effects) changes how an element's cells are coloured and may never change a glyph; frames are the other kind of motion, and the two compose by nesting.

Nothing here reads a clock. A `FrameSequence` is the frames prepared to draw, built once and kept, and placed like any renderable it draws the frame in progress at the time of the frame it is drawn in. The same time always draws the same bytes, at one redraw a second or sixty, and finding which frame the time lands on is all a draw does, so a frame costs the same over ninety frames as over one.

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

A `FrameSequence` is an [animation](/animation) of the frame shown: `at(t)` is the frame in progress as a `RichText` of its own, a copy, and `nextChange(t)` is when it gives way to the next. Placed in a panel, a table cell or a view, it draws that frame at the frame's time, its cells [saying when it turns](#when-the-frame-next-changes). The holds are the sequence's `beat`, whose `period` is their sum.

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

A frame drawn at `t` is drawn until the next frame begins, and the sequence's `nextChange(t)` says when that is, the answer every [animation](/animation) gives:

```typescript
import { FrameSequence, RichText } from "@promptctl/rich-js";

const quarters = new FrameSequence(["a", "b", "c", "d"].map((glyph) => ({ text: new RichText(glyph), seconds: 0.25 })));
const whole = new FrameSequence(["›", "››", "›››"].map((glyph) => ({ text: new RichText(glyph), seconds: 1 })));

for (const t of [0, 1, 2]) {
  console.print(`t=${t}s  quarters change at ${quarters.nextChange(t)}s, chevrons at ${whole.nextChange(t)}s`);
}
```

Placed, the sequence stamps every cell of the frame it draws with that moment, on its `Style`, where it rides up through any container the frame sits in, as a cell's anchor does, and writes no byte. Whoever holds the composed frame reads the soonest off it with `Segment.nextChange`, and with what it was told through the render options' `onHold` of holds no cell carries, so a host knows when to draw again without asking each container what it holds. An [effect](/effects) stamps its frame the same way. `at(t)` alone is the frame and no stamp, for every animation: the time an animation is asked for may be one a [timeline](/animation#playback-a-timeline) or a lifecycle mapped from the host's, and a stamp made there would be on a clock the host cannot read.

A host that draws once a second can read from the answers alone that it is skipping frames: at each `t` the quarters above change at `t + 0.25`, before its next draw at `t + 1`, while the chevrons change exactly at it. A host drawing sixty times a second sees the next change never come before its next frame. A [`Live`](/live#auto-refresh) reads the answer off every frame it draws and wakes then, so it draws each frame of a sequence rather than a sample of them.

## Spinners

A `Spinner` is an [animation](/animation) built on a `FrameSequence` over one of the named spinners — `dots`, `line`, `bouncingBall` and the rest of the cli-spinners set — each frame held for the spinner's interval, with an optional label after it. It is built once and placed like any renderable, drawing the frame in progress at the frame's time, and a spinner reads no clock. `spinner.at(t)` is the frame at a time you name, as Rich's `Spinner.render(time)` is. `speed` is a [timeline](/animation#playback-a-timeline) the frames run on from `t = 0`: `2` turns the spinner twice as fast, and a negative speed runs it backwards. Whichever way it turns, a placed spinner's cells say when it turns next on the host's clock — exactly, for the frames the output draws, an ASCII-only output drawing the `line` spinner in its place. `spinner.nextChange(t)` answers before the output is known, so it is the sooner of the two.

```typescript
import { Group, Spinner } from "@promptctl/rich-js";

const spinner = new Spinner("dots", "working", { style: "cyan" });
console.print(new Group(...[0, 0.1, 0.2, 0.3].map((t) => spinner.at(t))));
```

A `Progress` draws its table in a frame for the moment its tasks are drawn at, and a [`Live`](/live) draws its view in a frame for its time, so a spinner placed in either turns with no more said. A `Status` is a `Live` over its spinner.

## Lit by an effect

An effect wraps whatever is up: `Effected` around a `FrameSequence` lights the frame in progress and still changes no glyph.

```typescript live
import { CATPPUCCIN_MOCHA, EFFECT_CATALOGUE, Effected, FrameSequence, Live, RichText, Style } from "@promptctl/rich-js";

const theme = CATPPUCCIN_MOCHA;
const frames = new FrameSequence(
  ["loading", "loading.", "loading..", "loading..."].map((text) => ({
    text: new RichText(text, { style: Style.parse("bold") }),
    seconds: 0.5,
  })),
);
const lit = EFFECT_CATALOGUE.loops.pulse({ z: 3 });

const live = new Live(new Effected(frames, lit, { key: "loading", theme }), { console });
live.start();
try {
  await new Promise((resolve) => setTimeout(resolve, 4000));
} finally {
  live.stop();
}
```

## In a template

A host that builds its text in templates passes its engine config through `withAnimation(config, frame)` from the [template bindings](/template-bindings), handing in the frame's time the way `richTextFuncs` is handed the drawn depth. `frames <seconds> <frame> <seconds> <frame> …` is then the frame in progress at the moment the template is evaluated, and a frame is any fragment:

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { RichText } from "@promptctl/rich-js";
import { richTextFuncs, withAnimation } from "@promptctl/rich-js/template-bindings";

let frameTime = 0;
const engine = createEngine<RichText>(
  withAnimation({ fromString: (s) => new RichText(s), toString: (rt) => rt.plain, funcs: richTextFuncs() }, () => ({ time: frameTime })),
);

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
import { richTextFuncs, withAnimation } from "@promptctl/rich-js/template-bindings";

let frameTime = 0;
const engine = createEngine<RichText>(
  withAnimation({ fromString: (s) => new RichText(s), toString: (rt) => rt.plain, funcs: richTextFuncs() }, () => ({ time: frameTime })),
);

const gauge = engine.compile(`{{- $bg := "#313244" -}}
{{- $ink := readableOn (stepped 1 "#ff5555" 1 "#f1fa8c" 1 "#50fa7b") $bg 4.5 -}}
{{ frames 1 "›" 1 "››" 1 "›››" | fg $ink | bg $bg }}`);

for (frameTime of [0, 1, 2, 3]) {
  console.print(RichText.fromFragments(gauge({})));
}
```
