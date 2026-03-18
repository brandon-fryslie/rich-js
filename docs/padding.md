# Padding

`Padding` adds whitespace around any renderable.

## Basic usage

Pass a single value to apply equal padding on all four sides:

```typescript
import { Console, Padding } from "rich-js";

const console = new Console();

console.print(new Padding("Hello!", 1));
```

```

 Hello!

```

## Granular padding

Follows CSS padding conventions:

```typescript
// Single value — all sides
new Padding("Hello!", 1)

// 2-tuple — [top/bottom, left/right]
new Padding("Hello!", [1, 4])

// 4-tuple — [top, right, bottom, left]
new Padding("Hello!", [1, 4, 2, 8])
```

## Style and expansion

Apply a background color across the padded area:

```typescript
console.print(new Padding("[bold]Important[/bold]", [1, 4], { style: "on dark_blue" }));
```

Prevent the padding from stretching to the terminal width:

```typescript
console.print(new Padding("Tight fit", 1, { expand: false }));
```

## Usage in other renderables

`Padding` can be placed anywhere a renderable is accepted — for example, as a table cell for visual emphasis:

```typescript
table.addRow(
  new Padding("[bold green]Active[/bold green]", [0, 2]),
  "Alice",
);
```
