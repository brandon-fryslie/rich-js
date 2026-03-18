# Rich Text

`RichText` is a mutable string-like object where regions can be independently styled. Unlike a plain string, it carries visual intent. Unlike markup, styles are attached programmatically rather than parsed from a syntax. It can be passed anywhere a plain string is accepted — including table cells, panel titles, and tree labels.

## Applying styles by offset

Apply a style to a character range (start, end). Positions are character indices, not byte offsets:

```typescript
import { RichText, Style } from "rich-js";

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

## Building from ANSI codes

Construct a `RichText` from a string that already contains ANSI escape sequences — useful for bridging with other libraries that produce ANSI output:

```typescript
const text = RichText.fromAnsi("\x1b[1;31mBold red text\x1b[0m");
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
import { Panel } from "rich-js";

const heading = new RichText("Total", { justify: "right" });
console.print(new Panel(heading));
```

```
╭──────────────────────────────────────────────────────────╮
│                                                    Total │
╰──────────────────────────────────────────────────────────╯
```
