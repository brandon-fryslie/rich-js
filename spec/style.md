# Doc Spec: Styles

The style doc explains how to describe visual appearance as a string or object, and how to compose and reuse styles.

## Sections

### What is a style

Explain that a style is a string or object that describes color and text attributes. Styles appear throughout the API wherever visual presentation is configured.

### Style definitions (string syntax)

Explain that a style definition is a space-separated string of color names and attribute keywords.

#### Foreground color

Show the supported color specification forms:
- Named color (from the 256-color palette): `"magenta"`, `"red"`, etc.
- Palette index: `"color(5)"`
- Hex: `"#af00ff"`
- RGB: `"rgb(175,0,255)"`

Note that hex and RGB give access to the full 16.7 million truecolor range, and that Rich will downgrade to the nearest available color when the terminal doesn't support it.

#### Background color

Show that prefixing any color with `"on"` sets the background: `"red on white"`. Note that `"default"` resets to the terminal's own default, and `"default on default"` is the terminal's starting state.

#### Text attributes

List the supported attributes with their shorthand aliases:
- `bold` / `b`
- `italic` / `i`
- `underline` / `u`
- `strike` / `s`
- `reverse` / `r`
- `blink`
- `blink2` (rapid blink, rarely supported)
- `conceal` (rarely supported)
- `dim`

Less-supported attributes worth mentioning: `underline2` / `uu`, `overline` / `o`, `frame`, `encircle`.

#### Combining attributes and colors

Show a full combined example: `"blink bold red underline on white"`.

#### Negating attributes

Show that prefixing with `"not"` turns off an attribute: e.g. printing bold text with a `[not bold]` region inside.

#### Links

Explain that a style may include a hyperlink by adding `"link URL"`. Show an example. Note that link support depends on the terminal.

### Style objects

Explain that the string definition is parsed into a Style object, and that the object can also be constructed directly with keyword arguments. Show the direct construction form.

Mention that constructing directly is marginally faster than parsing a string (strings are cached after first parse, so the difference only matters on the first call).

Show combining two styles with addition.

Show `Style.parse()` as an explicit way to produce a Style from a string.

### Style themes

Explain the problem: if styles are scattered throughout code as strings, changing a color means finding every occurrence. Themes solve this.

Show constructing a Theme with a map of name → style definition, and passing it to Console. Show using a theme style name in a print call and in markup.

Explain that theme names must be lowercase, start with a letter, and contain only letters, dots, dashes, or underscores.

#### Customizing defaults

Explain that a Theme inherits the built-in default styles and overrides any names it defines. Show changing how a built-in category (e.g., number highlighting) looks. Mention `inherit: false` to start from scratch.

## Constraints

- Must not explain how styles are stored or applied internally
- The named-color list does not need to be reproduced here — reference the appendix/color reference
- Must show the difference between `default` justify and `left` justify when background color is set (this is in the Console doc; do not duplicate)
