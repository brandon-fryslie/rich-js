/**
 * Markup — BBCode-inspired markup parser for inline styling.
 * Parses `[bold red]text[/bold red]` into RichText with styled spans.
 *
 * Plugin tags ([LAW:locality-or-seam]): a `MarkupRegistry` lets consumers
 * register tag handlers without forking the parser. When the parser sees
 * `[name attrs...]inner[/name]` and `name` is registered, it parses attrs,
 * recursively renders the inner markup as a child Renderable, and calls the
 * handler — splicing the handler's returned Renderable into the output. The
 * built-in style dialect and the plugin dialect are routed by the registry,
 * which is the single trust boundary between them.
 */

import { Style, StyleSyntaxError } from "./style.js";
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

// --- Plugin registry ---

export interface MarkupTagContext {
  /** Parsed `key=value` attributes from the opening tag. */
  attrs: Record<string, string>;
  /** Inner markup, already parsed (registry-aware) into a `RichText`. */
  children: RichText;
  /** Raw inner markup text (between the opening tag's `]` and the closing tag's `[`). */
  raw: string;
}

// [LAW:one-type-per-behavior] Handlers always return `RichText`, and the
// parser always returns `RichText`. Markup is an inline-text decorator
// dialect; widening to `Renderable` would let handlers return arbitrary
// shapes (Panel, Table) and force every caller to type-narrow at the use
// site, which silently circumvents the type system.
export type MarkupTagHandler = (ctx: MarkupTagContext) => RichText;

export class MarkupRegistry {
  private readonly _handlers = new Map<string, MarkupTagHandler>();

  register(name: string, handler: MarkupTagHandler): void {
    if (isReservedTagName(name)) {
      throw new MarkupError(
        `Cannot register markup tag "${name}": name is reserved by a built-in style.`,
      );
    }
    this._handlers.set(name, handler);
  }

  unregister(name: string): void {
    this._handlers.delete(name);
  }

  has(name: string): boolean {
    return this._handlers.has(name);
  }

  get(name: string): MarkupTagHandler | undefined {
    return this._handlers.get(name);
  }
}

// [LAW:one-source-of-truth] Reserved-name detection delegates to Style.parse —
// if a name is a valid built-in style, it cannot be hijacked by a plugin.
// There is no second list of "reserved names" to drift out of sync.
function isReservedTagName(name: string): boolean {
  try {
    Style.parse(name);
    return true;
  } catch (err) {
    if (err instanceof StyleSyntaxError) return false;
    throw err;
  }
}

export const globalMarkupRegistry = new MarkupRegistry();

export function registerMarkupTag(name: string, handler: MarkupTagHandler): void {
  globalMarkupRegistry.register(name, handler);
}

export function unregisterMarkupTag(name: string): void {
  globalMarkupRegistry.unregister(name);
}

// --- Plugin-aware tag parsing ---

function isAlpha(c: string): boolean {
  const cc = c.charCodeAt(0);
  return (cc >= 65 && cc <= 90) || (cc >= 97 && cc <= 122);
}

function isIdentChar(c: string): boolean {
  if (isAlpha(c)) return true;
  const cc = c.charCodeAt(0);
  return (cc >= 48 && cc <= 57) || c === "_" || c === "-";
}

function isSpace(c: string): boolean {
  return c === " " || c === "\t";
}

function pluginNameOf(inner: string): string | null {
  if (inner.length === 0 || !isAlpha(inner[0]!)) return null;
  let i = 1;
  while (i < inner.length && isIdentChar(inner[i]!)) i++;
  return inner.slice(0, i);
}

function parsePluginAttrs(after: string): Record<string, string> {
  // Hand-written tokenizer. Walks `key=value` pairs separated by whitespace;
  // values may be bare, single-quoted, or double-quoted. Matches the syntax
  // the regex it replaces accepted.
  const attrs: Record<string, string> = {};
  let i = 0;
  while (i < after.length) {
    while (i < after.length && isSpace(after[i]!)) i++;
    if (i >= after.length) break;
    if (!isAlpha(after[i]!)) {
      // Skip a stray non-name character to avoid infinite loops on malformed
      // input — the legacy regex would simply fail to match here.
      i++;
      continue;
    }
    const nameStart = i;
    while (i < after.length && isIdentChar(after[i]!)) i++;
    const name = after.slice(nameStart, i);
    while (i < after.length && isSpace(after[i]!)) i++;
    if (after[i] !== "=") continue;
    i++;
    while (i < after.length && isSpace(after[i]!)) i++;
    let value = "";
    const quote = after[i];
    if (quote === '"' || quote === "'") {
      i++;
      const valStart = i;
      while (i < after.length && after[i] !== quote) i++;
      value = after.slice(valStart, i);
      if (i < after.length) i++;
    } else {
      const valStart = i;
      while (i < after.length && !isSpace(after[i]!) && after[i] !== "]") i++;
      value = after.slice(valStart, i);
    }
    attrs[name] = value;
  }
  return attrs;
}

// --- Plugin-aware render ---

export interface RenderMarkupOptions {
  registry?: MarkupRegistry;
  baseStyle?: string | Style;
  emoji?: boolean;
}

/**
 * Plugin-aware markup render. Always returns a `RichText`. Built-in style
 * tags become spans; registered plugin tags are resolved by their handler,
 * whose returned `RichText` is appended (text + spans) into the output. The
 * recursion is over markup *slices* — between top-level plugin tag pairs and
 * inside each pair — and every recursion node returns a `RichText`, so the
 * append path is uniform.
 */
export function renderMarkup(
  markup: string,
  options?: RenderMarkupOptions,
): RichText {
  const registry = options?.registry ?? globalMarkupRegistry;
  const baseStyle = options?.baseStyle;
  const doEmoji = options?.emoji !== false;

  // Fast path: no `[` at all → no possible tags.
  if (!HAS_TAG_RE.test(markup)) {
    return render(markup, baseStyle, { emoji: doEmoji });
  }

  const tags = parseTags(markup);
  // Pair each opening plugin tag with its matching closer up-front, so the
  // splice walk can just iterate top-level pairs in source order with no
  // nested-state book-keeping.
  const { annotated, topLevel: tagPairs } = pairPluginTags(tags, registry);
  if (tagPairs.size === 0) {
    return render(markup, baseStyle, { emoji: doEmoji });
  }

  // [LAW:one-type-per-behavior] Always assemble a single RichText. Fragments
  // between plugin pairs are parsed by the built-in `render`, plugin pairs
  // hand their inner slice (recursively) to a handler; both produce RichText,
  // both get appended into one accumulator.
  const out = new RichText("");
  let cursor = 0;

  for (const [openIdx, closeIdx] of tagPairs) {
    const open = annotated[openIdx]!;
    const close = annotated[closeIdx]!;

    if (open.start > cursor) {
      out.append(render(markup.slice(cursor, open.start), baseStyle, { emoji: doEmoji }));
    }

    const innerRaw = markup.slice(open.end, close.start);
    const innerRichText = renderMarkup(innerRaw, options);
    const handler = registry.get(open.pluginName!)!;
    out.append(handler({ attrs: open.attrs!, children: innerRichText, raw: innerRaw }));
    cursor = close.end;
  }

  if (cursor < markup.length) {
    out.append(render(markup.slice(cursor), baseStyle, { emoji: doEmoji }));
  }

  if (baseStyle) out.stylize(baseStyle);
  return out;
}

interface PluginTag extends ParsedTag {
  pluginName?: string;
  attrs?: Record<string, string>;
}

function pairPluginTags(
  tags: ParsedTag[],
  registry: MarkupRegistry,
): { annotated: PluginTag[]; topLevel: Map<number, number> } {
  // Annotate tags with plugin info, then pair openers with closers. Only
  // top-level pairs are returned; inner pairs will be re-discovered by the
  // recursive `renderMarkup` call on the inner slice.
  const annotated: PluginTag[] = tags.map((t) => annotatePluginTag(t, registry));
  const stack: number[] = [];
  const pairs = new Map<number, number>();
  for (let i = 0; i < annotated.length; i++) {
    const t = annotated[i]!;
    if (!t.pluginName) continue;
    if (t.isImplicitClose) continue;
    if (t.isClosing) {
      // Find matching open in stack.
      for (let j = stack.length - 1; j >= 0; j--) {
        const openIdx = stack[j]!;
        if (annotated[openIdx]!.pluginName === t.pluginName) {
          pairs.set(openIdx, i);
          stack.splice(j, 1);
          break;
        }
      }
    } else {
      stack.push(i);
    }
  }
  // Filter pairs to top-level only.
  const topLevel = new Map<number, number>();
  let outerEnd = -1;
  const sortedOpens = [...pairs.keys()].sort((a, b) => a - b);
  for (const openIdx of sortedOpens) {
    if (annotated[openIdx]!.start < outerEnd) continue;
    topLevel.set(openIdx, pairs.get(openIdx)!);
    outerEnd = annotated[pairs.get(openIdx)!]!.end;
  }
  return { annotated, topLevel };
}

function annotatePluginTag(tag: ParsedTag, registry: MarkupRegistry): PluginTag {
  // The legacy parser splits at the first `=`, so tag.styleName for
  // `[click verb=foo]` is "click verb". Re-extract the leading identifier.
  const inner = tag.fullMatch.slice(1, -1).replace(/^\//, "");
  const name = pluginNameOf(inner);
  if (!name || !registry.has(name)) return tag;
  const after = inner.slice(name.length);
  const attrs = tag.isClosing ? {} : parsePluginAttrs(after);
  return { ...tag, pluginName: name, attrs };
}
