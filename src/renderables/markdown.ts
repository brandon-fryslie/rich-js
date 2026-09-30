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
  codeTheme?: string;
  inlineCodeStyle?: string | Style;
  hyperlinks?: boolean;
  justify?: "left" | "center" | "right" | "full";
}

// Simple markdown token types
type MdToken =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code_block"; language: string; code: string }
  | { type: "hr" }
  | { type: "list_item"; ordered: boolean; index: number; indent: number; text: string }
  | { type: "blockquote"; text: string }
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
 * Whether `line` opens a block of its own. It is what ends a list item or a
 * quote, and with `endsParagraph`'s two readings a paragraph: every line up to
 * the next blank or the next block start belongs to the one before it. A hard-wrapped source line is a soft
 * break, not a block, so the source's own line breaks never reach the screen.
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

/** The columns a run of leading whitespace spans, a tab reaching the next stop of 4 as CommonMark counts it. */
function columns(indent: string): number {
  return [...indent].reduce((col, ch) => (ch === "\t" ? col + 4 - (col % 4) : col + 1), 0);
}

/** A marker no line carries: the block has no marker of its own to continue on. */
const NO_MARKER = /(?!)/;

/**
 * The text of the block begun at `start` — `first`, then every line after it
 * up to a blank or a line that opens another block — and the index of the
 * line that ended it. A line carrying `marker` continues the block rather than
 * opening one, with the marker cut off: that is how a quote's `> ` lines stay
 * one quote. `ends` says which unmarked lines open another block. Soft-broken
 * lines are joined by one space, as a Markdown renderer reflows them, with
 * their own indentation dropped; a line ending in two spaces or a backslash
 * breaks hard, and its break is kept.
 */
function continuation(
  first: string,
  lines: readonly string[],
  start: number,
  marker: RegExp,
  ends: (line: string) => boolean,
): { text: string; next: number } {
  const parts = [first];
  let i = start + 1;
  for (; i < lines.length; i++) {
    const line = lines[i]!;
    const own = marker.test(line);
    if (line.trim() === "" || (!own && ends(line))) break;
    parts.push(line.replace(marker, ""));
  }
  const kept = parts.filter((part) => part.trim() !== "");
  const text = kept
    .map((part, n) =>
      n === kept.length - 1
        ? part.trim()
        : HARD_BREAK.test(part)
          ? `${part.replace(HARD_BREAK, "").trim()}\n`
          : `${part.trim()} `,
    )
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

    // Blockquote: its `>` lines, and any unmarked line that lazily continues them
    if (QUOTE.test(line)) {
      const { text, next } = continuation(line.replace(QUOTE, ""), lines, i, QUOTE, opensBlock);
      tokens.push({ type: "blockquote", text });
      i = next;
      continue;
    }

    // List item: the marker line and every line continuing it. Its leading
    // whitespace is its nesting, kept as columns so a nested item sits under its parent.
    const listMatch = BULLET.exec(line) ?? NUMBERED.exec(line);
    if (listMatch) {
      const ordered = NUMBERED.test(line);
      const { text, next } = continuation(listMatch[3]!, lines, i, NO_MARKER, opensBlock);
      tokens.push({
        type: "list_item",
        ordered,
        index: ordered ? parseInt(listMatch[2]!, 10) : 0,
        indent: columns(listMatch[1]!),
        text,
      });
      i = next;
      continue;
    }

    // Paragraph, or a setext heading when a line of `=` or `-` underlines it
    const { text, next } = continuation(line, lines, i, NO_MARKER, endsParagraph);
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

function applyInlineStyles(text: string): RichText {
  const result = new RichText("", { end: "" });

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
      result.append(match[4], "markdown.code");
    } else if (match[5] && match[6]) {
      // Link: [text](url)
      result.append(match[5], new Style({ link: match[6] }));
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
 * `text` wrapped in what is left of the width beside a gutter, one row per
 * wrapped line, each ended. The first row's gutter is `first` and every later
 * row's is `rest`, so a list item's text hangs clear of its bullet and a
 * quote's bar runs its full height. A block with no gutter passes two empty
 * segments: every wrapped block is laid out the same way. The text keeps at
 * least one column however wide the gutter, so a row may overrun its width
 * but no gutter swallows the text it introduces.
 */
function* guttered(
  text: RichText,
  options: RenderOptions,
  first: Segment,
  rest: Segment,
  style?: Style,
): Iterable<Segment> {
  const width = Math.max(1, options.maxWidth - cellLen(first.text));
  const rows = Segment.splitLines(Segment.applyStyle([...text.render({ ...options, maxWidth: width })], style));
  for (const [row, line] of rows.entries()) {
    yield row === 0 ? first : rest;
    yield* line;
    yield Segment.line();
  }
}

const NO_GUTTER = new Segment("");

export class Markdown implements Renderable, Measurable {
  readonly markdown: string;
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;

  constructor(markdown: string, options?: MarkdownOptions) {
    this.markdown = markdown;
    this.inlineCodeStyle = options?.inlineCodeStyle ?? "markdown.code";
    this.hyperlinks = options?.hyperlinks !== false;
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    // Every block below is one of a stack.
    const options = { ...rawOptions, height: stackedHeight(rawOptions.height) };
    const tokens = tokenize(this.markdown);

    for (const token of tokens) {
      switch (token.type) {
        case "heading": {
          const style = getStyle(options, `markdown.h${Math.min(token.level, 4)}`);
          yield* guttered(applyInlineStyles(token.text), options, NO_GUTTER, NO_GUTTER, style);
          break;
        }

        case "paragraph": {
          yield* guttered(applyInlineStyles(token.text), options, NO_GUTTER, NO_GUTTER);
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
          yield* guttered(applyInlineStyles(token.text), options, new Segment(bullet), hang);
          break;
        }

        case "blockquote": {
          const bar = new Segment(drawable(options, "▎ ", "| "), getStyle(options, "markdown.hr"));
          yield* guttered(applyInlineStyles(token.text), options, bar, bar, Style.parse("dim italic"));
          break;
        }

        case "blank":
          yield Segment.line();
          break;
      }
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
