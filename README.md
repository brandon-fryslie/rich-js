# rich-js

A TypeScript port of Python's wonderful [Rich](https://github.com/Textualize/rich) library by @willmcgugan.

## Rich text and beautiful formatting in the terminal

The rich-js API makes it easy to add color and style to terminal output. It can also render pretty tables, progress bars, markdown, syntax highlighted source code, tracebacks, and more — out of the box.

## Compatibility

Works on Linux, macOS, and Windows. Requires Node.js >= 20. ESM-only.

## Installing

```sh
npm install @promptctl/rich-js
```

### Entry points

Most of the library comes from the package name itself — `Console`, `Table`, `Panel`, `Tree`, and everything else in the snippets below. Four areas sit behind package subpaths instead — worth knowing before you go looking for one of them in the main entry point and find nothing there:

| Import from | What lives there | What you install yourself | Why it's separate |
|---|---|---|---|
| `@promptctl/rich-js/widgets` | Button, Checkbox, Toggle, TextInput, Dropdown, Slider, and the screen that mounts them | `mobx` | Carries a third-party runtime dependency of its own — MobX, for widget state |
| `@promptctl/rich-js/template-bindings` | The styling vocabulary as Go-template functions, so styled text can be authored as a template | `@promptctl/go-template-js` | Carries a third-party runtime dependency of its own — the Go-template engine, for parsing and evaluating the templates |
| `@promptctl/rich-js/host` | `TerminalHost`, `BrowserTerminalHost`, `hostStream` — the seam between rendering and a terminal | Nothing | A program that just wants to write bytes through a host shouldn't pay for the widget set to do it |
| `@promptctl/rich-js/node/save`, `/node/prompt`, `/node/traceback`, `/node/terminal-host` | File export, readline input, the crash handler, and the node TTY host | Nothing | Each one reads node built-ins, and keeping them off the main entry point is what keeps that entry point browser-safe |

Those two peer dependencies are yours to install — `npm install @promptctl/rich-js` deliberately fetches neither, because a program that prints a table shouldn't acquire a state library or a template engine to do it. Add the ones you need:

```sh
npm install @promptctl/rich-js mobx @promptctl/go-template-js
```

Import `@promptctl/rich-js/widgets` without MobX, or `@promptctl/rich-js/template-bindings` without the engine, and the import itself fails, with `ERR_MODULE_NOT_FOUND`. The main entry point is unaffected — every snippet on this page that imports from `@promptctl/rich-js` runs on the plain install.

## Using the Console

Import and construct a `Console` object:

```typescript
import { Console } from "@promptctl/rich-js";

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
import { Console } from "@promptctl/rich-js";

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
import { Console, Table } from "@promptctl/rich-js";

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
import { track } from "@promptctl/rich-js";

for (const step of track(Array.from({ length: 100 }), { description: "Processing..." })) {
  await doStep(step);
}
```

For multiple progress bars and custom columns, use `Progress` directly:

```typescript
import { Progress, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn } from "@promptctl/rich-js";

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
import { Console, Status } from "@promptctl/rich-js";

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
import { Console, Tree } from "@promptctl/rich-js";

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
import { Console, Columns } from "@promptctl/rich-js";

const console = new Console();

const items = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"];
console.print(new Columns(items));
```

</details>

<details>
<summary>Markdown</summary>

Rich can render Markdown and translates the formatting to the terminal:

```typescript
import { Console, Markdown } from "@promptctl/rich-js";
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
import { Console, Syntax } from "@promptctl/rich-js";

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

Rich can print an error as its name and message followed by one line per stack frame, with library frames suppressed on request:

```typescript
import { Console, Traceback } from "@promptctl/rich-js";

const console = new Console();

try {
  riskyOperation();
} catch (error) {
  console.print(new Traceback(error));
}
```

To format every crash — uncaught exceptions and unhandled promise rejections alike — install the handler at your entry point:

```typescript
import { installTraceback } from "@promptctl/rich-js/node/traceback";

installTraceback();
```

`installTraceback` lives on the `node/traceback` subpath because it calls `process.on` and `process.exit`; the `Traceback` renderable itself stays in the main barrel, which remains browser-safe.

</details>

<details>
<summary>Interactive Widgets</summary>

Everything above draws once and returns. Widgets stay on screen and respond — a button that highlights under the cursor, a text field with a cursor you can move, a dropdown you filter by typing. They come from the `widgets` subpath and need MobX installed alongside the package (see [Entry points](#entry-points)).

```typescript
import { Button, TextInput, DefaultScreen, EventRouter } from "@promptctl/rich-js/widgets";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const host = new NodeTerminalHost();
const screen = new DefaultScreen({ host });
const router = new EventRouter({ screen, host });

const name = new TextInput({ placeholder: "your name" });
const submit = new Button({ label: "Submit", variant: "primary" });

const quit = (): void => {
  router.stop();
  screen.stop();
  host.write("\n");
};

submit.onSubmit(() => {
  quit();
  host.write(`hello, ${name.value}\n`);
  process.exit(0);
});

// Raw mode swallows Ctrl+C, so the app has to handle it itself.
router.onKey(
  (event) => {
    if (event.ctrl && event.key === "c") {
      quit();
      process.exit(0);
    }
  },
  { priority: "high" },
);

screen.mount(name, submit);
screen.start();
router.start();
```

`DefaultScreen` builds a focus manager when you don't pass one, so the `TextInput` has focus before the user touches anything and Tab moves between the two widgets. The screen re-renders through a MobX reaction: change a widget's state and the frame redraws itself, with no explicit repaint call anywhere. See [docs/widgets.md](docs/widgets.md) for the full widget set, key dispatch, layout placements, and how to write your own.

</details>

## Custom Renderables

All Rich renderables use the `Renderable` protocol. You can implement your own:

```typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Segment } from "@promptctl/rich-js";

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
import { saveHtml } from "@promptctl/rich-js/node/save";

const text = console.exportText();
const html = console.exportHtml();
saveHtml(console, "output.html");
```

`saveText` / `saveHtml` live on the `node/save` subpath because they import `node:fs`; the main barrel stays browser-safe.

## Demos

The [live demo gallery](https://brandon-fryslie.github.io/rich-js/master/demos/) runs every demo in your browser, against an xterm.js terminal — the same code that runs under Node, with nothing to install. Each gallery page links to the demo's source in [`examples/`](https://github.com/brandon-fryslie/rich-js/tree/master/examples), which is the place to look for working code to copy.

To run a demo in your own terminal instead, clone the repository, install, and use the demo's npm script:

```sh
git clone https://github.com/brandon-fryslie/rich-js.git
cd rich-js
npm install
npm run demo
```

| Script | Demo | What it shows |
|---|---|---|
| `npm run demo` | rich-explore | A file browser: a directory tree beside a Markdown, source-code, or JSON preview. `npm run demo -- <path>` browses somewhere other than the current directory. |
| `npm run sessions` | claude-sessions | A reader for the Claude Code session logs under `~/.claude/projects/`, with search across files. |
| `npm run dash` | rich-dash | A live dashboard: system stats, a running job, and this README rendered as Markdown. |
| `npm run demo-inputs` | rich-config | The widgets — checkbox, toggle, slider, dropdown, text input, button — driving a theme and palette viewer. |
| `npm run demo:dropdown` | dropdown-demo | Three `Dropdown` widgets: a plain one, one filtered as you type, and one whose options change every few seconds. |
| `npm run template-bindings` | rich-template-bindings | Type a template on the left and watch it render on the right. |
| `npm run themes-and-color-studio` | themes-and-color-studio | A printed tour of colours, palettes, bundled themes, and contrast. Prints once and exits; set `EXPORT_HTML=out.html` to save it as HTML too. |
| `npm run strip` | rich-strip | Every built-in `Joiner`, printed side by side. Prints once and exits. |
| `npm run markup-plugins` | rich-markup-plugins | Custom markup tags registered through `MarkupRegistry`. Prints once and exits. |

`Ctrl-C` quits any demo that stays running.

## Environment Variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable all color |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color and style |
| `COLUMNS` / `LINES` | Override terminal dimensions |
