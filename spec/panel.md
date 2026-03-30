# Doc Spec: Panel

The panel doc explains the Panel renderable for drawing a border around content.

## Sections

### Basic usage

Show constructing a Panel with a string (markup supported) and printing it. Show the rendered border.

### Sizing

Explain that by default a Panel expands to the full terminal width. Show `expand: false` (or the `fit()` alternative constructor) to shrink the panel to fit its content.

### Title and subtitle

Show the `title` argument for text on the top border and `subtitle` for text on the bottom border. Mention that both support markup.

### Border style

Show changing the box style by passing a box constant. Cross-reference the box style appendix.

### Padding

Explain the `padding` argument for adding whitespace between the border and the content.

### Style

Show the `style` argument for applying a style to the panel's border and background.

## Constraints

- Keep this doc short — Panel is a simple wrapper
- Must show at least: basic usage, expand=false, title+subtitle
- Do not list every constructor option — only the ones shown above
