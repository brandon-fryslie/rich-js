# Console

`Console` is the central output object. Every other feature in rich-js passes through it.

## Construction and sharing

Most applications need one `Console` instance. Create it once and import it wherever you need output:

```typescript
// shared/console.ts
import { Console } from "rich-js";

export const console = new Console();
```

`Console` auto-detects terminal capabilities on construction. No configuration is required to get started.

## Auto-detected attributes

After construction, `Console` exposes information about the terminal:

| Property | Description |
|---|---|
| `console.width` | Terminal columns (live terminal size) |
| `console.height` | Terminal rows (live terminal size) |
| `console.encoding` | Output encoding (e.g. `"utf-8"`) |
| `console.isTerminal` | `true` when writing to a real TTY |
| `console.colorSystem` | Detected color system name |

`width` and `height` reflect the current terminal size — if the user resizes the window they update automatically.

## Color systems

rich-js supports five color systems:

| System | Colors | Notes |
|---|---|---|
| `null` | 0 | No color output |
| `"standard"` | 16 | 8 colors + bright variants |
| `"256"` | 256 | Standard + 240-color palette |
| `"truecolor"` | 16.7 million | Full RGB |
| `"windows"` | 8 | Legacy Windows console |

Auto-detection picks the best system your terminal supports. Setting a higher system than the terminal supports can produce unreadable output. When you specify a lower color system, colors are automatically downgraded to the nearest available equivalent.

## Printing

`print()` is the primary output method:

```typescript
// Plain string with markup
console.print("[bold]Hello[/bold], [cyan]World![/cyan]");

// Any value — rendered as pretty-printed output
console.print({ status: 200, ok: true });

// Multiple values — joined with a space
console.print("x =", 42, "y =", 99);

// Any Renderable object
console.print(new Table());
```

Output is word-wrapped to the terminal width by default.

### Style argument

Apply a style to the entire print call:

```typescript
console.print("Something went wrong", { style: "bold red" });
```

### Markup in strings

Inline markup styles individual spans. See [Markup](./markup) for syntax:

```typescript
console.print("[bold]Name:[/bold] [cyan]Alice[/cyan] — [green]active[/green]");
```

### Justify

Control text alignment with the `justify` option:

```typescript
console.print("Hello!", { justify: "right" });
```

| Mode | Behavior |
|---|---|
| `"default"` | Left-aligned, no trailing spaces |
| `"left"` | Left-aligned, padded to full width with trailing spaces |
| `"center"` | Centered |
| `"right"` | Right-aligned |
| `"full"` | Justified (spaces between words stretch to fill the line) |

::: tip `"default"` vs `"left"`
When a background color is set, `"left"` fills the line to the edge with the background color. `"default"` stops at the last character. For most uses without backgrounds they look identical.
:::

### Overflow

Control what happens when a line of text is too wide:

```typescript
const long = "This is a very long string that exceeds the available width";
console.print(long, { overflow: "fold" });     // wrap to next line (default)
console.print(long, { overflow: "crop" });     // truncate at edge
console.print(long, { overflow: "ellipsis" }); // truncate with …
console.print(long, { overflow: "ignore" });   // allow overflow
```

### Soft wrapping

`softWrap: true` disables word-wrapping, mirroring the behavior of the built-in `console.log`. Cropping is also disabled automatically:

```typescript
console.print("A very long line...", { softWrap: true });
```

### Cropping

`crop` controls whether output is truncated to the terminal width. Default is `true`. Disabled automatically when `softWrap` is set:

```typescript
console.print("No cropping", { crop: false });
```

## Logging

`log()` adds a timestamp column on the left and a file/line location column on the right:

```typescript
console.log("Server started on port 3000");
console.log({ userId: 42, action: "login" });
```

The `logLocals` option prints a table of local variable values alongside the log entry — useful for debugging:

```typescript
console.log("Checkpoint", { logLocals: true });
```

## JSON output

Pretty-print a JSON string with syntax highlighting:

```typescript
console.printJson('{"name": "Alice", "scores": [98, 87, 95]}');

// Or pass an object directly
console.printJson({ name: "Alice", scores: [98, 87, 95] });
```

## Low-level output

`out()` is a lower-level method: it converts values to strings without pretty-printing, word-wrap, or markup, but can apply a style and optionally highlight:

```typescript
console.out("raw output", { style: "dim", highlight: true });
```

## Rules

Draw a horizontal dividing line, optionally with a title:

```typescript
console.rule("[bold]Section One[/bold]");
console.rule(undefined, { style: "blue", align: "left" });
```

## Status

Display a spinner animation with a message while work is in progress:

```typescript
const status = console.status("[bold green]Processing...");
status.start();

await doWork();

status.stop();
```

The status display does not interfere with other output. Pass `spinner: "dots"` or any named spinner to change the animation.

## Console style

A base style applied to all output from this console:

```typescript
const console = new Console({ style: "on dark_blue" });
```

## Input

Read a line from the user with a styled prompt:

```typescript
const name = await console.input("[bold cyan]What is your name?[/bold cyan] ");
```

The prompt supports markup and emoji.

## Exporting

Record all output for later export with `record: true`:

```typescript
const console = new Console({ record: true });

console.print("[bold]Hello![/bold]");
console.print(table);

const text = console.exportText();       // plain text
const html = console.exportHtml();       // HTML with inline styles
const svg  = console.exportSvg();        // SVG image

console.saveText("output.txt");
console.saveHtml("output.html");
console.saveSvg("output.svg");           // width = terminal width; height scales to content
```

For SVG, pass `{ clear: true }` to flush the buffer after export. The SVG theme can be customized via the `theme` option.

## Error / stderr output

Write to stderr with `stderr: true`:

```typescript
const errConsole = new Console({ stderr: true, style: "red" });

errConsole.print("[bold]Error:[/bold] something failed");
```

## File output

Write to any writable stream:

```typescript
import { createWriteStream } from "fs";

const log = new Console({
  file: createWriteStream("app.log"),
  width: 120, // explicitly set width when writing to files
});
```

## Capturing output

Two patterns for capturing what would have been printed:

```typescript
// Pattern 1: capture context
const { capture, console } = Console.capture();
console.print("[bold]captured[/bold]");
const output = capture.get();

// Pattern 2: string buffer (recommended for tests)
import { Writable } from "stream";
const buf: string[] = [];
const console = new Console({
  file: new Writable({ write(chunk, _enc, cb) { buf.push(chunk.toString()); cb(); } }),
});
```

## Paging

Send long output to the system pager (`$PAGER` / `$MANPAGER`):

```typescript
await console.pager(async (pagerConsole) => {
  pagerConsole.print(veryLongContent);
});

// Preserve styles if the pager supports them (e.g. less -R)
await console.pager(async (c) => { c.print(content); }, { styles: true });
```

Most pagers strip color by default.

## Alternate screen

Enter fullscreen mode with `screen()`:

```typescript
const screen = console.screen();
screen.update(myRenderable);
// ... terminal is in fullscreen
screen.stop();  // terminal restores on exit
```

For more powerful full-screen applications see [Live Display](./live).

## Terminal detection

When output is not going to a terminal (e.g. piped to a file), rich-js strips control codes automatically. Override with:

```typescript
const console = new Console({ forceTerminal: true });    // always emit ANSI codes
const console = new Console({ forceInteractive: true }); // always show animations
```

## Environment variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable all color (text attributes like bold are preserved) |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color and style |
| `COLUMNS` / `LINES` | Override terminal dimensions |

`NO_COLOR` takes precedence over `FORCE_COLOR`.
