# Doc Spec: Tables

The tables doc explains the Table renderable — how to construct it, configure its appearance, and use it as a layout tool.

## Sections

### Basic usage

Show the three-step pattern: construct a table, add columns, add rows, print. Use a concrete example (the Star Wars movies table from the original Rich docs is a good reference). Show the rendered output as a code block.

Explain that the table automatically resizes columns to fit the terminal width, wrapping text when needed.

Note that cell values are not limited to strings — any renderable can be a cell value, including other tables.

### Table options

Document the constructor options that control appearance. Group them logically:

**Content**
- `title` — text above the table
- `caption` — text below the table

**Sizing**
- `width` — fixed width (disables auto-sizing)
- `minWidth` — minimum total width
- `expand` — stretch to fill available width

**Borders**
- `box` — which box-drawing style to use (cross-reference the box appendix); `null`/`None` removes borders entirely
- `safeBox` — force ASCII box characters instead of Unicode
- `showHeader` — whether to render the header row
- `showFooter` — whether to render the footer row
- `showEdge` — whether to render the outer border
- `showLines` — whether to draw lines between data rows
- `leading` — extra blank lines between rows

**Padding**
- `padding` — padding inside cells (integer, 2-tuple, or 4-tuple; CSS-style)
- `collapsePadding` — merge adjacent cell padding
- `padEdge` — whether to pad the outer edges

**Styles**
- `style` — base style applied to the whole table
- `rowStyles` — list of styles applied to alternating rows (zebra stripes)
- `headerStyle` — default style for header cells
- `footerStyle` — default style for footer cells
- `borderStyle` — style for border characters
- `titleStyle`, `captionStyle`
- `titleJustify`, `captionJustify`
- `highlight` — enable auto-highlighting of cell contents

### Column options

Document what can be configured per column:
- `headerStyle`, `footerStyle`
- `style` — applies to all cells in the column
- `justify` — text alignment: left, center, right, full
- `vertical` — vertical alignment: top, middle, bottom
- `width` — fixed width
- `minWidth`, `maxWidth`
- `ratio` — proportional width allocation
- `noWrap`
- `highlight`

### Adding columns

Show both ways to add columns: via `addColumn()` method and via constructor positional arguments. Show mixing plain strings (column header only) with Column objects (full options) in the constructor.

### Border styles

Show how to import a box constant and pass it to the table constructor. Cross-reference the box style appendix.

### Lines and sections

Explain that by default only the header row gets a line. Show `showLines: true` for lines between all rows. Show `endSection: true` on `addRow()` or `addSection()` to insert a line after a specific row.

### Empty tables

Explain what happens when a table has no columns (a blank line is printed). Show the idiom for checking and printing something different when there's no data.

### Vertical alignment

Show using the Align renderable to vertically align content within a cell, for cases where the per-column `vertical` setting is not sufficient.

### Grids

Explain that a table with no headers or borders is a general-purpose layout grid. Show the `Table.grid()` alternative constructor. Show using a grid to position content at both edges of the terminal on a single line.

## Constraints

- The basic example must be a real, runnable snippet that produces visually interesting output
- The grid section must make clear this is the same Table class, not a separate type — the distinction is that borders and headers are disabled
- Do not document every method on the Table class — only the documented patterns
