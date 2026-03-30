# Doc Spec: Rich Text

The text doc explains the styled text type — a string with annotated regions — and how to build, modify, and use it.

## Sections

### What is styled text

Explain the concept: a mutable string-like object where regions can be independently styled. Unlike a plain string, it carries visual intent. Unlike markup, styles are attached programmatically rather than parsed from a syntax. It can be passed anywhere a plain string is accepted.

### Applying styles by offset

Show applying a style to a character range (start, end). The range identifies character positions, not bytes. Show printing the result.

### Building by appending

Show appending styled segments one at a time to build up a text object from parts. Show mixing styled and unstyled appends.

### Building from ANSI codes

Show constructing a styled text object from a string that already contains ANSI escape sequences. Useful for bridging with other libraries that output ANSI.

### Assembling from parts

Show a convenience method that accepts a mix of plain strings and (string, style) pairs and returns a complete styled text object. Equivalent to the append approach but more concise.

### Highlighting by word or pattern

Mention two shortcut methods:
- Apply a style to a list of words
- Apply a style to all matches of a regular expression

### Text options

Explain the constructor options that control how the text is rendered in context:
- `justify`: overrides default justify for this text object
- `overflow`: overrides default overflow
- `noWrap`: prevents wrapping regardless of available width
- `tabSize`: number of characters a tab character expands to

Show an example of using `justify` to right-align text inside a Panel, demonstrating that these options take effect within any renderable that contains the text.

## Constraints

- Do not describe internal span representation
- Do not describe every method on the text class — focus on the patterns documented above
- The "text as a string substitute" concept should be made concrete with an example that puts it inside a Panel or Table cell
