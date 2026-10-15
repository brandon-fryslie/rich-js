---
exampleContext: |
  const tags = [
    "typescript", "terminal", "ansi", "powerline", "layout", "tui", "cli",
    "colour", "markup", "tables", "panels", "trees", "progress", "live", "widgets",
  ];
---

# Strip + Joiner

A `Strip` lays out a horizontal sequence of styled items where the **transition between adjacent items is itself a stylable renderable** whose appearance is a function of its left and right neighbours' styles.

This pattern shows up everywhere in terminal UIs and was previously hand-rolled per project: powerline arrows, capsule pills, tab strips, breadcrumbs, gradient bars, diff transitions. `Strip` names the abstraction and makes the *join* a first-class object.

## The shape

```js
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
import { Console, Strip, RichText, POWERLINE_JOINER, Style } from "@promptctl/rich-js";

const console = new Console();

const cell = (text: string, style: string) =>
  new RichText(text, { style: Style.parse(style), end: "", noWrap: true });

const strip = new Strip(
  [
    cell(" main ", "#ffffff on #2563eb"),
    cell(" claude.ai ", "#ffffff on #0891b2"),
    cell(" 3.4k tok ", "#ffffff on #16a34a"),
  ],
  POWERLINE_JOINER,
);

console.print(strip);
```

The arrow between two cells takes its fg from the left cell's right-edge background and its bg from the right cell's left-edge background. The strip opens with a lead cap in the first cell's colour and closes with a tail cap in the last cell's, each with no bg of its own. The lead is a notch cut into the first cell — as if an arrow before it pointed in — rather than a shape pointing out, and the tail is the arrow pointing on out, so a run reads as one chevron from end to end. Swap the joiner — the strip restyles with no other code change.

`noWrap: true` is the option doing the work here: without it, a cell wider than the console wraps across lines and takes the strip's layout with it. `end: ""` declares that the cell contributes no line terminator of its own — without it, a cell's default `end` would draw a trailing `"\n"` into the middle of the strip's single line, breaking the layout it is meant to hold together.

The strip itself ends its own line, the same way [`Group`](./group)'s other children — `Panel`, `Rule`, `Table` — already do: a `Strip` printed twice, or placed before another renderable in a `Group`, does not run into what follows it.

It measures as the one row it draws, and since that row never wraps, its width is both its minimum and its maximum. A `Table` cell, an `Align` or a `Columns` holding a strip sizes it to that row: not to all the width it was offered, and never narrower than the row, which would crop off its last items.

## One joiner, many shapes

Every built-in joiner is a `CellJoiner`, and what tells them apart is data: a `JoinShape` naming the cells drawn at each kind of join.

- `seam` — between two neighbours.
- `divider` — in the seam's place where the two neighbours' backgrounds are drawn as one colour (below). It has the width of the seam.
- `lead` — where a run is entered from nothing.
- `tail` — where a run leaves into nothing.

A cell's `glyph` is a string, or `{ oneOf: [...] }`: a set of same-width glyphs, any of which may stand in the cell. Which one stands is picked from the join's place in the strip, so it holds still from frame to frame while the items before it stay put, and differs between seams, even seams between the same two colours.

A `JoinCell` is a glyph and the two colours it is drawn in, `fg` and `bg`. Each colour is one of:

- `{ edge: "left" | "right", part: "bg" | "fg" }` — a neighbour's background or text colour, at the column facing the join;
- `{ role: name }` — the foreground colour of a style name, resolved against the render's [theme](./style#style-themes);
- `{ mix: [a, b, t] }` — `a` and `b` blended at `t`;
- `"ground"` — the terminal's own background.

Nobody knows the colour of `"ground"`, so it is never mixed, and a cell may put it on one side only. As a `bg` it leaves the terminal's background showing. As an `fg` the cell is drawn in reverse video (SGR 7), filled with its `bg` colour while the glyph's ink shows the terminal's background. So an inverted shape is the same glyph drawn the other way round, never a glyph of its own.

A shape is checked once, when the joiner is built, and the constructor throws on any of these:

- a cell with `"ground"` on both sides, or inside a `mix`;
- a `lead` naming the `left` neighbour, or a `tail` naming the `right` one;
- a `oneOf` glyph whose members differ in width;
- a `divider` whose width differs from the `seam`'s;
- a non-ASCII glyph in the `ascii` shape.

The second argument is the `ascii` shape, drawn instead when the output is [ASCII-only](./console).

```typescript
import { CellJoiner, POWERLINE_JOINER, type JoinShape } from "@promptctl/rich-js";

// The powerline shape with the slant glyph wherever the arrow stood.
const slant: JoinShape = {
  seam: [{ glyph: "\ue0bc", fg: { edge: "left", part: "bg" }, bg: { edge: "right", part: "bg" } }],
  divider: [{ glyph: "\ue0bd", fg: { edge: "left", part: "fg" }, bg: { edge: "left", part: "bg" } }],
  lead: [{ glyph: "\ue0bc", fg: "ground", bg: { edge: "right", part: "bg" } }],
  tail: [{ glyph: "\ue0bc", fg: { edge: "left", part: "bg" }, bg: "ground" }],
};

console.print(
  new Strip(
    [cell(" build ", "#083344 on #22d3ee"), cell(" test ", "#4a044e on #e879f9")],
    new CellJoiner(slant, POWERLINE_JOINER.ascii),
  ),
);
```

### Which part a join draws

Each join looks at its two neighbours. A neighbour is missing at the strip's ends. It also counts as missing when any part of the shape paints with its background and it has none to paint: no `bgcolor`, or `… on default`, which is the transparent terminal default.

- Both present: the `seam`, or the `divider` where the two backgrounds are indistinct.
- Only the right: the `lead`.
- Only the left: the `tail`.
- Neither: nothing.

So a coloured run is capped the same way wherever it sits. A colourless item before a coloured one leads the coloured run in, exactly as the strip's start does. A coloured item before a colourless one tails out, and two colourless neighbours join with nothing. A shape that paints with neither neighbour's background, like `PLAIN_JOINER`, joins colourless items too.

"Indistinct" is perceptual: two backgrounds closer than `SEAM_MIN_DELTA_E` (ΔE_OK 0.04) are one. They are measured as drawn. A translucent background is flattened onto the render substrate, then rounded to the depth the render encodes at (`RenderOptions.colorSystem`), so two backgrounds that 256 colours or ANSI draw as one entry are indistinct, however far apart they were computed. Named or indexed colours have no RGB value to measure, so two of them are one only when they are the same palette slot, however it is spelled (`red` and `color(1)` are one slot).

A neighbour's background is read as drawn too, flattened onto the render substrate, so a cell painted in it continues that neighbour rather than compositing a second time over whatever the cell sits on.

## Built-in joiners

### `POWERLINE_JOINER`

Powerline arrows: U+E0B0 in the left background over the right, and U+E0B1, the thin arrow, as the divider in the left item's text colour on its own background. The divider is the vim-airline convention, and it reads exactly as well as that item's text does. The lead is U+E0B0 with `"ground"` as its `fg`, a notch whose base is the cell's left edge. Its ink is the terminal's background colour, drawn opaque, so a terminal with a translucent background shows the notch as a solid patch of that colour. The tail is the arrow over the terminal's background. ASCII draws `>` and opens each run flat.

```typescript
console.print(
  new Strip(
    [
      cell(" ~/code ", "#dbeafe on #2563eb"),
      cell(" rich-js ", "bold #ffffff on #2563eb"),
      cell(" master ", "#052e16 on #4ade80"),
      cell(" ✎ 2 ", "#422006 on #facc15"),
    ],
    POWERLINE_JOINER,
  ),
);
```

The first two cells above share a background, so the seam between them is the divider. The other two seams are arrows.

```typescript
console.print(
  new Strip(
    [
      cell(" ✔ build ", "#052e16 on #4ade80"),
      cell(" then ", "italic"),
      cell(" ✘ deploy ", "#ffffff on #dc2626"),
    ],
    POWERLINE_JOINER,
  ),
);
```

### `CAPSULE_JOINER`

Rounded pills. Each run is opened by U+E0B6 and closed by U+E0B4, both in its background over the terminal's, with a space between pills. ASCII draws `(` and `)`.

```typescript
console.print(
  new Strip(
    [
      cell("rust", "black on #f74c00"),
      cell("go", "black on #00add8"),
      cell("zig", "black on #f7a41d"),
    ],
    CAPSULE_JOINER,
  ),
);
```

### `PLAIN_JOINER`

` | ` between every pair of items, in the theme's `strip.separator` colour (`bright_black` by default), and nothing at the ends.

```typescript
console.print(
  new Strip(
    [cell("docs", "#38bdf8"), cell("guide", "#38bdf8"), cell("strip.md", "bold #f59e0b")],
    PLAIN_JOINER,
  ),
);
```

### `gradientJoiner(steps)`

Interpolates colours between adjacent items' backgrounds. Useful for fade transitions, bandwidth meters, and decorative bars.

```typescript
console.print(
  new Strip(
    [
      cell(" cold ", "bold #ffffff on #1d4ed8"),
      cell(" warm ", "bold #ffffff on #a21caf"),
      cell(" hot ", "bold #ffffff on #dc2626"),
    ],
    gradientJoiner(4),
  ),
);
```

- The seam is `steps` cells (4 by default), each the half-block glyph `▌` (U+258C), so one cell carries **two** colour samples: `fg` for the left half and `bg` for the right. `steps` cells therefore produce `2 × steps` samples between the two anchors, doubling the perceived smoothness compared with one colour per cell at the same width. ASCII draws a space, keeping only the backgrounds.
- Every sample is a `mix`, taken at a midpoint, so no sample ever equals either anchor.
- Endpoints, and items whose `bgcolor` is absent or `default`, render empty, because a gradient needs two colours to ramp between.
- A named background (`blue`, `color(4)`) is the terminal theme's own shade, so each sample is a `blend(…)` colour of the two anchors rather than a fixed RGB. An export under a theme draws the ramp from that theme's `blue` to its `red`, the shades the anchors themselves are drawn in. A live terminal is sent the standard-table RGB, because a render cannot know the terminal's palette.
- Best on truecolor. On 256-colour terminals the colour-system downgrade still works, but adjacent samples quantize to the same palette index, so neighbouring half-cells collapse into one colour and the gradient visibly stripes.

## Custom joiners

A shape covers any join drawn as a fixed run of cells. Underneath it, a joiner is a pure function `(leftItem | null, rightItem | null, { index }) -> Renderable`, and implementing that interface defines a joiner no shape can express. `index` counts joins from the strip's start: the join before item `i` is `i`, and the end after the last of `n` items is `n`. Where a `FlexStrip` wraps, the end cap and the next line's lead both carry the index of the seam they replace, so every seam keeps its index however the strip wraps.

```typescript
import type { Joiner, Renderable, RenderOptions, StyledRenderable } from "@promptctl/rich-js";

// One cell split down the middle: its left half in the left item's
// background, its right half in the right item's.
class SplitJoiner<T extends StyledRenderable> implements Joiner<T> {
  join(left: T | null, right: T | null): Renderable {
    return {
      *render(options: RenderOptions) {
        const from = left?.edgeStyle("right", options).bgcolor;
        const to = right?.edgeStyle("left", options).bgcolor;
        if (from === undefined || to === undefined) return; // endpoints stay empty
        yield new Segment("▌", new Style({ color: from, bgcolor: to }));
      },
    };
  }
}

console.print(
  new Strip(
    [cell(" one ", "#422006 on #facc15"), cell(" two ", "#052e16 on #4ade80"), cell(" three ", "#083344 on #22d3ee")],
    new SplitJoiner(),
  ),
);
```

Items in a Strip implement `StyledRenderable` — a `Renderable` plus `edgeStyle(side: "left" | "right", options: RenderOptions): Style`, which reports the style of the item's leftmost or rightmost cell column. It takes the render's options because an edge's style may be a [theme](./style#style-themes) name, and only the render knows which theme it is drawing for. So a joiner reads edges inside the `render` of the renderable it returns, as `SplitJoiner` does, and never in `join`. `RichText` implements `StyledRenderable` directly; consumers with richer items can implement the interface themselves.

## Edge styles are the protocol

Joiners read only the two edge columns. `POWERLINE_JOINER` between items `L` and `R`, rendered with `options`, paints its arrow with:

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
status.stylize("bright_green", 6, 7);   // "S"
status.stylize("bright_green", 8, 10);  // "+3"
status.stylize("bright_red",   11, 13); // "-2"

console.print(new Strip([status, cell(" rich-js ", "#ffffff on #9333ea")], POWERLINE_JOINER));
```

The cell's left and right edges both report `white on blue` (the base style), so the powerline arrows on either side stay consistent. The `S`/`+3`/`-2` runs in the interior have their own fg without touching the joiner.

### When the two edges differ

If the leftmost and rightmost columns of a cell carry different backgrounds (e.g. a gradient cell, or a cell whose first or last character has a span that overrides `bgcolor`), the joiner on each side picks up that edge's actual bg. This is by design — the join meets the column it visually abuts. Nothing requires a cell's background to be uniform: each item reports what its edges actually look like, and the joiner adapts.

## Why this is a primitive

- **The join is a pure function.** Trivial to unit-test in isolation, trivial to compose. Powerline-vs-capsule is one value swapped for another.
- **Endpoints are explicit.** `join(null, X, …)` and `join(X, null, …)` are first-class positions — no special-casing the first/last segment after the fact.
- **Edge-painter on a path graph.** The strip is a path, items are vertices, joiners paint edges — a clean shape that generalises to any "look at my neighbour's style" pattern.

## `FlexStrip` — wrap-to-width packing

`FlexStrip` packs styled items into as many fit on a line and breaks to the next, like CSS `flex-wrap`. It uses the same `Joiner` protocol — every line is its own sub-strip, so a line break is just a pair of endpoints.

```typescript
import { FlexStrip, RichText, POWERLINE_JOINER, Style } from "@promptctl/rich-js";

const strip = new FlexStrip(
  tags.map(
    (t, i) =>
      new RichText(` ${t} `, {
        style: Style.parse(i % 2 === 0 ? "#ffffff on #2563eb" : "#ffffff on #9333ea"),
        end: "",
        noWrap: true,
      }),
  ),
  { joiner: POWERLINE_JOINER, gap: 0, align: "left" },
);
console.print(strip);
```

Options:
- `joiner` — same `Joiner<T>` protocol; endpoint joins fire at every line boundary. Optional: with no joiner, nothing is drawn between items but the gap.
- `gap` — cells inserted on *each* side of the slot between two items, so neighbours sit `2 × gap` cells apart plus whatever the joiner draws (default 0). The gap applies whether or not there is a joiner — `{ gap: 1 }` alone puts two spaces between items.
- `align` — `"left"` (default), `"center"`, `"right"`, or `"justify"` (distributes spare width across inter-item slots on non-final lines).

If an item is wider than `maxWidth`, it gets its own line, drawn at whatever width the item renders to — graceful overflow rather than a hard crash. A `noWrap` cell cuts itself at `maxWidth` by its `overflow` method. A cell with `overflow: "ignore"` renders at full width, and `console.print(strip)` then [crops](./console#cropping) that line at the console width, as it does every line it prints; pass `{ crop: false }` to keep the item whole.

## Out of scope

- Vertical strips (column layouts) — same pattern transposed; defer until a use case shows up.
- Animation / live-update joiners — the strip is a layout primitive, not a temporal one.
