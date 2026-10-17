# Markdown

`Markdown` renders Markdown-formatted text in the terminal with styled headings, lists, emphasis, quotes, tables, rules and code blocks.

## Basic usage

```typescript
import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console();

const md = new Markdown(`# Hello, World!

This is **bold**, this is *italic*, and this is \`inline code\`.

> A quote is set off by a bar in the margin.

## A List

- Item one
- Item two
  - Nested item
- Item three

## Code

\`\`\`typescript
const greeting = (name: string) => \`Hello, \${name}!\`;
console.log(greeting("World"));
\`\`\`

---`);

console.print(md);
```

## Block structure

Blocks are read as [CommonMark](https://spec.commonmark.org/) reads them. A list item, like a
quote, holds blocks of its own — paragraphs, fenced code, quotes, nested lists — indented to
the column its text starts at, and draws them under its hang. A nested list's marker sits at
its parent's text column or up to three columns past it; four or more past it, and the marker
is text — continuing the parent's paragraph, or indented code after a blank line. A numbered
list counts on from its first number, right-aligned so every item hangs at one column. Tabs in
the indentation reach the stops of 4 they reach in the source, however deep the line is nested.

An image is drawn as Rich draws it: a picture glyph, then its alt text, linked to the image.

## Tables

A pipe table is read as Rich reads one, with [markdown-it](https://github.com/markdown-it/markdown-it)'s
take on [GitHub's table extension](https://github.github.com/gfm/#tables-extension-), and drawn
as Rich draws it, as a [`Table`](./tables). The two parsers part on where a table may start:
markdown-it tries a header row before any other block, so `# Name | Size` over a delimiter row
is a table's header where GitHub draws a heading. The header row is drawn in
`markdown.table.header`, the borders in `markdown.table.border`, and each cell's inline
Markdown kept. A colon in the delimiter row places the column's cells — `:---` left, `:---:`
centred, `---:` right. A short row is filled out with empty cells and a long one is cut to
the header's columns; `\|` puts a pipe inside a cell.

```typescript
import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console({ width: 48 });

console.print(new Markdown(`| Subpath | Installs | Size |
|:--------|:--------:|-----:|
| \`./widgets\` | **mobx** | 41 kB |
| \`./host\` | nothing | 9 kB |`));
```

## Code blocks

A fenced code block is drawn line for line in the `markdown.code` style, bold cyan on a
dark background, with its indentation kept. At sixteen colours code is drawn bold in the
terminal's own colours instead, since no fixed background reads in every terminal theme
there. The language tag after the opening fence is read
but not used: `Markdown` does no per-language highlighting. For highlighted code, render
it with [`Syntax`](./syntax) instead.

## Options

| Option | Default | Effect |
|--------|---------|--------|
| `inlineCodeStyle` | `"markdown.code"` | The style of `` `inline code` ``: a theme name, a style definition such as `"bold magenta"`, or a `Style` |
| `hyperlinks` | `true` | A link's text is the link, drawn in `markdown.link_url`. With `false` the text is drawn in `markdown.link` and the URL is written after it in parentheses, for a reader who cannot click it |
| `justify` | `"left"` | Where paragraphs, list items and quoted text sit in the width: `"left"`, `"center"`, `"right"` or `"full"`. Headings keep their own placement, as Rich's do: an h1 is centred and every other level is left |

```typescript
import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console({ width: 40 });

console.print(new Markdown("Read [the guide](https://example.com), then run `npm test`.", {
  hyperlinks: false,
  inlineCodeStyle: "bold magenta",
}));
```

## Rendering a Markdown file

The most common real-world pattern — read a Markdown file from disk and render it:

```typescript node
import { Console, Markdown } from "@promptctl/rich-js";
import { readFileSync } from "fs";

const console = new Console();
const md = new Markdown(readFileSync("README.md", "utf-8"));
console.print(md);
```
