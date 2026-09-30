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
 * and is rejected with a `MarkupSyntaxError`.
 */

import { cellLen } from "./cells.js";
import { Style, StyleSyntaxError } from "./style.js";
import { RichText, Span, stripControlChars } from "./text.js";
import { emojiReplace } from "./emoji.js";
import type { RenderOptions as DrawOptions } from "./protocol.js";

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

// --- MarkupSyntaxError ---

/**
 * A markup string that cannot be parsed, with where it went wrong.
 *
 * [LAW:types-are-the-program] A subclass rather than optional fields on
 * `MarkupError`, because the parent is also what `MarkupRegistry.register`
 * throws, and a registration has no source text to point into. Every error this
 * class describes has a location, so none of its fields is optional and no
 * caller has to ask whether one is present — `instanceof` is the only question.
 *
 * [LAW:one-source-of-truth] The constructor takes the facts the parser holds —
 * the string, the offset of the offending tag, what was open — and derives
 * `line`, `column` and the message from them, so the numbers a caller reads
 * and the caret the message draws cannot disagree.
 */
export class MarkupSyntaxError extends MarkupError {
  /** The problem alone, with no location, for callers building their own message. */
  readonly reason: string;
  /** The whole markup string that failed, as the caller passed it. */
  readonly markup: string;
  /** Index into `markup` of the tag the parser rejected. */
  readonly offset: number;
  /** 1-based line of `offset`; lines are separated by `\n`. */
  readonly line: number;
  /** 1-based column of `offset` within its line, in UTF-16 code units. */
  readonly column: number;
  /**
   * The opening tags still open at `offset`, outermost first, as written. For
   * overlapping plugin tags, only plugin tags are named.
   */
  readonly openTags: readonly string[];

  constructor(
    reason: string,
    markup: string,
    offset: number,
    openTags: readonly string[],
  ) {
    const lineStart = markup.lastIndexOf("\n", offset - 1) + 1;
    const lineEnd = markup.indexOf("\n", offset);
    const text = markup.slice(lineStart, lineEnd === -1 ? markup.length : lineEnd);
    const line = countNewlines(markup.slice(0, lineStart)) + 1;
    const column = offset - lineStart + 1;
    const open = openTags.length > 0 ? openTags.join(" ") : "none";
    super(
      `${printable(reason)} (line ${line}, column ${column})\n` +
        `${excerpt(text, offset - lineStart)}\n` +
        `Open tags: ${printable(open)}`,
    );
    this.name = "MarkupSyntaxError";
    this.reason = reason;
    this.markup = markup;
    this.offset = offset;
    this.line = line;
    this.column = column;
    this.openTags = openTags;
  }
}

function countNewlines(text: string): number {
  return text.split("\n").length - 1;
}

// Code points shown either side of the error before the excerpt is cut and
// marked with an ellipsis. Enough to recognise the surrounding tags on a line
// that is long, templated, or machine-assembled, without printing all of it.
const EXCERPT_CONTEXT = 30;

/**
 * `text` with each C0 control and DEL shown as one space.
 *
 * [LAW:single-enforcer] Every part of the message that quotes the caller's
 * markup passes through here: the reason and the open tags quote tag text, and
 * the tag grammar admits control characters, so an `ESC ]` inside a tag would
 * otherwise open an OSC sequence in the terminal printing the error. In the
 * excerpt it also keeps the caret aligned, since a control occupies no cell.
 * The fields keep the text as written; only the message is made printable.
 */
function printable(text: string): string {
  return text.replace(/[\x00-\x1f\x7f]/g, " ");
}

/**
 * Two lines: the source line around `index`, and a caret under it.
 *
 * The window is cut in code points, so a surrogate pair is never split, and the
 * caret is placed by cell width, so a wide character before the error still
 * leaves it under the right cell.
 */
function excerpt(text: string, index: number): string {
  const chars = Array.from(printable(text));
  const at = Array.from(text.slice(0, index)).length;
  const from = Math.max(0, at - EXCERPT_CONTEXT);
  const to = Math.min(chars.length, at + EXCERPT_CONTEXT);
  const head = from > 0 ? "…" : "";
  const tail = to < chars.length ? "…" : "";
  const before = head + chars.slice(from, at).join("");
  const shown = before + chars.slice(at, to).join("") + tail;
  return `  ${shown}\n  ${" ".repeat(cellLen(before))}^`;
}

// --- escape ---

/**
 * Escapes markup characters so they render as literal text.
 *
 * [LAW:one-source-of-truth] The inverse of the two ways the parser reads a
 * backslash run in front of a bracket, over the same `TAG_BODY`: before a tag
 * the run is halved and an odd one left over escapes it, so the run is doubled
 * and one added; before any other bracket one `\[` becomes `[`, so one
 * backslash is added.
 *
 * No bracket in the output can open a tag, whatever it is joined to. A bracket
 * whose tag the text ends before finishing — `[link=x` — is escaped as a tag,
 * because the next fragment's `]` would finish it; when what follows is instead
 * the caller's own tag, a backslash run in front of it renders doubled. A
 * trailing run is doubled for the same reason: `escape("C:\\")` spliced before
 * `[/bold]` would otherwise escape the closing tag, so at the very end of a
 * string it renders doubled. The grammar cannot tell those cases apart, and
 * both choices fail visibly rather than let input open or escape a tag.
 *
 * Rich's `escape` escapes only a finished tag and doubles only a trailing run
 * of one, so input can drop a backslash, escape the closing tag after it, or
 * open a tag across a join. All three are departures on purpose.
 */
export function escape(text: string): string {
  return text
    .replace(ESCAPE_RE, (_, run: string, live: string | undefined) =>
      live === undefined ? `${run}\\[` : `${run}${run}\\[`,
    )
    .replace(TRAILING_RUN_RE, "$&$&");
}

// --- render ---

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
//
// The leading group is the run of backslashes in front of the bracket, which
// `tokenize` halves as `_parse` does: each pair is one literal backslash, and a
// leftover odd one escapes the tag. An alternative that consumed any `\[` as an
// escape could not tell "escaped tag" from "literal backslash, then a live tag",
// so `\\[red]hi[/red]` lost its opening tag and died on the close
// (rich-markup-nm1).
//
// A run is only ever matched from its first backslash — the lookbehind — which
// is where a leftmost match starts anyway. Without it, a long run that no
// bracket follows is re-scanned from every backslash in it: quadratic in the
// run, on exactly the untrusted text `escape` is for.
const TAG_BODY = String.raw`[a-z#/@][^[]*?\]`;
const RUN = String.raw`(?<!\\)(\\*)`;
const TAG_RE = new RegExp(String.raw`${RUN}(\[${TAG_BODY})`, "g");
/**
 * Every bracket and the run in front of it; the empty second group is set when
 * a tag starts there or could, once more text is joined after the end. It is an
 * alternation rather than `(…)?` because a quantified group may not match empty.
 */
const ESCAPE_RE = new RegExp(String.raw`${RUN}\[(?:(?=${TAG_BODY}|(?:[a-z#/@][^[\]]*)?$)()|)`, "g");
const TRAILING_RUN_RE = /(?<!\\)\\+$/;

/** Literal text, positioned where the reference's `_parse` positions it. */
interface TextToken {
  readonly kind: "text";
  readonly text: string;
  readonly start: number;
}

/**
 * [LAW:one-source-of-truth] The one reading of a markup string. It is taken
 * once, over the whole string, and every later pass selects from it by
 * position; re-reading a slice would lose what came before it — a slice cut at
 * a tag's bracket still carries the backslash run in front of it, with no tag
 * left after it to halve that run against.
 */
type MarkupToken = TextToken | ParsedTag;

interface ParsedTag {
  readonly kind: "tag";
  fullMatch: string;
  isClosing: boolean;
  isImplicitClose: boolean;
  styleName: string;
  parameters: string | undefined;
  start: number;
  end: number;
}

function tokenize(markup: string): MarkupToken[] {
  const tokens: MarkupToken[] = [];
  let position = 0;

  for (const match of markup.matchAll(TAG_RE)) {
    const run = match[1]!;
    const captured = match[2]!;
    let start = match.index;
    const end = start + match[0].length;
    if (start > position) tokens.push({ kind: "text", text: markup.slice(position, start), start: position });
    position = end;

    const literal = Math.floor(run.length / 2);
    if (literal > 0) {
      tokens.push({ kind: "text", text: "\\".repeat(literal), start });
      start += literal * 2;
    }
    if (run.length % 2 === 1) {
      tokens.push({ kind: "text", text: captured, start });
      continue;
    }

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

    tokens.push({
      kind: "tag",
      fullMatch: captured,
      isClosing,
      isImplicitClose,
      styleName,
      parameters,
      start,
      end,
    });
  }

  if (position < markup.length) tokens.push({ kind: "text", text: markup.slice(position), start: position });
  return tokens;
}

function isTag(token: MarkupToken): token is ParsedTag {
  return token.kind === "tag";
}

/**
 * The tokens that begin in `[from, to)` of the source. `tokenize` emits them in
 * source order, so this is two binary searches and a slice: a string of many
 * plugin pairs costs what it holds, not pairs × tokens.
 */
function within(tokens: readonly MarkupToken[], from: number, to: number): MarkupToken[] {
  return tokens.slice(firstAtOrAfter(tokens, from), firstAtOrAfter(tokens, to));
}

function firstAtOrAfter(tokens: readonly MarkupToken[], offset: number): number {
  let low = 0;
  let high = tokens.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (tokens[mid]!.start < offset) low = mid + 1;
    else high = mid;
  }
  return low;
}

interface RenderOptions {
  emoji?: boolean;
}

/**
 * What a run of tokens sits inside, in the string the caller passed.
 *
 * [LAW:dataflow-not-control-flow] The plugin-aware walk hands the built-in
 * parser runs of tokens, and recurses into the run inside each plugin pair.
 * Every token is positioned in the caller's whole string, so an error is
 * located the same way at any depth; what a run cannot know on its own is
 * which plugin tags enclose it.
 */
interface SliceOrigin {
  /** The whole markup string the caller passed. */
  readonly source: string;
  /** Opening plugin tags the run sits inside, outermost first, as written. */
  readonly enclosing: readonly string[];
}

/**
 * What the built-in walk reads: a run of the caller's tokens, or a plugin pair
 * already resolved by its handler, which the walk treats as text.
 */
type MarkupPart =
  | { readonly kind: "markup"; readonly tokens: readonly MarkupToken[] }
  | { readonly kind: "rendered"; readonly text: RichText };

/**
 * Parses the built-in style dialect — `[bold red]text[/bold red]` — into a
 * `RichText` with styled spans. Module-private on purpose: `renderMarkup` is
 * this module's one crossing, and it hands every slice here once its plugin
 * pairs are resolved.
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
  parts: readonly MarkupPart[],
  origin: SliceOrigin,
  baseStyle?: string | Style,
  options?: RenderOptions,
): RichText {
  const doEmoji = options?.emoji !== false;

  // Build plain text and track spans
  let plainText = "";
  const spans: Span[] = [];
  const spliced: { at: number; text: RichText }[] = [];
  const openStack: OpenTag[] = [];
  const unparsable = (reason: string, tag: ParsedTag): MarkupSyntaxError =>
    new MarkupSyntaxError(reason, origin.source, tag.start, [
      ...origin.enclosing,
      ...openStack.map((opened) => opened.tag),
    ]);

  // [LAW:dataflow-not-control-flow] One stack across every part, so a style
  // tag opened before a plugin pair is still open after it and its span covers
  // the handler's output like any other run of text (rich-markup-cg6).
  for (const part of parts) {
    if (part.kind === "rendered") {
      spliced.push({ at: plainText.length, text: part.text });
      plainText += part.text.plain;
      continue;
    }
    for (const token of part.tokens) {
      if (!isTag(token)) {
        // A `\[` in front of a bracket no tag starts at is unescaped here, per
        // text token, as the reference does; a tag's own escape was settled by
        // `tokenize` against its backslash run.
        const text = token.text.replace(/\\\[/g, "[");
        // Text reaches `plainText` as `RichText` will hold it, so every offset
        // counted along the way — a span, a splice point — indexes the text it
        // lands on. Stripped only by the constructor, a control character
        // shifted every style after it one cell right.
        plainText += stripControlChars(doEmoji ? emojiReplace(text) : text);
        continue;
      }
      const tag = token;

      if (tag.isImplicitClose) {
        // [/] — close the most recent open tag
        if (openStack.length === 0) {
          throw unparsable(`Closing tag ${tag.fullMatch} has no open tag to close`, tag);
        }
        const opened = openStack.pop()!;
        spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
      } else if (tag.isClosing) {
        // [/style] — find and close matching open tag
        const idx = findLastOpen(openStack, tag.styleName);
        if (idx === -1) {
          throw unparsable(`Closing tag ${tag.fullMatch} doesn't match any open tag`, tag);
        }
        const opened = openStack[idx]!;
        spans.push(new Span(opened.textStart, plainText.length, openTagStyle(opened)));
        openStack.splice(idx, 1);
      } else {
        // Opening tag
        openStack.push({
          tag: tag.fullMatch,
          styleName: tag.styleName,
          parameters: tag.parameters,
          textStart: plainText.length,
        });
      }
    }
  }

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

  // A handler's own styles go down last — its base style, then its spans.
  // Every style span that reaches into a handler's output encloses all of it —
  // no tag of this walk sits inside a plugin pair — so each of these is the
  // inner span, and inner repaints outer exactly as the sort above has it for
  // tags.
  for (const { at, text } of spliced) {
    result.stylize(text.style, at, at + text.length);
    for (const span of text.spans) result.stylize(span.style, at + span.start, at + span.end);
  }

  return result;
}

interface OpenTag {
  tag: string;
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
function openTagStyle(opened: StyleTagText): string {
  return opened.parameters !== undefined
    ? `${opened.styleName} ${opened.parameters}`
    : opened.styleName;
}

type StyleTagText = Pick<OpenTag, "styleName" | "parameters">;

/**
 * Whether `[/name]` closes `opened`.
 *
 * [LAW:one-source-of-truth] Two walks ask this: the built-in parser closing a
 * style, and the plugin pass keeping the same stack so it knows what `[/]`
 * refers to. If they disagreed on which open tag `[/red on blue]` takes off
 * the stack, they would disagree about what the next `[/]` closes.
 */
function closesByName(opened: StyleTagText, name: string): boolean {
  // Handle "on" in style names for closing: [/red on blue] should match [red on blue]
  const normalized = name.trim();
  return openTagStyle(opened) === normalized || opened.styleName === normalized;
}

function findLastOpen(stack: OpenTag[], name: string): number {
  return findLastIndex(stack, (entry) => closesByName(entry, name));
}

function findLastIndex<T>(items: readonly T[], match: (item: T) => boolean): number {
  for (let i = items.length - 1; i >= 0; i--) {
    if (match(items[i]!)) return i;
  }
  return -1;
}

// --- Plugin registry ---

export interface MarkupTagContext {
  /** Parsed `key=value` attributes from the opening tag. */
  attrs: Record<string, string>;
  /**
   * Inner markup, already parsed (registry-aware) into a `RichText`. It carries
   * no `baseStyle`: that is painted once, under the whole output, so it sits
   * beneath whatever the handler returns.
   */
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
 * whose returned `RichText` stands in the output where its pair stood, under
 * any style tag that encloses the pair. The recursion is into the inner slice
 * of each plugin pair, and every recursion node returns a `RichText`.
 */
export function renderMarkup(
  markup: string,
  options?: RenderMarkupOptions,
): RichText {
  return renderSlice(tokenize(markup), { source: markup, enclosing: [] }, options);
}

/**
 * A string as the text it draws, the way Rich's `render_str` makes one: read
 * as markup unless `markup` is false, then highlighted by `highlighter` if
 * there is one. The text is a fragment, so its `end` is empty. `print` and
 * every renderable that is handed a string both draw it through here, so a
 * console's settings mean the same thing wherever the string lands.
 * [LAW:single-enforcer]
 */
export function renderStr(source: string, settings: Pick<DrawOptions, "markup" | "highlighter">): RichText {
  const text = settings.markup === false ? new RichText(source) : renderMarkup(source);
  text.end = "";
  settings.highlighter?.highlight(text);
  return text;
}

function renderSlice(
  tokens: readonly MarkupToken[],
  origin: SliceOrigin,
  options?: RenderMarkupOptions,
): RichText {
  const registry = options?.registry ?? globalMarkupRegistry;
  // Pair each opening plugin tag with its matching closer up-front, so the
  // splice walk can just iterate top-level pairs in source order with no
  // nested-state book-keeping.
  const { annotated, topLevel: tagPairs } = pairPluginTags(tokens.filter(isTag), registry, origin);

  // [LAW:one-type-per-behavior] Each top-level plugin pair is resolved by its
  // handler, and what it returns takes the pair's place in one built-in walk
  // over the whole slice. Rendering the text between pairs as separate parses
  // is what closed every style tag at a plugin boundary (rich-markup-cg6).
  const parts: MarkupPart[] = [];
  let cursor = 0;
  for (const [openIdx, closeIdx] of tagPairs) {
    const open = annotated[openIdx]!;
    const close = annotated[closeIdx]!;
    parts.push({ kind: "markup", tokens: within(tokens, cursor, open.start) });

    const innerRaw = origin.source.slice(open.end, close.start);
    // The base style is painted once, under the whole output, by the top of
    // this recursion. Painted into `children` as well, it came back spliced in
    // over every tag enclosing the pair.
    const innerRichText = renderSlice(
      within(tokens, open.end, close.start),
      { ...origin, enclosing: [...origin.enclosing, open.fullMatch] },
      { ...options, baseStyle: undefined },
    );
    const handler = registry.get(open.pluginName!)!;
    parts.push({ kind: "rendered", text: handler({ attrs: open.attrs!, children: innerRichText, raw: innerRaw }) });
    cursor = close.end;
  }
  parts.push({ kind: "markup", tokens: within(tokens, cursor, Infinity) });

  return render(parts, origin, options?.baseStyle, { emoji: options?.emoji !== false });
}

interface PluginTag extends ParsedTag {
  pluginName?: string;
  attrs?: Record<string, string>;
}

function pairPluginTags(
  tags: ParsedTag[],
  registry: MarkupRegistry,
  origin: SliceOrigin,
): { annotated: PluginTag[]; topLevel: Map<number, number> } {
  // Annotate tags with plugin info, then pair openers with closers. Only
  // top-level pairs are returned; inner pairs will be re-discovered by the
  // recursive `renderSlice` call on the inner slice.
  const annotated: PluginTag[] = tags.map((t) => annotatePluginTag(t, registry));
  // [LAW:one-source-of-truth] `[/]` closes the most recent open tag of *any*
  // kind, so this walk keeps the one stack the built-in dialect keeps, style
  // tags on it too; an implicit close pairs a plugin tag exactly when it is on
  // top. A stack of plugin tags alone cannot say what `[/]` refers to, which is
  // why `[shout]one[/]` used to leave its handler unfired (rich-markup-gfr).
  //
  // A pair's end closes everything opened inside it, because that is where the
  // recursion's slice ends and the built-in walk closes what is left open. The
  // stack drops them there too, so a later `[/]` means here what it means to
  // the walk that renders it.
  const stack: number[] = [];
  const pairs = new Map<number, number>();
  // Each opener's closing tag, whichever tag closed it — its own or a pair's end.
  const closedAt = new Map<number, number>();
  // Each tag a pair's end closed, with that pair's opening tag.
  const closedByPair = new Map<number, number>();
  // Style tags closed inside a plugin tag they opened outside of, keyed by that
  // plugin tag — a crossing only once the plugin tag turns out to pair.
  const crossedInto = new Map<number, { styleOpen: number; close: number }>();

  const isOpener = (t: PluginTag): boolean => !t.isClosing && !t.isImplicitClose;
  const isPlugin = (idx: number): boolean => annotated[idx]!.pluginName !== undefined;
  const closes = (close: PluginTag) => (openIdx: number): boolean => {
    const open = annotated[openIdx]!;
    if (close.isImplicitClose) return true;
    return close.pluginName !== undefined
      ? open.pluginName === close.pluginName
      : open.pluginName === undefined && closesByName(open, close.styleName);
  };
  // The tags open at a tag's position, as the built-in walk would report them.
  const openAt = (caret: number): string[] =>
    annotated.flatMap((t, k) => (k < caret && isOpener(t) && (closedAt.get(k) ?? Infinity) >= caret ? [t.fullMatch] : []));
  const crossing = (styleOpen: number, close: number, pairOpen: number): MarkupSyntaxError =>
    new MarkupSyntaxError(
      `Closing tag ${annotated[close]!.fullMatch} closes ${annotated[styleOpen]!.fullMatch} ` +
        `across the boundary of plugin tag ${annotated[pairOpen]!.fullMatch}: ` +
        `a style tag must open and close on the same side of a plugin pair, ` +
        `because the handler replaces the text inside it.`,
      origin.source,
      annotated[close]!.start,
      [...origin.enclosing, ...openAt(close)],
    );

  for (let i = 0; i < annotated.length; i++) {
    const t = annotated[i]!;
    if (isOpener(t)) {
      stack.push(i);
      continue;
    }
    const j = findLastIndex(stack, closes(t));
    if (j === -1) {
      // [LAW:no-silent-failure] A closer that matches nothing reaches for the
      // last tag before it that it could name, `[/]` and `[/name]` alike. If a
      // pair's end closed that tag, the closer reaches across the pair, and
      // saying so beats the built-in parser's "doesn't match any open tag";
      // otherwise the built-in parser rejects it, with the location it reports.
      let target = i - 1;
      while (target >= 0 && !(isOpener(annotated[target]!) && closes(t)(target))) target--;
      const pairOpen = closedByPair.get(target);
      if (pairOpen === undefined) continue;
      if (t.pluginName === undefined) throw crossing(target, i, pairOpen);
      // Overlap is unrepresentable rather than unimplemented: a handler receives
      // `children` as one contiguous slice, so a region straddling another
      // pair's closing boundary has nothing to hand it. A style span may cross
      // another style span because it annotates; a plugin pair may not because
      // it replaces. The caret goes where nesting broke: the outer pair's end.
      const inner = annotated[target]!;
      const outer = annotated[pairOpen]!;
      const caret = closedAt.get(pairOpen)!;
      throw new MarkupSyntaxError(
        `Plugin tag [${inner.pluginName}] overlaps [${outer.pluginName}]: plugin tags must nest, ` +
          `because a handler receives one contiguous slice. ` +
          `Close [/${inner.pluginName}] before [/${outer.pluginName}].`,
        origin.source,
        annotated[caret]!.start,
        [...origin.enclosing, ...openAt(caret)],
      );
    }
    const openIdx = stack[j]!;
    if (!isPlugin(openIdx)) {
      for (const k of stack.slice(j + 1)) {
        if (isPlugin(k) && !crossedInto.has(k)) crossedInto.set(k, { styleOpen: openIdx, close: i });
      }
      stack.splice(j, 1);
      closedAt.set(openIdx, i);
      continue;
    }
    const crossed = crossedInto.get(openIdx);
    if (crossed !== undefined) throw crossing(crossed.styleOpen, crossed.close, openIdx);
    for (const k of stack.splice(j)) {
      closedAt.set(k, i);
      if (k !== openIdx) closedByPair.set(k, openIdx);
    }
    pairs.set(openIdx, i);
  }
  // Pairs nest, so one is top-level exactly when it opens after the last
  // top-level pair closed. Decided after the walk and not at each close: a
  // plugin tag still on the stack there may never pair, and then encloses
  // nothing.
  const topLevel = new Map<number, number>();
  let outerClose = -1;
  for (const openIdx of [...pairs.keys()].sort((a, b) => a - b)) {
    if (openIdx < outerClose) continue;
    outerClose = pairs.get(openIdx)!;
    topLevel.set(openIdx, outerClose);
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
