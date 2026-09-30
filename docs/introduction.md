# Introduction

**rich-js** is a library for rich text and beautiful formatting in the terminal. It gives you color, styles, tables, progress bars, markdown rendering, and syntax highlighting out of the box — making CLI output visually appealing and debugging faster via pretty-printing and automatic highlighting. It also includes OKLCH-based [theme transposition](/transpose) and an [accessibility-aware contrast toolkit](/contrast) for working with color at runtime.

## Compatibility

rich-js runs on **Linux**, **macOS**, and **Windows**. It requires **Node.js ≥ 20** and is ESM-only.

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
npm install @promptctl/rich-js
```

## Quick start

```typescript
import { Console } from "@promptctl/rich-js";

const console = new Console();

// Inline markup applies styles to any span of text
console.print("[bold magenta]Hello[/bold magenta], [cyan]World![/cyan] :wave:");

// Plain objects are automatically pretty-printed
console.print({ name: "Alice", scores: [98, 87, 95] });
```

## Using the Console

`Console` is the main entry point. Create one instance in a module of its own,
say `console.ts` holding `export const console = new Console();`, and import it
wherever you need output with `import { console } from "./console.js";`. Every
call then goes through that one instance:

```typescript
console.print("[green]:check_mark: Done![/green] [dim]3 files written[/dim]");
```

The Console auto-detects terminal size and color support. See [Console](./console) for the full reference.

The examples in these docs assume that `console` is `new Console()` and that the library names they use come from `@promptctl/rich-js`, so they skip those two lines. Any other name stands for your own code or data, and the text around the example says what it is. Names from the subpath entries, such as `@promptctl/rich-js/widgets`, are always imported explicitly. **Try it**, beside an example's output, opens the example in the [playground](./playground) as a program of its own, with those lines and anything it uses from the examples above it written in.

## What comes next

Continue with [Console](./console) to learn the complete output API, or jump to [Styles](./style) to learn how colors and text attributes work.
