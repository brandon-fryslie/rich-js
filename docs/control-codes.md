# Control Codes

Text you print may carry code points that draw nothing: a Persian word's joiner, a
Japanese glyph variant, a break hint in Thai, or an invisible payload someone
planted. `RichText` keeps every one of these that has a use, makes it do its job,
and stops the rest from reaching the terminal.

Two stages decide. Content deletes what no text may hold and shows a picture of
what means nothing in it, one code point at a time. The wire then decides what
depends on its neighbours, when a line is written, and it writes no control at all:
a raw `Segment`, a widget's label and a `print`'s `end` go through it as content
does. The measure reads that decision, so `cellLen` is the width of what is written.

## C0 controls and DEL

| Code points | The use it keeps | In content |
|---|---|---|
| TAB, LF | A tab stop, a line ending | Kept |
| VT, FF | Mandatory breaks | An LF |
| CR | The line ending of a CRLF, whose LF ends the line | Deleted |
| BEL | An alert: `Console.bell()`, which rings only for a person at a terminal | `␇` |
| BS | Overstrike, through `decodeAnsi` | `␈` |
| ESC | Styling, through `decodeAnsi` | `␛` |
| NUL–ACK, SO–SUB, FS–US, DEL | None in text | Its picture, `␀` to `␟` and `␡` |

A picture is one cell, so the reader sees something was there, and nothing in the
text can act on the terminal. `new RichText` never decodes a sequence: a string
that means styling says so, because otherwise any string could set a link or
conceal text with no caller having asked.

`decodeAnsi` is the road for bytes a program already wrote, and it reads what a
terminal or a printer would make of them. A CR returns to the first column. nroff's
overstrike, which `man` writes, becomes styles, and a backspace that is no
overstrike moves back a column so what follows draws over what was there:

```typescript
import { Console, decodeAnsi } from "@promptctl/rich-js";

const output = new Console({ width: 30 });
output.print(decodeAnsi("N\bNA\bAM\bME\bE  _\bm_\ba_\bn\n12%\b\b\b13%"));
```

A link URL holds nothing on this page: OSC 8 carries a URI as printable ASCII, so
what a URL means by one of these it writes percent-encoded.

A renderable that yields bytes already holding escapes, or a `print` whose `end` is
`"\r"`, gets its controls deleted, where Rich writes them. Styled bytes go through
`decodeAnsi`, and a line that redraws itself is a `Live`.

## Format characters

| Family | Code points | The use it keeps | The harm it contains |
|---|---|---|---|
| Joiners | ZWNJ U+200C, ZWJ U+200D | Persian and Urdu spelling, Indic conjuncts, emoji sequences | A ZWJ that joins nothing measures as drawn. One touching a deleted code point goes with it, so a deletion cannot form a join. |
| Variation selectors | U+FE00–FE0F, U+E0100–E01EF, U+180B–180D, U+180F | Glyph variants, and text or emoji presentation | A selector is written only directly on a glyph, so a run of them cannot hide data behind it. |
| Soft hyphen | U+00AD | A place a word may break, drawn as `-` there | It is never written: terminals disagree on its cell. |
| Break hints | ZWSP U+200B, WJ U+2060, ZWNBSP U+FEFF | ZWSP lets a line break; the others forbid it | |
| Line and paragraph separators | U+2028, U+2029 | They end a line | Content holds an LF in their place. A raw `Segment` never writes one. |
| Bidi marks | ALM U+061C, LRM, RLM | See [Right-to-Left Text](/right-to-left) | They hold no state. |
| Mongolian vowel separator | U+180E | It shapes the vowel after it | |
| Interlinear annotation | U+FFF9–FFFB | Held as written; no terminal draws ruby, and the annotating text stays visible | They hold no state. |
| Tag characters | U+E0020–E007F | Emoji subdivision flags | Outside a flag they are text no reader can see, and are not written. |
| Deprecated | U+206A–206F, U+E0001 | None | Deleted from content. Each of U+206A–206F holds state to the end of the text. |

The wire judges a run of one style at a time, so a span edge inside a sequence ends
what these rules can see. A flag cut by one loses its tags, a selector just past one
is kept, and a join can form across one that the measure of the whole text did not
count.

## Wrapping

Rich breaks only at whitespace, and any word holding none of these still does. Past
that, a word breaks where its text says it may: after ZWSP, at a soft hyphen, and
between the words of Thai, Lao, Khmer and Burmese, which are written without spaces.

```typescript
import { Console } from "@promptctl/rich-js";

const output = new Console({ width: 12 });
output.print("incompre\u00adhensible");
```

Word boundaries in those four scripts come from the engine's `Intl.Segmenter`, so
they vary with its ICU. A word it misses is folded like any other.

## What terminals do

Each cell is the cursor's advance past the code point, measured by asking the
terminal for its position. The measure is 0 for every row but the last three, which
are the glyph's 2.

| Code point | tmux 3.8 | Terminal.app 2.15 | iTerm2 3.7.6 | xterm.js 6 |
|---|---|---|---|---|
| Soft hyphen | 1 | 1 | 0 | 1 |
| ZWSP | 0 | 1 | 1 | 0 |
| ZWNJ, WJ, ZWNBSP | 0 | 1 | 0 | 0 |
| U+2028, U+2029 | 0 | 1 | 1 | 1 |
| Annotation anchors | 0 | 1 | 1 | 0 |
| ALM, U+180E | 0 | 1 | 0 | 1 |
| Heart with VS16 | 2 | 1 | 2 | 1 |
| Subdivision flag | 2 | 8 | 2 | 1 |
| Kanji with a selector | 2 | 2 | 2 | 2 |

`JSON` is data on show, so it writes whatever the wire would withhold as a JSON
escape, and what it prints parses back to what it was given.

Nothing here can fit a measure to Terminal.app, which gives most format characters
a cell, because ZWNJ has to be written for the word to be spelled right. A selector
per glyph still carries data a reader cannot see: a real sequence and a planted one
differ only by data this library does not carry.

kitty, VTE, Windows Terminal, Alacritty, foot and Ghostty have not been measured.
