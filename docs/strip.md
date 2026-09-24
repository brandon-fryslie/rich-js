# Strip + Joiner

A `Strip` lays out a horizontal sequence of styled items where the **transition between adjacent items is itself a stylable renderable** whose appearance is a function of its left and right neighbours' styles.

This pattern shows up everywhere in terminal UIs and was previously hand-rolled per project: powerline arrows, capsule pills, tab strips, breadcrumbs, gradient bars, diff transitions. `Strip` names the abstraction and makes the *join* a first-class object.

## The shape

```
joiner(null, items[0]),
items[0],
joiner(items[0], items[1]),
items[1],
...,
joiner(items[N-1], null)
```

Endpoints (`null` left or right) are explicit positions in the protocol — every joiner names what an endpoint looks like rather than the strip guessing.

## Basic use

```typescript
import { Console, Strip, RichText, PowerlineJoiner, Style } from "@promptctl/rich-js";

const console = new Console();

const cell = (text: string, style: string) =>
  new RichText(text, { style: Style.parse(style), end: "", noWrap: true });

const strip = new Strip(
  [
    cell(" main ", "white on blue"),
    cell(" claude.ai ", "white on cyan"),
    cell(" 3.4k tok ", "white on green"),
  ],
  new PowerlineJoiner(), // default pair: POWERLINE_JOINER_GLYPHS
);

console.print(strip);
```

The arrow between two cells takes its fg from the left cell's right-edge background and its bg from the right cell's left-edge background. The strip starts cleanly (no leading arrow); the last arrow has fg = the last cell's right-edge bg with no bg of its own, bleeding out into the terminal. Swap the joiner — the strip restyles with no other code change.

`noWrap: true` is the option doing the work here: without it, a cell wider than the console wraps across lines and takes the strip's layout with it. `end: ""` declares that the cell contributes no line terminator of its own — without it, a cell's default `end` would draw a trailing `"\n"` into the middle of the strip's single line, breaking the layout it is meant to hold together.

The strip itself ends its own line, the same way [`Group`](./group)'s other children — `Panel`, `Rule`, `Table` — already do: a `Strip` printed twice, or placed before another renderable in a `Group`, does not run into what follows it.

## Built-in joiners

### `PowerlineJoiner`

Classic powerline arrows.

```typescript
new PowerlineJoiner(); // POWERLINE_JOINER_GLYPHS: U+E0B0 arrow, U+E0B1 divider
```

The arrow is painted *in the left neighbour's background colour*, so it is drawn only when there is one. That single rule covers all three positions:

- `join(L, R)`: glyph with `fg = L.bg` as drawn (flattened onto the render substrate, so opaque — the arrow is the left cell continuing, not composited a second time over `R`), `bg = R.bg` — or, when the two backgrounds are indistinct (below), the divider with `fg = L`'s text colour and `bg = L.bg`.
- `join(L, null)`: glyph with `fg = L.bg` and no bg — the last cell bleeds out into the terminal.
- `join(null, R)`: empty. There is no left neighbour, so there is no colour to bleed and no arrow to draw. The strip begins cleanly, matching vim-airline / tmux-powerline / claude-powerline.

When `L` and `R` share a background, the arrow would be drawn in its own background colour and vanish. The joiner draws the divider there instead (`divider`, U+E0B1 by default, the thin arrow) in `L`'s text colour on `L`'s own background, which is the vim-airline convention. The divider is therefore `L`'s text, and it reads exactly as well as that text does. "Share" is perceptual: two backgrounds closer than `SEAM_MIN_DELTA_E` (ΔE_OK 0.04) count as one. They are measured as drawn: a translucent background is flattened onto the render substrate, then rounded to the depth the render encodes at (`RenderOptions.colorSystem`). So two backgrounds that 256 colours or ANSI draw as one entry share, however far apart they were computed. Named or indexed colours have no RGB value to measure, so two of them share only when they are the same palette slot, however it is spelled (`red` and `color(1)` are one slot).

```typescript
new PowerlineJoiner({ glyph: ">", divider: "|" }); // an ASCII pair
```

`glyph` and `divider` are given together or not at all. A replacement arrow with the default divider beside it would leave a glyph the arrow's font may not have.

An item *without* a background is the same case as a missing one. If `L` has no `bgcolor`, the join to its right is empty too — so a colourless cell has no arrow after it, wherever it sits in the strip. `… on default` counts as no background: the terminal default is transparent, so there is still nothing to paint.

### `CapsuleJoiner`

Rounded pills — close the previous capsule, separator, open the next.

```typescript
new CapsuleJoiner({
  left: "\ue0b6",      // 
  right: "\ue0b4",     // 
  separator: " ",
});
```

- Start: left-cap with `fg = first.bg`.
- End: right-cap with `fg = last.bg`.
- Middle: right-cap (`fg = left.bg`) + separator + left-cap (`fg = right.bg`).

### `PlainJoiner`

A fixed separator everywhere. Endpoints are empty.

```typescript
new PlainJoiner({ separator: " | ", style: Style.parse("dim") });
```

### `GradientJoiner`

Interpolates colours between adjacent items' backgrounds. Useful for fade transitions, bandwidth meters, and decorative bars.

```typescript
new GradientJoiner({ steps: 4 });
```

- Middle: `steps` cells, each painted with the half-block glyph `▌` (U+258C) so one cell carries **two** colour samples — `fg` for the left half, `bg` for the right half. `steps` cells therefore produce `2 × steps` colour samples between the two anchors, doubling the perceived smoothness compared to one-colour-per-cell at the same width.
- All samples use midpoint sampling — no sample ever equals either anchor.
- Endpoints (or items lacking a `bgcolor`) render empty — a gradient needs two anchors.
- Best on truecolor. On 256-colour terminals the colour-system downgrade still works, but adjacent samples quantize to the same palette index — neighbouring half-cells collapse into one colour and the gradient visibly stripes.

## Custom joiners

A joiner is a pure function `(leftItem | null, rightItem | null) -> Renderable`. Implement the interface to define your own:

```typescript
import type { Joiner, Renderable, RenderOptions, StyledRenderable } from "@promptctl/rich-js";

class FadeJoiner<T extends StyledRenderable> implements Joiner<T> {
  join(left: T | null, right: T | null): Renderable {
    return {
      *render(options: RenderOptions) {
        const from = left?.edgeStyle("right", options).bgcolor;
        const to = right?.edgeStyle("left", options).bgcolor;
        // ...yield Segments interpolating between from and to...
      },
    };
  }
}
```

Items in a Strip implement `StyledRenderable` — a `Renderable` plus `edgeStyle(side: "left" | "right", options: RenderOptions): Style`, which reports the style of the item's leftmost or rightmost cell column. It takes the render's options because an edge's style may be a [theme](./style#style-themes) name, and only the render knows which theme it is drawing for. So a joiner reads edges inside the `render` of the renderable it returns, as `FadeJoiner` does, and never in `join`. `RichText` implements `StyledRenderable` directly; consumers with richer items can implement the interface themselves.

## Edge styles are the protocol

Joiners read only the two edge columns. A `PowerlineJoiner` between items `L` and `R`, rendered with `options`, paints its glyph with:

- `fg = L.edgeStyle("right", options).bgcolor`
- `bg = R.edgeStyle("left", options).bgcolor`

and, where those two backgrounds are within `SEAM_MIN_DELTA_E`, draws its divider with `fg = L.edgeStyle("right", options).color` instead.

The interior of each item is invisible to the joiner. That means a cell can vary `bgcolor`, `fgcolor`, or text attributes per column without breaking the join — only the column the joiner actually meets matters.

### Inline variation inside a cell

A single `RichText` cell can carry per-character variation through styled spans:

```typescript
const status = new RichText(
  " main S +3 -2 ",
  { style: Style.parse("white on blue"), end: "", noWrap: true },
);
status.stylize("green", 6, 7);   // "S"
status.stylize("green", 8, 10);  // "+3"
status.stylize("red",   11, 13); // "-2"
```

The cell's left and right edges both report `white on blue` (the base style), so the powerline arrows on either side stay consistent. The `S`/`+3`/`-2` runs in the interior have their own fg without touching the joiner.

### When the two edges differ

If the leftmost and rightmost columns of a cell carry different backgrounds (e.g. a gradient cell, or a cell whose first or last character has a span that overrides `bgcolor`), the joiner on each side picks up that edge's actual bg. This is by design — the join meets the column it visually abuts. Nothing requires a cell's background to be uniform: each item reports what its edges actually look like, and the joiner adapts.

## Why this is a primitive

- **The join is a pure function.** Trivial to unit-test in isolation, trivial to compose. Powerline-vs-capsule is one constructor swap.
- **Endpoints are explicit.** `join(null, X)` and `join(X, null)` are first-class positions — no special-casing the first/last segment after the fact.
- **Edge-painter on a path graph.** The strip is a path, items are vertices, joiners paint edges — a clean shape that generalises to any "look at my neighbour's style" pattern.

## `FlexStrip` — wrap-to-width packing

`FlexStrip` packs styled items into as many fit on a line and breaks to the next, like CSS `flex-wrap`. It uses the same `Joiner` protocol — every line is its own sub-strip, so a line break is just a pair of endpoints.

```typescript
import { FlexStrip, RichText, PowerlineJoiner, Style } from "@promptctl/rich-js";

const strip = new FlexStrip(
  tags.map(
    (t) =>
      new RichText(` ${t} `, {
        style: Style.parse("white on blue"),
        end: "",
        noWrap: true,
      }),
  ),
  { joiner: new PowerlineJoiner(), gap: 0, align: "left" },
);
console.print(strip);
```

Options:
- `joiner` — same `Joiner<T>` protocol; endpoint joins fire at every line boundary. Optional: with no joiner, nothing is drawn between items but the gap.
- `gap` — cells inserted on *each* side of the slot between two items, so neighbours sit `2 × gap` cells apart plus whatever the joiner draws (default 0). The gap applies whether or not there is a joiner — `{ gap: 1 }` alone puts two spaces between items.
- `align` — `"left"` (default), `"center"`, `"right"`, or `"justify"` (distributes spare width across inter-item slots on non-final lines).

If an item is wider than `maxWidth`, it gets its own line and the strip renders it at full width — graceful overflow rather than a hard crash. `console.print(strip)` then [crops](./console#cropping) that line at the console width, as it does every line it prints; pass `{ crop: false }` to keep the item whole.

## Out of scope

- Vertical strips (column layouts) — same pattern transposed; defer until a use case shows up.
- Animation / live-update joiners — the strip is a layout primitive, not a temporal one.
