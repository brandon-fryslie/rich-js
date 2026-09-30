# Tables

`Table` renders Unicode box-drawing tables that automatically resize columns to fit the terminal width.

## Basic usage

Four steps: construct a table, add columns, add rows, print:

```typescript
import { Console, Table } from "@promptctl/rich-js";

const console = new Console();

const table = new Table({
  title: "Star Wars Box Office",
  titleStyle: "bold dark_goldenrod",
  headerStyle: "bold medium_orchid",
  borderStyle: "steel_blue",
});

table.addColumn("Date",              { width: 12 });
table.addColumn("Title");
table.addColumn("Production Budget", { justify: "right" });
table.addColumn("Box Office",        { justify: "right" });

table.addRow("[dim]Dec 20, 2019[/dim]", "[deep_sky_blue3]Star Wars: The Rise of Skywalker[/]",   "[chartreuse4]$275,000,000[/]", "[chartreuse4]$375,126,118[/]");
table.addRow("[dim]May 25, 2018[/dim]", "[indian_red]Solo[/]: [deep_sky_blue3]A Star Wars Story[/]", "[chartreuse4]$275,000,000[/]", "[chartreuse4]$393,151,347[/]");
table.addRow("[dim]Dec 15, 2017[/dim]", "[deep_sky_blue3]Star Wars Ep. VIII: The Last Jedi[/]",  "[chartreuse4]$262,000,000[/]", "[bold chartreuse4]$1,332,539,889[/]");

console.print(table);
```

The example terminal is 75 columns wide, narrower than this table wants, so the
columns shrink to fit. Every column first keeps its minimum — its longest word,
or its whole line if it has `noWrap` — and only the width past that is shared
out in proportion to natural width, so the long titles wrap onto a second line
while the Box Office figures, which have no break in them, stay whole. A column
is cut short by its `overflow` (an ellipsis by default) only when the table is
too narrow for every column's minimum and padding, or when its `maxWidth` is
narrower than a word. Cell values can be any renderable — strings with markup, styled text, other tables, panels, etc.

## Table options

### Content

| Option | Description |
|---|---|
| `title` | Text above the table |
| `caption` | Text below the table |

### Sizing

| Option | Description |
|---|---|
| `width` | Total width — the table fills it as [`expand`](#sizing) does, as in Rich, but never wider than the width offered ([Narrow widths](#narrow-widths)) |
| `minWidth` | Minimum total width |
| `expand` | Fill the width offered. Every column first gets its natural width, then the cells left over are shared out in proportion to it; a column with a declared `width` keeps that width. A declared table `width` implies it |

### Borders

| Option | Description |
|---|---|
| `box` | Box-drawing style (`null` removes borders entirely) |
| `showHeader` | Render the header row (default: `true`); off also swaps five box styles for a plainer kin ([Border styles](#border-styles)) |
| `showFooter` | Render a footer row |
| `showEdge` | Render the outer border (default: `true`) |
| `showLines` | Draw lines between data rows |

### Padding

| Option | Description |
|---|---|
| `padding` | Padding inside cells — integer, 2-tuple, or 4-tuple (CSS order) |
| `collapsePadding` | Merge each cell's padding into its neighbour's: a cell's left side gives way to the right side of the cell before it, and a row's bottom to the top of the row after it (default: `false`; `Table.grid`: `true`) |
| `padEdge` | Pad the sides of the cells that meet the table's edge (default: `true`; `Table.grid`: `false`) |

The padding above and below a cell is blank lines in that cell, so it stands between rows the same way the padding either side stands between columns. With `collapsePadding`, a row keeps `max(0, top - bottom)` of its bottom padding — Rich's arithmetic, so a bottom-only padding separates no rows.

### Styles

| Option | Description |
|---|---|
| `style` | Base style for the frame; `borderStyle` layers over it |
| `rowStyles` | List of styles applied to alternating rows (zebra stripes) |
| `headerStyle` | Default style for header cells |
| `footerStyle` | Default style for footer cells |
| `borderStyle` | Style for border characters |
| `titleStyle`, `captionStyle` | Styles for title/caption text |
| `titleJustify`, `captionJustify` | Alignment of title/caption |

A cell's style covers the whole cell, its left and right padding included, so a
background fills the column rather than sitting behind the text; on a box whose
column dividers are blank, such as `SIMPLE`, a row's background runs under the
dividers too. The styles stack from the outside in:
a header cell takes the table's `headerStyle` and then its column's, a body cell
its column's `style` and then the row's `rowStyles` entry, and markup in the cell
text lands on top of both. The table's own `style` reaches the frame only, as in
Rich.

## Narrow widths

A table never emits a line wider than the width it is given, however narrow that
gets — a cramped terminal, or a `Layout` or `Columns` split that squeezes the
table below its natural size. This matters beyond looks: an oversized row is
soft-wrapped by the terminal, and the wrap destroys the frame of everything
printed after it.

A declared `width` does not lift that bound. The table's outer width is the
smaller of its `width` and the width it is offered, and both `render` and
`measure` read that one number. A declared width is a size rather than a
ceiling: it implies [`expand`](#sizing), as it does in Rich, so a table declared
at 40 whose content needs nine cells still renders 40 wide and measures 40, and
a `Panel` fitted round it is sized to match. Offered 12 columns, it renders 12.
Rich would draw all 40 and let the terminal wrap them. It fills the way `expand`
does, so a column with its own `width` keeps it: a table whose every column
declares one is as wide as those columns, not 40, where Rich would stretch them.

Cells go out in a fixed order — the two outer border columns, then one content
cell for each column together with the divider in front of it, then the padding,
and only then does content grow back toward its natural width. Columns fill from
the left, and a column the width cannot seat is dropped rather than drawn outside
the frame. The same three-column table, declared at seven widths and set side
by side in a grid:

```typescript
const abc = (width: number) => {
  const t = new Table({ width, box: SQUARE, borderStyle: "steel_blue", headerStyle: "bold dark_goldenrod" });
  t.addColumn("A");
  t.addColumn("B");
  t.addColumn("C");
  t.addRow("[chartreuse4]1[/]", "[chartreuse4]2[/]", "[chartreuse4]3[/]");
  return t;
};

const widths = [2, 3, 4, 5, 7, 10, 13];
const ladder = Table.grid();
// Each grid column is wide enough for its label and for its table.
for (const w of widths) ladder.addColumn("", { width: Math.max(w, 8) });
ladder.addRow(...widths.map((w) => `[dim]width ${w}[/dim]`));
ladder.addRow(...widths.map(abc));

console.print(ladder);
```

Those are the widths at which a new step of that order completes. In between, a
padding level is bought for every column at once or not at all, so the cells
it cannot yet buy go to content instead: asked for 11, the table draws the
10-cell rung with one more cell in its first column.

Width 2 is the narrowest table that keeps its frame; below it the border columns
are dropped too, and the table renders as bare content. In the other direction a
table with no declared width never grows past its natural width — offer it 200
columns and it still renders at 13 — unless it is built with [`expand`](#sizing).

Because the padding is bought before content grows back, a table between those
two ladders spends cells on padding while its columns are still truncated. Wide
columns are cropped by their own `overflow` mode, so a column squeezed to a
single cell shows only what that mode can fit in one cell.

A column with an explicit `width` is a reservation rather than a bid: it is paid
ahead of the elastic share, so its neighbours give up their width first. It comes
out of what the frame, the seats and the padding leave, so a width too small to
cover every reservation shrinks reserved columns too, in column order. Columns
with a `ratio` sit at the other end — they take whatever the bounded columns
leave.

## Column options

Configure columns individually:

| Option | Description |
|---|---|
| `justify` | Cell alignment: `"left"`, `"center"`, `"right"`, `"full"` |
| `width` | Fixed column width |
| `minWidth`, `maxWidth` | Width constraints |
| `ratio` | Proportional width allocation; a ratio that is not positive is no ratio, and the column sizes to its content |
| `noWrap` | Prevent text wrapping in this column |
| `overflow` | What becomes of a line too long for the column: `"ellipsis"` (default), `"crop"`, `"fold"`, or `"ignore"`, which leaves it whole and unjustified for the table's cell crop to cut |
| `footer` | Footer cell content — drawn only when the table sets `showFooter` |
| `headerStyle`, `footerStyle` | Per-column header/footer style, layered over the table's |
| `style` | Per-column cell style, under the row's `rowStyles` entry |

## Adding columns

`addColumn` is the way in. It builds the column and appends it, taking the header
first and everything else in an options object:

```typescript
const scores = new Table({ headerStyle: "bold deep_sky_blue3", borderStyle: "deep_sky_blue3" });
scores.addColumn("Name");
scores.addColumn("Score", { justify: "right" });
scores.addRow("Alice", "[bold chartreuse4]98[/]");
scores.addRow("Bob",   "[dark_goldenrod]87[/]");

console.print(scores);
```

Every column option is reachable that way. The exported `Column` class is the same
object `addColumn` builds — its constructor takes one options object with the header
inside it — and `table.columns` hands out the live columns, for adjusting one after
the rows are in.

## Border styles

Pass a box constant from the named exports. Five of them, laid out with `Columns` as many to a row as fit:

```typescript
import { Columns, ROUNDED, HEAVY, DOUBLE, ASCII, MINIMAL } from "@promptctl/rich-js";

const styles = { ROUNDED, HEAVY, DOUBLE, ASCII, MINIMAL };
const tables = Object.entries(styles).map(([name, box]) => {
  const table = new Table({ box, title: `[bold]${name}[/bold]`, borderStyle: "medium_orchid" });
  table.addColumn("Key");
  table.addColumn("Value");
  table.addRow("[deep_sky_blue3]a[/]", "1");
  table.addRow("[deep_sky_blue3]b[/]", "2");
  return table;
});

console.print(new Columns(tables));
```

Available styles: `ASCII`, `ASCII2`, `ASCII_DOUBLE_HEAD`, `SQUARE`, `SQUARE_DOUBLE_HEAD`, `MINIMAL`, `MINIMAL_HEAVY_HEAD`, `MINIMAL_DOUBLE_HEAD`, `SIMPLE`, `SIMPLE_HEAD`, `SIMPLE_HEAVY`, `HORIZONTALS`, `ROUNDED`, `HEAVY`, `HEAVY_EDGE`, `HEAVY_HEAD`, `DOUBLE`, `DOUBLE_EDGE`, `MARKDOWN`.

Pass `box: null` to remove all borders.

Five of those styles spend heavier glyphs on the header than on the rest of the frame. A table with `showHeader: false` has no header to spend them on, so it draws the plainer equivalent instead: `HEAVY_HEAD` and `SQUARE_DOUBLE_HEAD` give way to `SQUARE`, `MINIMAL_HEAVY_HEAD` and `MINIMAL_DOUBLE_HEAD` to `MINIMAL`, and `ASCII_DOUBLE_HEAD` to `ASCII2`. `HEAVY_HEAD` is the default, so a headerless table that sets no `box` draws in `SQUARE`. The other fourteen styles already draw a plain head and are unaffected.

## Lines and sections

By default only the header row gets a separator line. Add lines between all data rows:

```typescript
const lined = new Table({ showLines: true, borderStyle: "chartreuse4" });
lined.addColumn("Step");
lined.addColumn("Status");
lined.addRow("Fetch",   "[chartreuse4]done[/]");
lined.addRow("Build",   "[chartreuse4]done[/]");
lined.addRow("Deploy",  "[dark_goldenrod]running[/]");

console.print(lined);
```

Insert a line after a specific row:

```typescript
const podium = new Table({ borderStyle: "dark_goldenrod" });
podium.addColumn("Player");
podium.addColumn("Score", { justify: "right" });
podium.addRow("[bold]Alice[/bold]", "[bold chartreuse4]98[/]", { endSection: true });
podium.addRow("Bob",   "87");
podium.addRow("Carol", "81");

console.print(podium);
```

Or insert a section break explicitly, between one `addRow` and the next:

```typescript
const standings = new Table({ title: "Standings", borderStyle: "steel_blue" });
standings.addColumn("Team");
standings.addColumn("Pts", { justify: "right" });
standings.addRow("Lions",  "42");
standings.addRow("Tigers", "39");
standings.addSection();
standings.addRow("[indian_red]Bears[/]", "[indian_red]12[/]");

console.print(standings);
```

## Empty tables

An empty table (no columns) prints a blank line, and a table with columns but no rows prints only its header. With neither header nor footer drawn, a column has nothing to size to, so it fills the width offered, as Rich's does: an empty frame across the terminal. Unlike Rich's, it still measures as one cell of content, so a parent that sizes to what it holds, like a `Panel` with `expand: false`, stays narrow where Rich's spans the width. Check `rowCount` before printing if you need different behavior:

```typescript
const results = new Table();
results.addColumn("Match");

if (results.rowCount === 0) {
  console.print("[dim]No results.[/dim]");
} else {
  console.print(results);
}
```

## Grids

A table with no headers or borders is a general-purpose layout grid. The `Table.grid()` alternative constructor creates one:

```typescript
import { Table } from "@promptctl/rich-js";

const grid = Table.grid();
grid.addColumn();
grid.addColumn("", { justify: "right" });
grid.addRow("[bold]Left content[/bold]", "[dim]Right content[/dim]");

console.print(grid);
```

A common pattern: use a grid to position content at both edges of the terminal on a single line. `expand` makes the grid fill the terminal, and the right-justified column carries its content to the far edge:

```typescript
const grid = Table.grid({ expand: true });
grid.addColumn();
grid.addColumn("", { justify: "right" });
grid.addRow("[bold]Left side[/bold]", "[dim]Right side[/dim]");

console.print(grid);
```

`Table.grid()` uses the same `Table` class with different defaults: no borders, no header, and one cell of padding between columns but none at the grid's edges (`padding: [0, 1, 0, 0]`, `collapsePadding` on, `padEdge` off). No separate type.
