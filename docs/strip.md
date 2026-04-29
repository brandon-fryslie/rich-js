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
import { Console, Strip, StripCell, PowerlineJoiner, Style } from "rich-js";

const console = new Console();

const strip = new Strip(
  [
    new StripCell(" main ", Style.parse("white on blue")),
    new StripCell(" claude.ai ", Style.parse("white on cyan")),
    new StripCell(" 3.4k tok ", Style.parse("white on green")),
  ],
  new PowerlineJoiner(), // default glyph: U+E0B0 ()
);

console.print(strip);
```

The arrow between two cells inherits `fg = left.bgcolor` and `bg = right.bgcolor`. The strip starts cleanly (no leading arrow); the last arrow has fg = the last cell's bg with no bg, bleeding out into the terminal. Swap the joiner — the strip restyles with no other code change.

## Built-in joiners

### `PowerlineJoiner`

Classic powerline arrows.

```typescript
new PowerlineJoiner({ glyph: "\ue0b0" });
```

- `join(null, R)`: empty. A right-pointing arrow with no source segment to its left has nothing to bleed out *from*, so the strip just begins cleanly. Matches vim-airline / tmux-powerline / claude-powerline.
- `join(L, null)`: glyph with `fg = L.bg`, no bg — last segment bleeds out into the terminal.
- `join(L, R)`: glyph with `fg = L.bg`, `bg = R.bg`.

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
- Truecolor terminals only: on 256-colour terminals the half-block dithering quantizes adjacent samples to the same palette index and visibly stripes. The existing colour-system downgrade still works, it just looks rougher.

## Custom joiners

A joiner is a pure function `(leftItem | null, rightItem | null) -> Renderable`. Implement the interface to define your own:

```typescript
import { Joiner, StyledRenderable, Renderable } from "rich-js";

class FadeJoiner<T extends StyledRenderable> implements Joiner<T> {
  join(left: T | null, right: T | null): Renderable {
    // ...interpolate between left.style.bgcolor and right.style.bgcolor...
  }
}
```

Items in a Strip implement `StyledRenderable` — a `Renderable` plus a single `style: Style` the joiner reads. `StripCell` is the simplest implementation; consumers with richer items can implement the interface directly.

## Why this is a primitive

- **The join is a pure function.** Trivial to unit-test in isolation, trivial to compose. Powerline-vs-capsule is one constructor swap.
- **Endpoints are explicit.** `join(null, X)` and `join(X, null)` are first-class positions — no special-casing the first/last segment after the fact.
- **Edge-painter on a path graph.** The strip is a path, items are vertices, joiners paint edges — a clean shape that generalises to any "look at my neighbour's style" pattern.

## `FlexStrip` — wrap-to-width packing

`FlexStrip` packs styled items into as many fit on a line and breaks to the next, like CSS `flex-wrap`. It uses the same `Joiner` protocol — every line is its own sub-strip, so a line break is just a pair of endpoints.

```typescript
import { FlexStrip, StripCell, PowerlineJoiner, Style } from "rich-js";

const strip = new FlexStrip(
  tags.map((t) => new StripCell(` ${t} `, Style.parse("white on blue"))),
  { joiner: new PowerlineJoiner(), gap: 0, align: "left" },
);
console.print(strip);
```

Options:
- `joiner` — same `Joiner<T>` protocol; endpoint joins fire at every line boundary.
- `gap` — cells inserted on each side of an inter-item joiner (default 0).
- `align` — `"left"` (default), `"center"`, `"right"`, or `"justify"` (distributes spare width across inter-item slots on non-final lines).

If an item is wider than `maxWidth`, it gets its own line and renders at full width — graceful overflow rather than a hard crash. Truncation is the caller's job.

## Out of scope

- Vertical strips (column layouts) — same pattern transposed; defer until a use case shows up.
- Animation / live-update joiners — the strip is a layout primitive, not a temporal one.
