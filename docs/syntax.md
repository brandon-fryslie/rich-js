# Syntax Highlighting

`Syntax` renders source code with highlighting: keywords, literal constants, strings, numbers and comments each get a style of their own. The tokenizer is built in and the same for every language — it knows JavaScript's and Python's keywords, and `//`, `/* */` and `#` comments. The language name is kept on the instance as `syntax.language`.

## Basic usage

Construct with a code string and a language name:

```typescript
const code = `// Greet someone, a few times over.
function greet(name: string, times = 3): string {
  const line = \`Hello, \${name}!\`;
  if (times <= 0) return "";
  return new Array(times).fill(line).join(" ");
}`;

const syntax = new Syntax(code, "typescript");
console.print(syntax);
```

## Line numbers

Show a line number column alongside the code:

```typescript
const syntax = new Syntax(code, "typescript", { lineNumbers: true });
console.print(syntax);
```

## Highlighting lines

`startLine` sets the number the first line is given, for a snippet cut from the middle of a file. `highlightLines` names lines by those numbers, and draws their numbers bold on a grey ground:

```typescript
const syntax = new Syntax(code, "typescript", {
  lineNumbers: true,
  startLine: 10,
  highlightLines: new Set([12, 13]),
});
console.print(syntax);
```
