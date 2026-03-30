# rich-js

A TypeScript port of Python's [Rich](https://github.com/Textualize/rich) library — rich text and beautiful formatting in the terminal.

The rich-js API makes it easy to add color and style to terminal output. It can also render pretty tables, progress bars, markdown, syntax highlighted source code, tracebacks, and more — out of the box.

## Compatibility

Works on Linux, macOS, and Windows. Requires Node.js >= 18. ESM-only.

## Installing

```sh
npm install rich-js
```

## Using the Console

Import and construct a `Console` object:

```typescript
import { Console } from "rich-js";

const console = new Console();
```

The `Console` object has a `print` method similar to the built-in `console.log`. Rich will word-wrap your text to fit within the terminal width.

```typescript
console.print("Hello", "World!");
```

Add color and style with a `style` argument:

```typescript
console.print("Hello, World!", { style: "bold red" });
```

For finer-grained styling, Rich renders markup using a syntax similar to bbcode:

```typescript
console.print("Where there is a [bold cyan]Will[/bold cyan] there [u]is[/u] a [i]way[/i].");
```

## Rich Library

Rich includes a number of built-in renderables for creating elegant terminal output.

<details>
<summary>Log</summary>

The `Console` object has a `log()` method similar to `print()`, but adds a timestamp column on the left. Rich will syntax-highlight data structures automatically.

```typescript
import { Console } from "rich-js";

const console = new Console();

console.log("Server started");
console.log({ status: 200, method: "GET", path: "/api/users" });
```

</details>

<details>
<summary>Emoji</summary>

Insert an emoji in console output by placing the name between two colons:

```typescript
console.print(":smiley: :vampire: :pile_of_poo: :thumbs_up: :raccoon:");
// 😃 🧛 💩 👍 🦝
```

</details>

<details>
<summary>Tables</summary>

Rich can render flexible tables with unicode box characters. There is a large variety of formatting options for borders, styles, and cell alignment.

```typescript
import { Console, Table } from "rich-js";

const console = new Console();

const table = new Table({ title: "Star Wars Box Office" });
table.addColumn("Date", { style: "dim", width: 12 });
table.addColumn("Title");
table.addColumn("Production Budget", { justify: "right" });
table.addColumn("Box Office", { justify: "right" });

table.addRow("Dec 20, 2019", "Star Wars: The Rise of Skywalker", "$275,000,000", "$375,126,118");
table.addRow("May 25, 2018", "[red]Solo[/red]: A Star Wars Story", "$275,000,000", "$393,151,347");
table.addRow("Dec 15, 2017", "Star Wars Ep. VIII: The Last Jedi", "$262,000,000", "[bold]$1,332,539,889[/bold]");

console.print(table);
```

The `Table` class resizes columns to fit the available terminal width, wrapping text as required. Console markup is rendered inside cells, and any `Renderable` can be used as a cell value — including other tables.

</details>

<details>
<summary>Progress Bars</summary>

Rich can render multiple flicker-free progress bars to track long-running tasks.

For basic usage, wrap any iterable with `track`:

```typescript
import { track } from "rich-js";

for (const step of track(Array.from({ length: 100 }), { description: "Processing..." })) {
  await doStep(step);
}
```

For multiple progress bars and custom columns, use `Progress` directly:

```typescript
import { Progress, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn } from "rich-js";

const progress = new Progress(
  new TextColumn("{task.description}"),
  new BarColumn(),
  new TaskProgressColumn(),
  new TimeRemainingColumn(),
);

await progress.run(async () => {
  const task1 = progress.addTask("Downloading...", { total: 100 });
  const task2 = progress.addTask("Processing...", { total: 200 });
  // ... update tasks
});
```

</details>

<details>
<summary>Status</summary>

For situations where it is hard to calculate progress, use `Status` to display a spinner animation with a message:

```typescript
import { Console } from "rich-js";

const console = new Console();

const status = new Status("[bold green]Working on tasks...", { console });
status.start();

for (const task of tasks) {
  await processTask(task);
  console.log(`${task} complete`);
}

status.stop();
```

</details>

<details>
<summary>Tree</summary>

Rich can render a tree with guide lines — ideal for displaying file structures or any other hierarchical data:

```typescript
import { Console, Tree } from "rich-js";

const console = new Console();

const tree = new Tree(":open_file_folder: root");
const branch = tree.add(":file_folder: src");
branch.add(":page_facing_up: index.ts");
branch.add(":page_facing_up: utils.ts");
tree.add(":page_facing_up: package.json");

console.print(tree);
```

Tree labels can be plain text, markup strings, or any `Renderable`.

</details>

<details>
<summary>Columns</summary>

Rich can render content in neat columns with equal or optimal width:

```typescript
import { Console, Columns } from "rich-js";

const console = new Console();

const items = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"];
console.print(new Columns(items));
```

</details>

<details>
<summary>Markdown</summary>

Rich can render Markdown and translates the formatting to the terminal:

```typescript
import { Console, Markdown } from "rich-js";
import { readFileSync } from "fs";

const console = new Console();
const md = new Markdown(readFileSync("README.md", "utf-8"));
console.print(md);
```

</details>

<details>
<summary>Syntax Highlighting</summary>

Rich can render syntax-highlighted source code:

```typescript
import { Console, Syntax } from "rich-js";

const console = new Console();

const code = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

const syntax = new Syntax(code, "typescript", { theme: "monokai", lineNumbers: true });
console.print(syntax);
```

</details>

<details>
<summary>Tracebacks</summary>

Rich can render beautiful tracebacks that are easier to read and show more context than standard Node.js errors:

```typescript
import { Console, Traceback } from "rich-js";

const console = new Console();

try {
  riskyOperation();
} catch (error) {
  console.print(new Traceback(error));
}
```

</details>

## Custom Renderables

All Rich renderables use the `Renderable` protocol. You can implement your own:

```typescript
import type { Renderable, RenderOptions } from "rich-js";
import { Segment } from "rich-js";

class Greeting implements Renderable {
  render(options: RenderOptions): Iterable<Segment> {
    return [new Segment("Hello, World!\n")];
  }
}

console.print(new Greeting());
```

## Console Options

```typescript
const console = new Console({
  colorSystem: "truecolor", // null | "auto" | "standard" | "256" | "truecolor" | "windows"
  width: 120,               // override terminal width
  stderr: true,             // write to stderr
  record: true,             // record output for export
  highlight: false,         // disable auto-highlighting
  markup: false,            // disable markup processing
});
```

When `record: true`, export output after the fact:

```typescript
const text = console.exportText();
const html = console.exportHtml();
console.saveHtml("output.html");
```

## Environment Variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable all color |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color and style |
| `COLUMNS` / `LINES` | Override terminal dimensions |
