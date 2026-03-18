# Panel

`Panel` draws a Unicode border around any content.

## Basic usage

Pass a string (markup supported) to the constructor and print it:

```typescript
import { Console, Panel } from "rich-js";

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
import { ROUNDED, HEAVY, DOUBLE } from "rich-js";

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
