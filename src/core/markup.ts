/**
 * Markup — BBCode-inspired markup parser for inline styling.
 * Parses `[bold red]text[/bold red]` into RichText with styled spans.
 *
 * Plugin tags ([LAW:locality-or-seam]): a `MarkupRegistry` lets consumers
 * register tag handlers without forking the parser. When the parser sees
 * `[name attrs...]inner[/name]` and `name` is registered, it parses attrs,
 * renders the inner markup as the child `RichText`, and calls the handler —
 * splicing the `RichText` it returns into the output. The
 * built-in style dialect and the plugin dialect are routed by the registry,
 * which is the single trust boundary between them.
 *
 * Plugin pairs must nest. The built-in dialect admits non-strict nesting
 * (`[bold]a[italic]b[/bold]c[/italic]`) because a style is an annotation and
 * annotations may overlap freely; a plugin tag is a replacement whose handler
 * takes one contiguous `inner`, so an overlapping pair has no slice to hand it
 * and is rejected with a `MarkupSyntaxError`. For the same reason a style tag
 * may not open on one side of a plugin tag and close on the other.
 */

import { cellLen } from "./cells.js";
import { Style, StyleSyntaxError } from "./style.js";
import { RichText, stripControlChars } from "./text.js";
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
   * The opening tags still open at `offset`, outermost first, as written.
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
 * once, over the whole string, and the walk reads it end to end; re-reading a
 * slice would lose what came before it — a slice cut at
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
 * The style string an open tag closes into — `name`, or `name parameters` when
 * the tag carried an `=`.
 *
 * [LAW:one-source-of-truth] One answer for the two sites that ask it: the span
 * a tag closes into, whichever of `[/name]`, `[/]`, a plugin pair's end or the
 * end of input closed it, and the search that matches `[/red on blue]` back to
 * `[red on blue]`. It was once written out at each closing path, which is how
 * those paths could — and did — drift apart on something none of the copies
 * was about.
 */
function openTagStyle(opened: StyleTagText): string {
  return opened.parameters !== undefined
    ? `${opened.styleName} ${opened.parameters}`
    : opened.styleName;
}

type StyleTagText = Pick<ParsedTag, "styleName" | "parameters">;

/** Whether `[/name]` names the style tag `opened`. */
function closesByName(opened: StyleTagText, name: string): boolean {
  // Handle "on" in style names for closing: [/red on blue] should match [red on blue]
  const normalized = name.trim();
  return openTagStyle(opened) === normalized || opened.styleName === normalized;
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
 * any style tag that encloses the pair.
 */
export function renderMarkup(
  markup: string,
  options?: RenderMarkupOptions,
): RichText {
  const registry = options?.registry ?? globalMarkupRegistry;
  return compose(walk(tokenize(markup), markup, registry, options?.emoji !== false), options?.baseStyle);
}

/**
 * A string as the text it draws, before any highlighting: read as markup
 * unless `markup` is false, its emoji codes replaced either way, as Rich's
 * `render_str` reads one, its `end` the default line end Rich's leaves it.
 * A site that sets the text into a line it shares clears that end itself.
 * [LAW:single-enforcer]
 */
export function readStr(source: string, markup: boolean): RichText {
  return markup ? renderMarkup(source) : new RichText(emojiReplace(source));
}

/**
 * The highlighter a string is drawn with under `settings`: its `highlighter`
 * while `highlight` is not false — Rich's `render_str`, which highlights with
 * `console.highlighter` when `highlight` is true or left to the console.
 * [LAW:single-enforcer]
 */
export function activeHighlighter(
  settings: Pick<DrawOptions, "highlight" | "highlighter">,
): DrawOptions["highlighter"] {
  return settings.highlight === false ? undefined : settings.highlighter;
}

/**
 * A string as the text it draws, the way Rich's `render_str` makes one: read
 * by `readStr` under `markup`, then highlighted by `activeHighlighter`.
 * `print` and every renderable that is handed a string both draw it this way,
 * so a console's settings mean the same thing wherever the string lands.
 */
export function renderStr(
  source: string,
  settings: Pick<DrawOptions, "markup" | "highlight" | "highlighter">,
): RichText {
  const text = readStr(source, settings.markup !== false);
  activeHighlighter(settings)?.highlight(text);
  return text;
}

// --- The walk ---

/** Text and the paint laid on it, as `compose` draws it. */
interface Frame {
  readonly plain: string;
  /** Style tags, in the order they closed. */
  readonly spans: readonly TagSpan[];
  /** Handlers' output, in the order it was written. */
  readonly spliced: readonly Splice[];
}

/** A closed style tag: the definition or name it opened with, over the text it enclosed. */
interface TagSpan {
  readonly start: number;
  readonly end: number;
  readonly style: string;
}

interface Splice {
  readonly at: number;
  readonly text: RichText;
}

/**
 * What the walk has written so far. The text is kept as chunks, so a plugin
 * pair takes its content off the end without copying what came before it.
 */
interface Output {
  readonly chunks: string[];
  length: number;
  readonly spans: TagSpan[];
  readonly spliced: Splice[];
}

/** Where an `Output` stood at one moment: everything written since is its tail. */
interface Mark {
  readonly at: number;
  readonly chunks: number;
  readonly spans: number;
  readonly spliced: number;
}

function markOf(out: Output): Mark {
  return { at: out.length, chunks: out.chunks.length, spans: out.spans.length, spliced: out.spliced.length };
}

function write(out: Output, text: string): void {
  out.chunks.push(text);
  out.length += text.length;
}

/** Everything written since `mark`, taken off `out` and positioned from 0. */
function takeFrom(out: Output, mark: Mark): Frame {
  out.length = mark.at;
  return {
    plain: out.chunks.splice(mark.chunks).join(""),
    spans: out.spans.splice(mark.spans).map(({ start, end, style }) => ({ start: start - mark.at, end: end - mark.at, style })),
    spliced: out.spliced.splice(mark.spliced).map(({ at, text }) => ({ at: at - mark.at, text })),
  };
}

/** A tag whose name addresses a handler in the registry the walk was given. */
interface PluginTag {
  readonly name: string;
  readonly handler: MarkupTagHandler;
  readonly attrs: Record<string, string>;
}

/** A tag the walk has opened, and how it was closed once it is. */
interface Opened {
  readonly tag: ParsedTag;
  /** Where the output stood when this tag opened: its span starts there, and a pair's content is what follows. */
  readonly mark: Mark;
  readonly plugin: PluginTag | undefined;
  /** The offset of the tag that closed this one, and the pair whose end did, if one did. */
  closed: { readonly at: number; readonly byPair: OpenedPlugin | undefined } | undefined;
}

type OpenedPlugin = Opened & { readonly plugin: PluginTag };

function isPlugin(opened: Opened): opened is OpenedPlugin {
  return opened.plugin !== undefined;
}

/**
 * Reads a whole markup string's tokens into one frame: every style tag a
 * span, every plugin pair resolved by its handler.
 *
 * [LAW:one-source-of-truth] One stack of open tags and one rule for what each
 * closing tag closes — `namedBy` — for style tags and plugin tags alike. Plugin
 * pairs used to be found by a walk of their own, ahead of the one that built
 * spans, and each kept its own stack; the two had to agree on every closing
 * rule, and review found three places they did not (rich-markup-pyq5). One
 * walk also rejects in string order, since every tag is judged when it is
 * reached: a crossing found by the pairing walk used to hide a stray closer
 * before it.
 *
 * Module-private on purpose, as `compose` is: `renderMarkup` is this module's
 * one crossing. [LAW:single-enforcer] The built-in parser was once exported,
 * and two callers bound to it under the name `renderMarkup`, so a tag on
 * `globalMarkupRegistry` resolved in a table cell and was silently eaten by
 * `console.print` (rich-markup-pcp).
 *
 * A plugin tag's content is everything written after it, because the walk
 * cannot know yet whether the tag will pair. When it pairs, that tail is taken
 * off the output as the handler's `children`, and the handler's output is
 * written in its place. When it never does — an outer pair's end or the end
 * of the string closes it — nothing moves: the tag is a style span over its
 * content, like any tag naming no style, and costs what one does.
 */
function walk(tokens: readonly MarkupToken[], source: string, registry: MarkupRegistry, emoji: boolean): Frame {
  const out: Output = { chunks: [], length: 0, spans: [], spliced: [] };
  const start = markOf(out);
  const stack: Opened[] = [];
  // Every tag opened so far, in source order, for a rejection to look back on.
  const opened: Opened[] = [];

  const openAt = (offset: number): string[] =>
    opened.filter((o) => o.tag.start < offset && (o.closed?.at ?? Infinity) >= offset).map((o) => o.tag.fullMatch);
  const unparsable = (reason: string, offset: number): MarkupSyntaxError =>
    new MarkupSyntaxError(reason, source, offset, openAt(offset));
  const crossing = (style: Opened, closer: ParsedTag, pair: Opened): MarkupSyntaxError =>
    unparsable(
      `Closing tag ${closer.fullMatch} closes ${style.tag.fullMatch} ` +
        `across the boundary of plugin tag ${pair.tag.fullMatch}: ` +
        `a style tag must open and close on the same side of a plugin tag, ` +
        `because a handler replaces the text between a plugin tag and its closer.`,
      closer.start,
    );

  // [LAW:no-silent-failure] A closing tag that closes nothing reaches for the
  // last tag before it that it names. If a pair's end closed that tag, the
  // closer reaches across the pair, and saying so beats "doesn't match".
  const stray = (closer: ParsedTag, plugin: PluginTag | undefined): MarkupSyntaxError => {
    const named = opened.filter(namedBy(closer, plugin)).at(-1);
    const closed = named?.closed;
    const pair = closed?.byPair;
    if (named === undefined || closed === undefined || pair === undefined) {
      return unparsable(
        closer.isImplicitClose
          ? `Closing tag ${closer.fullMatch} has no open tag to close`
          : `Closing tag ${closer.fullMatch} doesn't match any open tag`,
        closer.start,
      );
    }
    if (!pairs(closer, plugin, named)) return crossing(named, closer, pair);
    // Overlap is unrepresentable rather than unimplemented: a handler receives
    // `children` as one contiguous slice, so a region straddling another pair's
    // closing boundary has nothing to hand it. A style span may cross another
    // style span because it annotates; a plugin pair may not because it
    // replaces. The caret goes where nesting broke: the outer pair's end.
    return unparsable(
      `Plugin tag [${named.plugin.name}] overlaps [${pair.plugin.name}]: plugin tags must nest, ` +
        `because a handler receives one contiguous slice. ` +
        `Close [/${named.plugin.name}] before [/${pair.plugin.name}].`,
      closed.at,
    );
  };

  // Closes a tag as a style span over what was written since it opened. A
  // plugin tag closed this way never paired.
  const settle = (tag: Opened, at: number | undefined, byPair: OpenedPlugin | undefined): void => {
    tag.closed = at === undefined ? undefined : { at, byPair };
    out.spans.push({ start: tag.mark.at, end: out.length, style: openTagStyle(tag.tag) });
  };

  for (const token of tokens) {
    if (!isTag(token)) {
      // A `\[` in front of a bracket no tag starts at is unescaped here, per
      // text token, as the reference does; a tag's own escape was settled by
      // `tokenize` against its backslash run.
      const text = token.text.replace(/\\\[/g, "[");
      // Text reaches the output as `RichText` will hold it, so every offset
      // counted along the way — a span, a splice point — indexes the text it
      // lands on. Stripped only by the constructor, a control character
      // shifted every style after it one cell right.
      write(out, stripControlChars(emoji ? emojiReplace(text) : text));
      continue;
    }
    const plugin = pluginOf(token, registry);
    if (!token.isClosing && !token.isImplicitClose) {
      const entry: Opened = { tag: token, mark: markOf(out), plugin, closed: undefined };
      stack.push(entry);
      opened.push(entry);
      continue;
    }

    const j = findLastIndex(stack, namedBy(token, plugin));
    if (j === -1) throw stray(token, plugin);
    const target = stack[j]!;
    if (!pairs(token, plugin, target)) {
      // A closer that ends no pair may pass over style tags, which overlap
      // freely, but not over a plugin tag: the handler replaces what is
      // inside it.
      const boundary = findLastIndex(stack, isPlugin);
      if (boundary > j) throw crossing(target, token, stack[boundary]!);
      stack.splice(j, 1);
      settle(target, token.start, undefined);
      continue;
    }

    // A pair's end closes everything opened inside it, innermost first, so the
    // handler's `children` hold every span its content carries.
    const inside = stack.splice(j).slice(1);
    for (const tag of inside.reverse()) settle(tag, token.start, target);
    target.closed = { at: token.start, byPair: undefined };
    const { handler, attrs } = target.plugin;
    const children = compose(takeFrom(out, target.mark));
    const text = handler({ attrs, children, raw: source.slice(target.tag.end, token.start) });
    out.spliced.push({ at: out.length, text });
    write(out, text.plain);
  }

  // Close what is still open, innermost first. The reference pops its stack
  // here (`while style_stack: start, tag = style_stack.pop()`), and popping is
  // what keeps every span in the order its tag closed — the one order
  // `compose`'s sort is defined against.
  while (stack.length > 0) settle(stack.pop()!, undefined, undefined);
  return takeFrom(out, start);
}

/**
 * Which open tags a closing tag names: `[/]` every one, and `[/name]` a tag
 * whose style it names or a plugin tag of the plugin it names.
 */
function namedBy(closer: ParsedTag, plugin: PluginTag | undefined): (opened: Opened) => boolean {
  if (closer.isImplicitClose) return () => true;
  return (opened) => closesByName(opened.tag, closer.styleName) || pairs(closer, plugin, opened);
}

/** Whether `closer` ends a plugin pair at `opened`: `[/]`, or its plugin's own name. */
function pairs(closer: ParsedTag, plugin: PluginTag | undefined, opened: Opened): opened is OpenedPlugin {
  return opened.plugin !== undefined && (closer.isImplicitClose || opened.plugin.name === plugin?.name);
}

/** A frame as the `RichText` it draws, `baseStyle` beneath all of it. */
function compose(frame: Frame, baseStyle?: string | Style): RichText {
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
  const spans = [...frame.spans].reverse().sort((a, b) => a.start - b.start);

  const result = new RichText(frame.plain);
  if (baseStyle) result.stylize(baseStyle);

  // Apply link parameters as link styles
  for (const { start, end, style } of spans) {
    // Check if this is a link tag (name=url pattern was parsed)
    const linkMatch = /^link\s+(.+)$/.exec(style);
    if (linkMatch) {
      result.stylize(new Style({ link: linkMatch[1] }), start, end);
    } else {
      result.stylize(style, start, end);
    }
  }

  // A handler's own styles go down last — its base style, then its spans.
  // Every style span that reaches into a handler's output encloses all of it —
  // no style tag may cross a plugin pair's boundary — so each of these is the
  // inner span, and inner repaints outer exactly as the sort above has it for
  // tags.
  for (const { at, text } of frame.spliced) {
    result.stylize(text.style, at, at + text.length);
    for (const span of text.spans) result.stylize(span.style, at + span.start, at + span.end);
  }

  return result;
}

function pluginOf(tag: ParsedTag, registry: MarkupRegistry): PluginTag | undefined {
  // The tokenizer splits at the first `=`, so tag.styleName for
  // `[click verb=foo]` is "click verb". Re-read the tag text for a name that
  // actually addresses a plugin.
  const inner = tag.fullMatch.slice(1, -1).replace(/^\//, "");
  const name = PLUGIN_TAG_HEAD.exec(inner)?.[1];
  const handler = name === undefined ? undefined : registry.get(name);
  if (name === undefined || handler === undefined) return undefined;
  const attrs = tag.isClosing ? {} : parsePluginAttrs(inner.slice(name.length));
  return { name, handler, attrs };
}
