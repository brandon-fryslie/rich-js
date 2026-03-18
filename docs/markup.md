# Console Markup

Console markup is a bbcode-inspired tag syntax that applies styles and links inline within strings. It works wherever rich-js accepts a string — `print`, `log`, table cells, panel titles, tree labels, and more.

## Syntax

### Opening and closing tags

The basic form wraps text between an opening tag and a matching close tag:

```typescript
console.print("[bold]This is bold[/bold]");
console.print("[red]This is red[/red] and this is not");
```

Unclosed tags apply to the end of the string:

```typescript
console.print("[italic]This whole line is italic");
```

Use `[/]` to close the most recently opened tag:

```typescript
console.print("[bold][red]Bold and red[/][/bold]");
//                        ^^ closes [red]
```

### Multiple and overlapping tags

Combine multiple styles in a single opening tag:

```typescript
console.print("[bold cyan]Bold and cyan[/bold cyan]");
console.print("[b i u]Bold, italic, and underlined[/b i u]");
```

Tags do not need to be strictly nested — overlapping tags work:

```typescript
console.print("[bold]Bold [italic]bold-italic[/bold] italic[/italic]");
```

### Parse errors

Two mistakes raise a parse error:

```typescript
// ✗ Mismatched tag names
console.print("[bold]Hello[/red]");

// ✗ Closing tag with no open tag
console.print("text[/]");
```

## Links

Make text a clickable hyperlink (terminal support required):

```typescript
console.print("[link=https://example.com]Visit example.com[/link]");
```

## Escaping

A backslash before `[` prevents tag interpretation:

```typescript
console.print("Use \\[bold] to make text bold");
// Prints: Use [bold] to make text bold
```

Two backslashes produce a literal backslash before a bracket:

```typescript
console.print("\\\\[bold] → \\[bold]");
```

### Security: escaping user-provided content

::: warning Injection vulnerability
If you embed user-provided content directly in a markup string, a user could inject tags and change colors or create links.
:::

Always escape untrusted content with `escapeMarkup()`:

```typescript
import { escapeMarkup } from "rich-js";

// ✗ Vulnerable — user controls `userInput`
console.print(`Hello, [bold]${userInput}[/bold]!`);

// ✓ Safe — brackets in userInput become literal characters
console.print(`Hello, [bold]${escapeMarkup(userInput)}[/bold]!`);
```

## Emoji

Emoji shortcodes in the form `:name:` are substituted with the corresponding Unicode character:

```typescript
console.print(":wave: :rocket: :fire: :thumbs_up:");
// 👋 🚀 🔥 👍
```

Some emoji have `-emoji` (full-color) and `-text` (monochrome) variants:

```typescript
console.print(":heart-emoji:  :heart-text:");
```

## Disabling markup

Disable markup per call to pass brackets through as literal characters:

```typescript
console.print("[not markup]", { markup: false });
```

Disable globally on the Console:

```typescript
const console = new Console({ markup: false });
```

## Converting markup to styled text

Parse markup explicitly into a `RichText` object when you need to manipulate it further before printing:

```typescript
import { renderMarkup } from "rich-js";

const text = renderMarkup("[bold red]Hello[/bold red]");
// text is a RichText — can be modified, measured, or embedded in other renderables
```
