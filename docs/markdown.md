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

## Rendering a Markdown file

The most common real-world pattern — read a Markdown file from disk and render it:

```typescript node
import { Console, Markdown } from "@promptctl/rich-js";
import { readFileSync } from "fs";

const console = new Console();
const md = new Markdown(readFileSync("README.md", "utf-8"));
console.print(md);
```
