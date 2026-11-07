# Control Codes

Text you print may carry code points that draw nothing: a Persian word's joiner, a
Japanese glyph variant, a break hint in Thai, or an invisible payload someone
planted. `RichText` keeps every one of these that has a use, makes it do its job,
and stops the rest from reaching the terminal.

Two stages decide. Content deletes what no text may hold and shows a stand-in for
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
| SO, SI | Switching the character set, through `decodeAnsi` | `␎`, `␏` |
| NUL–ACK, DLE–SUB, FS–US, DEL | None in text | Its picture, `␀` to `␟` and `␡` |

A picture is one cell, so the reader sees something was there, and nothing in the
text can act on the terminal. `new RichText` never decodes a sequence: a string
that means styling says so, because otherwise any string could set a link or
conceal text with no caller having asked.

`decodeAnsi` is the road for bytes a program already wrote, and it reads what a
terminal or a printer would make of them. A CR returns to the first column, and a cursor move along
the line (CUB, CUF, CHA, CHT, CBT, HPB, HPR, HPA) moves the column as a terminal
does, up to the decoder's `width`, and erase, delete and insert of cells (ECH,
DCH, ICH) edit the line there. REP (`\x1b[nb`), which ncurses writes for a run
of one character, draws the graphic character just before it `n` more times, up
to `width` since the decoder wraps nothing, and nothing when a control came
between. nroff's overstrike, which `man` writes, becomes styles, and a backspace that is no
overstrike moves back a column so what follows draws over what was there:

```typescript
import { Console, decodeAnsi } from "@promptctl/rich-js";

const output = new Console({ width: 30 });
output.print(decodeAnsi("N\bNA\bAM\bME\bE  _\bm_\ba_\bn\n12%\b\b\b13%"));
```

The character set a program designates is drawn too. `\x1b(0` puts DEC Special
Graphics in G0, the line drawing tmux, ncurses and `dialog` write, until
`\x1b(B` puts ASCII back; `\x1b)0` puts it in G1, which SO shifts in and SI
shifts out. The decoder keeps the designation across lines and calls, as it
keeps a style, until a reset (RIS `\x1bc` or DECSTR `\x1b[!p`) clears both:

```typescript
import { Console, decodeAnsi } from "@promptctl/rich-js";

const output = new Console({ width: 30 });
output.print(decodeAnsi("\x1b(0lqqqqk\nx\x1b(Bok  \x1b(0x\nmqqqqj\x1b(B"));
```

A link URL holds no control, line separator or bidi control: RFC 3986 admits no
control and RFC 3987 no bidi control, and each of them could break the link's
sequence or reorder the address it shows. A joiner stays, because taking one from
a Persian URL would send the link somewhere else.

A renderable that yields bytes already holding escapes, or a `print` whose `end` is
`"\r"`, gets its controls deleted, where Rich writes them. Styled bytes go through
`decodeAnsi`, and a line that redraws itself is a `Live`.

## C1 controls

| Code points | The use it keeps | In content |
|---|---|---|
| NEL U+0085 | A line ending, which Unicode treats as CR, LF and CRLF are treated | An LF |
| U+0080–U+0084, U+0086–U+009F | None in text | `␦` |

VTE, WezTerm, xterm.js and GNU screen act on a C1 control even when it arrives
UTF-8 encoded: U+009B starts a control sequence, and U+0090, U+0098, U+009D,
U+009E and U+009F hide everything up to a string terminator. xterm, kitty,
Alacritty, foot, Ghostty and Windows Terminal ignore them by default. Unicode has
no pictures for C1, so each one shows as U+2426, the symbol for a substituted
character: one cell and one code unit like the C0 pictures, and never mistaken
for the replacement character a decoding error leaves.

`decodeAnsi` reads output the way those terminals do: an 8-bit CSI styles, erases
and moves as `ESC [` does, an 8-bit OSC 8 opens and closes a link as `ESC ]8` does,
and every other 8-bit string escape is silent, payload and all. In either form a
string runs to its terminator, the end of its line, or an `ESC` or C1 control,
which ends it and then acts as itself, as in those terminals' parser. A CAN
(`\x18`) or SUB (`\x1a`) abandons a string, a CSI or any other escape it lands
in, and what follows draws as text. Any other C0 control inside a CSI or an escape runs where it
stands and the sequence goes on past it, as a VT500 parser does: `\x1b[3\r1m` returns
to the first column and then sets SGR 31, and a line break there ends the line and the
sequence finishes on the next. A DEL there does nothing. The next `ESC` or C1 control
cancels the sequence, so `\x1b[31\x1bm` sets no color. `ESC E`
ends a line as NEL does, and so does CNL (`\x1b[nE`), once whatever its count.
On a terminal CNL passes `n` rows, or none on the bottom row, where it does not
scroll; the decoder holds no cursor row and no screen height, so it keeps only
that what follows is on a line of its own. CPL (`\x1b[nF`) goes up to a line
already decoded, and is dropped with the other vertical moves.

A cursor save — DECSC `\x1b7`, or SCOSC `\x1b[s` — holds the column, the
style and the character sets. A restore (`\x1b8`, `\x1b[u`) on the save's line
brings them back, so the status `tput sc` and `tput rc` frame is overwritten as
it is on screen. Anywhere else a terminal moves the cursor to another row — up
to the saved one, or home when nothing is saved — and the decoder holds no row:
it brings back the style and the sets and keeps the column, so the text after
it lands where it does not on screen. A docs example that writes such a restore
runs in a live terminal. With parameters the same finals are other escapes —
`\x1b[1;5s` sets DECSLRM's margins and `\x1b[?u` is kitty's keyboard protocol —
so the decoder drops both. It holds no modes, so a bare `\x1b[s` is a save even
under DECLRMM, where a terminal reads it as a margin reset. Either reset forgets
the save.

A C1 control in text is often a Windows-1252 byte decoded as Latin-1: `\x85` was
meant as `…`. Telling that from a planted sequence takes the whole string, so
repairing it is the caller's to do before the text reaches `RichText` or
`decodeAnsi`, which reads a stray `›` or `ž` as the sequence a terminal reading
C1 would, and hides what that terminal hides.

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

A terminal cell holds one style, so a style cannot change inside a sequence: a span
that starts or ends inside one is taken to the sequence's end, and the whole sequence
is drawn in the styles covering its first character. A flag styled from its second
character keeps its tags and is drawn as one flag.

Segments that meet on a row were each measured alone. A combining mark, selector or
joiner of no cells that opens a segment after a glyph on its row would extend that
glyph, and a joiner that ends one would join the next, so neither is written. A
spacing mark, a Hangul vowel or a virama's conjunct still forms against its
neighbour, at the width each was measured.

A Prepend character — the Arabic number sign U+0600, the Syriac abbreviation mark
U+070F, the Malayalam dot reph U+0D4E, the rest of Unicode's grapheme-break class —
joins whatever follows it into one cluster, and a terminal that clusters draws that
cluster in one cell. Rich's width gives the Prepend a cell of its own, so before a
base character the library does too: it is its own cluster to every cut, caret step
and reordering. On a terminal a WORD JOINER (U+2060), which takes no cell and ends a
cluster, is written after it there and wherever a write ends on it, since the next
write may continue the line. Off one — a pipe, a file, `exportText`, `exportHtml`,
`exportSvg`, `renderToString` — nothing is added, since those bytes are text a reader
keeps. A number sign typed before a caret, a blank or a letter in another
style keeps its cell, and the row its width. A mark of no cells on a Prepend stays in
its cluster, one cell to both.

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
