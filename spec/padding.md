# Doc Spec: Padding

The padding doc explains the Padding renderable for adding whitespace around content.

## Sections

### Basic usage

Show wrapping a string with a single padding value that applies to all four sides. Show the rendered output (blank lines above/below, spaces left/right).

### Granular padding

Explain the tuple forms following CSS conventions:
- 2-tuple: top/bottom and left/right
- 4-tuple: top, right, bottom, left

Show an example using a 2-tuple.

### Style and expansion

Show `style` for applying a background color to the padded area. Show `expand: false` to prevent the padding from stretching to the terminal width.

### Usage in other renderables

Note that Padding can be used anywhere a renderable is accepted — for example, as a cell in a Table to add visual emphasis.

## Constraints

- Keep this doc short — Padding is a simple wrapper
- Must show all three padding forms (single value, 2-tuple, 4-tuple) — the CSS analogy helps readers remember the 4-tuple order
