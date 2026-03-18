# Tree

`Tree` renders a hierarchy with Unicode guide lines. Use it for file systems, dependency graphs, or any nested structure.

## Basic usage

Construct a tree with a root label. Add branches with `add()`. `add()` returns a new `Tree` — chain it to build depth:

```typescript
import { Console, Tree } from "rich-js";

const console = new Console();

const tree = new Tree(":open_file_folder: [bold]project[/bold]");

const src = tree.add(":open_file_folder: src");
src.add(":page_facing_up: index.ts");
src.add(":page_facing_up: console.ts");

const test = tree.add(":open_file_folder: test");
test.add(":page_facing_up: console.test.ts");

tree.add(":page_facing_up: package.json");
tree.add(":page_facing_up: tsconfig.json");

console.print(tree);
```

```
📂 project
├── 📂 src
│   ├── 📄 index.ts
│   └── 📄 console.ts
├── 📂 test
│   └── 📄 console.test.ts
├── 📄 package.json
└── 📄 tsconfig.json
```

## Labels

Labels can be plain strings (markup is supported), `RichText` objects, or **any renderable** — panels, tables, grids:

```typescript
import { Panel, Table } from "rich-js";

const tree = new Tree("[bold magenta]Servers[/bold magenta]");

// A table as a branch label
const infoTable = Table.grid();
infoTable.addColumn();
infoTable.addColumn({ justify: "right" });
infoTable.addRow("[cyan]api-1[/cyan]",  "[green]healthy[/green]");
infoTable.addRow("[cyan]api-2[/cyan]",  "[green]healthy[/green]");
infoTable.addRow("[cyan]api-3[/cyan]",  "[red]degraded[/red]");

tree.add(infoTable);

console.print(tree);
```

This is the key power — any renderable can be a node label, not just strings.

## Styles

Apply a style to a subtree and all its descendants:

```typescript
const tree = new Tree("Root", { style: "bold" });
const branch = tree.add("Branch", { style: "cyan" });
branch.add("Leaf");  // inherits "cyan" style
```

Style the guide lines independently:

```typescript
const tree = new Tree("Root", { guideStyle: "dim green" });
```

::: tip Guide style effects
- `bold` guide style → thicker Unicode line characters (`┣━━`)
- `underline2` guide style → double-line characters (`╠══`)
:::

Styles are inherited by sub-trees — a branch's style applies to all descendants unless overridden.
