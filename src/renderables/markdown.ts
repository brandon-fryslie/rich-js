/**
 * Markdown — renders Markdown content to the terminal.
 * Uses built-in parsing (no external dependency).
 *
 * Block structure is read as CommonMark reads it: a blockquote and a list
 * item are both containers, their lines tokenized as Markdown of their own
 * once the container's marker or indentation is cut off, and drawn beside a
 * gutter — the quote's bar, the item's marker then its hang. A table, which
 * CommonMark has none of, and an HTML block are read as markdown-it — Rich's
 * parser — reads them. Where CommonMark leaves the drawing open, Rich's is
 * followed: HTML, a block of it or a tag inline, is drawn as Rich draws it,
 * not at all.
 */

import { cellLen, expandTabs, parseTabSize } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { RichText, resolveStyle } from "../core/text.js";
import { Rule } from "./rule.js";
import { Table } from "./table.js";
import { linkHref, normalizeLinkText } from "./markdown-url.js";
import { namedReference } from "./html-entities.js";
import { SIMPLE } from "../core/box.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle, groundedStyle, stackedHeight } from "../core/protocol.js";

export interface MarkdownOptions {
  /** The style of `inline code`: a theme name or a style definition. Default `markdown.code`. */
  inlineCodeStyle?: string | Style;
  /**
   * Whether a link's text is the link. `false` writes the URL after the text
   * in parentheses, for a reader who cannot click it. Default `true`.
   */
  hyperlinks?: boolean;
  /** How body text — paragraphs, list items, quotes — is placed in its width. Default `"left"`; headings keep their own. */
  justify?: Justify;
}

type Justify = NonNullable<RenderOptions["justify"]>;

/** What the options say about inline text, which every block's text is drawn with. */
interface InlineSettings {
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;
}

/** What the options say about every block: its inline text, and where body text sits. */
interface BlockSettings extends InlineSettings {
  readonly justify: Justify;
}

/** What a list item's gutter opens with: a bullet, or its number in the list, padded to the list's widest. */
type ItemMarker = { readonly kind: "bullet" } | { readonly kind: "number"; readonly label: string };

/** Where a table column's cells sit, from the colons on its delimiter cell. None is GFM's no alignment, which Rich leaves to its column: left. */
type CellAlign = "left" | "center" | "right" | undefined;

interface TableColumn {
  readonly header: string;
  readonly align: CellAlign;
}

type MdToken =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code_block"; code: string }
  | { type: "hr" }
  | { type: "list_item"; marker: ItemMarker; children: MdToken[] }
  | { type: "blockquote"; children: MdToken[] }
  /** Each row holds one cell per column: a short row filled out with empty cells, a long one cut. */
  | { type: "table"; columns: readonly TableColumn[]; rows: readonly (readonly string[])[] }
  /** Kept, though nothing draws it, so a container ending in one does not end in the paragraph before it. */
  | { type: "html_block" }
  | { type: "blank" };

/**
 * A source line inside the container that holds it: the line as written, with
 * every container marker it sat behind blanked to spaces so its columns are
 * still the source's, and `margin`, the column its container's content starts
 * at. Columns are counted from the source's column 0, so a tab reaches the
 * stop it reaches in the source however deep the line is nested. A `lazy`
 * line was taken in short of its container's marker or indentation, as
 * CommonMark's paragraph continuation text, and is only ever that.
 */
interface Line {
  readonly text: string;
  readonly margin: number;
  readonly lazy: boolean;
}

const HEADING = /^(#{1,6})\s+(.+)$/;
/** A thematic break: three or more of one of `*`, `-` or `_`, spaces and tabs between them allowed. */
const RULE = /^(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const SETEXT = /^(=+|-+)[ \t]*$/;
const FENCE = /^```(\w*)/;
const QUOTE = /^>/;
const ITEM_MARKER = /^(?:[*+-]|(\d{1,9})\.)/;
const LEAD = /^[ \t]*/;
const HARD_BREAK = /(?: {2,}|\\)$/;
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
/** The tab stop code is drawn with, as Rich's `Syntax` draws it. */
const CODE_TAB_SIZE = parseTabSize(8);
const BLANK_LINE: Line = { text: "", margin: 0, lazy: false };

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
const HTML_ATTRIBUTE = String.raw`(?:\s+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:\s*=\s*(?:[^"'=<>\`\x00-\x20]+|'[^']*'|"[^"]*"))?)`;
const HTML_OPEN_TAG = String.raw`<[A-Za-z][A-Za-z0-9-]*${HTML_ATTRIBUTE}*\s*\/?>`;
const HTML_CLOSE_TAG = String.raw`<\/[A-Za-z][A-Za-z0-9-]*\s*>`;
const HTML_BLOCKS: readonly HtmlBlockKind[] = [
  { start: /^<(?:script|pre|style|textarea)(?=\s|>|$)/i, end: /<\/(?:script|pre|style|textarea)>/i, interrupts: true },
  { start: /^<!--/, end: /-->/, interrupts: true },
  { start: /^<\?/, end: /\?>/, interrupts: true },
  // Uppercase only, as markdown-it-py has it, where markdown-it in JS and CommonMark 0.31 take `<!doctype` too.
  { start: /^<![A-Z]/, end: />/, interrupts: true },
  { start: /^<!\[CDATA\[/, end: /\]\]>/, interrupts: true },
  { start: new RegExp(String.raw`^<\/?(?:${HTML_BLOCK_NAMES})(?=\s|\/?>|$)`, "i"), end: "blank", interrupts: true },
  {
    start: new RegExp(String.raw`^(?:${HTML_OPEN_TAG}|${HTML_CLOSE_TAG})\s*$`),
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
  return line.text.trim() === "";
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
 * the marker.
 */
interface ItemStart {
  readonly bullet: string | undefined;
  readonly start: number;
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
    bullet: m[1] === undefined ? m[0] : undefined,
    start: m[1] === undefined ? 0 : parseInt(m[1], 10),
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
 * cell, and each cell trimmed. An escaped `\|` is a `|` in its cell, inside a
 * code span too.
 */
function rowCells(row: string): string[] {
  const cells = [""];
  for (const ch of row.trim()) {
    const last = cells.length - 1;
    if (ch !== "|") cells[last] += ch;
    else if (cells[last]!.endsWith("\\")) cells[last] = `${cells[last]!.slice(0, -1)}|`;
    else cells.push("");
  }
  const from = cells[0] === "" ? 1 : 0;
  const to = cells.length > from && cells[cells.length - 1] === "" ? -1 : undefined;
  return cells.slice(from, to).map((cell) => cell.trim());
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
function tableAt(lines: readonly Line[], start: number): TableColumn[] | undefined {
  const head = lines[start]!;
  const delimiter = lines[start + 1];
  if (delimiter === undefined || !tableLine(head) || !body(head).includes("|")) return undefined;
  const aligns = alignments(delimiter);
  if (!aligns) return undefined;
  const headers = rowCells(body(head));
  return headers.length === aligns.length ? headers.map((header, n) => ({ header, align: aligns[n] })) : undefined;
}

/** Whether two item starts belong to one list: the same bullet character, or both numbered. */
function sameList(a: ItemStart, b: ItemStart): boolean {
  return a.bullet === b.bullet;
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
  if (line.lazy) return false;
  if (underline(line)) return true;
  const item = itemStart(line);
  return item ? item.first !== undefined && (item.bullet !== undefined || item.start === 1) : opensBlock(line);
}

/** The setext underline `line` is — a line of `=` or `-` under a paragraph — if it is one. A lazy line never is. */
function underline(line: Line | undefined): RegExpExecArray | null {
  return line && !line.lazy && indentOf(line) < CODE_INDENT ? SETEXT.exec(body(line)) : null;
}

/** Whether the last block of `tokens`, followed into the containers it closes, is a paragraph still open. */
function endsInParagraph(tokens: readonly MdToken[]): boolean {
  const last = tokens[tokens.length - 1];
  switch (last?.type) {
    case "paragraph":
      return true;
    case "list_item":
    case "blockquote":
      return endsInParagraph(last.children);
    default:
      return false;
  }
}

/**
 * Whether `line`, short of a container's marker or indentation, still
 * belongs to it as a lazy continuation: CommonMark's paragraph continuation
 * text, which continues the paragraph open at the end of the container's
 * `inner` lines and opens no block of its own. Outside the container a line
 * is read without the paragraph under it, so any list item — whatever it
 * counts from — ends the container rather than continuing it. A line after a
 * lazy continuation finds that paragraph still open, so `afterLazy` answers
 * without reading `inner` again: a container's lazy lines cost one read of
 * it, not one each.
 */
function continuesLazily(inner: readonly Line[], line: Line, afterLazy: boolean): boolean {
  return !isBlank(line) && !opensBlock(line) && (afterLazy || endsInParagraph(tokenize(inner)));
}

/**
 * The text of the paragraph begun at `start`, every line after it up to a
 * blank, a line that ends a paragraph or a table's header row, and the index of the line that ended
 * it. Soft-broken lines are joined by one space, as a Markdown renderer
 * reflows them, with their own indentation dropped; a line ending in two
 * spaces or a backslash breaks hard, and its break is kept.
 */
function continuation(lines: readonly Line[], start: number): { text: string; next: number } {
  const parts = [lines[start]!.text];
  let i = start + 1;
  for (; i < lines.length && !isBlank(lines[i]!) && !endsParagraph(lines[i]!) && !tableAt(lines, i); i++) parts.push(lines[i]!.text);
  const text = parts
    .map((part, n) => {
      const words = (n === parts.length - 1 ? part : part.replace(HARD_BREAK, "")).trim();
      return n === 0 ? words : (HARD_BREAK.test(parts[n - 1]!) ? "\n" : " ") + words;
    })
    .join("");
  return { text, next: i };
}

/**
 * The lines of the list item opened at `start` — every line after it that is
 * blank, indented to the content column, or a lazy continuation — and the
 * index of the line that ended it. Blank lines trailing the item are left to
 * whatever follows it, and an item that opens with a blank line ends at the
 * next one: it is empty.
 */
function itemLines(item: ItemStart, lines: readonly Line[], start: number): { inner: Line[]; next: number } {
  const inner = item.first === undefined ? [] : [item.first];
  let lazy = false;
  let i = start + 1;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const blank = isBlank(line);
    if (blank && inner.length === 0) break;
    const held = blank || leadEnd(line) >= item.content;
    lazy = !held && continuesLazily(inner, line, lazy);
    if (!held && !lazy) break;
    inner.push(held ? { text: line.text, margin: item.content, lazy: false } : { ...line, lazy: true });
  }
  for (; inner.length > 0 && isBlank(inner[inner.length - 1]!); i--) inner.pop();
  return { inner, next: i };
}

/**
 * The list opened at `start`: each item as a token holding its blocks, and
 * between items the blank lines that separated them in the source. Numbers
 * count on from the first item's, as Rich draws them, right-aligned to the
 * widest so every item hangs at one column.
 */
function list(first: ItemStart, lines: readonly Line[], start: number): { tokens: MdToken[]; next: number } {
  const items: { gap: number; children: MdToken[] }[] = [];
  let i = start;
  let gap = 0;
  for (
    let item: ItemStart | undefined = first;
    item && sameList(first, item);
    item = i < lines.length ? itemStart(lines[i]!) : undefined
  ) {
    const { inner, next } = itemLines(item, lines, i);
    items.push({ gap, children: tokenize(inner.length === 0 ? [BLANK_LINE] : inner) });
    let after = next;
    while (after < lines.length && isBlank(lines[after]!)) after++;
    gap = after - next;
    i = after;
  }
  // The blank lines after the last item belong to whatever follows the list.
  const next = i - gap;
  const width = String(first.start + items.length - 1).length + 1;
  const tokens = items.flatMap(({ gap: blanks, children }, n): MdToken[] => [
    ...Array.from({ length: blanks }, (): MdToken => ({ type: "blank" })),
    {
      type: "list_item",
      marker: first.bullet === undefined ? { kind: "number", label: `${first.start + n}.`.padStart(width) } : { kind: "bullet" },
      children,
    },
  ]);
  return { tokens, next };
}

function tokenize(lines: readonly Line[]): MdToken[] {
  const tokens: MdToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Blank line
    if (isBlank(line)) {
      tokens.push({ type: "blank" });
      i++;
      continue;
    }

    // Table: before every other block, as markdown-it tries it, so a header
    // row that reads as a heading or a list item is still a header. Its body
    // rows run to a blank line or a line that opens a block.
    const columns = tableAt(lines, i);
    if (columns) {
      const rows: string[][] = [];
      let autocompleted = 0;
      for (i += 2; i < lines.length && !isBlank(lines[i]!) && tableLine(lines[i]!) && !opensBlock(lines[i]!); i++) {
        const cells = rowCells(body(lines[i]!));
        autocompleted += columns.length - cells.length;
        if (autocompleted > MAX_AUTOCOMPLETED_CELLS) break;
        rows.push(columns.map((_, n) => cells[n] ?? ""));
      }
      tokens.push({ type: "table", columns, rows });
      continue;
    }

    // Indented code: its lines, and the blank lines between them, with the indent cut off
    if (indentOf(line) >= CODE_INDENT) {
      const code: string[] = [];
      for (; i < lines.length && (isBlank(lines[i]!) || indentOf(lines[i]!) >= CODE_INDENT); i++) {
        code.push(dropColumns(lines[i]!, CODE_INDENT));
      }
      for (; code[code.length - 1]!.trim() === ""; i--) code.pop();
      tokens.push({ type: "code_block", code: code.join("\n") });
      continue;
    }

    // Heading
    const headingMatch = HEADING.exec(body(line));
    if (headingMatch) {
      tokens.push({ type: "heading", level: headingMatch[1]!.length, text: headingMatch[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (startsWith(line, RULE)) {
      tokens.push({ type: "hr" });
      i++;
      continue;
    }

    // Fenced code block: its lines with the fence's own indentation cut off
    if (startsWith(line, FENCE)) {
      const indent = indentOf(line);
      const codeLines: string[] = [];
      for (i++; i < lines.length && !startsWith(lines[i]!, FENCE); i++) codeLines.push(dropColumns(lines[i]!, indent));
      i++; // skip closing ```
      tokens.push({ type: "code_block", code: codeLines.join("\n") });
      continue;
    }

    // Blockquote: Markdown of its own — its `>` lines with the marker blanked,
    // and any unmarked line lazily continuing the paragraph open inside it
    if (startsWith(line, QUOTE)) {
      const inner: Line[] = [];
      let lazy = false;
      for (; i < lines.length; i++) {
        const next = lines[i]!;
        const marked = startsWith(next, QUOTE);
        lazy = !marked && continuesLazily(inner, next, lazy);
        if (!marked && !lazy) break;
        inner.push(marked ? quoted(next) : { ...next, lazy: true });
      }
      tokens.push({ type: "blockquote", children: tokenize(inner) });
      continue;
    }

    // List: its items, each Markdown of its own, as a quote is
    const item = itemStart(line);
    if (item) {
      const { tokens: items, next } = list(item, lines, i);
      tokens.push(...items);
      i = next;
      continue;
    }

    // HTML block: to the line that closes its kind, or to the end of its
    // container when none does; a closing blank line is left to what follows
    const html = htmlBlockAt(line);
    if (html) {
      const { end } = html;
      const closes = end === "blank" ? isBlank : (closing: Line) => end.test(body(closing));
      while (i < lines.length && !closes(lines[i]!)) i++;
      if (i < lines.length && end !== "blank") i++;
      tokens.push({ type: "html_block" });
      continue;
    }

    // Paragraph, or a setext heading when a line of `=` or `-` underlines it
    const { text, next } = continuation(lines, i);
    const setext = underline(lines[next]);
    tokens.push(
      setext
        ? { type: "heading", level: setext[1]!.startsWith("=") ? 1 : 2, text }
        : { type: "paragraph", text },
    );
    i = setext ? next + 1 : next;
  }

  return tokens;
}

/** One inline construct found at a position in a run of text, and the index just past it. */
type Inline =
  | { kind: "code"; code: string; end: number }
  | { kind: "emphasis"; style: "bold" | "italic"; inner: string; end: number }
  | { kind: "link"; inner: string; url: string; end: number }
  | { kind: "autolink"; source: string; url: string; end: number }
  | { kind: "image"; alt: string; src: string; end: number }
  | { kind: "literal"; text: string; end: number }
  | { kind: "html"; end: number };

const TICKS = /`+/y;
/** markdown-it's autolink: `<`, then text holding no `<` up to the first `>`. */
const AUTOLINK = /<([^<>]*)>/y;
/** What an autolink's text must be: a URI, scheme first, or an email address. */
const AUTOLINK_URI = /^[a-zA-Z][a-zA-Z0-9+.\-]{1,31}:[^<>\x00-\x20]*$/;
const AUTOLINK_EMAIL =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const ANGLED_DESTINATION = /\(\s*<([^<>\n]*)>/y;
const LINK_TAIL = /\s*(?:"[^"]*"|'[^']*'|\([^()]*\))?\s*\)/y;
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
 * `isValidEntityCode` refuses it: a surrogate, a noncharacter, a C0 or C1
 * control other than tab, line feed, form feed and carriage return, or
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
function referenceAt(text: string, i: number): Inline | undefined {
  const numeric = matchAt(NUMERIC_REFERENCE, text, i);
  if (numeric) {
    const chars = referencedCharacter(referencedCode(numeric[1]!)) ?? "\uFFFD";
    return { kind: "literal", text: chars, end: i + numeric[0].length };
  }
  const named = matchAt(NAMED_REFERENCE, text, i);
  if (!named) return undefined;
  const chars = namedReference(named[1]!);
  return chars === undefined ? undefined : { kind: "literal", text: chars, end: i + named[0].length };
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
 * Each `[` in `text` that a `]` closes, to the index of that `]`: brackets
 * nest, a backslash escapes the character after it, and a bracket inside a
 * code span, an autolink or inline HTML, which bind tighter than a link, is
 * not one. One
 * pass, so a run of text full of brackets that close nothing costs no more
 * than one without.
 */
function bracketPairs(text: string): ReadonlyMap<number, number> {
  const pairs = new Map<number, number>();
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "[") open.push(i);
    else if (text[i] === "]" && open.length > 0) pairs.set(open.pop()!, i);
    // Neither construct reads the brackets, so the pairs found so far serve.
    else if (text[i] === "`" || text[i] === "<") i = (inlineAt(text, i, pairs)?.end ?? i + 1) - 1;
  }
  return pairs;
}

/**
 * The `(destination "title")` of a link opening at `open`, as CommonMark reads
 * it: a destination in angle brackets, or a run of non-space characters whose
 * parentheses balance — so a URL may itself hold `(…)` — then an optional
 * quoted title, then the `)`. The destination, its backslash escapes and
 * character references read and then made an href as markdown-it makes one,
 * and the index past the `)` — or nothing, where markdown-it refuses that
 * href, and the brackets are no link.
 */
function linkDestination(text: string, open: number): { url: string; end: number } | undefined {
  if (text[open] !== "(") return undefined;
  const angled = matchAt(ANGLED_DESTINATION, text, open);
  let i: number;
  let url: string;
  if (angled) {
    url = angled[1]!;
    i = open + angled[0].length;
  } else {
    i = open + 1;
    while (text[i] === " ") i++;
    const from = i;
    for (let depth = 0; i < text.length && !/\s/.test(text[i]!) && !(text[i] === ")" && depth === 0); i++) {
      if (text[i] === "\\") i++;
      else if (text[i] === "(") depth++;
      else if (text[i] === ")") depth--;
    }
    url = text.slice(from, i);
  }
  const tail = matchAt(LINK_TAIL, text, i);
  if (!tail) return undefined;
  const href = linkHref(unescapeAll(url));
  return href === undefined ? undefined : { url: href, end: i + tail[0].length };
}

/**
 * The index of the `delimiter` that closes emphasis whose text starts at
 * `from`, after at least one character of it. Every other inline construct
 * binds tighter than emphasis, as CommonMark has it, so a delimiter inside an
 * escape, a code span, an autolink, inline HTML or a link closes nothing.
 */
function emphasisClose(text: string, from: number, delimiter: string, brackets: ReadonlyMap<number, number>): number | undefined {
  for (let i = from; i < text.length; ) {
    if (i > from && text.startsWith(delimiter, i)) return i;
    const tighter = text[i] === "*" ? undefined : inlineAt(text, i, brackets);
    i = tighter ? tighter.end : i + 1;
  }
  return undefined;
}

/**
 * The autolink whose `<` is at `i` in `text`, as markdown-it reads one: the
 * text up to the first `>`, holding no `<`, a URI or an email address that
 * links to `mailto:` it — and so long as markdown-it accepts that href.
 */
function autolinkAt(text: string, i: number): Inline | undefined {
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

/** The inline construct opening at `i` in `text`, if one does; `brackets` is `text`'s `bracketPairs`. */
function inlineAt(text: string, i: number, brackets: ReadonlyMap<number, number>): Inline | undefined {
  switch (text[i]) {
    case "`": {
      const ticks = matchAt(TICKS, text, i)![0];
      const close = new RegExp(`(?<!\`)${ticks}(?!\`)`, "g");
      close.lastIndex = i + ticks.length;
      const found = close.exec(text);
      return found
        ? { kind: "code", code: text.slice(i + ticks.length, found.index), end: found.index + ticks.length }
        : { kind: "literal", text: ticks, end: i + ticks.length };
    }
    case "*": {
      const strong = text.startsWith("**", i) ? emphasisClose(text, i + 2, "**", brackets) : undefined;
      const delimiter = strong === undefined ? "*" : "**";
      const close = strong ?? emphasisClose(text, i + 1, "*", brackets);
      return close === undefined
        ? undefined
        : {
            kind: "emphasis",
            style: strong === undefined ? "italic" : "bold",
            inner: text.slice(i + delimiter.length, close),
            end: close + delimiter.length,
          };
    }
    case "&":
      return referenceAt(text, i);
    case "\\": {
      const escape = matchAt(ESCAPE, text, i);
      return escape ? { kind: "literal", text: escape[1]!, end: i + escape[0].length } : undefined;
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
      const close = brackets.get(open);
      const destination = close === undefined ? undefined : linkDestination(text, close + 1);
      if (!destination) return undefined;
      const label = text.slice(open + 1, close);
      return image
        ? { kind: "image", alt: label, src: destination.url, end: destination.end }
        : { kind: "link", inner: label, url: destination.url, end: destination.end };
    }
    default:
      return undefined;
  }
}

/**
 * `text` as inline Markdown in `style`: a text of its own whose style sits
 * under every style inside it, so appended where it goes it draws as Rich
 * draws a nested construct — the inner style on top.
 */
function styled(text: string, style: string | Style, settings: InlineSettings, options: RenderOptions): RichText {
  const result = new RichText("", { style });
  appendInline(result, text, settings, options);
  return result;
}

/**
 * `label` linked to `url`, appended to `result` as Rich draws a link: the
 * label is the link, or without hyperlinks nothing is, and the label's text
 * is written plain with the URL after it, for a reader who cannot click it.
 */
function appendLink(result: RichText, label: RichText, url: string, settings: InlineSettings): void {
  if (settings.hyperlinks) {
    result.append(new RichText("", { style: new Style({ link: url }) }).append(new RichText("", { style: "markdown.link_url" }).append(label)));
  } else {
    result.append(label.plain, "markdown.link").append(" (").append(url, "markdown.link_url").append(")");
  }
}

/**
 * `text` as inline Markdown appended to `result`: code spans, emphasis,
 * links, autolinks and images, the text inside emphasis and links parsed the
 * same way, a backslash escape as the character it escapes, a character
 * reference as the characters it names, inline HTML as nothing, and
 * everything else as it is.
 */
function appendInline(result: RichText, text: string, settings: InlineSettings, options: RenderOptions): void {
  const brackets = bracketPairs(text);
  let plain = 0;
  for (let i = 0; i < text.length; ) {
    const found = inlineAt(text, i, brackets);
    if (!found) {
      i++;
      continue;
    }
    result.append(text.slice(plain, i));
    switch (found.kind) {
      case "code":
        result.append(found.code, groundedStyle(options, resolveStyle(options, settings.inlineCodeStyle)));
        break;
      case "literal":
        result.append(found.text);
        break;
      case "html":
        // Rich draws nothing for inline HTML.
        break;
      case "emphasis":
        result.append(styled(found.inner, found.style, settings, options));
        break;
      case "link":
        appendLink(result, styled(found.inner, "", settings, options), found.url, settings);
        break;
      case "autolink":
        // Its text is the URL as written, never parsed as Markdown.
        appendLink(result, new RichText(normalizeLinkText(found.source)), found.url, settings);
        break;
      case "image": {
        // Rich's ImageItem: a picture glyph, then the alt text as written,
        // never parsed as Markdown — or, with none, the image's file name —
        // linked to the image, then a space.
        const title = found.alt || (found.src.replace(/\/+$/, "").split("/").pop() ?? "");
        const link = settings.hyperlinks ? new Style({ link: found.src }) : "";
        result.append(drawable(options, "🌆 ", "")).append(title, link).append(" ");
        break;
      }
    }
    i = plain = found.end;
  }
  result.append(text.slice(plain));
}

/**
 * What `draw` renders in what is left of the width beside a gutter, each of
 * its rows ended. The first row's gutter is `first` and every later row's is
 * `rest`, so a list item's text hangs clear of its bullet and a quote's bar
 * runs its full height. A block with no gutter passes two empty segments:
 * every block is laid out the same way. What is drawn keeps at least one
 * column however wide the gutter, so a row may overrun its width but no gutter
 * swallows what it introduces.
 */
function* guttered(
  draw: (options: RenderOptions) => Iterable<Segment>,
  options: RenderOptions,
  first: Segment,
  rest: Segment,
  style?: Style,
): Iterable<Segment> {
  const width = Math.max(1, options.maxWidth - cellLen(first.text));
  const rows = Segment.splitLines(Segment.applyStyle([...draw({ ...options, maxWidth: width })], style));
  for (const [row, line] of rows.entries()) {
    yield row === 0 ? first : rest;
    yield* line;
    yield Segment.line();
  }
}

/**
 * `text` as inline Markdown, placed by `justify` in `style`, wrapped, with
 * every row ended. `style` is a span under the inline spans, as Rich's
 * element style is, not the text's base: placement pads in the base style,
 * and a heading's padding is not underlined.
 */
function inline(
  text: string,
  settings: InlineSettings,
  justify: Justify | undefined,
  style?: Style,
): (options: RenderOptions) => Iterable<Segment> {
  return function* (options) {
    const body = new RichText("", { end: "", style });
    appendInline(body, text, settings, options);
    // `append` lays the body's base style down as the first span.
    yield* new RichText("", { end: "", justify }).append(body).render(options);
    yield Segment.line();
  };
}

const NO_GUTTER = new Segment("");

/**
 * Each block in `tokens`, every row it draws ended, body text placed by
 * `settings.justify`. A heading keeps its own placement whatever `settings`
 * or `options` say — Rich's: an h1 centred, every other level left — and its
 * style stops where its text does.
 */
function* renderTokens(tokens: readonly MdToken[], options: RenderOptions, settings: BlockSettings): Iterable<Segment> {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const style = getStyle(options, `markdown.h${Math.min(token.level, 4)}`);
        const draw = inline(token.text, settings, token.level === 1 ? "center" : undefined, style);
        yield* guttered(draw, { ...options, justify: undefined }, NO_GUTTER, NO_GUTTER);
        break;
      }

      case "paragraph": {
        yield* guttered(inline(token.text, settings, settings.justify), options, NO_GUTTER, NO_GUTTER);
        break;
      }

      case "code_block": {
        const codeStyle = groundedStyle(options, getStyle(options, "markdown.code"));
        // Tabs expanded here, as `Syntax` expands them, since a terminal would
        // count a raw one from its own column 0 and not the code's.
        for (const line of expandTabs(token.code, CODE_TAB_SIZE).text.split("\n")) {
          yield new Segment(line, codeStyle);
          yield Segment.line();
        }
        break;
      }

      case "hr": {
        const rule = new Rule(undefined, { style: "markdown.hr" });
        yield* rule.render(options);
        break;
      }

      case "list_item": {
        const marker = token.marker.kind === "number" ? `${token.marker.label} ` : drawable(options, "  • ", "  * ");
        const hang = new Segment(" ".repeat(cellLen(marker)));
        const body = (inner: RenderOptions) => renderTokens(token.children, inner, settings);
        yield* guttered(body, options, new Segment(marker), hang);
        break;
      }

      case "blockquote": {
        const bar = new Segment(drawable(options, "▎ ", "| "), getStyle(options, "markdown.hr"));
        const body = (inner: RenderOptions) => renderTokens(token.children, inner, settings);
        yield* guttered(body, options, bar, bar, Style.parse("dim italic"));
        break;
      }

      case "table": {
        // Rich's TableElement: each cell inline Markdown placed by its
        // column's alignment, the header's in `markdown.table.header` on top.
        const cell = (text: string, justify: CellAlign): RichText => {
          const content = new RichText("", { justify });
          appendInline(content, text, settings, options);
          return content;
        };
        const table = new Table({ box: SIMPLE, padEdge: false, style: "markdown.table.border", showEdge: true, collapsePadding: true });
        for (const { header, align } of token.columns) table.addColumn(cell(header, align).stylize("markdown.table.header"));
        for (const row of token.rows) table.addRow(...row.map((text, n) => cell(text, token.columns[n]!.align)));
        yield* table.render(options);
        break;
      }

      case "html_block":
        // Rich draws nothing for one.
        break;

      case "blank":
        yield Segment.line();
        break;
    }
  }
}

export class Markdown implements Renderable, Measurable {
  readonly markdown: string;
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;
  readonly justify: Justify;

  constructor(markdown: string, options?: MarkdownOptions) {
    this.markdown = markdown;
    this.inlineCodeStyle = options?.inlineCodeStyle ?? "markdown.code";
    this.hyperlinks = options?.hyperlinks !== false;
    this.justify = options?.justify ?? "left";
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    // Every block below is one of a stack.
    const options = { ...rawOptions, height: stackedHeight(rawOptions.height) };
    const lines = this.markdown.split(/\r?\n/).map((text): Line => ({ text, margin: 0, lazy: false }));
    yield* renderTokens(tokenize(lines), options, this);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
