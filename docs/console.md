# Console

`Console` is the output object: it detects what the terminal supports, owns the
render loop, and writes the bytes. Most of this library is reached through one.

It is not the only way out, though. [`renderToString`](./protocol) renders any
`Renderable` to a string of ANSI in one shot with no `Console` involved, and
`Prompt` reads input without one. Reach for `Console` when you want terminal
detection, wrapping, recording and a stream to write to — which is nearly
always.

## Construction and sharing

Most applications need one `Console` instance. Create it once and import it wherever you need output:

```typescript
// shared/console.ts
import { Console } from "@promptctl/rich-js";

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
| `console.colorSystem` | Detected color depth — a `ColorDepth`, or `null` for no color |

`width` and `height` reflect the current terminal size — if the user resizes the window they update automatically.

## Color systems

The `colorSystem` option takes one of five spec strings, and `"auto"` is the default:

| Spec | Colors | Notes |
|---|---|---|
| `"auto"` | — | Detect from the environment (default) |
| `"truecolor"` | 16.7 million | Full RGB |
| `"256"` | 256 | 16 standard + a 240-color palette |
| `"ansi"` | 16 | 8 colors + bright variants |
| `"none"` | 0 | No color output |

`null` is accepted too and means the same as `"none"`. An unrecognized string
throws, and the message names those five.

A handful of strings outside the table are nonetheless accepted, because
detection and configuration share one lookup: the `FORCE_COLOR` values
(`"0"`–`"3"`, `"true"`, `"false"`) and the terminal identifiers detection knows
(`"vscode"`, `"iTerm.app"`, `"xterm-kitty"`, `"alacritty"`, and others) all
resolve to a depth rather than throwing. `{ colorSystem: "vscode" }` quietly
means truecolor. Treat those as an artifact of the shared table rather than
supported spellings — use the five above.

One depth has no spec string. The legacy 16-color Windows console palette is a
detection result rather than something you ask for, so you reach it through the
enum:

```typescript
import { Console, ColorDepth } from "@promptctl/rich-js";

const console = new Console({ colorSystem: ColorDepth.WINDOWS });
```

Auto-detection picks the best system your terminal supports. Setting a higher system than the terminal supports can produce unreadable output. When you specify a lower color system, colors are automatically downgraded to the nearest available equivalent.

## Printing

`print()` is the primary output method:

```typescript
import { Table } from "@promptctl/rich-js";

// Plain string with markup
console.print("[bold]Hello[/bold], [cyan]World![/cyan]");

// Multiple values — joined with a space
console.print("x =", 42, "y =", 99);

// Any Renderable object
console.print(new Table().addColumn("Name").addRow("Alice"));
```

Output is word-wrapped to the terminal width by default.

Anything that is not already a renderable goes through `String()`. That is the
right answer for a number or a `Date` and the wrong-looking one for a plain
object, which stringifies to `[object Object]` — text the markup parser then
reads as a style tag and consumes, leaving a blank line:

```typescript
console.print({ status: 200, ok: true }); // a blank line, not an object
```

To print a value structurally, construct a `Pretty` around it. See
[Pretty printing](./pretty), which covers the formatting options and this
behavior in full.

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
| `"center"` | Padded on both sides to center the line |
| `"right"` | Padded on the left to sit against the right edge |

`PrintOptions` also accepts `"left"` and `"full"`, but neither changes anything
today: `"left"` produces the same bytes as `"default"`, and `"full"` does not
stretch the spaces between words. Alignment applies per line and only where the
text already fits — a string long enough to wrap comes out left-aligned
whichever mode you pass.

### Overflow

Control what happens when a line of text is too wide:

```typescript
const long = "This is a very long string that exceeds the available width";
console.print(long, { overflow: "fold" });     // wrap to next line (default)
console.print(long, { overflow: "crop" });     // truncate at edge
console.print(long, { overflow: "ellipsis" }); // truncate with …
console.print(long, { overflow: "ignore" });   // same as "fold" today
```

`"ignore"` is accepted but is not yet distinct from the default — `print()`
discards it and wraps.

### Soft wrapping

`softWrap: true` turns word-wrapping off, so a long line runs past the terminal
width instead of folding — the behavior of the built-in `console.log`:

```typescript
console.print("A very long line...", { softWrap: true });
```

`PrintOptions` also declares a `crop` flag. Nothing reads it: `print()` accepts
it and wraps exactly as it would have. Use `overflow: "crop"` to truncate at the
edge.

## Logging

`log()` prefixes a timestamp and then prints, so it takes the same arguments as
`print()` and behaves the same way on each of them:

```typescript
console.log("Server started on port 3000");
// [9:14:41 PM]  Server started on port 3000

console.log("user", 42, "signed in");
// [9:14:41 PM]  user 42 signed in
```

That is the whole method: no location column, and no options parameter of its
own. What happens to a trailing object depends on its keys, because `log()`
forwards to `print()` and `print()` decides by sniffing for the nine
`PrintOptions` names — `style`, `justify`, `markup`, `highlight`, `overflow`,
`end`, `softWrap`, `crop`, `sep`.

An object carrying none of them is a value to print, so it hits the
`[object Object]` case above and leaves a bare timestamp:

```typescript
console.log({ userId: 42, action: "login" });
// [9:14:41 PM]
```

The line ends in two spaces you cannot see: one closes the timestamp prefix, and
`print` writes its argument separator before the object whatever that object
turns out to render to.

An object carrying any of them is taken as options instead — and since one of
the nine is `end`, a field name as ordinary as that will mangle the line rather
than print:

```typescript
console.log("range", { end: "2024" });
// [9:14:41 PM]  range2024   ← no newline; "2024" became the line terminator
```

Neither outcome is what a caller passing structured data intends. Format the
value yourself and log the result.

## JSON output

`printJson()` re-formats JSON across multiple lines with a two-space indent. It
accepts either a JSON string, which it parses first, or an object:

```typescript
console.printJson('{"name": "Alice", "scores": [98, 87, 95]}');

// Or pass an object directly
console.printJson({ name: "Alice", scores: [98, 87, 95] });

// Widen the indent
console.printJson({ name: "Alice" }, { indent: 4 });
```

The result is printed as plain text — `printJson` re-indents, it does not
colorize. Passing the same JSON string to `print()` instead gets you the
highlighting, since `print()` runs its highlighter over strings:

```typescript
console.print('{"name": "Alice", "scores": [98, 87, 95]}');
```

## Rules

Draw a horizontal dividing line, optionally with a title:

```typescript
console.rule("Section One");
console.rule(undefined, { style: "blue", align: "left" });
```

The title is plain text. `rule()` does not parse markup in it, so
`"[bold]Section One[/bold]"` draws the brackets rather than emboldening the
words — style the whole rule with the `style` option instead.

## Status

`Status` displays a spinner animation with a message while work is in progress.
It is a separate class, not a `Console` method — pass the console it should draw
on:

```typescript
import { Console, Status } from "@promptctl/rich-js";

const console = new Console();
const status = new Status("Processing...", { console });

status.start();
await doWork();
status.stop();
```

Pass `spinner: "dots"` or any named spinner to change the animation, and
`style` to color the message. Assigning to `status.message` updates the text in
place while the spinner runs.

## Console style

A base style applied to all output from this console:

```typescript
const console = new Console({ style: "on dark_blue" });
```

## Input

`Console` writes; it does not read. Reading a line from the user is the
`Prompt` family's job, and it takes its input capability as an argument so the
main barrel never reaches `node:readline`:

```typescript
import { Prompt } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const name = await Prompt.ask("What is your name?", nodeAsk);
```

See [Prompts](./prompt) for defaults, constrained choices, typed prompts, and
supplying your own input source.

## Exporting

Record all output for later export with `record: true`:

```typescript
import { Console, Table } from "@promptctl/rich-js";

const console = new Console({ record: true });

console.print("[bold]Hello![/bold]");
console.print(new Table().addColumn("Name").addRow("Alice"));

const text = console.exportText();       // plain text
const html = console.exportHtml();       // HTML with inline styles
```

To persist the exported output to disk, use the node-only helpers from the `node/save` subpath:

```typescript
import { saveText, saveHtml } from "@promptctl/rich-js/node/save";

saveText(console, "output.txt");
saveHtml(console, "output.html");
```

These helpers live outside the main barrel so the browser bundle never reaches `node:fs`. The recording buffer is cleared after writing by default; pass `{ clear: false }` to preserve it for a second export (e.g. saving both `.txt` and `.html` from the same recorded run).

## Error / stderr output

Write to stderr with `stderr: true`:

```typescript
const errConsole = new Console({ stderr: true, style: "red" });

errConsole.print("[bold]Error:[/bold] something failed");
```

## File output

Write to any writable stream:

```typescript
import { createWriteStream } from "node:fs";

const log = new Console({
  file: createWriteStream("app.log"),
  width: 120, // explicitly set width when writing to files
});
```

## Capturing output

Two patterns for capturing what would have been printed.

`beginCapture()` redirects an existing console's output; `endCapture()` ends the
redirect and returns everything written in between. This is a redirect and not a
tee — while a capture is active the real target receives nothing:

```typescript
console.beginCapture();
console.print("[bold]captured[/bold]");
const output = console.endCapture(); // "captured\n"
```

Or bind a console to a stream you own, which is usually the better fit for tests
because the buffer outlives any single call:

```typescript
import { Writable } from "node:stream";

const buf: string[] = [];
const testConsole = new Console({
  file: new Writable({ write(chunk, _enc, cb) { buf.push(chunk.toString()); cb(); } }),
});
```

## Alternate screen

`Console` has no fullscreen mode of its own. Entering the alternate screen
buffer and restoring the terminal afterwards is `Live`'s job — see
[Live Display](./live).

## Terminal detection

When output is not going to a terminal (e.g. piped to a file), rich-js strips control codes automatically. Override with:

```typescript
const colored = new Console({ forceTerminal: true });     // always emit ANSI codes
const animated = new Console({ forceInteractive: true }); // always show animations
```

## Environment variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable color |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color |
| `COLUMNS` / `LINES` | Override terminal dimensions |

`NO_COLOR` takes precedence over `FORCE_COLOR`.

Both `NO_COLOR` and `TERM=dumb` drop the console to no color system at all, and
that takes the text attributes with it — `"[bold red]X[/bold red]"` prints as a
bare `X`, with neither the color nor the bold. Neither variable changes
dimensions or wrapping.

## Injecting the environment

By default a `Console` reads those variables, its TTY status, and its dimensions
from the ambient `process`. Pass `environment` to take that from somewhere else —
a fixed map and a pair of streams you control:

```typescript
const output: string[] = [];
const console = new Console({
  environment: {
    env: { FORCE_COLOR: "3" },
    stdout: { isTTY: true, columns: 100, rows: 30, write: (s) => output.push(String(s)) },
  },
});
```

That console reports truecolor at 100×30 and writes into `output`, on any host,
with no ambient `process` involved. Node's own `process` satisfies the same
`ConsoleEnvironment` shape, which is why it is the default and why no adapter is
needed at either end.

The environment supplies both streams, and `stderr: true` binds the console to
`stderr` for all three questions at once — colour, dimensions, and where bytes
go. A console bound to `stderr` therefore wraps at the width of `stderr`, which
matters in the ordinary CLI shape where stdout is piped to a file and stderr is
still an interactive terminal.
