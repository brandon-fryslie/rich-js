# Renderable Protocol

Any object can opt into rich formatting by implementing a known interface. When `Console` encounters such an object in `print()` or `log()`, it calls the interface instead of converting to a plain string. Use this to build custom terminal components.

## Simple customization

The simplest form: implement a method that returns another renderable. Returning a string causes it to be rendered as markup:

```typescript
import { Console } from "@promptctl/rich-js";
import type { Renderable } from "@promptctl/rich-js";

class User {
  constructor(public name: string, public role: string) {}

  richConsole(): string {
    return `[bold cyan]${this.name}[/bold cyan] [dim](${this.role})[/dim]`;
  }
}

const console = new Console();
console.print(new User("Alice", "admin"));
// Alice (admin)   — with color
```

You can return any renderable, not just strings — a `Table`, `Panel`, `Tree`, etc.

## Full render protocol

The simple form is limited to returning a single object. For multi-part output or width-responsive rendering, implement the full `Renderable` interface:

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Table } from "@promptctl/rich-js";

class UserReport implements Renderable {
  constructor(private users: Array<{ name: string; score: number }>) {}

  *render(options: RenderOptions): Iterable<Renderable> {
    yield `[bold]User Report[/bold] — width: ${options.maxWidth}`;

    const table = new Table("Name", "Score");
    for (const user of this.users) {
      table.addRow(user.name, String(user.score));
    }
    yield table;

    yield `[dim]${this.users.length} users total[/dim]`;
  }
}

console.print(new UserReport([
  { name: "Alice", score: 98 },
  { name: "Bob",   score: 87 },
]));
```

The `render` method:
- Receives `RenderOptions` with `maxWidth` and other context
- Returns an iterable of renderables — a generator is recommended
- Can yield strings, tables, panels, other renderables, or `Segment` objects

## Low-level rendering

For complete character-level control, yield `Segment` objects directly — a text string paired with an optional style:

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Segment, Style } from "@promptctl/rich-js";

class Checkerboard implements Renderable {
  constructor(private rows: number, private cols: number) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const dark  = Style.parse("on black");
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

## Measuring renderables

Components like `Table` need to know how wide a renderable is before they can compute column widths. If you embed a custom renderable inside a `Table` or `Layout`, it must declare its width range by implementing `Measurable`:

```typescript
import type { Measurable, RenderOptions } from "@promptctl/rich-js";
import { Measurement } from "@promptctl/rich-js";

class ChessBoard implements Measurable {
  // A chess board is always exactly 8×2 characters per square
  measure(options: RenderOptions): Measurement {
    return new Measurement(16, 16); // minimum = maximum = 16
  }

  *render(options: RenderOptions) {
    // ... render 8 columns × 2 chars each
  }
}
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
  Segment,
  cellLen,
  withBoundedWidth,
  withCellWidth,
} from "@promptctl/rich-js";

class MyWidget implements Renderable, Measurable {
  constructor(private readonly lines: string[]) {}

  measure(rawOptions: RenderOptions): Measurement {
    const { maxWidth } = withCellWidth(rawOptions);
    const natural = Math.max(0, ...this.lines.map(cellLen));
    const maximum = Math.min(natural, maxWidth);
    // The floor comes off the ceiling, not off the offer: with no lines yet,
    // `Math.min(1, maxWidth)` would be a minimum of 1 above a maximum of 0.
    return new Measurement(Math.min(1, maximum), maximum);
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    // render within options.maxWidth cells, and pass `options` — not
    // `rawOptions` — to anything you render inside yourself
  }
}
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
