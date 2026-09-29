---
exampleContext: |
  const entry = (name: string, directory: boolean) => ({ name, isDirectory: () => directory });
  const entries = [
    entry(".github", true), entry("docs", true), entry("examples", true), entry("node_modules", true),
    entry("scripts", true), entry("src", true), entry("test", true), entry(".gitignore", false),
    entry("CLAUDE.md", false), entry("LICENSE", false), entry("README.md", false),
    entry("package-lock.json", false), entry("package.json", false), entry("tsconfig.json", false),
  ];
  const items = [
    { name: "Table", description: "Rows and columns" },
    { name: "Tree", description: "Nested hierarchies" },
    { name: "Panel", description: "A border around it" },
    { name: "Columns", description: "Side-by-side layout" },
    { name: "Progress", description: "Live task bars" },
    { name: "Syntax", description: "Highlighted code" },
  ];
---

# Columns

`Columns` takes a list of renderables and arranges them in as many columns as fit in the terminal width.

## Basic usage

A common use case is laying out a directory listing — the same way `ls` does. Here `entries` is what `readdirSync(".", { withFileTypes: true })` returns, and directories are coloured the way `ls --color` colours them:

```typescript
import { Console, Columns } from "@promptctl/rich-js";

const console = new Console();

const files = entries.map((entry) =>
  entry.isDirectory() ? `[bold dodger_blue1]${entry.name}/[/]` : entry.name,
);
console.print(new Columns(files));
```

Each string is markup, the same as a string passed to `console.print`.

## Options

| Option | Description |
|---|---|
| `width` | Fixed width for every column, fitting as many columns as that width allows and never more columns than items. Offered less than one column, the column renders at the offer — a declared width never makes a line wider than the space given |
| `equal` | Choose the number of columns as if every item were as wide as the widest one. Each column is still only as wide as its own items |
| `expand` | Stretch the columns to fill the width offered, wider columns taking more of the extra space. Without it, a `Columns` is only as wide as its columns and the gaps between them |
| `columnFirst` | Fill columns top-to-bottom before left-to-right (like `ls`) |
| `padding` | Space around each item, in the same shapes as `Padding` takes; the default is `[0, 1]`. Columns stand as far apart as the wider of the left and right sides. Rows stand `top + max(0, top - bottom)` lines apart — Rich's arithmetic, so a bottom-only padding separates nothing |

Each column is as wide as the widest item in it — one cell when every item in it is empty, as in Rich — so a listing of mostly short names with one long one keeps the short columns narrow. The items are laid out in a `Table.grid` with `collapsePadding` on and `padEdge` off, as Rich lays them out, so everything after the choice of how many columns — widths, gaps, `expand`, the space between rows — is the grid's. Every option above follows Python Rich's `Columns` byte for byte, with two exceptions:

- A declared `width` chooses how many columns to use in the same way as the automatic layout, so it can choose a different number of columns than Rich. Rich divides the offer by the width: it fills the offer with empty columns when there are fewer items than columns, and fails outright when the width is wider than the offer.
- A `Columns` measures as wide as its columns and the gaps between them. Rich's `Columns` does not measure itself, so inside a fitted `Panel` it takes the whole width offered.

The same listing several ways: `columnFirst` reads down each column before moving right, the order `ls` uses; a declared `width` of 22 cells leaves room for three columns instead of four; `padding` of four cells on each side spreads the columns further apart; and `expand` stretches them to the edge of the terminal:

```typescript
console.rule("columnFirst: true");
console.print(new Columns(files, { columnFirst: true }));

console.rule("width: 22");
console.print(new Columns(files, { width: 22 }));

console.rule("padding: [0, 4]");
console.print(new Columns(files, { padding: [0, 4] }));

console.rule("expand: true");
console.print(new Columns(files, { expand: true }));
```

## Content

Columns can contain any renderable, not just strings — `Panel`, `Table`, `Tree`, etc.:

```typescript
import { Panel } from "@promptctl/rich-js";

const cards = items.map((item) =>
  new Panel(`[italic]${item.description}[/]`, {
    title: item.name,
    titleStyle: "bold orchid",
    borderStyle: "deep_sky_blue3",
    expand: false,
  })
);

console.print(new Columns(cards));
```
