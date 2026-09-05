# Layout

`Layout` divides the terminal into named areas that each hold an independent renderable. Use it standalone or with `Live` for full-screen applications.

## Creating a layout

A layout draws the renderable you give it and nothing else — no border, no label, no
placeholder of its own. The name is for `getByName()` lookup, not display, and a
layout with no content and no children emits nothing at all:

```typescript
import { Console, Layout, Panel } from "@promptctl/rich-js";

const console = new Console({ width: 70 });

const leaf = new Layout(new Panel("Hello, Layout", { expand: true }), { name: "root" });
console.print(leaf);
```

```
╭────────────────────────────────────────────────────────────────────╮
│ Hello, Layout                                                      │
╰────────────────────────────────────────────────────────────────────╯
```

## Splitting

`splitColumn()` stacks sub-layouts vertically (rows). `splitRow()` places them side by
side (columns). A layout that gets children stops drawing its own renderable, so a
root you intend to split starts out empty:

```typescript
const layout = new Layout(undefined, { name: "root" });

// Split into an upper row and a lower row
layout.splitColumn(
  new Layout(new Panel("header", { expand: true }), { name: "upper" }),
  new Layout(undefined, { name: "lower" }),
);

// Split the lower row into two panels side by side
layout.getByName("lower")!.splitRow(
  new Layout(new Panel("logs", { expand: true }), { name: "lower-left" }),
  new Layout(new Panel("stats", { expand: true }), { name: "lower-right" }),
);

console.print(layout);
```

```
╭────────────────────────────────────────────────────────────────────╮
│ header                                                             │
╰────────────────────────────────────────────────────────────────────╯
╭─────────────────────────────────╮╭─────────────────────────────────╮
│ logs                            ││ stats                           │
╰─────────────────────────────────╯╰─────────────────────────────────╯
```

Look sub-layouts up by name with `getByName()`, then split further to build any tree
of regions.

## Setting content

Two ways to assign a renderable to a region:

```typescript
// 1. Pass it to the Layout constructor
const pane = new Layout(myRenderable, { name: "main" });

// 2. Call update() on a named sub-layout
layout.getByName("upper")!.update(headerPanel);
layout.getByName("lower-left")!.update(logTable);
layout.getByName("lower-right")!.update(statsPanel);
```

## Fixed size

Fix a sub-layout to an exact number of rows (or columns, in a row split). Splitting
replaces a layout's children rather than adding to them, so this starts from its own
root instead of re-splitting the one above:

```typescript
const page = new Layout(undefined, { name: "page" });

page.splitColumn(
  new Layout(undefined, { name: "header", size: 3 }),  // always 3 rows
  new Layout(undefined, { name: "body" }),             // takes remaining space
  new Layout(undefined, { name: "footer", size: 1 }),  // always 1 row
);
```

Fixed layouts take their space first; remaining space is distributed among flexible layouts.

## Ratio

Control proportional space allocation:

```typescript
page.getByName("body")!.splitRow(
  new Layout(undefined, { name: "sidebar", ratio: 1 }), // one-third
  new Layout(undefined, { name: "main", ratio: 2 }), // two-thirds
);
```

A layout with `ratio: 2` alongside one with `ratio: 1` takes two-thirds of the available space.

## Minimum size

Prevent a flexible layout from shrinking below a threshold:

```typescript
new Layout(undefined, { name: "sidebar", minimumSize: 20 })
```

## Visibility

Hide a region — neighboring regions expand to fill the vacated space:

```typescript
page.getByName("sidebar")!.visible = false;

// Re-enable it
page.getByName("sidebar")!.visible = true;
```

Use this to toggle panels based on application state.

## Layout + Live

The primary use case for `Layout` is driving a fullscreen application with `Live`:

```typescript
import { Live, Layout, Panel } from "@promptctl/rich-js";

const layout = new Layout();
layout.splitColumn(
  new Layout(undefined, { name: "header", size: 3 }),
  new Layout(undefined, { name: "body" }),
);

const live = new Live(layout, { altScreen: true });
live.start();
try {
  layout.getByName("header")!.update(new Panel("[bold]My App[/bold]", { expand: true }));

  while (running) {
    layout.getByName("body")!.update(buildBodyContent());
    await sleep(250);
  }
} finally {
  live.stop();
}
```

See [Live Display](./live) for the complete Live API.
