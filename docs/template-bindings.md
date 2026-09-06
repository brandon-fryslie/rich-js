# Template Bindings

rich-js can hand its entire styling vocabulary to a template engine, so styled text is authored as a template instead of assembled in code. Colors, attributes, and links become ordinary template functions:

```text
{{ "deploy paused" | fg (color "warning") | bold }}
```

There is no second markup grammar here. The syntax is standard [Go template](https://pkg.go.dev/text/template) syntax, parsed by [`@promptctl/go-template-js`](https://www.npmjs.com/package/@promptctl/go-template-js) — one parser, one AST, one error dialect. This module contributes only the styling functions. The engine is a dependency of rich-js, so there is nothing extra to install.

Use [markup](/markup) instead when a human writes the string and the styling is inline: `[bold red]alert[/]` is shorter and needs no engine. Reach for template bindings when the text is assembled from data, when the styling itself is computed, or when the template lives in a config file an author edits without redeploying.

## A running program

Complete — save it and run it:

```typescript
import { Console, RichText } from "@promptctl/rich-js";
import { createRichTextEngine } from "@promptctl/rich-js/template-bindings";

const console = new Console();
const engine = createRichTextEngine();

const template = engine.compile(
  `{{ "build " | dim }}{{ .status | fg "#4ade80" | bold }}{{ " in 4.1s" | dim }}`,
);

console.print(RichText.fromFragments(template({ status: "passed" })));
```

Evaluating a template produces a `RichText[]` — one fragment per top-level expression, not one concatenated string. `RichText.fromFragments` flattens that list into a single styled `RichText` that flows into `console.print` like any other renderable. The list stays visible because some consumers need it: a toolbar that treats each top-level `link` as an independently clickable cell reads the fragments directly rather than hunting for boundaries in a merged string.

## Two registrations

The functions ship in two groups, split by exactly one question — does it need a theme?

`richTextFuncs()` is everything that does not: the color sinks `fg` and `bg`, the palette-free color math, every text attribute, `link`, and `style`. It takes no arguments and is safe to register unconditionally. A project with no theme system at all still gets the complete vocabulary by feeding it hex literals.

`paletteFuncs(getPalette)` is the two that do: `color`, which turns a palette variable name into a color, and `ramp`, whose stops are palette names. It is the only registration that knows a palette exists, which is why it is the only one that takes an argument.

`createRichTextEngine()` wires up `richTextFuncs()` alone — it cannot supply a palette. Once you want theme colors, build the engine yourself and merge both maps:

```typescript
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

```text
{{ "shipped" | fg "#4ade80" | bold }}
{{ "open the run" | underline | link "https://example.com/run/42" }}
```

`fg` and `bg` are the only two color-applying functions, and they take the color as an argument rather than encoding it in the function name. That is what lets them accept a color computed at render time. The slot takes the full `ColorSpec` vocabulary, which is wider than the hex the color math produces:

```text
{{ "hex"          | fg "#ff6b6b"          }}
{{ "rgb triple"   | fg "rgb(255,107,107)" }}
{{ "palette index"| fg "color(203)"       }}
{{ "ansi name"    | fg "bright_blue"      }}
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

const source = `{{- $sha    := "#7c7c7c" -}}
{{- $when   := "italic dim" -}}
{{- $branch := "italic bold on #2d2d2d" -}}
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
| `darken c n` / `lighten c n` | slide HSL lightness by `n` 10% levels |
| `mix a b pct` | blend `a` toward `b` by `pct`% (0 → `a`, 100 → `b`) |
| `contrastOn bg` | black or white, whichever is readable on `bg` |
| `readableOn fg bg ratio` | `fg` nudged in OKLCH lightness until it clears `ratio` on `bg`, hue preserved |
| `shiftHue c deg` | rotate hue in OKLCH |
| `scaleChroma c f` | multiply chroma (0 → gray, 1 → identity) |
| `scaleLightness c f` | multiply lightness (1 → identity, -1 → invert) |
| `shiftLightness c d` | add to lightness, after any scale |
| `ramp v easing p₀ c₀ p₁ c₁ …` | the color at `v` along stops `cᵢ` at positions `pᵢ`, interpolated in OKLCH (`"linear"`) or held until the next stop (`"step"`) |

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
import { Console, RichText } from "@promptctl/rich-js";
import { createRichTextEngine } from "@promptctl/rich-js/template-bindings";

const console = new Console();
const engine = createRichTextEngine();

const meter = `{{- define "cell" }}{{ printf " %3d%% " . | bg (ramp . "linear" 0 "#2e7d32" 50 "#f9a825" 100 "#c62828") }}{{ end -}}
{{ template "cell" 0 }}{{ template "cell" 25 }}{{ template "cell" 50 }}{{ template "cell" 75 }}{{ template "cell" 100 }}`;

console.print(RichText.fromFragments(engine.compile(meter)({})));
```

The `"step"` easing holds each stop's color until the next position, which is a threshold cascade — `≥ 50 warning, ≥ 80 error, else calm` — written as data instead of a chain of `if`s. It is the same function: a gradient and a cascade differ by one word. Positions are required, never spread evenly by default, because the positions *are* the decision — where warning begins is the whole content of a threshold, and a ramp that guessed them would be deciding it silently.

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

`color "name-or-hex"` resolves a palette variable to a color, and passes an already-literal color straight through. That second half is not a convenience — it makes `color` idempotent, so a program can apply it unconditionally to any author-written color string without first asking whether it is a name or already a color.

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
{{ "bmf" | fg $who | bold }} → {{ "rework the demo" | fg $topic }}
{{ "alice" | fg $who | bold }} → {{ "tighten measure()" | fg $topic }}`;

const compiled = engine.compile(source);
console.print(RichText.fromFragments(compiled({})));
```

An unknown name throws, carrying near-miss suggestions drawn from the live palette. In a template that surfaces as an evaluation error at the exact call site — the signal an author, or an agent editing a config file, needs in order to fix it.

Passing a palette name where a color belongs is the other common slip, and it names its own fix. `darken "primary" 2` reports that `darken` expected a color and tells you to wrap it: `darken (color "primary") 2`.

## Rendering to segments

`renderTemplate` is the shortcut for the live-render case — a preview pane, a status line, anything that recompiles a template the user is currently editing. It compiles, flattens the fragments, renders to a `Segment[]`, and wraps the whole flow so a broken template degrades instead of throwing:

```typescript
import { segmentsToString, detectColorSystem } from "@promptctl/rich-js";
import { createRichTextEngine, renderTemplate } from "@promptctl/rich-js/template-bindings";

const engine = createRichTextEngine();

const segments = renderTemplate(engine, `{{ .who | fg "#4ade80" }}`, { who: "world" });
process.stdout.write(segmentsToString(segments, detectColorSystem()) + "\n");
```

::: warning Don't route ANSI back through `Console`
`segmentsToString` returns finished ANSI. `console.print` treats its argument as *content*: it strips the escape bytes and highlights what's left, so the escape sequences arrive as visible text. Write the string to the stream directly, or skip `segmentsToString` and print the `RichText` instead.
:::

On a parse or evaluation failure it returns a single dim red segment reading `[error: …]`, truncated to 80 characters, which a caller can drop into their layout unchanged. Even a malformed `errorStyle` cannot break that promise — an unparseable spec falls back to the built-in style rather than propagating the failure it was supposed to report.

```typescript
import { segmentsToString } from "@promptctl/rich-js";
import { createRichTextEngine, renderTemplate } from "@promptctl/rich-js/template-bindings";

const engine = createRichTextEngine();

const broken = renderTemplate(engine, `{{ no_such_function "x" }}`, {}, {
  errorStyle: "yellow",
});

process.stdout.write(segmentsToString(broken, null) + "\n"); // [error: …]
```

`maxWidth` defaults to 400 — wide enough that the downstream line-splitting decides the real width, matching the usual "render wide, fit on output" pipeline.

Reach past `renderTemplate` when you want custom error handling, access to the intermediate `RichText`, or a template compiled once and evaluated many times. Call `engine.compile` yourself and flatten with `RichText.fromFragments`; the helper is sugar for one shape, not a replacement for the compile-once pattern.
