# Doc Spec: Syntax Highlighting

The syntax doc explains the Syntax renderable for displaying source code with language-specific highlighting.

## Sections

### Basic usage

Show constructing a Syntax object with a code string and a language name, then printing it. Show loading from a file as a common pattern.

### Loading from a file path

Show an alternative constructor that accepts a file path directly and auto-detects the language from the file extension.

### Line numbers

Show `lineNumbers: true` to render a line number column alongside the code.

### Theme

Explain the `theme` option:
- Named themes from the highlighting library's theme collection
- Special values `"ansi_dark"` and `"ansi_light"` which use the terminal's own color theme rather than an embedded color palette

### Background color

Show `backgroundColor` for overriding the theme's background color. Accept the same color string formats as style definitions (name, hex, rgb). Mention the special `"default"` value that uses the terminal's background.

## Constraints

- Do not enumerate all available theme names — they come from an external library and will go out of date
- The file-path constructor is the more practical form for most users — present it prominently
