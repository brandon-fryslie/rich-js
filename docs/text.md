# Rich Text

`RichText` is a mutable string-like object where regions can be independently styled. Unlike a plain string, it carries visual intent. Unlike markup, styles are attached programmatically rather than parsed from a syntax. It can be passed anywhere a plain string is accepted — including table cells, panel titles, and tree labels.

## Applying styles by offset

Apply a style to a character range (start, end). Positions are character indices, not byte offsets:

```typescript
import { RichText, Style } from "@promptctl/rich-js";

const text = new RichText("Hello, World!");
text.stylize(0, 5, "bold magenta");  // "Hello"
text.stylize(7, 12, "cyan underline"); // "World"

console.print(text);
```

## Building by appending

Build up styled text by appending pieces:

```typescript
const text = new RichText();
text.append("Name: ",  "bold");
text.append("Alice",   "cyan");
text.append(" — ");
text.append("active",  "green");

console.print(text);
```

## Assembling from parts

A more concise alternative to repeated `append()` calls — pass a mix of plain strings and `[string, style]` pairs:

```typescript
const text = RichText.assemble(
  ["Name: ", "bold"],
  ["Alice",  "cyan"],
  " — ",
  ["active", "green"],
);

console.print(text);
```

## Highlighting by word or pattern

Apply a style to specific words:

```typescript
text.highlightWords(["ERROR", "WARN"], "bold red");
```

Apply a style to all matches of a regular expression:

```typescript
text.highlightRegex(/\d+/, "bold yellow");
```

## Text options

Constructor options control how the text renders in context:

```typescript
const text = new RichText("Right-aligned heading", {
  justify:  "right",    // override default justify for this object
  overflow: "ellipsis", // override default overflow
  noWrap:   true,       // prevent word-wrapping
  tabSize:  4,          // expand tab characters to this many spaces
});
```

These options take effect wherever the text is rendered — inside a Panel, Table cell, or directly via `print`:

```typescript
import { Panel } from "@promptctl/rich-js";

const heading = new RichText("Total", { justify: "right" });
console.print(new Panel(heading));
```

```
╭──────────────────────────────────────────────────────────╮
│                                                    Total │
╰──────────────────────────────────────────────────────────╯
```

## Decoding ANSI output

`decodeAnsi` turns bytes a program has already written, escape codes and all, back into a `RichText`. Use it to show another command's coloured output inside a Panel, or to replay a captured log:

```typescript
import { Console, Panel, decodeAnsi } from "@promptctl/rich-js";

const captured = "\x1b[1;32m✔\x1b[0m 12 passed  \x1b[31m✘\x1b[0m 1 failed";

const console = new Console();
console.print(new Panel(decodeAnsi(captured), { title: "npm test" }));
```

Each colour keeps the kind it was written as. `\x1b[31m` decodes to standard colour 1, not to a particular red, so the terminal or exported theme that draws the text still picks the shade. Text attributes and OSC 8 hyperlinks decode too. Other escapes, cursor movement included, are dropped. After a carriage return, only the text written after the line's last `\r` is kept, which is how a progress line redrawn in place looks when it finishes.

To decode output as it arrives, one line at a time, keep one `AnsiDecoder` for the whole stream. A style that one line sets stays in effect on the lines after it, the way it would on a terminal:

```typescript
import { AnsiDecoder } from "@promptctl/rich-js";

const decoder = new AnsiDecoder();
for (const line of lines) {
  console.print(decoder.decodeLine(line));
}
```
