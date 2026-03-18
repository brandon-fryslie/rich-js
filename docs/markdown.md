# Markdown

`Markdown` renders Markdown-formatted text in the terminal with styled headings, lists, emphasis, and syntax-highlighted code blocks.

## Basic usage

```typescript
import { Console, Markdown } from "rich-js";

const console = new Console();

const md = new Markdown(`
# Hello, World!

This is **bold** and this is *italic* text.

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
`);

console.print(md);
```

```
 Hello, World! ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 This is bold and this is italic text.

 A List ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  • Item one
  • Item two
     • Nested item
  • Item three

 Code ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ╔══════════════════════════════════════════════════════════════════╗
  ║ const greeting = (name: string) => `Hello, ${name}!`;           ║
  ║ console.log(greeting("World"));                                  ║
  ╚══════════════════════════════════════════════════════════════════╝
```

## Code blocks

Code blocks inside Markdown are rendered with full syntax highlighting. The language is inferred from the fenced code block tag (` ```typescript `, ` ```python `, etc.).

## Rendering a Markdown file

The most common real-world pattern — read a Markdown file from disk and render it:

```typescript
import { Console, Markdown } from "rich-js";
import { readFileSync } from "fs";

const console = new Console();
const md = new Markdown(readFileSync("README.md", "utf-8"));
console.print(md);
```
