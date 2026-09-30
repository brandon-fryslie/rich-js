/**
 * Markdown — renders Markdown content to the terminal.
 * Uses built-in parsing (no external dependency).
 */

import { cellLen } from "../core/cells.js";
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
  /** How body text — paragraphs, list items, quotes — is placed in its width. Headings keep their own. */
  justify?: "left" | "center" | "right" | "full";
}

/** What the options say about the text inside blocks, which every block's text is drawn with. */
interface InlineSettings {
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;
  readonly justify: MarkdownOptions["justify"];
}

// Simple markdown token types
type MdToken =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code_block"; language: string; code: string }
  | { type: "hr" }
  | { type: "list_item"; ordered: boolean; index: number; indent: number; text: string }
  | { type: "blockquote"; children: MdToken[] }
  | { type: "blank" };

const HEADING = /^(#{1,6})\s+(.+)$/;
const RULE = /^(?:---+|===+|\*\*\*+)$/;
const SETEXT = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE = /^```(\w*)/;
const QUOTE = /^> ?/;
const BULLET = /^(\s*)([*\-+])\s+(.+)$/;
const NUMBERED = /^(\s*)(\d+)\.\s+(.+)$/;
const HARD_BREAK = /(?: {2,}|\\)$/;
const BLOCK_STARTS = [HEADING, FENCE, QUOTE, BULLET, NUMBERED];

/**
 * Whether `line` opens a block of its own. It is what ends a list item, and
 * with `endsParagraph`'s two readings a paragraph: every line up to the next
 * blank or the next block start belongs to the one before it. A hard-wrapped
 * source line is a soft break, not a block, so the source's own line breaks
 * never reach the screen.
 */
function opensBlock(line: string): boolean {
  return BLOCK_STARTS.some((re) => re.test(line)) || RULE.test(line.trim());
}

/**
 * Whether `line` ends a paragraph: `opensBlock`, read as CommonMark reads it
 * under a paragraph. A numbered item interrupts one only when it counts from
 * 1, so prose wrapped onto "2024. That year" stays prose, and a line of `=` or
 * `-` is the paragraph's heading underline.
 */
function endsParagraph(line: string): boolean {
  const numbered = NUMBERED.exec(line);
  return numbered ? parseInt(numbered[2]!, 10) === 1 : opensBlock(line) || SETEXT.test(line);
}

/**
 * Whether `line` ends a list item whose marker sits at column `indent`:
 * `opensBlock`, except that a numbered line indented past the marker is the
 * item's own text, read as `endsParagraph` reads it, unless it counts from 1.
 */
function endsItem(indent: number): (line: string) => boolean {
  return (line) => {
    const numbered = NUMBERED.exec(line);
    return numbered ? columns(numbered[1]!) <= indent || parseInt(numbered[2]!, 10) === 1 : opensBlock(line);
  };
}

/** The columns a run of leading whitespace spans, a tab reaching the next stop of 4 as CommonMark counts it. */
function columns(indent: string): number {
  return [...indent].reduce((col, ch) => (ch === "\t" ? col + 4 - (col % 4) : col + 1), 0);
}

/**
 * The text of the block begun at `start` — `first`, then every line after it
 * up to a blank or a line `ends` says opens another block — and the index of
 * the line that ended it. Soft-broken lines are joined by one space, as a
 * Markdown renderer reflows them, with their own indentation dropped; a line
 * ending in two spaces or a backslash breaks hard, and its break is kept.
 */
function continuation(
  first: string,
  lines: readonly string[],
  start: number,
  ends: (line: string) => boolean,
): { text: string; next: number } {
  const parts = [first];
  let i = start + 1;
  for (; i < lines.length && lines[i]!.trim() !== "" && !ends(lines[i]!); i++) parts.push(lines[i]!);
  const text = parts
    .map((part, n) => {
      const words = (n === parts.length - 1 ? part : part.replace(HARD_BREAK, "")).trim();
      return n === 0 ? words : (HARD_BREAK.test(parts[n - 1]!) ? "\n" : " ") + words;
    })
    .join("");
  return { text, next: i };
}

function tokenize(markdown: string): MdToken[] {
  const lines = markdown.split(/\r?\n/);
  const tokens: MdToken[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Blank line
    if (line.trim() === "") {
      tokens.push({ type: "blank" });
      i++;
      continue;
    }

    // Heading
    const headingMatch = HEADING.exec(line);
    if (headingMatch) {
      tokens.push({ type: "heading", level: headingMatch[1]!.length, text: headingMatch[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (RULE.test(line.trim())) {
      tokens.push({ type: "hr" });
      i++;
      continue;
    }

    // Fenced code block
    const codeMatch = FENCE.exec(line);
    if (codeMatch) {
      const lang = codeMatch[1] ?? "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith("```")) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      tokens.push({ type: "code_block", language: lang, code: codeLines.join("\n") });
      continue;
    }

    // Blockquote: Markdown of its own — its `>` lines with the marker cut off,
    // and any unmarked line lazily continuing the paragraph open inside it
    if (QUOTE.test(line)) {
      const inner: string[] = [];
      for (; i < lines.length; i++) {
        const next = lines[i]!;
        const marked = QUOTE.test(next);
        const lazy = !marked && next.trim() !== "" && inner[inner.length - 1]!.trim() !== "" && !endsParagraph(next);
        if (!marked && !lazy) break;
        inner.push(next.replace(QUOTE, ""));
      }
      tokens.push({ type: "blockquote", children: tokenize(inner.join("\n")) });
      continue;
    }

    // List item: the marker line and every line continuing it. Its leading
    // whitespace is its nesting, kept as columns so a nested item sits under its parent.
    const listMatch = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (listMatch) {
      const ordered = NUMBERED.test(line);
      const indent = columns(listMatch[1]!);
      const { text, next } = continuation(listMatch[3]!, lines, i, endsItem(indent));
      tokens.push({
        type: "list_item",
        ordered,
        index: ordered ? parseInt(listMatch[2]!, 10) : 0,
        indent,
        text,
      });
      i = next;
      continue;
    }

    // Paragraph, or a setext heading when a line of `=` or `-` underlines it
    const { text, next } = continuation(line, lines, i, endsParagraph);
    const underline = SETEXT.exec(lines[next] ?? "");
    tokens.push(
      underline
        ? { type: "heading", level: underline[1]!.startsWith("=") ? 1 : 2, text }
        : { type: "paragraph", text },
    );
    i = underline ? next + 1 : next;
  }

  return tokens;
}

function applyInlineStyles(text: string, settings: InlineSettings, justify: MarkdownOptions["justify"]): RichText {
  const result = new RichText("", { end: "", justify });

  // Process inline patterns
  const inlineRe = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRe.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIdx) {
      result.append(text.slice(lastIdx, match.index));
    }

    if (match[2]) {
      // Bold: **text**
      result.append(match[2], "bold");
    } else if (match[3]) {
      // Italic: *text*
      result.append(match[3], "italic");
    } else if (match[4]) {
      // Inline code: `text`
      result.append(match[4], settings.inlineCodeStyle);
    } else if (match[5] && match[6]) {
      // Link: [text](url). As Rich draws it: without hyperlinks the URL is
      // written out, and it is still the link, for a terminal that can click it.
      const link = new Style({ link: match[6] });
      if (settings.hyperlinks) {
        result.append(match[5], "markdown.link_url").stylize(link, -match[5].length);
      } else {
        result.append(match[5], "markdown.link").append(" (");
        result.append(match[6], "markdown.link_url").stylize(link, -match[6].length);
        result.append(")");
      }
    }

    lastIdx = match.index + match[0].length;
  }

  // Remaining text
  if (lastIdx < text.length) {
    result.append(text.slice(lastIdx));
  }

  return result;
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
 * `text` as inline Markdown, wrapped, with every row ended — its last one
 * too, so `splitLines` counts it even when the text is empty, and an empty
 * item still draws its bullet.
 */
function inline(
  text: string,
  settings: InlineSettings,
  justify: MarkdownOptions["justify"],
): (options: RenderOptions) => Iterable<Segment> {
  return function* (options) {
    yield* applyInlineStyles(text, settings, justify).render(options);
    yield Segment.line();
  };
}

const NO_GUTTER = new Segment("");

/** Each block in `tokens`, every row it draws ended. */
function* renderTokens(tokens: readonly MdToken[], options: RenderOptions, settings: InlineSettings): Iterable<Segment> {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const style = getStyle(options, `markdown.h${Math.min(token.level, 4)}`);
        yield* guttered(inline(token.text, settings, undefined), options, NO_GUTTER, NO_GUTTER, style);
        break;
      }

      case "paragraph": {
        yield* guttered(inline(token.text, settings, settings.justify), options, NO_GUTTER, NO_GUTTER);
        break;
      }

      case "code_block": {
        const codeStyle = getStyle(options, "markdown.code");
        const lines = token.code.split("\n");
        for (const line of lines) {
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
        const bullet = " ".repeat(token.indent) + (token.ordered ? `${token.index}. ` : drawable(options, "  • ", "  * "));
        const hang = new Segment(" ".repeat(cellLen(bullet)));
        yield* guttered(inline(token.text, settings, settings.justify), options, new Segment(bullet), hang);
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

export class Markdown implements Renderable, Measurable, InlineSettings {
  readonly markdown: string;
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;
  readonly justify: MarkdownOptions["justify"];

  constructor(markdown: string, options?: MarkdownOptions) {
    this.markdown = markdown;
    this.inlineCodeStyle = options?.inlineCodeStyle ?? "markdown.code";
    this.hyperlinks = options?.hyperlinks !== false;
    this.justify = options?.justify;
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    // Every block below is one of a stack.
    const options = { ...rawOptions, height: stackedHeight(rawOptions.height) };
    yield* renderTokens(tokenize(this.markdown), options, this);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
