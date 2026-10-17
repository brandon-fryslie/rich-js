/**
 * Markdown's parse, with no dependency: a source read into blocks, then the
 * text of each block read into inlines — the two passes markdown-it, Rich's
 * parser, makes. Nothing here reads a `RenderOptions`, so a `Markdown` parses
 * its source once, when it is made, as Rich's does, and every render after
 * only walks the tokens.
 *
 * Block structure is read as CommonMark reads it: a blockquote and a list
 * item are both containers, their lines tokenized as Markdown of their own
 * once the container's marker or indentation is cut off. A table, which
 * CommonMark has none of, and an HTML block are read as markdown-it reads
 * them.
 */

import { linkHref, normalizeLinkText } from "./markdown-url.js";
import { PY_WHITESPACE, pyStrip } from "./python-space.js";
import { namedReference } from "./html-entities.js";

/** Where a table column's cells sit, from the colons on its delimiter cell. None is GFM's no alignment, which Rich leaves to its column: left. */
export type CellAlign = "left" | "center" | "right" | undefined;

interface TableColumn<Text> {
  readonly header: Text;
  readonly align: CellAlign;
}

/**
 * A block, its text as `Text`: the source's own text after the block pass,
 * and that text read into inlines after the inline pass, which is what
 * `parseMarkdown` hands back. `Mark` is what the block pass keeps besides:
 * none, once the inline pass has dropped its marks.
 */
export type MdToken<Text = readonly Inline[], Mark = never> =
  | { type: "heading"; level: number; text: Text }
  | { type: "paragraph"; text: Text }
  | { type: "code_block"; code: string }
  | { type: "hr" }
  /** `start` is an ordered list's first number, as its source writes it; a bullet list has none. Each item is its blocks. */
  | { type: "list"; start: number | undefined; items: readonly (readonly MdToken<Text, Mark>[])[] }
  | { type: "blockquote"; children: readonly MdToken<Text, Mark>[] }
  /** Each row holds one cell per column: a short row filled out with empty cells, a long one cut. */
  | { type: "table"; columns: readonly TableColumn<Text>[]; rows: readonly (readonly Text[])[] }
  /** Kept, though nothing draws it, as Rich exits it like any other block. */
  | { type: "html_block" }
  | Mark;

/**
 * What the block pass keeps that markdown-it makes no token of; the inline
 * pass drops each.
 */
type BlockMark =
  /**
   * A container's content past `MAX_NESTING`, which markdown-it skips unread,
   * or the lines after a list whose item that deep took every one of them —
   * kept so the item holding that list takes them too.
   */
  | { type: "unread" }
  /**
   * A link reference definition (CommonMark 4.7), drawn as nothing: `label`
   * as `normalizeReference` makes it, and the href it defines. markdown-it
   * keeps them in its `env` instead; `definitionsIn` reads them back out.
   */
  | { type: "definition"; label: string; url: string };

/** A block as the block pass reads it. */
type Block = MdToken<string, BlockMark>;

/** The element markdown-it makes of a pair of delimiters. */
type EmphasisTag = "em" | "strong" | "s";

/**
 * CommonMark's inlines, as one block's text reads: a code span, emphasis or a
 * link holding inlines of its own, an autolink, an image, inline HTML, a line
 * ending, and text — a backslash escape and a character reference already the
 * characters they stand for. Emphasis is named by the element markdown-it
 * makes of it, GFM's strikethrough `s` among them.
 */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; code: string }
  | { kind: "emphasis"; tag: EmphasisTag; children: readonly Inline[] }
  | { kind: "link"; children: readonly Inline[]; url: string }
  /** `text` is the URL as written, normalized as markdown-it shows it, never read as Markdown. */
  | { kind: "autolink"; text: string; url: string }
  /** `alt` is as written, never read as Markdown. */
  | { kind: "image"; alt: string; src: string }
  | { kind: "html" }
  /** markdown-it's `softbreak` and `hardbreak`: tokens of their own, never joined to the text beside them. */
  | { kind: "softbreak" }
  | { kind: "hardbreak" };

/**
 * A source line inside the container that holds it: the line as written, with
 * every container marker it sat behind blanked to spaces so its columns are
 * still the source's, and `margin`, the column its container's content starts
 * at. Columns are counted from the source's column 0, so a tab reaches the
 * stop it reaches in the source however deep the line is nested. A `lazy`
 * line was taken in short of its container's marker or indentation, as a
 * lazy continuation line: it continues a paragraph or a definition open
 * before it, and where none is, the container ends at it.
 */
interface Line {
  readonly text: string;
  readonly margin: number;
  readonly lazy: boolean;
}

/**
 * A container's lines, each made the first time its block pass reads it, as
 * markdown-it's block pass reads a container's lines in place. A container
 * costs the lines its block pass reads, not every line it might take: a quote
 * whose block pass stops at the first lazy continuation line it does not take
 * reads that line, not the rest of the document after it.
 */
class Lines {
  private readonly made: Line[] = [];

  constructor(private readonly source: Iterator<Line, unknown>) {}

  /** The line at `i`, or nothing where the container ends before it. */
  at(i: number): Line | undefined {
    while (this.made.length <= i) {
      const next = this.source.next();
      if (next.done) return undefined;
      this.made.push(next.value);
    }
    return this.made[i];
  }

  /** The lines from `start` up to `end`. */
  slice(start: number, end: number): Line[] {
    this.at(end - 1);
    return this.made.slice(start, end);
  }

  /** How many lines the container holds, every one of them made. */
  count(): number {
    while (this.at(this.made.length) !== undefined);
    return this.made.length;
  }
}

/** An ATX heading's opening: one to six `#`, then a space, a tab or the end of the line. */
const HEADING = /^#{1,6}(?=[ \t]|$)/;
/**
 * An ATX heading's closing sequence, as markdown-it cuts one: a run of `#` at
 * the end of the line, spaces and tabs after it allowed, with a space or tab
 * before it — so `# x#` keeps its `#` and `# #` is an empty heading.
 */
const HEADING_CLOSE = /(?<=[ \t])#+[ \t]*$/;
/** A thematic break: three or more of one of `*`, `-` or `_`, spaces and tabs between them allowed. */
const RULE = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const SETEXT = /^(=+|-+)[ \t]*$/;
/**
 * A code fence's opening, as markdown-it's fence rule reads one: three or more
 * backticks, the info string after them holding no backtick, or three or more
 * tildes, the info string free to hold anything. The run is captured whole, so
 * its closing can be read off it.
 */
const FENCE = /^(`{3,}(?=[^`]*$)|~{3,})/;
const QUOTE = /^>/;
const ITEM_MARKER = /^(?:[*+-]|(\d{1,9})[.)])/;
/**
 * A line's leading space and tab: CommonMark's whitespace, and the only
 * whitespace markdown-it's block pass reads — what indents a line, what makes
 * one blank. A no-break space or any other Unicode space is text to it.
 */
const LEAD = /^[ \t]*/;
const BLOCK_STARTS = [HEADING, FENCE, QUOTE, RULE];
/** A line that may be a table's delimiter row, screened as markdown-it screens one: pipes, dashes, colons and space only, and not a dash then a space, which opens a list item. */
const DELIMITER_ROW = /^(?!-[ \t])[-:|][-:| \t]+$/;
const DELIMITER_CELL = /^:?-+:?$/;
/**
 * How many empty cells a table's short rows may be filled out with before the
 * table ends, as markdown-it caps them: a header of many columns over many
 * one-cell rows would otherwise grow a few kilobytes of source into millions of cells.
 */
const MAX_AUTOCOMPLETED_CELLS = 0x10000;
/** Indentation that makes a line indented code when it opens a block, as CommonMark counts it. */
const CODE_INDENT = 4;
/**
 * markdown-it's `maxNesting`, 20 in the commonmark preset Rich parses with: how
 * deep its blocks nest — a quote one level, a list and its item one each —
 * and how deep it follows a link label holding a bracket holding another.
 * Past it the block parser reads nothing more of a container, and the label
 * scan stops looking, so neither pass recurses further however deep the
 * source goes.
 */
const MAX_NESTING = 20;

/**
 * One of CommonMark's seven kinds of HTML block (4.6), as markdown-it-py —
 * the markdown-it Rich runs — matches it: the line that opens one, where it
 * ends, and whether it may interrupt a paragraph, which the seventh, a lone
 * tag of any name, may not. The first five end on the line that closes them,
 * kept in the block; the last two at a blank line, left to what follows.
 */
interface HtmlBlockKind {
  readonly start: RegExp;
  readonly end: RegExp | "blank";
  readonly interrupts: boolean;
}

/** The block-level element names an HTML block of the sixth kind opens with, as markdown-it-py lists them. */
const HTML_BLOCK_NAMES =
  "address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|" +
  "fieldset|figcaption|figure|footer|form|frame|frameset|h1|h2|h3|h4|h5|h6|head|header|hr|html|iframe|legend|li|link|" +
  "main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|" +
  "title|tr|track|ul";
// The tag grammar of markdown-it-py's common/html_re, shared by the HTML block a lone tag opens and the inline HTML it reads in text.
const HTML_ATTRIBUTE = String.raw`(?:${PY_WHITESPACE}+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:${PY_WHITESPACE}*=${PY_WHITESPACE}*(?:[^"'=<>\`\x00-\x20]+|'[^']*'|"[^"]*"))?)`;
const HTML_OPEN_TAG = String.raw`<[A-Za-z][A-Za-z0-9-]*${HTML_ATTRIBUTE}*${PY_WHITESPACE}*\/?>`;
const HTML_CLOSE_TAG = String.raw`<\/[A-Za-z][A-Za-z0-9-]*${PY_WHITESPACE}*>`;
const HTML_BLOCKS: readonly HtmlBlockKind[] = [
  { start: new RegExp(String.raw`^<(?:script|pre|style|textarea)(?=${PY_WHITESPACE}|>|$)`, "i"), end: /<\/(?:script|pre|style|textarea)>/i, interrupts: true },
  { start: /^<!--/, end: /-->/, interrupts: true },
  { start: /^<\?/, end: /\?>/, interrupts: true },
  // Uppercase only, as markdown-it-py has it, where markdown-it in JS and CommonMark 0.31 take `<!doctype` too.
  { start: /^<![A-Z]/, end: />/, interrupts: true },
  { start: /^<!\[CDATA\[/, end: /\]\]>/, interrupts: true },
  { start: new RegExp(String.raw`^<\/?(?:${HTML_BLOCK_NAMES})(?=${PY_WHITESPACE}|\/?>|$)`, "i"), end: "blank", interrupts: true },
  {
    start: new RegExp(String.raw`^(?:${HTML_OPEN_TAG}|${HTML_CLOSE_TAG})${PY_WHITESPACE}*$`),
    end: "blank",
    interrupts: false,
  },
];

/** The column `ws` ends at when it starts at column `from`, a tab reaching the next stop of 4 as CommonMark counts it. */
function advance(from: number, ws: string): number {
  return [...ws].reduce((col, ch) => (ch === "\t" ? col + 4 - (col % 4) : col + 1), from);
}

/** The column `line`'s leading whitespace ends at. */
function leadEnd(line: Line): number {
  return advance(0, LEAD.exec(line.text)![0]);
}

/** How far `line` is indented inside its container. */
function indentOf(line: Line): number {
  return Math.max(0, leadEnd(line) - line.margin);
}

/** `line` from its first character that is not leading whitespace. */
function body(line: Line): string {
  return line.text.slice(LEAD.exec(line.text)![0].length);
}

function isBlank(line: Line): boolean {
  return body(line) === "";
}

/** Whether `line` sits less than a code indent into its container and its text matches `re`. */
function startsWith(line: Line, re: RegExp): boolean {
  return indentOf(line) < CODE_INDENT && re.test(body(line));
}

/**
 * `line` from `n` columns into its container on: a block's own indentation
 * cut off, the rest as written. A tab straddling the cut leaves the columns
 * past it as spaces.
 */
function dropColumns(line: Line, n: number): string {
  const to = line.margin + n;
  let col = 0;
  let i = 0;
  for (; i < line.text.length && col < to && (line.text[i] === " " || line.text[i] === "\t"); i++) {
    const next = advance(col, line.text[i]!);
    if (next > to) return " ".repeat(next - to) + line.text.slice(i + 1);
    col = next;
  }
  return line.text.slice(i);
}

/**
 * A list item's opening line, read as CommonMark reads it: a bullet or a
 * number at most three columns in, not a thematic break. `content` is the
 * item's content column — where its text starts, and how far every line of
 * the item is indented — and `first` is the marker line as a line of the
 * item, absent when the item opens with a blank line. An item opening with a
 * blank line, or with indented code, has its content column one space past
 * the marker. `marker` is CommonMark's two kinds: a bullet, or an ordered
 * item's number and the delimiter that closes it, `.` or `)`.
 */
interface ItemStart {
  readonly marker: { readonly bullet: string } | { readonly delimiter: string; readonly start: number };
  readonly content: number;
  readonly first: Line | undefined;
}

function itemStart(line: Line): ItemStart | undefined {
  const text = body(line);
  const m = ITEM_MARKER.exec(text);
  if (!m || indentOf(line) >= CODE_INDENT || RULE.test(text)) return undefined;
  const after = text.slice(m[0].length);
  const spacing = LEAD.exec(after)![0];
  const rest = after.slice(spacing.length);
  if (spacing === "" && rest !== "") return undefined;
  const markerEnd = leadEnd(line) + m[0].length;
  const spaced = advance(markerEnd, spacing) - markerEnd;
  const content = rest === "" || spaced > CODE_INDENT ? markerEnd + 1 : markerEnd + spaced;
  const lead = line.text.slice(0, line.text.length - text.length);
  return {
    marker: m[1] === undefined ? { bullet: m[0] } : { delimiter: m[0].slice(-1), start: parseInt(m[1], 10) },
    content,
    first: rest === "" ? undefined : { text: lead + " ".repeat(m[0].length) + after, margin: content, lazy: false },
  };
}

/** Whether `line` may be a table's row: a line of its container's own, neither lazy paragraph text nor indented code. */
function tableLine(line: Line): boolean {
  return !line.lazy && indentOf(line) < CODE_INDENT;
}

/**
 * A table row's cells, as markdown-it splits one: at every `|` no backslash escapes,
 * a pipe at either end of the row closing it rather than opening an empty
 * cell, and the row and each cell stripped. An escaped `\|` is a `|` in its cell, inside a
 * code span too.
 */
function rowCells(row: string): string[] {
  const cells = [""];
  for (const ch of pyStrip(row)) {
    const last = cells.length - 1;
    if (ch !== "|") cells[last] += ch;
    else if (cells[last]!.endsWith("\\")) cells[last] = `${cells[last]!.slice(0, -1)}|`;
    else cells.push("");
  }
  const from = cells[0] === "" ? 1 : 0;
  const to = cells.length > from && cells[cells.length - 1] === "" ? -1 : undefined;
  return cells.slice(from, to).map(pyStrip);
}

/** The alignment of each column `line` declares, if it is a table's delimiter row: a run of dashes per column, a colon on the side its cells sit. */
function alignments(line: Line): CellAlign[] | undefined {
  const text = body(line);
  if (!tableLine(line) || !DELIMITER_ROW.test(text)) return undefined;
  const cells = rowCells(text);
  if (!cells.every((cell) => DELIMITER_CELL.test(cell))) return undefined;
  return cells.map((cell) => (cell.endsWith(":") ? (cell.startsWith(":") ? "center" : "right") : cell.startsWith(":") ? "left" : undefined));
}

/**
 * The columns of the table opening at `start`, if one does, as markdown-it
 * reads one: a header row with a pipe in it, then a delimiter row naming as
 * many columns.
 */
function tableAt(lines: Lines, start: number): TableColumn<string>[] | undefined {
  const head = lines.at(start)!;
  const delimiter = lines.at(start + 1);
  if (delimiter === undefined || !tableLine(head) || !body(head).includes("|")) return undefined;
  const aligns = alignments(delimiter);
  if (!aligns) return undefined;
  const headers = rowCells(body(head));
  return headers.length === aligns.length ? headers.map((header, n) => ({ header, align: aligns[n] })) : undefined;
}

/**
 * Whether two item starts belong to one list: the same bullet, or numbers with
 * the same delimiter — markdown-it's marker character, the two kinds' characters
 * never coinciding.
 */
function sameList(a: ItemStart, b: ItemStart): boolean {
  const markerChar = ({ marker }: ItemStart) => ("bullet" in marker ? marker.bullet : marker.delimiter);
  return markerChar(a) === markerChar(b);
}

/**
 * A `>` line as a line of its quote: the marker blanked, and the quote's
 * content starting past it and the one column of space that may follow it —
 * one column of a tab, when a tab follows it.
 */
function quoted(line: Line): Line {
  const at = line.text.length - body(line).length;
  const spaced = /[ \t]/.test(line.text[at + 1] ?? "");
  return { text: `${line.text.slice(0, at)} ${line.text.slice(at + 1)}`, margin: leadEnd(line) + 1 + (spaced ? 1 : 0), lazy: false };
}

/** The kind of HTML block `line` opens, if it opens one: the first kind whose opening it matches, as markdown-it tries them in order. */
function htmlBlockAt(line: Line): HtmlBlockKind | undefined {
  return HTML_BLOCKS.find((kind) => startsWith(line, kind.start));
}

/**
 * Whether `line` opens a block of its own that may cut short the block before
 * it — a heading, a fence, a quote, a rule, a list item or an HTML block of
 * any kind but a lone tag. A line that does not is text, and under an open
 * paragraph it continues that paragraph.
 */
function opensBlock(line: Line): boolean {
  return BLOCK_STARTS.some((re) => startsWith(line, re)) || itemStart(line) !== undefined || htmlBlockAt(line)?.interrupts === true;
}

/**
 * Whether `line` ends a paragraph: `opensBlock`, read as CommonMark reads it
 * under a paragraph. Indented code cannot interrupt one; a list item does only
 * when it has text and, numbered, counts from 1, so prose wrapped onto "2024.
 * That year" stays prose; and a line of `=` or `-` is the paragraph's heading
 * underline.
 */
function endsParagraph(line: Line): boolean {
  if (underline(line)) return true;
  const item = itemStart(line);
  return item ? item.first !== undefined && ("bullet" in item.marker || item.marker.start === 1) : opensBlock(line);
}

/** The setext underline `line` is — a line of `=` or `-` under a paragraph — if it is one. A lazy line never is. */
function underline(line: Line | undefined): RegExpExecArray | null {
  return line && !line.lazy && indentOf(line) < CODE_INDENT ? SETEXT.exec(body(line)) : null;
}

/**
 * Whether `line` has text and opens no block of its own: what a container
 * takes short of its marker or indentation as a lazy continuation line, and
 * what a definition reads on through, as markdown-it's `getNextLine` hands one
 * over. A line outside a container is read without the paragraph under it, so
 * any list item — whatever it counts from — ends the container rather than
 * continuing it. Whether a paragraph or a definition open before a lazy line
 * takes it is the container's own block pass to find, which ends the
 * container where neither does.
 */
function continuesText(line: Line): boolean {
  return !isBlank(line) && !opensBlock(line);
}

/**
 * The text of the paragraph begun at `start`, every line after it up to a
 * blank, a line that ends a paragraph or a table's header row, and the index of the line that ended
 * it. The lines are joined at their line endings as written, each cut only
 * to its container's margin, as markdown-it's `getLines` cuts paragraph
 * content: the indentation past it is the inline pass's to read, which drops
 * it after a line ending and keeps it in a code span, as is whether a line
 * ending breaks soft or hard, since an escape or a code span decides it.
 */
function continuation(lines: Lines, start: number): { text: string; next: number } {
  let i = start + 1;
  for (let line = lines.at(i); line !== undefined && !isBlank(line) && !endsParagraph(line) && !tableAt(lines, i); line = lines.at(++i));
  return { text: pyStrip(lines.slice(start, i).map((line) => dropColumns(line, 0)).join("\n")), next: i };
}

/**
 * markdown-it's `normalizeReference`, which makes a definition's label and a
 * reference's the same key where CommonMark matches them: stripped, each run
 * of whitespace one space, as Python reads whitespace, then case-folded as
 * `lower().upper()` folds it.
 */
function normalizeReference(label: string): string {
  return pyStrip(label).replace(WHITESPACE_RUN, " ").toLowerCase().toUpperCase();
}

const WHITESPACE_RUN = new RegExp(`${PY_WHITESPACE}+`, "g");

/**
 * The link reference definition opening at `start`, if one does, as
 * markdown-it's reference rule reads it: `[label]:`, space, a destination, and
 * a title only if space came before it, each of them free to run onto the
 * lines after it that `getNextLine` hands over — up to a blank line, or a line
 * that opens a block of its own. The title and the space after it must end
 * the line; where a title is followed by more, the definition is read again
 * without it, ending with its destination's line. `next` is the index of the
 * line after it.
 */
function definitionAt(lines: Lines, start: number): { label: string; url: string; next: number } | undefined {
  if (!body(lines.at(start)!).startsWith("[")) return undefined;
  // The definition's text so far, each line from its first character that is
  // not leading whitespace and ended by its line ending. markdown-it takes a
  // line on only as a read reaches the end of the last; this takes them on in
  // runs that double, which changes no read but the destination's — every
  // other read that reaches the end takes more on — and copies the text of a
  // definition running over n lines log n times rather than n.
  let text = `${body(lines.at(start)!)}\n`;
  let taken = start + 1;
  let run = 1;
  const takeLines = (): string => {
    const more: string[] = [];
    for (; more.length < run && continuesDefinition(lines, taken); taken++) more.push(`${body(lines.at(taken)!)}\n`);
    run *= 2;
    return (text += more.join(""));
  };
  // markdown-it's space between the parts: spaces and tabs, and line endings, taking lines on at each.
  const spaceEnd = (from: number): number => {
    let i = from;
    for (; i < text.length && (text[i] === " " || text[i] === "\t" || text[i] === "\n"); i++) if (i === text.length - 1) takeLines();
    return i;
  };

  // The label: up to the first `]` no backslash escapes, with no `[` in it.
  let labelEnd = 1;
  for (; labelEnd < text.length && text[labelEnd] !== "]"; labelEnd++) {
    if (text[labelEnd] === "[") return undefined;
    if (text[labelEnd] === "\\") labelEnd++;
    if (labelEnd === text.length - 1) takeLines();
  }
  if (text[labelEnd + 1] !== ":") return undefined;

  const destinationStart = spaceEnd(labelEnd + 2);
  // markdown-it reads the destination in the text it holds, which ends with the destination's own line.
  const held = text.slice(0, text.indexOf("\n", destinationStart) + 1);
  const destination = destinationAt(held, destinationStart);
  // An empty destination outside angle brackets is none, as markdown-it's `parseLinkDestination` reads it.
  if (destination === undefined || destination.end === destinationStart) return undefined;
  const url = linkHref(unescapeAll(destination.raw));
  if (url === undefined) return undefined;

  // The line ending the definition ends at.
  let end = held.length - 1;
  // A destination that took its line's ending, behind a backslash, ends the
  // definition at it: markdown-it holds no text past it to read a title in.
  if (destination.end < held.length) {
    const titleStart = spaceEnd(destination.end);
    const title = titleStart > destination.end ? titleAt(text, titleStart, takeLines) : undefined;
    // The definition ends at its line's end, past the spaces and tabs there.
    const lineEnd = (from: number): number => from + matchAt(LINE_INDENT, text, from)![0].length;
    end = lineEnd(title?.end ?? destination.end);
    // markdown-it gives up only a title with text in it for what follows it on its line, so an empty one followed by more ends no definition.
    if (text[end] !== "\n" && title?.text === true) end = lineEnd(destination.end);
    if (text[end] !== "\n") return undefined;
  }

  const label = normalizeReference(text.slice(1, labelEnd));
  if (label === "") return undefined;
  // The line after it: one past the line its end is on.
  let next = start + 1;
  for (let i = text.indexOf("\n"); i < end; i = text.indexOf("\n", i + 1)) next++;
  return { label, url, next };
}

/**
 * Whether the line at `at` continues a definition, as markdown-it's
 * `getNextLine` hands one over: text, and not a table's header row.
 */
function continuesDefinition(lines: Lines, at: number): boolean {
  const line = lines.at(at);
  return line !== undefined && continuesText(line) && !tableAt(lines, at);
}

/** The character that closes a link title, by the one that opens it. */
const TITLE_CLOSE: Readonly<Record<string, string>> = { '"': '"', "'": "'", "(": ")" };

/**
 * The link title opening at `start` in `text`, as markdown-it's
 * `parseLinkTitle` reads one in a definition: in `"`, `'` or `(…)`, a
 * backslash taking the character after it and a `(` refusing a `(…)` title,
 * reading on to the lines `takeLines` takes on — handing back the text grown
 * by them, or as it was where it takes none — until it closes. `end` is the
 * index past it, and `text` whether it holds any.
 */
function titleAt(text: string, start: number, takeLines: () => string): { end: number; text: boolean } | undefined {
  const close = TITLE_CLOSE[text[start]!];
  if (close === undefined) return undefined;
  for (let i = start + 1; ; i++) {
    if (i === text.length) text = takeLines();
    if (i === text.length) return undefined;
    if (text[i] === close) return { end: i + 1, text: i > start + 1 };
    if (text[i] === "(" && close === ")") return undefined;
    if (text[i] === "\\") i++;
  }
}

/**
 * The lines of the list item opened at `start`: its first line's text, then
 * every line after it indented to the content column, each line with text in
 * it short of that a lazy continuation line, and each blank line with a line
 * indented to the content column after it. Blank lines trailing the item are
 * left to whatever follows it, and an item that opens with a blank line ends
 * at the next one: it is empty.
 */
function* itemLines(item: ItemStart, lines: Lines, start: number): Generator<Line> {
  const held = (line: Line): boolean => !line.lazy && leadEnd(line) >= item.content;
  const inItem = (line: Line): Line => ({ text: line.text, margin: item.content, lazy: false });
  // Whether the item holds a line with text yet, which a blank line or a lazy one must come after.
  let text = item.first !== undefined;
  if (item.first !== undefined) yield item.first;
  for (let i = start + 1; ; i++) {
    let line = lines.at(i);
    let after = i;
    while (line !== undefined && isBlank(line)) line = lines.at(++after);
    if (line === undefined || (after > i && !(text && held(line)))) return;
    for (; i < after; i++) yield inItem(lines.at(i)!);
    if (held(line)) yield inItem(line);
    else if (text && continuesText(line)) yield { ...line, lazy: true };
    else return;
    text = true;
  }
}

/**
 * The lines of the quote opening at `start`: its `>` lines with the marker
 * blanked, and each unmarked line after one with text a lazy continuation line.
 * markdown-it's quote takes a `>` line after its first however far it is
 * indented. A line already lazy where the quote sits is short of its
 * container's indentation, so the quote reads it as markdown-it does, indented
 * less than any block: never a `>` line of its own, and opening whatever block
 * its text starts, however far it is indented.
 */
function* quoteLines(lines: Lines, start: number): Generator<Line> {
  // Whether the line before has text, which a lazy line must come after.
  let text = false;
  for (let j = start, line = lines.at(j); line !== undefined; line = lines.at(++j)) {
    if (!line.lazy && QUOTE.test(body(line))) {
      const inQuote = quoted(line);
      text = !isBlank(inQuote);
      yield inQuote;
    } else if (text && continuesText(line.lazy ? { ...line, margin: leadEnd(line) } : line)) yield { ...line, lazy: true };
    else return;
  }
}

/**
 * The list item opened at `start`, at `level`: its blocks, read from its
 * lines up to where its own block pass stops — and the index of the line
 * that ended it.
 */
function listItem(item: ItemStart, level: number, lines: Lines, start: number): { children: Block[]; next: number } {
  const { tokens, end } = tokenize(new Lines(itemLines(item, lines, start)), level);
  // An item with no text on its first line holds its lines from the line after it.
  return { children: tokens, next: (item.first === undefined ? start + 1 : start) + end };
}

/**
 * The line that closes the fence opened by the run `open`: a run of the same
 * marker at least as long, then nothing but spaces and tabs.
 */
function closingFence(open: string): RegExp {
  return new RegExp(`^${open}${open[0]}*[ \\t]*$`);
}

/**
 * Whether a list item holding `children` swallows the rest of the lines its
 * list sits in, as markdown-it's does when its content is past `MAX_NESTING`:
 * an item's block pass is handed every line to the end of the enclosing quote
 * or document and stops at the first line short of its indentation, and the
 * pass that skips unread content skips to that end. An item whose last block
 * is a list that swallowed them ends in the `unread` that list leaves, and so
 * swallows them too.
 */
function swallowsRest(children: readonly Block[]): boolean {
  return children[children.length - 1]?.type === "unread";
}

/**
 * The list opened at `start`, at `level`: each item holding its blocks — and,
 * where an item swallowed the rest of `lines`, the `unread` they are, ending
 * where they do.
 */
function list(first: ItemStart, level: number, lines: Lines, start: number): { tokens: Block[]; next: number } {
  const items: Block[][] = [];
  let i = start;
  // Where the last item's lines end.
  let end = start;
  let swallowed = false;
  for (
    let item: ItemStart | undefined = first;
    item && sameList(first, item);
    item = lines.at(i) === undefined ? undefined : itemStart(lines.at(i)!)
  ) {
    // A list and its item each nest a level, as markdown-it's tokens do.
    const { children, next } = listItem(item, level + 2, lines, i);
    items.push(children);
    swallowed = swallowsRest(children);
    end = swallowed ? lines.count() : next;
    // An empty item with a blank line after it sends markdown-it's list rule two
    // lines on, past no more blank lines, so a second blank line ends the list.
    const after = lines.at(i + 1);
    if (item.first === undefined && after !== undefined && isBlank(after)) i += 2;
    else for (i = end; lines.at(i) !== undefined && isBlank(lines.at(i)!); i++);
  }
  const token: Block = { type: "list", start: "start" in first.marker ? first.marker.start : undefined, items };
  if (swallowed) return { tokens: [token, { type: "unread" }], next: end };
  // The blank lines after the last item belong to whatever follows the list.
  return { tokens: [token], next: end };
}

/**
 * `lines` read into blocks at `level`, how deep in containers they sit, and
 * the index of the line the read stopped at: the first lazy continuation
 * line no block before it took, where markdown-it's block pass stops at a
 * line short of its container's indentation, or else the end. At
 * `MAX_NESTING` markdown-it's block pass reads nothing, and neither does this:
 * it skips blank lines and stops at a lazy one before it checks the level, so
 * only content with text in it is left unread.
 */
function tokenize(lines: Lines, level: number): { tokens: Block[]; end: number } {
  const tokens: Block[] = [];
  let i = 0;

  for (let line = lines.at(i); line !== undefined; line = lines.at(i)) {

    if (isBlank(line)) {
      i++;
      continue;
    }
    if (line.lazy) break;
    if (level >= MAX_NESTING) return { tokens: [{ type: "unread" }], end: lines.count() };

    // Table: before every other block, as markdown-it tries it, so a header
    // row that reads as a heading or a list item is still a header. Its body
    // rows run to a line `pyStrip` empties or a line that opens a block.
    const columns = tableAt(lines, i);
    if (columns) {
      const rows: string[][] = [];
      let autocompleted = 0;
      for (let row = lines.at((i += 2)); row !== undefined && pyStrip(row.text) !== "" && tableLine(row) && !opensBlock(row); row = lines.at(++i)) {
        const cells = rowCells(body(row));
        autocompleted += columns.length - cells.length;
        if (autocompleted > MAX_AUTOCOMPLETED_CELLS) break;
        rows.push(columns.map((_, n) => cells[n] ?? ""));
      }
      tokens.push({ type: "table", columns, rows });
      continue;
    }

    // Indented code: its lines, and the blank lines between them, with the indent cut off
    if (indentOf(line) >= CODE_INDENT) {
      let end = i + 1;
      for (let j = end, code = lines.at(j); code !== undefined && (isBlank(code) || (!code.lazy && indentOf(code) >= CODE_INDENT)); code = lines.at(++j)) {
        if (!isBlank(code)) end = j + 1;
      }
      tokens.push({ type: "code_block", code: lines.slice(i, end).map((code) => dropColumns(code, CODE_INDENT)).join("\n") });
      i = end;
      continue;
    }

    // Heading
    const headingMatch = HEADING.exec(body(line));
    if (headingMatch) {
      tokens.push({ type: "heading", level: headingMatch[0].length, text: pyStrip(body(line).slice(headingMatch[0].length).replace(HEADING_CLOSE, "")) });
      i++;
      continue;
    }

    // Horizontal rule
    if (startsWith(line, RULE)) {
      tokens.push({ type: "hr" });
      i++;
      continue;
    }

    // Fenced code block: its lines with the fence's own indentation cut off,
    // to a closing fence or to the end of its container
    const fence = FENCE.exec(body(line));
    if (fence) {
      const indent = indentOf(line);
      const close = closingFence(fence[1]!);
      const codeLines: string[] = [];
      for (let code = lines.at(++i); code !== undefined && !code.lazy && !startsWith(code, close); code = lines.at(++i)) codeLines.push(dropColumns(code, indent));
      if (lines.at(i)?.lazy === false) i++; // skip the closing fence
      tokens.push({ type: "code_block", code: codeLines.join("\n") });
      continue;
    }

    // Blockquote: Markdown of its own — its `>` lines with the marker blanked,
    // and each unmarked line after one with text a lazy continuation line,
    // up to where its own block pass stops
    if (startsWith(line, QUOTE)) {
      const { tokens: children, end } = tokenize(new Lines(quoteLines(lines, i)), level + 1);
      tokens.push({ type: "blockquote", children });
      i += end;
      continue;
    }

    // List: its items, each Markdown of its own, as a quote is
    const item = itemStart(line);
    if (item) {
      const { tokens: listed, next } = list(item, level, lines, i);
      tokens.push(...listed);
      i = next;
      continue;
    }

    // Link reference definition
    const definition = definitionAt(lines, i);
    if (definition) {
      tokens.push({ type: "definition", label: definition.label, url: definition.url });
      i = definition.next;
      continue;
    }

    // HTML block: to the line that closes its kind, or to the end of its
    // container when none does; a closing blank line is left to what follows
    const html = htmlBlockAt(line);
    if (html) {
      const { end } = html;
      const closes = end === "blank" ? isBlank : (closing: Line) => end.test(body(closing));
      for (let at = lines.at(i); at !== undefined && !at.lazy && !closes(at); at = lines.at(++i));
      if (lines.at(i)?.lazy === false && end !== "blank") i++;
      tokens.push({ type: "html_block" });
      continue;
    }

    // Paragraph, or a setext heading when a line of `=` or `-` underlines it
    const { text, next } = continuation(lines, i);
    const setext = underline(lines.at(next));
    tokens.push(
      setext
        ? { type: "heading", level: setext[1]!.startsWith("=") ? 1 : 2, text }
        : { type: "paragraph", text },
    );
    i = setext ? next + 1 : next;
  }

  return { tokens, end: i };
}

/**
 * One inline construct found at a position in a run of text, and the index
 * just past it: a link with its label not yet read, and a delimiter run not
 * yet paired.
 */
type InlineMatch =
  | { kind: "code"; code: string; end: number }
  | DelimiterRun
  /** The label is the text from `label` up to the `]` at `close`. */
  | { kind: "link"; label: number; close: number; url: string; end: number }
  | { kind: "autolink"; source: string; url: string; end: number }
  | { kind: "image"; alt: string; src: string; end: number }
  | { kind: "text"; text: string; end: number }
  | { kind: "html"; end: number }
  | { kind: "hardbreak"; end: number }
  /** A line ending, soft or hard by the spaces before it, which are the text before it. */
  | { kind: "line_ending"; end: number };

/** The characters a run of delimiters is made of: emphasis's two, and strikethrough's. */
type Marker = "*" | "_" | "~";

/**
 * A run of one marker, as markdown-it's `scanDelims` reads it: whether it can
 * open, close, or both, decided once by what borders it. It stands for `count`
 * delimiters, each written `unit` — one per `*` or `_`, one per `~~` — and,
 * where a `~` run is odd, a `lone` `~` ahead of them that is only text.
 * `length` is what the rule of 3 reads, the run's length for emphasis and 0,
 * which disables it, for strikethrough.
 */
interface DelimiterRun {
  readonly kind: "delimiters";
  readonly marker: Marker;
  readonly unit: string;
  readonly count: number;
  readonly length: number;
  readonly lone: boolean;
  readonly canOpen: boolean;
  readonly canClose: boolean;
  readonly end: number;
}

/**
 * One character of a delimiter run, as markdown-it's emphasis rule records
 * each: `piece` is where it sits among its text's pieces, and `end` the index
 * of the delimiter `balancePairs` closes it with, or -1 for none. Pairing
 * spends `open` and `close` as it goes.
 */
interface Delimiter {
  readonly marker: Marker;
  readonly length: number;
  readonly piece: number;
  open: boolean;
  close: boolean;
  end: number;
}

/** markdown-it's `isWhiteSpace`: Unicode's space separators, and tab, line feed, vertical tab, form feed and carriage return. */
const WHITESPACE = /^[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]$/;
/** markdown-it's `isPunctChar`, which takes in all of ASCII's punctuation: Unicode's punctuation and symbols. */
const PUNCTUATION = /^[\p{P}\p{S}]$/u;

const TICKS = /`+/y;
const LINE_INDENT = /[ \t]*/y;
/** markdown-it's autolink: `<`, then text holding no `<` up to the first `>`. */
const AUTOLINK = /<([^<>]*)>/y;
/** What an autolink's text must be: a URI, scheme first, or an email address. */
const AUTOLINK_URI = /^[a-zA-Z][a-zA-Z0-9+.\-]{1,31}:[^<>\x00-\x20]*$/;
const AUTOLINK_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
/** Space as markdown-it's link rule skips it around a destination and title: a space, tab or line ending, not Unicode's. */
const LINK_SPACE = /[ \t\n]*/y;
/**
 * A link title, as markdown-it's `parseLinkTitle` reads one: in `"`, `'` or
 * `(…)`, a backslash taking the character after it, and a `(` refusing a
 * `(…)` title.
 */
const LINK_TITLE = /"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|\((?:\\[\s\S]|[^()\\])*\)/y;
/** How many parentheses markdown-it's `parseLinkDestination` lets a bare destination hold open: one more and it reads none. */
const MAX_DESTINATION_NESTING = 32;
/** A backslash escape, as markdown-it reads one: the ASCII punctuation character after it, standing for itself. */
const ESCAPE = /\\([!-\/:-@[-`{-~])/y;
/** A numeric character reference, as markdown-it reads one in text: up to seven decimal digits, or up to six hex. */
const NUMERIC_REFERENCE = /&#([xX][0-9a-fA-F]{1,6}|[0-9]{1,7});/y;
/** A named character reference, as markdown-it reads one in text: a letter, then one to 31 letters or digits. */
const NAMED_REFERENCE = /&([A-Za-z][A-Za-z0-9]{1,31});/y;
/**
 * A backslash escape or a character reference, as markdown-it's `unescapeAll`
 * reads them in a link's destination: the reference read more widely than in
 * text, a name or a `#` then one to 31 letters or digits.
 */
const UNESCAPE_ALL = new RegExp(`${ESCAPE.source}|&[A-Za-z#][A-Za-z0-9]{1,31};`, "g");
/** A numeric reference as `unescapeAll` reads one: up to eight digits of either base. */
const DESTINATION_NUMERIC = /^&#([xX][0-9a-fA-F]{1,8}|[0-9]{1,8});$/;
/** Inline HTML, as markdown-it-py's HTML_TAG_RE reads it: a tag, a comment, a processing instruction, a declaration or a CDATA section. */
const HTML_TAG = new RegExp(
  [
    HTML_OPEN_TAG,
    HTML_CLOSE_TAG,
    String.raw`<!---?>|<!--(?:[^-]|-[^-]|--[^>])*-->`,
    String.raw`<[?][\s\S]*?[?]>`,
    String.raw`<![A-Za-z][^>]*>`,
    String.raw`<!\[CDATA\[[\s\S]*?\]\]>`,
  ].join("|"),
  "y",
);

/** `re`, a sticky pattern, matched exactly at `i` in `text`. */
function matchAt(re: RegExp, text: string, i: number): RegExpExecArray | null {
  re.lastIndex = i;
  return re.exec(text);
}

/**
 * The character a numeric reference to `code` names, unless markdown-it's
 * `isValidEntityCode` refuses it: a surrogate, a noncharacter, DEL, a C0 or
 * C1 control other than tab, line feed, form feed and carriage return, or
 * anything past U+10FFFF.
 */
function referencedCharacter(code: number): string | undefined {
  const refused =
    (code >= 0xd800 && code <= 0xdfff) ||
    (code >= 0xfdd0 && code <= 0xfdef) ||
    (code & 0xfffe) === 0xfffe ||
    code <= 0x08 ||
    code === 0x0b ||
    (code >= 0x0e && code <= 0x1f) ||
    (code >= 0x7f && code <= 0x9f) ||
    code > 0x10ffff;
  return refused ? undefined : String.fromCodePoint(code);
}

/** The code point a numeric reference's `digits` name: hex after an `x`, decimal without one. */
function referencedCode(digits: string): number {
  return /^[xX]/.test(digits) ? parseInt(digits.slice(1), 16) : parseInt(digits, 10);
}

/**
 * The character reference at `i` in text, as markdown-it's entity rule reads
 * one: a numeric reference as the character it names, or U+FFFD where that is
 * no character it accepts, and a named one only where HTML names it.
 */
function referenceAt(text: string, i: number): InlineMatch | undefined {
  const numeric = matchAt(NUMERIC_REFERENCE, text, i);
  if (numeric) {
    const chars = referencedCharacter(referencedCode(numeric[1]!)) ?? "\uFFFD";
    return { kind: "text", text: chars, end: i + numeric[0].length };
  }
  const named = matchAt(NAMED_REFERENCE, text, i);
  if (!named) return undefined;
  const chars = namedReference(named[1]!);
  return chars === undefined ? undefined : { kind: "text", text: chars, end: i + named[0].length };
}

/**
 * markdown-it's `unescapeAll`, which a link's destination is read through:
 * each backslash escape as the character it escapes, and each reference
 * `UNESCAPE_ALL` finds as the characters it names — a reference naming
 * nothing, or no character `isValidEntityCode` accepts, left as written.
 */
function unescapeAll(text: string): string {
  return text.replace(UNESCAPE_ALL, (whole: string, escaped: string | undefined) => {
    if (escaped !== undefined) return escaped;
    const numeric = DESTINATION_NUMERIC.exec(whole);
    const chars = numeric ? referencedCharacter(referencedCode(numeric[1]!)) : namedReference(whole.slice(1, -1));
    return chars ?? whole;
  });
}

/**
 * markdown-it's link-label scan — `parseLinkLabel` stepping over the text a
 * token at a time with `skipToken` — and the cache those steps share across
 * one block's text, with the document's `definitions` a label is resolved
 * against. A link's label may hold no link: a `[` it meets that
 * opens one refuses the label, so only the innermost of nested links links.
 * Each `[` the scan meets is tried as a link one level deeper, and at
 * `MAX_NESTING` a step lands past the end of the text, as markdown-it's does —
 * which is what keeps the scan shallow and, with the cache, linear in a run of
 * brackets however long.
 */
class LinkLabels {
  // markdown-it's `state.cache`: where a step from a position lands, kept
  // whatever level it was taken at and whatever text it was taken in, as there.
  private readonly steps = new Map<number, number>();

  constructor(readonly definitions: Definitions) {}

  /**
   * The index of the `]` closing the label whose `[` is at `open` in `text`,
   * scanned at `level` — or nothing, where no `]` does or, for a link's
   * label, where the label holds a link.
   */
  close(text: string, open: number, level: number, refusesLinks: boolean): number | undefined {
    let depth = 1;
    for (let i = open + 1; i < text.length; ) {
      if (text[i] === "]" && --depth === 0) return i;
      const next = this.step(text, i, level);
      if (text[i] === "[") {
        // A `[` stepped over alone is text; one that took more opened a link.
        if (next === i + 1) depth++;
        else if (refusesLinks) return undefined;
      }
      i = next;
    }
    return undefined;
  }

  /** Where markdown-it's `skipToken` lands from `i` in `text` at `level`: past the construct opening there, if one does, tried a level deeper. */
  private step(text: string, i: number, level: number): number {
    const cached = this.steps.get(i);
    if (cached !== undefined) return cached;
    const next = level >= MAX_NESTING ? text.length + 1 : (inlineAt(text, i, this, level + 1)?.end ?? textRunEnd(text, i));
    this.steps.set(i, next);
    return next;
  }
}

/** Every character `inlineAt` opens a construct at, and the `]` a link label ends at. */
const STEP_STOPS = new Set(["`", "*", "_", "~", "&", "\n", "\\", "<", "!", "[", "]"]);

/**
 * Where markdown-it's `text` rule leaves a step from `i` in `text` that opens
 * nothing: past the whole run of characters that cannot, so a label scan
 * crosses a paragraph of plain text in one step, or past `i` alone where it
 * is a character that could and did not.
 */
function textRunEnd(text: string, i: number): number {
  if (STEP_STOPS.has(text[i]!)) return i + 1;
  let end = i + 1;
  while (end < text.length && !STEP_STOPS.has(text[end]!)) end++;
  return end;
}

/** Where a link or an image links, and the index past what says so. */
interface LinkTarget {
  readonly url: string;
  readonly end: number;
}

/**
 * The `(destination "title")` opening at `open`, as markdown-it's link rule
 * reads it: space, the destination `destinationAt` reads, a title only if
 * space came before it, space, then the `)`. The destination, its backslash
 * escapes and character references read and then made an href as markdown-it
 * makes one, and the index past the `)`. Where markdown-it refuses either,
 * `resume` is one past where its read stopped, which is where its link rule
 * looks for a reference's label instead; and where only space follows the
 * `(`, there is nothing, and the brackets before it are neither.
 */
function linkDestination(text: string, open: number): LinkTarget | { resume: number } | undefined {
  const start = linkSpaceEnd(text, open + 1);
  if (start >= text.length) return undefined;
  const destination = destinationAt(text, start);
  const href = destination && linkHref(unescapeAll(destination.raw));
  if (destination === undefined || href === undefined) return { resume: start + 1 };
  let i = linkSpaceEnd(text, destination.end);
  const title = i > destination.end ? matchAt(LINK_TITLE, text, i) : null;
  if (title) i = linkSpaceEnd(text, i + title[0].length);
  return text[i] === ")" ? { url: href, end: i + 1 } : { resume: i + 1 };
}

/**
 * Where the link or image whose label opens at `open` and closes at `close`
 * links, as markdown-it's link and image rules read it: the
 * `(destination "title")` after it, or else a reference — and, for a link,
 * a reference also where that inline form is refused, read from where the
 * refusal leaves it. markdown-it's image rule takes no reference there.
 */
function linkTarget(text: string, open: number, close: number, labels: LinkLabels, level: number, image: boolean): LinkTarget | undefined {
  if (text[close + 1] !== "(") return reference(text, open, close, close + 1, labels, level);
  const destination = linkDestination(text, close + 1);
  if (destination === undefined || "url" in destination) return destination;
  return image ? undefined : reference(text, open, close, destination.resume, labels, level);
}

/**
 * The definition a reference names, as markdown-it's link and image rules
 * resolve one: a full reference's own label, in the brackets at `from` — or,
 * where those are empty or no brackets close there, the label from `open` to
 * `close`, a collapsed or shortcut reference. The url its definition gives, and
 * the index past the reference; nothing where no definition has its label.
 */
function reference(text: string, open: number, close: number, from: number, labels: LinkLabels, level: number): LinkTarget | undefined {
  const fullClose = text[from] === "[" ? labels.close(text, from, level, false) : undefined;
  const full = fullClose === undefined ? "" : text.slice(from + 1, fullClose);
  const url = labels.definitions.get(normalizeReference(full || text.slice(open + 1, close)));
  return url === undefined ? undefined : { url, end: fullClose === undefined ? close + 1 : fullClose + 1 };
}

/** The index past the `LINK_SPACE` at `i` in `text`. */
function linkSpaceEnd(text: string, i: number): number {
  return i + matchAt(LINK_SPACE, text, i)![0].length;
}

/**
 * The link destination at `start` in `text`, as markdown-it's
 * `parseLinkDestination` reads one, its escapes still in it, and the index
 * past it. In angle brackets it is anything up to the `>` but a line ending or
 * a `<`; bare, it runs to a space or an ASCII control character, or a `)` it
 * did not open, and its parentheses must balance and nest no deeper than
 * `MAX_DESTINATION_NESTING` — the cap that keeps a run of `](` from each
 * scanning to the end of the text. A backslash takes the character after it,
 * but for a space, which ends a bare destination before the backslash. An
 * empty one reads as `""`, where markdown-it reads none: its link rule takes
 * the `)` after it all the same, with the same empty href.
 */
function destinationAt(text: string, start: number): { raw: string; end: number } | undefined {
  if (text[start] === "<") {
    for (let i = start + 1; i < text.length; i++) {
      if (text[i] === "\n" || text[i] === "<") return undefined;
      if (text[i] === ">") return { raw: text.slice(start + 1, i), end: i + 1 };
      if (text[i] === "\\") i++;
    }
    return undefined;
  }
  let level = 0;
  let i = start;
  for (; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) break;
    if (code === 0x5c && i + 1 < text.length) {
      if (text[i + 1] === " ") break;
      i++;
    } else if (code === 0x28) {
      level++;
      if (level > MAX_DESTINATION_NESTING) return undefined;
    } else if (code === 0x29) {
      if (level === 0) break;
      level--;
    }
  }
  return level === 0 ? { raw: text.slice(start, i), end: i } : undefined;
}

/** The character before `i` in `text`, a surrogate pair whole, or a space at its start, as `scanDelims` reads the line. */
function charBefore(text: string, i: number): string {
  if (i === 0) return " ";
  return i >= 2 && text.codePointAt(i - 2)! > 0xffff ? text.slice(i - 2, i) : text[i - 1]!;
}

/**
 * The run of `*`, `_` or `~` starting at `i` in `text`, as markdown-it's
 * `scanDelims` reads it. A run is left-flanking where what follows it is no
 * space, and is punctuation only if what precedes it is a space or
 * punctuation too; right-flanking is the mirror. A `*` or `~` run opens where
 * it is left-flanking and closes where it is right-flanking; a `_` run may
 * not do either inside a word. A `~` run is strikethrough's, which takes its
 * tildes two at a time and none at all from a run of one — that `~` is text.
 */
function delimiterRun(text: string, i: number): DelimiterRun | undefined {
  const marker = text[i] as Marker;
  let end = i;
  while (text[end] === marker) end++;
  const before = charBefore(text, i);
  const after = end < text.length ? String.fromCodePoint(text.codePointAt(end)!) : " ";
  const [spaceBefore, spaceAfter] = [WHITESPACE.test(before), WHITESPACE.test(after)];
  const [punctBefore, punctAfter] = [PUNCTUATION.test(before), PUNCTUATION.test(after)];
  const left = !spaceAfter && (!punctAfter || spaceBefore || punctBefore);
  const right = !spaceBefore && (!punctBefore || spaceAfter || punctAfter);
  const inWord = marker !== "_";
  const length = end - i;
  const strike = marker === "~";
  if (strike && length < 2) return undefined;
  return {
    kind: "delimiters",
    marker,
    unit: strike ? "~~" : marker,
    count: strike ? Math.floor(length / 2) : length,
    length: strike ? 0 : length,
    lone: strike && length % 2 === 1,
    canOpen: left && (inWord || !right || punctBefore),
    canClose: right && (inWord || !left || punctAfter),
    end,
  };
}

/**
 * Each delimiter that can close paired with the nearest one before it that
 * can open, as markdown-it's `balance_pairs` pairs them, so the pairs nest:
 * the same marker, never one of its own run, and not where either can do both
 * and the runs' lengths sum to a multiple of 3, unless both lengths are.
 * `jumps` skips what a pairing has enclosed and `openersBottom` the openers a
 * closer like this one already failed to find, so the pass is linear.
 */
function balancePairs(delimiters: readonly Delimiter[]): void {
  const openersBottom: Record<Marker, number[]> = { "*": [-1, -1, -1, -1, -1, -1], _: [-1, -1, -1, -1, -1, -1], "~": [-1, -1, -1, -1, -1, -1] };
  const jumps: number[] = [];
  let headerIdx = 0;
  let lastPiece = -2;
  for (const [closerIdx, closer] of delimiters.entries()) {
    jumps.push(0);
    // headerIdx is the first delimiter of the closer's own run.
    if (delimiters[headerIdx]!.marker !== closer.marker || lastPiece !== closer.piece - 1) headerIdx = closerIdx;
    lastPiece = closer.piece;
    if (!closer.close) continue;
    const bottom = (closer.open ? 3 : 0) + (closer.length % 3);
    let openerIdx = headerIdx - jumps[headerIdx]! - 1;
    let newBottom = openerIdx;
    for (; openerIdx > openersBottom[closer.marker][bottom]!; openerIdx -= jumps[openerIdx]! + 1) {
      const opener = delimiters[openerIdx]!;
      if (opener.marker !== closer.marker || !opener.open || opener.end >= 0) continue;
      const oddMatch =
        (opener.close || closer.open) &&
        (opener.length + closer.length) % 3 === 0 &&
        (opener.length % 3 !== 0 || closer.length % 3 !== 0);
      if (oddMatch) continue;
      const lastJump = openerIdx > 0 && !delimiters[openerIdx - 1]!.open ? jumps[openerIdx - 1]! + 1 : 0;
      jumps[closerIdx] = closerIdx - openerIdx + lastJump;
      jumps[openerIdx] = lastJump;
      closer.open = false;
      opener.end = closerIdx;
      opener.close = false;
      newBottom = -1;
      lastPiece = -2;
      break;
    }
    if (newBottom !== -1) openersBottom[closer.marker][bottom] = newBottom;
  }
}

/**
 * `pieces` with each pair of delimiters `balancePairs` made into emphasis, as
 * markdown-it's strikethrough and emphasis `postProcess` make them: a `~~`
 * pair `s`; and, innermost pair first, a `*` or `_` pair `strong` where the
 * pair enclosing it is of the same marker and touches it at both ends, so the
 * two are spent as one, and `em` otherwise. The `lone` `~` of an odd run, met
 * just before a `~~` that closes, is moved past every `~~` closing beside it,
 * as strikethrough's is, so `x ~~~a~~~` strikes `a` between two plain `~`. A
 * delimiter left unpaired is the text it is, joined to the text beside it as
 * markdown-it's `fragments_join` joins it, so a run of text between line
 * endings is one piece.
 */
function emphasized(pieces: readonly Inline[], delimiters: readonly Delimiter[], lone: ReadonlySet<number>): Inline[] {
  const roles = new Map<number, EmphasisTag | "close" | "spent">();
  const strikeCloses = new Set<number>();
  for (let i = delimiters.length - 1; i >= 0; i--) {
    const opener = delimiters[i]!;
    if (opener.end < 0) continue;
    const closer = delimiters[opener.end]!;
    const outer = delimiters[i - 1];
    const strike = opener.marker === "~";
    const strong =
      !strike &&
      outer !== undefined &&
      outer.end === opener.end + 1 &&
      outer.marker === opener.marker &&
      outer.piece === opener.piece - 1 &&
      delimiters[opener.end + 1]!.piece === closer.piece + 1;
    roles.set(opener.piece, strike ? "s" : strong ? "strong" : "em").set(closer.piece, "close");
    if (strike) strikeCloses.add(closer.piece);
    if (strong) {
      roles.set(outer.piece, "spent").set(delimiters[opener.end + 1]!.piece, "spent");
      i--;
    }
  }
  // The pieces in the order they are read, each lone `~` swapped with the
  // last `~~` of the closing run after it, as strikethrough's postProcess swaps
  // its tokens.
  const order = pieces.map((_, p) => p);
  for (const p of [...lone].filter((p) => strikeCloses.has(p + 1))) {
    let last = p + 1;
    while (strikeCloses.has(last + 1)) last++;
    [order[p], order[last]] = [order[last]!, order[p]!];
  }
  const open: Inline[][] = [[]];
  const tags: EmphasisTag[] = [];
  for (const p of order) {
    const piece = pieces[p]!;
    const role = roles.get(p);
    switch (role) {
      case "em":
      case "strong":
      case "s":
        tags.push(role);
        open.push([]);
        break;
      case "close": {
        const children = open.pop()!;
        open.at(-1)!.push({ kind: "emphasis", tag: tags.pop()!, children });
        break;
      }
      case "spent":
        break;
      case undefined: {
        const into = open.at(-1)!;
        const last = into.at(-1);
        if (piece.kind === "text" && last?.kind === "text") into[into.length - 1] = { kind: "text", text: last.text + piece.text };
        else into.push(piece);
      }
    }
  }
  return open[0]!;
}

/**
 * The autolink whose `<` is at `i` in `text`, as markdown-it reads one: the
 * text up to the first `>`, holding no `<`, a URI or an email address that
 * links to `mailto:` it — and so long as markdown-it accepts that href.
 */
function autolinkAt(text: string, i: number): InlineMatch | undefined {
  const angled = matchAt(AUTOLINK, text, i);
  if (!angled) return undefined;
  const source = angled[1]!;
  const href = AUTOLINK_URI.test(source)
    ? linkHref(source)
    : AUTOLINK_EMAIL.test(source)
      ? linkHref(`mailto:${source}`)
      : undefined;
  return href === undefined ? undefined : { kind: "autolink", source, url: href, end: i + angled[0].length };
}

/** Where the text of the line starting at `from` starts: past its spaces and tabs, which markdown-it's newline and escape rules skip after a line ending. */
function nextLine(text: string, from: number): number {
  return from + matchAt(LINE_INDENT, text, from)![0].length;
}

/** The inline construct opening at `i` in `text`, if one does, read at `level` with `labels` scanning a link's label. */
function inlineAt(text: string, i: number, labels: LinkLabels, level: number): InlineMatch | undefined {
  switch (text[i]) {
    case "`": {
      const ticks = matchAt(TICKS, text, i)![0];
      const close = new RegExp(`(?<!\`)${ticks}(?!\`)`, "g");
      close.lastIndex = i + ticks.length;
      const found = close.exec(text);
      if (!found) return { kind: "text", text: ticks, end: i + ticks.length };
      // A code span's line endings are spaces, and a space each side pads it unless `str.strip` empties it, as markdown-it-py's backticks rule has them. markdown-it in JS strips by `/^ (.+) $/` and so pads an all-space span too.
      const code = text.slice(i + ticks.length, found.index).replaceAll("\n", " ");
      const padded = code.startsWith(" ") && code.endsWith(" ") && pyStrip(code) !== "";
      return { kind: "code", code: padded ? code.slice(1, -1) : code, end: found.index + ticks.length };
    }
    case "*":
    case "_":
    case "~":
      return delimiterRun(text, i);
    case "&":
      return referenceAt(text, i);
    case "\n":
      return { kind: "line_ending", end: nextLine(text, i + 1) };
    case "\\": {
      // markdown-it's escape rule: a backslash before a line ending breaks it
      // hard, and one before anything else takes that character with it, the
      // pair standing as written unless it escapes — so a space after it
      // counts toward no hard break.
      if (text[i + 1] === "\n") return { kind: "hardbreak", end: nextLine(text, i + 2) };
      const escape = matchAt(ESCAPE, text, i);
      if (escape) return { kind: "text", text: escape[1]!, end: i + escape[0].length };
      if (i + 1 === text.length) return undefined;
      const next = String.fromCodePoint(text.codePointAt(i + 1)!);
      return { kind: "text", text: `\\${next}`, end: i + 1 + next.length };
    }
    case "<": {
      // markdown-it tries an autolink before inline HTML.
      const autolink = autolinkAt(text, i);
      if (autolink) return autolink;
      const tag = matchAt(HTML_TAG, text, i);
      return tag ? { kind: "html", end: i + tag[0].length } : undefined;
    }
    case "!":
    case "[": {
      const image = text[i] === "!";
      const open = image ? i + 1 : i;
      if (text[open] !== "[") return undefined;
      const close = labels.close(text, open, level, !image);
      if (close === undefined) return undefined;
      const target = linkTarget(text, open, close, labels, level, image);
      if (!target) return undefined;
      return image
        ? { kind: "image", alt: text.slice(open + 1, close), src: target.url, end: target.end }
        : { kind: "link", label: open + 1, close, url: target.url, end: target.end };
    }
    default:
      return undefined;
  }
}

/**
 * `text` from `from` to its end read into inlines, as markdown-it's inline
 * pass reads it: each construct `inlineAt` finds, the text between them as it
 * is, and its delimiters then paired into emphasis. `text` runs on before
 * `from` as the block's own text does, so a delimiter run reads what borders
 * it there; `level` is how many links the text sits in, where a label scan
 * starts counting.
 */
function inlines(text: string, from: number, labels: LinkLabels, level: number): Inline[] {
  const pieces: Inline[] = [];
  const delimiters: Delimiter[] = [];
  // The pieces that are an odd `~` run's lone `~`.
  const lone = new Set<number>();
  let plain = from;
  for (let i = from; i < text.length; ) {
    const found = inlineAt(text, i, labels, level);
    if (!found) {
      i++;
      continue;
    }
    // markdown-it's newline rule: the spaces ending the text before a line
    // ending are dropped, and two or more of them make the break hard.
    let kept = i;
    if (found.kind === "line_ending") while (kept > plain && text[kept - 1] === " ") kept--;
    if (plain < kept) pieces.push({ kind: "text", text: text.slice(plain, kept) });
    if (found.kind === "line_ending") pieces.push({ kind: i - kept >= 2 ? "hardbreak" : "softbreak" });
    else if (found.kind === "delimiters") {
      if (found.lone) lone.add(pieces.push({ kind: "text", text: "~" }) - 1);
      for (let k = 0; k < found.count; k++) {
        delimiters.push({ marker: found.marker, length: found.length, piece: pieces.length, open: found.canOpen, close: found.canClose, end: -1 });
        pieces.push({ kind: "text", text: found.unit });
      }
    } else pieces.push(matched(found, text, labels, level));
    i = plain = found.end;
  }
  if (plain < text.length) pieces.push({ kind: "text", text: text.slice(plain) });
  balancePairs(delimiters);
  return emphasized(pieces, delimiters, lone);
}

/** `text` read into inlines from its start, its references resolved against `definitions`. */
function parseInline(text: string, definitions: Definitions): Inline[] {
  return inlines(text, 0, new LinkLabels(definitions), 0);
}

/**
 * The inline `found` in `text` is, a link's label read into inlines of its
 * own: the block's text up to the label's `]`, so the delimiters inside it
 * pair only with each other, as markdown-it's are. The text ends where
 * markdown-it's `posMax` does, so a run at the label's end borders the end of
 * the text, as `scanDelims` reads it, and not the `]`.
 */
function matched(found: Exclude<InlineMatch, DelimiterRun | { kind: "line_ending" }>, text: string, labels: LinkLabels, level: number): Inline {
  switch (found.kind) {
    case "link":
      return { kind: "link", children: inlines(text.slice(0, found.close), found.label, labels, level + 1), url: found.url };
    case "autolink":
      return { kind: "autolink", text: normalizeLinkText(found.source), url: found.url };
    case "code":
      return { kind: "code", code: found.code };
    case "image":
      return { kind: "image", alt: found.alt, src: found.src };
    case "text":
      return { kind: "text", text: found.text };
    case "html":
      return { kind: "html" };
    case "hardbreak":
      return { kind: "hardbreak" };
  }
}

/**
 * Each label's href: a document's link reference definitions, keyed by the
 * label as `normalizeReference` makes it, as markdown-it's `env.references`.
 */
type Definitions = ReadonlyMap<string, string>;

/**
 * The link reference definitions among `tokens` and every container they
 * hold, in the order the source gives them, each label defined by the first
 * definition of it, as markdown-it keeps them.
 */
function definitionsIn(tokens: readonly Block[], into: Map<string, string> = new Map()): Map<string, string> {
  for (const token of tokens) {
    switch (token.type) {
      case "definition":
        if (!into.has(token.label)) into.set(token.label, token.url);
        break;
      case "list":
        for (const item of token.items) definitionsIn(item, into);
        break;
      case "blockquote":
        definitionsIn(token.children, into);
        break;
    }
  }
  return into;
}

/** The blocks among `tokens`, their marks dropped, with their text read into inlines: markdown-it's inline pass. */
function inlined(tokens: readonly Block[], definitions: Definitions): MdToken[] {
  return tokens
    .filter((token): token is Exclude<Block, BlockMark> => token.type !== "unread" && token.type !== "definition")
    .map((token) => inlinedBlock(token, definitions));
}

/** `token` with its text, and the text of every block inside it, read into inlines. */
function inlinedBlock(token: Exclude<Block, BlockMark>, definitions: Definitions): MdToken {
  const parse = (text: string): Inline[] => parseInline(text, definitions);
  switch (token.type) {
    case "heading":
    case "paragraph":
      return { ...token, text: parse(token.text) };
    case "list":
      return { ...token, items: token.items.map((item) => inlined(item, definitions)) };
    case "blockquote":
      return { ...token, children: inlined(token.children, definitions) };
    case "table":
      return {
        ...token,
        columns: token.columns.map((column) => ({ ...column, header: parse(column.header) })),
        rows: token.rows.map((row) => row.map(parse)),
      };
    default:
      return token;
  }
}

/** `source` read as Markdown: its blocks, and the text in each read into inlines. A line ends at `\r\n`, `\r` or `\n`, as markdown-it normalizes them. */
export function parseMarkdown(source: string): MdToken[] {
  const lines = source.split(/\r\n?|\n/).map((text): Line => ({ text, margin: 0, lazy: false }));
  const { tokens } = tokenize(new Lines(lines.values()), 0);
  return inlined(tokens, definitionsIn(tokens));
}
