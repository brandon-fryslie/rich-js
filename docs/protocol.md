# Renderable Protocol

Any object can opt into rich formatting by implementing the `Renderable` interface. When `Console` encounters such an object in `print()` or `log()`, it calls its `render` method instead of converting it to a plain string. Use this to build custom terminal components.

## The render protocol

A renderable has one method, `render`, which is handed the space it may draw in and yields the `Segment`s that draw it. It rarely builds those segments by hand: to show markup, a `Table`, a `Panel` or any other renderable inside yours, render the child with the options you were given and yield what it yields with `yield*`:

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { ROUNDED, Segment, Table, renderMarkup } from "@promptctl/rich-js";

class UserReport implements Renderable {
  constructor(private users: Array<{ name: string; score: number }>) {}

  *render(options: RenderOptions): Iterable<Segment> {
    yield* renderMarkup(`[bold magenta]User Report[/] [dim]width: ${options.maxWidth}[/]`).render(options);

    const table = new Table({ box: ROUNDED, borderStyle: "blue" });
    table.addColumn("Name");
    table.addColumn("Score", { justify: "right" });
    for (const user of this.users) {
      table.addRow(`[cyan]${user.name}`, `[bold green]${user.score}`);
    }
    yield* table.render(options);

    yield* renderMarkup(`[dim italic]${this.users.length} users total[/]`).render(options);
  }
}

console.print(new UserReport([
  { name: "Alice", score: 98 },
  { name: "Bob",   score: 87 },
]));
```

The `render` method:
- Receives `RenderOptions` with `maxWidth` and other context, including `colorSystem`, the depth the output will be encoded at, for a renderable that decides on the colours the terminal will draw
- Returns an iterable of `Segment`s — a generator is recommended
- Draws a child renderable (markup rendered with `renderMarkup`, a `Table`, a `Panel`, another custom renderable) by passing it `options` and yielding its segments with `yield*`

## Low-level rendering

The segments do not have to come from a child. For complete character-level control, build them yourself — each `Segment` is a text string paired with an optional style:

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Segment, Style } from "@promptctl/rich-js";

class Checkerboard implements Renderable {
  constructor(private rows: number, private cols: number) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const dark  = Style.parse("on blue");
    const light = Style.parse("on white");

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const style = (r + c) % 2 === 0 ? dark : light;
        yield new Segment("  ", style);
      }
      yield new Segment("\n");
    }
  }
}

console.print(new Checkerboard(4, 8));
```

This bypasses higher-level layout and is only needed for precise character-level control.

### Drawing with theme names

`options.theme` is the `Theme` of the console doing the printing. It is absent when nothing supplied one — a `renderToString` call given no `theme`, say — and then the built-in names apply. A `Segment` takes a `Style` that is already resolved, so to draw with a name — a built-in like `repr.number`, or one the user's theme adds — resolve it with `getStyle`, passing it the options you were given. The options are how the name reaches the theme:

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Console, Segment, Theme, getStyle } from "@promptctl/rich-js";

class Health implements Renderable {
  constructor(private up: boolean) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const style = getStyle(options, this.up ? "health.up" : "health.down");
    yield new Segment(this.up ? "● up" : "● down", style);
  }
}

const console = new Console({
  theme: new Theme({ "health.up": "bold green", "health.down": "bold red" }),
});
console.print(new Health(true), new Health(false));
```

`getStyle` also takes a style definition such as `"bold red"`, so a renderable can accept either from its caller the way `Panel`'s `borderStyle` does. A string that is neither a name in the theme nor a definition throws `StyleSyntaxError`. A `RichText` is the forgiving alternative: rendered with your options, it resolves a name the same way and draws one it cannot find as plain text.

## Measuring renderables

Components like `Table` need to know how wide a renderable is before they can compute column widths. If you embed a custom renderable inside a `Table` or `Layout`, it must declare its width range by implementing `Measurable`:

```typescript
import type { Measurable, Renderable, RenderOptions } from "@promptctl/rich-js";
import { Measurement, Segment, Style, Table } from "@promptctl/rich-js";

class ChessBoard implements Renderable, Measurable {
  // Eight squares of two cells each: always exactly 16 cells wide
  measure(_options: RenderOptions): Measurement {
    return new Measurement(16, 16); // minimum = maximum = 16
  }

  *render(_options: RenderOptions): Iterable<Segment> {
    const light = Style.parse("on yellow");
    const dark = Style.parse("on red");
    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        yield new Segment("  ", (rank + file) % 2 === 0 ? light : dark);
      }
      yield Segment.line();
    }
  }
}

const games = new Table({ borderStyle: "magenta" });
games.addColumn("Board");
games.addColumn("Game");
games.addRow(new ChessBoard(), "[bold cyan]Opening position[/] [dim]white to move[/]");
console.print(games);
```

`Measurement` takes `(minimum, maximum)`:
- **minimum** — the smallest the content can render without loss (e.g. longest single word)
- **maximum** — its natural/ideal width when unconstrained

::: warning Required for Table/Layout use
Without `measure()`, a custom renderable inside a `Table` column or `Layout` region cannot be sized correctly. The table won't know how much space to allocate to it.
:::

Implement both interfaces together for a fully composable renderable. Each method parses the width first, and they parse it differently: `measure` is asked what your content wants, so it uses `withCellWidth` and clamps its own answer to the offer; `render` is asked to draw, so it uses `withBoundedWidth`, which calls your `measure` when the offer has no upper bound. Report a range derived from your content — a fixed range ignores the space the parent actually has, and once the offer drops below the minimum you report, you are claiming to need more than you can use:

```typescript
import type { Renderable, Measurable, RenderOptions } from "@promptctl/rich-js";
import {
  Measurement,
  Panel,
  RichText,
  Segment,
  cellLen,
  withBoundedWidth,
  withCellWidth,
} from "@promptctl/rich-js";

class MyWidget implements Renderable, Measurable {
  constructor(private readonly lines: string[]) {}

  measure(rawOptions: RenderOptions): Measurement {
    const { maxWidth } = withCellWidth(rawOptions);
    // Accumulated, not spread: `Math.max(0, ...lines.map(cellLen))` passes one
    // argument per line, and a widget backed by a large enough array — a log
    // viewer, a file preview — overruns the engine's argument limit and throws
    // out of `measure()`. Every built-in that maxes over a collection loops.
    let natural = 0;
    for (const line of this.lines) natural = Math.max(natural, cellLen(line));
    const maximum = Math.min(natural, maxWidth);
    // The floor comes off the ceiling, not off the offer: with no lines yet,
    // `Math.min(1, maxWidth)` would be a minimum of 1 above a maximum of 0.
    return new Measurement(Math.min(1, maximum), maximum);
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    // Render within options.maxWidth cells, and pass `options` — not
    // `rawOptions` — to anything you render inside yourself.
    yield* new RichText(this.lines.join("\n"), { style: "cyan" }).render(options);
  }
}

// A panel that fits its content draws its frame at the width `measure` reports.
console.print(new Panel(new MyWidget(["measured from its content,", "so the frame fits it"]), {
  expand: false,
  title: "MyWidget",
  borderStyle: "green",
}));
```

`withBoundedWidth` belongs at the top of `render` and never at the top of `measure`: it asks `measure` for the natural width, so calling it from there would ask the question with itself.

## The width contract

`options.maxWidth` is a count of terminal cells — the widest line the renderable may occupy. Every line you emit must fit inside it. A renderable that overruns its width corrupts the layout of whatever contains it, and the parent has no chance to correct it afterwards.

`maxWidth` is typed `number`, and a custom renderable receives whatever the caller wrote, so read it as a count rather than assuming a clean integer. A negative width and `NaN` both mean zero cells; a fractional width is floored, so 10.5 is ten cells and the half is never drawn. Zero is a real request — render an empty line, not your natural width.

`withCellWidth` is that rule, and calling it is how you get the answer rather than reimplementing it. It returns the options with `maxWidth` replaced, which is the reason it hands back options rather than a number: the raw value would otherwise stay in the object you forward to a child renderable or to `Measurement.get`, and be re-read there. Every built-in `measure()` begins this way, and every built-in `render()` begins with `withBoundedWidth`, which is the same parse plus the answer to an unbounded offer.

Nothing calls it for you. `render()` is public, so your renderable is reachable directly — `renderToString(widget, { width: userValue })` passes `userValue` through untouched — and a renderable one layer up cannot parse on your behalf.

`Infinity` is the one value `withCellWidth` leaves alone, because flooring has nothing to say about it. **An unbounded width means "render at your natural width"** — the width your content wants when nothing constrains it, which is exactly the `maximum` your own `measure` reports. `withBoundedWidth` is that rule: it parses like `withCellWidth`, then resolves an unbounded offer by asking the renderable you hand it.

That answer has to come from the renderable, which is why it is a second function rather than a clamp inside the first. There is no number `withCellWidth` could substitute from the offer alone: a magic finite default silently draws the wrong width, and `MAX_SAFE_INTEGER` is not a width you can draw at all.

A renderable whose content cannot measure itself has no natural width to fall back on, and `withBoundedWidth` throws a `RangeError` saying so. That is the honest outcome — an unbounded offer around unmeasurable content has no right answer, and the alternatives are to lose the content silently or to guess. Render at a finite width, or give the content a `measure()`.

`measure` answers the same question in advance, so its answer carries the same ceiling: `minimum <= maximum <= options.maxWidth`. Parent layouts divide space from the range you return, so a minimum above your own maximum leaves them nothing they can honour — and a `maximum` of "whatever I was offered" is the other failure, less obvious and just as costly. It tells every parent you want all the space there is, so a `Panel` in fit mode draws its frame at the full console width around your four cells of content, and an unbounded offer comes back unbounded.

## The height contract

`options.height` is the vertical budget, and unlike `maxWidth` it may be absent: a renderable rendered to a string, or inside a `Table` cell, has no rows to answer to. When it is present it is a `Height` — a count of `rows`, and whether those rows are a region or a ceiling.

A **ceiling** (`exact: false`) is what `console.print` and an inline `Live` hand you: the terminal's rows. Draw at your natural height beneath it. Nothing pads up to a ceiling, and output taller than it is the setter's to handle: an inline `Live` applies its `verticalOverflow`, and a print lets the terminal scroll it.

A **region** (`exact: true`) is what a `Layout` pane or an alternate-screen `Live` hands you: the output will be exactly `rows` tall. You may fill it — a log showing its newest lines, a chart stretching to the bottom — or ignore it and draw your natural height. Either way you do not pad or crop yourself to it: whoever set the region shapes what comes back.

Four functions carry the rules, so a renderable that composes children calls them rather than doing the arithmetic:

- `regionRows(height)` — the rows to fill, or `undefined` when there is no region.
- `insetHeight(height, rows)` — the budget for the one child filling your space, less the `rows` you draw yourself.
- `stackedHeight(height)` — the budget for each of several children stacked down your space: your rows as a ceiling, so no one of them claims the whole region.
- `fitHeight(lines, height)` — lines held to a region, padded or cropped; left alone for anything else. Call it on what comes back from a child whose region you set.

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Layout, Panel, Segment, Style, fitHeight, insetHeight } from "@promptctl/rich-js";

// A title row, and a body in the rows it leaves.
class Titled implements Renderable {
  constructor(private title: string, private body: Renderable) {}

  *render(options: RenderOptions): Iterable<Segment> {
    yield new Segment(this.title, Style.parse("bold magenta"));
    yield Segment.line();
    const height = insetHeight(options.height, 1);
    const lines = Segment.splitLines(this.body.render({ ...options, height }));
    for (const line of fitHeight(lines, height)) {
      yield* line;
      yield Segment.line();
    }
  }
}

// Two panels side by side, under a title, in a pane six rows tall.
const stages = new Layout();
stages.splitRow(
  new Layout(new Panel("[green]✓[/] compiled", { borderStyle: "green" })),
  new Layout(new Panel("[yellow]…[/] testing", { borderStyle: "yellow" })),
);
const screen = new Layout();
screen.splitColumn(new Layout(new Titled("Build", stages), { size: 6 }));
console.print(screen);
```

The pane is a region of six rows: the title takes one, and the panels below it stretch to fill the five that are left. Forward the budget unchanged and a `Layout` inside `Titled` fills the whole region, one row too tall, and the crop above takes its last row. The doc comment on `Height` in the source is the authority on these rules.
