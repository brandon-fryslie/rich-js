# Panel

`Panel` draws a Unicode border around any content.

## Basic usage

Pass a string (markup supported) to the constructor and print it:

```typescript
import { Console, Panel } from "@promptctl/rich-js";

const console = new Console();

console.print(new Panel("[bold]Hello, World![/bold]"));
```

```
╭──────────────────────────────────────────────────────────╮
│ Hello, World!                                            │
╰──────────────────────────────────────────────────────────╯
```

Any renderable works as panel content — tables, trees, other panels, styled text, etc.

## Sizing

By default a Panel expands to the full terminal width. Use `expand: false` to shrink it to fit the content:

```typescript
console.print(new Panel("Short content", { expand: false }));
```

```
╭───────────────╮
│ Short content │
╰───────────────╯
```

The `Panel.fit()` alternative constructor is equivalent:

```typescript
console.print(Panel.fit("Short content"));
```

### Narrow widths

A Panel never emits a line wider than the width it is given, however narrow that
gets — a one-column terminal, or a `Layout` split that squeezes the panel below
its natural size. It gives up its cells in a fixed order: the two frame columns
first, then a cell of content, then the padding, and only then does content grow
again. So content stays visible down to width 3, and the padding is what
disappears on the way there:

```
width 3   width 4    width 5     width 6
╭─╮       ╭──╮       ╭───╮       ╭────╮
│h│       │ h│       │ h │       │ he │
│e│       │ e│       │ e │       │ ll │
│l│       │ l│       │ l │       │ o  │
│l│       │ l│       │ l │       ╰────╯
│o│       │ o│       │ o │
╰─╯       ╰──╯       ╰───╯
```

Width 3 is the narrowest panel that can show anything: at width 2 the two frame
columns are the whole panel, and at width 1 only the left one fits, so the panel
renders as a bare frame with no content rows.

Content that renders wider than the space it was given is cropped to the frame
rather than allowed to burst it — a `Table` at its natural width inside a
too-narrow panel loses its right-hand columns instead of soft-wrapping and
destroying the frame.

## Title and subtitle

Add text to the top or bottom border:

```typescript
console.print(new Panel(
  "Panel content here",
  {
    title:    "[bold]My Panel[/bold]",
    subtitle: "[dim]footer text[/dim]",
  }
));
```

```
╭─── My Panel ──────────────────────────────────────────────╮
│ Panel content here                                        │
╰─────────────────────────────────────────── footer text ──╯
```

Both `title` and `subtitle` support markup.

## Border style

Change the box-drawing characters by passing a box constant:

```typescript
import { ROUNDED, HEAVY, DOUBLE } from "@promptctl/rich-js";

console.print(new Panel("Content", { box: ROUNDED }));  // ╭──╮
console.print(new Panel("Content", { box: HEAVY   }));  // ┏━━┓
console.print(new Panel("Content", { box: DOUBLE  }));  // ╔══╗
```

See [Appendix: Box Styles](./tables#border-styles) for the full list.

## Padding

Add whitespace between the border and the content:

```typescript
console.print(new Panel("Content", { padding: 1 }));      // 1 on all sides
console.print(new Panel("Content", { padding: [1, 2] })); // top/bottom=1, left/right=2
```

## Style

Apply a style to the panel's border and background:

```typescript
console.print(new Panel("Warning!", {
  style:    "bold red",
  title:    "⚠ Alert",
  expand:   false,
}));
```
