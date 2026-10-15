/** Part of the rich-js repository, as it is, written by scripts/stage-repo-files.ts. */
import type { MemoryDirectory } from "../../_capabilities/memory-file-system.js";

/** Base64's bytes as a string of one character per byte. */
const latin1 = (base64: string): string => atob(base64);

export const RICH_JS: MemoryDirectory = { kind: "directory", children: {
  "package.json": { kind: "file", mtime: new Date("2026-10-12T12:13:55.239Z"), content: `{
  "name": "@promptctl/rich-js",
  "version": "0.19.0",
  "description": "Rich text and beautiful formatting in the terminal — a TypeScript port of Python's Rich",
  "repository": {
    "type": "git",
    "url": "https://github.com/brandon-fryslie/rich-js"
  },
  "type": "module",
  "sideEffects": false,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./themes/data": {
      "types": "./dist/themes/data/index.d.ts",
      "import": "./dist/themes/data/index.js"
    },
    "./themes/registry": {
      "types": "./dist/themes/registry.d.ts",
      "import": "./dist/themes/registry.js"
    },
    "./host": {
      "types": "./dist/host/index.d.ts",
      "import": "./dist/host/index.js"
    },
    "./widgets": {
      "types": "./dist/widgets/index.d.ts",
      "import": "./dist/widgets/index.js"
    },
    "./template-bindings": {
      "types": "./dist/template-bindings/index.d.ts",
      "import": "./dist/template-bindings/index.js"
    },
    "./node/save": {
      "types": "./dist/node/save.d.ts",
      "import": "./dist/node/save.js"
    },
    "./node/prompt": {
      "types": "./dist/node/prompt.d.ts",
      "import": "./dist/node/prompt.js"
    },
    "./node/traceback": {
      "types": "./dist/node/traceback.d.ts",
      "import": "./dist/node/traceback.js"
    },
    "./node/terminal-host": {
      "types": "./dist/node/terminal-host.d.ts",
      "import": "./dist/node/terminal-host.js"
    }
  },
  "files": [
    "dist",
    "THIRD-PARTY-NOTICES"
  ],
  "scripts": {
    "prepublishOnly": "node scripts/verify-release-tag.mjs && node scripts/verify-entry-points.mjs",
    "build": "npm run clean && tsc",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit && tsc -p tsconfig.scripts.json && tsc -p tsconfig.test.json",
    "clean": "rm -rf dist",
    "docs:dev": "vitepress dev docs",
    "docs:build": "vitepress build docs",
    "docs:preview": "vitepress preview docs",
    "demo": "node scripts/build-demos.ts && node dist-demo/examples/rich-explore/node.js",
    "demo:build": "node scripts/build-demos.ts",
    "sessions": "node scripts/build-demos.ts && node dist-demo/examples/claude-sessions/node.js",
    "strip": "node scripts/build-demos.ts && node dist-demo/examples/rich-strip/main.js",
    "effects-feel": "node scripts/build-demos.ts && node dist-demo/examples/effects-feel/index.js",
    "viewport": "node scripts/build-demos.ts && node dist-demo/examples/rich-viewport/main.js",
    "markup-plugins": "node scripts/build-demos.ts && node dist-demo/examples/rich-markup-plugins/main.js",
    "demo-inputs": "node scripts/build-demos.ts && node dist-demo/examples/rich-config/main.js",
    "demo:dropdown": "node scripts/build-demos.ts && node dist-demo/examples/dropdown-demo/main.js",
    "dash": "node scripts/build-demos.ts && node dist-demo/examples/rich-dash/node.js",
    "template-bindings": "node scripts/build-demos.ts && node dist-demo/examples/rich-template-bindings/main.js",
    "themes-and-color-studio": "node scripts/build-demos.ts && node dist-demo/examples/themes-and-color-studio/node.js",
    "terminal-host": "node scripts/build-demos.ts && node dist-demo/examples/terminal-host/main.js",
    "test:demos": "playwright test"
  },
  "keywords": [
    "terminal",
    "rich",
    "ansi",
    "color",
    "table",
    "panel",
    "tree",
    "syntax",
    "markdown",
    "progress",
    "cli"
  ],
  "license": "MIT",
  "devEngines": {
    "runtime": { "name": "node", "version": "^22.18.0 || >=23.6.0", "onFail": "error" }
  },
  "engines": {
    "node": ">=20"
  },
  "devDependencies": {
    "@codemirror/commands": "^6.11.1",
    "@codemirror/lang-javascript": "^6.2.5",
    "@codemirror/language": "^6.12.4",
    "@codemirror/state": "^6.7.6",
    "@codemirror/view": "^6.43.13",
    "@lezer/highlight": "^1.2.5",
    "@playwright/test": "^1.63.0",
    "@promptctl/go-template-js": "^0.10.0",
    "@types/markdown-it": "^14.2.0",
    "@types/node": "^26.5.1",
    "@types/semver": "^7.8.0",
    "@xterm/headless": "^6.0.0",
    "markdown-it": "^14.3.2",
    "markdown-it-container": "^4.0.0",
    "mobx": "^7.0.3",
    "node-inspect-extracted": "^3.3.3",
    "semver": "^7.8.5",
    "strip-ansi": "^7.2.0",
    "sucrase": "^3.35.1",
    "typescript": "^6.0.3",
    "vite": "^8.3.0",
    "vitepress": "^1.6.4",
    "vitest": "^5.0.0"
  },
  "dependencies": {
    "string-width": "^8.2.2"
  },
  "peerDependencies": {
    "@promptctl/go-template-js": "^0.10.0",
    "mobx": "^7.0.3"
  },
  "peerDependenciesMeta": {
    "@promptctl/go-template-js": {
      "optional": true
    },
    "mobx": {
      "optional": true
    }
  }
}
` },
  "tsconfig.json": { kind: "file", mtime: new Date("2026-09-16T15:02:47.767Z"), content: `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,

    /*
     * [LAW:one-source-of-truth] \`dist/\` is the npm artifact and nothing else, so
     * what this config emits is what a consumer receives. A map here would point
     * at \`../../src/…\`, and \`package.json#files\` does not publish \`src/\`: every
     * one would resolve to a path absent from the consumer's \`node_modules\`, and
     * each \`.js\`/\`.d.ts\` would carry a \`sourceMappingURL\` to it. Emitting none
     * leaves no dead reference; the ES2022 output keeps its comments and reads
     * as the source minus its types. Local debugging keeps its maps through
     * \`tsconfig.demo.json\`, whose output sits beside the sources they name.
     * Recorded on ticket rich-artifact-c9k.2.
     */
    "declarationMap": false,
    "sourceMap": false,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "exactOptionalPropertyTypes": false
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
` },
  ".gitignore": { kind: "file", mtime: new Date("2026-10-12T12:13:55.236Z"), content: `node_modules/
dist/
dist-demo/
*.tsbuildinfo
docs/.vitepress/dist/
docs/.vitepress/cache/
playwright-report/
test-results/
.idea/
.mcp.json
.claude/*.lock
.claude/worktrees/
` },
  "LICENSE": { kind: "file", mtime: new Date("2026-09-16T14:47:01.293Z"), content: `MIT License

Copyright (c) 2026 Brandon Fryslie

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
` },
  "README.md": { kind: "file", mtime: new Date("2026-10-12T11:54:46.671Z"), content: `# rich-js

A TypeScript port of Python's wonderful [Rich](https://github.com/Textualize/rich) library by @willmcgugan.

## Rich text and beautiful formatting in the terminal

The rich-js API makes it easy to add color and style to terminal output. It can also render pretty tables, progress bars, markdown, syntax highlighted source code, tracebacks, and more — out of the box.

## Compatibility

Works on Linux, macOS, and Windows. Requires Node.js >= 20. ESM-only.

## Installing

\`\`\`sh
npm install @promptctl/rich-js
\`\`\`

### Entry points

Most of the library comes from the package name itself — \`Console\`, \`Table\`, \`Panel\`, \`Tree\`, and everything else in the snippets below. Four areas sit behind package subpaths instead — worth knowing before you go looking for one of them in the main entry point and find nothing there:

| Import from | What lives there | What you install yourself | Why it's separate |
|---|---|---|---|
| \`@promptctl/rich-js/widgets\` | Button, Checkbox, Toggle, TextInput, Dropdown, Slider, and the screen that mounts them | \`mobx\` | Carries a third-party runtime dependency of its own — MobX, for widget state |
| \`@promptctl/rich-js/template-bindings\` | The styling vocabulary as Go-template functions, so styled text can be authored as a template | \`@promptctl/go-template-js\` | Carries a third-party runtime dependency of its own — the Go-template engine, for parsing and evaluating the templates |
| \`@promptctl/rich-js/host\` | \`TerminalHost\`, \`BrowserTerminalHost\`, \`hostEnvironment\` — the seam between rendering and a terminal | Nothing | A program that just wants to write bytes through a host shouldn't pay for the widget set to do it |
| \`@promptctl/rich-js/node/save\`, \`/node/prompt\`, \`/node/traceback\`, \`/node/terminal-host\` | File export, readline input, the crash handler, and the node TTY host | Nothing | Each one reads node built-ins, and keeping them off the main entry point is what keeps that entry point browser-safe |

Those two peer dependencies are yours to install — \`npm install @promptctl/rich-js\` deliberately fetches neither, because a program that prints a table shouldn't acquire a state library or a template engine to do it. Add the ones you need:

\`\`\`sh
npm install @promptctl/rich-js mobx @promptctl/go-template-js
\`\`\`

Import \`@promptctl/rich-js/widgets\` without MobX, or \`@promptctl/rich-js/template-bindings\` without the engine, and the import itself fails, with \`ERR_MODULE_NOT_FOUND\`. The main entry point is unaffected — every snippet on this page that imports from \`@promptctl/rich-js\` runs on the plain install.

## Using the Console

Import and construct a \`Console\` object:

\`\`\`typescript
import { Console } from "@promptctl/rich-js";

const console = new Console();
\`\`\`

The \`Console\` object has a \`print\` method similar to the built-in \`console.log\`. Rich will word-wrap your text to fit within the terminal width.

\`\`\`typescript
console.print("Hello", "World!");
\`\`\`

Add color and style with a \`style\` argument:

\`\`\`typescript
console.print("Hello, World!", { style: "bold red" });
\`\`\`

For finer-grained styling, Rich renders markup using a syntax similar to bbcode:

\`\`\`typescript
console.print("Where there is a [bold cyan]Will[/bold cyan] there [u]is[/u] a [i]way[/i].");
\`\`\`

## Rich Library

Rich includes a number of built-in renderables for creating elegant terminal output.

<details>
<summary>Log</summary>

The \`Console\` object has a \`log()\` method similar to \`print()\`, but adds a timestamp column on the left. Rich will syntax-highlight data structures automatically.

\`\`\`typescript
import { Console } from "@promptctl/rich-js";

const console = new Console();

console.log("Server started");
console.log({ status: 200, method: "GET", path: "/api/users" });
\`\`\`

</details>

<details>
<summary>Emoji</summary>

Insert an emoji in console output by placing the name between two colons:

\`\`\`typescript
console.print(":smiley: :vampire: :pile_of_poo: :thumbs_up: :raccoon:");
// 😃 🧛 💩 👍 🦝
\`\`\`

</details>

<details>
<summary>Tables</summary>

Rich can render flexible tables with unicode box characters. There is a large variety of formatting options for borders, styles, and cell alignment.

\`\`\`typescript
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
\`\`\`

The \`Table\` class resizes columns to fit the available terminal width, wrapping text as required. Console markup is rendered inside cells, and any \`Renderable\` can be used as a cell value — including other tables.

</details>

<details>
<summary>Progress Bars</summary>

Rich can render multiple flicker-free progress bars to track long-running tasks.

For basic usage, wrap any iterable with \`track\`:

\`\`\`typescript
import { track } from "@promptctl/rich-js";

for (const step of track(Array.from({ length: 100 }), { description: "Processing..." })) {
  await doStep(step);
}
\`\`\`

For multiple progress bars and custom columns, use \`Progress\` directly:

\`\`\`typescript
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
\`\`\`

</details>

<details>
<summary>Status</summary>

For situations where it is hard to calculate progress, use \`Status\` to display a spinner animation with a message:

\`\`\`typescript
import { Console, Status } from "@promptctl/rich-js";

const console = new Console();

const status = new Status("[bold green]Working on tasks...", { console });
status.start();

for (const task of tasks) {
  await processTask(task);
  console.log(\`\${task} complete\`);
}

status.stop();
\`\`\`

</details>

<details>
<summary>Tree</summary>

Rich can render a tree with guide lines — ideal for displaying file structures or any other hierarchical data:

\`\`\`typescript
import { Console, Tree } from "@promptctl/rich-js";

const console = new Console();

const tree = new Tree(":open_file_folder: root");
const branch = tree.add(":file_folder: src");
branch.add(":page_facing_up: index.ts");
branch.add(":page_facing_up: utils.ts");
tree.add(":page_facing_up: package.json");

console.print(tree);
\`\`\`

Tree labels can be plain text, markup strings, or any \`Renderable\`.

</details>

<details>
<summary>Columns</summary>

Rich can render content in neat columns with equal or optimal width:

\`\`\`typescript
import { Console, Columns } from "@promptctl/rich-js";

const console = new Console();

const items = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"];
console.print(new Columns(items));
\`\`\`

</details>

<details>
<summary>Markdown</summary>

Rich can render Markdown and translates the formatting to the terminal:

\`\`\`typescript
import { Console, Markdown } from "@promptctl/rich-js";
import { readFileSync } from "fs";

const console = new Console();
const md = new Markdown(readFileSync("README.md", "utf-8"));
console.print(md);
\`\`\`

</details>

<details>
<summary>Syntax Highlighting</summary>

Rich can render syntax-highlighted source code:

\`\`\`typescript
import { Console, Syntax } from "@promptctl/rich-js";

const console = new Console();

const code = \`
function greet(name: string): string {
  return \\\`Hello, \\\${name}!\\\`;
}
\`;

const syntax = new Syntax(code, "typescript", { theme: "monokai", lineNumbers: true });
console.print(syntax);
\`\`\`

</details>

<details>
<summary>Tracebacks</summary>

Rich can print an error as its name and message followed by one line per stack frame, with library frames suppressed on request:

\`\`\`typescript
import { Console, Traceback } from "@promptctl/rich-js";

const console = new Console();

try {
  riskyOperation();
} catch (error) {
  console.print(new Traceback(error));
}
\`\`\`

To format every crash — uncaught exceptions and unhandled promise rejections alike — install the handler at your entry point:

\`\`\`typescript
import { installTraceback } from "@promptctl/rich-js/node/traceback";

installTraceback();
\`\`\`

\`installTraceback\` lives on the \`node/traceback\` subpath because it calls \`process.on\` and \`process.exit\`; the \`Traceback\` renderable itself stays in the main barrel, which remains browser-safe.

</details>

<details>
<summary>Interactive Widgets</summary>

Everything above draws once and returns. Widgets stay on screen and respond — a button that highlights under the cursor, a text field with a cursor you can move, a dropdown you filter by typing. They come from the \`widgets\` subpath and need MobX installed alongside the package (see [Entry points](#entry-points)).

\`\`\`typescript
import { Group } from "@promptctl/rich-js";
import { Button, TextInput, WidgetApp } from "@promptctl/rich-js/widgets";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const name = new TextInput({ placeholder: "your name" });
const submit = new Button({ label: "Submit", variant: "primary" });
const form = new Group(name, submit);

const app = new WidgetApp({ host: new NodeTerminalHost(), surface: "alternate", view: () => form });

submit.onSubmit(() => app.stop());

// Raw mode swallows Ctrl+C, so the app has to handle it itself.
app.onKey(
  (event) => {
    if (event.ctrl && event.key === "c") app.stop();
  },
  { priority: "high" },
);

await app.run();
console.log(\`hello, \${name.value}\`);
\`\`\`

Widgets go anywhere a renderable goes — a \`Group\`, a \`Panel\`, a \`Layout\` pane — and the app finds them on the frame it paints. The \`TextInput\` has focus before the user touches anything, Tab moves between the two widgets in the order they are drawn, and a change to a widget's state repaints with no explicit call. \`app.stop()\` — or a crash, or a signal — hands the terminal back. See [docs/widgets.md](docs/widgets.md) for the full widget set, key dispatch, layout, and how to write your own.

</details>

## Custom Renderables

All Rich renderables use the \`Renderable\` protocol. You can implement your own:

\`\`\`typescript
import type { Renderable, RenderOptions } from "@promptctl/rich-js";
import { Segment } from "@promptctl/rich-js";

class Greeting implements Renderable {
  render(options: RenderOptions): Iterable<Segment> {
    return [new Segment("Hello, World!\\n")];
  }
}

console.print(new Greeting());
\`\`\`

## Console Options

\`\`\`typescript
const console = new Console({
  colorSystem: "truecolor", // null | "auto" | "none" | "ansi" | "256" | "truecolor"
  width: 120,               // override terminal width
  stderr: true,             // write to stderr
  record: true,             // record output for export
  highlight: false,         // disable auto-highlighting
  markup: false,            // disable markup processing
});
\`\`\`

When \`record: true\`, export output after the fact:

\`\`\`typescript
import { SOLARIZED_LIGHT, SVG_EXPORT_THEME } from "@promptctl/rich-js";
import { saveSvg } from "@promptctl/rich-js/node/save";

const text = console.exportText({ clear: false });
const html = console.exportHtml({ theme: SOLARIZED_LIGHT, clear: false });
saveSvg(console, "output.svg", { theme: SVG_EXPORT_THEME });
\`\`\`

\`saveText\`, \`saveHtml\` and \`saveSvg\` live on the \`node/save\` subpath because they import \`node:fs\`; the main barrel stays browser-safe. The [console guide](https://brandon-fryslie.github.io/rich-js/master/console#exporting) covers what each export draws, the themes it takes, and when it clears the recording.

## Demos

The [live demo gallery](https://brandon-fryslie.github.io/rich-js/master/demos/) runs every demo in your browser, against an xterm.js terminal — the same code that runs under Node, with nothing to install. Each gallery page links to the demo's source in [\`examples/\`](https://github.com/brandon-fryslie/rich-js/tree/master/examples), which is the place to look for working code to copy.

To run a demo in your own terminal instead, clone the repository, install, and use the demo's npm script:

\`\`\`sh
git clone https://github.com/brandon-fryslie/rich-js.git
cd rich-js
npm install
npm run demo
\`\`\`

| Script | Demo | What it shows |
|---|---|---|
| \`npm run demo\` | rich-explore | A file browser: a directory tree beside a Markdown, source-code, or JSON preview. \`npm run demo -- <path>\` browses somewhere other than the current directory. |
| \`npm run sessions\` | claude-sessions | A reader for the Claude Code session logs under \`~/.claude/projects/\`, with search across files. |
| \`npm run dash\` | rich-dash | A live dashboard: system stats, a running job, and this README rendered as Markdown. |
| \`npm run demo-inputs\` | rich-config | The widgets — checkbox, toggle, slider, dropdown, text input, button — driving a theme and palette viewer. |
| \`npm run demo:dropdown\` | dropdown-demo | Three \`Dropdown\` widgets: a plain one, one filtered as you type, and one whose options change every few seconds. |
| \`npm run template-bindings\` | rich-template-bindings | Type a template on the left and watch it render on the right. |
| \`npm run themes-and-color-studio\` | themes-and-color-studio | A printed tour of colours, palettes, bundled themes, and contrast. Prints once and exits; set any of \`EXPORT_HTML=out.html\`, \`EXPORT_SVG=out.svg\` and \`EXPORT_TEXT=out.txt\` to also save it to each file named. |
| \`npm run strip\` | rich-strip | Every built-in \`Joiner\`, printed side by side. Prints once and exits. |
| \`npm run effects-feel\` | effects-feel | Shimmer, a gentle pulse on chosen elements, sparkle, a hue wheel, fade-in and a dissolve-out that eddies back before it goes, on a powerline strip and a run of text, at a colour depth you choose, with keys to step the frame rate, the demo's pace and the theme while it runs. A demo for agreeing how the effects feel; \`npm run effects-feel -- --help\` lists the flags and keys. |
| \`npm run markup-plugins\` | rich-markup-plugins | Custom markup tags registered through \`MarkupRegistry\`. Prints once and exits. |
| \`npm run viewport\` | rich-viewport | A selection you move through a list taller than its window with the arrow keys, \`j\`/\`k\`, PgUp/PgDn and Home/End, kept in view by \`Viewport.ensureVisible\`; the mouse wheel scrolls the window, and \`q\` quits. |
| \`npm run terminal-host\` | terminal-host | Each key you press printed as the bytes the terminal sends for it, and each resize as the new size — a program written against \`TerminalHost\` alone. \`examples/terminal-host/embed.ts\` runs the same program on an xterm.js terminal in your own page. |

\`Ctrl-C\` quits any demo that stays running.

## Environment Variables

| Variable | Effect |
|---|---|
| \`NO_COLOR\` | Disable all color (hyperlinks still print) |
| \`FORCE_COLOR\` | Enable color regardless of \`TERM\` |
| \`TERM=dumb\` | Disable color, style, and hyperlinks |
| \`COLUMNS\` / \`LINES\` | Override terminal dimensions |
` },
  ".github": { kind: "directory", children: {
    "workflows": { kind: "directory", children: {
      "ci.yml": { kind: "file", mtime: new Date("2026-10-12T12:13:55.236Z"), content: `# [LAW:single-enforcer] One gate, and one definition of it. The checks live in
# \`.github/actions/gate\` — this workflow is the master/PR path that runs them,
# \`publish.yml\` is the release path that runs the same action. A check added to
# the action is a check the release path cannot skip, which is the property this
# split exists to hold; it did not hold when the two lists were written out
# separately.
#
# The demo gate (rich-demo-site-pek.5) builds the docs site and asserts every
# demo under examples/ runs cleanly in its card in real Chromium.

name: CI

on:
  push:
    branches: [master]
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7

      # [LAW:one-source-of-truth] \`package.json#engines.node\` is the canonical
      # supported-runtime declaration; setup-node reads it via
      # \`node-version-file\` so the workflow cannot drift from it. The range
      # itself is deliberately not repeated here — this comment used to name it,
      # and to credit it to a transitive dependency, and both halves were false
      # by the time anyone read them. \`test/seam/node-floor.test.ts\` is what
      # decides the range now. \`deploy.yml\` and \`publish.yml\`'s gate job read
      # the same file and point back here rather than restating any of this.
      #
      # What setup-node does with a range is pick the NEWEST version satisfying
      # it, not the oldest: the run at ^20.19.0 || >=22.12.0 logged "Resolved
      # package.json as ^20.19.0 || >=22.12.0" and then took 24.20.0. So this
      # job proves the package works at the top of its supported range and says
      # nothing about the floor.
      #
      # The bottom is the \`node-floor\` job below.
      - uses: actions/setup-node@v7
        with:
          node-version-file: package.json
          cache: npm

      - run: npm ci

      - uses: ./.github/actions/gate

  # The tarball, installed and rendered on the lowest Node \`engines.node\`
  # admits. Its own job because the action switches the job's Node; the action
  # owns the argument.
  node-floor:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7

      # The tarball is built the way every other job builds: on the Node the
      # version file resolves to. Only the consumer runs on the floor.
      - uses: actions/setup-node@v7
        with:
          node-version-file: package.json
          cache: npm

      - run: npm ci

      - run: npm run build

      - uses: ./.github/actions/node-floor
` },
    } },
  } },
  "src": { kind: "directory", children: {
    "core": { kind: "directory", children: {
      "anchor.ts": { kind: "file", mtime: new Date("2026-09-29T11:58:07.632Z"), content: `/**
 * Anchor — where a cell sat in the output of the thing that drew it.
 *
 * A widget nested inside a \`Layout\` cell inside a \`Panel\` does not know where
 * it lands on screen, and nothing can tell it before it renders: \`Align\`
 * centres each line only after rendering it, so the lines of one widget can
 * start at different columns, and a \`Viewport\` shows whichever of its
 * content's rows its offset selects. An origin handed down through the render
 * options would be a number each container has to compute before it knows
 * the answer, and one more thing every container must forward correctly.
 *
 * So the position travels up instead, on the cells themselves. The owner
 * stamps each segment of its output with its row and column there
 * (\`Segment.anchorLines\`), the stamp rides on the segment's \`Style\`, which
 * every container already carries through untouched, and whoever holds the
 * composed frame reads any cell's owner and position straight off it
 * (\`Segment.anchorAt\`). Containers do nothing, so no container can get it
 * wrong.
 *
 * [LAW:single-enforcer] Two things can falsify a stamp. Cutting a segment in
 * two starts the right half at a later column than the stamp names:
 * \`Segment.splitCells\` is where a segment is cut, and it shifts the right
 * half's anchor (\`shiftAnchor\`); a crop that keeps the left half keeps a stamp
 * that is already true. Laying the text out again moves every cell: a
 * \`RichText\` does that, so it admits no anchor (\`admitStyle\` in \`./text.ts\`),
 * and the owner that renders it stamps what it draws.
 */

/**
 * The position of a segment's first cell in its owner's output, and the
 * anchor that segment carried before this owner stamped it — the owner nested
 * inside this one, if any. Innermost last: follow \`inner\` to reach the owner
 * that drew the cell itself.
 */
export interface Anchor {
  /** The thing that drew this cell, compared by identity. */
  readonly owner: object;
  readonly row: number;
  readonly col: number;
  readonly inner: Anchor | undefined;
}

/**
 * The anchor of the cell \`cells\` to the right of the one \`anchor\` names, at
 * every level of the nesting — each level names the same cell.
 */
export function shiftAnchor(anchor: Anchor, cells: number): Anchor {
  return {
    owner: anchor.owner,
    row: anchor.row,
    col: anchor.col + cells,
    inner: anchor.inner && shiftAnchor(anchor.inner, cells),
  };
}
` },
      "clock.ts": { kind: "file", mtime: new Date("2026-10-03T02:43:02.520Z"), content: `/**
 * Clock — the time source and timer whoever draws frames is handed, and the
 * frame rate it ticks at.
 *
 * [LAW:no-ambient-temporal-coupling] Frame rate belongs to whoever draws the
 * frames — an \`App\`, a \`Live\` — never to what is drawn, and each ticks on the
 * \`Clock\` it was given. An \`App\` reads the frame's time through that clock and
 * hands it to its view as data, so nothing rendered reads a clock, and an
 * effect sampled thirty times a second or once every two seconds runs the
 * same code.
 *
 * [LAW:effects-at-boundaries] The clock is a capability passed in, like the
 * \`TerminalHost\`: a test hands over a clock whose time it moves by hand and
 * counts frames with no real timer, and nothing it starts can outlive the
 * thing that started it. \`systemClock\` is the one place the library reads the
 * platform's clock and timers, and it reads them only when called.
 */

import type { Unsubscribe } from "./subscription.js";

declare const parsed: unique symbol;

/**
 * How often frames are drawn: a positive, finite number of frames a second,
 * fractional included — 0.5 is one frame every two seconds.
 *
 * [LAW:parse-dont-validate] Only \`frameRate\` makes one, so holding a
 * \`FrameRate\` is the proof the number was checked, and nothing that takes one
 * checks it again.
 */
export interface FrameRate {
  readonly perSecond: number;
  /** Seconds from one frame to the next. */
  readonly interval: number;
  readonly [parsed]: true;
}

// The longest delay a platform timer holds, in seconds: setInterval clamps a
// longer one to a millisecond, which would turn the slowest rate into the
// fastest.
const LONGEST_INTERVAL = (2 ** 31 - 1) / 1000;

/**
 * \`perSecond\` as a \`FrameRate\`; anything but a positive, finite number throws,
 * and so does a rate whose frames are further apart than a timer can wait —
 * about 24.8 days.
 */
export function frameRate(perSecond: number): FrameRate {
  if (!(Number.isFinite(perSecond) && perSecond > 0 && 1 / perSecond <= LONGEST_INTERVAL)) {
    throw new RangeError(
      \`a frame rate is a positive, finite number of frames a second, at most \${LONGEST_INTERVAL} s apart, not \${perSecond}\`,
    );
  }
  return { perSecond, interval: 1 / perSecond } as FrameRate;
}

export interface Clock {
  /** The time now, in seconds, on this clock's own timeline, which never runs backwards. */
  now(): number;
  /** Call \`tick\` once a frame at \`rate\` until the returned function is called. */
  every(rate: FrameRate, tick: () => void): Unsubscribe;
}

/** The platform's monotonic clock and its interval timer. */
export function systemClock(): Clock {
  return {
    now: () => performance.now() / 1000,
    every: (rate, tick) => {
      const timer = setInterval(tick, rate.interval * 1000);
      return () => clearInterval(timer);
    },
  };
}
` },
      "easing.ts": { kind: "file", mtime: new Date("2026-10-03T02:43:02.521Z"), content: `/**
 * Easing and phase: the one vocabulary for "how far along" — every function
 * here returns progress in [0, 1].
 *
 * Two kinds of curve, composed as \`ease(phase(t))\`:
 *
 * - A **phase** turns a time \`t\` (seconds) into raw progress: \`once\` runs
 *   0 → 1 over a span and holds, \`loop\` wraps 0 → 1 every period,
 *   \`pingPong\` goes 0 → 1 → 0 every period. A per-cell offset is added to \`t\`
 *   before the phase sees it — \`phase(t + offset)\` — so the cells of one
 *   effect run the same curve shifted in time.
 * - An **ease** reshapes that progress: any \`(x) => y\` on [0, 1]. The
 *   built-ins are CSS's easing functions (CSS Easing Functions Level 1):
 *   \`linear\`, \`cubic-bezier()\` with its named curves, and \`steps()\` with its
 *   jump terms, plus \`sine\` for pulses — a half-cosine, so a \`pingPong\`
 *   through it brightens and dims with no corner at either end.
 *
 * [LAW:no-ambient-temporal-coupling] Nothing here reads a clock. \`t\` is an
 * argument; whoever draws frames owns the clock and samples these at
 * whatever rate it likes, so the same \`t\` always gives the same progress.
 *
 * [LAW:one-type-per-behavior] An ease is a plain function value. CSS's named
 * curves are four instances of \`cubicBezier\`, not four implementations, and
 * \`ColorRamp\` and every effect take the same \`Ease\`.
 *
 * Tier 0 of \`src/core/\`: imports nothing, so \`themes/\` and every later
 * \`core/\` module reach it downhill. [LAW:one-way-deps]
 */

/** Progress in, progress out: a reshaping of [0, 1]. */
export type Ease = (x: number) => number;

/** Time in seconds (plus any per-cell offset) in, progress in [0, 1] out. */
export type Phase = (t: number) => number;

/**
 * CSS \`cubic-bezier(x1, y1, x2, y2)\`: the curve from (0, 0) to (1, 1) with
 * those two control points, read as y at a given x. \`x1\` and \`x2\` must lie in
 * [0, 1] — as in CSS — which keeps x monotonic in the curve parameter, so
 * every input has exactly one output. \`y1\` and \`y2\` may leave [0, 1]; the
 * curve then overshoots, as a CSS "back" curve does.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  for (const [name, v] of [["x1", x1], ["y1", y1], ["x2", x2], ["y2", y2]] as const) {
    if (!Number.isFinite(v)) throw new RangeError(\`cubicBezier \${name} must be finite, got \${v}\`);
  }
  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
    throw new RangeError(\`cubicBezier x1 and x2 must lie in [0, 1], got \${x1} and \${x2}\`);
  }
  // The Bernstein form in power basis: x(s) = ((ax·s + bx)·s + cx)·s, same for y.
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const xAt = (s: number): number => ((ax * s + bx) * s + cx) * s;
  const yAt = (s: number): number => ((ay * s + by) * s + cy) * s;
  const dxAt = (s: number): number => (3 * ax * s + 2 * bx) * s + cx;
  const EPSILON = 1e-9;

  // The parameter s with x(s) = x: Newton's method from s = x, which converges
  // in a few steps on every curve CSS names; bisection when the slope is too
  // flat for Newton to trust. x(s) is monotonic on [0, 1], so bisection always
  // lands.
  const solve = (x: number): number => {
    let s = x;
    for (let i = 0; i < 8; i++) {
      const err = xAt(s) - x;
      if (Math.abs(err) < EPSILON) return s;
      const slope = dxAt(s);
      if (Math.abs(slope) < 1e-6) break;
      s -= err / slope;
    }
    let lo = 0;
    let hi = 1;
    s = x;
    while (hi - lo > EPSILON) {
      if (xAt(s) < x) lo = s;
      else hi = s;
      s = (lo + hi) / 2;
    }
    return s;
  };
  return (x) => yAt(solve(Math.min(1, Math.max(0, x))));
}

/**
 * Where a \`steps()\` curve jumps, in CSS's terms. \`jump-start\` jumps at 0,
 * \`jump-end\` at 1, \`jump-both\` at both, \`jump-none\` at neither; \`start\` and
 * \`end\` are CSS's older spellings of the first two.
 */
export type StepPosition = "jump-start" | "jump-end" | "jump-none" | "jump-both" | "start" | "end";

/**
 * CSS \`steps(n, position)\`: progress held flat in \`n\` equal intervals, jumping
 * between them. The output takes \`n\` distinct values between the jumps
 * \`position\` names — CSS's step algorithm, so \`steps(1, "end")\` is 0 until
 * the very end.
 */
export function steps(n: number, position: StepPosition = "jump-end"): Ease {
  const minimum = position === "jump-none" ? 2 : 1;
  if (!Number.isInteger(n) || n < minimum) {
    throw new RangeError(\`steps(\${n}, "\${position}") needs a whole number of steps ≥ \${minimum}\`);
  }
  const jumpsAtStart = position === "jump-start" || position === "start" || position === "jump-both";
  // How many jumps the curve makes in all, which is what each step is a fraction of.
  const jumps = {
    "jump-start": n,
    start: n,
    "jump-end": n,
    end: n,
    "jump-both": n + 1,
    "jump-none": n - 1,
  }[position];
  const lift = jumpsAtStart ? 1 : 0;
  return (x) => {
    const p = Math.min(1, Math.max(0, x));
    return Math.min(jumps, Math.floor(p * n) + lift) / jumps;
  };
}

/** The identity ease: progress unchanged. */
const linear: Ease = (x) => x;

/** CSS \`step-end\`: 0 until the very end. */
const stepEnd: Ease = steps(1, "jump-end");

/** A half-cosine, flat at both ends: the curve a breathing pulse wants. */
const sine: Ease = (x) => (1 - Math.cos(Math.PI * x)) / 2;

/**
 * Every built-in ease by the name a template spells it with — CSS's keyword
 * names, plus \`sine\`, plus \`step\`: the spelling \`ColorRamp\` used before this
 * vocabulary existed, kept so every template written against it renders the
 * same. It is CSS's \`step-end\`, the same function value.
 */
export const EASES = {
  linear,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
  "step-start": steps(1, "jump-start"),
  "step-end": stepEnd,
  step: stepEnd,
  sine,
} as const satisfies Record<string, Ease>;

export type EaseName = keyof typeof EASES;

/**
 * The gate a spelled ease crosses. [LAW:parse-dont-validate] — a name in, the
 * function out, so nothing downstream holds a string it must check again.
 * Unknown names throw naming every legal one. [LAW:no-silent-failure]
 */
export function parseEase(name: string): Ease {
  if (!Object.hasOwn(EASES, name)) {
    throw new RangeError(
      \`unknown ease \${JSON.stringify(name)}; expected one of \` +
        Object.keys(EASES).map((n) => JSON.stringify(n)).join(", "),
    );
  }
  return EASES[name as EaseName];
}

function positiveSeconds(what: string, seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new RangeError(\`\${what} must be a positive number of seconds, got \${seconds}\`);
  }
}

/** The three phase shapes. Each takes seconds and returns a \`Phase\`. */
export const Phase = {
  /** 0 before \`start\`, rising to 1 over \`duration\` seconds, then held at 1. */
  once(start: number, duration: number): Phase {
    if (!Number.isFinite(start)) throw new RangeError(\`Phase.once start must be finite, got \${start}\`);
    positiveSeconds("Phase.once duration", duration);
    return (t) => Math.min(1, Math.max(0, (t - start) / duration));
  },

  /** 0 → 1 every \`period\` seconds, wrapping back to 0; negative \`t\` wraps too. */
  loop(period: number): Phase {
    positiveSeconds("Phase.loop period", period);
    return (t) => (((t % period) + period) % period) / period;
  },

  /** 0 → 1 → 0 every \`period\` seconds: there in the first half, back in the second. */
  pingPong(period: number): Phase {
    positiveSeconds("Phase.pingPong period", period);
    const wrap = Phase.loop(period);
    return (t) => 1 - Math.abs(2 * wrap(t) - 1);
  },
};
` },
      "env.ts": { kind: "file", mtime: new Date("2026-09-30T04:47:13.792Z"), content: `/**
 * Env — the environment variables a program running on a terminal sees, as
 * every public type that carries them names it.
 *
 * [LAW:types-are-the-program] The strongest true theorem about what this
 * library does with an environment is "reads a variable by name, which may be
 * unset." It never writes one, and it never touches the rest of node's
 * \`NodeJS.ProcessEnv\`. Node's \`process.env\` satisfies this as-is, and so does
 * a frozen literal in a browser, where there is no \`process\` at all.
 *
 * It lives here rather than being spelled \`NodeJS.ProcessEnv\` because a public
 * signature is emitted into the \`.d.ts\` verbatim, and a TypeScript project
 * without \`@types/node\` — the ordinary browser project — cannot resolve the
 * \`NodeJS\` namespace. \`test/seam/browser-types.test.ts\` holds that line.
 */

export type Env = Readonly<Record<string, string | undefined>>;
` },
      "fnv1a.ts": { kind: "file", mtime: new Date("2026-09-30T08:38:20.326Z"), content: `/**
 * fnv1a — FNV-1a, 32-bit, over a string's UTF-8 bytes, as 8 lowercase hex
 * digits: the short deterministic name this library derives wherever output
 * needs an identifier that is a function of what it names — an OSC 8 link id,
 * an SVG's class prefix — rather than of a counter or a clock.
 *
 * UTF-8 rather than UTF-16 code units, so any other runtime computing standard
 * FNV-1a over the same text gets the same digits.
 */

const utf8 = new TextEncoder();

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of utf8.encode(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
` },
      "json.ts": { kind: "file", mtime: new Date("2026-09-30T03:22:00.511Z"), content: `/**
 * JSON — renders JSON data with syntax highlighting and pretty-printing.
 *
 * Lives in \`core/\` for the reason \`pretty.ts\` does, argued in its header: it
 * turns foreign input into \`RichText\`, composes no other renderable, and
 * imports core primitives only. \`Console.printJson\` delegates here, so this is
 * where the console can reach it without an upward edge. [LAW:one-way-deps]
 */

import { Segment } from "./segment.js";
import { RichText } from "./text.js";
import { JSONHighlighter } from "./highlighter.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "./protocol.js";

export interface JSONOptions {
  indent?: number;
  sortKeys?: boolean;
  highlight?: boolean;
}

const highlighter = new JSONHighlighter();

export class JSONRenderable implements Renderable, Measurable {
  readonly text: RichText;

  private constructor(text: RichText) {
    this.text = text;
  }

  static fromString(jsonString: string, options?: JSONOptions): JSONRenderable {
    const indent = options?.indent ?? 2;
    const sortKeys = options?.sortKeys ?? false;

    // Parse and re-serialize for consistent formatting
    const data = JSON.parse(jsonString) as unknown;
    return JSONRenderable.fromData(data, { ...options, indent, sortKeys });
  }

  static fromData(data: unknown, options?: JSONOptions): JSONRenderable {
    const indent = options?.indent ?? 2;
    const sortKeys = options?.sortKeys ?? false;
    const doHighlight = options?.highlight !== false;

    const replacer = sortKeys
      ? (_key: string, value: unknown) => {
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            const sorted: Record<string, unknown> = {};
            for (const k of Object.keys(value as Record<string, unknown>).sort()) {
              sorted[k] = (value as Record<string, unknown>)[k];
            }
            return sorted;
          }
          return value;
        }
      : undefined;

    const jsonStr = JSON.stringify(data, replacer, indent);
    const text = new RichText(jsonStr);

    if (doHighlight) {
      highlighter.highlight(text);
    }

    return new JSONRenderable(text);
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this.text.render(options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.text.measure(options);
  }
}
` },
      "measure.ts": { kind: "file", mtime: new Date("2026-09-29T23:47:54.114Z"), content: `/**
 * Measurement — min/max cell width calculation for renderables.
 */

import { isMeasurable, measuring, type Measurable, type Renderable, type RenderOptions } from "./protocol.js";

export class Measurement {
  readonly minimum: number;
  readonly maximum: number;

  constructor(minimum: number, maximum: number) {
    this.minimum = minimum;
    this.maximum = maximum;
  }

  get span(): number {
    return this.maximum - this.minimum;
  }

  /**
   * A range with no cell meaning becomes one with the nearest meaning there is:
   * negative floors to zero, an inverted pair collapses to its ceiling, and NaN
   * reads as zero cells the same way \`cellCount\` reads it.
   *
   * NaN and Infinity are not treated alike here, and the difference is the whole
   * point. \`Infinity\` is a maximum a renderable means — \`Table\` reports it when
   * a column asks for every cell there is, and \`withBoundedWidth\` throws on it
   * so a caller learns their offer was unanswerable. Flooring it to zero would
   * turn that loud failure into a table measured at no width at all.
   */
  normalize(): Measurement {
    const cells = (n: number): number => (Number.isNaN(n) ? 0 : n);
    const min = Math.max(0, Math.min(cells(this.minimum), cells(this.maximum)));
    const max = Math.max(0, cells(this.maximum));
    return new Measurement(min, max);
  }

  withMaximum(width: number): Measurement {
    return new Measurement(
      Math.min(this.minimum, width),
      Math.min(this.maximum, width),
    );
  }

  withMinimum(width: number): Measurement {
    const min = Math.max(this.minimum, width);
    const max = Math.max(this.maximum, min);
    return new Measurement(min, max);
  }

  clamp(minWidth: number, maxWidth: number): Measurement {
    return new Measurement(
      Math.min(Math.max(this.minimum, minWidth), maxWidth),
      Math.min(Math.max(this.maximum, minWidth), maxWidth),
    );
  }

  // [LAW:single-enforcer] Single entry point for measuring a renderable. One
  // that cannot measure itself asks for the whole offer, as the reference's
  // \`Measurement.get\` answers for it — so under an unbounded offer it asks for
  // \`Infinity\`, and \`withBoundedWidth\` refuses rather than guessing a width.
  static get(options: RenderOptions, renderable: Renderable | Measurable): Measurement {
    if (options.maxWidth < 1) return new Measurement(0, 0);
    if (!isMeasurable(renderable)) return new Measurement(0, options.maxWidth);
    const { minimum, maximum } = renderable.measure(measuring(options));
    return new Measurement(minimum, Math.min(maximum, options.maxWidth)).normalize();
  }
}

export function measureRenderables(
  options: RenderOptions,
  renderables: readonly (Renderable | Measurable)[],
): Measurement {
  if (renderables.length === 0) return new Measurement(0, 0);
  let minOfAll = 0;
  let maxOfAll = 0;
  for (const m of renderables) {
    const measurement = Measurement.get(options, m);
    minOfAll = Math.max(minOfAll, measurement.minimum);
    maxOfAll = Math.max(maxOfAll, measurement.maximum);
  }
  return new Measurement(minOfAll, maxOfAll);
}
` },
      "memo.ts": { kind: "file", mtime: new Date("2026-10-03T02:43:02.521Z"), content: `/**
 * memo — a string-keyed memo with a size bound: the one cache shape for a
 * pure computation whose keys a long-running host derives without end. A
 * statusline daemon redrawing a time-varying colour parses a new hex string,
 * matches a new RGB triple, measures a new cell, on every frame; a memo that
 * never evicts grows by one entry per frame for the life of the process.
 */

// [LAW:single-enforcer] The one size policy for every memo in the library.
// Clearing at the cap rather than evicting least-recently-used: a refill costs
// one recomputation per key, and a clear needs no bookkeeping on the hit path.
export const MEMO_MAX = 4096;

/**
 * \`get(key, compute)\` returns the value remembered for \`key\`, computing and
 * remembering it on a miss. Holds at most \`MEMO_MAX\` entries. \`compute\` must
 * be a pure function of \`key\`, so a value recomputed after a clear is the one
 * that was dropped.
 */
export class Memo<V extends NonNullable<unknown>> {
  private readonly entries = new Map<string, V>();

  get size(): number {
    return this.entries.size;
  }

  get(key: string, compute: (key: string) => V): V {
    const remembered = this.entries.get(key);
    if (remembered !== undefined) return remembered;
    // Computed before the clear, so a compute that throws costs no entries.
    const value = compute(key);
    if (this.entries.size >= MEMO_MAX) this.entries.clear();
    this.entries.set(key, value);
    return value;
  }
}
` },
      "noise.ts": { kind: "file", mtime: new Date("2026-10-08T20:44:57.548Z"), content: `/**
 * Gradient noise, the texture every effect in \`renderables/effects\` is drawn
 * from. Ken Perlin's improved noise (2002): a smooth pseudo-random
 * field over space and time, continuous in its first and second derivatives,
 * so a cell sampled a moment later has moved a little, never jumped. Things
 * the eye knows as alive — water, wind, breath, a glow — vary like this:
 * coherent nearby, uncorrelated far apart, never repeating exactly.
 *
 * [LAW:no-ambient-temporal-coupling] A pure function of its coordinates; time
 * is one of them. The permutation is fixed, so a moment draws the same frame
 * on every run.
 *
 * Tier 0 of \`src/core/\`: imports nothing. Not part of the package's surface;
 * the effects playground reaches it as source.
 */

/** Ken Perlin's reference permutation, doubled so a lookup never wraps. */
const P = (() => {
  const base = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10,
    23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56, 87,
    174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211,
    133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208,
    89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5,
    202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119,
    248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
    178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249,
    14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205,
    93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
  ];
  return [...base, ...base];
})();

/** Quintic smoothstep: zero first and second derivative at 0 and 1. */
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + t * (b - a);

/** The dot of one of twelve edge gradients, picked by \`hash\`, with (x, y, z). */
function grad(hash: number, x: number, y: number, z: number): number {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}

/** Noise at (x, y, z), in about [-1, 1]; zero at every integer lattice point. */
export function noise(x: number, y: number, z: number): number {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const fz = Math.floor(z);
  const X = fx & 255;
  const Y = fy & 255;
  const Z = fz & 255;
  x -= fx;
  y -= fy;
  z -= fz;
  const u = fade(x);
  const v = fade(y);
  const w = fade(z);
  const A = P[X]! + Y;
  const AA = P[A]! + Z;
  const AB = P[A + 1]! + Z;
  const B = P[X + 1]! + Y;
  const BA = P[B]! + Z;
  const BB = P[B + 1]! + Z;
  return lerp(
    lerp(lerp(grad(P[AA]!, x, y, z), grad(P[BA]!, x - 1, y, z), u), lerp(grad(P[AB]!, x, y - 1, z), grad(P[BB]!, x - 1, y - 1, z), u), v),
    lerp(
      lerp(grad(P[AA + 1]!, x, y, z - 1), grad(P[BA + 1]!, x - 1, y, z - 1), u),
      lerp(grad(P[AB + 1]!, x, y - 1, z - 1), grad(P[BB + 1]!, x - 1, y - 1, z - 1), u),
      v,
    ),
    w,
  );
}

/**
 * Fractal Brownian motion: \`octaves\` layers of noise, each twice the
 * frequency and half the amplitude of the last, scaled back into about
 * [-1, 1]. One layer is a soft swell; three is a swell with detail on it.
 */
export function fbm(x: number, y: number, z: number, octaves: number): number {
  let sum = 0;
  let amplitude = 1;
  let total = 0;
  for (let i = 0; i < octaves; i++) {
    const f = 2 ** i;
    sum += amplitude * noise(x * f, y * f, z * f);
    total += amplitude;
    amplitude /= 2;
  }
  return sum / total;
}

/**
 * A pseudo-random number in [0, 1) for the \`n\`th of something — a breath, a
 * gust — uncorrelated with the \`n ± 1\`th, where \`noise\` would make
 * neighbours alike. The classic shader hash: the fraction of a large sine.
 */
export function hash(n: number, z: number): number {
  const x = Math.sin(n * 12.9898 + z * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Hermite smoothstep from \`a\` to \`b\`, clamped to [0, 1]. */
export function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
` },
      "osc8.ts": { kind: "file", mtime: new Date("2026-09-30T21:35:50.110Z"), content: `/**
 * The OSC 8 hyperlink wire grammar — which bytes may not appear inside a
 * link, how a link becomes bytes, and how bytes are read back as a link.
 *
 * [LAW:one-source-of-truth] The producer (\`segmentToString\`, the one encoder
 * every link reaches the wire through) opens a link with \`osc8Open\` and closes
 * it with \`OSC8_CLOSE\`; every consumer that reads rendered bytes (a width measure, a
 * test extracting URLs) matches them with \`OSC8\`; the data-model boundary
 * (RichText) cleans URLs with \`stripOscTerminators\`. All four read the one
 * terminator set below, so the bytes a sanitizer removes and the bytes a
 * reader stops at cannot disagree.
 *
 * [LAW:locality-or-seam] This module depends only on \`fnv1a\`; every consumer
 * imports downward.
 *
 * The \`id=\` parameter is what makes one link hover as one link. A terminal
 * treats cells as the same hyperlink when they share BOTH the URI and the id
 * (the OSC 8 spec, and VTE / iTerm2 / kitty / WezTerm alike); without an id,
 * each open sequence is its own link. The encoder writes one OSC 8 pair per
 * segment, as the reference does, so a link whose text spans several segments
 * — a bold glyph beside plain text, a padded cell — is emitted as several
 * pairs, and would highlight piecewise on hover.
 *
 * [LAW:types-are-the-program] The id is a pure function of the URI, so the
 * byte stream stays a pure function of (style, text, destination): no counter,
 * no construction-order dependence. The consequence is deliberate: two spans
 * with the same URI hover as one link wherever they sit on screen, adjacent
 * or not — a click on either does the same thing, so they ARE one link.
 * Because terminals key on the (id, URI) PAIR, a hash collision between two
 * different URIs merges nothing — the URIs still differ — so a 32-bit hash is
 * exact, not approximate.
 */

import { fnv1a } from "./fnv1a.js";

/**
 * The bytes that prematurely terminate an OSC 8 sequence: ESC (\`\\x1b\`, which
 * begins ST \`ESC \\\`), BEL (\`\\x07\`), and the 8-bit ST (\`\\x9c\`).
 */
const TERMINATORS = "\\\\x1b\\\\x07\\\\x9c";

const TERMINATOR_RE = new RegExp(\`[\${TERMINATORS}]\`, "g");

/** Remove every byte that could break a URL out of its OSC 8 wrap. */
export function stripOscTerminators(url: string): string {
  return url.replace(TERMINATOR_RE, "");
}

/**
 * The bytes that open a hyperlink to \`url\`.
 *
 * [LAW:single-enforcer] Wire-byte trust boundary — the URL is sanitized at
 * the one place it becomes an OSC 8 sequence, whichever upstream API attached
 * it to the Style (RichText sanitizes at its data-model boundary too; a Style
 * built directly with \`new Style({ link })\` reaches here unsanitized).
 */
export function osc8Open(url: string): string {
  const clean = stripOscTerminators(url);
  // Hex digits are a legal \`id=\` value: no \`:\` or \`;\`.
  return \`\\x1b]8;id=\${fnv1a(clean)};\${clean}\\x1b\\\\\`;
}

/** The bytes that close the current hyperlink. */
export const OSC8_CLOSE = "\\x1b]8;;\\x1b\\\\";

/**
 * Matches one OSC 8 sequence — an open or a close — terminated by \`ESC \\\`,
 * BEL, or the 8-bit ST. Group 1 is the params, group 2 the URI; both are empty
 * on a close. To read bytes back use \`osc8Sequences\`; this pattern is exported
 * for composing into a larger one (a width measure's zero-width alternation).
 */
export const OSC8 = new RegExp(
  \`\\\\x1b\\\\]8;([^;\${TERMINATORS}]*);([^\${TERMINATORS}]*)(?:\\\\x1b\\\\\\\\|\\\\x07|\\\\x9c)\`,
);

/** One OSC 8 sequence found in rendered bytes. A close has \`uri === ""\`. */
export interface Osc8Sequence {
  /** Offset of the sequence in the scanned string. */
  readonly index: number;
  /** Length of the whole sequence, terminator included. */
  readonly length: number;
  /** The params field (\`id=…\`); empty on a close. */
  readonly params: string;
  /** The URI; empty on a close. */
  readonly uri: string;
}

const OSC8_SCAN = new RegExp(OSC8.source, "g");

/**
 * Every OSC 8 sequence in \`text\`, in order — the typed way to read rendered
 * bytes back.
 */
export function osc8Sequences(text: string): Osc8Sequence[] {
  return [...text.matchAll(OSC8_SCAN)].map((m) => ({
    index: m.index,
    length: m[0].length,
    params: m[1]!,
    uri: m[2]!,
  }));
}
` },
      "place.ts": { kind: "file", mtime: new Date("2026-10-03T04:00:35.307Z"), content: `/**
 * place — a renderable's output set down as one block inside a wider width.
 *
 * The block is placed, not its lines. The renderable is measured, drawn at the
 * width it asked for and at its own height — a region's height is dropped, as
 * the reference's \`Align\` drops it — and every line is padded to the widest, so the block is a
 * rectangle; only then is the rectangle padded to the offered width. A
 * multi-line paragraph keeps its own shape under \`"center"\` — \`hi\` over \`hello\`
 * stays a 5-cell block, centred as one — where padding each line to the full
 * width on its own would centre \`hi\` against the whole terminal. That is
 * Rich's \`Align\`, and \`test/core/console.test.ts\` pins it against the
 * reference's bytes.
 *
 * It lives in \`core/\` because \`Console.print\` places with it: Rich's \`print\`
 * wraps what it prints in \`Align\` for the three alignments, and \`console.ts\`
 * reaching for \`renderables/align.ts\` would be a third upward edge out of this
 * layer. [LAW:one-way-deps] \`Align\` is this function behind the \`Renderable\`
 * interface. [LAW:one-source-of-truth]
 */

import { Segment } from "./segment.js";
import { Measurement } from "./measure.js";
import type { Renderable, RenderOptions } from "./protocol.js";

export type Alignment = "left" | "center" | "right";

// The share of the spare cells that goes on the left; the rest go on the right.
// Right-alignment pads no right side at all, which is the reference's choice
// and not a zero: a line that ends at the edge carries no trailing blanks.
const PADS: Record<Alignment, (spare: number) => [left: number, right: number]> = {
  left: (spare) => [0, spare],
  center: (spare) => [Math.floor(spare / 2), spare - Math.floor(spare / 2)],
  right: (spare) => [spare, 0],
};

/**
 * \`renderable\`'s lines, the block they form placed by \`align\` in
 * \`options.maxWidth\`. \`options.maxWidth\` must be finite: the spare cells are
 * written out as spaces. A block wider than the offer — a line with nowhere to
 * break, drawn by a renderable that does not cut its own — is left unpadded at
 * its full width, for whatever holds it to crop or keep.
 */
export function placeBlock(
  renderable: Renderable,
  align: Alignment,
  options: RenderOptions,
): Segment[][] {
  // A renderable that cannot say how wide it wants to be is offered all of it
  // (\`Measurement.get\` answers for it), and the block is then only as wide as
  // what it actually drew.
  const width = Measurement.get(options, renderable).maximum;
  const drawn = Segment.splitLines(
    renderable.render({ ...options, maxWidth: width, height: undefined }),
  );
  const [blockWidth, height] = Segment.getShape(drawn);
  const [left, right] = PADS[align](Math.max(0, options.maxWidth - blockWidth));
  return Segment.setShape(drawn, blockWidth, height).map((line) => [...pad(left), ...line, ...pad(right)]);
}

// [LAW:dataflow-not-control-flow] no spare room is a pad of no segments, not a
// step skipped.
const pad = (cells: number): Segment[] => (cells > 0 ? [new Segment(" ".repeat(cells))] : []);
` },
      "render.ts": { kind: "file", mtime: new Date("2026-10-03T06:23:57.775Z"), content: `/**
 * \`renderToString\` — stateless one-shot emission of a \`Renderable\` to a string
 * of ANSI-encoded text. Pure function: same inputs produce byte-identical
 * output. Does not write to \`process.stdout\` and does not require a \`Console\`
 * instance.
 *
 * Note on \`colorSystem: "auto"\`: the \`"auto"\` spec resolves via
 * \`detectColorSystem\`, which reads \`process.env\` and \`process.stdout?.isTTY\`
 * by default. Callers that want a fully deterministic render must either pass
 * an explicit \`ColorDepth\` enum / non-\`"auto"\` spec, or supply \`env\` and
 * \`isTTY\` in the options so detection does not consult ambient process state.
 *
 * [LAW:single-enforcer] The Segment-to-ANSI conversion lives in \`segmentToString\`
 * and is the single way a segment becomes wire bytes. \`segmentsToString\` is
 * that encoding joined, and \`Console._writeSegments\`, \`Painter\` (every \`Live\`
 * and \`App\` frame) and \`renderToString\` all go through it, so terminal output,
 * live and app frames and string export agree by construction.
 *
 * [LAW:one-source-of-truth] What the encoding needs from where it writes
 * arrives as one \`Destination\` value. Each caller resolves its destination
 * once — spec, detection, and its own overrides — and hands it through whole,
 * so a depth is never paired with a link setting taken from somewhere else.
 *
 * Every segment is written alone, exactly as Python Rich 9d8f9a3 writes it
 * (\`Console._render_buffer\` calls \`Style.render\` per segment): its SGR codes
 * open, its text, a reset, and an OSC 8 pair around all three when it carries
 * a link. Two adjacent segments with equal codes are two runs, not one. That
 * costs a reset and a reopen the terminal draws identically, and it is what
 * lets a fixture generated from the reference hold any sequence of segments,
 * rather than only those in which no two neighbours happen to share a style
 * (rich-render-g5g8). The price of that is that where a renderable cuts its
 * segments is now in the bytes, so a renderable pinned against the reference
 * has to cut where the reference cuts, as \`Box\`'s rules and \`Table\`'s blank
 * cell lines do. A link split across segments still hovers as one link,
 * because every pair it becomes carries the id \`osc8Open\` derives from the URL.
 *
 * Colour and hyperlinks are two facts about the destination:
 * \`colorSystem === null\` empties every segment's SGR codes, and
 * \`hyperlinks === false\` drops every segment's link. A colour depth never
 * removes a link — a hyperlink is not a colour, and a NO_COLOR terminal still
 * follows OSC 8. This is where the port departs from the reference, whose
 * \`Style.render\` returns bare text for a null colour system.
 */

import { ColorDepth, resolveDestination } from "./color.js";
import type { ColorSystemName, DetectColorOptions, Destination } from "./color.js";
import type { Env } from "./env.js";
import type { Segment } from "./segment.js";
import type { Renderable, RenderOptions } from "./protocol.js";
import { OSC8_CLOSE, osc8Open } from "./osc8.js";

// [LAW:one-source-of-truth] Handed to the render unchanged, so their contract is
// \`RenderOptions\`' and is not restated here.
export interface RenderToStringOptions
  extends Pick<RenderOptions, "asciiOnly" | "theme" | "onStyleError" | "highlight" | "highlighter"> {
  /** Cell width to render into. Default 80. */
  width?: number;
  /**
   * Color encoding to emit. Accepts a \`ColorSystemName\` (\`"auto"\`,
   * \`"truecolor"\`, \`"256"\`, \`"ansi"\`, \`"none"\`), a \`ColorDepth\` enum value, or \`null\` to
   * strip SGR colors/attributes. Hyperlinks are \`hyperlinks\`' concern. Default
   * truecolor.
   */
  colorSystem?: ColorSystemName | ColorDepth | null;
  /**
   * Environment to consult when \`colorSystem\` is \`"auto"\`. Defaults to
   * \`process.env\`. Pass an explicit value to keep rendering deterministic.
   */
  env?: Env;
  /**
   * Whether output is going to a TTY when \`colorSystem\` is \`"auto"\`. Defaults
   * to \`process.stdout?.isTTY\`. Pass an explicit value to keep rendering
   * deterministic.
   */
  isTTY?: boolean;
  /** When true, forces \`colorSystem\` to \`null\` regardless of the explicit value. */
  noColor?: boolean;
  /**
   * Whether OSC 8 hyperlinks are emitted. Independent of \`colorSystem\`: a
   * null colour system strips SGR and keeps links. Default: what the
   * destination takes — true for an explicit depth, detected under \`"auto"\`
   * (no TTY or TERM=dumb: false). \`false\` with \`colorSystem: null\` is plain text.
   */
  hyperlinks?: boolean;
}

const DEFAULT_WIDTH = 80;

/**
 * Encodes one segment as ANSI bytes for \`destination\`: the reference's
 * \`Style.render\` for that segment, and nothing for a control segment.
 */
export function segmentToString(segment: Segment, destination: Destination): string {
  if (segment.isControl) return "";
  const { text, style } = segment;
  // As the reference's \`if not text\` and \`if style:\` — no pair around nothing.
  if (text.length === 0 || style === undefined) return text;
  // [LAW:one-type-per-behavior] Colour depth governs SGR only; hyperlinks are
  // their own fact. Coupling them let a colour setting delete every control.
  const codes = destination.colorSystem === null ? "" : style.toSgrCodes(destination.colorSystem);
  const styled = codes.length > 0 ? \`\\x1b[\${codes}m\${text}\\x1b[0m\` : text;
  const link = destination.hyperlinks ? style.link : undefined;
  return link === undefined ? styled : \`\${osc8Open(link)}\${styled}\${OSC8_CLOSE}\`;
}

/** Encodes a sequence of segments as ANSI bytes for \`destination\`, one segment at a time. */
export function segmentsToString(segments: Iterable<Segment>, destination: Destination): string {
  const parts: string[] = [];
  for (const segment of segments) parts.push(segmentToString(segment, destination));
  return parts.join("");
}

export function renderToString(
  renderable: Renderable,
  options?: RenderToStringOptions,
): string {
  const width = options?.width ?? DEFAULT_WIDTH;
  // [LAW:dataflow-not-control-flow] An absent spec is truecolor; an explicit
  // \`null\` stays null (\`??\` would collapse it).
  // [LAW:single-enforcer] Specs resolve through \`resolveDestination\`.
  const detectOptions: DetectColorOptions = {};
  if (options?.env !== undefined) detectOptions.env = options.env;
  if (options?.isTTY !== undefined) detectOptions.isTTY = options.isTTY;
  const rawSpec = options?.colorSystem;
  const resolved = resolveDestination(
    rawSpec === undefined ? ColorDepth.TRUECOLOR : rawSpec,
    detectOptions,
  );
  // [LAW:single-enforcer] This call's overrides are applied here, once, to
  // make the one destination everything below is drawn for. \`noColor\` is a
  // colour choice, so it overrides the depth and leaves hyperlinks to the
  // destination; an explicit \`hyperlinks\` overrides what the destination takes.
  const destination: Destination = {
    colorSystem: options?.noColor ? null : resolved.colorSystem,
    hyperlinks: options?.hyperlinks ?? resolved.hyperlinks,
  };
  const renderOptions: RenderOptions = {
    maxWidth: width,
    isTerminal: false,
    asciiOnly: options?.asciiOnly ?? false,
    theme: options?.theme,
    onStyleError: options?.onStyleError,
    highlight: options?.highlight,
    highlighter: options?.highlighter,
    // [LAW:one-source-of-truth] The depth the segments below are encoded at,
    // so a renderable measures what this very call will draw.
    colorSystem: destination.colorSystem,
  };

  return segmentsToString(renderable.render(renderOptions), destination);
}
` },
      "selection.ts": { kind: "file", mtime: new Date("2026-10-15T04:45:08.693Z"), content: `/**
 * The list cursor: one clamp, shared by every list that moves a selection —
 * \`ListView\`'s callers and \`Dropdown\` alike — so it has one definition.
 */

/**
 * The selection \`delta\` items on from \`index\` in a list of \`length\`, held to
 * the list's ends: \`-Infinity\` is the first item and \`Infinity\` the last. A
 * move that cannot go anywhere returns \`index\` itself, so \`next === index\`
 * says nothing moved and the caller can skip a repaint. An empty list has
 * nowhere to move to and returns \`index\`.
 */
export function moveSelection(index: number, delta: number, length: number): number {
  return length === 0 ? index : Math.max(0, Math.min(length - 1, index + delta));
}
` },
      "subscription.ts": { kind: "file", mtime: new Date("2026-09-05T01:38:00.468Z"), content: `/**
 * Unsubscribe — the shape every \`on…()\` in this library hands back.
 *
 * [LAW:decomposition] It lives in \`core/\` because two subsystems that must not
 * depend on each other both need it: \`host/\` returns one from \`onData\` and
 * \`onResize\`, \`widgets/\` returns one from \`onChange\`, \`onSubmit\`, \`onKey\` and
 * \`onMouse\`. Either home above this tier would make the other import a
 * subsystem it has no business knowing about — the extraction of \`src/host/\`
 * out of \`src/widgets/\` is what surfaced that, since the type was sitting in
 * \`widgets/types.ts\` and the host seam was importing it from there.
 */

export type Unsubscribe = () => void;
` },
      "wrap.ts": { kind: "file", mtime: new Date("2026-10-03T04:08:43.274Z"), content: `/**
 * Word wrapping: the offsets one logical line is cut at so its pieces fit a
 * cell budget.
 *
 * This is deliberately not in \`cells.ts\` next door. That module answers
 * geometry — how wide is this, where does cell column N fall — and knows
 * nothing about language. This one answers where a line may *break*, which is
 * a fact about words, and the only thing it borrows from geometry is how to
 * measure one.
 *
 * It returns offsets rather than pieces because the caller holds styled
 * \`Segment[]\`, not a string: cutting the text here would drop every span
 * attached to it. Offsets are the one representation both sides can act on —
 * \`Segment.divide\` cuts the styled line at exactly the places this function
 * found in the plain one.
 *
 * Wrapping is the *first* step, and overflow is the last resort applied to a
 * line still too wide once wrapping is done. That order is the whole reason a
 * long sentence in a table cell grows the row while an unbreakable word in the
 * same cell still ellipsizes.
 */

import { cellLen, chopCells, asCellCol, type CellCol } from "./cells.js";

/**
 * Each word of \`text\` in order, where a "word" carries its own trailing
 * whitespace — the run of spaces that follows it belongs to it, because that
 * is the whitespace a break at the *next* word leaves hanging past the edge.
 *
 * The matches tile the text: each begins exactly where the last ended, so a
 * caller can track absolute offsets by accumulating widths alone. Text with no
 * non-whitespace character yields nothing, which is the honest answer — there
 * is nowhere to break.
 */
function* words(text: string): Iterable<string> {
  // Constructed per call rather than hoisted: a sticky regex carries its
  // \`lastIndex\` as mutable state, and a shared one would corrupt any two
  // interleaved walks. [LAW:no-shared-mutable-globals]
  const re = /\\s*\\S+\\s*/y;
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    yield match[0];
  }
}

/**
 * The cells a word needs on a line: all of it but its trailing whitespace,
 * which may hang past the edge for the caller to crop. Its leading whitespace
 * counts — that is a line's indent, and it is not a place to break.
 */
function widthOf(word: string): number {
  return cellLen(word.trimEnd());
}

/**
 * The cells each word of \`text\` needs, in order — the widest is the narrowest
 * width \`divideLine\` can wrap it to without cutting a word.
 */
export function wordWidths(text: string): number[] {
  return Array.from(words(text), widthOf);
}

/**
 * A word chopped into pieces of at most \`width\` cells, as the reference chops
 * it.
 *
 * \`chopCells\` next door and Rich's \`chop_cells\` disagree in exactly one place.
 * Rich opens a new line for any glyph that does not fit and emits whatever line
 * it was already on, so a word beginning with a glyph wider than the entire
 * canvas folds with an empty piece in front of it — and that piece reaches the
 * output as a blank line. \`chopCells\` force-takes the glyph instead and never
 * returns an empty piece.
 *
 * Restoring the blank is what keeps \`test/core/text-wrap.golden.txt\`
 * regenerable from the reference. A fixture is only an oracle while the command
 * in its header reproduces it byte for byte; smoothing away one byte the
 * reference emits costs that, everywhere, to tidy a blank line reachable only
 * by folding a two-cell glyph onto a one-cell canvas.
 */
function foldWord(word: string, width: CellCol): string[] {
  const pieces = chopCells(word, width);
  // \`chopCells\` overshoots the budget only when it force-takes one glyph, so an
  // over-wide first piece is exactly the case Rich opens a blank line for.
  return cellLen(pieces[0]!) > width ? ["", ...pieces] : pieces;
}

/**
 * The cell offsets \`text\` should be cut at to wrap it into lines of at most
 * \`width\` cells, for \`Segment.divide\` to apply to the styled line.
 *
 * \`fold\` decides what happens to a word that fits on no line at all: folded,
 * it is chopped across as many lines as it needs; unfolded, it is left whole
 * on its own line for the caller's overflow method to cut. Only the \`fold\`
 * overflow method folds — \`crop\` and \`ellipsis\` want the word intact so they
 * can truncate it, which is what makes an unbreakable word ellipsize while the
 * sentence around it merely wraps.
 *
 * Requires \`width >= 1\`. A zero-cell canvas gets no cuts, because "no cut
 * fits" and "no cell fits" are different facts and only one of them is a list
 * of offsets — the caller answers the second one by cropping the single
 * uncut piece to nothing, which is what every overflow method does there.
 */
export function divideLine(
  text: string,
  width: CellCol,
  options: { fold: boolean },
): CellCol[] {
  if (width <= 0) return [];

  const cuts: CellCol[] = [];
  // A cut at the start of the text is not a cut: it would open the line with
  // an empty piece. [LAW:single-enforcer] for that rule, so neither arm below
  // has to restate it.
  const cutAt = (cell: number): void => {
    if (cell > 0) cuts.push(asCellCol(cell));
  };

  let used = 0; // cells already committed to the line being filled
  let wordStart = 0; // absolute cell offset where the current word begins

  for (const word of words(text)) {
    const wordWidth = widthOf(word);

    if (width - used >= wordWidth) {
      used += cellLen(word);
    } else if (options.fold && wordWidth > width) {
      // No line, however empty, can hold this word whole, and folding is
      // allowed — so it is chopped across as many lines as it needs. Unfolded,
      // it takes the arm below and is left whole for the overflow method.
      const pieces = foldWord(word, width);
      let pieceStart = wordStart;
      for (let index = 0; index < pieces.length; index += 1) {
        cutAt(pieceStart);
        const piece = pieces[index]!;
        // The last piece is what the *next* word finds already on the line;
        // the rest are whole lines of their own.
        if (index === pieces.length - 1) used = cellLen(piece);
        else pieceStart += cellLen(piece);
      }
    } else {
      // It does not fit here. Either it fits on a line of its own, or nothing
      // can hold it and the caller's overflow method will cut it there.
      cutAt(wordStart);
      used = cellLen(word);
    }

    wordStart += cellLen(word);
  }

  return cuts;
}
` },
    } },
    "renderables": { kind: "directory", children: {
      "align.ts": { kind: "file", mtime: new Date("2026-10-03T04:08:21.312Z"), content: `/**
 * Align — wraps a renderable and places its output horizontally, as one block.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { withBoundedWidth } from "../core/protocol.js";
import { placeBlock, type Alignment } from "../core/place.js";

export class Align implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly align: Alignment;

  constructor(renderable: Renderable, align: Alignment = "center") {
    this.renderable = renderable;
    this.align = align;
  }

  // [LAW:one-source-of-truth] \`placeBlock\` is the placement; \`Console.print\`'s
  // \`justify\` uses the same one.
  *render(options: RenderOptions): Iterable<Segment> {
    for (const line of placeBlock(this.renderable, this.align, withBoundedWidth(options, this))) {
      yield* line;
      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(options, this.renderable);
  }
}
` },
      "constrain.ts": { kind: "file", mtime: new Date("2026-10-03T04:08:20.071Z"), content: `/**
 * Constrain — wraps a renderable and constrains its maximum width.
 */

import { Segment } from "../core/segment.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export class Constrain implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly width: number | undefined;

  constructor(renderable: Renderable, width?: number) {
    this.renderable = renderable;
    this.width = width;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    // [LAW:dataflow-not-control-flow] Always compute constrainedWidth; undefined means no constraint
    const constrainedWidth =
      this.width !== undefined
        ? Math.min(this.width, options.maxWidth)
        : options.maxWidth;

    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: constrainedWidth,
    };

    yield* this.renderable.render(innerOptions);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    // Measured at the width it will be drawn at, as Rich's \`update_width\` does;
    // \`Measurement.get\` then holds the answer inside that offer.
    const maxWidth =
      this.width !== undefined
        ? Math.min(this.width, options.maxWidth)
        : options.maxWidth;
    return Measurement.get({ ...options, maxWidth }, this.renderable);
  }
}
` },
      "group.ts": { kind: "file", mtime: new Date("2026-09-29T23:47:54.115Z"), content: `/**
 * Group — renders multiple renderables in sequence.
 * No visual chrome — purely a container.
 */

import type { Segment } from "../core/segment.js";
import { type Measurement, measureRenderables } from "../core/measure.js";
import type {
  Measurable,
  Renderable,
  RenderOptions,
} from "../core/protocol.js";
import { stackedHeight } from "../core/protocol.js";

export class Group implements Renderable, Measurable {
  readonly renderables: Renderable[];

  constructor(...renderables: Renderable[]) {
    this.renderables = renderables;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const memberOptions = { ...options, height: stackedHeight(options.height) };
    for (const renderable of this.renderables) {
      yield* renderable.render(memberOptions);
    }
  }

  /** As wide as its widest member: the reference's \`measure_renderables\`. */
  measure(options: RenderOptions): Measurement {
    return measureRenderables(options, this.renderables);
  }
}
` },
      "list-view.ts": { kind: "file", mtime: new Date("2026-10-15T04:45:08.693Z"), content: `/**
 * ListView — items stacked down a \`Viewport\`, scrolled to keep the selected
 * one in view. \`moveSelection\` (core/selection) is the cursor that picks it.
 *
 * An item can wrap, so the lines the selected one covers exist only at the
 * width it is drawn at, which a render is handed and whoever builds the frame
 * is not. So the items are drawn here, at the viewport's content width and
 * with no height — the lines the viewport scrolls — and the viewport is handed
 * those lines and the selected item's range.
 * [LAW:single-enforcer] Where the window sits is the viewport's call; this
 * only says which lines the selection is.
 *
 * The viewport is handed in rather than made here: the scroll position lives
 * in it, and a frame rebuilt on every key would otherwise start each one at
 * the top. The pieces stay apart — a cursor, a viewport, a list drawn through
 * it — so a consumer can take one without the others.
 */

import { Segment } from "../core/segment.js";
import { Measurement, measureRenderables } from "../core/measure.js";
import { withBoundedWidth, withCellWidth } from "../core/protocol.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import type { Viewport } from "./viewport.js";

export interface ListViewOptions {
  /** Blank lines between one item and the next. Absent, none. */
  gap?: number;
  /**
   * Lines kept in view above and below the selected item, where the list has
   * them: the neighbour a cursor is about to move onto. Absent, none.
   */
  context?: number;
}

function lineCount(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(\`ListView: \${name} \${value} is not a whole number of lines\`);
  return value;
}

export class ListView implements Renderable, Measurable {
  readonly gap: number;
  readonly context: number;

  constructor(
    readonly viewport: Viewport,
    readonly items: readonly Renderable[],
    readonly selected: number,
    options: ListViewOptions = {},
  ) {
    this.gap = lineCount("gap", options.gap ?? 0);
    this.context = lineCount("context", options.context ?? 0);
    // An empty list's selection is 0: there is nothing for it to name.
    if (!Number.isInteger(selected) || selected < 0 || selected >= Math.max(1, items.length)) {
      throw new RangeError(\`ListView: selected \${selected} is not an index of \${items.length} items\`);
    }
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const bounded = withBoundedWidth(rawOptions, this);
    const { height: _height, ...rest } = bounded;
    const options = { ...rest, maxWidth: this.viewport.contentWidth(rest.maxWidth) };
    const gap: Segment[][] = Array.from({ length: this.gap }, () => []);
    const drawn = this.items.map((item) => Segment.splitLines(item.render(options)));
    // The gap sits between items, so every item before the selected one
    // brings its lines and one gap.
    const start = drawn.slice(0, this.selected).reduce((total, item) => total + item.length + this.gap, 0);
    const end = start + (drawn[this.selected]?.length ?? 0);
    const lines = drawn.flatMap((item, i) => (i === 0 ? item : [...gap, ...item]));
    this.viewport.content = {
      *render(): Iterable<Segment> {
        for (const line of lines) {
          yield* line;
          yield Segment.line();
        }
      },
    };
    // A range reaching past either end is clamped by the viewport, which holds
    // its offset to the lines that exist. Followed, not ensured: the wheel can
    // scroll away from the selection until the selection moves.
    this.viewport.follow(start - this.context, end + this.context);
    yield* this.viewport.render(bounded);
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    // Stacked, the items are as wide as the widest of them, plus whatever
    // gutter the viewport's scrollbar takes. \`withCellWidth\` and not
    // \`withBoundedWidth\`: the bounded parse asks this very method.
    const options = withCellWidth(rawOptions);
    const contentWidth = this.viewport.contentWidth(options.maxWidth);
    const gutter = this.viewport.gutter;
    const items = measureRenderables({ ...options, maxWidth: contentWidth }, this.items);
    return new Measurement(items.minimum + gutter, items.maximum + gutter).withMaximum(options.maxWidth);
  }
}
` },
      "padding.ts": { kind: "file", mtime: new Date("2026-10-03T04:00:35.308Z"), content: `/**
 * Padding — wraps a renderable with whitespace padding on all four sides.
 */

import { Segment } from "../core/segment.js";
import { cellCount } from "../core/cells.js";
import { Style, NULL_STYLE } from "../core/style.js";
import type { RichText } from "../core/text.js";
import { Measurement } from "../core/measure.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { fitHeight, getStyle, insetHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";
import { embed } from "./embed.js";

export type PaddingDimensions =
  | number
  | [number, number]
  | [number, number, number, number];

/**
 * Parses the shapes a caller may write padding in — one number, a vertical/
 * horizontal pair, or all four sides — into the four-sided form every
 * renderable indexes by, flooring each side at zero.
 *
 * [LAW:parse-dont-validate] This is the one crossing between the public
 * padding vocabulary and the internal tuple, which is why the floor lives
 * here and nowhere downstream: past this point \`" ".repeat(left)\` is safe in
 * any renderable without asking what the caller passed. A negative side used
 * to reach the renderers, where \`Panel\` drew content rows wider than its own
 * border and \`Table\` threw outright.
 */
export function normalizePadding(
  padding: PaddingDimensions,
): [number, number, number, number] {
  // A padding side is a count of cells like any other, so it is parsed by the
  // same rule rather than by a second copy of it: a fractional side reaches
  // \`" ".repeat\`, which truncates, while the rows around it are measured
  // arithmetically — so the padding and the border disagree and the frame
  // breaks. \`cellCount\`'s header carries why the comparison, not \`Math.max\`.
  //
  // \`Infinity\` is where a side stops being an offer and the rule needs the one
  // addition. An unbounded *offer* is a question a renderable can answer, so
  // \`cellCount\` passes it through; an unbounded *side* is a quantity and there
  // is nothing to draw. Unparsed it reached \`budget -= got\` as
  // \`Infinity - Infinity\`, and \`new Padding(text, Infinity).measure(...)\`
  // handed back \`{NaN, NaN}\` from a public API.
  const side = (n: number): number => (Number.isFinite(n) ? cellCount(n) : 0);
  const sides: readonly [number, number, number, number] =
    typeof padding === "number"
      ? [padding, padding, padding, padding]
      : padding.length === 2
        ? [padding[0], padding[1], padding[0], padding[1]]
        : padding;
  return [side(sides[0]), side(sides[1]), side(sides[2]), side(sides[3])];
}

/** The three spans of a padded row, summing to exactly the requested width. */
interface PaddingGeometry {
  readonly left: number;
  readonly contentWidth: number;
  readonly right: number;
}

/**
 * Divides the requested width once into the three spans a padded row is made
 * of, in the order they are worth spending cells on.
 *
 * The three used to be derived separately and disagree where it matters:
 * \`render\` took the canvas as \`Math.max(1, maxWidth - left - right)\`, which
 * clamps *up*, so a padding of 1 inside a 2-cell request drew 3-cell content
 * rows beside 2-cell blank rows — an open frame the terminal then soft-wraps.
 * Content takes its first cell before padding takes any, for the reason
 * \`layoutPanel\` gives: a squeeze should cost you the decoration, not the thing
 * being decorated.
 */
export function layoutPadding(
  outerWidth: number,
  leftWanted: number,
  rightWanted: number,
): PaddingGeometry {
  let budget: number = cellCount(outerWidth);
  const take = (want: number): number => {
    const got = Math.min(want, budget);
    budget -= got;
    return got;
  };

  const firstContentCell = take(1);
  const left = take(leftWanted);
  const right = take(rightWanted);

  return { left, contentWidth: firstContentCell + budget, right };
}

/** The full width of a padded row — the division, added back up. */
function rowWidth(geometry: PaddingGeometry): number {
  return geometry.left + geometry.contentWidth + geometry.right;
}

export class Padding implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
  readonly style: string | Style;
  readonly expand: boolean;

  constructor(
    content: string | RichText | Renderable,
    padding: PaddingDimensions,
    options?: { style?: string | Style; expand?: boolean },
  ) {
    const [top, right, bottom, left] = normalizePadding(padding);
    this.renderable = embed(content);
    this.top = top;
    this.right = right;
    this.bottom = bottom;
    this.left = left;
    this.style = options?.style ?? NULL_STYLE;
    this.expand = options?.expand !== false;
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    // \`expand\` decides how wide the block is, never whether its rows reach
    // that width: as Rich's does, a padding that does not expand narrows to
    // what it measures, and every row is then padded out to it. Deciding the
    // rows instead left the content rows ragged under a full-width blank row,
    // and a \`style\` ground with holes down its right-hand side.
    const width = this.expand ? options.maxWidth : Measurement.get(options, this).maximum;
    const geometry = layoutPadding(width, this.left, this.right);

    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: geometry.contentWidth,
      height: insetHeight(options.height, this.top + this.bottom),
    };

    const resolved = getStyle(options, this.style);
    const style = resolved.isNull ? undefined : resolved;

    // The style is the ground the content is drawn on, not only the spaces
    // around it — Rich's \`render_lines(..., style=style)\`. Applied to the
    // padding alone, a background left a hole behind the content.
    const segments = [...Segment.applyStyle(this.renderable.render(innerOptions), style)];
    const lines = fitHeight(Segment.splitLines(segments), innerOptions.height);
    // Zero-length spans need no branch to suppress: the wire boundary drops
    // empty segments, so a padding the width could not afford emits nothing.
    const leftPad = new Segment(" ".repeat(geometry.left), style);
    const rightPad = new Segment(" ".repeat(geometry.right), style);
    const blankLine = new Segment(" ".repeat(rowWidth(geometry)), style);

    for (let i = 0; i < this.top; i++) {
      yield blankLine;
      yield Segment.line();
    }

    for (const line of lines) {
      yield leftPad;
      // Crops as well as pads: a child that ignored the canvas it was handed
      // (a Table at its natural width) would otherwise burst the padding.
      yield* Segment.adjustLineLength(line, geometry.contentWidth, style);
      yield rightPad;
      yield Segment.line();
    }

    for (let i = 0; i < this.bottom; i++) {
      yield blankLine;
      yield Segment.line();
    }
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    const options = withCellWidth(rawOptions);
    const geometry = layoutPadding(options.maxWidth, this.left, this.right);
    const overhead = geometry.left + geometry.right;

    const measurement = Measurement.get(
      { ...options, maxWidth: geometry.contentWidth },
      this.renderable,
    );
    // The ceiling is what was offered, and it wins over what the child asks
    // for: a range whose floor sits above its own ceiling — this returned
    // {8, 8} for three cells of padding inside a two-cell offer — is one no
    // parent layout can divide.
    const maximum = Math.min(options.maxWidth, measurement.maximum + overhead);
    return {
      minimum: Math.min(measurement.minimum + overhead, maximum),
      maximum,
    };
  }
}
` },
      "rule.ts": { kind: "file", mtime: new Date("2026-10-08T20:44:57.554Z"), content: `/**
 * Rule — a horizontal divider line, optionally with a centered title.
 */

import { asCellCol, cellLen, setCellSize } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { resolveStyle, type RichText } from "../core/text.js";
import type { Style } from "../core/style.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable } from "../core/protocol.js";
import { cutLabel, drawLabel, inlineLabel, type InlineLabel } from "./embed.js";

export type RuleAlign = "left" | "center" | "right";

export interface RuleOptions {
  characters?: string;
  align?: RuleAlign;
  style?: string | Style;
}

const ASCII_RULE_CHAR = "-";
const DEFAULT_RULE_CHAR = "\\u2500"; // ─

export class Rule implements Renderable, Measurable {
  readonly title: string | RichText | undefined;
  readonly characters: string;
  readonly align: RuleAlign;
  readonly style: string | Style;
  private readonly _label: InlineLabel | undefined;

  constructor(title?: string | RichText, options?: RuleOptions) {
    const chars = options?.characters ?? DEFAULT_RULE_CHAR;
    // [LAW:parse-dont-validate] Rich's rule: a rule drawn from zero-width
    // characters would advance no cells, so \`repeatToWidth\` never meets one.
    if (cellLen(chars) < 1) {
      throw new Error("Rule characters must have a cell width of at least 1");
    }
    const align = options?.align;
    if (align !== undefined && align !== "left" && align !== "center" && align !== "right") {
      throw new Error(\`Invalid align value: "\${align}"\`);
    }

    this.title = title;
    this._label = inlineLabel(title);
    this.characters = chars;
    this.align = align ?? "center";
    this.style = options?.style ?? "rule.line";
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const maxWidth = options.maxWidth;
    const ruleChar = drawable(options, this.characters, ASCII_RULE_CHAR);
    // [LAW:single-enforcer] Resolved as Rich resolves the span it appends the
    // line in: a name the theme lacks draws unstyled rather than throwing.
    const style = resolveStyle(options, this.style);
    const ruleStyle = style.isNull ? undefined : style;
    const line = (width: number) => new Segment(repeatToWidth(ruleChar, width), ruleStyle);

    // Rich's \`required_space\`: a centred title keeps a rule cell and a space
    // either side of it, an aligned one a space and a rule cell on its open
    // side. A rule with no room past that draws no title, as one without a title.
    const room = Math.max(0, maxWidth - (this.align === "center" ? 4 : 2));
    if (this._label === undefined || room === 0) {
      yield line(maxWidth);
      yield Segment.line();
      return;
    }

    // Rich's \`render_str(title, style="rule.text")\`: the title is read in its
    // own style and set beside the line, never in the line's style.
    const text = this._label.text(options, "rule.text");
    cutLabel(text, room, drawable(options, "\\u2026", "."));
    const title = drawLabel(text, options, undefined);
    const titleWidth = Segment.getLineLength(title);

    // As Rich lays the line out: the gaps of a centred title are the rule's,
    // styled with it; an aligned title's one gap is unstyled.
    switch (this.align) {
      case "center": {
        const left = Math.floor((maxWidth - titleWidth) / 2) - 1;
        yield new Segment(\`\${repeatToWidth(ruleChar, left)} \`, ruleStyle);
        yield* title;
        yield new Segment(\` \${repeatToWidth(ruleChar, maxWidth - left - titleWidth - 2)}\`, ruleStyle);
        break;
      }
      case "left":
        yield* title;
        yield new Segment(" ");
        yield line(maxWidth - titleWidth - 1);
        break;
      case "right":
        yield line(maxWidth - titleWidth - 1);
        yield new Segment(" ");
        yield* title;
        break;
    }
    yield Segment.line();
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: _options.maxWidth };
  }
}

// [LAW:one-source-of-truth] \`setCellSize\` crops between the grapheme clusters
// \`cellLen\` measures, so \`❤️\` or \`👨‍👩‍👧\` is never cut in half or over-counted.
function repeatToWidth(char: string, width: number): string {
  return setCellSize(char.repeat(Math.ceil(width / cellLen(char))), asCellCol(width));
}
` },
      "spinner.ts": { kind: "file", mtime: new Date("2026-10-03T11:13:13.194Z"), content: `/**
 * Spinner — animated terminal spinner with optional text label.
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import { SPINNERS, DEFAULT_SPINNER, LINE_SPINNER } from "../core/spinnerData.js";
import type { SpinnerData } from "../core/spinnerData.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable } from "../core/protocol.js";
import { EmbeddedText } from "./embed.js";

const spinnerGlyphs = ({ frames }: SpinnerData): string => frames.join("");

export interface SpinnerOptions {
  speed?: number;
  style?: string | Style;
}

export class Spinner implements Renderable, Measurable {
  readonly name: string;
  readonly speed: number;
  readonly style: string | Style;
  /**
   * The label drawn after the frame. It is read through \`embed\`'s one crossing
   * each time it is drawn, so a string is markup under the console that draws
   * it, as a string handed to \`print\` is — where Rich's \`Spinner\` parses it
   * whatever the console says — and a \`RichText\` changed in place draws as
   * changed, as the \`Text\` Rich keeps does. [LAW:single-enforcer]
   */
  text: string | RichText;
  private readonly _data: SpinnerData;
  private _frameIndex: number;
  private _lastUpdate: number;

  constructor(name?: string, text: string | RichText = "", options?: SpinnerOptions) {
    const spinnerName = name ?? DEFAULT_SPINNER;
    const data = SPINNERS[spinnerName];
    if (!data) {
      throw new Error(\`Unknown spinner: "\${spinnerName}"\`);
    }
    this.name = spinnerName;
    this.text = text;
    this.speed = options?.speed ?? 1;
    this.style = options?.style ?? NULL_STYLE;
    this._data = data;
    this._frameIndex = 0;
    this._lastUpdate = Date.now();
  }

  get frames(): readonly string[] {
    return this._data.frames;
  }

  get interval(): number {
    return this._data.interval;
  }

  /** Advance the frame count by the time elapsed, and return it. */
  private _advance(): number {
    const now = Date.now();
    // Whole frames passed at this speed; a negative speed steps backwards, as
    // Rich's does, so the index wraps with a modulo that is never negative.
    const steps = Math.trunc(((now - this._lastUpdate) * this.speed) / this.interval);
    if (steps !== 0) {
      const count = this._data.frames.length;
      this._frameIndex = (((this._frameIndex + steps) % count) + count) % count;
      this._lastUpdate = now;
    }
    return this._frameIndex;
  }

  /** The frames this output can draw: the \`line\` spinner stands in for any other on an ASCII-only one. */
  private _drawnFrames(options: RenderOptions): readonly string[] {
    return drawable(options, this._data, LINE_SPINNER, spinnerGlyphs).frames;
  }

  /**
   * The current frame and its label as one line wrapped to the width and
   * ended, as the reference's \`Text\` is — printed, stacked in a \`Group\`, or
   * laid out in a \`Progress\` cell alike.
   */
  *render(options: RenderOptions): Iterable<Segment> {
    yield* this._currentLine(options).render(options);
    yield Segment.line();
  }

  private _currentLine(options: RenderOptions): RichText {
    const frames = this._drawnFrames(options);
    return this._line(frames[this._advance() % frames.length]!, options);
  }

  /**
   * \`frame\` and the label as one text, as Rich's \`Text.assemble(frame, " ",
   * text)\`: a long label wraps as one line with its frame. A label that draws
   * nothing — the default \`""\`, or markup that styles nothing — is no label,
   * not a trailing space, as an empty \`Text\` is falsy there.
   */
  private _line(frame: string, options: RenderOptions): RichText {
    const line = new RichText("", { end: "" }).append(frame, this.style);
    // Unhighlighted: Rich's label is a \`Text\` from the moment it is handed over, and a \`Text\` is never highlighted.
    const label = new EmbeddedText(this.text).text({ ...options, highlight: false });
    if (label.plain !== "") line.append(" ").append(label);
    return line;
  }

  /**
   * Measured at its widest frame, so a column holding it never narrows as it
   * turns, and never offered less than that frame: a frame is one picture,
   * which the reference's \`Text\` measure would let wrap apart at its spaces.
   */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const frames = this._drawnFrames(options);
    const widths = frames.map((frame) => cellLen(frame));
    const frameWidth = Math.max(...widths);
    const { minimum, maximum } = this._line(frames[widths.indexOf(frameWidth)]!, options).measure(options);
    return { minimum: Math.max(minimum, Math.min(frameWidth, maximum)), maximum };
  }
}
` },
      "status.ts": { kind: "file", mtime: new Date("2026-10-03T03:22:31.675Z"), content: `/**
 * Status — displays a spinner animation with a status message.
 *
 * Its renderable is a \`Spinner\` whose label is the message, as Rich's is, so
 * the message is drawn the way the spinner draws its label: a string is markup
 * under the console that draws it.
 */

import type { Style } from "../core/style.js";
import type { RichText } from "../core/text.js";
import { Console } from "../core/console.js";
import { Spinner } from "./spinner.js";
import { Live } from "./live.js";

export interface StatusOptions {
  spinner?: string;
  speed?: number;
  /** The spinner's frame style; the message styles itself with its markup. */
  spinnerStyle?: string | Style;
  console?: Console;
}

export class Status {
  private _live: Live;
  private _spinner: Spinner;
  private _console: Console;

  constructor(message: string | RichText, options?: StatusOptions) {
    this._console = options?.console ?? new Console();
    this._spinner = new Spinner(options?.spinner ?? "dots", message, {
      speed: options?.speed,
      style: options?.spinnerStyle ?? "status.spinner",
    });
    this._live = new Live(this._spinner, {
      console: this._console,
      transient: true,
      refreshPerSecond: 12.5,
    });
  }

  get console(): Console {
    return this._console;
  }

  get message(): string | RichText {
    return this._spinner.text;
  }

  set message(value: string | RichText) {
    this._spinner.text = value;
  }

  start(): void {
    this._live.start();
  }

  stop(): void {
    this._live.stop();
  }

  update(message: string | RichText): void {
    this._spinner.text = message;
    this._live.update(this._spinner, { refresh: true });
  }
}
` },
    } },
    "themes": { kind: "directory", children: {
      "colorRef.ts": { kind: "file", mtime: new Date("2026-10-03T04:58:50.922Z"), content: `import { ColorParseError, type ColorRgba, parseHexColor } from "../core/color.js";
import type { Palette } from "./palette.js";

/**
 * A **color reference** is the one string form an author uses to name a
 * concrete color: a palette variable name (\`"primary"\`, \`"surface-active"\`,
 * \`"text-primary"\`) or a literal \`#RRGGBB\` / \`#RRGGBBAA\`.
 *
 * [LAW:parse-dont-validate] \`resolveColorRef\` is the single checkpoint that
 * turns an untrusted reference string into a \`ColorRgba\`. Everything
 * downstream — color math, \`Style\` construction, serialization — takes
 * \`ColorRgba\` and therefore cannot ask again whether the name existed. There
 * is no \`isValidColorRef\` companion, deliberately: a validator would hand back
 * the same \`string\` it was given and every consumer would re-check.
 *
 * [LAW:no-silent-failure] A miss throws. An unknown palette name is a broken
 * config, and the author needs to see which name and what was available — not
 * a silently substituted default that makes the bar merely look wrong.
 */
export class ColorRefError extends Error {
  constructor(
    readonly ref: string,
    detail: string,
    options?: ErrorOptions,
  ) {
    super(\`color reference \${JSON.stringify(ref)} did not resolve — \${detail}\`, options);
    this.name = "ColorRefError";
  }
}

// A reference *shaped* like hex is resolved as hex; anything else is a palette
// name. This is a lexical distinction with no overlap — palette variable names
// never begin with \`#\` — so it is a parse, not a mode. A \`#\`-leading string
// that is malformed hex fails loudly here rather than falling through to a
// palette lookup that would report a confusing "unknown name" instead of
// "malformed hex".
const HEX_LEAD = "#";

// Cap the "did you mean" list. Palettes carry ~150 variables; dumping all of
// them buries the message. Nearby names are what a mistyped reference needs.
const SUGGESTION_LIMIT = 8;

/**
 * Resolve a color reference against \`palette\`.
 *
 * Accepting hex alongside names is what makes this **idempotent**:
 * \`resolveColorRef(p, resolveColorRef(p, r).hex)\` equals
 * \`resolveColorRef(p, r)\` for every \`r\` this function accepts. Callers
 * therefore never branch on "is this a palette name or already a color" —
 * they call it unconditionally on whatever the author wrote, whether that is
 * \`"surface-active"\` or the output of a chain of color math.
 * [LAW:dataflow-not-control-flow]
 *
 * @throws {ColorRefError} on malformed hex or an unknown palette name.
 */
export function resolveColorRef(palette: Palette, ref: string): ColorRgba {
  const trimmed = ref.trim();

  if (trimmed.startsWith(HEX_LEAD)) {
    try {
      return parseHexColor(trimmed);
    } catch (cause) {
      if (!(cause instanceof ColorParseError)) throw cause;
      throw new ColorRefError(ref, cause.message, { cause });
    }
  }

  const hit = palette.get(trimmed);
  if (hit === undefined) {
    throw new ColorRefError(
      ref,
      \`no such variable in palette \${JSON.stringify(palette.name)}\` +
        suggest(palette, trimmed),
    );
  }
  return hit;
}

// Names sharing a prefix or suffix with the miss — enough to catch the two
// mistakes that actually happen (a wrong qualifier, \`surface-active\` vs
// \`surface-lighten\`; a wrong root, \`text-primary\` vs \`primary-text\`) without
// printing the whole palette.
function suggest(palette: Palette, miss: string): string {
  const parts = miss.split("-");
  const near = [...palette.vars.keys()]
    .filter((name) => parts.some((part) => part !== "" && name.includes(part)))
    .slice(0, SUGGESTION_LIMIT);
  return near.length === 0 ? "" : \`; did you mean: \${near.join(", ")}\`;
}
` },
      "palette.ts": { kind: "file", mtime: new Date("2026-10-03T13:18:20.606Z"), content: `import type { ColorRgba } from "../core/color.js";

/**
 * A semantic palette: a named map from variable name → ColorRgba.
 *
 * Distinct from \`ColorTable\` (the integer-indexed quantization LUT used by
 * the downgrade pipeline). Palettes carry aesthetic intent — \`primary\`,
 * \`accent\`, \`error\`, etc. — and are the foundation of the theming system.
 *
 * Storage is uniformly ColorRgba; consumers that load from hex JSON
 * parse to ColorRgba at load time. \`get\` is a bare lookup — turning an
 * author-written *reference* (a name, or a \`#RRGGBB\` literal) into a colour
 * is \`resolveColorRef\`'s job in \`colorRef.ts\`, so a Palette never has to
 * know about the syntax callers write.
 *
 * Every colour a Palette hands out is opaque or fully transparent. A theme's translucent variable
 * (Textual's \`boost\`, a hover overlay) is a tint meant for that theme's own
 * background, and a colour leaving the palette no longer knows which
 * background that was: the SGR writer would composite it over the terminal's
 * black, which is not the theme's background, and draw a tint the theme never
 * meant.
 * So it is drawn onto \`background\` here, once, and the writer, the exporters
 * and the contrast choosers all read the colour it has there. On any other
 * surface it keeps that colour: the tint does not follow what is under it.
 * The exception is a fully transparent colour, Textual's "no background": it
 * draws nothing on any surface, so it needs none and is handed out as it is,
 * and a \`Style\` reads it as no background at all.
 *
 * @throws RangeError when \`background\` is translucent, or when a colour is
 * partly transparent and there is no \`background\` to draw it on.
 */
export class Palette {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: ReadonlyMap<string, ColorRgba>;

  constructor(
    name: string,
    dark: boolean,
    vars: ReadonlyMap<string, ColorRgba>,
  ) {
    this.name = name;
    this.dark = dark;
    // [LAW:single-enforcer] Every palette is built through here, so this is
    // where "a palette colour is opaque or draws nothing" holds. The fresh map is also the
    // defensive copy: ReadonlyMap is a compile-time aliasing constraint, not a
    // runtime one.
    const background = vars.get("background");
    const draw: (colour: ColorRgba, key: string) => ColorRgba =
      background === undefined ? opaqueOnly(name) : drawnOn(name, background);
    this.vars = new Map([...vars].map(([key, colour]) => [key, draw(colour, key)]));
  }

  get(key: string): ColorRgba | undefined {
    return this.vars.get(key);
  }
}

/**
 * A palette colour as it is drawn: composited onto the palette's own
 * \`background\`, which has nothing under it and so must itself be opaque.
 * [LAW:one-source-of-truth] The one statement of what a translucent palette
 * colour means; \`buildPalette\` draws its base colours through it before
 * deriving from them.
 */
export function drawnOn(name: string, background: ColorRgba): (colour: ColorRgba) => ColorRgba {
  if (background.alpha !== 1) {
    throw new RangeError(
      \`palette \${JSON.stringify(name)}: background is the surface its translucent colours are drawn on, so it must be opaque; got \${background.hex}\`,
    );
  }
  // A fully transparent colour is not a tint: it draws nothing on any surface.
  return (colour) => (colour.alpha === 0 ? colour : colour.compositeOver(background));
}

// A palette with no background has nothing to draw a translucent colour on.
function opaqueOnly(name: string): (colour: ColorRgba, key: string) => ColorRgba {
  return (colour, key) => {
    if (colour.alpha !== 1 && colour.alpha !== 0) {
      throw new RangeError(
        \`palette \${JSON.stringify(name)}: \${key} is translucent (\${colour.hex}) but the palette has no "background" to draw it on\`,
      );
    }
    return colour;
  };
}
` },
      "ramp.ts": { kind: "file", mtime: new Date("2026-10-03T02:43:02.525Z"), content: `/**
 * A color ramp: a number mapped onto a color through ordered stops.
 *
 * "What does 73 % spent look like" has no answer in a vocabulary of discrete
 * adjustments (\`darken\`, \`mix\`, \`contrastOn\`): each takes colors and returns a
 * color, and none takes a *measurement*. Without a ramp the answer gets
 * computed outside the theme system — a script emits a hex, a template
 * branches \`if ge .pct 80 … else if ge .pct 50 …\` — and that color decision
 * can no longer transpose with the palette it was meant to belong to. A ramp
 * is the one function whose input is a number, so the decision stays inside.
 *
 * A threshold cascade is a ramp too: the same stops with the \`step\` ease hold
 * each color until the next position, which is exactly \`≥ threshold → hotter\`
 * written as data. [LAW:one-type-per-behavior] One primitive; the easing is a
 * value — any \`Ease\` from \`core/easing\`, the vocabulary every effect shares —
 * so a gradient and a cascade differ by one word, not by which function was
 * called. [LAW:dataflow-not-control-flow] \`at\` applies it unconditionally.
 *
 * Interpolation is in OKLCH (\`Oklch.mix\`), so a \`linear\` ramp between two
 * theme colors passes through perceptually even steps rather than the muddy
 * midpoints of an sRGB blend.
 *
 * [LAW:one-way-deps] Imports \`core/color\`, \`core/easing\` and \`core/oklch\`
 * only; nothing here knows what a palette is. Resolving stop *names* is the template binding's
 * job (\`paletteFuncs\`), which hands this module resolved colors.
 */

import type { ColorRgba } from "../core/color.js";
import type { Ease } from "../core/easing.js";
import { Oklch } from "../core/oklch.js";

/** One stop: the color the ramp is exactly \`color\` at position \`at\`. */
export interface ColorStop {
  readonly at: number;
  readonly color: ColorRgba;
}

/**
 * An immutable ramp over stops sorted by position.
 *
 * [LAW:single-enforcer] The constructor is the one place a ramp's shape is
 * checked — at least one stop, every position finite, positions
 * non-decreasing — matching the \`ColorRgba\`/\`Oklch\` pattern. Positions are
 * required to arrive in order rather than being sorted here: a ramp whose
 * stops are read from configuration (\`warning at 80, error at 50\`) is an
 * authoring mistake, and sorting would quietly render a different ramp than
 * the one written. [LAW:no-silent-failure]
 *
 * Two stops may share a position: that is a hard edge, the later color
 * taking over at exactly that value (CSS gradients spell a hard stop the
 * same way).
 */
export class ColorRamp {
  constructor(
    readonly ease: Ease,
    readonly stops: readonly ColorStop[],
  ) {
    if (stops.length === 0) {
      throw new RangeError("a ColorRamp needs at least one stop");
    }
    for (const [i, stop] of stops.entries()) {
      if (!Number.isFinite(stop.at)) {
        throw new RangeError(\`ColorRamp stop \${i} has a non-finite position \${stop.at}\`);
      }
      const prev = stops[i - 1];
      if (prev !== undefined && stop.at < prev.at) {
        throw new RangeError(
          \`ColorRamp stops must be in ascending position order; \` +
            \`stop \${i} at \${stop.at} follows stop \${i - 1} at \${prev.at}\`,
        );
      }
    }
  }

  /**
   * The color at \`value\`. Below the first stop it is the first color; at or
   * above the last stop it is the last; between two stops the raw progress
   * from the lower to the upper goes through \`ease\`, and the eased progress
   * says how far to mix.
   *
   * Eased progress 0 is the lower stop's color and 1 the upper's, byte for
   * byte — the exactness contract, not a shortcut: the sRGB → OKLCH → sRGB
   * round-trip can land a channel one unit off, and a ramp that did not hit
   * its own stops exactly would make a \`step\` ramp paint a color the author
   * never wrote. So a value on a stop is that stop's color whenever the ease
   * starts at 0, as every built-in does but \`step-start\` and the
   * \`jump-start\`/\`jump-both\` steps, which jump at the start of the interval as
   * CSS defines them. An ease that overshoots [0, 1] holds the end colors
   * where it does: a ramp never paints outside its stops.
   */
  at(value: number): ColorRgba {
    if (!Number.isFinite(value)) {
      throw new RangeError(\`ColorRamp.at needs a finite value, got \${value}\`);
    }
    const stops = this.stops;
    // The last stop at or below \`value\`; -1 when \`value\` is below them all.
    let lower = -1;
    while (lower + 1 < stops.length && (stops[lower + 1] as ColorStop).at <= value) lower++;
    if (lower < 0) return (stops[0] as ColorStop).color;
    const from = stops[lower] as ColorStop;
    if (lower === stops.length - 1) return from.color;
    // \`to.at > value >= from.at\` by construction of \`lower\`, so the segment
    // has positive width and raw progress is in [0, 1).
    const to = stops[lower + 1] as ColorStop;
    const t = this.ease((value - from.at) / (to.at - from.at));
    if (t <= 0) return from.color;
    if (t >= 1) return to.color;
    return Oklch.fromRgba(from.color).mix(Oklch.fromRgba(to.color), t).toRgba();
  }
}
` },
      "terminalThemes.ts": { kind: "file", mtime: new Date("2026-09-28T03:22:35.639Z"), content: `/**
 * Pre-built \`TerminalTheme\` constants — every theme in the registry has a
 * matching \`<NAME>\` export here. There is no inline-only theme; the data
 * file is the single source of truth for every theme's hex values.
 *
 * Editing \`data/<name>.ts\` updates both the registry's full ~150-var
 * palette (via \`getThemePalette(name)\`) AND the matching \`TerminalTheme\`
 * constant exported below (via \`getThemeBaseColors(name)\`, which pulls
 * just the 8 substrate keys). The two views never drift because both
 * derive from the same authored data.
 *
 * [LAW:one-source-of-truth] Hex values live in \`data/<name>.ts\`. This
 * module is a derived view that builds a \`TerminalTheme\` from each
 * theme's eight base colors via \`buildPalette\` for the substrate palette,
 * and from the theme's own ANSI table for the sixteen named colours.
 *
 * [LAW:one-type-per-behavior] Every theme has the same shape — name,
 * \`dark\` flag, full Palette in the registry, \`TerminalTheme\` constant
 * here. Consumers can pick any theme by name without branching on which
 * APIs work for it.
 *
 * [LAW:one-way-deps] \`core/color → themes/palette\` remains the only edge
 * into themes/. This file imports only sibling theme modules and core
 * color primitives; nothing in \`core/\` imports back.
 */

import { TerminalTheme } from "../core/color.js";
import { buildPalette } from "./buildPalette.js";
import { getThemeBaseColors, type ThemeBaseColors } from "./registry.js";

function defineTheme(d: ThemeBaseColors): TerminalTheme {
  return new TerminalTheme(
    d.bg,
    d.fg,
    d.ansi,
    buildPalette(d.name, d.dark, {
      primary: d.primary,
      secondary: d.secondary,
      accent: d.accent,
      success: d.success,
      warning: d.warning,
      error: d.error,
      background: d.bg,
      foreground: d.fg,
    }),
  );
}

export const DEFAULT_TERMINAL_THEME = defineTheme(getThemeBaseColors("default"));
export const SVG_EXPORT_THEME = defineTheme(getThemeBaseColors("svg-export"));
export const MONOKAI = defineTheme(getThemeBaseColors("monokai"));
export const NORD = defineTheme(getThemeBaseColors("nord"));
export const GRUVBOX = defineTheme(getThemeBaseColors("gruvbox"));
export const DRACULA = defineTheme(getThemeBaseColors("dracula"));
export const TOKYO_NIGHT = defineTheme(getThemeBaseColors("tokyo-night"));
export const FLEXOKI = defineTheme(getThemeBaseColors("flexoki"));
export const CYBERPUNK = defineTheme(getThemeBaseColors("cyberpunk"));
export const CATPPUCCIN_MOCHA = defineTheme(getThemeBaseColors("catppuccin-mocha"));
export const CATPPUCCIN_LATTE = defineTheme(getThemeBaseColors("catppuccin-latte"));
export const CATPPUCCIN_FRAPPE = defineTheme(getThemeBaseColors("catppuccin-frappe"));
export const CATPPUCCIN_MACCHIATO = defineTheme(getThemeBaseColors("catppuccin-macchiato"));
export const SOLARIZED_DARK = defineTheme(getThemeBaseColors("solarized-dark"));
export const SOLARIZED_LIGHT = defineTheme(getThemeBaseColors("solarized-light"));
export const ROSE_PINE = defineTheme(getThemeBaseColors("rose-pine"));
export const ROSE_PINE_MOON = defineTheme(getThemeBaseColors("rose-pine-moon"));
export const ROSE_PINE_DAWN = defineTheme(getThemeBaseColors("rose-pine-dawn"));
export const ATOM_ONE_DARK = defineTheme(getThemeBaseColors("atom-one-dark"));
export const ATOM_ONE_LIGHT = defineTheme(getThemeBaseColors("atom-one-light"));
export const TEXTUAL_DARK = defineTheme(getThemeBaseColors("textual-dark"));
export const TEXTUAL_LIGHT = defineTheme(getThemeBaseColors("textual-light"));
export const TEXTUAL_ANSI = defineTheme(getThemeBaseColors("textual-ansi"));
` },
    } },
    "host": { kind: "directory", children: {
      "index.ts": { kind: "file", mtime: new Date("2026-10-15T05:16:51.896Z"), content: `export { BrowserTerminalHost } from "./terminal-host.js";
export type {
  TerminalHost,
  TerminalSize,
  DataHandler,
  ResizeHandler,
  ExitHandler,
  BrowserTerminalHostOptions,
  XtermTerminal,
  XtermDisposable,
  XtermResizeEvent,
} from "./terminal-host.js";
export { hostEnvironment } from "./host-environment.js";
export { App } from "./app.js";
export type { AppMouseEvent, AppOptions, AppPhase, Wheel } from "./app.js";
export type { Surface } from "../core/paint.js";
export { keyName } from "./input.js";
export type { KeyPress, ScreenMouseEvent } from "./input.js";
` },
      "host-environment.ts": { kind: "file", mtime: new Date("2026-09-29T10:56:57.281Z"), content: `/**
 * hostEnvironment — a \`TerminalHost\` as the \`ConsoleEnvironment\` a \`Console\`
 * consults, so a console writing through a host asks that host every question
 * it has about its destination.
 *
 * [LAW:one-source-of-truth] A console asks its destination four things: where
 * bytes go, is it a terminal, how big is it, and — through the environment —
 * what colours it draws. A bare sink answers only the first, and the other
 * three fall to the ambient \`process\`: some other stream's answer in node,
 * none in a browser, where a console on xterm.js saw an unnamed TTY and drew
 * 16 colours. Handing the console the whole environment keeps all four
 * answers the host's.
 *
 * The host's size is \`size()\`, so the environment handed on carries no
 * \`COLUMNS\` or \`LINES\`: a console reads those ahead of the stream, and an
 * exported \`COLUMNS\` in the shell that launched a node host would pin the
 * console's width while the terminal it draws on is resized. The stream's
 * \`columns\` and \`rows\` are getters, so a console that was not given a fixed
 * size follows the host through resizes.
 */

import type { ConsoleEnvironment, ConsoleStream } from "../core/console.js";
import type { TerminalHost } from "./terminal-host.js";

// [LAW:types-are-the-program] A host always has a stream, so the return type
// says so rather than inheriting \`ConsoleEnvironment\`'s optional ones. It is
// one terminal, so stdout and stderr are the same stream — which is where a
// program's two streams land when both are attached to a terminal.
export function hostEnvironment(
  host: TerminalHost,
): ConsoleEnvironment & { readonly stdout: ConsoleStream; readonly stderr: ConsoleStream } {
  const { COLUMNS: _columns, LINES: _lines, ...env } = host.env;
  const stream: ConsoleStream = {
    write(chunk: string | Uint8Array): void {
      host.write(chunk);
    },
    // [LAW:one-source-of-truth] A console asks whether its output is a
    // terminal, which is the host's \`writesToTerminal\`, not its \`isTTY\`.
    get isTTY(): boolean {
      return host.writesToTerminal;
    },
    get columns(): number {
      return host.size().cols;
    },
    get rows(): number {
      return host.size().rows;
    },
  };
  return { env, stdout: stream, stderr: stream };
}
` },
    } },
    "node": { kind: "directory", children: {
      "save.ts": { kind: "file", mtime: new Date("2026-09-30T08:50:45.966Z"), content: `/**
 * node:save — node-only file helpers that persist recorded console output.
 *
 * [LAW:locality-or-seam] These functions live outside the main barrel so
 * Console can stop importing \`fs\`. Importing \`Console\` itself stays
 * browser-safe; importing this module is the explicit opt-in for the
 * fs-backed surface, and bundlers targeting the browser will (correctly)
 * refuse to resolve \`fs\` if a consumer ever pulls it in by accident.
 *
 * [LAW:single-enforcer] One funnel per format: \`saveText\` consumes
 * \`Console.exportText()\`, \`saveHtml\` consumes \`Console.exportHtml()\`, and
 * \`saveSvg\` consumes \`Console.exportSvg()\`. The encoding and recording logic
 * stays on Console; this file is purely the IO sink.
 */

import { writeFileSync } from "node:fs";
import type { Console } from "../core/console.js";

export function saveText(
  out: Console,
  path: string,
  options?: Parameters<Console["exportText"]>[0],
): void {
  writeFileSync(path, out.exportText(options), "utf-8");
}

export function saveHtml(
  out: Console,
  path: string,
  options?: Parameters<Console["exportHtml"]>[0],
): void {
  writeFileSync(path, out.exportHtml(options), "utf-8");
}

export function saveSvg(
  out: Console,
  path: string,
  options?: Parameters<Console["exportSvg"]>[0],
): void {
  writeFileSync(path, out.exportSvg(options), "utf-8");
}
` },
      "prompt.ts": { kind: "file", mtime: new Date("2026-10-03T06:47:33.162Z"), content: `/**
 * node:prompt — readline-backed \`PromptInput\` for use with the prompt
 * renderable in a Node runtime.
 *
 * [LAW:locality-or-seam] \`node:readline\` lives only here, on the node side
 * of the API boundary. The main barrel stays browser-safe; consumers that
 * want interactive prompts in Node opt in by importing \`nodeAsk\` and
 * passing it as the input capability:
 *
 *     import { Prompt } from "@promptctl/rich-js";
 *     import { nodeAsk } from "@promptctl/rich-js/node/prompt";
 *     const answer = await Prompt.ask("What's your name?", nodeAsk);
 *     // or with options:
 *     const choice = await Prompt.ask("Pick one", nodeAsk, { choices: ["a", "b"] });
 *
 * The prompt is printed by the \`Console\` it was asked on — the app's, when it
 * passed one as \`console\`, a new default one otherwise — and then a line is
 * read, as Rich's \`Console.input\` prints its prompt and calls \`input()\`. So
 * the prompt is coloured exactly as that console's own output would be and
 * goes to its target: a console on stderr asks on stderr, beside the
 * invalid-answer messages it prints. It goes as one logical line, never broken
 * at the console's width: the terminal wraps it at whatever width it has.
 *
 * readline reads in non-terminal mode, the terminal's own cooked line
 * discipline, as Python's \`input()\` does without its readline module: in
 * terminal mode readline redraws the line itself, prompt included, and needs a
 * whole \`tty.WriteStream\` to draw on, which a console's target need not be.
 *
 * [LAW:single-enforcer] One readline interface per \`nodeAsk\` call —
 * created, asked, closed. No shared \`rl\` across prompts, no listener-leak
 * pitfalls when callers stack prompts in a loop.
 */

import * as readline from "node:readline";
import type { PromptInput } from "../renderables/prompt.js";

export const nodeAsk: PromptInput = (prompt, console) => {
  console.print(prompt, { end: "", softWrap: true });
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      // [LAW:types-are-the-program] exception: readline types its output as a
      // whole \`NodeJS.WritableStream\`, and a console's target is only a
      // \`ConsoleSink\`. With \`terminal: false\` readline only ever calls its
      // \`write\`, whatever its \`isTTY\` says.
      output: console.file as NodeJS.WritableStream,
      terminal: false,
    });
    rl.question("", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};
` },
    } },
  } },
  "test": { kind: "directory", children: {
    "core": { kind: "directory", children: {
      "clock.test.ts": { kind: "file", mtime: new Date("2026-10-03T02:43:02.526Z"), content: `import { describe, expect, it } from "vitest";
import { frameRate } from "../../src/core/clock.js";

describe("frameRate", () => {
  it.each([30, 1, 0.5, 12.5])("takes %s frames a second, with the interval between them", (perSecond) => {
    const rate = frameRate(perSecond);
    expect(rate.perSecond).toBe(perSecond);
    expect(rate.interval).toBe(1 / perSecond);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e-7, Number.MIN_VALUE])("refuses %s", (perSecond) => {
    expect(() => frameRate(perSecond)).toThrow(RangeError);
  });

  it("takes the slowest rate a platform timer can wait out, and nothing slower", () => {
    const longest = (2 ** 31 - 1) / 1000;
    expect(frameRate(1.001 / longest).interval).toBeCloseTo(longest / 1.001);
    expect(() => frameRate(1 / (longest * 1.01))).toThrow(RangeError);
  });
});
` },
      "fnv1a.test.ts": { kind: "file", mtime: new Date("2026-09-30T08:38:20.326Z"), content: `import { describe, it, expect } from "vitest";
import { fnv1a } from "../../src/core/fnv1a.js";

describe("fnv1a", () => {
  it("matches the published FNV-1a 32-bit vectors", () => {
    expect(fnv1a("")).toBe("811c9dc5");
    expect(fnv1a("a")).toBe("e40c292c");
    expect(fnv1a("foobar")).toBe("bf9cf968");
  });

  it("hashes UTF-8 bytes, not UTF-16 code units", () => {
    // U+00E9 is one code unit but the two bytes C3 A9.
    expect(fnv1a("é")).toBe(fnv1a("é"));
    expect(fnv1a("é")).not.toBe(fnv1a("Ã©"));
  });
});
` },
      "memo.test.ts": { kind: "file", mtime: new Date("2026-10-03T02:43:02.527Z"), content: `import { describe, it, expect } from "vitest";
import { MEMO_MAX, Memo } from "../../src/core/memo.js";
import { ColorSpec } from "../../src/core/color.js";
import { Style } from "../../src/core/style.js";

// Enough distinct keys to force at least one clear.
const PAST_BOUND = MEMO_MAX + 1;

function hex(i: number): string {
  return \`#\${i.toString(16).padStart(6, "0")}\`;
}

describe("Memo", () => {
  it("computes once per key while the key is remembered", () => {
    const memo = new Memo<{ key: string }>();
    let computed = 0;
    const compute = (key: string) => {
      computed++;
      return { key };
    };
    const first = memo.get("a", compute);
    expect(memo.get("a", compute)).toBe(first);
    expect(computed).toBe(1);
  });

  it("never holds more than MEMO_MAX entries", () => {
    const memo = new Memo<number>();
    for (let i = 0; i < 2 * MEMO_MAX + 1; i++) memo.get(String(i), (key) => key.length);
    expect(memo.size).toBeLessThanOrEqual(MEMO_MAX);
  });

  it("keeps its entries when a compute throws at the bound", () => {
    const memo = new Memo<number>();
    for (let i = 0; i < MEMO_MAX; i++) memo.get(String(i), (key) => key.length);
    expect(() =>
      memo.get("bad", () => {
        throw new Error("bad");
      }),
    ).toThrow("bad");
    expect(memo.size).toBe(MEMO_MAX);
  });
});

describe("parse memos return an equal value after their entry is dropped", () => {
  it("ColorSpec.parse", () => {
    const before = ColorSpec.parse("#abcdef");
    for (let i = 0; i < PAST_BOUND; i++) ColorSpec.parse(hex(i));
    expect(ColorSpec.parse("#abcdef")).toEqual(before);
  });

  it("Style.parse", () => {
    const before = Style.parse("italic #abcdef");
    for (let i = 0; i < PAST_BOUND; i++) Style.parse(\`bold \${hex(i)}\`);
    expect(Style.parse("italic #abcdef").equals(before)).toBe(true);
  });
});
` },
    } },
  } },
  "docs": { kind: "directory", children: {
    "introduction.md": { kind: "file", mtime: new Date("2026-10-08T20:44:57.519Z"), content: `# Introduction

**rich-js** is a library for rich text and beautiful formatting in the terminal. It gives you color, styles, tables, progress bars, markdown rendering, and syntax highlighting out of the box — making CLI output visually appealing and debugging faster via pretty-printing and automatic highlighting. It also includes OKLCH-based [theme transposition](/transpose) and an [accessibility-aware contrast toolkit](/contrast) for working with color at runtime.

## Compatibility

rich-js runs on **Linux**, **macOS**, and **Windows**. It requires **Node.js ≥ 20** and is ESM-only.

Color support varies by terminal:

| Terminal | Color support |
|---|---|
| Modern Linux/macOS terminals | Truecolor (16.7 million) |
| Windows Terminal | Truecolor |
| Legacy Windows console | 8 colors |
| \`TERM=dumb\` / piped output | None |

rich-js detects your terminal's capabilities automatically and downsamples colors as needed. You never need to think about it.

## Installation

\`\`\`sh
npm install @promptctl/rich-js
\`\`\`

## Quick start

\`\`\`typescript
import { Console } from "@promptctl/rich-js";

const console = new Console();

// Inline markup applies styles to any span of text
console.print("[bold magenta]Hello[/bold magenta], [cyan]World![/cyan] :wave:");

// Plain objects are automatically pretty-printed
console.print({ name: "Alice", scores: [98, 87, 95] });
\`\`\`

## Using the Console

\`Console\` is the main entry point. Create one instance in a module of its own,
say \`console.ts\` holding \`export const console = new Console();\`, and import it
wherever you need output with \`import { console } from "./console.js";\`. Every
call then goes through that one instance:

\`\`\`typescript
console.print("[green]:check_mark: Done![/green] [dim]3 files written[/dim]");
\`\`\`

The Console auto-detects terminal size and color support. See [Console](./console) for the full reference.

The examples in these docs assume that \`console\` is \`new Console()\` and that the library names they use come from \`@promptctl/rich-js\`, so they skip those two lines. Any other name stands for your own code or data, and the text around the example says what it is. Names from the subpath entries, such as \`@promptctl/rich-js/widgets\`, are always imported explicitly. **Try it**, beside an example's output, opens the example in the [playground](./playground) as a program of its own, with those lines and anything it uses from the examples above it written in. Most examples can also be edited where they stand: click into the code, and the output under it is redrawn from your edit as you type, and **Try it** opens your edit rather than the page's; **reset** puts the page's code back. What the example runs on, the lines **Try it** writes in, waits above the code as one strip, "▸ N lines of setup": click it to see them, labelled with where each came from and locked, so an edit changes only the example. The playground opens with them in view, still locked, and keeps your edit in its address, so a reload or a shared link opens it again.

## What comes next

Continue with [Console](./console) to learn the complete output API, or jump to [Styles](./style) to learn how colors and text attributes work.
` },
    "padding.md": { kind: "file", mtime: new Date("2026-09-30T15:54:23.972Z"), content: `# Padding

\`Padding\` adds whitespace around any renderable or string.

## Basic usage

Pass a renderable or a markup string and a single value to apply equal padding on all four sides. The background colour is only there to make the padding visible — [Style and expansion](#style-and-expansion) below covers it:

\`\`\`typescript
import { Console, Padding } from "@promptctl/rich-js";

const console = new Console();

console.print(new Padding("[bold]Hello![/bold]", 1, { style: "white on dark_blue" }));
\`\`\`

## Granular padding

Follows CSS padding conventions:

\`\`\`typescript
const hello = "[bold]Hello![/bold]";
const shown = { style: "white on dark_blue" };

// Single value — all sides
console.print(new Padding(hello, 1, shown));

// 2-tuple — [top/bottom, left/right]
console.print(new Padding(hello, [1, 4], shown));

// 4-tuple — [top, right, bottom, left]
console.print(new Padding(hello, [1, 4, 2, 8], shown));
\`\`\`

## Style and expansion

\`style\` is the ground the whole padded block is drawn on, the content as well as the padding around it:

\`\`\`typescript
console.print(new Padding("[bold]Important[/bold]", [1, 4], { style: "white on dark_red" }));
\`\`\`

Prevent the padding from stretching to the terminal width:

\`\`\`typescript
console.print(new Padding("Tight fit", 1, { style: "white on dark_green", expand: false }));
\`\`\`

## Usage in other renderables

\`Padding\` can be placed anywhere a renderable is accepted — for example, as a table cell for visual emphasis:

\`\`\`typescript
const table = new Table({ title: "Team" });
table.addColumn("Status");
table.addColumn("Name");

table.addRow(
  new Padding("[bold spring_green3]Active[/bold spring_green3]", [0, 2]),
  "Alice",
);
table.addRow("[dark_orange]Away[/dark_orange]", "Bob");

console.print(table);
\`\`\`
` },
    "tree.md": { kind: "file", mtime: new Date("2026-09-30T19:32:15.593Z"), content: `# Tree

\`Tree\` renders a hierarchy with Unicode guide lines. Use it for file systems, dependency graphs, or any nested structure.

## Basic usage

Construct a tree with a root label. Add branches with \`add()\`. \`add()\` returns a new \`Tree\` — chain it to build depth:

\`\`\`typescript
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
\`\`\`

## Labels

Labels can be plain strings (markup is supported), \`RichText\` objects, or **any renderable** — panels, tables, grids:

\`\`\`typescript
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
\`\`\`

This is the key power — any renderable can be a node label, not just strings.

## Styles

Give a node a \`style\` and its label is drawn in it, along with every label beneath it. A deeper node's style refines its ancestors' rather than replacing them, and markup in a label still wins over the style it inherits:

\`\`\`typescript
const tree = new Tree("[bold]Root[/bold]", { style: "italic" });
const branch = tree.add("Branch", { style: "deep_sky_blue3" });
branch.add("Leaf");
branch.add("[spring_green3]Healthy leaf[/spring_green3]");
tree.add("Sibling", { style: "on grey23" });

console.print(tree);
\`\`\`

A style's background reaches under the node's guide lines too, so the row is filled from its first guide to the end of its label.

## Guide style

Style the guide lines independently of the labels with \`guide_style\`:

\`\`\`typescript
const tree = new Tree("[bold]Root[/bold]", { guide_style: "bold dodger_blue1" });
tree.add("[deep_sky_blue3]Branch one[/deep_sky_blue3]");
tree.add("[deep_sky_blue3]Branch two[/deep_sky_blue3]");
tree.add("[spring_green3]Leaf[/spring_green3]");

console.print(tree);
\`\`\`

Two attributes of a guide style choose the lines rather than styling them: \`bold\` draws heavy guides (\`┣━━\`) and \`underline2\` draws double ones (\`╠══\`), and the guides themselves are drawn without either. Like the rest of the guide style, the weight a node sets reaches every guide beneath it.
` },
    "group.md": { kind: "file", mtime: new Date("2026-10-03T10:05:52.340Z"), content: `# Render Groups

Many renderables — \`Panel\`, \`Layout\`, and others — accept only a **single** renderable as their content. \`Group\` solves this: it combines multiple renderables into one unit.

## Several renderables in one Panel

\`\`\`typescript
import { Console, Group, Panel, RichText } from "@promptctl/rich-js";

const console = new Console();
const first = new RichText("First line", { style: "bold orchid" });
const second = new RichText("Second line", { style: "italic deep_sky_blue3" });

console.print(new Panel(new Group(first, second), { borderStyle: "spring_green3" }));
\`\`\`

\`new Panel(first, second)\` does not do this: \`Panel\`'s second parameter is its options object, not more content.

## Group items must be renderables

The constructor is variadic and takes \`Renderable\` values only. Unlike \`Panel\`, \`Group\` will not accept a bare string — pass markup through \`renderMarkup\`, which parses it into a \`RichText\`:

\`\`\`typescript
import { Console, Group, Panel, renderMarkup } from "@promptctl/rich-js";

const console = new Console();

console.print(
  new Panel(
    new Group(
      renderMarkup("[bold dodger_blue1]Section Heading[/bold dodger_blue1]"),
      renderMarkup("[dim]───────────────────────[/dim]"),
      renderMarkup("Main body content goes here."),
      renderMarkup("[dim]Footer note.[/dim]"),
    ),
    { title: "My Panel", borderStyle: "orchid" }
  )
);
\`\`\`

A group emits its children's segments back to back and inserts nothing between them, so each child has to end its own line. \`Panel\`, \`Rule\`, \`Table\`, [\`Strip\`](./strip), and \`FlexStrip\` already do and stack without help. A \`RichText\` — and \`renderMarkup\`'s result, which is one — does it too, through its \`end\` option: every \`RichText\` draws a trailing \`end\` (default \`"\\n"\`) itself, regardless of what its own text contains. That's why none of the calls above put a \`\\n\` inside the markup: the text is the content, \`end\` is the line break, and writing both stacks two newlines into one row. Drop \`end\` to \`""\` — as [\`Strip\`](./strip) does for its own cells — for a \`RichText\` that should *not* end its own line, such as one meant to run straight into whatever the group renders next.

Some renderables are line fragments instead, drawn to sit inside a line something else owns — a \`ProgressBar\` or an \`Emoji\`, for example. As in Rich, a group runs whatever follows one of them onto its line, and so does a group whose last child is one.

## Building a group from a generator

For a dynamic or large set of items, yield them from a generator and spread the result into the constructor:

\`\`\`typescript
import { Console, Group, Panel, renderMarkup } from "@promptctl/rich-js";

const console = new Console();

function* buildContent(items: string[]) {
  yield renderMarkup("[bold dodger_blue1]Results[/bold dodger_blue1]");
  yield renderMarkup("[dim]─────────[/dim]");
  for (const item of items) {
    yield renderMarkup(\`[spring_green3]•[/spring_green3] \${item}\`);
  }
  yield renderMarkup(\`[dim]Total: \${items.length}[/dim]\`);
}

console.print(
  new Panel(
    new Group(...buildContent(["alpha", "beta", "gamma"])),
    { title: "Report", borderStyle: "deep_sky_blue3" }
  )
);
\`\`\`

The spread is the part to get right. \`new Group(buildContent(items))\` passes the generator object itself, and the compiler rejects it with \`error TS2345: Argument of type 'Generator<RichText, void, unknown>' is not assignable to parameter of type 'Renderable'\` — a generator has no \`render\` method, and \`Group\` takes renderables, not an iterable of them.
` },
    "panel.md": { kind: "file", mtime: new Date("2026-10-03T08:23:17.509Z"), content: `# Panel

\`Panel\` draws a Unicode border around any content.

## Basic usage

Pass a string (markup supported) to the constructor and print it:

\`\`\`typescript
import { Console, Panel } from "@promptctl/rich-js";

const console = new Console();

console.print(new Panel("[bold orchid]Hello[/bold orchid], [italic dodger_blue1]World[/italic dodger_blue1]!"));
\`\`\`

Any renderable works as panel content — tables, trees, other panels, styled text, etc.

## Sizing

By default a Panel expands to the full terminal width. Use \`expand: false\` to shrink it to fit the content:

\`\`\`typescript
console.print(new Panel("[spring_green3]Short content[/spring_green3]", { expand: false }));
\`\`\`

The \`Panel.fit()\` alternative constructor is equivalent:

\`\`\`typescript
console.print(Panel.fit("[spring_green3]Short content[/spring_green3]"));
\`\`\`

A \`width\` caps the panel: it fills that width when it expands and fits its content inside it when it does not. A title widens the panel to hold the title whole, even past \`width\`, up to the width the panel is given:

\`\`\`typescript
console.print(Panel.fit("hi", { title: "[bold orchid]a long title[/bold orchid]" }));
\`\`\`

### Narrow widths

A Panel never emits a line wider than the width it is given, however narrow that
gets — a one-column terminal, or a \`Layout\` split that squeezes the panel below
its natural size. It gives up its cells in a fixed order: the two frame columns
first, then a cell of content, then the padding, and only then does content grow
again. So content stays visible down to width 3, and the padding is what
disappears on the way there. Here the four widths sit side by side in [\`Columns\`](./columns):

\`\`\`typescript
const narrow = [3, 4, 5, 6].map((width) =>
  new Panel("[bold dark_orange]hello[/bold dark_orange]", { width, borderStyle: "deep_sky_blue3" }),
);
console.print(new Columns(narrow));
\`\`\`

Width 3 is the narrowest panel that can show anything: at width 2 the two frame
columns are the whole panel, and at width 1 only the left one fits, so the panel
renders as a bare frame with no content rows.

Content that renders wider than the space it was given is cropped to the frame
rather than allowed to burst it — a \`Table\` at its natural width inside a
too-narrow panel loses its right-hand columns instead of soft-wrapping and
destroying the frame.

## Title and subtitle

Add text to the top or bottom border:

\`\`\`typescript
console.print(new Panel(
  "Panel content here",
  {
    title:    "[bold orchid]My Panel[/bold orchid]",
    subtitle: "[dim italic]footer text[/dim italic]",
  }
));
\`\`\`

Both \`title\` and \`subtitle\` support markup. A newline in either reads as a space, so the border stays one row. A label too long for its border is cut, and marked with \`…\` only when it is a \`RichText\` whose \`overflow\` is \`"ellipsis"\`.

## Border style

Change the box-drawing characters by passing a box constant:

\`\`\`typescript
import { ROUNDED, HEAVY, DOUBLE } from "@promptctl/rich-js";

console.print(new Panel("[dodger_blue1]ROUNDED[/dodger_blue1]", { box: ROUNDED, expand: false }));  // ╭──╮
console.print(new Panel("[orchid]HEAVY[/orchid]",           { box: HEAVY,   expand: false }));  // ┏━━┓
console.print(new Panel("[dark_orange]DOUBLE[/dark_orange]",  { box: DOUBLE,  expand: false }));  // ╔══╗
\`\`\`

See [Appendix: Box Styles](./tables#border-styles) for the full list.

## Padding

Add whitespace between the border and the content:

\`\`\`typescript
console.print(new Panel("[spring_green3]Content[/spring_green3]", { padding: 1, expand: false }));      // 1 on all sides
console.print(new Panel("[spring_green3]Content[/spring_green3]", { padding: [1, 2], expand: false })); // top/bottom=1, left/right=2
\`\`\`

## Border colour

\`borderStyle\` colours the frame. The title and subtitle are drawn in it too, with \`titleStyle\` or \`subtitleStyle\` laid over it where given:

\`\`\`typescript
console.print(new Panel("Disk usage is above [bold]90%[/bold]", {
  title:       "⚠ Alert",
  subtitle:    "/dev/sda1",
  borderStyle: "bold red1",
  titleStyle:  "bold dark_orange",
  expand:      false,
}));
\`\`\`

## Style

\`style\` is the ground the whole panel is drawn on: the frame, the padding and the content all sit on it. \`borderStyle\` and the content's own markup are laid over it, so here the frame is \`bold red1\` and the text is white, both on dark blue:

\`\`\`typescript
console.print(new Panel("Disk usage is above [bold]90%[/bold]", {
  title:       "⚠ Alert",
  style:       "white on dark_blue",
  borderStyle: "bold red1",
  padding:     1,
  expand:      false,
}));
\`\`\`
` },
    "columns.md": { kind: "file", mtime: new Date("2026-09-29T23:47:54.113Z"), content: `---
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

\`Columns\` takes a list of renderables and arranges them in as many columns as fit in the terminal width.

## Basic usage

A common use case is laying out a directory listing — the same way \`ls\` does. Here \`entries\` is what \`readdirSync(".", { withFileTypes: true })\` returns, and directories are coloured the way \`ls --color\` colours them:

\`\`\`typescript
import { Console, Columns } from "@promptctl/rich-js";

const console = new Console();

const files = entries.map((entry) =>
  entry.isDirectory() ? \`[bold dodger_blue1]\${entry.name}/[/]\` : entry.name,
);
console.print(new Columns(files));
\`\`\`

Each string is markup, the same as a string passed to \`console.print\`.

## Options

| Option | Description |
|---|---|
| \`width\` | Fixed width for every column, fitting as many columns as that width allows and never more columns than items. Offered less than one column, the column renders at the offer — a declared width never makes a line wider than the space given |
| \`equal\` | Choose the number of columns as if every item were as wide as the widest one. Each column is still only as wide as its own items |
| \`expand\` | Stretch the columns to fill the width offered, wider columns taking more of the extra space. Without it, a \`Columns\` is only as wide as its columns and the gaps between them |
| \`columnFirst\` | Fill columns top-to-bottom before left-to-right (like \`ls\`) |
| \`padding\` | Space around each item, in the same shapes as \`Padding\` takes; the default is \`[0, 1]\`. Columns stand as far apart as the wider of the left and right sides. Rows stand \`top + max(0, top - bottom)\` lines apart — Rich's arithmetic, so a bottom-only padding separates nothing |

Each column is as wide as the widest item in it, so a listing of mostly short names with one long one keeps the short columns narrow. The items are laid out in a \`Table.grid\` with \`collapsePadding\` on and \`padEdge\` off, as Rich lays them out, so everything after the choice of how many columns — widths, gaps, \`expand\`, the space between rows — is the grid's. Every option above follows Python Rich's \`Columns\` byte for byte, with two exceptions:

- A declared \`width\` chooses how many columns to use in the same way as the automatic layout, so it can choose a different number of columns than Rich. Rich divides the offer by the width: it fills the offer with empty columns when there are fewer items than columns, and fails outright when the width is wider than the offer.
- A \`Columns\` measures as wide as its columns and the gaps between them. Rich's \`Columns\` does not measure itself, so inside a fitted \`Panel\` it takes the whole width offered.

The same listing several ways: \`columnFirst\` reads down each column before moving right, the order \`ls\` uses; a declared \`width\` of 22 cells leaves room for three columns instead of four; \`padding\` of four cells on each side spreads the columns further apart; and \`expand\` stretches them to the edge of the terminal:

\`\`\`typescript
console.rule("columnFirst: true");
console.print(new Columns(files, { columnFirst: true }));

console.rule("width: 22");
console.print(new Columns(files, { width: 22 }));

console.rule("padding: [0, 4]");
console.print(new Columns(files, { padding: [0, 4] }));

console.rule("expand: true");
console.print(new Columns(files, { expand: true }));
\`\`\`

## Content

Columns can contain any renderable, not just strings — \`Panel\`, \`Table\`, \`Tree\`, etc.:

\`\`\`typescript
import { Panel } from "@promptctl/rich-js";

const cards = items.map((item) =>
  new Panel(\`[italic]\${item.description}[/]\`, {
    title: item.name,
    titleStyle: "bold orchid",
    borderStyle: "deep_sky_blue3",
    expand: false,
  })
);

console.print(new Columns(cards));
\`\`\`
` },
    ".vitepress": { kind: "directory", children: {
      "sidebar.ts": { kind: "file", mtime: new Date("2026-10-12T12:13:55.237Z"), content: `/*
 * The sidebar regions that are backed by a \`docs/*.md\` file.
 *
 * These live apart from \`config.ts\` because two readers need them and only one
 * of them can afford that file. \`config.ts\` loads the docs build at module
 * load — the example pipeline, and the demo list read off \`examples/\` — none of
 * which the unit suite should pay to import. The regions themselves are data
 * and read nothing, so the reachability gate can import them directly.
 * [LAW:effects-at-boundaries] The reads stay in \`config.ts\`; what is merely
 * data moves to where both callers can reach it.
 *
 * [LAW:one-source-of-truth] This is the site's only list of guide pages.
 * \`config.ts\` composes these regions into the sidebar and derives the Guide
 * nav's \`activeMatch\` from \`guideSidebar\`; \`test/docs/page-reachability.test.ts\`
 * asserts they name exactly the pages on disk. Nothing re-states the list.
 *
 * The Demos region is deliberately not here. It is derived from \`examples/\`
 * (\`demoNames\`, demo-entry.ts) and its links are dynamic routes rather than \`docs/*.md\` files, so
 * keeping it in \`config.ts\` leaves this side of the reachability comparison
 * with nothing to exclude: every region below names pages that exist on disk.
 * The disk side turns the same tab away by name — \`NOT_PAGES\` in
 * \`test/docs/pages.ts\`, with its reason attached — because a recursive scan
 * finds \`docs/demos/\` whether or not this file mentions it.
 */

export interface SidebarItem {
  readonly text: string
  readonly link: string
}

export interface SidebarGroup {
  readonly text: string
  // Mutable, because VitePress's own \`DefaultTheme.SidebarItem\` declares it
  // that way and \`config.ts\` spreads these groups straight into the theme
  // config. A \`readonly\` array here would be a shape VitePress cannot accept.
  readonly items: SidebarItem[]
}

export const guideSidebar: SidebarGroup[] = [
  {
    text: 'Getting Started',
    items: [
      { text: 'Introduction', link: '/introduction' },
      { text: 'Console', link: '/console' },
      { text: 'Styles', link: '/style' },
      { text: 'Markup', link: '/markup' },
      { text: 'Markup Plugin Tags', link: '/markup-tags' },
    ],
  },
  {
    text: 'Text & Data',
    items: [
      { text: 'Rich Text', link: '/text' },
      { text: 'Highlighting', link: '/highlighting' },
      { text: 'Pretty Printing', link: '/pretty' },
    ],
  },
  {
    text: 'Renderables',
    items: [
      { text: 'Panel', link: '/panel' },
      { text: 'Tables', link: '/tables' },
      { text: 'Tree', link: '/tree' },
      { text: 'Columns', link: '/columns' },
      { text: 'Strip + Joiner', link: '/strip' },
      { text: 'Group', link: '/group' },
      { text: 'Padding', link: '/padding' },
      { text: 'Viewport', link: '/viewport' },
    ],
  },
  {
    text: 'Live & Animation',
    items: [
      { text: 'Progress Bars', link: '/progress' },
      { text: 'Live Display', link: '/live' },
      { text: 'Easing & Phases', link: '/easing' },
      { text: 'Effects', link: '/effects' },
      { text: 'Effects Playground', link: '/effects-playground' },
      { text: 'Layout', link: '/layout' },
    ],
  },
  {
    text: 'Interactive',
    items: [
      { text: 'Terminal Apps', link: '/app' },
      { text: 'Widgets', link: '/widgets' },
    ],
  },
  {
    text: 'Color & Theming',
    items: [
      { text: 'Theme Transposition', link: '/transpose' },
      { text: 'Contrast & Accessibility', link: '/contrast' },
    ],
  },
  {
    text: 'Source & Files',
    items: [
      { text: 'Syntax Highlighting', link: '/syntax' },
      { text: 'Markdown', link: '/markdown' },
      { text: 'Tracebacks', link: '/traceback' },
    ],
  },
  {
    text: 'Integrations',
    items: [
      { text: 'Template Bindings', link: '/template-bindings' },
      { text: 'Prompts', link: '/prompt' },
    ],
  },
]

// Protocol is its own nav tab, not a Guide page, so it sits outside
// \`guideSidebar\` and stays out of the derived \`activeMatch\` pattern. Folding it
// in would light up both tabs at once on \`/protocol\`.
export const advancedSidebar: SidebarGroup[] = [
  {
    text: 'Advanced',
    items: [{ text: 'Renderable Protocol', link: '/protocol' }],
  },
]

// The Playground is its own nav tab too, and the same argument keeps it out
// of \`guideSidebar\`. Its page runs full width, without the sidebar; this entry
// is what reaches it from every other page.
export const playgroundSidebar: SidebarGroup[] = [
  {
    text: 'Experiment',
    items: [{ text: 'Playground', link: '/playground' }],
  },
]

/** Every page-backed sidebar region, in the order the sidebar shows them. */
export const pageSidebarRegions: readonly SidebarGroup[] = [
  ...guideSidebar,
  ...advancedSidebar,
  ...playgroundSidebar,
]
` },
      "theme": { kind: "directory", children: {
        "index.ts": { kind: "file", mtime: new Date("2026-10-08T20:44:57.507Z"), content: `/// <reference types="vite/client" />
import DefaultTheme from 'vitepress/theme'
import { inBrowser, type Theme } from 'vitepress'
import { defineAsyncComponent, h } from 'vue'
import './code-font.css'
import './custom.css'
import { trackDevicePixelRatio } from './device-pixel-ratio.js'
import RichExample, { RichDemo, RichPlayground } from './RichExample.js'

const RichShowcase = defineAsyncComponent(() => import('./RichShowcase.js'))

export default {
  extends: DefaultTheme,
  // The landing page's hero shows rich-js running, under its text and buttons.
  // \`home-hero-after\` is filled only by the home layout, so no other page draws it.
  Layout: () => h(DefaultTheme.Layout, null, { 'home-hero-after': () => h(RichShowcase) }),
  enhanceApp({ app }) {
    if (inBrowser) trackDevicePixelRatio(document.documentElement)
    // Not async: nearly every page has one, and it is the page's own card
    // until a reader edits it. What editing needs it loads itself. The
    // playground and a demo's page are the same card, so they come with it.
    app.component('RichExample', RichExample)
    app.component('RichPlayground', RichPlayground)
    app.component('RichDemo', RichDemo)
  },
} satisfies Theme
` },
        "xterm.ts": { kind: "file", mtime: new Date("2026-10-12T12:13:55.238Z"), content: `/**
 * The one xterm.js the site loads: its version, and the integrity hash of each
 * file taken from jsDelivr. The live terminal (live-terminal.ts) loads it from
 * here, and the landing e2e spec checks the page against it.
 *
 * [LAW:one-source-of-truth] A version bump is this file.
 */
export const XTERM = {
  script: {
    src: "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/lib/xterm.js",
    integrity: "sha384-f/1U6Z9wM4D71a5eRXEZnyOTMOvjqxr2XLwh+Go1OvIl3L3tOcvUrzudnhbECwl4",
  },
  stylesheet: {
    href: "https://cdn.jsdelivr.net/npm/@xterm/xterm@6.0.0/css/xterm.css",
    integrity: "sha384-n2n7twoohnW+d3myBKaUgl7DSiwidw6MkQy9oesGzkPpMjejKRR3XlnD+5yCdtBD",
  },
} as const;
` },
        "device-pixel-ratio.ts": { kind: "file", mtime: new Date("2026-10-03T09:16:42.768Z"), content: `/**
 * \`--rich-device-pixel-ratio\` on \`root\`: \`devicePixelRatio\`, kept current as
 * the page zooms or moves to a screen of another density.
 *
 * custom.css rounds the line height static and live output share up to whole
 * device pixels with it, because xterm makes a row a whole number of device
 * pixels: its DOM renderer takes the ceiling of the measured character height
 * times \`devicePixelRatio\`. The ratio is passed, not one device pixel, so the
 * CSS does that same multiplication and lands where xterm's floats land.
 */
export function trackDevicePixelRatio(root: HTMLElement): void {
  const ratio = devicePixelRatio;
  root.style.setProperty("--rich-device-pixel-ratio", String(ratio));
  matchMedia(\`(resolution: \${ratio}dppx)\`).addEventListener("change", () => trackDevicePixelRatio(root), { once: true });
}
` },
        "CardSliders.ts": { kind: "file", mtime: new Date("2026-10-08T21:58:07.100Z"), content: `/// <reference lib="dom" />
/**
 * A card's sliders (theme/RichExample.ts): one over each value in the code of
 * the file on screen that tunables.ts finds, a number by a slider and a box,
 * an ease by a list of every curve the library names.
 *
 * [LAW:one-source-of-truth] It holds nothing. What each control shows is read
 * off \`source\`, the file's code as it stands, and moving one hands \`write\` the
 * edit of that literal, which the card makes in its editor like any other: the
 * output follows as it follows typing, and reset puts the sliders back with
 * the code. A slider spans what its value's range is in the code the card
 * opened (\`opened\`), so dragging it does not move its own ends. A box is left
 * alone while it has focus, so a number half typed is not put back under the
 * reader by a render, and an entry that is no number is put back, not written.
 */
import { defineComponent, h, type PropType, type VNode } from "vue";
import { EASES } from "../../../src/core/easing.js";
import { range, spelled, tunables, type Tunable } from "../tunables.js";

/** Every curve an ease control offers, by the name \`EASES\` gives it. */
const EASE_NAMES = Object.keys(EASES);

export default defineComponent({
  name: "CardSliders",
  props: {
    source: { type: String, required: true },
    opened: { type: String, required: true },
    /** Make the edit putting \`spelling\` over the literal at \`from\`–\`to\` in \`source\`. */
    write: { type: Function as PropType<(from: number, to: number, spelling: string) => void>, required: true },
  },
  setup(props) {
    // The code the card opened never changes under a card's sliders: each file has its own.
    const spanned = new Map(tunables(props.opened).map((t) => [t.name, t.value]));

    const control = (t: Tunable) => {
      const label = h("span", { class: "rich-sliders-name", title: t.name }, t.name);
      const set = (spelling: string) => props.write(t.from, t.to, spelling);
      if (t.kind === "ease") {
        return h("label", { class: "rich-sliders-control", key: t.name }, [
          label,
          h(
            "select",
            { value: t.value, onChange: (event: Event) => set((event.target as HTMLSelectElement).value) },
            EASE_NAMES.map((name) => h("option", { value: name }, name)),
          ),
        ]);
      }
      const from = spanned.get(t.name);
      const { min, max, step } = range(typeof from === "number" ? from : t.value);
      const shown = String(t.value);
      const number = (event: Event) => {
        const input = event.target as HTMLInputElement;
        // [LAW:parse-dont-validate] An empty or unreadable box reads as NaN, and the literal is left as it is.
        if (Number.isNaN(input.valueAsNumber)) input.value = shown;
        else set(spelled(input.valueAsNumber));
      };
      // The box has no \`value\` prop: Vue would put it back on every render, typing or not.
      const show = (vnode: VNode) => {
        const box = vnode.el as HTMLInputElement;
        if (box !== document.activeElement) box.value = shown;
      };
      return h("label", { class: "rich-sliders-control", key: t.name }, [
        label,
        h("input", { type: "range", min, max, step, value: t.value, "aria-label": t.name, onInput: number }),
        h("input", { type: "number", step, "aria-label": \`\${t.name}, typed\`, onChange: number, onVnodeMounted: show, onVnodeUpdated: show }),
      ]);
    };

    return () => h("div", { class: "rich-sliders", role: "group", "aria-label": "Values in the code" }, tunables(props.source).map(control));
  },
});
` },
        "live-runtime.d.ts": { kind: "file", mtime: new Date("2026-10-08T20:44:57.508Z"), content: `/**
 * The live terminal's worker script, served by the docs-examples plugin as
 * \`LIVE_RUNTIME_MODULE\` (example-runner.ts), which owns what it is.
 */
declare module "virtual:rich-live/runtime" {
  const runtime: string;
  export default runtime;
}

/**
 * The live library's script: served by the docs-examples plugin as
 * \`LIBRARY_MODULE\` (example-runner.ts), which owns what it is.
 */
declare module "virtual:rich-live/library" {
  const library: string;
  export default library;
}

/**
 * The program the playground opens on with no link: served by the
 * docs-examples plugin as \`PLAYGROUND_MODULE\` (example-runner.ts), which owns
 * what it is.
 */
declare module "virtual:rich-live/playground" {
  export const start: string;
}

/**
 * The landing page's showcase, a live program: served by the docs-examples
 * plugin as \`SHOWCASE_MODULE\` (example-runner.ts), which owns what it is.
 */
declare module "virtual:rich-live/showcase" {
  const program: string;
  export default program;
}
` },
        "sucrase-parser.d.ts": { kind: "file", mtime: new Date("2026-10-08T22:50:13.920Z"), content: `/**
 * Sucrase's parser, which its package publishes no types for at the path its
 * code is at: the declarations it ships for that file, under that path.
 */
declare module "sucrase/dist/parser/index.js" {
  export { parse } from "sucrase/dist/types/parser/index.js";
}
` },
      } },
    } },
  } },
  "node_modules": { kind: "directory", children: {
    "playwright-core": { kind: "directory", children: {
      "lib": { kind: "directory", children: {
        "server": { kind: "directory", children: {
          "chromium": { kind: "directory", children: {
            "appIcon.png": { kind: "file", mtime: new Date("2026-09-29T22:49:38.096Z"), content: latin1("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") },
          } },
        } },
      } },
    } },
  } },
} };
