# Markdown

`Markdown` renders Markdown-formatted text in the terminal with styled headings, lists, emphasis, quotes, rules and code blocks.

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

## Code blocks

A fenced code block is drawn line for line in the `markdown.code` style, cyan on a dark
background, with its indentation kept. The language tag after the opening fence is read
but not used: `Markdown` does no per-language highlighting. For highlighted code, render
it with [`Syntax`](./syntax) instead.

## Options

| Option | Default | Effect |
|--------|---------|--------|
| `inlineCodeStyle` | `"markdown.code"` | The style of `` `inline code` ``: a theme name, a style definition such as `"bold magenta"`, or a `Style` |
| `hyperlinks` | `true` | A link's text is the link, drawn in `markdown.link_url`. With `false` the text is drawn in `markdown.link` and the URL is written after it in parentheses, for a reader who cannot click it |
| `justify` | the print's | Where paragraphs, list items and quoted text sit in the width: `"left"`, `"center"`, `"right"` or `"full"`. Unset, they follow the justify the Markdown is printed with, which is left unless one is given. Headings are always left |

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
