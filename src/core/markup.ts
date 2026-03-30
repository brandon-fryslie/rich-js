/**
 * Markup — BBCode-inspired markup parser for inline styling.
 * Parses `[bold red]text[/bold red]` into RichText with styled spans.
 */

import { Style } from "./style.js";
import { RichText, Span } from "./text.js";
import { emojiReplace } from "./emoji.js";

// --- Tag ---

export class Tag {
  readonly name: string;
  readonly parameters: string | undefined;

  constructor(name: string, parameters?: string) {
    this.name = name;
    this.parameters = parameters;
  }

  toString(): string {
    return this.parameters !== undefined
      ? `${this.name} ${this.parameters}`
      : this.name;
  }

  get markup(): string {
    return this.parameters !== undefined
      ? `[${this.name}=${this.parameters}]`
      : `[${this.name}]`;
  }
}

// --- MarkupError ---

export class MarkupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MarkupError";
  }
}

// --- escape ---

/**
 * Escapes markup characters so they render as literal text.
 */
export function escape(text: string): string {
  return text.replace(/\[/g, "\\[");
}

// --- render ---

// Fast path: if no `[` in text, skip parsing entirely
const HAS_TAG_RE = /\[/;

// Match tags: [style], [/style], [/], [name=params]
// Also handles escaped brackets: \[
const TAG_RE =
  /(?:\\\[)|(\[(?:\/?)(?:[a-zA-Z#][a-zA-Z0-9_.# -]*(?:=[^\]]*)?|\/)\])/g;

interface ParsedTag {
  fullMatch: string;
  isClosing: boolean;
  isImplicitClose: boolean;
  styleName: string;
  parameters: string | undefined;
  start: number;
  end: number;
}

function parseTags(markup: string): ParsedTag[] {
  const tags: ParsedTag[] = [];
  const re = new RegExp(TAG_RE.source, TAG_RE.flags);
  let match: RegExpExecArray | null;

  while ((match = re.exec(markup)) !== null) {
    // Escaped bracket
    if (match[0] === "\\[") continue;

    const captured = match[1];
    if (!captured) continue;

    const inner = captured.slice(1, -1); // Remove [ ]
    const isImplicitClose = inner === "/";
    const isClosing = inner.startsWith("/") && !isImplicitClose;
    const stylePart = isClosing ? inner.slice(1) : inner;

    // Check for parameters (name=value)
    const eqIdx = stylePart.indexOf("=");
    const styleName = eqIdx >= 0 ? stylePart.slice(0, eqIdx).trim() : stylePart.trim();
    const parameters = eqIdx >= 0 ? stylePart.slice(eqIdx + 1) : undefined;

    tags.push({
      fullMatch: captured,
      isClosing,
      isImplicitClose,
      styleName,
      parameters,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return tags;
}

export interface RenderOptions {
  emoji?: boolean;
}

/**
 * Parses markup text and returns a RichText with appropriate spans.
 */
export function render(
  markup: string,
  baseStyle?: string | Style,
  options?: RenderOptions,
): RichText {
  // Fast path: no brackets at all
  if (!HAS_TAG_RE.test(markup)) {
    let text = markup;
    if (options?.emoji !== false) {
      text = emojiReplace(text);
    }
    const result = new RichText(text);
    if (baseStyle) result.stylize(baseStyle);
    return result;
  }

  const tags = parseTags(markup);
  const doEmoji = options?.emoji !== false;

  // Build plain text and track spans
  let plainText = "";
  const spans: Span[] = [];
  const openStack: Array<{ styleName: string; parameters: string | undefined; textStart: number }> = [];

  let lastEnd = 0;

  for (const tag of tags) {
    // Add text before this tag
    const textBefore = markup.slice(lastEnd, tag.start);
    const processed = unescapeBrackets(doEmoji ? emojiReplace(textBefore) : textBefore);
    plainText += processed;

    if (tag.isImplicitClose) {
      // [/] — close the most recent open tag
      if (openStack.length === 0) {
        throw new MarkupError("Closing tag [/] has nothing to close");
      }
      const opened = openStack.pop()!;
      const styleStr = opened.parameters !== undefined
        ? `${opened.styleName} ${opened.parameters}`
        : opened.styleName;
      spans.push(new Span(opened.textStart, plainText.length, styleStr));
    } else if (tag.isClosing) {
      // [/style] — find and close matching open tag
      const idx = findLastOpen(openStack, tag.styleName);
      if (idx === -1) {
        throw new MarkupError(
          `Closing tag [/${tag.styleName}] doesn't match any open tag`,
        );
      }
      const opened = openStack[idx]!;
      const styleStr = opened.parameters !== undefined
        ? `${opened.styleName} ${opened.parameters}`
        : opened.styleName;
      spans.push(new Span(opened.textStart, plainText.length, styleStr));
      openStack.splice(idx, 1);
    } else {
      // Opening tag
      openStack.push({
        styleName: tag.styleName,
        parameters: tag.parameters,
        textStart: plainText.length,
      });
    }

    lastEnd = tag.end;
  }

  // Add remaining text after last tag
  const trailing = markup.slice(lastEnd);
  const processedTrailing = unescapeBrackets(doEmoji ? emojiReplace(trailing) : trailing);
  plainText += processedTrailing;

  // Auto-close any remaining open tags
  for (const opened of openStack) {
    const styleStr = opened.parameters !== undefined
      ? `${opened.styleName} ${opened.parameters}`
      : opened.styleName;
    spans.push(new Span(opened.textStart, plainText.length, styleStr));
  }

  const result = new RichText(plainText);
  if (baseStyle) result.stylize(baseStyle);

  // Apply link parameters as link styles
  for (const span of spans) {
    const style = typeof span.style === "string" ? span.style : span.style.toString();
    // Check if this is a link tag (name=url pattern was parsed)
    const linkMatch = /^link\s+(.+)$/.exec(style);
    if (linkMatch) {
      result.stylize(new Style({ link: linkMatch[1] }), span.start, span.end);
    } else {
      result.stylize(style, span.start, span.end);
    }
  }

  return result;
}

function findLastOpen(
  stack: Array<{ styleName: string; parameters: string | undefined }>,
  name: string,
): number {
  // Handle "on" in style names for closing: [/red on blue] should match [red on blue]
  const normalized = name.trim();
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i]!;
    const entryFull = entry.parameters !== undefined
      ? `${entry.styleName} ${entry.parameters}`
      : entry.styleName;
    if (entryFull === normalized || entry.styleName === normalized) return i;
  }
  return -1;
}

function unescapeBrackets(text: string): string {
  return text.replace(/\\\[/g, "[");
}
