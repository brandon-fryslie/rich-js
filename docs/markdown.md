# Markdown

`Markdown` renders Markdown-formatted text in the terminal with styled headings, lists, emphasis, quotes, tables, rules and code blocks.

## Basic usage

```typescript
import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console();

const md = new Markdown(`# Hello, World!

This is **bold**, this is *italic*, and this is \`inline code\`.

> A quote is set off by a bar in the margin.

## A List

- Item one
- Item two
  - Nested item
- Item three

## Code

\`\`\`typescript
const greeting = (name: string) => \`Hello, \${name}!\`;
console.log(greeting("World"));
\`\`\`

---`);

console.print(md);
```

## Block structure

Blocks are read as [CommonMark](https://spec.commonmark.org/) reads them. A list item, like a
quote, holds blocks of its own — paragraphs, fenced code, quotes, nested lists — indented to
the column its text starts at, and draws them under its hang. A nested list's marker sits at
its parent's text column or up to three columns past it; four or more past it, and the marker
is text — continuing the parent's paragraph, or indented code after a blank line. Markers are
drawn as Rich draws them: a bullet in `markdown.item.bullet`, bold, and a number without its
`.` or `)` in `markdown.item.number`, cyan. A numbered list counts on from its first number, right-aligned in
a column as wide as the number one past its last item, Rich's sizing, so every item hangs at
one column; an empty item is counted and draws nothing. The item's blocks are drawn in
`markdown.item`, which the default theme leaves plain. A quote draws a `▌` bar down its left
side in `markdown.block_quote`, magenta, and lays that style under everything it holds, as
Rich's does; a block inside it that has a style of its own, code or a rule, draws in that.
Tabs in the indentation reach the stops of 4 they reach in the source, however deep the line
is nested.
Blocks nest only as deep as markdown-it reads them, 20 levels — a quote counts one, a list and
its item one each. Past that a container's content is not drawn, and a list item that deep
with text in it takes every line after it, to the end of the quote or document it sits in.

An HTML block — a line opening with `<div>`, `<!--`, `<pre>` or another of CommonMark's
HTML block starts — is read where markdown-it reads one and drawn as Rich draws it: not at all.
It ends the paragraph or table above it, as a heading does; a lone tag of any other name, such
as `<span>`, does not, and is that paragraph's inline HTML instead. Inline HTML — a tag, a
comment, a processing instruction, a declaration or a CDATA section inside text — is not drawn
either. A backslash before a punctuation character writes that character as itself, so `\<span>`
draws `<span>`. A character reference — `&amp;`, `&#65;`, `&#x41;` — draws the character it
names, in text and in a link's URL, but not in a code span, an autolink or an image's alt text;
a name HTML does not have is drawn as written. The two places read a numeric one as markdown-it
does, differently: text takes up to seven decimal digits or six hex and draws `�` for a code
that is no character — `&#0;`, a surrogate, a control, past U+10FFFF — where a URL takes up to
eight digits of either base and leaves that code as written.

Emphasis is paired as markdown-it pairs it and drawn in `markdown.em`, italic, and
`markdown.strong`, bold. Rich turns on GFM's strikethrough, so `~~text~~` is drawn in
`markdown.s`, struck through; a single `~` strikes nothing.

An image is drawn as Rich draws it: a picture glyph, then its alt text as written, never parsed
as Markdown, linked to the link it sits in or else to the image. It is drawn ahead of the block
it sits in, not where it sits — ahead of the whole list, quote or table that holds it — and the
block carries on along the image's row, its text keeping the spaces that stood either side of
the image.
An autolink — `<https://example.com>`, or `<name@example.com>`, which links to
`mailto:name@example.com` — is drawn as a link whose text is the address as written, its escapes
decoded for reading. Every link's URL is made an href as markdown-it makes one: the host punycoded
after a lowercase `http:`, `https:` or `mailto:`, or after a bare `//`, and the rest
percent-encoded. A `javascript:`, `vbscript:`
or `file:` URL, or a `data:` one that is not an image, is no link, and its source is drawn as
written. A link whose text holds another link is no link, as markdown-it refuses it, so only the
inner one links; an image's alt text may hold one.

A reference link — `[text][label]`, `[label][]` or `[label]`, and an image written the same way
after its `!` — links to the URL its label's definition gives: a line `[label]: url "title"`
anywhere in the document, a quote or a list item included, which draws nothing. Labels match as
markdown-it matches them — stripped, each run of whitespace one space, case-folded — so
`[Foo  Bar][]` finds `[foo bar]: /url`, and the first definition of a label wins. A definition
cannot interrupt a paragraph, so a line of one under paragraph text is that text; brackets whose
label nothing defines are drawn as written.

## Tables

A pipe table is read as Rich reads one, with [markdown-it](https://github.com/markdown-it/markdown-it)'s
take on [GitHub's table extension](https://github.github.com/gfm/#tables-extension-), and drawn
as Rich draws it, as a [`Table`](./tables). The two parsers part on where a table may start:
markdown-it tries a header row before any other block, so `# Name | Size` over a delimiter row
is a table's header where GitHub draws a heading. The header row is drawn in
`markdown.table.header`, the borders in `markdown.table.border`, and each cell's inline
Markdown kept. A colon in the delimiter row places the column's cells — `:---` left, `:---:`
centred, `---:` right. A short row is filled out with empty cells and a long one is cut to
the header's columns; `\|` puts a pipe inside a cell.

```typescript
import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console({ width: 48 });

console.print(new Markdown(`| Subpath | Installs | Size |
|:--------|:--------:|-----:|
| \`./widgets\` | **mobx** | 41 kB |
| \`./host\` | nothing | 9 kB |`));
```

## Code blocks

A fenced code block opens on three or more backticks or tildes and closes on a run of the
same character at least as long; left unclosed, it runs to the end of the document, or of
the quote or list item it sits in. It is drawn as Rich draws one: its trailing whitespace
dropped, its tabs set at stops of four, each line wrapped at its words — its indentation kept
on its first row, not on the rows it wraps onto — inside a padding of one cell on every side,
every cell of it in the `markdown.code` style, bold cyan on a dark background. At sixteen colours code is drawn bold in the
terminal's own colours instead, since no fixed background reads in every terminal theme
there. The language tag after the opening fence is read
but not used: `Markdown` does no per-language highlighting. For highlighted code, render
it with [`Syntax`](./syntax) instead.

## Options

| Option | Default | Effect |
|--------|---------|--------|
| `inlineCodeStyle` | `"markdown.code"` | The style of `` `inline code` ``: a theme name, a style definition such as `"bold magenta"`, or a `Style` |
| `hyperlinks` | `true` | A link's text is the link, drawn in `markdown.link_url`. With `false` the text is drawn plain in `markdown.link`, its own styles dropped, and the URL is written after it in parentheses, for a reader who cannot click it |
| `justify` | `"left"` | Where paragraphs, list items and quoted text sit in the width: `"left"`, `"center"`, `"right"` or `"full"`. Headings keep their own placement, as Rich's do: an h1 is centred and every other level is left |

```typescript
import { Console, Markdown } from "@promptctl/rich-js";

const console = new Console({ width: 40 });

console.print(new Markdown("Read [the guide](https://example.com), then run `npm test`.", {
  hyperlinks: false,
  inlineCodeStyle: "bold magenta",
}));
```

## Rendering a Markdown file

The most common real-world pattern — read a Markdown file from disk and render it:

```typescript node
import { Console, Markdown } from "@promptctl/rich-js";
import { readFileSync } from "fs";

const console = new Console();
const md = new Markdown(readFileSync("README.md", "utf-8"));
console.print(md);
```
