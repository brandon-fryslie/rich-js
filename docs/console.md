---
exampleContext: |
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const doWork = () => sleep(3000);
  const deepData: unknown = Array.from({ length: 20 }).reduce<unknown>((inner) => [inner], "bottom");
---

# Console

`Console` is the output object: it detects what the terminal supports, owns the
render loop, and writes the bytes. Most of this library is reached through one.

It is not the only way out, though. [`renderToString`](./protocol) renders any
`Renderable` to a string of ANSI in one shot with no `Console` involved, and
`Prompt` reads input without one. Reach for `Console` when you want terminal
detection, wrapping, recording and a stream to write to — which is nearly
always.

## Construction and sharing

Most applications need one `Console` instance. Create it once, in a module of
its own that exports it (`export const console = new Console();`), and import it
wherever you need output:

```typescript silent
import { Console } from "@promptctl/rich-js";

const console = new Console();
```

`Console` auto-detects terminal capabilities on construction. No configuration is required to get started.

## Auto-detected attributes

After construction, `Console` exposes information about the terminal:

| Property | Description |
|---|---|
| `console.width` | Terminal columns (live terminal size) |
| `console.height` | Terminal rows (live terminal size) |
| `console.isTerminal` | `true` when writing to a real TTY |
| `console.colorSystem` | Detected color depth — a `ColorDepth`, or `null` for no color |
| `console.destination` | What output is encoded for: `{ colorSystem, hyperlinks }`, the color depth plus whether OSC 8 links are written, with the constructor options applied — see [Environment variables](#environment-variables) |

`width` and `height` reflect the current terminal size — if the user resizes the window they update automatically.

Here is what a `Console` detects in the terminal these examples run in:

```typescript
const detected = new Table({ box: ROUNDED, borderStyle: "blue" }).addColumn("Property").addColumn("Value");
const attributes = {
  width: console.width,
  height: console.height,
  isTerminal: console.isTerminal,
  colorSystem: console.colorSystem === null ? null : ColorDepth[console.colorSystem],
  "destination.colorSystem": console.destination.colorSystem === null ? null : ColorDepth[console.destination.colorSystem],
  "destination.hyperlinks": console.destination.hyperlinks,
};
for (const [name, value] of Object.entries(attributes)) {
  detected.addRow(`[bold cyan]${name}[/]`, new Pretty(value));
}
console.print(detected);
```

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

A sixth depth exists with no spec string: the Windows console's sixteen colors.
It writes the same sixteen ANSI slots `"ansi"` does, but picks each slot by the
color the console draws there — its default Campbell scheme, `WINDOWS_TABLE` —
rather than the xterm defaults. Nothing detects it — `"auto"` never returns it, and there is no
platform check anywhere in the library — so the only way to get it is to name
the enum value:

```typescript
import { Console, ColorDepth } from "@promptctl/rich-js";

const legacy = new Console({ colorSystem: ColorDepth.WINDOWS });
legacy.print("[on #ff8700]  [/][on #5f00d7]  [/][on #00afaf]  [/] [bold #ff8700]orange[/]");
```

Auto-detection picks the best system your terminal supports. Setting a higher system than the terminal supports can produce unreadable output. When you specify a lower color system, colors are automatically downgraded to the nearest available equivalent:

```typescript
const ramp = Array.from({ length: 24 }, (_, i) => {
  const hex = Math.round((i / 23) * 255).toString(16).padStart(2, "0");
  return `[on #ff${hex}00] [/]`;
}).join("");

for (const colorSystem of ["truecolor", "256", "ansi", "none"] as const) {
  const console = new Console({ colorSystem });
  console.print(`[bold]${colorSystem.padEnd(10)}[/]${ramp}`);
}
```

It is one ramp printed at each depth: the fewer colors a depth has, the fewer
of its steps survive, and `"none"` drops the color altogether.

## Printing

`print()` is the primary output method:

```typescript
import { Table } from "@promptctl/rich-js";

// Plain string with markup
console.print("[bold]Hello[/bold], [cyan]World![/cyan]");

// Multiple values — joined with a space
console.print("x =", 42, "y =", 99);

// Any Renderable object
console.print(new Table().addColumn("Name").addRow("[magenta]Alice[/]"));
```

Output is word-wrapped to the terminal width by default.

`print` sorts each argument into one of three kinds. A renderable draws itself.
A string is the only kind of argument that can contain markup, so it is the only
kind the markup dialect is applied to. Anything else is data, and is formatted by
[`Pretty`](./pretty):

```typescript
console.print({ status: 200, ok: true });
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
`... +4900`, `{...}`, `+49000` after the closing quote — so a truncated value never
passes for a complete one.

These bounds belong to `print` and `log`, not to the formatter. A `Pretty` you
construct yourself has no limits unless you pass them, on the grounds that you
have seen your own data. Here `deepData` is an array nested 20 levels deep:

```typescript
console.print(deepData);             // 16 levels, then "[...]"
console.print(new Pretty(deepData)); // all 20 of them
```

A *string argument* is never truncated either — `maxString` applies only to
strings found inside data, since a string you passed to `print` is one you asked
for by name.

### Line ends

`sep` and `end` belong to text. Adjacent strings, `RichText` values and scalar
data (numbers, booleans, `null`, an object that describes itself) are joined
with `sep`, a space by default, and the line they make is ended with `end`, a
line break by default. Any other renderable takes whole lines of its own: text
before it ends its line first, text after it starts on a new one, and neither
`sep` nor `end` is placed next to it. Printed renderables therefore stack with no
blank line between them:

```typescript
console.print("before", new Panel("[bold]one[/]", { width: 9, borderStyle: "cyan" }), "after", "that");
console.print(new Panel("[bold]two[/]", { width: 9, borderStyle: "magenta" }), { end: "" });
console.print("done");
```

The `end: ""` in the second call changes nothing, because that call printed no
text. A renderable's last line is always ended, even one whose render did not
end it. Python Rich differs here: it leaves such a line open, and the next print
carries on along it. A line break at the end of a string is text, so
`console.print("a\n")` prints `a` and then an empty line.

Data that is a container takes whole lines of its own too, as it does in Python
Rich: an array or typed array, a `Map`, a `Set`, or any other object that does
not describe itself, even an empty one. An object describes itself when it has a
`Symbol.toPrimitive` method or a `toString` method other than
`Object.prototype.toString`. `Pretty` formats it and may spread it
across several lines, so it is not joined into a line of text:

```typescript
console.print("x =", [1, 2], "y =", 99);
```

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
console.print("Hello!", { justify: "right", style: "bold magenta" });
```

A background shows where each mode puts the padding:

```typescript
for (const justify of ["default", "left", "center", "right"] as const) {
  console.print(justify, { justify, style: "bold white on blue" });
}
```

| Mode | Behavior |
|---|---|
| `"default"` | Placed at the left with no padding — the line ends where the text does |
| `"left"` | Placed at the left and padded out to the full width |
| `"center"` | Padded on both sides to center it |
| `"right"` | Padded on the left to sit against the right edge |
| `"full"` | The spaces between words widen until the line reaches the right edge; a paragraph's last line is left as it is |

`"left"`, `"center"` and `"right"` place what you print as one block. Its
widest line sets the block's width, each shorter line is justified inside that
width, and then the whole block is padded out to the console. So the two lines
of `"hi\nhello"` stay together as a 5-cell block. A table or a panel is placed
the same way:

```typescript
import { Panel } from "@promptctl/rich-js";

console.print("hi\nhello", { justify: "center", style: "on blue" });
console.print(Panel.fit("boxed"), { justify: "right" });
```

`"center"` and `"right"` align on a line's content. When text wraps, the space
before the break stays at the end of the line it closed, and counting that
space would put every such line half a cell off true. Under
`overflow: "ignore"`, which `softWrap` asks for unless you name another
overflow, a line is not justified at all, because it has no width to be
justified in. The block is still placed.

`"full"` stretches every line of a paragraph but the last, which stays ragged the
way it does in a printed book. A paragraph ends wherever the text has a newline.
A line holding a single word has nothing to stretch, so it keeps its own width
too. Each space you typed is a gap of its own, so a double space stays about
twice as wide as a single one:

```typescript
const narrow = new Console({ width: 42 });
narrow.print(
  "Rich is a Python library for rich text in the terminal.  " +
    "This port follows https://github.com/Textualize/rich closely, " +
    "down to where the spaces go.",
  { justify: "full" },
);
```

The first two lines reach the edge, and the gap after `terminal.` is twice the
width of the others on its line. The URL is one word, so it stays short even
though more text follows it, and the last line is left ragged.

A line that wraps straight after a double space is left with spaces on its end,
so its last word stops short of the right edge.

### Overflow

Text is word-wrapped first. Three of the `overflow` modes decide what becomes of
a line that is *still* too wide once wrapping is done, which is only ever a word
longer than the whole width. The fourth, `"ignore"`, skips wrapping altogether:

```typescript
const narrow = new Console({ width: 20 });
const long = "The quick brownfoxjumpsoverthelazydogandmore end";

narrow.rule("fold", { style: "cyan" });
narrow.print(long, { overflow: "fold" });     // chop a word wider than the line across lines (default)
narrow.rule("crop", { style: "cyan" });
narrow.print(long, { overflow: "crop" });     // cut such a word off at the edge
narrow.rule("ellipsis", { style: "cyan" });
narrow.print(long, { overflow: "ellipsis" }); // cut it off, marking it with …
narrow.rule("ignore", { style: "cyan" });
narrow.print(long, { overflow: "ignore" });   // don't wrap; the line is cut at the console width
```

A string of ordinary words wraps identically under the first three — the mode
is a last resort, not the first thing a long line meets. They part company only
on a word no break can help, like the one above: `"fold"` keeps every character
of it, and `"crop"` and `"ellipsis"` lose its tail.

Under `"ignore"` the line is neither wrapped nor cut by any of those methods. It
leaves the renderer at its natural width, and the [`crop` flag](#cropping) then
cuts it at the console width:

```typescript
const narrow = new Console({ width: 12 });
narrow.print("[green]aaaa[/] [yellow]bbbb[/] [magenta]cccc[/] [cyan]dddd[/]", { overflow: "ignore" });
```

Without `"ignore"`, the same call wraps after `bbbb` and prints two lines. A line
that fits is still aligned: `"hi"` printed with
`{ overflow: "ignore", justify: "right" }` at that width comes out as ten spaces
and then `hi`.

Inside a container the line runs to the container's own edge rather than the
console's. At a width of 16, `new Panel("aaaa bbbb cccc dddd eeee")` printed with
`{ overflow: "ignore" }` draws a single row of content, `│ aaaa bbbb cc │`.

### Cropping

After rendering, `print()` cuts every line at the console width. That is the
`crop` flag, and it is on by default. It is not the same thing as
`overflow: "crop"`: that mode cuts a single word too long to wrap, while the flag
cuts whatever reaches the output, `end` included — at width 12,
`{ overflow: "ignore", end: " ZZZ " }` prints `aaaa bbbb cc` and nothing after
it.

Word-wrapped text never runs past the width, so for it the flag changes nothing.
It matters when something renders wider than the console: a line printed with
`overflow: "ignore"`, or a renderable of your own that draws past the width it
was given. Pass `crop: false` to let those lines through whole:

```typescript
const narrow = new Console({ width: 12 });
narrow.print("[green]aaaa[/] [yellow]bbbb[/] [magenta]cccc[/] [cyan]dddd[/]", { overflow: "ignore", crop: false });
```

A wide character the edge cuts through leaves a space in its place. A CJK glyph
takes two cells, so at width 11 the sixth glyph straddles the edge:

```typescript
const narrow = new Console({ width: 11 });
narrow.print("日本語日本語日本語", { overflow: "ignore", style: "black on yellow" });
```

The line is five glyphs and a trailing space, eleven cells in all; the
background shows the space.

### Soft wrapping

`softWrap: true` turns off word-wrapping and cropping both, so a long line runs
past the terminal width instead of folding — the behavior of the built-in
`console.log`:

```typescript
const narrow = new Console({ width: 20 });
const line = "[bold]A very long line[/] that runs on past twenty cells";
narrow.print(line);
narrow.print(line, { softWrap: true });
```

At a width of 20 the first call wraps the line; the second prints it whole.

It overrides the `crop` flag rather than deferring to it. At width 12,
`console.print("aaaa bbbb cccc dddd", { softWrap: true, crop: true })` prints
the whole line.

The line runs on because `softWrap` asks for `overflow: "ignore"` when you name
no overflow of your own. Name one and the line is still not wrapped, but it is
cut at the width by that method: at width 12,
`{ softWrap: true, overflow: "ellipsis" }` prints `aaaa bbbb c…`.

## Logging

`log()` puts a timestamp in a column of its own and, beside it, draws what
`print()` would draw for the same arguments in the width that is left. Every
line after the first is indented to the column, and the row always ends, even
when `end` would leave a printed line open. Options such as `style` and
`justify` apply to that content and never to the timestamp:

```typescript
console.log("Server started on port [bold cyan]3000[/]");
console.log("user", 42, "signed in");
```

That is the whole method: no location column, and no options parameter of its
own. What happens to a trailing object depends on its keys, because `log()`
reads its arguments as `print()` does, and `print()` decides by sniffing for the nine
`PrintOptions` names — `style`, `justify`, `markup`, `highlight`, `overflow`,
`end`, `softWrap`, `crop`, `sep`.

An object carrying none of them is a value to print, and is formatted:

```typescript
console.log({ userId: 42, action: "login" });
```

An object carrying any of them is taken as options instead — and since one of
the nine is `end`, a field name as ordinary as that will mangle the line rather
than print:

```typescript
console.log("range", { end: "2024" });
console.log("the next line");
```

The object is never printed: `"2024"` became the line terminator, so the row
reads `range2024`.

That trap is worth knowing before you log structured data whose field names you
do not control. `print` sniffs only a trailing object with something before it,
so `print(value)` on its own is always data — the ambiguity exists for `log()`
because `log()` puts the timestamp in front of your value.

## JSON output

`printJson()` pretty-prints JSON with syntax highlighting. It takes either a JSON
string, which it parses first, or an object, which it formats directly:

```typescript
console.printJson('{"name": "Alice", "scores": [98, 87, 95]}');

// Or pass an object directly
console.printJson({ name: "Alice", scores: [98, 87, 95] });
```

A string that is not valid JSON throws the `SyntaxError` from `JSON.parse`.

The second argument takes three options:

- `indent` — spaces per nesting level. Defaults to `2`.
- `sortKeys` — sort object keys at every depth, including objects inside
  arrays. Keys compare by UTF-16 code unit, so `"Zebra"` sorts before `"apple"`.
  Defaults to `false`.
- `highlight` — colour keys, strings, numbers, booleans, `null` and braces.
  Defaults to `true`; `false` prints plain text.

```typescript
console.printJson({ name: "Alice" }, { indent: 4 });
console.printJson({ zone: "eu", app: { port: 80, host: "a" } }, { sortKeys: true });
console.printJson({ name: "Alice" }, { highlight: false });
```

`highlight` belongs to `printJson`, not to the console. A console constructed
with `highlight: false` still colours `printJson` output, because that setting
controls what `print()` does to strings. Pass `{ highlight: false }` to
`printJson` itself to get plain text.

Lines are never wrapped or cropped. A line wider than the console runs past its
edge, so the printed text stays valid JSON.

To place formatted JSON inside a `Panel` or a `Table` cell instead of printing
it, build the renderable `printJson` uses: `JSONRenderable.fromString` or
`JSONRenderable.fromData`, both exported from `@promptctl/rich-js`, take the
same options.

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
on. `doWork()` stands for your own slow, awaited work:

```typescript live
import { Console, Status } from "@promptctl/rich-js";

const console = new Console();
const status = new Status("Processing...", { console, spinner: "dots", style: "bold green" });

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
console.print("Every line this console prints sits on [bold]dark blue[/].");
```

## Input

`Console` writes; it does not read. Reading a line from the user is the
`Prompt` family's job, and it takes its input capability as an argument so the
main barrel never reaches `node:readline`:

```typescript node
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
console.print(new Table().addColumn("Name").addRow("[magenta]Alice[/]"));

const text = console.exportText({ clear: false }); // plain text
const html = console.exportHtml();                 // HTML with inline styles

const out = new Console();
out.print(new Panel(new RichText(text), { title: "exportText()", borderStyle: "cyan", width: 30 }));
const head = /^(?:.*\n){3}/.exec(html)?.[0];
const hello = /<span[^>]*>Hello!<\/span>/.exec(html)?.[0];
out.print(new Panel(new RichText(`${head}…\n${hello}\n…`), { title: "exportHtml(), an excerpt", borderStyle: "cyan" }));
```

Each export clears the recording unless you pass `{ clear: false }`, which is
why the first call above passes it: without it, `exportHtml` would have nothing
left to draw.

`exportHtml` draws the page in a `TerminalTheme`. The theme supplies the page background, the default text colour and the colours ANSI colour names resolve to; with no theme the page is white text on black over the standard ANSI colours.

```typescript
import { SOLARIZED_LIGHT } from "@promptctl/rich-js";

console.print("[bold]Hello![/bold] [red]red[/] [blue]blue[/]");
const html = console.exportHtml({ theme: SOLARIZED_LIGHT });

// The page's colours, and the span that drew "red"
const page = /body\{.*\}/.exec(html)?.[0];
const red = /<span[^>]*>red<\/span>/.exec(html)?.[0];
new Console().print(new RichText(`${page}\n${red}`));
```

Every style attribute is written into the page, including reverse, dim, blink, frame and encircle; blink holds still for a reader whose system asks for reduced motion. A link becomes an `<a>` element only when its scheme is on a short allowlist of web, mail and file schemes; any other link, such as `javascript:`, exports as its styled text alone, because an exported page is made to be published.

`exportSvg` draws the recording as a picture of a terminal window: rounded chrome with three buttons and a title, every character on the cell it filled in the terminal, and text a reader can still select and copy. It follows the same rules as `exportHtml` — the same `theme` option, the same attributes, the same link allowlist — and adds `title`, the text in the window's title bar, which defaults to `"Rich"`.

Without a theme, the window is white on black, the same as the page. `SVG_EXPORT_THEME` is the palette Python Rich draws its screenshots in; pass it to get that look.

```typescript
import { SVG_EXPORT_THEME } from "@promptctl/rich-js";

console.print(new Panel("[bold]Hello![/bold] 漢字", { title: "wide characters" }));
const svg = console.exportSvg({ theme: SVG_EXPORT_THEME, title: "hello.ts" });

// The document's opening tag, and the window's title
const open = /<svg[^>]*>/.exec(svg)?.[0];
const title = /<text[^>]*>hello\.ts<\/text>/.exec(svg)?.[0];
new Console().print(new RichText(`${open}\n${title}`));
```

To persist the exported output to disk, use the node-only helpers from the `node/save` subpath:

```typescript node
import { SVG_EXPORT_THEME } from "@promptctl/rich-js";
import { saveText, saveHtml, saveSvg } from "@promptctl/rich-js/node/save";

saveText(console, "output.txt", { clear: false });
saveHtml(console, "output.html", { clear: false });
saveSvg(console, "output.svg", { theme: SVG_EXPORT_THEME });
```

These helpers live outside the main barrel so the browser bundle never reaches `node:fs`. Each takes the same options as the export it writes, `theme` and `clear` included. A save clears the recording just as its export does, so every save but the last passes `{ clear: false }`; without it, the next file would be empty.

## Error / stderr output

Write to stderr with `stderr: true`:

```typescript
const errConsole = new Console({ stderr: true, style: "red" });

errConsole.print("[bold]Error:[/bold] something failed");
```

## File output

Write to any writable stream:

```typescript node
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
const output = console.endCapture();
console.print({ output });
```

The captured string holds exactly the bytes the terminal would have received,
escape codes included.

Or bind a console to a stream you own, which is usually the better fit for tests
because the buffer outlives any single call. Anything with a `write` method will
do, a Node `Writable` included:

```typescript
const buf: string[] = [];
const testConsole = new Console({
  file: { write: (chunk) => buf.push(String(chunk)) },
});

testConsole.print("[bold]first[/]");
testConsole.print("[bold]second[/]");
console.print({ buf });
```

The bold is gone: a sink that is not a terminal gets no escape codes (see
[Terminal detection](#terminal-detection)).

## Alternate screen

`Console` has no fullscreen mode of its own. Entering the alternate screen
buffer and restoring the terminal afterwards is `Live`'s job — see
[Live Display](./live).

## Terminal detection

When output is not going to a terminal (e.g. piped to a file), rich-js strips control codes automatically. Override with:

```typescript
const colored = new Console({ forceTerminal: true });     // always emit ANSI codes
const animated = new Console({ forceInteractive: true }); // always show animations
colored.print("[bold green]colour[/] even when piped");
```

## ASCII-only terminals

Some terminals draw only ASCII — a serial console, a Linux virtual console
without a Unicode font, a log viewer that mangles anything else. Tell the
console once with `asciiOnly: true`, and every glyph the library chooses is
drawn in ASCII: panel and table borders, rules, tree guides, spinners, progress
bars, scrollbars, widget marks, and the `…` that marks cut-off text. Text you
hand it, emoji included, is drawn as you wrote it.

```typescript
const ascii = new Console({ asciiOnly: true });
const tree = new Tree("project");
tree.add("src");
ascii.print(new Panel("drawn in ASCII"));
ascii.print(tree);
```

A glyph you chose that is already ASCII stays. A `Rule` of `=` and a table
boxed in `MARKDOWN` draw as they would anywhere else. Only a glyph outside ASCII
is replaced.

It is a property of the terminal, not of any one renderable, so no renderable
takes an option of its own for it. `renderToString` takes the same
`asciiOnly` option, and so does an [`App`](./app).

## Environment variables

| Variable | Effect |
|---|---|
| `NO_COLOR` | Disable color; hyperlinks still print |
| `FORCE_COLOR` | Enable color regardless of `TERM` |
| `TERM=dumb` | Disable color and hyperlinks |
| `COLUMNS` / `LINES` | Override terminal dimensions |

`NO_COLOR` takes precedence over `FORCE_COLOR`.

Both `NO_COLOR` and `TERM=dumb` drop the console to no color system at all, and
that takes the text attributes with it — `"[bold red]X[/bold red]"` prints as a
bare `X`, with neither the color nor the bold. Neither variable changes
dimensions or wrapping.

A hyperlink is not a color. `NO_COLOR` keeps `[link=…]` as an OSC 8 link; what
drops links is a destination that takes no escapes at all — `TERM=dumb`, or
output that is not a TTY while `colorSystem` is `"auto"`. An explicit
`colorSystem` (`"none"` and `null` included) keeps links; pass
`hyperlinks: false` with `colorSystem: null` for plain text.

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
console.print("[bold magenta]hello[/]");

new Console().print({
  width: console.width,
  height: console.height,
  colorSystem: console.colorSystem === null ? null : ColorDepth[console.colorSystem],
  output,
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
