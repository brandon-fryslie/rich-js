---
exampleContext: |
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const running = true;
  let tick = 0;
  const buildBodyContent = () => {
    tick += 1;
    const table = new Table({ expand: true });
    table.addColumn("service");
    table.addColumn("cpu", { justify: "right" });
    table.addColumn("load");
    for (const [i, name] of ["api", "auth", "worker", "queue", "cache", "search", "mail", "db"].entries()) {
      const cpu = Math.round(50 + 45 * Math.sin(tick / 6 + i * 1.7));
      const colour = cpu > 80 ? "red" : cpu > 50 ? "yellow" : "green";
      table.addRow(name, `${cpu}%`, `[${colour}]${"█".repeat(Math.round(cpu / 4))}[/]`);
    }
    return new Panel(table, { title: "services", expand: true, borderStyle: "blue" });
  };
---

# Layout

`Layout` divides the terminal into named areas that each hold an independent renderable. Use it standalone or with `Live` for full-screen applications.

## Creating a layout

A layout draws the renderable you give it and nothing else — no border, no label, no
placeholder of its own. The border below is the `Panel`'s. The name is for
`getByName()` lookup, not display, and a layout with no content and no children emits
nothing at all:

```typescript
import { Layout, Panel } from "@promptctl/rich-js";

const leaf = new Layout(
  new Panel("[bold]Hello[/], [magenta]Layout[/]", { expand: true, borderStyle: "cyan" }),
  { name: "root" },
);
console.print(leaf);
```

## Splitting

`splitColumn()` stacks sub-layouts vertically (rows). `splitRow()` places them side by
side (columns). A layout that gets children stops drawing its own renderable, so a
root you intend to split starts out empty:

```typescript
const layout = new Layout(undefined, { name: "root" });

// Split into an upper row and a lower row
layout.splitColumn(
  new Layout(new Panel("[bold magenta]header[/]", { expand: true, borderStyle: "magenta" }), { name: "upper" }),
  new Layout(undefined, { name: "lower" }),
);

// Split the lower row into two panels side by side
layout.getByName("lower")!.splitRow(
  new Layout(new Panel("[green]logs[/]", { expand: true, borderStyle: "green" }), { name: "lower-left" }),
  new Layout(new Panel("[yellow]stats[/]", { expand: true, borderStyle: "yellow" }), { name: "lower-right" }),
);

console.print(layout);
```

Look sub-layouts up by name with `getByName()`, then split further to build any tree
of regions.

## Setting content

A region gets its renderable in one of two ways: passed to the `Layout` constructor, as
every pane above was, or set later with `update()` on a named sub-layout, which replaces
whatever the region held:

```typescript
layout.getByName("upper")!.update(
  new Panel("[bold magenta]deploy[/] [dim]·[/] production", { expand: true, borderStyle: "magenta" }),
);
layout.getByName("lower-left")!.update(
  new Panel("[green]✔[/] build\n[green]✔[/] test\n[yellow]●[/] release", { title: "logs", expand: true, borderStyle: "green" }),
);
layout.getByName("lower-right")!.update(
  new Panel("[bold]2[/] of [bold]3[/] steps done\n[dim]started 12:04[/]\n[dim]eta 1 min[/]", { title: "stats", expand: true, borderStyle: "yellow" }),
);

console.print(layout);
```

## Fixed size

Fix a sub-layout to an exact number of rows (or columns, in a row split). Splitting
replaces a layout's children rather than adding to them, so this starts from its own
root instead of re-splitting the one above:

```typescript
const page = new Layout(undefined, { name: "page" });

page.splitColumn(
  // always 3 rows
  new Layout(new Panel("[bold cyan]My App[/]", { expand: true, borderStyle: "cyan" }), { name: "header", size: 3 }),
  // takes remaining space
  new Layout(new Panel("body", { expand: true }), { name: "body" }),
  // always 1 row
  new Layout("[reverse] q [/] quit  [reverse] ? [/] help", { name: "footer", size: 1 }),
);

console.print(page);
```

Fixed layouts take their space first; remaining space is distributed among flexible
layouts. `console.print()` gives a layout no height to divide, so a flexible pane there
takes its content's height, as `body` does above. Under a full-screen `Live` (see
[Layout + Live](#layout-live)) the layout is given the whole terminal, and `body`
stretches to fill every row the header and footer leave.

## Ratio

Control proportional space allocation:

```typescript
page.getByName("body")!.splitRow(
  new Layout(new Panel("[green]sidebar[/]", { expand: true, borderStyle: "green" }), { name: "sidebar", ratio: 1 }), // one-third
  new Layout(new Panel("[yellow]main[/]", { expand: true, borderStyle: "yellow" }), { name: "main", ratio: 2 }), // two-thirds
);

console.print(page);
```

A layout with `ratio: 2` alongside one with `ratio: 1` takes two-thirds of the available space.

## Minimum size

Prevent a flexible layout from shrinking below a threshold. On a 75-column terminal a
1:4 split would give the sidebar 15 columns; `minimumSize: 30` holds it at 30, and
`main` takes the 45 that are left:

```typescript
const narrow = new Layout();
narrow.splitRow(
  new Layout(new Panel("[green]sidebar[/]", { expand: true, borderStyle: "green" }), { name: "sidebar", ratio: 1, minimumSize: 30 }),
  new Layout(new Panel("[yellow]main[/]", { expand: true, borderStyle: "yellow" }), { name: "main", ratio: 4 }),
);

console.print(narrow);
```

## Visibility

Hide a region — neighboring regions expand to fill the vacated space:

```typescript
page.getByName("sidebar")!.visible = false;
console.print(page);

// Re-enable it
page.getByName("sidebar")!.visible = true;
```

Use this to toggle panels based on application state.

## Layout + Live

The primary use case for `Layout` is driving a fullscreen application with `Live`. With
`altScreen: true` the layout is given every row of the terminal, so the `body` region
stretches to fill what the 3-row header leaves:

```typescript live
import { Live, Layout, Panel } from "@promptctl/rich-js";

const layout = new Layout();
layout.splitColumn(
  new Layout(undefined, { name: "header", size: 3 }),
  new Layout(undefined, { name: "body" }),
);

const live = new Live(layout, { altScreen: true });
live.start();
try {
  layout.getByName("header")!.update(new Panel("[bold magenta]My App[/]", { expand: true, borderStyle: "magenta" }));

  while (running) {
    layout.getByName("body")!.update(buildBodyContent());
    await sleep(250);
  }
} finally {
  live.stop();
}
```

See [Live Display](./live) for the complete Live API.
