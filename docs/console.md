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

A sixth depth exists with no spec string: the legacy 16-color Windows console
palette. Nothing detects it — `"auto"` never returns it, and there is no
platform check anywhere in the library — so the only way to get it is to name
the enum value:

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

`print` sorts each argument into one of three kinds. A renderable draws itself.
A string is the only kind of argument that can contain markup, so it is the only
kind the markup dialect is applied to. Anything else is data, and is formatted by
[`Pretty`](./pretty):

```typescript
console.print({ status: 200, ok: true });
```

```
{ status: 200, ok: true }
```

That covers arrays, `Map`s, `Set`s, and nested structures. A value that carries
its own string form — a `Date`, an `Error`, a `RegExp`, anything defining
`toString` — keeps it rather than being reflected on. Construct a `Pretty`
yourself only when you want its formatting options; see
[Pretty printing](./pretty) for those.

Data printed this way is truncated by default, because `print` formats whatever
it is handed and a debug line should not cost megabytes. A container shows its
first 100 entries, nesting stops at 16 levels deep, and a string inside the data
is cut at 1000 characters. Every one of those announces itself in the output —
`... +4900`, `{...}`, `+49000` inside the quotes — so a truncated value never
passes for a complete one.

These bounds belong to `print` and `log`, not to the formatter. A `Pretty` you
construct yourself has no limits unless you pass them, on the grounds that you
have seen your own data:

```typescript
console.print(bigArray);                      // first 100, then "... +N"
console.print(new Pretty(bigArray));          // all of it
```

A *string argument* is never truncated either — `maxString` applies only to
strings found inside data, since a string you passed to `print` is one you asked
for by name.

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
| `"default"` | Placed at the left with no padding — the line ends where the text does |
| `"left"` | Placed at the left and padded out to the full width |
| `"center"` | Padded on both sides to center the line |
| `"right"` | Padded on the left to sit against the right edge |
| `"full"` | The spaces between words widen until the line reaches the right edge; a paragraph's last line is left as it is |

Alignment applies after wrapping, so a wrapped paragraph is placed line by line.
`"center"` and `"right"` align on the line's content: a wrap leaves the space
that preceded it hanging on the line it closed, and counting that padding would
push every such line half a space off true.

`"full"` stretches every line of a paragraph but the last, which stays ragged the
way it does in a printed book. A paragraph ends wherever the text has a newline.
A line holding a single word has nothing to stretch, so it keeps its own width
too. Each space you typed is a gap of its own, so a double space stays about
twice as wide as a single one:

```typescript
const console = new Console({ width: 42 });
console.print(
  "Rich is a Python library for rich text in the terminal.  " +
    "This port follows https://github.com/Textualize/rich closely, " +
    "down to where the spaces go.",
  { justify: "full" },
);
```

```
Rich is a Python library for rich text  in
the   terminal.      This   port   follows
https://github.com/Textualize/rich
closely, down to where the spaces go.
```

The first two lines reach the edge, and the gap after `terminal.` is twice the
width of the others on its line. The URL is one word, so it stays short even
though more text follows it, and the last line is left ragged.

A line that wraps straight after a double space is left with spaces on its end,
so its last word stops short of the right edge.

### Overflow

Text is word-wrapped first. `overflow` decides what becomes of a line that is
*still* too wide once wrapping is done, which is only ever a word longer than
the whole width:

```typescript
const long = "This is a very long string that exceeds the available width";
console.print(long, { overflow: "fold" });     // chop a word wider than the line across lines (default)
console.print(long, { overflow: "crop" });     // cut such a word off at the edge
console.print(long, { overflow: "ellipsis" }); // cut it off, marking it with …
console.print(long, { overflow: "ignore" });   // same as "fold" today
```

A string of ordinary words wraps identically under all three — the mode is a
last resort, not the first thing a long line meets. They part company only on a
word no break can help: at a width of 20, `"The quick
brownfoxjumpsoverthelazydogandmore end"` keeps every character under `"fold"`
and loses the tail of the long word under `"crop"` and `"ellipsis"`.

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

An object carrying none of them is a value to print, and is formatted:

```typescript
console.log({ userId: 42, action: "login" });
// [9:14:41 PM]  { userId: 42, action: "login" }
```

An object carrying any of them is taken as options instead — and since one of
the nine is `end`, a field name as ordinary as that will mangle the line rather
than print:

```typescript
console.log("range", { end: "2024" });
// [9:14:41 PM]  range2024   ← no newline; "2024" became the line terminator
```

That trap is worth knowing before you log structured data whose field names you
do not control. `print` sniffs only a trailing object with something before it,
so `print(value)` on its own is always data — the ambiguity exists for `log()`
because `log()` puts the timestamp in front of your value.

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
