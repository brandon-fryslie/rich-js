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
import { Console } from "@promptctl/rich-js";

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

Rich can render beautiful tracebacks that are easier to read and show more context than standard Node.js errors:

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

installTraceback({ showLocals: true });
```

`installTraceback` lives on the `node/traceback` subpath because it calls `process.on` and `process.exit`; the `Traceback` renderable itself stays in the main barrel, which remains browser-safe.

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

Every demo below also runs in your browser on the [live demo gallery](https://brandon-fryslie.github.io/rich-js/master/demos/) — the same code mounted against an xterm.js terminal, nothing to install. To drive one against your own terminal instead, run its npm script:

```sh
# Interactive
npm run demo                       # rich-explore — TUI file browser + markdown/code reader
npm run sessions                   # claude-sessions — Claude Code session browser
npm run demo-inputs                # rich-config — TextInput / palette search
npm run demo:dropdown              # dropdown-demo — Dropdown widget showcase
npm run dash                       # rich-dash — Live dashboard
npm run template-bindings          # rich-template-bindings — go-template / reactive bindings playground

# Non-interactive transcripts
npm run themes-and-color-studio    # color / palette / theme / contrast tour (eight sections)
npm run strip                      # rich-strip — side-by-side joiner showcase
npm run markup-plugins             # rich-markup-plugins — plugin-tag examples
```

`rich-explore`, `claude-sessions`, and `themes-and-color-studio` are covered in detail below. `package.json` holds the authoritative script list — `jq .scripts package.json` to see it.

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

### themes-and-color-studio — color, palette, theme, and contrast tour

A one-shot non-interactive demo that walks every public surface of the color subsystem in eight sections: ColorRgba values and parsing, ColorSpec and downgrade tables, color-system detection, the theme registry, colour references through `resolveColorRef`, every bundled `TerminalTheme` constant, OKLCH transposition (hue circle / chroma sweep / lightness invert / themeKeyForRoot), and the WCAG contrast toolkit.

```sh
npm run themes-and-color-studio                       # terminal output
EXPORT_HTML=out.html npm run themes-and-color-studio  # also write a styled HTML transcript
```

**Features exercised (incremental to above):**

| Module | How it's used |
|---|---|
| `ColorRgba` / `parseRgbHex` / `parseRgbaHex` / `blendRgb` | Pixel-level values, two hex parsers, linear blend, alpha compositing |
| `ColorSpec` / `ColorDepth` | Every factory; downgrade across `STANDARD_TABLE` / `EIGHT_BIT_TABLE` / `WINDOWS_TABLE`; `ANSI_COLOR_NAMES` lookups; `ColorParseError` |
| `detectColorSystem` / `resolveColorSystem` | Env-driven color-system detection with `DetectColorOptions` fixtures; spec-string resolution |
| `Palette` / `resolveColorRef` / `parseHexColor` / `buildPalette` | Palette names and `#RRGGBB` literals through one checkpoint against gruvbox, including the hex round-trip that shows it is idempotent and the `ColorRefError` miss; `BaseColors` → derived `text-*` / `on-*` / `*-muted` vars |
| Theme registry | `getThemePalette` / `listThemePalettes` / `getThemeBaseColors` walking every bundled theme; raw `THEMES` / `ThemePaletteData` via subpath |
| `TerminalTheme` constants | All bundled constants (`DEFAULT`, `SVG_EXPORT`, `MONOKAI`, `NORD`, `GRUVBOX`, `DRACULA`, `TOKYO_NIGHT`, `FLEXOKI`, `CYBERPUNK`, `CATPPUCCIN_*`, `SOLARIZED_*`, `ROSE_PINE*`, `ATOM_ONE_*`, `TEXTUAL_*`) |
| `Oklch` / `transposePalette` / `themeKeyForRoot` | Round-trip + `IDENTITY` / `INVERT_LIGHTNESS`; hue circle; chroma sweep; light↔dark invert; `ANCHORED_ROOTS` / `isAnchored` |
| `relativeLuminance` / `contrastRatio` / `contrastFor` / `ensureContrast` | WCAG contrast matrix, hue-preserving lightness adjustment to clear the AA threshold |
| `Console` record / `saveHtml` | Optional HTML export via `EXPORT_HTML=path`; same render pipeline drives both terminal and file output |

---

### Demo coverage is checked, not claimed

`test/coverage/coverage.test.ts` asserts that every public export is referenced by at least one file under `examples/`. Add a public export without demoing it and CI fails.

The check builds its universe from `package.json#exports` when the test loads, so there is no hand-written list of covered symbols to maintain — and none to drift out of date. Coverage is counted per *symbol origin*, meaning the declaring file plus the declared name, so one declaration re-exported under two names is still one thing to demonstrate. Renaming a symbol on import inside a demo still counts; `import * as rich` does not, because a namespace import never names what it pulls in.

An export that genuinely cannot be demonstrated at runtime belongs in `test/coverage/coverage-allowlist.ts` with a written reason. The allowlist is validated in both directions: an entry pointing at no real export fails the suite, and so does an entry for something a demo now covers. You can neither widen the exemption quietly nor leave a stale one lying around.

Two things to know before adding a demo. `examples/shared/` is a helper module rather than a demo, and references from it count — the verifier walks every file under `examples/`, not just the entry points. And a demo reaches the browser gallery only if it has an `examples/<name>/wire.ts`; `npm run demos:build` fails loudly when a `wire.ts` has no compiled output rather than dropping the demo from the site.

That check is a floor, not a goal. A script that imports thirty exports and prints them in sequence passes it; a small interactive TUI that lets you drive eight of them in a real composition is the better demo, and no test can tell you which one you wrote.

**Bugs found and fixed via demo integration** — the argument for exercising the library this way rather than only in unit tests:

| Bug | Location | Impact | Fix |
|---|---|---|---|
| `Live.refresh()` strips all ANSI styles | `Live.refresh` in `src/renderables/live.ts` | Every renderable flowing through `Live` (including `Status`, `Progress`, `Spinner`) appeared unstyled | Apply `style.render(text, colorSystem)` instead of bare `s.text` |
| `Progress.render()` drops column styles | `Progress.render` in `src/renderables/progress.ts` | Progress percentage, timing, and spinner styles were stripped when building table cells | Use `RichText.append(text, style)` to preserve segment styles |
| `Tree` emits double blank lines | `Tree.render` in `src/renderables/tree.ts` | Label rendering and the explicit `Segment.line()` both contributed a newline, producing blank lines between tree entries | Make `RichText` stop emitting a trailing newline so `Tree`'s explicit `yield Segment.line()` remains the only line break |
| `Spinner` constructor rejects `undefined` name | `Spinner` constructor in `src/renderables/spinner.ts` | `SpinnerColumn` (used by `Progress`) passed optional `string \| undefined` to required `string` parameter | Make `name` optional, default to `DEFAULT_SPINNER` |

## Environment Variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable all color |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color and style |
| `COLUMNS` / `LINES` | Override terminal dimensions |
