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
 *
 * Plugin pairs must nest. The built-in dialect admits non-strict nesting
 * (`[bold]a[italic]b[/bold]c[/italic]`) because a style is an annotation and
 * annotations may overlap freely; a plugin tag is a replacement whose handler
 * takes one contiguous `inner`, so an overlapping pair has no slice to hand it
 * and is rejected with a `MarkupError`.
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

// [LAW:one-source-of-truth] The authority for this grammar is `RE_TAGS` in
// `rich/markup.py`, and this is deliberately its expression rather than a
// re-derivation, so the two can be read side by side; `[^[]*?` is lazy against
// the following `]`, which is what stops the body at the first one.
//
// The enumeration it replaced — `[a-zA-Z#][a-zA-Z0-9_.# -]*` — was a second
// drawing of the same territory and had drifted both ways at once: it invented
// uppercase, so `[INFO]` was taken as an opening tag and its text vanished from
// every `Console.print` with no error, and it omitted `@` and the punctuation
// the reference admits, so `[a+b]` stayed literal (rich-markup-sec).
// `markup-grammar.golden.txt` pins both directions.
// The leading alternative handles an escaped bracket: \[
const TAG_RE = /(?:\\\[)|(\[[a-z#/@][^[]*?\])/g;

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
    const isClose = inner.startsWith("/");
    const stylePart = isClose ? inner.slice(1) : inner;

    // Check for parameters (name=value)
    const eqIdx = stylePart.indexOf("=");
    const styleName = eqIdx >= 0 ? stylePart.slice(0, eqIdx).trim() : stylePart.trim();
    const parameters = eqIdx >= 0 ? stylePart.slice(eqIdx + 1) : undefined;

    // [LAW:types-are-the-program] What separates `[/]` from `[/red]` is whether
    // a name survives the slash, which is how the reference asks it too
    // (`style_name = tag.name[1:].strip()`). Testing the raw tag text against
    // the literal `"/"` answered a narrower question, and the widened grammar
    // is what exposed the gap: `[/ ]` reaches here now, and under the old test
    // it was an explicit close of the empty style rather than an implicit one.
    const isImplicitClose = isClose && styleName === "";
    const isClosing = isClose && !isImplicitClose;

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

interface RenderOptions {
  emoji?: boolean;
}

/**
 * Parses the built-in style dialect — `[bold red]text[/bold red]` — into a
 * `RichText` with styled spans. Module-private on purpose: `renderMarkup` is
 * this module's one crossing, and it delegates straight here the moment a
 * string carries no paired plugin tag.
 *
 * [LAW:single-enforcer] Exporting this is what let a caller bind to the inner
 * layer, and two of them did — `console.ts` and `prompt.ts` imported it as
 * `render as renderMarkup`, so the import line read identically to the
 * plugin-aware sites and the difference was invisible at every point of use. A
 * tag registered on `globalMarkupRegistry` resolved in a table cell and was
 * silently eaten by `console.print`, the path almost every consumer takes
 * (rich-markup-pcp). Unexported, that drift is a compile error rather than a
 * rule someone has to keep remembering.
 *
 * [LAW:dataflow-not-control-flow] Rendering *without* plugins stays reachable
 * as a value rather than a second name: `renderMarkup(s, { registry: new
 * MarkupRegistry() })`. Two exported functions put that variability in the
 * function names; an empty registry puts it in the data, where the one
 * boundary admits both.
 */
function render(
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
  const openStack: OpenTag[] = [];

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
      spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
    } else if (tag.isClosing) {
      // [/style] — find and close matching open tag
      const idx = findLastOpen(openStack, tag.styleName);
      if (idx === -1) {
        throw new MarkupError(
          `Closing tag [/${tag.styleName}] doesn't match any open tag`,
        );
      }
      const opened = openStack[idx]!;
      spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
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

  // Auto-close what is still open, innermost first. The reference pops its
  // stack here (`while style_stack: start, tag = style_stack.pop()`), and
  // popping is what keeps every span in this list in the order its tag closed
  // — the one order the sort below is defined against. Walking the stack
  // forwards instead put the outermost unclosed tag in first, and that lone
  // disagreement was invisible while nothing sorted: it cancelled the missing
  // sort, so `[red][blue]x` was the one nesting this port already got right.
  while (openStack.length > 0) {
    const opened = openStack.pop()!;
    spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
  }

  // [LAW:one-source-of-truth] The paint order is the reference's, expressed
  // rather than re-derived: `sorted(spans[::-1], key=attrgetter("start"))` in
  // `rich/markup.py`. `RichText` applies spans in list order and each one adds
  // over the last, so this list's order *is* which style wins where two
  // overlap; sorting by start lays the outer span down first and lets the
  // inner one repaint the run it sits in.
  //
  // The reversal is the whole of the tie-break, not decoration.
  // `[red][blue]x[/blue][/red]` yields two spans that both start at 0, and a
  // stable sort leaves those in the order they arrived — closing order,
  // innermost first — which is the outer colour winning. Reversed first, the
  // outer arrives first and the inner repaints it (rich-markup-krk).
  spans.reverse();
  spans.sort((a, b) => a.start - b.start);

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

interface OpenTag {
  styleName: string;
  parameters: string | undefined;
  textStart: number;
}

/**
 * The style string an open tag closes into — `name`, or `name parameters` when
 * the tag carried an `=`.
 *
 * [LAW:one-source-of-truth] One answer for the four sites that ask it: the three
 * ways a tag can close (`[/name]`, `[/]`, and end of input) and the search that
 * matches `[/red on blue]` back to `[red on blue]`. It was written out at each,
 * which is how the three closing paths could — and did — drift apart on
 * something none of the four copies was about.
 */
function openTagStyle(opened: OpenTag): string {
  return opened.parameters !== undefined
    ? `${opened.styleName} ${opened.parameters}`
    : opened.styleName;
}

function findLastOpen(stack: OpenTag[], name: string): number {
  // Handle "on" in style names for closing: [/red on blue] should match [red on blue]
  const normalized = name.trim();
  for (let i = stack.length - 1; i >= 0; i--) {
    const entry = stack[i]!;
    if (openTagStyle(entry) === normalized || entry.styleName === normalized) return i;
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

// [LAW:one-source-of-truth] The one answer to "what is a legal plugin tag
// name?". Both sites that need it are derived from this fragment rather than
// each carrying its own scanner: `register` anchors it to reject a name markup
// could never address, and the match site anchors it at the head with a
// boundary lookahead. When those two disagreed, registering `table` silently
// destroyed every `table.*` built-in style and a name containing a dot could
// never fire.
//
// It opens on `a-z` because a plugin name has to be a name `TAG_RE` can reach,
// and that is strictly narrower than "a letter": nothing lowercases the tag
// text on the way in, so `[Foo]` is literal and a handler registered as `Foo`
// could never fire. This tracked `[A-Za-z]` while `TAG_RE` wrongly admitted
// uppercase, which is the same drift, one subset down (rich-markup-sec).
const PLUGIN_TAG_NAME_SRC = "[a-z][A-Za-z0-9_-]*";
const LEGAL_PLUGIN_TAG_NAME = new RegExp(`^${PLUGIN_TAG_NAME_SRC}$`);

export class MarkupRegistry {
  private readonly _handlers = new Map<string, MarkupTagHandler>();

  register(name: string, handler: MarkupTagHandler): void {
    // [LAW:no-silent-failure] Registration used to accept any string, including
    // names markup can never address (`a.b` stops the tag scan at the dot), and
    // install a handler that could never fire.
    if (!LEGAL_PLUGIN_TAG_NAME.test(name)) {
      throw new MarkupError(
        `Cannot register markup tag "${name}": a tag name must be a lowercase letter followed by letters, digits, "_" or "-", so markup could never address this name.`,
      );
    }
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

// [LAW:no-shared-mutable-globals] The process-wide default tag set, which
// `renderMarkup` falls back to when a caller passes no registry. It has one
// owner and one explicit API — `MarkupRegistry`'s own methods. There is
// deliberately no free-function façade over it: `registerMarkupTag(name, fn)`
// forwarding to `.register(name, fn)` would be a second way to say one thing,
// and the two would document the same invariants in two places.
export const globalMarkupRegistry = new MarkupRegistry();

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

// A registered name addresses a plugin only when the tag text ends there or
// continues with the whitespace that introduces attributes. Anything else —
// `[table.header]`, `[table=x]` — is the built-in dialect's, and falls through
// exactly as an unregistered name would.
const PLUGIN_TAG_HEAD = new RegExp(`^(${PLUGIN_TAG_NAME_SRC})(?=$|[ \\t])`);

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
  // Filter pairs to top-level only. A pair that opens inside the current one is
  // either contained — re-discovered when the recursion renders the outer
  // pair's inner slice — or overlapping, and only its *closing* position tells
  // the two apart. Testing the open position alone conflated them and dropped
  // the overlapping pair, which orphaned its closing tag into the trailing
  // slice, where the built-in parser blamed the wrong tag for the wrong reason.
  const topLevel = new Map<number, number>();
  let outerEnd = -1;
  let outerOpenIdx = -1;
  const sortedOpens = [...pairs.keys()].sort((a, b) => a - b);
  for (const openIdx of sortedOpens) {
    const closeIdx = pairs.get(openIdx)!;
    if (annotated[openIdx]!.start < outerEnd) {
      // [LAW:no-silent-failure] Overlap is unrepresentable here rather than
      // unimplemented: a handler receives `children` as one contiguous slice,
      // so a region straddling another pair's closing boundary has nothing to
      // hand it. A style span may overlap because it annotates; a plugin pair
      // may not because it replaces.
      if (annotated[closeIdx]!.end > outerEnd) {
        const inner = annotated[openIdx]!.pluginName;
        const outer = annotated[outerOpenIdx]!.pluginName;
        throw new MarkupError(
          `Plugin tag [${inner}] overlaps [${outer}]: plugin tags must nest, ` +
            `because a handler receives one contiguous slice. ` +
            `Close [/${inner}] before [/${outer}].`,
        );
      }
      continue;
    }
    topLevel.set(openIdx, closeIdx);
    outerOpenIdx = openIdx;
    outerEnd = annotated[closeIdx]!.end;
  }
  return { annotated, topLevel };
}

function annotatePluginTag(tag: ParsedTag, registry: MarkupRegistry): PluginTag {
  // The legacy parser splits at the first `=`, so tag.styleName for
  // `[click verb=foo]` is "click verb". Re-read the tag text for a name that
  // actually addresses a plugin.
  const inner = tag.fullMatch.slice(1, -1).replace(/^\//, "");
  const head = PLUGIN_TAG_HEAD.exec(inner);
  const name = head?.[1];
  if (name === undefined || !registry.has(name)) return tag;
  const after = inner.slice(name.length);
  const attrs = tag.isClosing ? {} : parsePluginAttrs(after);
  return { ...tag, pluginName: name, attrs };
}
