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
