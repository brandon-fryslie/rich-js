# Effects

An effect changes the colours of a renderable's cells over time: a highlight sweeping through text, a pulse that brightens and dims, a fade. It is one pure function, given a cell's colours, where the cell is, and a time `t` in seconds, and returning the cell's new colours:

```typescript shape
import type { CellColors, EffectCell } from "@promptctl/rich-js";

type Effect = (colors: CellColors, cell: EffectCell, t: number) => CellColors;
```

## Ready-made effects

The library ships six. Four loop for as long as they are drawn, and two run once:

| Effect | What it looks like |
| --- | --- |
| `shimmer` | sunlight moving across water: a soft band of light crosses the element, glittering where ripples cross |
| `pulse` | a slow glow on an element, warming into the light and settling back, the way an indicator breathes |
| `sparkle` | fireflies: short glowing strokes, each a few cells long, flashing and gone |
| `wheel` | the colour of daylight going round: every hue turns once a period, far too slowly to see moving |
| `fadeIn` | ink blooming in water: patches of the element surface first and the rest follows |
| `dissolveOut` | mist lifting: the element thins in drifting patches until nothing is left |

Each takes a `Curve`: `seconds` (a loop's period, or a transition's duration), an `ease`, and a `swing`, how far the move goes at full strength. `EFFECT_CURVES` holds the curves each effect was tuned to by eye, at 30 frames a second and at one. They are slow on purpose. At one frame a second, no cell's colour moves more than a barely noticeable step from one frame to the next, so the motion reads as drift rather than as ticks.

Here is a status line under a shimmer, drawn at three moments:

```typescript
import {
  CATPPUCCIN_MOCHA,
  ColorSpec,
  EFFECT_CURVES,
  EFFECT_LIGHTS,
  Effected,
  RichText,
  SHIMMER_WIDTH,
  Style,
  onColors,
  shares,
  shimmer,
} from "@promptctl/rich-js";

const theme = CATPPUCCIN_MOCHA;
const ink = theme.foregroundColor;
const words = "Thinking about how light should cross these words";
const line = new RichText(words, { style: Style.fromColor(ColorSpec.fromRgba(ink), ColorSpec.fromRgba(theme.backgroundColor)) });

const glint = shimmer(EFFECT_CURVES.shimmer, words.length, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, 0);
const lit = onColors(shares([[ink, theme.backgroundColor]], new Set([ink.hex]), glint.touch), glint);

for (const t of [0, 60, 100]) {
  console.print(new Effected(line, lit, { t, key: "status", theme }));
}
```

Every effect's `z` argument (the `0` above) places the element in the noise the effect is drawn from. Give two elements different values and they do not move in lockstep.

### A loop lights only the colours it is given

`shimmer`, `pulse` and `sparkle` return a `Loop`: what the light does to one colour, and how strongly it acts on each cell at each moment. `onColors` turns a loop into an `Effect` over a set of colours, each at its own share of the light, so whatever else is on the screen is left alone.

`shares` works those shares out so the words stay readable. Give it every ink and ground pair the element draws its text in, and the colours that should take the light. Each colour gets the largest share at which every pair it appears in still reads at its resting contrast, or at WCAG AA (4.5:1) if it rested above that. A colour with contrast to spare glows brightly; one with none barely moves.

`wheel` keeps lightness and chroma and only turns hue, so it is an `Effect` already and needs no shares.

### A transition says when it is done

`fadeIn` and `dissolveOut` take a start time and return a `Transition`: the `effect` to draw, and `done(t)`, true from the moment every cell has arrived or gone. A caller stops drawing an element that has dissolved, or drops the effect from one that has faded in, when `done` says so:

```typescript
import { CATPPUCCIN_MOCHA, EFFECT_CURVES, dissolveOut } from "@promptctl/rich-js";

const leaving = dissolveOut(EFFECT_CURVES.dissolve, 10, 0, CATPPUCCIN_MOCHA.backgroundColor);
console.print([20, 39.9, 40].map((t) => `${t}s: ${leaving.done(t) ? "gone" : "leaving"}`).join(" · "));
```

Both blend toward the ground you give them, which should be the terminal's own background: the library never asks the terminal what that is.

To watch every effect at any frame rate, colour depth and theme, run `npm run effects-feel` in a checkout of this repository.

## Writing an effect

`Effected` wraps any renderable and draws it with its cells' colours passed through an effect at one moment:

```typescript
import { ColorRgba, ColorRamp, DEFAULT_TERMINAL_THEME, EASES, Effected, Phase, RichText, type Effect } from "@promptctl/rich-js";

const highlight = new ColorRgba(255, 214, 102);
const sweep = Phase.loop(1.5);
const label = "  thinking about colour  ";

const shimmer: Effect = (colors, cell, t) => {
  const centre = sweep(t) * label.length;
  const weight = Math.max(0, 1 - Math.abs(cell.col - centre) / 4);
  const toward = new ColorRamp(EASES.linear, [
    { at: 0, color: colors.fg },
    { at: 1, color: highlight },
  ]);
  return { fg: toward.at(weight), bg: colors.bg };
};

for (const t of [0, 0.5, 1]) {
  console.print(new Effected(new RichText(label), shimmer, { t, key: "thinking", theme: DEFAULT_TERMINAL_THEME }));
}
```

## Time is an argument

Nothing in an effect reads a clock. Whoever draws frames builds the view for each frame's `t`, so the same `t` always draws the same output, at 30 frames a second or one every two seconds. How far along an effect is comes from the [easing and phase vocabulary](/easing): `ease(phase(t))`.

## What a cell knows

- `row` and `col` count from the top-left of what the wrapped renderable drew, so a sweep crosses the element, not the screen. A wide glyph is one cell to the effect, at the column of its first half, and is never cut.
- `seed` is a number in `[0, 1)` that stays the same for that cell on every frame, for effects that vary cell by cell. It is derived from the `key` option and the cell's position, so two elements showing the same text under different keys do not move in lockstep.
- `colors` are what the screen shows: the glyph's colour and the colour behind it, so under `reverse` they are the style's two colours swapped. A cell that sets no colour of its own, or names one of the sixteen ANSI colours, is handed that colour from the `theme` option, a `TerminalTheme`. The terminal's real palette is never queried, so the caller supplies it.

## What an effect cannot change

An effect changes how cells look, never which cells exist or who drew them. Text, links, and the anchors that let a click or Tab reach a widget all pass through, so a button under an effect still takes clicks. A cell whose colours come back unchanged is drawn exactly as before: the identity effect `(colors) => colors` produces byte-identical output. Neighbouring cells of one segment that the terminal is sent alike stay one segment: below truecolor, two colours that land on one palette index are one run, and a cell moved too little for the depth to show keeps the colour it was written in, none included. Cells from two segments stay two, as the wrapped renderable drew them.

With no colour output at all, an effect has nothing to change, and the wrapped renderable draws as it would without it.

A colour an effect moves is written as the nearest colour the output's depth can draw on the `theme` terminal: the RGB value itself in truecolor; otherwise the nearest of the terminal's default colour, the theme's sixteen and, at 256 colours, the cube and grey ramp. A translucent colour is laid on what is beneath it first, as every translucent colour the library writes is: the ground on black, since a terminal cannot say what lies under its cells, and the glyph on that ground. So below truecolor a colour moved a little off an ANSI slot or the default colour is still drawn as that one, and a pulse on a sixteen-colour terminal holds still rather than jumping to another slot.

Effects stack by nesting: `new Effected(new Effected(child, a, options), b, options)` draws each cell in the colours that applying `a` and then `b` gives it. The bytes can differ from one effect that calls `a` then `b`: the outer layer sees the inner layer's output as written, so a colour the inner layer changed reaches the outer one already rounded to the output's depth, and stays written as that even where the outer one moves it back.
