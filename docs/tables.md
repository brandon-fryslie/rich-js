# Tables

`Table` renders Unicode box-drawing tables that automatically resize columns to fit the terminal width.

## Basic usage

Three steps: construct a table, add columns, add rows, print:

```typescript
import { Console, Table } from "rich-js";

const console = new Console();

const table = new Table({ title: "Star Wars Box Office" });

table.addColumn("Date",              { style: "dim", width: 12 });
table.addColumn("Title");
table.addColumn("Production Budget", { justify: "right" });
table.addColumn("Box Office",        { justify: "right" });

table.addRow("Dec 20, 2019", "Star Wars: The Rise of Skywalker",   "$275,000,000", "$375,126,118");
table.addRow("May 25, 2018", "[red]Solo[/red]: A Star Wars Story", "$275,000,000", "$393,151,347");
table.addRow("Dec 15, 2017", "Star Wars Ep. VIII: The Last Jedi",  "$262,000,000", "[bold]$1,332,539,889[/bold]");

console.print(table);
```

```
              Star Wars Box Office
┏━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┓
┃ Date       ┃ Title                             ┃ Production Budget   ┃ Box Office    ┃
┡━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━┩
│ Dec 20, …  │ Star Wars: The Rise of Skywalker  │       $275,000,000  │  $375,126,118 │
│ May 25, …  │ Solo: A Star Wars Story           │       $275,000,000  │  $393,151,347 │
│ Dec 15, …  │ Star Wars Ep. VIII: The Last Jedi │       $262,000,000  │ $1,332,539,889│
└────────────┴───────────────────────────────────┴─────────────────────┴───────────────┘
```

Columns resize to fit terminal width, wrapping text when needed. Cell values can be any renderable — strings with markup, styled text, other tables, panels, etc.

## Table options

### Content

| Option | Description |
|---|---|
| `title` | Text above the table |
| `caption` | Text below the table |

### Sizing

| Option | Description |
|---|---|
| `width` | Fixed total width (disables auto-sizing) |
| `minWidth` | Minimum total width |
| `expand` | Stretch to fill available width |

### Borders

| Option | Description |
|---|---|
| `box` | Box-drawing style (`null` removes borders entirely) |
| `safeBox` | Force ASCII box characters instead of Unicode |
| `showHeader` | Render the header row (default: `true`) |
| `showFooter` | Render a footer row |
| `showEdge` | Render the outer border (default: `true`) |
| `showLines` | Draw lines between data rows |
| `leading` | Extra blank lines between rows |

### Padding

| Option | Description |
|---|---|
| `padding` | Padding inside cells — integer, 2-tuple, or 4-tuple (CSS order) |
| `collapsePadding` | Merge adjacent cell padding |
| `padEdge` | Pad the outer edges |

### Styles

| Option | Description |
|---|---|
| `style` | Base style for the whole table |
| `rowStyles` | List of styles applied to alternating rows (zebra stripes) |
| `headerStyle` | Default style for header cells |
| `footerStyle` | Default style for footer cells |
| `borderStyle` | Style for border characters |
| `titleStyle`, `captionStyle` | Styles for title/caption text |
| `titleJustify`, `captionJustify` | Alignment of title/caption |
| `highlight` | Enable auto-highlighting of cell contents |

## Column options

Configure columns individually:

| Option | Description |
|---|---|
| `headerStyle`, `footerStyle` | Header/footer cell style |
| `style` | Style applied to all cells in the column |
| `justify` | Cell alignment: `"left"`, `"center"`, `"right"`, `"full"` |
| `vertical` | Vertical alignment: `"top"`, `"middle"`, `"bottom"` |
| `width` | Fixed column width |
| `minWidth`, `maxWidth` | Width constraints |
| `ratio` | Proportional width allocation |
| `noWrap` | Prevent text wrapping in this column |
| `highlight` | Auto-highlight this column's cells |

## Adding columns

Two equivalent approaches:

```typescript
// Via addColumn() method
table.addColumn("Name");
table.addColumn("Score", { justify: "right", style: "bold cyan" });

// Via constructor — mix plain strings and Column objects
import { Column } from "rich-js";

const table = new Table(
  "Name",
  new Column("Score", { justify: "right", style: "bold cyan" }),
);
```

## Border styles

Pass a box constant from the named exports:

```typescript
import { ROUNDED, HEAVY, DOUBLE, ASCII, MINIMAL } from "rich-js";

const table = new Table({ box: ROUNDED });
```

Available styles: `ASCII`, `ASCII2`, `ASCII_DOUBLE_HEAD`, `SQUARE`, `SQUARE_DOUBLE_HEAD`, `MINIMAL`, `MINIMAL_HEAVY_HEAD`, `MINIMAL_DOUBLE_HEAD`, `SIMPLE`, `SIMPLE_HEAD`, `SIMPLE_HEAVY`, `HORIZONTALS`, `ROUNDED`, `HEAVY`, `HEAVY_EDGE`, `HEAVY_HEAD`, `DOUBLE`, `DOUBLE_EDGE`, `MARKDOWN`.

Pass `box: null` to remove all borders.

## Lines and sections

By default only the header row gets a separator line. Add lines between all data rows:

```typescript
const table = new Table({ showLines: true });
```

Insert a line after a specific row:

```typescript
table.addRow("Alice", "98", { endSection: true });
table.addRow("Bob",   "87");
```

Or insert a section break explicitly:

```typescript
table.addSection();
```

## Empty tables

An empty table (no columns) prints a blank line. Check before printing if you need different behavior:

```typescript
if (table.rowCount === 0) {
  console.print("[dim]No results.[/dim]");
} else {
  console.print(table);
}
```

## Vertical alignment

Use the `Align` renderable to vertically align content within a cell when the per-column `vertical` option isn't enough:

```typescript
import { Align } from "rich-js";

table.addRow(new Align("Top content", { vertical: "top" }), otherCell);
```

## Grids

A table with no headers or borders is a general-purpose layout grid. The `Table.grid()` alternative constructor creates one:

```typescript
import { Table } from "rich-js";

const grid = Table.grid();
grid.addColumn();
grid.addColumn({ justify: "right" });
grid.addRow("[bold]Left content[/bold]", "[dim]Right content[/dim]");

console.print(grid);
```

A common pattern: use a grid to position content at both edges of the terminal on a single line:

```typescript
const grid = Table.grid({ expand: true });
grid.addColumn();
grid.addColumn({ justify: "right" });
grid.addRow("[bold]Left side[/bold]", "[dim]Right side[/dim]");

console.print(grid);
```

`Table.grid()` uses the same `Table` class — it simply disables borders and headers. No separate type.
