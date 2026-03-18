# Introduction

**rich-js** is a library for rich text and beautiful formatting in the terminal. It gives you color, styles, tables, progress bars, markdown rendering, and syntax highlighting out of the box — making CLI output visually appealing and debugging faster via pretty-printing and automatic highlighting.

## Compatibility

rich-js runs on **Linux**, **macOS**, and **Windows**. It requires **Node.js ≥ 18** and is ESM-only.

Color support varies by terminal:

| Terminal | Color support |
|---|---|
| Modern Linux/macOS terminals | Truecolor (16.7 million) |
| Windows Terminal | Truecolor |
| Legacy Windows console | 8 colors |
| `TERM=dumb` / piped output | None |

rich-js detects your terminal's capabilities automatically and downsamples colors as needed. You never need to think about it.

## Installation

```sh
npm install rich-js
```

## Quick start

```typescript
import { Console } from "rich-js";

const console = new Console();

// Inline markup applies styles to any span of text
console.print("[bold magenta]Hello[/bold magenta], [cyan]World![/cyan] :wave:");

// Plain objects are automatically pretty-printed
console.print({ name: "Alice", scores: [98, 87, 95] });
```

Output:

```
Hello, World! 👋
{
  'name': 'Alice',
  'scores': [98, 87, 95]
}
```

## Using the Console

`Console` is the main entry point. Create one instance and import it wherever you need output:

```typescript
// console.ts
import { Console } from "rich-js";

export const console = new Console();
```

```typescript
// elsewhere
import { console } from "./console.js";

console.print("[green]Done![/green]");
```

The Console auto-detects terminal size, color support, and encoding. See [Console](./console) for the full reference.

## What comes next

Continue with [Console](./console) to learn the complete output API, or jump to [Styles](./style) to learn how colors and text attributes work.
