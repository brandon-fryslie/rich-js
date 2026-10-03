# Effects

An effect changes the colours of a renderable's cells over time: a highlight sweeping through text, a pulse that brightens and dims, a fade. It is one pure function, given a cell's colours, where the cell is, and a time `t` in seconds, and returning the cell's new colours:

```typescript shape
import type { CellColors, EffectCell } from "@promptctl/rich-js";

type Effect = (colors: CellColors, cell: EffectCell, t: number) => CellColors;
```

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

An effect changes how cells look, never which cells exist or who drew them. Text, links, and the anchors that let a click or Tab reach a widget all pass through, so a button under an effect still takes clicks. A cell whose colours come back unchanged is drawn exactly as before: the identity effect `(colors) => colors` produces byte-identical output. Neighbouring cells given equal colours stay one segment.

With no colour output at all, an effect has nothing to change, and the wrapped renderable draws as it would without it.

A colour an effect moves is written as the nearest colour the output's depth can draw on the `theme` terminal: the RGB value itself in truecolor; otherwise the nearest of the terminal's default colour, the theme's sixteen and, at 256 colours, the cube and grey ramp. A translucent colour is laid on what is beneath it first, as every translucent colour the library writes is: the ground on black, since a terminal cannot say what lies under its cells, and the glyph on that ground. So below truecolor a colour moved a little off an ANSI slot or the default colour is still drawn as that one, and a pulse on a sixteen-colour terminal holds still rather than jumping to another slot.

Effects stack by nesting: `new Effected(new Effected(child, a, options), b, options)` draws each cell in the colours that applying `a` and then `b` gives it. The bytes can differ from one effect that calls `a` then `b`: the outer layer sees the inner layer's output as written, so a colour the inner layer changed reaches the outer one already rounded to the output's depth, and stays written as that even where the outer one moves it back.
