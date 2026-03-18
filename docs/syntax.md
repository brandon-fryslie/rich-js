# Syntax Highlighting

`Syntax` renders source code with language-specific highlighting.

## Loading from a file path

The most practical form — load a file and auto-detect the language from the extension:

```typescript
import { Console, Syntax } from "rich-js";

const console = new Console();

const syntax = await Syntax.fromPath("src/index.ts");
console.print(syntax);
```

## Basic usage

Construct with a code string and a language name:

```typescript
const code = `
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
`;

const syntax = new Syntax(code, "typescript");
console.print(syntax);
```

## Line numbers

Show a line number column alongside the code:

```typescript
const syntax = new Syntax(code, "typescript", { lineNumbers: true });
console.print(syntax);
```

## Theme

Choose a highlighting theme:

```typescript
const syntax = new Syntax(code, "python", { theme: "monokai" });
```

Two special values use the terminal's own color theme instead of an embedded palette:

```typescript
const syntax = new Syntax(code, "python", { theme: "ansi_dark" });
const syntax = new Syntax(code, "python", { theme: "ansi_light" });
```

This ensures the code colors harmonize with whatever color scheme the user has set in their terminal.

## Background color

Override the theme's background:

```typescript
// Named color, hex, or rgb
const syntax = new Syntax(code, "python", { backgroundColor: "#1e1e2e" });
const syntax = new Syntax(code, "python", { backgroundColor: "rgb(30,30,46)" });

// Use the terminal's own background (transparent feel)
const syntax = new Syntax(code, "python", { backgroundColor: "default" });
```
