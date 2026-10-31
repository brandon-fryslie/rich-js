# Template Bindings

rich-js can hand its entire styling vocabulary to a template engine, so styled text is authored as a template instead of assembled in code. Colors, attributes, and links become ordinary template functions:

```handlebars
{{ "deploy paused" | fg (color "warning") | bold }}
```

There is no second markup grammar here. The syntax is standard [Go template](https://pkg.go.dev/text/template) syntax, parsed by [`@promptctl/go-template-js`](https://www.npmjs.com/package/@promptctl/go-template-js) — one parser, one AST, one error dialect. This module contributes only the styling functions. The engine is a peer dependency rather than a bundled one, so you install it alongside rich-js — `npm install @promptctl/rich-js @promptctl/go-template-js` — before reaching for this subpath. Without it, the import itself fails with `ERR_MODULE_NOT_FOUND`; the main entry point is unaffected.

Use [markup](/markup) instead when a human writes the string and the styling is inline: `[bold red]alert[/]` is shorter and needs no engine. Reach for template bindings when the text is assembled from data, when the styling itself is computed, or when the template lives in a config file an author edits without redeploying.

## A running program

Complete — save it and run it:

```typescript
import { Console, RichText } from "@promptctl/rich-js";
import { createRichTextEngine } from "@promptctl/rich-js/template-bindings";

const console = new Console();
const engine = createRichTextEngine();

const template = engine.compile(`{{- $muted := "dim" -}}
{{- $ok := "bold green" -}}
{{ "build " | style $muted }}{{ .build | style $ok }}{{ " in 4.1s" | style $muted }}
{{ "tests " | style $muted }}{{ .tests | style $ok }}{{ " in 12.8s" | style $muted }}`);

console.print(RichText.fromFragments(template({ build: "passed", tests: "passed" })));
```

The two `$` lines at the top name each look once, and `style` applies a named look wherever it is piped, so editing `$ok` recolours both results. [Name a style once](#name-a-style-once-use-it-everywhere) covers the spec grammar.

Evaluating a template produces a `RichText[]` — one fragment per top-level expression, not one concatenated string. `RichText.fromFragments` flattens that list into a single styled `RichText` that flows into `console.print` like any other renderable. The list stays visible because some consumers need it: a toolbar that treats each top-level `link` as an independently clickable cell reads the fragments directly rather than hunting for boundaries in a merged string.

## Two registrations

The functions ship in two groups, split by exactly one question — does it need a theme?

`richTextFuncs()` is everything that does not: the color sinks `fg` and `bg`, the palette-free color math, every text attribute, `link`, and `style`. It is safe to register unconditionally. Its one optional argument, `drawnAt: () => DrawnAt`, says where the text lands — `{ depth, terminal? }`, the depth the terminal will draw at and, when you know it, the `TerminalTheme` drawing it: `readableOn` measures its floor on the colours actually drawn, at sixteen colours in that terminal's own — what that guarantees, fallback included, is stated once in [Contrast](/contrast). Omitted, it is truecolor. A host that swaps `readableOn` alone — per segment, say — registers `readableOnFunc(drawnAt)` over the key instead. A project with no theme system at all still gets the complete vocabulary by feeding it hex literals.

`paletteFuncs(getPalette)` is the two that do: `color`, which turns a palette variable name into a color, and `ramp`, whose stops are palette names. It is the only registration that knows a palette exists.

A third, `animationFuncs(frame)`, answers a different question: what moment is the template drawn for? A host that redraws on its own clock hands that clock's time in, and `tween`, `loop`, `glyphs`, `frames` and `stepped` draw for it. [Animating a template](#animating-a-template) covers them.

`createRichTextEngine()` wires up `richTextFuncs()` alone — it cannot supply a palette. Once you want theme colors, build the engine yourself and merge both maps:

```typescript silent
import { createEngine, type Engine } from "@promptctl/go-template-js";
import { RichText, GRUVBOX } from "@promptctl/rich-js";
import { richTextFuncs, paletteFuncs } from "@promptctl/rich-js/template-bindings";

let theme = GRUVBOX;

const engine: Engine<RichText> = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: {
    ...richTextFuncs(),
    ...paletteFuncs(() => theme.palette),
  },
});
```

The two bridge functions are what bind the engine's generic output type to `RichText`: `fromString` lifts every string literal in the template into a fragment, so authors write <code v-pre>{{ bold "x" }}</code> rather than wrapping literals by hand. `toString` flattens a fragment back to plain text, and the engine calls it only for `printf`'s `%s` and `%q` verbs and the `print*` slots, where ANSI was never wanted. A styled fragment never silently degrades into a plain string anywhere else — it raises a type error at the call site.

::: warning Keep `T` as `RichText`
`FuncMap` is not parameterized over the fragment type, so these maps type-check against any engine. They are only *runtime*-compatible with `Engine<RichText>`: every style function returns a `RichText` and requires a `RichText` child, enforced by a check that throws. Merging them into an engine with a different fragment type compiles and then fails at evaluation.
:::

### Why `paletteFuncs` takes a getter

`paletteFuncs` asks for `() => Palette` rather than a `Palette`, because templates are parsed once and evaluated many times. An engine that captured a palette at construction would be frozen to whichever theme happened to be current then — and that freeze outlives every later theme change while the rest of the application's colors move on. A live preview or a theme picker would render half its colors from the new theme and half from the old.

The getter costs nothing structurally. Function bodies run at evaluate time, so reading the palette through a getter leaves parse-once/evaluate-many intact. What a getter must never change is *which functions exist* — and it cannot, because the two names do not depend on the palette's contents.

## Writing templates

Pipe the text through the styling functions, left to right. Every styling function takes its child fragment as its last argument, which is exactly where Go's pipeline puts the piped value:

```typescript
const piped = engine.compile(`{{ "shipped" | fg "green" | bold }}
{{ "open the run" | underline | link "https://example.com/run/42" }}`);

console.print(RichText.fromFragments(piped({})));
```

`fg` and `bg` are the only two color-applying functions, and they take the color as an argument rather than encoding it in the function name. That is what lets them accept a color computed at render time. The slot takes the full `ColorSpec` vocabulary, which is wider than the hex the color math produces:

```typescript
const slots = engine.compile(`{{ "hex"          | fg "#ff6b6b"          }}
{{ "rgb triple"   | fg "rgb(255,107,107)" }}
{{ "palette index"| fg "color(203)"       }}
{{ "ansi name"    | fg "bright_blue"      }}`);

console.print(RichText.fromFragments(slots({})));
```

The width is deliberate. `#ff6b6b` is a *concrete* color; `bright_blue` and `color(203)` are *symbolic* ones the terminal resolves against its own theme. Only concrete colors can be darkened or blended, which is why the color math below takes hex alone — but both kinds can be painted, so the sinks take the union.

### Attributes

Each of the thirteen text attributes registers as a one-argument function: `bold`, `dim`, `italic`, `underline`, `blink`, `blink2`, `reverse`, `conceal`, `strike`, `underline2`, `frame`, `encircle`, `overline`. Each also registers a `not_`-prefixed form that turns the attribute off — `not_bold`, `not_dim`, and so on. Eight have short aliases: `b`, `d`, `i`, `u`, `s`, `r`, `o`, and `uu`. Both spellings produce the same fragment.

### Name a style once, use it everywhere

Piping four attributes onto every one of a dozen fragments spreads one decision across a dozen edit sites. `style` collapses a whole bundle into a single call, and because the bundle is an ordinary string it flows through Go-template variables with no extra machinery:

```typescript
import { Console, RichText } from "@promptctl/rich-js";
import { createRichTextEngine } from "@promptctl/rich-js/template-bindings";

const console = new Console();
const engine = createRichTextEngine();

const source = `{{- $sha    := "yellow" -}}
{{- $when   := "italic dim" -}}
{{- $branch := "italic bold #ffffff on #3c5ac8" -}}
{{ "abc1234" | style $sha }}  {{ "2026-05-13 21:42" | style $when }}
{{ " feat/sunrise " | style $branch }}
{{ "e8c19d2" | style $sha }}  {{ "2026-05-13 21:38" | style $when }}
{{ " feat/measurements " | style $branch }}`;

console.print(RichText.fromFragments(engine.compile(source)({})));
```

Recoloring every SHA in that template is one edit. The spec grammar is the same one [`Style.parse`](/style) reads — the inside of `[...]` in markup — so a spec accepted in markup produces the same fragment here, and one markup rejects fails here the same way.

A spec can also arrive through scope, which is how a theme file ends up governing styling it never hard-codes: pass `{ styles: { alert: "bold #ff6b6b" } }` and write <code v-pre>{{ .field | style .styles.alert }}</code>.

## Colors are values

Every function so far takes a fragment and returns a styled fragment. The color functions do not: they take colors and return a color. That difference is the whole design.

A color that can be held is a color that can be composed. `color` names one, the functions below transform it, and `fg`/`bg` paint it — three separate steps, so any transformation can stack on any other:

| function | meaning |
|---|---|
| `darken c n` / `lighten c n` | slide HSL lightness by `n` 10% levels (`n` a whole number) |
| `mix a b pct` | blend `a` toward `b` by `pct`% (0 → `a`, 100 → `b`) |
| `contrastOn bg` | black or white, whichever is readable on `bg` |
| `readableOn fg bg ratio` | `fg` nudged in OKLCH lightness until it clears `ratio` on `bg`, hue preserved |
| `shiftHue c deg` | rotate hue in OKLCH |
| `scaleChroma c f` | multiply chroma (0 → gray, 1 → identity) |
| `scaleLightness c f` | multiply lightness (1 → identity, -1 → invert) |
| `shiftLightness c d` | add to lightness, after any scale |
| `ramp v ease p₀ c₀ p₁ c₁ …` | the color at `v` along stops `cᵢ` at positions `pᵢ`, interpolated in OKLCH through the named ease (`"linear"`, `"ease-in-out"`, …) or held until the next stop (`"step"`) |

A color crosses the template seam as a `#RRGGBB` string, not an opaque object, and that carrier earns its keep three ways. The engine's `string` slot is its strictest — it refuses fragments outright, so a color slot can never quietly swallow styled text. The value flows through the language for free: `$muted := mix $fg $bg 60` holds it, `printf` prints it, `eq` compares it. And misuse is visible, because a color that lands in text position renders as the literal `#7aa2f7` rather than vanishing as a dropped style.

Because a color is a value, a scale is one function applied with different numbers:

```typescript
import { Console, RichText } from "@promptctl/rich-js";
import { createRichTextEngine } from "@promptctl/rich-js/template-bindings";

const console = new Console();
const engine = createRichTextEngine();

const scale = `{{- $p := "#7aa2f7" -}}
{{ "███" | fg (darken $p 2) }}{{ "███" | fg (darken $p 1) }}{{ "███" | fg $p }}{{ "███" | fg (lighten $p 1) }}{{ "███" | fg (lighten $p 2) }}`;

console.print(RichText.fromFragments(engine.compile(scale)({})));
```

`ramp` is the one function whose input is a *number* rather than a color. Every other function here adjusts a color you already have; a ramp answers "what does 73 % look like" — a measurement mapped onto ordered stops, each a color at a position. Between stops the color is interpolated in OKLCH, so the midpoint of two theme colors is perceptually halfway rather than the gray mud an sRGB average produces. Below the first stop it is the first color; at or above the last it is the last.

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { Console, RichText, GRUVBOX } from "@promptctl/rich-js";
import { richTextFuncs, paletteFuncs } from "@promptctl/rich-js/template-bindings";

const console = new Console();
// `ramp` is a palette function — its stops may be palette names — so it is
// registered by `paletteFuncs`, never by `createRichTextEngine()`.
const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...paletteFuncs(() => GRUVBOX.palette) },
});

const meter = `{{- define "cell" -}}
{{- $c := ramp . "linear" 0 "#2e7d32" 50 "#f9a825" 100 "#c62828" -}}
{{ printf " %3d%% " . | fg (contrastOn $c) | bg $c }}
{{- end -}}
{{ template "cell" 0 }}{{ template "cell" 25 }}{{ template "cell" 50 }}{{ template "cell" 75 }}{{ template "cell" 100 }}`;

console.print(RichText.fromFragments(engine.compile(meter)({})));
```

The ease is any name in `EASES` ([Easing & Phases](/easing) lists them) and it shapes the way between each pair of stops. The `"step"` ease holds each stop's color until the next position, which is a threshold cascade — `≥ 50 warning, ≥ 80 error, else calm` — written as data instead of a chain of `if`s. It is the same function: a gradient and a cascade differ by one word. Positions are required, never spread evenly by default, because the positions *are* the decision — where warning begins is the whole content of a threshold, and a ramp that guessed them would be deciding it silently.

Stops are color references, resolved through the same path as `color` (see below), so a ramp over palette names — `ramp .pct "step" 0 "surface" 50 "warning" 80 "error"` — recolors with the theme like every other color in the template, and a hex literal in a stop works because that resolver passes literals through.

Holding the result of `contrastOn` in a variable is what makes a swatch that cannot be unreadable — the same color feeds both the background and the choice of ink over it:

```typescript
import { Console, RichText } from "@promptctl/rich-js";
import { createRichTextEngine } from "@promptctl/rich-js/template-bindings";

const console = new Console();
const engine = createRichTextEngine();

const swatch = `{{- $bg := "#1a1a2e" -}}
{{ " ⚠ HEADS UP " | fg (contrastOn $bg) | bg $bg }}`;

console.print(RichText.fromFragments(engine.compile(swatch)({})));
```

`contrastOn` and `readableOn` answer different questions, so they are different functions. `contrastOn` maximizes legibility and returns black or white. `readableOn` keeps a color recognizably itself and only slides its OKLCH lightness until it clears the ratio you ask for, so a blue on dark blue becomes a lighter blue rather than white. Its `ratio` is required rather than defaulted, because the threshold is the entire decision the function makes: 4.5 for body text, 3 for large text, and a hidden default would silently govern an accessibility outcome — or over-correct a caller whose point was to be quiet, since de-emphasized text floored at 4.5 is no longer de-emphasized.

::: tip Chain OKLCH axes sparingly
Each OKLCH axis function round-trips sRGB → OKLCH → sRGB, so chaining three or more quantizes visibly. Compose two, or reach for [`transposePalette`](/transpose) when a whole palette needs adapting.
:::

## Naming theme colors

`color "name-or-hex"` resolves a palette variable to a color, and passes an already-literal color straight through. That second half is not a convenience — it makes `color` idempotent, so a program can apply it unconditionally to any author-written color string without first asking whether it is a name or already a color. A palette color is opaque or fully transparent. A theme's translucent variable, such as a hover tint, arrives already drawn on that theme's own background; a fully transparent one, such as `link-background` in most bundled themes, is Textual's "no background" and stays transparent, so `bg (color "link-background")` leaves the background under it in place. It has no colour of its own to compute with, so the colour functions and `ramp` refuse it; use the colour of the surface it sits on instead.

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { Console, RichText, GRUVBOX } from "@promptctl/rich-js";
import { richTextFuncs, paletteFuncs } from "@promptctl/rich-js/template-bindings";

const console = new Console();
let theme = GRUVBOX;

const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...paletteFuncs(() => theme.palette) },
});

const source = `{{- $who := color "primary" -}}
{{- $topic := color "accent" -}}
{{ " bmf " | fg (contrastOn $who) | bg $who | bold }} → {{ " rework the demo " | fg (contrastOn $topic) | bg $topic }}
{{ " alice " | fg (contrastOn $who) | bg $who | bold }} → {{ " tighten measure() " | fg (contrastOn $topic) | bg $topic }}`;

const compiled = engine.compile(source);
console.print(RichText.fromFragments(compiled({})));
```

An unknown name throws, carrying near-miss suggestions drawn from the live palette. In a template that surfaces as an evaluation error at the exact call site — the signal an author, or an agent editing a config file, needs in order to fix it.

Passing a palette name where a color belongs is the other common slip, and it names its own fix. `darken "primary" 2` reports that `darken` expected a color and tells you to wrap it: `darken (color "primary") 2`.

## Animating a template

`animationFuncs(frame)` registers the functions that draw for a moment in time. The host owns the clock: `frame()` is read each time a template is evaluated. It returns the frame's `time`, an `onHold` listener if the host wants to hear when a decision the template made on an animated value changes, and the reader's preferences, `reducedMotion` and `asciiOnly`. So a template compiled once shows each redraw's moment, and a host that redraws once a second sees the same thing at each of its frames as a host that redraws sixty times a second. Every duration is in seconds.

What it returns is the functions and two engine hooks beside them, and the hooks are how the engine reports back which output depended on an animated value: `funcs` merges into the engine's `funcs`, and `emitted` and `decided` go into the engine's config under those names.

- `tween <seconds> <ease> <start> <from> <to>` is a number eased from `from` to `to` over `seconds`, starting at the moment `start`, and held at `to` afterwards. Every `start` is a moment on the timeline the functions are drawn on, which is the host's own clock unless you hand one in (below); with one handed in, record a change at `Timeline.at(timeline, host)`, not at the host time. The ease is any name in `EASES`, physics curves such as `"spring"` and `"back-out"` included. Pipe the target into it: `.pct | tween 0.4 "ease-out" .changedAt .was` eases from the old value to the new one, starting when your state says the value changed.
- `loop <seconds> <start>` is the way through a period, rising from 0 towards 1 and starting again, measured from `start`. Give a row of cells starts a step apart and the same motion travels along the row.
- `glyphs <name> <start>` passes the piped fragment through a [glyph effect](/animation#a-glyph-effect-text-typed-scrambled-and-rained-on), starting at `start`, with the catalogue's defaults. The names are `"typewriter"`, `"scramble"`, `"wave"`, `"rain"` and `"stars"`.
- `frames` and `stepped` step through a sequence of fragments or colours ([Frames](/frames#in-a-template)).

`tween` and `loop` return numbers, so they work anywhere a number does. Save one in a `$` variable and hand it to `ramp`: a ramp read at a tween is a colour tween, blended in OKLCH like every ramp, and a ramp read at a loop cycles through its colours. Here a context gauge eases to its new reading, its colour moving with it, while a label types itself in:

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { Console, RichText, GRUVBOX } from "@promptctl/rich-js";
import { animationFuncs, paletteFuncs, richTextFuncs } from "@promptctl/rich-js/template-bindings";

const console = new Console();
let frameTime = 0;
const animation = animationFuncs(() => ({ time: frameTime }));
const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...paletteFuncs(() => GRUVBOX.palette), ...animation.funcs },
  emitted: animation.emitted,
  decided: animation.decided,
});

const gauge = engine.compile(`{{- $muted := "dim" -}}
{{- $pct := .pct | tween 0.6 "ease-out" .changedAt .was -}}
{{- $ink := ramp $pct "linear" 0 "success" 50 "warning" 100 "error" -}}
{{ "context " | glyphs "typewriter" .changedAt | style $muted }}{{ "■■■" | fg $ink }} {{ printf "%3.0f%%" $pct | fg $ink | bold }}{{ " used" | style $muted }}`);

const state = { pct: 85, was: 20, changedAt: 10 };
for (frameTime of [10, 10.2, 10.4, 10.6, 11, 12]) {
  console.print(RichText.fromFragments(gauge(state)));
}
```

The tween changes with every frame and the typewriter stops changing once the text is typed. Every function says when what it drew will next change, so a host that schedules redraws knows when to look again, and it says so only for output that depends on it. A number or a colour has no cells to carry that moment, so each function marks its value instead, and the engine carries the mark beside the value through every variable, `printf`, comparison and `template` invocation it passes. `emitted` then stamps the cells of every fragment whose action read a marked value with the hold it is in, the way a placed [frame sequence](/frames) stamps its own cells, and `decided` tells the frame's `onHold` of a mark an `if`, `with` or `range` decided on, whichever arm it took, because the output may show that value later with no cell to say so yet. A value a template computes and never draws or decides on, <code v-pre>{{ $t := tween 2 "linear" 0 0 1 }}still</code>, reports nothing, so a still bar never claims to move.

A template evaluated inside a rich-js frame, by a renderable in an [`App`](/app#animating-at-a-frame-rate) or a `Live`, hands on the frame it is drawn in. `templateFrame(options)` reads it off that renderable's render options. The app then paints while a tween moves, stops once it lands, and draws it reduced when the app's `reducedMotion` says so. The frame's time is already on the app's timeline, so register no `timeline` of your own here:

```ts silent
import { createEngine } from "@promptctl/go-template-js";
import { RichText, type Renderable } from "@promptctl/rich-js";
import { animationFuncs, renderTemplate, richTextFuncs, templateFrame, type TemplateFrame } from "@promptctl/rich-js/template-bindings";

let drawnIn: TemplateFrame = { time: 0 };
const animation = animationFuncs(() => drawnIn);
const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...animation.funcs },
  emitted: animation.emitted,
  decided: animation.decided,
});

const gauge: Renderable = {
  render: (options) => {
    drawnIn = templateFrame(options);
    return renderTemplate(engine, `{{ printf "%3.0f%%" (tween 0.6 "ease-out" 0 20 85) }}`, {}, options);
  },
};
```

### Pausing, reversing and reduced motion

A host outside rich-js plays its own clock through a timeline. The second argument's `timeline` is a getter for the [timeline](/animation#playback-a-timeline) every function is drawn on, mapping the frame's `time`; it defaults to that time as it is. Return a paused timeline to freeze a session's animations, or a reversed one to run them backwards, with nothing recompiled; a frame drawn on a paused timeline says it will never change. A frame that says `reducedMotion: true` has every animation drawn [reduced](/animation#reduced-motion): a tween jumps to its target when it starts, a loop holds at its start, and a typewriter shows its text whole. A frame that says `asciiOnly: true` makes the glyphs an effect picks for itself, such as rain, ASCII:

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { Console, RichText, Timeline } from "@promptctl/rich-js";
import { animationFuncs, richTextFuncs } from "@promptctl/rich-js/template-bindings";

const console = new Console();
let host = 0;
let timeline = Timeline.play(0);
const animation = animationFuncs(() => ({ time: host }), { timeline: () => timeline });
const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...animation.funcs },
  emitted: animation.emitted,
  decided: animation.decided,
});

const spinner = engine.compile(`{{- $beat := 0.25 -}}
{{ frames $beat "◐" $beat "◓" $beat "◑" $beat "◒" }} syncing`);

const draw = (label: string) => console.print(`${label.padEnd(16)}`, RichText.fromFragments(spinner({})));
for (host of [0, 0.25, 0.5]) draw(`playing ${host}s`);
timeline = Timeline.pause(timeline, 0.5);
for (host of [0.75, 5]) draw(`paused ${host}s`);
timeline = Timeline.withRate(Timeline.resume(timeline, 5), 5, -1);
for (host of [5.25, 5.5]) draw(`reversed ${host}s`);
```

## Rendering to segments

`renderTemplate` is the shortcut for the live-render case — a preview pane, a status line, anything that recompiles a template the user is currently editing. It compiles, flattens the fragments, renders to a `Segment[]`, and a template that fails to parse or evaluate degrades instead of throwing:

```typescript
import { segmentsToString, resolveDestination } from "@promptctl/rich-js";
import { createRichTextEngine, renderTemplate } from "@promptctl/rich-js/template-bindings";

const engine = createRichTextEngine();

const segments = renderTemplate(engine, `{{ .who | fg "green" | bold }}`, { who: "world" });
process.stdout.write(segmentsToString(segments, resolveDestination("auto")) + "\n");
```

::: warning Don't route ANSI back through `Console`
`segmentsToString` returns finished ANSI. `console.print` treats its argument as *content*: it strips the escape bytes and highlights what's left, so the escape sequences arrive as visible text. Write the string to the stream directly, or skip `segmentsToString` and print the `RichText` instead.
:::

On a parse or evaluation failure it returns a single segment reading `[error: …]`, dim red unless `errorStyle` says otherwise — one line, drawn to the same `maxWidth` as a successful render and ending in `…` where the message had to be cut — which a caller can drop into their layout unchanged. Even a malformed `errorStyle` cannot break that promise — an unparseable spec falls back to the built-in style rather than propagating the failure it was supposed to report.

```typescript
import { segmentsToString, resolveDestination } from "@promptctl/rich-js";
import { createRichTextEngine, renderTemplate } from "@promptctl/rich-js/template-bindings";

const engine = createRichTextEngine();

const broken = renderTemplate(engine, `{{ darken "primary" 2 }}`, {}, {
  errorStyle: "yellow",
  maxWidth: process.stdout.columns,
});

process.stdout.write(segmentsToString(broken, resolveDestination("auto")) + "\n");
```

The fourth argument takes any `RenderOptions` besides `errorStyle`, and the render receives them as given, so a renderable that wraps a template passes along the options it was handed. Among them, `theme` looks up the style names carried by fragments that arrive through `scope` — a `RichText` built from `[my.heading]` markup, or one whose whole style is `"my.heading"`. Piping such a fragment through a style function lays the piped style over the name, and the render draws the name from its theme with the pipe on top. The template functions themselves take style definitions, not names: a template runs before any render, so `style "my.heading"` fails as the template's `[error: …]` line. `onStyleError` hears about each style the render drops. A handler that rethrows makes `renderTemplate` throw, as described in [Failing on invalid styles](./style#failing-on-invalid-styles); so does any other error the render raises, because the `[error: …]` line reports a template that failed and nothing else.

`maxWidth` defaults to 400 — wide enough that the downstream line-splitting decides the real width, matching the usual "render wide, fit on output" pipeline. The error line is fitted to that same width, so pass the width you draw at if a cut error should end in `…` rather than be cropped by whatever draws it.

Reach past `renderTemplate` when you want custom error handling, access to the intermediate `RichText`, or a template compiled once and evaluated many times. Call `engine.compile` yourself and flatten with `RichText.fromFragments`; the helper is sugar for one shape, not a replacement for the compile-once pattern.
