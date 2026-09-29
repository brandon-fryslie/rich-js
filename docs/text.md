---
exampleContext: |
  const lines = [
    "\x1b[33mwarning: 2 dependencies are deprecated",
    "  left-pad@1.3.0",
    "  request@2.88.2\x1b[0m",
    "\x1b[1;32m✔\x1b[0m installed 214 packages",
  ];
---

# Rich Text

`RichText` is a mutable string-like object where regions can be independently styled. Unlike a plain string, it carries visual intent. Unlike markup, styles are attached programmatically rather than parsed from a syntax. It can be passed anywhere a plain string is accepted — including table cells, panel titles, and tree labels.

## Applying styles by offset

Apply a style to a character range with `stylize(style, start, end)`. The style comes first; `start` and `end` are optional and default to the whole text. Positions are character indices, not byte offsets:

```typescript
import { RichText } from "@promptctl/rich-js";

const text = new RichText("Hello, World!");
text.stylize("bold magenta", 0, 5);   // "Hello"
text.stylize("cyan underline", 7, 12); // "World"

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

A more concise alternative to repeated `append()` calls — pass one array mixing plain strings and `[string, style]` pairs:

```typescript
const text = RichText.assemble([
  ["Name: ", "bold"],
  ["Alice",  "cyan"],
  " — ",
  ["active", "green"],
]);

console.print(text);
```

## Highlighting by word or pattern

Apply a style to specific whole words. Matching is case-sensitive unless you pass `{ caseSensitive: false }`:

```typescript
const log = new RichText("boot ok\nWARN disk 91% full\nERROR write failed");
log.highlightWords(["ERROR"], "bold red");
log.highlightWords(["WARN"], "bold yellow");

console.print(log);
```

Apply a style to every match of a regular expression:

```typescript
const summary = new RichText("3 passed, 1 failed, 12 skipped in 42 ms");
summary.highlightRegex(/\d+/, "bold yellow");

console.print(summary);
```

## Text options

Constructor options control how the text lays itself out wherever it is drawn as a renderable of its own — inside a Panel, a Table cell, a Layout:

```typescript
import { Panel } from "@promptctl/rich-js";

const heading = new RichText("Right-aligned heading", {
  style:    "bold cyan",
  justify:  "right",    // override default justify for this object
  overflow: "ellipsis", // override default overflow
  noWrap:   true,       // prevent word-wrapping
  tabSize:  4,          // expand tab characters to this many spaces
});

console.print(new Panel(heading, { borderStyle: "blue" }));
```

`print` is the one place they do not apply. The text arguments of a print are joined into one text, and the print's own `justify`, `overflow` and `softWrap` set it, as Rich's `print` does. A `RichText` keeps its style there, and leaves its layout options behind.

## Wide characters

A CJK character takes two terminal cells, and every width in the library is counted in cells rather than characters. So a column of Japanese, Chinese or Korean text lines up with the columns beside it:

```typescript
import { Table } from "@promptctl/rich-js";

const cities = new Table({ borderStyle: "steel_blue" });
cities.addColumn("City");
cities.addColumn("Local name");
cities.addColumn("Population", { justify: "right" });
cities.addRow("Tokyo", "[bold]東京[/]", "14,187,000");
cities.addRow("Seoul", "[bold]서울특별시[/]", "9,386,000");
cities.addRow("Hong Kong", "[bold]香港[/]", "7,500,000");
cities.addRow("Osaka", "[bold]大阪市[/]", "2,752,000");

console.print(cities);
```

## Decoding ANSI output

`decodeAnsi` turns bytes a program has already written, escape codes and all, back into a `RichText`. Use it to show another command's coloured output inside a Panel, or to replay a captured log:

```typescript
import { Panel, decodeAnsi } from "@promptctl/rich-js";

const captured = "\x1b[1;32m✔\x1b[0m 12 passed  \x1b[31m✘\x1b[0m 1 failed";

console.print(new Panel(decodeAnsi(captured), { title: "npm test" }));
```

Each colour keeps the kind it was written as. `\x1b[31m` decodes to standard colour 1, not to a particular red, so the terminal or exported theme that draws the text still picks the shade. Text attributes and OSC 8 hyperlinks decode too. Other escapes, cursor movement included, are dropped. A carriage return goes back to the start of the line and the text after it overwrites what was there, and erase-in-line (`\x1b[K`) clears it, so a progress line redrawn in place decodes to its final state.

To decode output as it arrives, one line at a time, keep one `AnsiDecoder` for the whole stream. A style that one line sets stays in effect on the lines after it, the way it would on a terminal:

```typescript
import { AnsiDecoder } from "@promptctl/rich-js";

const decoder = new AnsiDecoder();
for (const line of lines) {
  console.print(decoder.decodeLine(line));
}
```
