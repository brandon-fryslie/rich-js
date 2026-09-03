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

Implement both interfaces together for a fully composable renderable. Clamp both ends of the range to `options.maxWidth` — a fixed range ignores the space the parent actually has, and once the offer drops below the minimum you report, you are claiming to need more than you can use:

```typescript
class MyWidget implements Renderable, Measurable {
  measure(options: RenderOptions): Measurement {
    return new Measurement(
      Math.min(10, options.maxWidth),
      Math.min(40, options.maxWidth),
    );
  }

  *render(options: RenderOptions): Iterable<Renderable> {
    // render within the same cell count
  }
}
```

## The width contract

`options.maxWidth` is a count of terminal cells — the widest line the renderable may occupy. Every line you emit must fit inside it. A renderable that overruns its width corrupts the layout of whatever contains it, and the parent has no chance to correct it afterwards.

`maxWidth` is typed `number`, and a custom renderable receives whatever the caller wrote, so read it as a count rather than assuming a clean integer. A negative width and `NaN` both mean zero cells; a fractional width is floored, so 10.5 is ten cells and the half is never drawn. Zero is a real request — render an empty line, not your natural width. `Infinity` is not a supported width; pass a concrete cell count instead.

`measure` answers the same question in advance, so its answer carries the same ceiling: `minimum <= maximum <= options.maxWidth`. Parent layouts divide space from the range you return, so a minimum above your own maximum leaves them nothing they can honour.
