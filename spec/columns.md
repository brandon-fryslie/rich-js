# Doc Spec: Columns

The columns doc explains the Columns renderable for laying out a list of items in a multi-column grid.

## Sections

### What it is

One sentence: Columns takes a list of renderables and arranges them in as many columns as fit in the terminal width.

### Basic usage

Show constructing Columns with a list of strings and printing it. Use a directory listing as the motivating example (same as the original Rich docs) — it is concrete and immediately useful.

### Options

Document the key options:
- `equal` — force all columns to the same width (uses the widest item as the common width)
- `expand` — stretch the column layout to fill the full terminal width
- `columnFirst` — fill columns top-to-bottom rather than left-to-right (like `ls`)
- `padding` — padding between items

### Content

Mention that columns can contain any renderable, not just strings — Panels, Tables, etc. are all valid.

## Constraints

- Keep this doc short — Columns is a simple renderable
- The directory-listing example is the canonical one; use it
- Do not document internal column width calculation
