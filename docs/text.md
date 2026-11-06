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
  noWrap:   true,       // one line per line; a line too wide is cut by `overflow`
  tabSize:  4,          // a tab reaches the next multiple of this many cells
});

console.print(new Panel(heading, { borderStyle: "blue" }));
```

`print` is the one place they do not apply. The text arguments of a print are joined into one text, and the print's own `justify`, `overflow` and `softWrap` set it, as Rich's `print` does. A `RichText` keeps its style there, and leaves its layout options behind.

## Wrapped rows

`wrap` returns the rows a text wraps into at a width, each a `RichText` that keeps the spans of the characters it holds. This is Rich's `Text.wrap`. Use it when you lay a text out across rows yourself, for example a cell wider than its column:

```typescript
const note = new RichText("Each row keeps the styles of the characters it holds.", { end: "" });
note.stylize("bold magenta", 5, 8);
note.stylize("underline", 21, 27);

for (const [index, row] of note.wrap({ maxWidth: 20 }).entries()) {
  console.print(new RichText(`${index + 1} │ `, { style: "dim", end: "" }).append(row));
}
```

Draw the rows one per line with the same options and you get the text's own render, without its `end`. Each row already holds what wrapping did to it:

- a soft hyphen taken at a break is a `-`;
- whitespace hanging past the edge is cropped to it;
- a word cut by `overflow: "ellipsis"` ends in its `…`;
- under `justify: "full"`, every row but a paragraph's last has its gaps widened.

So a row rebuilt from its `plain`, `spans` and options draws the same row.

Rows are refused under the `visual` [text order](./right-to-left.md). There, a row is laid out from levels resolved over its whole line, and no text cut from that line draws it alone. Take [visual rows off the render](./right-to-left.md#visual-rows) instead.

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

`decodeAnsi` turns bytes a program has already written, escape codes and all, back into a `RichText`. Use it to show another command's colored output inside a Panel, or to replay a captured log:

```typescript
import { Panel, decodeAnsi } from "@promptctl/rich-js";

const captured = "\x1b[1;32m✔\x1b[0m 12 passed  \x1b[31m✘\x1b[0m 1 failed";

console.print(new Panel(decodeAnsi(captured), { title: "npm test" }));
```

Each color keeps the kind it was written as. `\x1b[31m` decodes to standard color 1, not to a particular red, so the terminal or exported theme that draws the text still picks the shade. Text attributes and OSC 8 hyperlinks decode too, and so does the overstrike `man` writes: `x\bx` is bold and `_\bx` underlined. A carriage return goes back to the start of the line, a backspace back one cell, and cursor movement along the line (`\x1b[2D` back, `\x1b[2C` forward, `\x1b[5G` to a column, `\x1b[I` and `\x1b[Z` by tab stops) moves as a terminal moves it, stopping at a right margin that `decodeAnsi`'s `width` option sets (80 by default), so `\x1b[999C` reaches the right edge. The text after any of them overwrites what was there; erase-in-line (`\x1b[K`) clears it, and a line editor's erase, delete and insert of cells (`\x1b[3X`, `\x1b[3P`, `\x1b[3@`) edit it, so a progress line redrawn in place decodes to its final state. A designated character set is drawn: `\x1b(0qqq\x1b(B` is `───`, DEC Special Graphics, and SO and SI shift G1 in and out. Other escapes, cursor movement between lines included, are dropped. A vertical tab, a form feed and a line or paragraph separator end a line, as `\n` does. Colon sub-parameters decode as terminals read them: `\x1b[38:2::255:0:0m` is a red foreground, `\x1b[4:3m` (curly) is underlined, and a single and a double underline each replace the other, since a terminal draws one kind.

To decode output as it arrives, one line at a time, keep one `AnsiDecoder` for the whole stream. A style that one line sets stays in effect on the lines after it, the way it would on a terminal. `decodeLine` is handed one line, so a form feed in it is dropped; `decode` is what splits a chunk:

```typescript
import { AnsiDecoder } from "@promptctl/rich-js";

const decoder = new AnsiDecoder();
for (const line of lines) {
  console.print(decoder.decodeLine(line));
}
```
