# Tree

`Tree` renders a hierarchy with Unicode guide lines. Use it for file systems, dependency graphs, or any nested structure.

## Basic usage

Construct a tree with a root label. Add branches with `add()`. `add()` returns a new `Tree` — chain it to build depth:

```typescript
import { Console, Tree } from "@promptctl/rich-js";

const console = new Console();

const tree = new Tree("📂 [bold orchid]project[/]");

const src = tree.add("📂 [bold dodger_blue1]src[/]");
src.add("📄 [spring_green3]index.ts[/]");
src.add("📄 [spring_green3]console.ts[/]");

const test = tree.add("📂 [bold dodger_blue1]test[/]");
test.add("📄 [dark_orange]console.test.ts[/]");

tree.add("📄 [deep_sky_blue3]package.json[/]");
tree.add("📄 [deep_sky_blue3]tsconfig.json[/]");

console.print(tree);
```

## Labels

Labels can be plain strings (markup is supported), `RichText` objects, or **any renderable** — panels, tables, grids:

```typescript
import { Panel, Table } from "@promptctl/rich-js";

const tree = new Tree("[bold orchid]Servers[/bold orchid]");

// A table as a branch label
const infoTable = Table.grid();
infoTable.addColumn();
infoTable.addColumn("", { justify: "right" });
infoTable.addRow("[deep_sky_blue3]api-1[/deep_sky_blue3]",  "[spring_green3]healthy[/spring_green3]");
infoTable.addRow("[deep_sky_blue3]api-2[/deep_sky_blue3]",  "[spring_green3]healthy[/spring_green3]");
infoTable.addRow("[deep_sky_blue3]api-3[/deep_sky_blue3]",  "[deep_pink2]degraded[/deep_pink2]");

tree.add(infoTable);

// A panel as a branch label
tree.add(new Panel("[dark_orange]2 of 3 healthy[/dark_orange]", { expand: false, borderStyle: "dark_orange" }));

console.print(tree);
```

This is the key power — any renderable can be a node label, not just strings.

## Styles

Give a node a `style` and its label is drawn in it, along with every label beneath it. A deeper node's style refines its ancestors' rather than replacing them, and markup in a label still wins over the style it inherits:

```typescript
const tree = new Tree("[bold]Root[/bold]", { style: "italic" });
const branch = tree.add("Branch", { style: "deep_sky_blue3" });
branch.add("Leaf");
branch.add("[spring_green3]Healthy leaf[/spring_green3]");
tree.add("Sibling", { style: "on grey23" });

console.print(tree);
```

A style's background reaches under the node's guide lines too, so the row is filled from its first guide to the end of its label.

## Guide style

Style the guide lines independently of the labels with `guide_style`:

```typescript
const tree = new Tree("[bold]Root[/bold]", { guide_style: "bold dodger_blue1" });
tree.add("[deep_sky_blue3]Branch one[/deep_sky_blue3]");
tree.add("[deep_sky_blue3]Branch two[/deep_sky_blue3]");
tree.add("[spring_green3]Leaf[/spring_green3]");

console.print(tree);
```
