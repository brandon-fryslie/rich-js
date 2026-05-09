# Doc Spec: Console Markup

The markup doc explains the inline tag syntax that can be embedded in strings passed to print, log, and most renderables.

## Sections

### What is console markup

One paragraph: markup is a bbcode-inspired tag syntax that applies styles and links inline within strings. It works wherever the library accepts a string — print, log, table cells, panel titles, etc.

Add a short "when to use markup vs template-bindings" note: markup is the right choice for human-authored strings where styling is embedded inline; for programmatic composition, structured output (toolbar cells, multi-cell links), or toolchain templates, prefer the template-bindings module — cross-link to `spec/template-bindings.md`.

### Syntax

#### Opening and closing tags

Show the basic form: `[style]text[/style]`. Show that unclosed tags apply to the end of the string. Show the shorthand `[/]` to close the most recently opened tag.

#### Multiple and overlapping tags

Show that tags can be combined in a single opening tag: `[bold red]`. Show that tags do not need to be strictly nested — overlapping tags work.

#### Errors

State which mistakes raise a parse error:
- Mismatched tag names: `[bold]Hello[/red]`
- Closing tag with no open tag: `text[/]`

### Links

Show the hyperlink syntax: `[link=URL]text[/link]`. Note that link rendering depends on terminal support.

### Escaping

Explain that a backslash before a `[` prevents it from being interpreted as a tag. Show the example. Mention that two backslashes produce a literal backslash before a tag.

Explain why escaping matters for dynamically constructed markup (user-provided content could inject tags). Show the `escape()` function as the safe way to handle untrusted content in format strings.

### Emoji

Explain that emoji shortcodes in the form `:name:` are replaced with the corresponding Unicode character. Show a brief example. Mention that some emoji have `-emoji` and `-text` variants for full-color vs. monochrome display.

### Disabling markup

Explain that markup can be disabled per-call or globally on the Console. When disabled, brackets are passed through as literal characters.

### Converting markup to styled text

Mention that markup can be parsed explicitly into a styled text object when you need to manipulate it further before printing.

## Constraints

- Do not list all 256 color names — cross-reference the style doc
- Do not explain markup parsing internals
- The escaping section must include the injection vulnerability example — it is an important security / correctness concern for any user building CLI tools that print user-supplied data
