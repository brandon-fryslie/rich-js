# Layout

`Layout` divides the terminal into named areas that each hold an independent renderable. Use it standalone or with `Live` for full-screen applications.

## Creating a layout

An empty layout renders as a placeholder box showing its name and dimensions:

```typescript
import { Console, Layout } from "rich-js";

const console = new Console();

const layout = new Layout("root");
console.print(layout);
```

```
╭──────────────────────────── root ────────────────────────────────────╮
│                                                                      │
│                         root (120 x 40)                              │
│                                                                      │
╰──────────────────────────────────────────────────────────────────────╯
```

## Splitting

`splitColumn()` stacks sub-layouts vertically (rows). `splitRow()` places them side by side (columns):

```typescript
// Split into an upper row and a lower row
layout.splitColumn(
  new Layout("upper"),
  new Layout("lower"),
);

// Split the lower row into two panels side by side
layout["lower"].splitRow(
  new Layout("lower-left"),
  new Layout("lower-right"),
);

console.print(layout);
```

```
╭─────────────────────────── upper ────────────────────────────────────╮
│                        upper (120 x 20)                              │
╰──────────────────────────────────────────────────────────────────────╯
╭──────────── lower-left ────────────╮╭───────────── lower-right ──────╮
│       lower-left (60 x 20)         ││       lower-right (60 x 20)    │
╰────────────────────────────────────╯╰────────────────────────────────╯
```

Access sub-layouts by name with bracket syntax, then split further to build any tree of regions.

## Setting content

Two ways to assign a renderable to a region:

```typescript
// 1. Pass it to the Layout constructor
const layout = new Layout(myRenderable, { name: "main" });

// 2. Call update() on a named sub-layout
layout["upper"].update(headerPanel);
layout["lower-left"].update(logTable);
layout["lower-right"].update(statsPanel);
```

## Fixed size

Fix a sub-layout to an exact number of rows (or columns, in a row split):

```typescript
layout.splitColumn(
  new Layout("header", { size: 3 }),  // always 3 rows
  new Layout("body"),                 // takes remaining space
  new Layout("footer", { size: 1 }),  // always 1 row
);
```

Fixed layouts take their space first; remaining space is distributed among flexible layouts.

## Ratio

Control proportional space allocation:

```typescript
layout["lower"].splitRow(
  new Layout("sidebar", { ratio: 1 }), // one-third
  new Layout("main",    { ratio: 2 }), // two-thirds
);
```

A layout with `ratio: 2` alongside one with `ratio: 1` takes two-thirds of the available space.

## Minimum size

Prevent a flexible layout from shrinking below a threshold:

```typescript
new Layout("sidebar", { minimumSize: 20 })
```

## Visibility

Hide a region — neighboring regions expand to fill the vacated space:

```typescript
layout["sidebar"].visible = false;

// Re-enable it
layout["sidebar"].visible = true;
```

Use this to toggle panels based on application state.

## Debug tree

Visualize the full layout hierarchy:

```typescript
console.print(layout.tree);
```

## Layout + Live

The primary use case for `Layout` is driving a fullscreen application with `Live`:

```typescript
import { Live, Layout, Panel } from "rich-js";

const layout = new Layout();
layout.splitColumn(
  new Layout("header", { size: 3 }),
  new Layout("body"),
);

await new Live(layout, { screen: true }).run(async (live) => {
  layout["header"].update(new Panel("[bold]My App[/bold]", { expand: true }));

  while (running) {
    layout["body"].update(buildBodyContent());
    await sleep(250);
  }
});
```

See [Live Display](./live) for the complete Live API.
