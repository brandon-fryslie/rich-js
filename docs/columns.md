# Columns

`Columns` takes a list of renderables and arranges them in as many columns as fit in the terminal width.

## Basic usage

A common use case is laying out a directory listing — the same way `ls` does:

```typescript
import { Console, Columns } from "rich-js";
import { readdirSync } from "fs";

const console = new Console();

const files = readdirSync(".");
console.print(new Columns(files));
```

```
.gitignore   node_modules  src           tsconfig.json
CLAUDE.md    package.json  spec
dist         README.md     test
```

## Options

| Option | Description |
|---|---|
| `equal` | Force all columns to the same width (uses the widest item as the common width) |
| `expand` | Stretch the column layout to fill the full terminal width |
| `columnFirst` | Fill columns top-to-bottom before left-to-right (like `ls`) |
| `padding` | Padding between items |

```typescript
console.print(new Columns(files, { equal: true }));
console.print(new Columns(files, { columnFirst: true, expand: true }));
```

## Content

Columns can contain any renderable, not just strings — `Panel`, `Table`, `Tree`, etc.:

```typescript
import { Panel } from "rich-js";

const cards = items.map((item) =>
  new Panel(item.description, { title: item.name, expand: false })
);

console.print(new Columns(cards));
```
