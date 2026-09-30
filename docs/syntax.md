# Syntax Highlighting

`Syntax` renders source code with highlighting: keywords, literal constants, strings, numbers and comments each get a style of their own. The tokenizer is built in, and the language names its grammar: `"javascript"`, `"typescript"`, `"python"`, `"bash"`, or `"text"`, the default, which highlights nothing. Any other name is a type error — map a language this has no grammar for to `"text"`.

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

## Line range

`lineRange` shows a slice of the code, from its first line to its last, counted from 1 and inclusive. A line keeps the number it has in the whole code, counted from `startLine`:

```typescript
const syntax = new Syntax(code, "typescript", { lineNumbers: true, lineRange: [3, 5] });
console.print(syntax);
```

## Long lines

A line longer than the width is cut at its edge. With `wordWrap` it wraps instead, and the rows it wraps onto have no number of their own:

```typescript
const syntax = new Syntax(code, "typescript", { lineNumbers: true, wordWrap: true });
new Console({ width: 40 }).print(syntax);
```

## Theme

The colours are names in the console's theme, so a `Theme` restyles every `Syntax` it prints: `syntax.keyword`, `syntax.constant`, `syntax.string`, `syntax.number` and `syntax.comment` for the code, `syntax.line_number` for the gutter, and `syntax.line_number.highlight` for the number of a line in `highlightLines`.

```typescript
const theme = new Theme({
  "syntax.keyword": "bold #ff79c6",
  "syntax.string": "#f1fa8c",
  "syntax.comment": "#6272a4",
});

new Console({ theme }).print(new Syntax(code, "typescript", { lineNumbers: true }));
```
