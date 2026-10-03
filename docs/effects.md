# Effects

An effect changes the colours of a renderable's cells over time: a highlight sweeping through text, a pulse that brightens and dims, a fade. It is one pure function, given a cell's colours, where the cell is, and a time `t` in seconds, and returning the cell's new colours:

```typescript shape
import type { CellColors, EffectCell } from "@promptctl/rich-js";

type Effect = (colors: CellColors, cell: EffectCell, t: number) => CellColors;
```

`Effected` wraps any renderable and draws it with its cells' colours passed through an effect at one moment:

```typescript
import { ColorRgba, ColorRamp, EASES, Effected, Phase, RichText, type Effect } from "@promptctl/rich-js";

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

const defaults = { fg: new ColorRgba(204, 204, 204), bg: new ColorRgba(24, 24, 24) };
for (const t of [0, 0.5, 1]) {
  console.print(new Effected(new RichText(label), shimmer, { t, key: "thinking", defaults }));
}
```

## Time is an argument

Nothing in an effect reads a clock. Whoever draws frames builds the view for each frame's `t`, so the same `t` always draws the same output, at 30 frames a second or one every two seconds. How far along an effect is comes from the [easing and phase vocabulary](/easing): `ease(phase(t))`.

## What a cell knows

- `row` and `col` count from the top-left of what the wrapped renderable drew, so a sweep crosses the element, not the screen. A wide glyph is one cell to the effect, at the column of its first half, and is never cut.
- `seed` is a number in `[0, 1)` that stays the same for that cell on every frame, for effects that vary cell by cell. It is derived from the `key` option and the cell's position, so two elements showing the same text under different keys do not move in lockstep.
- A cell that sets no colour of its own is handed the `defaults` colours. The terminal's real foreground and background are never queried, so the caller supplies them.

## What an effect cannot change

An effect changes how cells look, never which cells exist or who drew them. Text, links, and the anchors that let a click or Tab reach a widget all pass through, so a button under an effect still takes clicks. A cell whose colours come back unchanged is drawn exactly as before: the identity effect `(colors) => colors` produces byte-identical output. Neighbouring cells given equal colours stay one segment.

With no colour output at all, an effect has nothing to change, and the wrapped renderable draws as it would without it.

Effects stack by nesting: `new Effected(new Effected(child, a, options), b, options)` draws what applying `a` and then `b` to each cell draws.
