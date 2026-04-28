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

The arrow between two cells inherits `fg = left.bgcolor` and `bg = right.bgcolor`. The first arrow has fg = the first cell's bg with no bg. The last arrow has fg = the last cell's bg with no bg. Swap the joiner — the strip restyles with no other code change.

## Built-in joiners

### `PowerlineJoiner`

Classic powerline arrows.

```typescript
new PowerlineJoiner({ glyph: "\ue0b0" });
```

- `join(null, R)`: glyph with `fg = R.bg`, no bg.
- `join(L, null)`: glyph with `fg = L.bg`, no bg.
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

## Out of scope

- Vertical strips (column layouts) — same pattern transposed; defer until a use case shows up.
- Animation / live-update joiners — the strip is a layout primitive, not a temporal one.
