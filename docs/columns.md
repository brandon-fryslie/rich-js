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
| `width` | Fixed width for every column, fitting as many columns as that width allows. Offered less than one column, the column renders at the offer — a declared width never makes a line wider than the space given |
| `equal` | Force all columns to the same width (uses the widest item as the common width) |
| `expand` | Stretch the column layout to fill the full terminal width |
| `columnFirst` | Fill columns top-to-bottom before left-to-right (like `ls`) |
| `padding` | Padding between items |

The same listing twice: `columnFirst` reads down each column before moving right, the order `ls` uses, and a declared `width` of 22 cells leaves room for three columns instead of four:

```typescript
console.rule("columnFirst: true");
console.print(new Columns(files, { columnFirst: true }));

console.rule("width: 22");
console.print(new Columns(files, { width: 22 }));
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
