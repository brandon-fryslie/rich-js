# Padding

`Padding` adds whitespace around any renderable.

## Basic usage

Pass a renderable and a single value to apply equal padding on all four sides. `Padding` takes a renderable, not a string, so markup goes through `renderMarkup` first. The background colour is only there to make the padding visible — [Style and expansion](#style-and-expansion) below covers it:

```typescript
import { Console, Padding, renderMarkup } from "@promptctl/rich-js";

const console = new Console();

console.print(new Padding(renderMarkup("[bold]Hello![/bold]"), 1, { style: "white on dark_blue" }));
```

## Granular padding

Follows CSS padding conventions:

```typescript
const hello = renderMarkup("[bold]Hello![/bold]");
const shown = { style: "white on dark_blue" };

// Single value — all sides
console.print(new Padding(hello, 1, shown));

// 2-tuple — [top/bottom, left/right]
console.print(new Padding(hello, [1, 4], shown));

// 4-tuple — [top, right, bottom, left]
console.print(new Padding(hello, [1, 4, 2, 8], shown));
```

## Style and expansion

Apply a background color across the padded area:

```typescript
console.print(new Padding(renderMarkup("[bold]Important[/bold]"), [1, 4], { style: "white on dark_red" }));
```

Prevent the padding from stretching to the terminal width:

```typescript
console.print(new Padding(renderMarkup("Tight fit"), 1, { style: "white on dark_green", expand: false }));
```

## Usage in other renderables

`Padding` can be placed anywhere a renderable is accepted — for example, as a table cell for visual emphasis:

```typescript
const table = new Table({ title: "Team" });
table.addColumn("Status");
table.addColumn("Name");

table.addRow(
  new Padding(renderMarkup("[bold spring_green3]Active[/bold spring_green3]"), [0, 2]),
  "Alice",
);
table.addRow(renderMarkup("[dark_orange]Away[/dark_orange]"), "Bob");

console.print(table);
```
