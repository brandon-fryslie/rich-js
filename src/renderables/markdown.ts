/**
 * Markdown — renders Markdown content to the terminal.
 * Uses built-in parsing (no external dependency).
 */

import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import { Rule } from "./rule.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export interface MarkdownOptions {
  codeTheme?: string;
  inlineCodeStyle?: string | Style;
  hyperlinks?: boolean;
  justify?: "left" | "center" | "right" | "full";
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

// Simple markdown token types
type MdToken =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "code_block"; language: string; code: string }
  | { type: "hr" }
  | { type: "list_item"; ordered: boolean; index: number; text: string }
  | { type: "blockquote"; text: string }
  | { type: "blank" };

function tokenize(markdown: string): MdToken[] {
  const lines = markdown.split("\n");
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
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      tokens.push({ type: "heading", level: headingMatch[1]!.length, text: headingMatch[2]! });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(?:---+|===+|\*\*\*+)$/.test(line.trim())) {
      tokens.push({ type: "hr" });
      i++;
      continue;
    }

    // Fenced code block
    const codeMatch = /^```(\w*)/.exec(line);
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

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) {
        quoteLines.push(lines[i]!.slice(2));
        i++;
      }
      tokens.push({ type: "blockquote", text: quoteLines.join("\n") });
      continue;
    }

    // Unordered list
    const ulMatch = /^([*\-+])\s+(.+)$/.exec(line);
    if (ulMatch) {
      tokens.push({ type: "list_item", ordered: false, index: 0, text: ulMatch[2]! });
      i++;
      continue;
    }

    // Ordered list
    const olMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (olMatch) {
      tokens.push({ type: "list_item", ordered: true, index: parseInt(olMatch[1]!, 10), text: olMatch[2]! });
      i++;
      continue;
    }

    // Paragraph (collect consecutive non-blank lines)
    const paraLines: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^#{1,6}\s/.test(lines[i]!) && !/^```/.test(lines[i]!)) {
      paraLines.push(lines[i]!);
      i++;
    }
    tokens.push({ type: "paragraph", text: paraLines.join(" ") });
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
      result.append(match[4], Style.parse("markdown.code"));
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

export class Markdown implements Renderable, Measurable {
  readonly markdown: string;
  readonly inlineCodeStyle: Style;
  readonly hyperlinks: boolean;

  constructor(markdown: string, options?: MarkdownOptions) {
    this.markdown = markdown;
    this.inlineCodeStyle = resolveStyle(options?.inlineCodeStyle ?? "markdown.code");
    this.hyperlinks = options?.hyperlinks !== false;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const tokens = tokenize(this.markdown);

    for (const token of tokens) {
      switch (token.type) {
        case "heading": {
          const styleKey = `markdown.h${Math.min(token.level, 4)}` as string;
          const style = Style.parse(styleKey);
          const text = applyInlineStyles(token.text);
          yield* Segment.applyStyle([...text.render(options)], style);
          yield Segment.line();
          break;
        }

        case "paragraph": {
          const text = applyInlineStyles(token.text);
          yield* text.render(options);
          yield Segment.line();
          break;
        }

        case "code_block": {
          const codeStyle = Style.parse("markdown.code");
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
          const bullet = token.ordered ? `${token.index}. ` : "  • ";
          yield new Segment(bullet);
          const text = applyInlineStyles(token.text);
          yield* text.render({ ...options, maxWidth: options.maxWidth - bullet.length });
          break;
        }

        case "blockquote": {
          const quoteStyle = Style.parse("dim italic");
          yield new Segment("▎ ", Style.parse("markdown.hr"));
          const text = applyInlineStyles(token.text);
          yield* Segment.applyStyle([...text.render(options)], quoteStyle);
          yield Segment.line();
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
