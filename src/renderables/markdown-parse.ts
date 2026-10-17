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
import { namedReference } from "./html-entities.js";

/** Where a table column's cells sit, from the colons on its delimiter cell. None is GFM's no alignment, which Rich leaves to its column: left. */
export type CellAlign = "left" | "center" | "right" | undefined;

interface TableColumn<Text> {
  readonly header: Text;
  readonly align: CellAlign;
}

/** A list item: the blank lines that separated it from the item before, and its blocks. */
interface ListItem<Text = readonly Inline[]> {
  readonly gap: number;
  readonly children: readonly MdToken<Text>[];
}

/**
 * A block, its text as `Text`: the source's own text after the block pass,
 * and that text read into inlines after the inline pass, which is what
 * `parseMarkdown` hands back.
 */
export type MdToken<Text = readonly Inline[]> =
  | { type: "heading"; level: number; text: Text }
  | { type: "paragraph"; text: Text }
  | { type: "code_block"; code: string }
  | { type: "hr" }
  /** `start` is an ordered list's first number, as its source writes it; a bullet list has none. */
  | { type: "list"; start: number | undefined; items: readonly ListItem<Text>[] }
  | { type: "blockquote"; children: readonly MdToken<Text>[] }
  /** Each row holds one cell per column: a short row filled out with empty cells, a long one cut. */
  | { type: "table"; columns: readonly TableColumn<Text>[]; rows: readonly (readonly Text[])[] }
  /** Kept, though nothing draws it, so a container ending in one does not end in the paragraph before it. */
  | { type: "html_block" }
  /**
   * A container's content past `MAX_NESTING`, which markdown-it skips unread,
   * or the lines after a list whose item that deep took every one of them.
   * Kept, though nothing draws it, so a line after it continues the container
   * as markdown-it's would: `open` where the last line skipped has text.
   */
  | { type: "unread"; open: boolean }
  | { type: "blank" };

/**
 * CommonMark's inlines, as one block's text reads: a code span, emphasis or a
 * link holding inlines of its own, an autolink, an image, inline HTML, a line
 * ending, and text — a backslash escape and a character reference already the
 * characters they stand for.
 */
export type Inline =
  | { kind: "text"; text: string }
  | { kind: "code"; code: string }
  | { kind: "emphasis"; style: "bold" | "italic"; children: readonly Inline[] }
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
function tableAt(lines: readonly Line[], start: number): TableColumn<string>[] | undefined {
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
function endsInParagraph(tokens: readonly MdToken<string>[]): boolean {
  const last = tokens[tokens.length - 1];
  switch (last?.type) {
    case "paragraph":
      return true;
    case "list":
      return endsInParagraph(last.items[last.items.length - 1]!.children);
    case "blockquote":
      return endsInParagraph(last.children);
    case "unread":
      return last.open;
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
 * it, not one each. `level` is the container's content's, as `tokenize` takes it.
 */
function continuesLazily(inner: readonly Line[], level: number, line: Line, afterLazy: boolean): boolean {
  return !isBlank(line) && !opensBlock(line) && (afterLazy || endsInParagraph(tokenize(inner, level)));
}

/**
 * The text of the paragraph begun at `start`, every line after it up to a
 * blank, a line that ends a paragraph or a table's header row, and the index of the line that ended
 * it. The lines are joined at their line endings as written, each with its
 * own indentation dropped, as markdown-it's paragraph content is: whether a
 * line ending breaks soft or hard is the inline pass's to read, since an
 * escape or a code span decides it.
 */
function continuation(lines: readonly Line[], start: number): { text: string; next: number } {
  const parts = [lines[start]!.text];
  let i = start + 1;
  for (; i < lines.length && !isBlank(lines[i]!) && !endsParagraph(lines[i]!) && !tableAt(lines, i); i++) parts.push(lines[i]!.text);
  return { text: parts.map((part) => part.trimStart()).join("\n").trimEnd(), next: i };
}

/**
 * The lines of the list item opened at `start` — every line after it that is
 * blank, indented to the content column, or a lazy continuation — and the
 * index of the line that ended it. Blank lines trailing the item are left to
 * whatever follows it, and an item that opens with a blank line ends at the
 * next one: it is empty. `level` is the item's content's.
 */
function itemLines(item: ItemStart, level: number, lines: readonly Line[], start: number): { inner: Line[]; next: number } {
  const inner = item.first === undefined ? [] : [item.first];
  let lazy = false;
  let i = start + 1;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const blank = isBlank(line);
    if (blank && inner.length === 0) break;
    const held = blank || leadEnd(line) >= item.content;
    lazy = !held && continuesLazily(inner, level, line, lazy);
    if (!held && !lazy) break;
    inner.push(held ? { text: line.text, margin: item.content, lazy: false } : { ...line, lazy: true });
  }
  for (; inner.length > 0 && isBlank(inner[inner.length - 1]!); i--) inner.pop();
  return { inner, next: i };
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
function swallowsRest(children: readonly MdToken<string>[]): boolean {
  return children[children.length - 1]?.type === "unread";
}

/**
 * The list opened at `start`, at `level`: each item holding its blocks, and
 * the blank lines that separated it from the item before — and, where an item
 * swallowed the rest of `lines`, the `unread` they are, ending where they do.
 */
function list(first: ItemStart, level: number, lines: readonly Line[], start: number): { tokens: MdToken<string>[]; next: number } {
  const items: { gap: number; children: MdToken<string>[] }[] = [];
  let i = start;
  let gap = 0;
  let swallowed = false;
  for (
    let item: ItemStart | undefined = first;
    item && sameList(first, item);
    item = i < lines.length ? itemStart(lines[i]!) : undefined
  ) {
    // A list and its item each nest a level, as markdown-it's tokens do.
    const { inner, next } = itemLines(item, level + 2, lines, i);
    const children = tokenize(inner, level + 2);
    items.push({ gap, children });
    swallowed = swallowsRest(children);
    const end = swallowed ? lines.length : next;
    let after = end;
    while (after < lines.length && isBlank(lines[after]!)) after++;
    gap = after - end;
    i = after;
  }
  const token: MdToken<string> = { type: "list", start: first.bullet === undefined ? first.start : undefined, items };
  if (swallowed) return { tokens: [token, { type: "unread", open: !isBlank(lines[lines.length - 1]!) }], next: lines.length };
  // The blank lines after the last item belong to whatever follows the list.
  return { tokens: [token], next: i - gap };
}

/**
 * `lines` read into blocks at `level`, how deep in containers they sit. At
 * `MAX_NESTING` markdown-it's block pass reads nothing, and neither does this:
 * it skips blank lines before it checks the level, so only content with text
 * in it is left unread.
 */
function tokenize(lines: readonly Line[], level: number): MdToken<string>[] {
  if (level >= MAX_NESTING) return lines.every(isBlank) ? [] : [{ type: "unread", open: !isBlank(lines[lines.length - 1]!) }];
  const tokens: MdToken<string>[] = [];
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
        lazy = !marked && continuesLazily(inner, level + 1, next, lazy);
        if (!marked && !lazy) break;
        inner.push(marked ? quoted(next) : { ...next, lazy: true });
      }
      tokens.push({ type: "blockquote", children: tokenize(inner, level + 1) });
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

/**
 * A run of one emphasis marker, as markdown-it's `scanDelims` reads it: whether
 * it can open emphasis, close it, or both, decided once by what borders it.
 */
interface DelimiterRun {
  readonly kind: "delimiters";
  readonly marker: "*" | "_";
  readonly length: number;
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
  readonly marker: "*" | "_";
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
 * one block's text. A link's label may hold no link: a `[` it meets that
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
const STEP_STOPS = new Set(["`", "*", "_", "&", "\n", "\\", "<", "!", "[", "]"]);

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
    while (text[i] === " " || text[i] === "\t" || text[i] === "\n") i++;
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

/** The character before `i` in `text`, a surrogate pair whole, or a space at its start, as `scanDelims` reads the line. */
function charBefore(text: string, i: number): string {
  if (i === 0) return " ";
  return i >= 2 && text.codePointAt(i - 2)! > 0xffff ? text.slice(i - 2, i) : text[i - 1]!;
}

/**
 * The run of `*` or `_` starting at `i` in `text`, as markdown-it's
 * `scanDelims` reads it. A run is left-flanking where what follows it is no
 * space, and is punctuation only if what precedes it is a space or
 * punctuation too; right-flanking is the mirror. A `*` run opens where it is
 * left-flanking and closes where it is right-flanking; a `_` run may not do
 * either inside a word.
 */
function delimiterRun(text: string, i: number): DelimiterRun {
  const marker = text[i] as "*" | "_";
  let end = i;
  while (text[end] === marker) end++;
  const before = charBefore(text, i);
  const after = end < text.length ? String.fromCodePoint(text.codePointAt(end)!) : " ";
  const [spaceBefore, spaceAfter] = [WHITESPACE.test(before), WHITESPACE.test(after)];
  const [punctBefore, punctAfter] = [PUNCTUATION.test(before), PUNCTUATION.test(after)];
  const left = !spaceAfter && (!punctAfter || spaceBefore || punctBefore);
  const right = !spaceBefore && (!punctBefore || spaceAfter || punctAfter);
  const inWord = marker === "*";
  return {
    kind: "delimiters",
    marker,
    length: end - i,
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
  const openersBottom = { "*": [-1, -1, -1, -1, -1, -1], _: [-1, -1, -1, -1, -1, -1] };
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
 * markdown-it's emphasis `postProcess` makes them: innermost pair first, a pair
 * strong where the pair enclosing it is of the same marker and touches it at
 * both ends, so the two are spent as one, and italic otherwise. A delimiter
 * left unpaired is the text it is, joined to the text beside it as
 * markdown-it's `fragments_join` joins it, so a run of text between line
 * endings is one piece.
 */
function emphasized(pieces: readonly Inline[], delimiters: readonly Delimiter[]): Inline[] {
  const roles = new Map<number, "bold" | "italic" | "close" | "spent">();
  for (let i = delimiters.length - 1; i >= 0; i--) {
    const opener = delimiters[i]!;
    if (opener.end < 0) continue;
    const closer = delimiters[opener.end]!;
    const outer = delimiters[i - 1];
    const strong =
      outer !== undefined &&
      outer.end === opener.end + 1 &&
      outer.marker === opener.marker &&
      outer.piece === opener.piece - 1 &&
      delimiters[opener.end + 1]!.piece === closer.piece + 1;
    roles.set(opener.piece, strong ? "bold" : "italic").set(closer.piece, "close");
    if (strong) {
      roles.set(outer.piece, "spent").set(delimiters[opener.end + 1]!.piece, "spent");
      i--;
    }
  }
  const open: Inline[][] = [[]];
  const styles: ("bold" | "italic")[] = [];
  for (const [p, piece] of pieces.entries()) {
    const role = roles.get(p);
    switch (role) {
      case "bold":
      case "italic":
        styles.push(role);
        open.push([]);
        break;
      case "close": {
        const children = open.pop()!;
        open.at(-1)!.push({ kind: "emphasis", style: styles.pop()!, children });
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

/** The inline construct opening at `i` in `text`, if one does, read at `level` with `labels` scanning a link's label. */
function inlineAt(text: string, i: number, labels: LinkLabels, level: number): InlineMatch | undefined {
  switch (text[i]) {
    case "`": {
      const ticks = matchAt(TICKS, text, i)![0];
      const close = new RegExp(`(?<!\`)${ticks}(?!\`)`, "g");
      close.lastIndex = i + ticks.length;
      const found = close.exec(text);
      // A code span's line endings are spaces, as markdown-it's backticks rule has them.
      return found
        ? { kind: "code", code: text.slice(i + ticks.length, found.index).replaceAll("\n", " "), end: found.index + ticks.length }
        : { kind: "text", text: ticks, end: i + ticks.length };
    }
    case "*":
    case "_":
      return delimiterRun(text, i);
    case "&":
      return referenceAt(text, i);
    case "\n":
      return { kind: "line_ending", end: i + 1 };
    case "\\": {
      // markdown-it's escape rule: a backslash before a line ending breaks it
      // hard, and one before anything else takes that character with it, the
      // pair standing as written unless it escapes — so a space after it
      // counts toward no hard break.
      if (text[i + 1] === "\n") return { kind: "hardbreak", end: i + 2 };
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
      const destination = linkDestination(text, close + 1);
      if (!destination) return undefined;
      return image
        ? { kind: "image", alt: text.slice(open + 1, close), src: destination.url, end: destination.end }
        : { kind: "link", label: open + 1, close, url: destination.url, end: destination.end };
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
      for (let k = 0; k < found.length; k++) {
        delimiters.push({ marker: found.marker, length: found.length, piece: pieces.length, open: found.canOpen, close: found.canClose, end: -1 });
        pieces.push({ kind: "text", text: found.marker });
      }
    } else pieces.push(matched(found, text, labels, level));
    i = plain = found.end;
  }
  if (plain < text.length) pieces.push({ kind: "text", text: text.slice(plain) });
  balancePairs(delimiters);
  return emphasized(pieces, delimiters);
}

/** `text` read into inlines from its start. */
function parseInline(text: string): Inline[] {
  return inlines(text, 0, new LinkLabels(), 0);
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

/** `token` with its text, and the text of every block inside it, read into inlines: markdown-it's inline pass. */
function inlined(token: MdToken<string>): MdToken {
  switch (token.type) {
    case "heading":
    case "paragraph":
      return { ...token, text: parseInline(token.text) };
    case "list":
      return { ...token, items: token.items.map((item) => ({ ...item, children: item.children.map(inlined) })) };
    case "blockquote":
      return { ...token, children: token.children.map(inlined) };
    case "table":
      return {
        ...token,
        columns: token.columns.map((column) => ({ ...column, header: parseInline(column.header) })),
        rows: token.rows.map((row) => row.map(parseInline)),
      };
    default:
      return token;
  }
}

/** `source` read as Markdown: its blocks, and the text in each read into inlines. */
export function parseMarkdown(source: string): MdToken[] {
  const lines = source.split(/\r?\n/).map((text): Line => ({ text, margin: 0, lazy: false }));
  return tokenize(lines, 0).map(inlined);
}
