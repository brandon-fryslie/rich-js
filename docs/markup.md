---
exampleContext: |
  const userInput = "[reverse red]Mallory[/] [she/her]";
---

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
console.print("Plain, then [italic yellow]italic and yellow to the end of the line");
```

Use `[/]` to close the most recently opened tag. Here it closes `[red]`, and the
bold carries on until `[/bold]`:

```typescript
console.print("[bold][red]Bold and red[/] just bold[/bold] neither");
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

A nested tag is applied on top of the one it sits inside, so the two combine
where they can and the inner one wins where they cannot. Attributes combine —
the middle of this line is both bold and italic:

```typescript
console.print("[bold]bold [italic]bold-italic[/italic] bold[/bold]");
```

A colour cannot combine with another colour, so the inner one replaces it for
the run it covers, and the outer colour resumes afterwards:

```typescript
console.print("[red]red [blue]blue[/blue] red again[/red]");
```

### Which brackets are tags

Not every bracketed run is a tag. A run is a tag when the character after the
`[` is a lowercase ASCII letter `a`–`z`, `#`, `/` or `@`; the tag then runs to
the first `]`, and may contain anything except another `[`. Any other opening —
a capital letter, a digit, a space, a non-ASCII letter, or nothing at all —
leaves the brackets as literal text.

That rule surprises in both directions. `[INFO]` and `[Ticket-4]` print as
written because they open on a capital. `[note: see runbook]` opens on `n`, so
it is a tag: the whole run, brackets and all, is consumed, and because
`note: see runbook` is not a style it applies nothing, so it simply disappears:

```typescript
console.print("[INFO] [green]server started[/green]");
console.print("[Ticket-4] [1] first item");
console.print("[bold]Deploy paused[/bold] [note: see runbook] until Monday");
```

That asymmetry is why text you did not write needs
[escaping](#escaping-user-provided-content) before it goes into a markup string.

### Parse errors

Two mistakes raise a parse error. A closing tag whose name matches no open tag:

```typescript throws
console.print("[bold]Hello[/red]");
```

And a closing tag with no open tag at all:

```typescript throws
console.print("text[/]");
```

A misspelled style name is not one of them. `[bold rd]typo[/]` parses, and the
text prints unstyled; see [When a style is invalid](./style#when-a-style-is-invalid).

The error is a `MarkupSyntaxError`, a subclass of `MarkupError`. Its message
gives the line and column of the rejected tag, shows that line with a caret
under the tag, and lists the tags still open there. On a long line the excerpt
is cut to about thirty characters either side of the tag, with `…` marking each
cut.

To build your own message, read the same facts from the error's fields:

```typescript
import { MarkupSyntaxError, renderMarkup } from "@promptctl/rich-js";

try {
  renderMarkup("[bold]Hello[/red]");
} catch (err) {
  if (!(err instanceof MarkupSyntaxError)) throw err;
  console.print({
    reason: err.reason, // the sentence, without the position
    markup: err.markup, // the whole string that failed
    offset: err.offset, // index of the rejected tag in `markup`
    line: err.line, // 1-based
    column: err.column, // 1-based, in UTF-16 code units, like `offset`
    openTags: err.openTags, // outermost first
  });
}
```

The position is counted in the whole string you passed, even when a
`MarkupRegistry` has handed part of it to a plugin tag's handler, and `openTags`
then includes the plugin tags around the error.

## Links

Make text a clickable hyperlink (terminal support required):

```typescript
console.print("Read the [link=https://example.com][bold blue]guide on example.com[/][/link] first");
```

## Escaping

A backslash before `[` prevents tag interpretation:

```typescript
console.print("Use \\[bold] to make text [bold]bold[/bold]");
```

The backslashes in front of a tag are read in pairs: each pair is one literal
backslash, and an odd one left over escapes the tag. So text that ends in a
backslash can still be followed by a tag:

```typescript
console.print("[red]C:\\Users\\\\[/red] is the folder, and \\\\\\[red] is literal");
```

`escapeMarkup()` doubles those runs for you.

### Escaping user-provided content

::: warning Injection vulnerability
If you embed user-provided content directly in a markup string, a user could inject tags and change colors or create links — or lose part of their own text, if it happens to contain a bracketed run that [counts as a tag](#which-brackets-are-tags).
:::

Always escape untrusted content with `escapeMarkup()`. Here `userInput` is
`"[reverse red]Mallory[/] [she/her]"`:

```typescript
import { escapeMarkup } from "@promptctl/rich-js";

// ✗ Vulnerable — user controls `userInput`
console.print(`Hello, [bold]${userInput}[/bold]!`);

// ✓ Safe — brackets in userInput become literal characters
console.print(`Hello, [bold]${escapeMarkup(userInput)}[/bold]!`);
```

No bracket in escaped text can open a tag, even when two escaped values are
joined, or the markup around it supplies a `]`. Escaped text followed by a tag
renders back exactly, backslashes included, with two exceptions where markup
cannot tell what comes next. Backslashes at the very end of the text are
doubled on the assumption that a tag follows, so escaped text that ends the
whole string shows them twice. Backslashes in front of a tag the text ends
before finishing, as in `\[link=`, are doubled because the next value could
finish it. Rich's `escape` drops the backslash in `\[0-9]`, lets `ab\\\` escape
the closing tag after it, and lets `[link=x` and `]` joined open a link;
`escapeMarkup()` does none of these.

## Emoji

Emoji shortcodes in the form `:name:` are substituted with the corresponding Unicode character:

```typescript
console.print(":wave: :rocket: :fire: :thumbs_up:");
```

Some emoji have `-emoji` (full-color) and `-text` (monochrome) variants:

```typescript
console.print(":heart-emoji:  :heart-text:");
```

## Disabling markup

Disable markup per call to pass brackets through as literal characters:

```typescript
console.print("[bold red]markup on[/bold red]");
console.print("[bold red]markup off[/bold red]", { markup: false });
```

Disable globally on the Console:

```typescript
const console = new Console({ markup: false });

console.print("[bold red]every call prints its brackets[/bold red]");
```

## Converting markup to styled text

Parse markup explicitly into a `RichText` object when you need to manipulate it further before printing:

```typescript
import { renderMarkup } from "@promptctl/rich-js";

const text = renderMarkup("[bold red]Hello[/bold red]");
// text is a RichText — can be modified, measured, or embedded in other renderables
text.append(", world", "italic cyan");
console.print(text);
```
