# Styles

A **style** describes visual appearance: color, background color, and text attributes like bold or italic. Styles appear throughout rich-js wherever visual presentation is configured.

## Style definitions (string syntax)

A style definition is a space-separated string of color names and attribute keywords.

### Foreground color

Four forms are supported:

```typescript
"magenta"           // named color from the 256-color palette
"color(5)"          // palette index
"#af00ff"           // hex
"rgb(175,0,255)"    // RGB
```

Hex and RGB give access to the full 16.7 million truecolor range. rich-js automatically downsamples to the nearest available color when the terminal doesn't support truecolor.

### Background color

Prefix any color with `on` to set the background:

```typescript
"red on white"
"#ff0000 on #ffffff"
"bold cyan on dark_blue"
```

`"default"` resets a color to the terminal's own default. `"default on default"` is the terminal's starting state.

### Text attributes

| Attribute | Alias | Notes |
|---|---|---|
| `bold` | `b` | |
| `italic` | `i` | |
| `underline` | `u` | |
| `strike` | `s` | |
| `reverse` | `r` | Swaps fg/bg |
| `dim` | | |
| `blink` | | |
| `blink2` | | Rapid blink; rarely supported |
| `conceal` | | Rarely supported |
| `underline2` | `uu` | Double underline |
| `overline` | `o` | |
| `frame` | | |
| `encircle` | | |

### Combining attributes and colors

All parts are space-separated in any order:

```typescript
"blink bold red underline on white"
"b i #00ff00 on dark_blue"
```

### Negating attributes

Prefix with `not` to turn off an attribute within a nested style:

```typescript
// Print bold text with a non-bold region inside
console.print("[bold]This is bold [not bold]and this is not[/not bold] bold again[/bold]");
```

### Links

Include a hyperlink in a style:

```typescript
"link https://example.com"
```

Link rendering depends on the terminal — most modern terminals support clickable hyperlinks.

Links are written as OSC 8 hyperlinks, each carrying an `id` derived from its URL. Terminals treat cells with the same URL and id as one link, so a link whose text changes style partway through still highlights as a whole on hover. Two separate spans with the same URL also highlight together, because clicking either does the same thing. To read rendered bytes back, call `osc8Sequences(text)`. It returns each sequence's position, `params` (the id) and `uri`, and a close has an empty `uri`. The raw `OSC8` pattern is also exported, for building into a larger regex.

## Style objects

The string definition is parsed into a `Style` object. You can construct one directly instead:

```typescript
import { Style } from "@promptctl/rich-js";

const s = new Style({ bold: true, color: "red", bgcolor: "white" });
```

Direct construction is marginally faster than string parsing on the first call. After first use, parsed strings are cached, so the difference disappears.

Parse explicitly with `Style.parse()`:

```typescript
const s = Style.parse("bold red on white");
```

Combine two styles with addition — the right-hand style wins on conflicts:

```typescript
const base = Style.parse("bold");
const full = base.add(Style.parse("red on white"));
// Result: bold red on white
```

## Style themes

If styles are scattered through code as strings, changing a color means hunting down every occurrence. **Themes** solve this by naming styles centrally.

```typescript
import { Console, Theme } from "@promptctl/rich-js";

const theme = new Theme({
  "my.header":  "bold magenta",
  "my.warning": "bold yellow on dark_red",
  "my.success": "bold green",
});

const console = new Console({ theme });

// Use theme names in print calls
console.print("[my.header]Section One[/my.header]");
console.print("[my.warning]Caution![/my.warning]");
```

Theme names must be lowercase, start with a letter, and contain only letters, digits, dots, dashes, or underscores.

A name is looked up when it is printed, in the theme of the console doing the printing. A `RichText` built once and printed by two consoles takes each console's colors, and a name the theme does not define prints plain.

### Customizing defaults

A `Theme` starts from the built-in styles and overrides any names it defines. The built-in names are what rich-js itself draws with — `ReprHighlighter` styles numbers as `repr.number`, and a `Table` header is `table.header` — so redefining one changes how every console given the theme draws it:

```typescript
import { Console, Theme } from "@promptctl/rich-js";

const theme = new Theme({
  // The ReprHighlighter styles every number it finds as "repr.number"
  "repr.number": "bold magenta",
});

const console = new Console({ theme });
console.print("Retrying in 30 seconds");
// 30 is bold magenta; under the built-in theme it is cyan
```

To start from scratch, pass `inherit: false`. The theme then defines only the names you give it:

```typescript
const console = new Console({
  theme: new Theme({ "my.style": "bold" }, { inherit: false }),
});
console.print("[my.style]Retrying[/my.style] in 30 seconds");
// "Retrying" is bold; 30 is plain, because this theme has no repr.number
```

Text forgives a missing name, but a renderable may not: a `Table` looks up `table.header` when it renders, so printing one under this theme throws `StyleSyntaxError`. Leave `inherit` on unless your theme defines every name your renderables use.

## When a style is invalid

If styled text printed plain, a style in it probably failed to parse. A style
inside text that rich-js cannot parse does not throw: the text prints unstyled,
and by default nothing reports it. The whole style string is dropped, not only
the word that failed, so `[bold rd]typo color[/]` prints neither red nor bold. A
name the console's theme does not define is dropped the same way.

### What degrades and what throws

A style attached to text degrades to unstyled when the text is printed. That
covers markup tags, a `RichText`'s own style, and the spans that `append`,
`stylize`, `highlightWords` and highlighters add, including in text placed inside
another renderable, such as a table cell.

Every other invalid style throws `StyleSyntaxError`:

- `Style.parse` and `new Theme`, when you call them.
- The `style` option of `console.print` and of `new Console`.
- A style a renderable draws its own parts with, such as a `Panel` or `Table`
  border, a `Rule`, or a `Tree`'s guide lines. These throw when the renderable
  is printed.

Markup that does not parse, such as a closing tag that matches no open tag,
always throws. That error is a `MarkupSyntaxError`, described under
[Markup parse errors](./markup#parse-errors).

### Reporting dropped styles

Pass `onStyleError` to the `Console` to hear about each style it drops. It
receives the `StyleSyntaxError` and the whole style string that failed:

```typescript
import { Console } from "@promptctl/rich-js";

const console = new Console({
  onStyleError: (error, style) => {
    process.stderr.write(`style "${style}": ${error.message}\n`);
  },
});

console.print("[bold rd]typo color[/]");
// stderr: style "bold rd": Invalid style definition "rd" (did you mean "red"?): ColorParseError: Failed to parse color: "rd"
```

The message names only the word that failed, which is why the handler also gets
the whole string. When that word is close to a color or attribute name, the
message suggests it. Theme names are never suggested, so `[my.heder]` gets no
"did you mean".

The handler runs each time a style is resolved, not once per distinct string. A
style used twice is reported twice, and a `Live` display reports it again on
every refresh, so deduplicate by `style` if you log.

`renderToString` takes no handler. Text rendered through it drops invalid styles
silently.

### Failing on invalid styles

To make invalid styles throw, rethrow from the handler:

```typescript
const console = new Console({
  onStyleError: (error) => {
    throw error;
  },
});

console.print("[bold rd]typo color[/]"); // throws StyleSyntaxError
```

The error leaves `console.print` instead of being dropped. There is no separate
strict option, because this handler is the strict mode. Use it in tests and in
development, so a typo fails at the line that printed it.
