/**
 * Markdown — renders Markdown content to the terminal.
 * Uses built-in parsing (no external dependency).
 *
 * Block structure is read as CommonMark reads it: a blockquote and a list
 * item are both containers, their lines tokenized as Markdown of their own
 * once the container's marker or indentation is cut off, and drawn beside a
 * gutter — the quote's bar, the item's marker then its hang. Where CommonMark
 * leaves the drawing open, Rich's is followed.
 */

import { cellLen, expandTabs, parseTabSize } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { RichText } from "../core/text.js";
import { Rule } from "./rule.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle, stackedHeight } from "../core/protocol.js";

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

type MdToken =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code_block"; code: string }
  | { type: "hr" }
  | { type: "list_item"; marker: ItemMarker; children: MdToken[] }
  | { type: "blockquote"; children: MdToken[] }
  | { type: "blank" };

/**
 * A source line inside the container that holds it: the line as written, with
 * every container marker it sat behind blanked to spaces so its columns are
 * still the source's, and `margin`, the column its container's content starts
 * at. Columns are counted from the source's column 0, so a tab reaches the
 * stop it reaches in the source however deep the line is nested.
 */
interface Line {
  readonly text: string;
  readonly margin: number;
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
/** Indentation that makes a line indented code when it opens a block, as CommonMark counts it. */
const CODE_INDENT = 4;
/** The tab stop code is drawn with, as Rich's `Syntax` draws it. */
const CODE_TAB_SIZE = parseTabSize(8);
const BLANK_LINE: Line = { text: "", margin: 0 };

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
    first: rest === "" ? undefined : { text: lead + " ".repeat(m[0].length) + after, margin: content },
  };
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
  return { text: `${line.text.slice(0, at)} ${line.text.slice(at + 1)}`, margin: leadEnd(line) + 1 + (spaced ? 1 : 0) };
}

/**
 * Whether `line` opens a block of its own — a heading, a fence, a quote, a
 * rule or a list item. A line that does not is text, and under an open
 * paragraph it continues that paragraph.
 */
function opensBlock(line: Line): boolean {
  return BLOCK_STARTS.some((re) => startsWith(line, re)) || itemStart(line) !== undefined;
}

/**
 * Whether `line` ends a paragraph: `opensBlock`, read as CommonMark reads it
 * under a paragraph. Indented code cannot interrupt one; a list item does only
 * when it has text and, numbered, counts from 1, so prose wrapped onto "2024.
 * That year" stays prose; and a line of `=` or `-` is the paragraph's heading
 * underline.
 */
function endsParagraph(line: Line): boolean {
  if (startsWith(line, SETEXT)) return true;
  const item = itemStart(line);
  return item ? item.first !== undefined && (item.bullet !== undefined || item.start === 1) : opensBlock(line);
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
 * blank or a line that ends a paragraph, and the index of the line that ended
 * it. Soft-broken lines are joined by one space, as a Markdown renderer
 * reflows them, with their own indentation dropped; a line ending in two
 * spaces or a backslash breaks hard, and its break is kept.
 */
function continuation(lines: readonly Line[], start: number): { text: string; next: number } {
  const parts = [lines[start]!.text];
  let i = start + 1;
  for (; i < lines.length && !isBlank(lines[i]!) && !endsParagraph(lines[i]!); i++) parts.push(lines[i]!.text);
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
    inner.push(held ? { text: line.text, margin: item.content } : line);
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
        inner.push(marked ? quoted(next) : next);
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

    // Paragraph, or a setext heading when a line of `=` or `-` underlines it
    const { text, next } = continuation(lines, i);
    const underline = next < lines.length && indentOf(lines[next]!) < CODE_INDENT ? SETEXT.exec(body(lines[next]!)) : null;
    tokens.push(
      underline
        ? { type: "heading", level: underline[1]!.startsWith("=") ? 1 : 2, text }
        : { type: "paragraph", text },
    );
    i = underline ? next + 1 : next;
  }

  return tokens;
}

/** One inline construct found at a position in a run of text, and the index just past it. */
type Inline =
  | { kind: "code"; code: string; end: number }
  | { kind: "emphasis"; style: "bold" | "italic"; inner: string; end: number }
  | { kind: "link"; inner: string; url: string; end: number }
  | { kind: "image"; alt: string; src: string; end: number }
  | { kind: "literal"; text: string; end: number };

const TICKS = /`+/y;
const STRONG = /\*\*(.+?)\*\*/y;
const EMPHASIS = /\*(.+?)\*/y;
const ANGLED_DESTINATION = /\(\s*<([^<>\n]*)>/y;
const LINK_TAIL = /\s*(?:"[^"]*"|'[^']*'|\([^()]*\))?\s*\)/y;

/** `re`, a sticky pattern, matched exactly at `i` in `text`. */
function matchAt(re: RegExp, text: string, i: number): RegExpExecArray | null {
  re.lastIndex = i;
  return re.exec(text);
}

/**
 * Each `[` in `text` that a `]` closes, to the index of that `]`: brackets
 * nest, and a backslash escapes the character after it. One pass, so a run of
 * text full of brackets that close nothing costs no more than one without.
 */
function bracketPairs(text: string): ReadonlyMap<number, number> {
  const pairs = new Map<number, number>();
  const open: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\") i++;
    else if (text[i] === "[") open.push(i);
    else if (text[i] === "]" && open.length > 0) pairs.set(open.pop()!, i);
  }
  return pairs;
}

/**
 * The `(destination "title")` of a link opening at `open`, as CommonMark reads
 * it: a destination in angle brackets, or a run of non-space characters whose
 * parentheses balance — so a URL may itself hold `(…)` — then an optional
 * quoted title, then the `)`. The destination and the index past the `)`.
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
  return tail ? { url, end: i + tail[0].length } : undefined;
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
      const strong = matchAt(STRONG, text, i);
      const emphasis = strong ?? matchAt(EMPHASIS, text, i);
      return emphasis
        ? { kind: "emphasis", style: strong ? "bold" : "italic", inner: emphasis[1]!, end: i + emphasis[0].length }
        : undefined;
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
 * `text` as inline Markdown appended to `result`: code spans, emphasis, links
 * and images, the text inside emphasis, links and images parsed the same way,
 * and everything else as it is.
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
        result.append(found.code, settings.inlineCodeStyle);
        break;
      case "literal":
        result.append(found.text);
        break;
      case "emphasis":
        result.append(styled(found.inner, found.style, settings, options));
        break;
      case "link": {
        // As Rich draws it: without hyperlinks the URL is written out, and it
        // is still the link, for a terminal that can click it.
        const link = new RichText("", { style: new Style({ link: found.url }) });
        if (settings.hyperlinks) {
          result.append(link.append(styled(found.inner, "markdown.link_url", settings, options)));
        } else {
          result
            .append(styled(found.inner, "markdown.link", settings, options))
            .append(" (")
            .append(link.append(found.url, "markdown.link_url"))
            .append(")");
        }
        break;
      }
      case "image": {
        // Rich's ImageItem: a picture glyph, then the alt text — or, with
        // none, the image's file name — linked to the image, then a space.
        const title = found.alt || (found.src.replace(/\/+$/, "").split("/").pop() ?? "");
        const link = settings.hyperlinks ? new Style({ link: found.src }) : "";
        result.append(drawable(options, "🌆 ", "")).append(styled(title, link, settings, options)).append(" ");
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
 * every row ended. `style` is the text's own, so placement pads beside it
 * rather than in it.
 */
function inline(
  text: string,
  settings: InlineSettings,
  justify: Justify | undefined,
  style?: Style,
): (options: RenderOptions) => Iterable<Segment> {
  return function* (options) {
    const result = new RichText("", { end: "", justify, style });
    appendInline(result, text, settings, options);
    yield* result.render(options);
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
        const codeStyle = getStyle(options, "markdown.code");
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
    const lines = this.markdown.split(/\r?\n/).map((text): Line => ({ text, margin: 0 }));
    yield* renderTokens(tokenize(lines), options, this);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
