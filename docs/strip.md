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
  new PowerlineJoiner(), // default glyph: U+E0B0 ()
);

console.print(strip);
```

The arrow between two cells inherits `fg = left.edgeStyle("right").bgcolor` and `bg = right.edgeStyle("left").bgcolor`. The strip starts cleanly (no leading arrow); the last arrow has fg = the last cell's right-edge bg with no bg of its own, bleeding out into the terminal. Swap the joiner — the strip restyles with no other code change.

`noWrap: true` is the option doing the work here: without it, a cell wider than the console wraps across lines and takes the strip's layout with it. `end: ""` declares that the cell contributes no line terminator of its own — for non-empty text `RichText.render` emits none either way, so it records the intent rather than changing the output.

## Built-in joiners

### `PowerlineJoiner`

Classic powerline arrows.

```typescript
new PowerlineJoiner({ glyph: "\ue0b0" });
```

The arrow is painted *in the left neighbour's background colour*, so it is drawn only when there is one. That single rule covers all three positions:

- `join(L, R)`: glyph with `fg = L.bg`, `bg = R.bg`.
- `join(L, null)`: glyph with `fg = L.bg` and no bg — the last cell bleeds out into the terminal.
- `join(null, R)`: empty. There is no left neighbour, so there is no colour to bleed and no arrow to draw. The strip begins cleanly, matching vim-airline / tmux-powerline / claude-powerline.

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
import { Joiner, StyledRenderable, Renderable } from "@promptctl/rich-js";

class FadeJoiner<T extends StyledRenderable> implements Joiner<T> {
  join(left: T | null, right: T | null): Renderable {
    // ...interpolate between left.edgeStyle("right").bgcolor
    //                  and right.edgeStyle("left").bgcolor...
  }
}
```

Items in a Strip implement `StyledRenderable` — a `Renderable` plus `edgeStyle(side: "left" | "right"): Style` that reports the style of the item's leftmost and rightmost cell columns. `RichText` implements this directly; consumers with richer items can implement the interface themselves.

## Edge styles are the protocol

Joiners read only the two edge columns. A `PowerlineJoiner` between items `L` and `R` paints its glyph with:

- `fg = L.edgeStyle("right").bgcolor`
- `bg = R.edgeStyle("left").bgcolor`

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

If an item is wider than `maxWidth`, it gets its own line and renders at full width — graceful overflow rather than a hard crash. Truncation is the caller's job.

## Out of scope

- Vertical strips (column layouts) — same pattern transposed; defer until a use case shows up.
- Animation / live-update joiners — the strip is a layout primitive, not a temporal one.
