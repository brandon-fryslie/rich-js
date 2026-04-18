# rich-js

A TypeScript port of Python's wonderful [Rich](https://github.com/Textualize/rich) library by @willmcgugan.

## Rich text and beautiful formatting in the terminal

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

## Demos

Three interactive TUI demos exercise the library's renderables against real-world use cases. Each runs in alt-screen mode with flicker-free rendering.

```sh
npm run demo               # rich-explore: file browser
npm run sessions           # claude-sessions: Claude Code session browser
npm run colors             # rich-colors: interactive color palette generator
```

### rich-explore — TUI file browser + markdown/code reader

A two-pane file browser with a directory tree on the left and a file preview on the right. Navigate with vim-style keys, Tab to switch focus, Enter/arrow keys to expand/collapse directories.

```sh
npm run demo               # browse current directory
npm run demo -- /some/path # browse a specific path
```

**Features exercised:**

| Module | How it's used |
|---|---|
| `Console` | Render orchestrator, style application, color-system detection |
| `Layout` | Row split (tree / preview), column split (header / body / footer), `ratio` and `size` allocation |
| `Panel` | Bordered panes with dynamic titles (`▸ Tree (20)`), `borderStyle`, `padding`, focus-aware styling |
| `Tree` | Recursive directory tree with guide lines, `guide_style`, mixed RichText labels |
| `Table` + `Column` | Directory listing (name, kind, size, mtime), styled headers, right-justified columns |
| `Markdown` | Renders `.md` files in the preview pane |
| `Syntax` | Syntax-highlighted source code with `lineNumbers` and per-extension language detection |
| `JSONRenderable` | Pretty-printed + highlighted JSON file preview |
| `RichText` + `Span` | Labels, headers, status bar; `.stylize()`, `.append()`, `end` control |
| `Style` | Parsed inline everywhere (`"bold cyan"`, `"reverse bold"`, `"bold white on blue"`) |
| `Segment` | Used directly in the `Window` renderable for line splitting, padding, and clipping |
| `Renderable` protocol | Custom `Window` class implements `Renderable` for viewport clipping |
| `Box` | `ROUNDED` (Panel default), `HEAVY_HEAD` (Table default) |

### claude-sessions — Claude Code session browser

Browses `~/.claude/projects/` JSONL session files. Two-level sidebar (projects → sessions) on top, conversation viewer below. Pretty-prints every block type (human turns, assistant responses, tool calls, subagents, system events, errors) with per-block raw-JSON toggle. Includes local search, global cross-file search, subagent drill-down with session stack, and hidden-block reveal.

```sh
npm run sessions
```

**Key bindings:** `↑↓/jk` navigate, `→/Enter` open/drill, `←` back, `Tab` focus, `\` toggle browser, `v` raw view, `e` expand, `H` hidden blocks, `/` local search, `S` global search, `n/N` next/prev match, `p` parent, `u` pop subagent, `q` quit.

**Features exercised (incremental to rich-explore):**

| Module | How it's used |
|---|---|
| `Rule` | Turn-duration system blocks rendered as horizontal dividers; input/output separators in tool-call blocks |
| `Group` | Composes multi-section tool-call blocks (input + Rule + result) into a single renderable |
| `Pretty` | Per-block raw view (toggled with `v`) — exercises `ReprHighlighter`, indent guides, `maxString`, `expandAll` |
| `Traceback` | Error blocks with stack traces render via `Traceback` for styled frame display |
| `Markdown` | Assistant text rendering (Claude output is often markdown) |
| `Syntax` | Bash command highlighting in tool-call input summaries |
| `Panel` | Six distinct border-color schemes by block kind (cyan/blue/yellow/red/magenta/green) |
| `Layout` | Column split (browser-on-top / viewer-on-bottom), dynamic height budgeting |

### rich-colors — Interactive color palette generator

An interactive palette generator exploring `Color`, `Style`, and terminal color math. Generates palettes from seed colors, displays color swatches, and lets you adjust parameters interactively.

```sh
npm run colors
```

**Features exercised (incremental to above):**

| Module | How it's used |
|---|---|
| `Color` | Direct `Color` construction, `blendRgb`, color math, palette generation |
| `TerminalTheme` | `DEFAULT_TERMINAL_THEME`, `MONOKAI`, `SVG_EXPORT_THEME` theme constants |
| `ANSI_COLOR_NAMES` | Named ANSI color enumeration and display |
| `Style` | Direct `Style` construction from `Color` objects (not just string parsing) |
| `Spinner` | Visual activity indicator in input mode |

---

### Coverage summary

**Exercised across demos:**

Core: `Console`, `Style`/`StyleStack`, `RichText`/`Span`, `Segment`, `Box` (multiple variants), `Color`/`blendRgb`/palettes, `Renderable`/`Measurable` protocol, `Measurement`, `cells` (transitively), `ReprHighlighter`, `JSONHighlighter`, `Spinner` data, `TerminalTheme`

Renderables: `Layout`, `Panel`, `Tree`, `Table`/`Column`, `Markdown`, `Syntax`, `JSONRenderable`, `Rule`, `Group`, `Spinner`, `Pretty`, `Traceback`

**Bugs found and fixed via demo integration:**

| Bug | Location | Impact | Fix |
|---|---|---|---|
| `Live.refresh()` strips all ANSI styles | `src/renderables/live.ts:106` | Every renderable flowing through `Live` (including `Status`, `Progress`, `Spinner`) appeared unstyled | Apply `style.render(text, colorSystem)` instead of bare `s.text` |
| `Progress.render()` drops column styles | `src/renderables/progress.ts:273` | Progress percentage, timing, and spinner styles were stripped when building table cells | Use `RichText.append(text, style)` to preserve segment styles |
| `Tree` emits double blank lines | `src/renderables/tree.ts:98,122` | Extra `Segment.line()` after label render duplicated the newline already emitted by `RichText.render()` | Remove redundant `yield Segment.line()` |
| `Spinner` constructor rejects `undefined` name | `src/renderables/spinner.ts:36` | `SpinnerColumn` (used by `Progress`) passed optional `string \| undefined` to required `string` parameter | Make `name` optional, default to `DEFAULT_SPINNER` |

**Not yet exercised — candidates for new demos or demo additions:**

| Module | Notes | Suggested coverage |
|---|---|---|
| `Constrain` | Width-constraint wrapper | Wrap preview pane content in rich-explore |
| `Align` | Left/center/right alignment | Center headers or Rule titles |
| `Padding` | Standalone padding wrapper | Wrap block renderers in claude-sessions |
| `Columns` | Multi-column grid layout (like `ls -C`) | Add an "icons" view to rich-explore's directory renderer |
| `ProgressBar` | Standalone progress bar | New demo: file copy/download progress visualization |
| `Progress` | Multi-task progress manager with columns (`TextColumn`, `BarColumn`, `TaskProgressColumn`, `TimeRemainingColumn`, `TimeElapsedColumn`, `SpinnerColumn`, `MofNCompleteColumn`, `track`) | New demo: multi-file processor with parallel progress bars (bugs now fixed — ready to exercise) |
| `Live` | Rich's live-update primitive | Replace the custom render loops in demos (style bug now fixed — ready to exercise) |
| `Status` | Spinner + message display | Loading indicator for large sessions in claude-sessions (depends on `Live`, which is now fixed) |
| `Prompt` / `IntPrompt` / `FloatPrompt` / `Confirm` | Interactive input via readline | Add a go-to-path prompt in rich-explore; incompatible with raw-mode loops so needs a modal switch |
| `emoji` | Shortcode substitution (`:smiley:` → 😃) | Enable in markup-rendered block text in claude-sessions |
| `markup` | `[bold red]...[/]` parsing | Pass assistant text through markup rendering in claude-sessions |
| `NullHighlighter` / `RegexHighlighter` / `ISO8601Highlighter` | Specialized highlighters | Apply `ISO8601Highlighter` to timestamps; `RegexHighlighter` for search-term highlighting |
| `StyleStack` / `Theme` / `DEFAULT_STYLES` | Theme customization | Add a theme switcher to rich-colors |
| `Color` downgrading | `standard` / `256` / `windows` color system fallbacks | Add a color-system picker to rich-colors |
| `Console` recording | `record`, `exportText`, `exportHtml`, `saveHtml` | Add an export-to-HTML feature to claude-sessions |
| Most `Box` variants | `ASCII`, `SQUARE`, `MINIMAL`, `HEAVY`, `DOUBLE`, `MARKDOWN`, etc. | Add a box-style picker to rich-explore's Panel borders |
| `Measurement.get()` / `measureRenderables` | Explicit width measurement | Used internally; could add a measurement debug overlay |

## Environment Variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable all color |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color and style |
| `COLUMNS` / `LINES` | Override terminal dimensions |
