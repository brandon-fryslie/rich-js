# Right-to-Left Text

Arabic, Persian, Urdu and Hebrew read right to left, and a terminal draws cells
left to right. Something has to put the letters in the order a reader expects,
and only some terminals do it themselves. rich-js finds out what it can about
the terminal and writes accordingly, and a bidirectional control in your content
can never reach past the content that holds it.

```typescript
console.print("مرحبا بالعالم");
```

The terminal on this page runs in your browser, which orders the row itself:

```typescript live
import { Console } from "@promptctl/rich-js";

const console = new Console();
console.print("אבגדה");
```

Most programs need nothing more. Set `textOrder` when you know your terminal
better than rich-js can:

```typescript
import { Console } from "@promptctl/rich-js";

const output = new Console({ textOrder: "logical" });
output.print("שלום עולם");
```

## The four text orders

`textOrder` is one of four values, and it says what the destination does with
direction. `Console`, `App` and `renderToString` all take it.

| Order | The destination | What rich-js writes |
| --- | --- | --- |
| `plain` | Is not a display, or nothing is known about it | The characters in logical order, with no bidi control |
| `logical` | Reorders text itself and takes the controls at zero width | Logical order, each row sealed in an isolate |
| `visual` | Does not reorder | Rows already reversed, mirrored and shaped, with no controls |
| `words` | Reverses right-to-left text inside each run between spaces, and nowhere else | Rows as under `visual`, each right-to-left word turned back so the display's reversal puts it right |

Each order above `plain` is a claim about the terminal. Visual order on a
terminal that also reorders reverses the text twice. Isolates on a terminal
whose width table predates them take up cells, which moves a table's border. So
rich-js uses `plain` unless it has evidence.

## What rich-js detects

The order comes from the environment, and a terminal's own `TERM` outranks a
variable it may have inherited from the program that started it.

- **`visual`:** Windows Terminal, Alacritty, foot and Ghostty.
- **`logical`:** VTE terminals, such as GNOME Terminal.
- **`words`:** kitty, which reverses right-to-left text inside each run between
  spaces and runs no bidi across a line. Rows are laid out as under `visual`, and
  each right-to-left word is written in the order kitty turns back.
- **`plain`:** everything else, including pipes, files, tmux, screen, zellij,
  Emacs, Vim and Neovim terminals, VS Code, xterm.js, iTerm2, Konsole and
  Terminal.app.

WezTerm is `plain` because its bidi is a setting the environment cannot show. If
you have left it off, state `visual` yourself.

iTerm2 reorders the whole line through the isolates, so they contain nothing
there. Terminal.app holds its isolates at zero width but gives RLE, RLO and PDF a
cell each. If your content carries none of those, you can state `logical` on it.

`renderToString` never detects. It defaults to `plain`, so the same call gives
the same bytes everywhere.

## Bidi controls in your content

`RichText` holds the explicit controls (LRE, RLE, LRO, RLO, PDF, LRI, RLI, FSI,
PDI) as characters, and their effect ends with the content that holds them:

- Under `logical` they reach the terminal, balanced and closed inside the row's
  isolate. Under `visual` rich-js applies them itself.
- Under `plain` they are deleted before wrapping.
- A control in a segment no `RichText` drew is deleted in every order, so a raw
  `Segment` cannot carry one to the terminal.
- Separate contents do not share state: `console.print(a, b)`, a `RichText`
  appended to another, `RichText.assemble`, `appendTokens` and each inline piece
  of `Markdown` all close what each one left open.

Appending a string builds one content, so an override in it reaches the end of
its line. To keep untrusted text apart, hand it in as its own `RichText`.

`JSONRenderable` shows an explicit control as its `\u` escape, so the output
stays valid JSON. `Syntax` does too, because a control held in source code is the
Trojan Source attack, and Markdown's inline code deletes them.

## Wrapping and truncation

rich-js resolves direction over a whole line, then cuts it, then orders each row.
Cuts fall on logical offsets in every order, so what survives truncation is the
start of the sentence. In right-to-left text that is its right-hand side, and the
`…` sits on the left.

Lam-alef stays two cells in `visual`, as two joined letters rather than the
one-cell ligature, because the ligature would change a line's width after layout.

## Stating a paragraph's direction

A paragraph's direction normally comes from its first strong character. Set a
`RichText`'s `direction` to `"ltr"` or `"rtl"` to state it instead, as HTML's
`dir` does (UAX #9 rule P3). Ordering, placement and the edges a `Strip`
separator meets all follow the stated direction.

[`wrap`](./text.md#wrapped-rows) under `logical` sets this on every row of a
bidi line, because a row alone cannot find its line's direction again. The row
also starts with the controls its line still had open at that point. It refuses
`visual`, where a row is ordered by levels resolved over its whole line.

The direction is the row's own format, and `append` carries a text's
characters and spans, not its format. A bidi row appended after a prefix is
ordered by the combined text's direction, so draw it as its own renderable, for
example in a [`Strip`](./strip.md) beside the prefix.

### Visual rows

Under `visual`, a row is ordered by levels resolved over its whole line, so no
`RichText` cut from it draws it alone. Take the placed rows off the render
instead. Under the default `end`, the render ends each row in a line break, so
`Segment.splitLines` returns each row as drawn and in visual order, one per row
`wrap` would give under `logical`. Each followed by a line break, they are the
render, in terminal bytes and in HTML and SVG export.

```ts silent
const line = new RichText("שלום עולם, hello world! 123 עוד מילים");
const rows = Segment.splitLines(render(line, { maxWidth: 12, textOrder: "visual" }));
```

## Known limits

- **VTE at column 0.** VTE discards zero-width characters at the start of a row,
  so a bare `console.print` loses its isolate and the terminal resolves the row
  as left to right. An Arabic sentence keeps its full stop on the wrong side, as
  it always has here. Containment still holds, and anything after a border or
  padding, such as a table cell, reads correctly.
- **Mixed text at a cut.** A terminal resolves one row and cannot see the rest of
  the paragraph, so under `logical` a neutral or a number right beside a cut can
  land differently than under `visual`.
- **A terminal on `plain` that reorders.** Right-to-left text behaves as it always
  has: two adjacent right-to-left table cells swap, and controls have no effect.
- **Pointer hits and crops.** A cell's offset is not its screen column in a
  logical right-to-left row, so a pointer hit or a mid-row crop there lands on
  different cells than the terminal shows. A row split by an overlay reopens what
  was open at its start, so a control in the middle of the row stops acting past
  the split.
- **`TextInput`.** Up and Down keep a column counted through the text, not across the screen, so on a right-to-left row they land where the text's order puts that column.
- **kitty.** A run kitty shapes also ends where the font changes, which no
  program can see: punctuation drawn from the main font beside an Arabic word
  drawn from a fallback font lands on the wrong side of that word. A run with
  no space in it that starts with right-to-left script and ends with
  left-to-right — two table cells drawn with no padding between them — has no
  bytes kitty shows as laid out, and is written as it lies. With
  `force_ltr yes`, which the environment cannot show, kitty wants `visual`;
  state it.
- **`RichText.plain`.** It holds the controls in every order, so a program writing
  `text.plain` itself gets no containment.
- **Export.** `exportText` from a `visual` console holds visual text, as a copy off
  the screen does. SVG places each chunk at its own column, so a program exporting
  right-to-left SVG should record under `visual`. A console recording for HTML
  export should state `logical`.
- **Highlighting.** It runs before the destination is known, so a control inside a
  number or a URL splits the highlight there.
