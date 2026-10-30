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
import { Console, Strip, RichText, JOINERS, joinerNamed, Style } from "@promptctl/rich-js";

const console = new Console();

const cell = (text: string, style: string) =>
  new RichText(text, { style: Style.parse(style), end: "", noWrap: true });

const strip = new Strip(
  [
    cell(" main ", "#ffffff on #2563eb"),
    cell(" claude.ai ", "#ffffff on #0891b2"),
    cell(" 3.4k tok ", "#ffffff on #16a34a"),
  ],
  JOINERS.powerline,
);

console.print(strip);
```

The arrow between two cells takes its fg from the left cell's right-edge background and its bg from the right cell's left-edge background. The strip opens with a lead cap in the first cell's colour and closes with a tail cap in the last cell's, each with no bg of its own. The lead is a notch cut into the first cell — as if an arrow before it pointed in — rather than a shape pointing out, and the tail is the arrow pointing on out, so a run reads as one chevron from end to end. Swap the joiner — the strip restyles with no other code change.

`noWrap: true` is the option doing the work here: without it, a cell wider than the console wraps across lines and takes the strip's layout with it. `end: ""` declares that the cell contributes no line terminator of its own — without it, a cell's default `end` would draw a trailing `"\n"` into the middle of the strip's single line, breaking the layout it is meant to hold together.

The strip itself ends its own line, the same way [`Group`](./group)'s other children — `Panel`, `Rule`, `Table` — already do: a `Strip` printed twice, or placed before another renderable in a `Group`, does not run into what follows it.

It measures as the one row it draws, and since that row never wraps, its width is both its minimum and its maximum. A `Table` cell, an `Align` or a `Columns` holding a strip sizes it to that row: not to all the width it was offered, and never narrower than the row, which would crop off its last items.

## A seam and its caps

Every built-in joiner is a `CellJoiner`, and what tells them apart is data, in two halves picked independently of each other:

- a `JoinSeam`, the middle: what is drawn between two neighbours;
- a `JoinCaps`, the ends: what is drawn where a run of colour begins and ends.

Any seam ends in any caps. `SEAMS` and `CAPS` are the bundled halves by name, and `new CellJoiner(seam, caps)` puts two of them together:

```typescript
import { CAPS, CellJoiner, SEAMS } from "@promptctl/rich-js";

// prism's three stepping arrows between the cells, ended in bubble's caps.
console.print(
  new Strip(
    [cell(" src ", "black on #a78bfa"), cell(" core ", "black on #f472b6"), cell(" strip.ts ", "black on #fbbf24")],
    new CellJoiner(SEAMS.prism, CAPS.bubble),
  ),
);
```

A seam names `seam`, the cells drawn between two neighbours. The caps name two more parts:

- `lead` — where a run is entered from nothing.
- `tail` — where a run leaves into nothing.

A cell of a seam may also be `{ cap: "tail" }` or `{ cap: "lead" }`: the caps themselves standing in the seam, closing the run the seam leaves or opening the one it enters. That is how `SEAMS.capsule` parts two runs, a tail, a space and a lead, and ends each in whatever caps it is joined with: rounded with `CAPS.capsule`, arrows with `CAPS.powerline`.

Each half holds two forms, `glyph` and `ascii`, and an [ASCII-only](./console) output draws the `ascii` form of both.

A cell's `glyph` is a string, or `{ oneOf: [...] }`: a set of same-width glyphs, any of which may stand in the cell. Which one stands is picked from the join's place in the strip, so it holds still from frame to frame while the items before it stay put, and differs between seams, even seams between the same two colours.

A `JoinCell` is a glyph and the two colours it is drawn in, `fg` and `bg`. Each colour is one of:

- `{ edge: "left" | "right", part: "bg" | "fg" }` — a neighbour's background or text colour, at the column facing the join;
- `{ role: name }` — the foreground colour of a style name, resolved against the render's [theme](./style#style-themes);
- `{ mix: [a, b, t] }` — `a` and `b` blended at `t`;
- `"ground"` — the terminal's own background.

Nobody knows the colour of `"ground"`, so it is never mixed, and a cell may put it on one side only. As a `bg` it leaves the terminal's background showing. As an `fg` the cell is drawn in reverse video (SGR 7), filled with its `bg` colour while the glyph's ink shows the terminal's background. So an inverted shape is the same glyph drawn the other way round, never a glyph of its own.

A joiner is checked once, when it is built, and the constructor throws on any of these:

- a cell with `"ground"` on both sides, or inside a `mix`;
- a `lead` naming the `left` neighbour, or a `tail` naming the `right` one;
- a `oneOf` glyph whose members differ in width;
- a `cap` other than `lead` or `tail`, or a cell that names a cap and draws a glyph too;
- a non-ASCII glyph in an `ascii` form.

```typescript
import { CAPS, CellJoiner, type JoinSeam } from "@promptctl/rich-js";

// A seam the table does not bundle: two arrows meeting point to point, the
// right background reaching back into the left. Ended in powerline's caps.
const meet: JoinSeam = {
  glyph: {
    seam: [
      { glyph: "\ue0b2", fg: { edge: "right", part: "bg" }, bg: { edge: "left", part: "bg" } },
      { glyph: "\ue0b0", fg: { edge: "left", part: "bg" }, bg: { edge: "right", part: "bg" } },
    ],
  },
  ascii: {
    seam: [{ glyph: "<>", fg: { edge: "left", part: "bg" }, bg: { edge: "right", part: "bg" } }],
  },
};

console.print(
  new Strip(
    [cell(" build ", "#083344 on #22d3ee"), cell(" test ", "#4a044e on #e879f9")],
    new CellJoiner(meet, CAPS.powerline),
  ),
);
```

### Which part a join draws

Each join looks at its two neighbours. A neighbour is missing at the strip's ends. It also counts as missing when the seam paints with its background anywhere and it has none to paint: no `bgcolor`, or `… on default`, which is the transparent terminal default.

- Both present: the `seam`.
- Only the right: the `lead`, if it has the background the `lead` paints with.
- Only the left: the `tail`, if it has the background the `tail` paints with.
- Neither: nothing.

So a coloured run is capped the same way wherever it sits. A colourless item before a coloured one leads the coloured run in, exactly as the strip's start does. A coloured item before a colourless one tails out, and two colourless neighbours join with nothing. A seam that paints with neither neighbour's background, like `SEAMS.plain`, joins colourless items too, whatever caps end it.

### Every seam shows

Every cell a joiner draws holds its glyph's colour off its own background, as far as a render can see the two (below). Where the two stand less than `SEAM_MIN_DELTA_E` (ΔE_OK 0.04) apart, the glyph's colour takes the least step along its own OKLCH lightness, hue and chroma held, toward white or toward black, that clears the floor; a colour that already clears it is drawn as it is. Both are measured as drawn: flattened onto what lies beneath, then rounded to the depth the render encodes at (`RenderOptions.colorSystem`). So at 256 colours each step is measured on the table entry it draws as, and the colour a lifted glyph is given is that entry. Each cell is measured on its own, so every one of `prism`'s three arrows shows.

A colour the terminal's theme draws, a named slot such as `red` or, at truecolor, a blend reaching one, has no RGB a render can measure: the terminal decides it. Two such colours stand apart unless they are the same slot or the same blend, so at ANSI, and for a slot-coloured glyph at any depth, the floor is a different slot and the step is to the nearest other slot. A slot beside a fixed colour is drawn as it is, however alike the two look in a given theme. So is a cell on the terminal's own background, or in reverse video over it, as a cap's notch is: the terminal's background is a colour no render knows.

A neighbour's background is read as drawn too, flattened onto the render substrate, so a cell painted in it continues that neighbour rather than compositing a second time over whatever the cell sits on.

## Built-in joiners

`JOINERS` is the table of bundled joiners, by name, each a seam from `SEAMS` ended in caps from `CAPS`. Every seam in `SEAMS` has the name of the joiner it comes from, so `SEAMS.prism` is the middle of `JOINERS.prism`.

A joiner named in a consumer's config is read with `joinerNamed`. It takes a name from `JOINERS`, or a seam and caps named apart, and throws on a name its table lacks:

```typescript
// JOINERS.prism, then SEAMS.prism ended in CAPS.capsule.
for (const spec of ["prism", { seam: "prism", caps: "capsule" }] as const) {
  console.print(
    new Strip([cell(" src ", "black on #a78bfa"), cell(" core ", "black on #f472b6")], joinerNamed(spec)),
  );
}
```

### `JOINERS.powerline`

Powerline arrows: U+E0B0 in the left background over the right. The lead is U+E0B0 with `"ground"` as its `fg`, a notch whose base is the cell's left edge. Its ink is the terminal's background colour, drawn opaque, so a terminal with a translucent background shows the notch as a solid patch of that colour. The tail is the arrow over the terminal's background. ASCII draws `>` and opens each run flat.

```typescript
console.print(
  new Strip(
    [
      cell(" ~/code ", "#dbeafe on #2563eb"),
      cell(" rich-js ", "bold #ffffff on #2563eb"),
      cell(" master ", "#052e16 on #4ade80"),
      cell(" ✎ 2 ", "#422006 on #facc15"),
    ],
    JOINERS.powerline,
  ),
);
```

The first two cells above share a background, so the arrow between them is drawn in that blue a step darker, the least step that shows.

```typescript
console.print(
  new Strip(
    [
      cell(" ✔ build ", "#052e16 on #4ade80"),
      cell(" then ", "italic"),
      cell(" ✘ deploy ", "#ffffff on #dc2626"),
    ],
    JOINERS.powerline,
  ),
);
```

### `JOINERS.capsule`

Rounded pills. Each run is opened by U+E0B6 and closed by U+E0B4, both in its background over the terminal's, with a space between pills. ASCII draws `(` and `)`.

```typescript
console.print(
  new Strip(
    [
      cell("rust", "black on #f74c00"),
      cell("go", "black on #00add8"),
      cell("zig", "black on #f7a41d"),
    ],
    JOINERS.capsule,
  ),
);
```

### `JOINERS.plain`

` | ` between every pair of items, in the theme's `strip.separator` colour (`bright_black` by default), and nothing at the ends.

```typescript
console.print(
  new Strip(
    [cell("docs", "#38bdf8"), cell("guide", "#38bdf8"), cell("strip.md", "bold #f59e0b")],
    JOINERS.plain,
  ),
);
```

### The rest of the table

- `prism` — three arrows stepping through the two thirds between the backgrounds; ended in `CAPS.powerline`.
- `slant` (U+E0BC), `backslant` (U+E0B8), `flame` (U+E0C0), `pixel` (U+E0C4), `ice` (U+E0C8), `bubble` (U+E0B4) — `powerline` with their glyph, seam and caps alike.
- `wrapper` — the caps touching, ended in `CAPS.wrapper`: each run opened by U+E0B2 and closed by U+E0B0.
- `metro` — the caps with a two-cell rail between them, in the theme's `strip.rail` colour; ended in `CAPS.capsule`.
- `stitch` — a dotted rule in the left item's text colour over the midpoint of the two backgrounds; ended in `CAPS.flat`.
- `torn` — a ragged quadrant pair in the left background over that midpoint; which pair is picked per seam. Ended in `CAPS.flat`.

```typescript
for (const name of ["prism", "bubble", "metro", "torn"] as const) {
  console.print(
    new Strip(
      [cell(" src ", "black on #a78bfa"), cell(" core ", "black on #f472b6"), cell(" strip.ts ", "black on #fbbf24")],
      joinerNamed(name),
    ),
  );
}
```

### Caps

`CAPS` holds the ends, and any of them ends any seam:

- `powerline`, `slant`, `backslant`, `flame`, `pixel`, `ice`, `bubble` — the joiner's glyph reversed out of the terminal's background at the lead, a notch, and drawn over that background at the tail, so a run reads as one shape pointing the same way end to end. ASCII opens each run flat.
- `capsule` — rounded ends pointing out: U+E0B6 opens a run and U+E0B4 closes it, each in the run's background over the terminal's. ASCII draws `(` and `)`.
- `wrapper` — arrows pointing out: U+E0B2 opens and U+E0B0 closes. ASCII draws `<` and `>`.
- `flat` — nothing; a run's background ends square.

The seams that part their runs, `capsule`, `wrapper` and `metro`, draw these same caps in the middle of the strip, so the ends picked for a strip are the ends of every run in it.

```typescript
for (const [seam, caps] of [["prism", "bubble"], ["prism", "capsule"], ["capsule", "powerline"], ["torn", "wrapper"]] as const) {
  console.print(
    new Strip(
      [cell(" src ", "black on #a78bfa"), cell(" core ", "black on #f472b6"), cell(" strip.ts ", "black on #fbbf24")],
      new CellJoiner(SEAMS[seam], CAPS[caps]),
    ),
  );
}
```

### `gradientSeam(steps)`

A seam that interpolates colours between adjacent items' backgrounds. Useful for fade transitions, bandwidth meters, and decorative bars.

```typescript
console.print(
  new Strip(
    [
      cell(" cold ", "bold #ffffff on #1d4ed8"),
      cell(" warm ", "bold #ffffff on #a21caf"),
      cell(" hot ", "bold #ffffff on #dc2626"),
    ],
    new CellJoiner(gradientSeam(4), CAPS.flat),
  ),
);
```

- The seam is `steps` cells (4 by default), each filled with one colour: cell `i` is the colour `(i + ½) / steps` of the way from the left item's background to the right's, so no cell is either background. Each cell is a space with `"ground"` as its `fg`, so its one colour is its fill, and the ASCII form is the same ramp.
- No cell has ink a render can measure, so the step that holds a seam's ink off its background ([Every seam shows](#every-seam-shows)) moves none of them, and the ramp is the blend itself. It never turns back, however close the two backgrounds are and however many steps there are. Between two backgrounds alike it is that background, and the join does not show.
- A gradient needs two colours to ramp between, so beside an item whose `bgcolor` is absent or `default` the join is an endpoint, and draws the caps the ramp is ended in: nothing, with `CAPS.flat`.
- A named background (`blue`, `color(4)`) is the terminal theme's own shade, so each sample is a `blend(…)` colour of the two anchors rather than a fixed RGB. An export under a theme draws the ramp from that theme's `blue` to its `red`, the shades the anchors themselves are drawn in. A live terminal is sent the standard-table RGB, because a render cannot know the terminal's palette.
- Best on truecolor. At 256 colours each cell is drawn as its colour's nearest table entry, so neighbouring cells share an entry and the ramp draws in bands. At sixteen colours each is the nearest of the terminal's slots.

## Custom joiners

A seam and its caps cover any join drawn as fixed runs of cells. Underneath them, a joiner is a pure function `(leftItem | null, rightItem | null, { index }) -> Renderable`, and implementing that interface defines a joiner no seam and caps can express. `index` counts joins from the strip's start: the join before item `i` is `i`, and the end after the last of `n` items is `n`. Where a `FlexStrip` wraps, the end cap and the next line's lead both carry the index of the seam they replace, so every seam keeps its index however the strip wraps.

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

Every cell an item draws in a strip is stamped with that item as its owner, so an effect can pick out one item with [`confined`](./effects#one-element-of-many). A cell a `CellJoiner` paints from its neighbours is no item's: it records what it was drawn from, so under an effect it is drawn again from the item cells beside it as the effect left them, its lift included, and a seam follows its neighbours wherever an effect takes them. A cell painted from a style name alone, such as `plain`'s separator, and any other joiner's cells belong to the join alone, and an effect paints them as it paints any cell.

## Edge styles are the protocol

Joiners read only the two edge columns. `JOINERS.powerline` between items `L` and `R`, rendered with `options`, paints its arrow with:

- `fg = L.edgeStyle("right", options).bgcolor`
- `bg = R.edgeStyle("left", options).bgcolor`

and, where those two are drawn within `SEAM_MIN_DELTA_E` of each other, lifts the `fg` off the `bg` ([Every seam shows](#every-seam-shows)).

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

console.print(new Strip([status, cell(" rich-js ", "#ffffff on #9333ea")], JOINERS.powerline));
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
import { FlexStrip, RichText, JOINERS, Style } from "@promptctl/rich-js";

const strip = new FlexStrip(
  tags.map(
    (t, i) =>
      new RichText(` ${t} `, {
        style: Style.parse(i % 2 === 0 ? "#ffffff on #2563eb" : "#ffffff on #9333ea"),
        end: "",
        noWrap: true,
      }),
  ),
  { joiner: JOINERS.powerline, gap: 0, align: "left" },
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
