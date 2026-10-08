/**
 * Pretty — formats JavaScript data structures with highlighting.
 *
 * Lives in `core/` beside `markup` and `emoji` because it does their job: turn
 * foreign input into `RichText`. It composes no other renderable — the trait
 * every file in `renderables/` shares and this one does not — and its imports
 * are core primitives only. `Console.print` accepts `unknown` and must turn any
 * of it into something renderable, so the formatter has to sit where `console`
 * can reach it without an upward edge. [LAW:one-way-deps]
 *
 * Two traversals share this file, and the split is the whole design. `_format`
 * lays a value out across lines; `_oneLine` answers only "does this fit on one
 * line, and if so what is it?". They meet at `_shape`, which describes a
 * container without committing to either layout. One traversal answering both
 * questions is what made this formatter exponential: every child was rendered
 * once to probe it and again to place it, so a node at depth d was visited 2^d
 * times.
 */

import { asCellCol, cellColToCodeUnitOffset, cellLen, graphemes, splitAtCells } from "./cells.js";
import { divideLine } from "./wrap.js";
import { Segment } from "./segment.js";
import { RichText, stripControlChars } from "./text.js";
import { ReprHighlighter } from "./highlighter.js";
import type { Highlighter } from "./highlighter.js";
import { drawable } from "./protocol.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "./protocol.js";

export interface PrettyOptions {
  indent?: number;
  expandAll?: boolean;
  maxLength?: number;
  /**
   * How many characters of a string to show before cutting it, counting the
   * rest after the closing quote. A character is a grapheme cluster, not a
   * UTF-16 code unit: `"😀😀"` is two, though its `length` is four.
   */
  maxString?: number;
  /**
   * How many levels of nesting to descend before eliding. Unbounded by default.
   *
   * `Console.print` supplies a bound because it formats whatever it is handed;
   * a caller constructing a `Pretty` has seen their data and can say what they
   * want. Past the cap a container renders as `[...]`, `{...}`, `Map {...}` or
   * `Set {...}` — visible, so the reader knows the value continues.
   */
  maxDepth?: number;
  /**
   * Draw a `│` in the first cell of each level of indent. Off by default, as
   * the reference's is, and never drawn on an ASCII-only console, where the
   * reference draws none.
   */
  indentGuides?: boolean;
  /**
   * Who colours the formatted text. Defaults to a `ReprHighlighter`.
   *
   * Passed rather than imported so a caller's choice survives. `Console.print`
   * routes data arguments through here, and its `highlight` flag and custom
   * `highlighter` have to reach the output the same way they reach a printed
   * string — a `Pretty` reaching for its own singleton would silently outrank
   * both. `NullHighlighter` is the "none" case.
   *
   * It reads each `Map` entry's `=>` as `= `: the arrow is this formatter's
   * punctuation, not the data's, and its `>` would close a repr tag opened by
   * any `<` before it.
   */
  highlighter?: Highlighter;
}

const reprHighlighter = new ReprHighlighter();

/**
 * What a value is bounded by when whoever formats it has not seen it:
 * `Console.print`'s data arguments, and a thrown value `Traceback` reports.
 *
 * Such a caller has to assume nothing about the value's size, in any of the
 * three ways a value can be large. Unbounded, a buffer emits a line per byte, a
 * deeply nested object descends until the stack gives out, and a single
 * response body assigned to a field arrives in full — each of them a line that
 * costs megabytes or hangs the terminal. All three bounds announce themselves
 * in the output (`... +N`, `{...}`, `+N` after the closing quote), so this
 * truncates visibly and never silently. [LAW:no-silent-failure]
 *
 * A caller constructing a `Pretty` has seen their data and gets no defaults;
 * these belong to the paths that format what they were handed, not to the
 * formatter.
 */
export const UNSEEN_DATA_BOUNDS = { maxLength: 100, maxDepth: 16, maxString: 1000 } as const;


/**
 * Where a laying-out traversal is: the column its line starts at (`inset`),
 * how deep in the data we are (`level`), and how much of the current line is
 * already spoken for (`column`).
 *
 * `inset` and `level` are separate because they answer to different things —
 * `level` is what `maxDepth` caps, and only ever increases. Collapsing them
 * made the cap read the layout number, and every compact probe reset it, so the
 * cap never fired at all. `Probe` is why that cannot recur: the traversal that
 * used to do the resetting has no `inset` to reset.
 *
 * `column` is separate from `inset` for the same reason: `inset` says where
 * the line a value is placed onto starts, and so where its closer goes and
 * one indent past which its children go if it expands. `column` says where
 * its *own* text begins on that line — which a `key: ` prefix or a Map
 * entry's `" => "` moves per hole, without touching `inset`. A key that wraps
 * moves `inset` too: the value after it is on the key's last row, which
 * starts at the key's hang, and children indented from the slot instead
 * would sit level with the key's own continuation.
 *
 * rich-pretty-xms: a container's compact try used
 * `maxWidth - cellLen(indentStr)` as its budget, which is only the true
 * remaining width when nothing precedes the value on its line — true for an
 * array element, false for `metadata: { ... }`, where the key eats 10 cells
 * `indentStr` never counted. Threading the real column through is the fix;
 * deriving a budget from `inset` alone was the bug.
 *
 * `reserve` is `column`'s mirror: cells a fixed piece of literal text —
 * a hole's own `tail`, or the `,` `_formatObject` joins non-last slots with —
 * is known to cost on this same line immediately after the value, before the
 * value has been asked to fit. Charged as `maxWidth - column - reserve`, the
 * same way `column` charges what precedes. Without it, a value could fit
 * `maxWidth - column` exactly and still overrun once its own trailing `tail`
 * or the container's own trailing `,` landed after it — the same failure as
 * the untracked-key bug, mirrored onto the other side of the value.
 *
 * `margin` is the indent the structure gives the slot this value is in, and so
 * where an indent guide may stand on the value's continuation rows. It is not
 * `inset`: a key that wraps moves `inset` to its own hang, which is the key's
 * continuation and not a level of the data.
 *
 * `hang` is where a continuation line of this value's own text begins — one
 * indent past `inset`, so a wrapped string or a multi-line
 * `toString` reads as belonging to its key rather than as the next key.
 * `null` at the root, and the type is what says the root is different: nothing
 * precedes it that this formatter wrote, so the line it lands on — and where a
 * wrap of it belongs — is its caller's. `Console.print` sets a root scalar in
 * a run of text, where a break chosen here would fall at the wrong column.
 *
 * `open` holds the objects between the root and here, not every object seen. A
 * value joins on the way down and leaves on the way back up, so a cycle is
 * caught while a DAG — one object reached twice through sibling positions —
 * still renders both times. A never-emptied set would call the second sibling
 * circular. [LAW:no-ambient-temporal-coupling] the traversal owns its state
 * explicitly; a field on the instance would leak between renders.
 */
interface Frame {
  readonly inset: number;
  readonly margin: number;
  readonly level: number;
  readonly maxWidth: number;
  readonly column: number;
  readonly reserve: number;
  readonly hang: number | null;
  readonly open: WeakSet<object>;
}

const rootFrame = (maxWidth: number): Frame => ({
  inset: 0,
  margin: 0,
  level: 0,
  maxWidth,
  column: 0,
  reserve: 0,
  hang: null,
  open: new WeakSet(),
});

/**
 * The column reached after `text` is appended to a line currently at `column`.
 *
 * A hole's formatted value can itself span multiple lines — a nested
 * container that failed its own compact try. What comes after it (a Map
 * entry's tail, the next hole) sits after `text`'s *last* line, not at
 * `column + cellLen(text)`, so a multi-line insert resets the column to that
 * last line's width instead of accumulating across lines that were never on
 * the same row.
 */
function lineColumn(column: number, text: string): number {
  const lastNewline = text.lastIndexOf("\n");
  return lastNewline === -1 ? column + cellLen(text) : cellLen(text.slice(lastNewline + 1));
}

/**
 * Laid-out text, and the column its last line starts at.
 *
 * What follows the text on that line — a Map entry's value, the value after a
 * wrapped key — indents its own children from there. Whatever laid the text
 * out reports it; it is never read back out of the text, because a multi-line
 * `toString`'s last line can open with whitespace of its own, and read as
 * indent, that put the children off the grid the rest of the output is on.
 */
interface Laid extends Lines {
  readonly inset: number;
}

/**
 * Text, and the margin of each line it starts: the cells of indent that are
 * the structure's, which is where an indent guide may stand.
 *
 * The margin is the one fact about a line its whitespace cannot give back. A
 * wrapped string's rows hang one indent past their slot and a multi-line
 * `toString` brings indent of its own, and a guide drawn in either lands inside
 * the value. So a line's margin is recorded where the line is started, the only
 * place that knows it, and pieces are joined with `cat`, which keeps each margin
 * with its line. [LAW:one-source-of-truth] text reaches a new line only through
 * `newline`, so there is no newline without a margin, and every margin is
 * written: a line that looks blank may still be continued, by a `,` or a key's
 * value, and what continues it belongs inside the structure.
 */
interface Lines {
  readonly text: string;
  /** One per `\n` in `text`, in order: the first line continues its caller's. */
  readonly margins: readonly number[];
  /**
   * Where in `text`, in order, each `>` of a Map entry's `=>` is.
   *
   * rich-pretty-h1uu: the arrow is this formatter's punctuation, and the
   * reference's output has none — a Python repr has no `=>`. Left in the text
   * the highlighter reads, its `>` closed the repr tag pattern, which runs from
   * the first `<` to the last `>`, so a `<` in any key or value tagged
   * everything from there to the last arrow. A `>` the data wrote is the data's
   * and stays; which of them is an arrow's is known only here, where the arrow
   * is written, and not recoverable from the text.
   */
  readonly arrows: readonly number[];
}

/** Text with no line break in it. */
const flat = (text: string): Lines => ({ text, margins: [], arrows: [] });

/** A new line whose first `margin` cells are the structure's indent. */
const newline = (margin: number): Lines => ({ text: "\n" + " ".repeat(margin), margins: [margin], arrows: [] });

/** What follows a Map entry's key. */
const ARROW_TEXT = " => ";
// [LAW:one-source-of-truth] the arrow's offset is read off its text, never kept beside it.
const ARROW: Lines = { text: ARROW_TEXT, margins: [], arrows: [ARROW_TEXT.indexOf(">")] };

/** An indent guide: one code unit, as the space it stands over is. */
const GUIDE = "│";

const placed = (lines: Lines, inset: number): Laid => ({ ...lines, inset });

const cat = (...parts: Lines[]): Lines => {
  // `+`, not `join`: a concatenation is left unflattened until it is read, and
  // each level of the data would otherwise copy the whole of its subtree's text.
  let text = "";
  const arrows: number[] = [];
  for (const part of parts) {
    for (const arrow of part.arrows) arrows.push(text.length + arrow);
    text += part.text;
  }
  return { text, margins: parts.flatMap((part) => part.margins), arrows };
};

/**
 * A container laid out across lines: `open`, each of `parts` on a line of its
 * own at `inner`, and `close` back at `outer`.
 *
 * Here and `follow` rather than inline because the traversal recurses once per
 * level of the data, and what its frames hold is what bounds the depth it
 * reaches; assembling a piece is done once the recursion under it has returned.
 */
function expansion(lead: Lines, shape: Container, parts: readonly Lines[], inner: number, outer: number): Laid {
  const lines = parts.map((part, i) => cat(flat(i === 0 ? "" : EXPAND_SEPARATOR), newline(inner), part));
  return placed(cat(lead, flat(shape.open), ...lines, newline(outer), flat(shape.close)), outer);
}

/**
 * `laid` and then `tail` after `out`. A value `_place` moved onto a line of its
 * own leaves the text before it ending the line, and the space that was to
 * separate them goes with it — spaces only, as a line break carries a margin.
 */
function follow(out: Lines, laid: Lines, tail: Lines): Lines {
  let end = out.text.length;
  while (laid.text.startsWith("\n") && out.text[end - 1] === " ") end--;
  return cat({ ...out, text: out.text.slice(0, end) }, laid, tail);
}

/**
 * `lines` as it is shown, where each run of guides is, and where each of its
 * `arrows` landed. A line with nothing
 * past its margin is blank, and loses the spaces its margin was written as.
 * With a `guide`, each indent of every margin has one in its first cell, as
 * the reference's `with_indent_guides` draws it, blank lines included, so the
 * rule runs unbroken. [LAW:dataflow-not-control-flow] no guide is `null`, and
 * the same pass runs either way.
 *
 * The guide offsets are counted over the text `RichText` will hold, which has
 * its control characters stripped; counted over the raw text, every guide past
 * a `\r` in a key or a `toString` would land one cell right. A margin is only
 * ever spaces, so stripping cannot move one. An arrow is moved by the
 * stripping of what precedes it, and by the blank lines dropped before it;
 * never inside its own line, whose row is the line itself or the same line
 * with guides over its margin. [LAW:types-are-the-program] that holds because
 * the only guide is `GUIDE`, one code unit over one space.
 */
function drawMargins(
  lines: Lines,
  indent: number,
  guide: typeof GUIDE | null,
): { plain: string; guides: Array<[number, number]>; arrows: number[] } {
  let raw = 0;
  let kept = 0;
  const stripped = lines.arrows.map((arrow) => {
    kept += stripControlChars(lines.text.slice(raw, arrow)).length;
    raw = arrow;
    return kept;
  });
  const arrows: number[] = [];
  // Each arrow before `end` in the stripped text is on the line that starts
  // at `from` there and at `to` in what is shown.
  const land = (from: number, to: number, end: number): void => {
    while (arrows.length < stripped.length && stripped[arrows.length]! < end) {
      arrows.push(to + stripped[arrows.length]! - from);
    }
  };
  const [first, ...rest] = stripControlChars(lines.text).split("\n");
  const guides: Array<[number, number]> = [];
  let offset = first!.length;
  let from = first!.length;
  land(0, 0, from);
  const rows = rest.map((line, i) => {
    const margin = lines.margins[i]!;
    const content = line.slice(margin);
    offset += 1;
    from += 1;
    if (guide !== null && margin > 0) guides.push([offset, offset + margin]);
    const row = guide === null
      ? (content === "" ? "" : line)
      : Array.from({ length: margin }, (_, cell) => (cell % indent === 0 ? guide : " ")).join("") + content;
    land(from, offset, from + line.length);
    offset += row.length;
    from += line.length;
    return row;
  });
  return { plain: [first, ...rows].join("\n"), guides, arrows };
}

/**
 * The rows `line` becomes: the first holds what `stay` code units of it leave
 * where the line starts, the rest are cut to `hangRoom` cells each.
 *
 * Every row but the first begins at a break, so whatever whitespace a break
 * leaves on either side of it is the break's and not the text's, and a row of
 * nothing else is no row at all. Each is then set in by the indent the line
 * opened with, so a wrapped line of a multi-line `toString` stays under its own
 * first word.
 */
function rowsOf(line: string, stay: number, hangRoom: number): string[] {
  const lead = line.slice(0, line.length - line.trimStart().length);
  const rest = line.slice(stay);
  const hung = splitAtCells(rest, divideLine(rest, asCellCol(hangRoom - cellLen(lead)), { fold: true }))
    .map((row) => row.trim())
    .filter((row) => row !== "")
    .map((row) => lead + row);
  return [line.slice(0, stay).trimEnd(), ...hung];
}

/**
 * How many code units of `line` stay where it starts, with `room` cells left
 * there.
 *
 * What stays is every whole word that fits. When not even the first does,
 * `canHang` says whether a hanging line starts further left than here: if so,
 * nothing stays and all of `line` moves there; if not, moving would gain
 * nothing, and the first word is folded where it stands.
 */
function stayingLength(line: string, room: number, canHang: boolean): number {
  if (cellLen(line.trimEnd()) <= room) return line.length;
  const cut = (fold: boolean): number => {
    const first = divideLine(line, asCellCol(room), { fold })[0];
    return first === undefined ? line.length : cellColToCodeUnitOffset(line, first);
  };
  const words = cut(false);
  if (cellLen(line.slice(0, words).trimEnd()) <= room) return words;
  return canHang ? 0 : cut(true);
}

/**
 * Where a fits-on-one-line traversal is.
 *
 * [LAW:types-are-the-program] It carries no `inset`, and that absence is the
 * point: a single-line form is the same string wherever it lands, so an
 * indented one is not a state worth being able to write down. The old code said
 * this by setting `inset: 0` on a `Frame` and trusting every arm to leave it
 * alone.
 *
 * `budget` is the cells still available on the line. It replaces the full width
 * because a one-line form wider than its budget is never used for anything, so
 * producing it is waste — and refusing to produce it is what stops an ancestor's
 * probe from walking a subtree it has already outgrown. That short-circuit is
 * what makes the traversal linear in depth rather than exponential.
 */
interface Probe {
  readonly level: number;
  readonly budget: number;
  readonly open: WeakSet<object>;
}

/**
 * The text, when it is a single line no wider than `budget` — otherwise `null`.
 *
 * The one definition of "fits on one line" in this file, and it has to name
 * both halves: `cellLen` scores a newline as zero cells, so a width check alone
 * accepted multi-line text as compact. That is how a `Map` nested in an object
 * used to render as `{ m: Map {` — a one-line object with an expansion wedged
 * inside it and the closing brace back at column 0.
 */
function fitOneLine(lines: Lines, budget: number): Lines | null {
  return lines.text.includes("\n") || cellLen(lines.text) > budget ? null : lines;
}

/**
 * The elements of an indexed sequence, or `null` for anything that isn't one.
 *
 * A typed array is an array with a fixed element type, and neither of the two
 * questions asked elsewhere in this file recognises it: `Array.isArray` says
 * false, and its own `toString` answers the bare `1,2,3` — no brackets, nothing
 * for the highlighter to colour per element. Both spellings reach the one arm
 * that knows what a sequence looks like. `DataView` is excluded because it is a
 * window onto bytes, not a sequence of values.
 *
 * Returned as `ArrayLike` rather than a materialised array because both
 * spellings already are one. Converting here would box every element of a
 * multi-megabyte `Buffer` to keep the first `maxLength` of them — bounding the
 * output while leaving the cost of producing it unbounded.
 */
function indexedElements(value: object): ArrayLike<unknown> | null {
  if (Array.isArray(value)) return value as unknown[];
  if (typedArrayName(value) !== undefined) return value as unknown as ArrayLike<unknown>;
  return null;
}

/*
 * Brand checks: what a value *is*, asked of the internal slot that makes it
 * one rather than of its prototype chain.
 *
 * `Pretty` reflects on values it did not create, and some were created in
 * another realm — a `vm` context, an iframe — whose `Map`, `DataView` and
 * `Object.prototype` are not this realm's. `instanceof` and prototype identity
 * answer "no" to every one of them, so a `Map` printed `[object Map]` and a
 * `DataView` printed as an empty array. Every built-in method reads its
 * receiver's slot and not its prototype, which is what makes these
 * realm-independent: the platform's own brand check, borrowed from this realm
 * and applied to a value from any.
 */

// %TypedArray%.prototype[Symbol.toStringTag]: a typed array's name, and
// `undefined` for every other receiver, `DataView` included — the spec's brand
// check for the family, and the one that never throws.
const typedArrayTag = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(Uint8Array.prototype) as object,
  Symbol.toStringTag,
)?.get;

function typedArrayName(value: object): string | undefined {
  return typedArrayTag?.call(value) as string | undefined;
}

/**
 * Is `value` a `Map` (or a `Set`), from this realm or any other?
 *
 * Three kinds of evidence, each the only one that sees some collection.
 * `instanceof` sees this realm's, a `Proxy` around one included. The
 * platform's `Symbol.toStringTag` names the kind in every realm and passes
 * through a `Proxy` — a reactive store made in an iframe — that has neither
 * this realm's prototype nor the slot; if such a proxy will not hand over its
 * entries, reading them throws and prints as `[Threw: …]`, never as an empty
 * collection. The slot sees a subclass from another realm that renamed its
 * tag: `has` throws on any receiver without one. A plain object has no tag at
 * all, so it is never asked — a throw costs a stack trace, too dear to pay for
 * every object printed.
 */
function isCollection(value: object, kind: MapConstructor | SetConstructor): boolean {
  if (value instanceof kind) return true;
  const tag = (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag];
  if (typeof tag !== "string") return false;
  if (tag === kind.name) return true;
  try {
    (kind.prototype.has as (this: unknown, key: unknown) => boolean).call(value, undefined);
    return true;
  } catch {
    return false;
  }
}

function isMap(value: object): value is Map<unknown, unknown> {
  return isCollection(value, Map);
}

function isSet(value: object): value is Set<unknown> {
  return isCollection(value, Set);
}

/**
 * Is `fn` the default `toString` of the realm that made it? A function's
 * prototype is its realm's `Function.prototype`, whose own prototype is that
 * realm's `Object.prototype` — two fixed steps from the function to the
 * default it is compared with, so no chain is walked and no identity with this
 * realm's is asked for.
 */
function isRealmDefaultToString(fn: object): boolean {
  const realmFunctionPrototype = Object.getPrototypeOf(fn) as object | null;
  return (
    realmFunctionPrototype !== null &&
    (Object.getPrototypeOf(realmFunctionPrototype) as { toString?: unknown } | null)?.toString === fn
  );
}

/**
 * The first `limit` items of a sequence, pulled and no more.
 *
 * A `Map` or `Set` reaches its size through `.size`, which iterates nothing, so
 * spreading one only ever served to throw the tail away — `print` of a
 * half-million-entry cache walked all of it to show a hundred. `Infinity` is
 * the unbounded case and never breaks.
 */
function take<T>(source: Iterable<T>, limit: number): T[] {
  const taken: T[] = [];
  if (limit <= 0) return taken;
  for (const item of source) {
    taken.push(item);
    if (taken.length >= limit) break;
  }
  return taken;
}

/**
 * What a value renders as when reading it threw instead of producing it.
 *
 * `Pretty` reflects on data it did not create, and every reflection it performs
 * — a property getter, `Object.keys`, an iterator, `toString` — can throw. The
 * message travels into the output, so the failure stays visible and attributed
 * to the position that produced it. [LAW:no-silent-failure] the error is
 * carried rather than swallowed; a marker naming its cause is not an
 * answer-shaped void, and a diagnostic that takes the program down over one
 * lazily-computed field is unusable on the objects it is most wanted for.
 */
function threw(error: unknown): string {
  // An `Error` from any realm carries its `message` as a string.
  const message = (error as { message?: unknown } | null)?.message;
  return `[Threw: ${typeof message === "string" ? message : String(error)}]`;
}

/**
 * Does this value carry its own string form, or must we reflect on its keys?
 *
 * A `Date`, an `Error`, a `RegExp`, or any object that defines `toString`
 * answers the display question itself, and reflecting on such a value throws
 * that answer away — `Object.keys(new Date())` is empty, so key-reflection
 * renders it `{}`. Inheriting `Object.prototype.toString` is the opposite
 * signal: it yields `[object Object]`, a non-answer, so the keys are all the
 * information there is.
 *
 * Both clauses are load-bearing. The identity check separates the two
 * populations; the `typeof` check is what makes `Object.create(null)` — which
 * has no `toString` at all — reflect rather than throw. The default is the one
 * of the realm that made the `toString`, not this one's: an object from a `vm`
 * context inherits a `toString` that is a different function and the same
 * non-answer.
 */
function describesItself(value: object): boolean {
  const asRecord = value as { toString?: unknown; [Symbol.toPrimitive]?: unknown };
  return (
    typeof asRecord[Symbol.toPrimitive] === "function" ||
    (typeof asRecord.toString === "function" &&
      !isRealmDefaultToString(asRecord.toString))
  );
}

/**
 * The name of an object the platform names but reflection cannot read — a
 * promise, a weak collection, a `WeakRef`, an `ArrayBuffer`, a generator — or
 * `null` when there is no such name or there are keys to show instead. Their
 * state lives in internal slots, so `Object.keys` finds nothing and the keys
 * form would print `{}`, which reads as an empty object. `Symbol.toStringTag` is
 * the kind the platform declares for each, and a subclass and an object from
 * another realm still carry it, so no list of built-ins is kept here. A
 * constructor named otherwise than its tag is named both ways, `Task [Promise]`,
 * in the shape Node's `util.inspect` uses.
 */
function opaqueName(value: object): string | null {
  const tag = (value as { [Symbol.toStringTag]?: unknown })[Symbol.toStringTag];
  if (typeof tag !== "string" || Object.keys(value).length > 0) return null;
  const named = (Object.getPrototypeOf(value) as { constructor?: { name?: unknown } } | null)?.constructor?.name;
  return typeof named === "string" && named !== "" && named !== tag ? `${named} [${tag}]` : tag;
}

/**
 * How `Pretty` reads an object: by index, by entry, by member, by key, as the
 * text it spells itself, or as the kind it is when its contents are out of
 * reach. `_shape` lays out each form, and `isExpandable` asks only which one it
 * is, so the two cannot disagree. [LAW:one-source-of-truth]
 */
type Form =
  | { kind: "indexed"; elements: ArrayLike<unknown> }
  | { kind: "map"; map: Map<unknown, unknown> }
  | { kind: "set"; set: Set<unknown> }
  | { kind: "opaque"; text: string }
  | { kind: "self" }
  | { kind: "keys"; record: Record<string, unknown> };

function formOf(value: object): Form {
  const elements = indexedElements(value);
  if (elements !== null) return { kind: "indexed", elements };
  if (isMap(value)) return { kind: "map", map: value };
  if (isSet(value)) return { kind: "set", set: value };
  // Below the Array/Map/Set arms deliberately: an array also overrides
  // `toString`, but "1,2,3" is a poorer answer than the structural form.
  if (describesItself(value)) return { kind: "self" };
  // Below `self`, so a promise subclass that spells itself keeps its spelling.
  const opaque = opaqueName(value);
  if (opaque !== null) return { kind: "opaque", text: `${opaque} {}` };
  return { kind: "keys", record: value as Record<string, unknown> };
}

// Which forms have positions to lay out, and which are one piece of text.
// [LAW:types-are-the-program] Keyed by every kind, so a new form cannot reach
// `isExpandable` without someone deciding which it is.
const LAID_OUT: Record<Form["kind"], boolean> = {
  indexed: true,
  map: true,
  set: true,
  keys: true,
  opaque: false,
  self: false,
};

/**
 * Whether `Pretty` lays a value out as a container — brackets and positions —
 * rather than spelling it as one piece of text. Emptiness and the depth cap do
 * not enter into it; `[]` is still a container that happens to print on one
 * line. This is Python Rich's `is_expandable`, and `Console.print` reads it to
 * give a container lines of its own.
 *
 * A value whose reflection throws is not one, as in the reference's
 * `_safe_isinstance`: `Pretty` then formats it as text, and the throw reaches
 * the output as `threw`'s marker rather than taking the print down.
 */
export function isExpandable(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  try {
    return LAID_OUT[formOf(value).kind];
  } catch {
    return false;
  }
}

/**
 * One value inside a slot, and the literal text that follows it.
 *
 * `read` is deferred rather than a value already in hand because reading is
 * itself the reflection that can throw, and each traversal wants to catch that
 * at its own position. A `Map` entry is the reason a slot holds a list of these
 * rather than a single value: its key is a formatted value too, so `1 => 2` is
 * two holes joined by literal text.
 */
interface Hole {
  readonly read: () => unknown;
  readonly tail: Lines;
}

/**
 * One position in a container: literal text, then values with text between.
 *
 * `head` is laid out as one piece: a key, or `"... +3"`, the elision marker —
 * one more position in the sequence rather than a suffix glued on after a
 * separator, so a bound of zero does not lead with the comma it was supposed
 * to follow. `join` ties the head to its first value, `": "` after a key. It
 * is not part of the head because a wrapped key leaves room for it on its last
 * row, as a value does for its `tail`; folded in, the `:` was one more
 * character to cut, and could land on a row of its own.
 */
interface Slot {
  readonly head: string;
  readonly join: string;
  readonly holes: readonly Hole[];
}

/**
 * What an object renders as, said without committing to a layout.
 *
 * This is the seam between the two traversals. `text` is a value that spells
 * itself and is done; a container names the brackets it wears and the positions
 * inside it, and each traversal joins those positions its own way. Both
 * traversals therefore agree on what a `Map` is called, where the elision
 * marker goes, and what an empty one looks like, because there is one
 * description and not two. [LAW:one-source-of-truth]
 */
interface Container {
  readonly kind: "container";
  readonly open: string;
  readonly close: string;
  /** What separates the brackets from the items on one line: `{ a: 1 }` vs `[1]`. */
  readonly pad: string;
  readonly slots: readonly Slot[];
}

type Shape = { readonly kind: "text"; readonly text: string } | Container;

/** What joins a container's positions on one line. Its width is charged for, so it is named once. */
const SEPARATOR = ", ";

/**
 * What joins a container's positions across lines, once it has expanded —
 * `SEPARATOR` without the trailing space a newline already provides.
 * rich-pretty-xms: named, and derived rather than a second hand-typed
 * literal, so the width it costs a non-last slot's own compact try —
 * reserved via `Frame.reserve` — cannot drift from what `_formatObject`
 * actually joins with.
 */
const EXPAND_SEPARATOR = SEPARATOR.trimEnd();

/** The marker for positions the bound dropped, or nothing when it dropped none. */
const elided = (dropped: number): Slot[] =>
  dropped > 0 ? [{ head: `... +${dropped}`, join: "", holes: [] }] : [];

/**
 * A key `Pretty._key` may leave bare. The bare form refuses a default-ignorable code point, which prints as
 * nothing, so `"a\ufe0f"` cannot pass for `a`; `ID_Continue` admits several.
 * An index is at most 15 digits: every such literal is a safe integer and
 * names itself, where `99999999999999999999` would name `1e20`'s key.
 */
const BARE_KEY = /^(?![^]*\p{Default_Ignorable_Code_Point})(?:[\p{ID_Start}$_][\p{ID_Continue}$]*|0|[1-9]\d{0,14})$/u;

/**
 * What Python's `str.isprintable` refuses \u2014 control, format, private-use,
 * unassigned, and every separator but the space \u2014 which Rich's repr escapes
 * and JSON.stringify leaves raw past C0. Raw, DEL vanishes in `RichText`, a C1
 * byte reaches the terminal as a control, and a format character hides or
 * reorders what is around it.
 */
const UNPRINTABLE = /(?! )[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Zl}\p{Zp}\p{Zs}]/gu;

/** `value` in double quotes, every character that does not print escaped. */
const quoted = (value: string): string =>
  JSON.stringify(value).replace(UNPRINTABLE, (c) => {
    const hex = c.codePointAt(0)!.toString(16).padStart(4, "0");
    return hex.length > 4 ? `\\u{${hex}}` : `\\u${hex}`;
  });

export class Pretty implements Renderable, Measurable {
  readonly data: unknown;
  readonly indent: number;
  readonly expandAll: boolean;
  readonly maxLength: number | undefined;
  readonly maxString: number | undefined;
  readonly maxDepth: number;
  readonly indentGuides: boolean;
  readonly highlighter: Highlighter;
  // [LAW:no-shared-mutable-globals] A private memo, written only by `_cutString`.
  private readonly cutStrings = new Map<string, string>();

  constructor(data: unknown, options?: PrettyOptions) {
    this.data = data;
    this.indent = options?.indent ?? 4;
    this.expandAll = options?.expandAll ?? false;
    this.maxLength = options?.maxLength;
    this.maxString = options?.maxString;
    this.maxDepth = options?.maxDepth ?? Infinity;
    this.indentGuides = options?.indentGuides ?? false;
    this.highlighter = options?.highlighter ?? reprHighlighter;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    // `toText` has no `end`, for callers that set it inside a line; rendered,
    // a `Pretty` is a block of its own, as the reference's is.
    yield* this.toText(options).render(options);
    yield Segment.line();
  }

  /** The value laid out for `options.maxWidth` and highlighted: the text this renders. */
  toText(options: RenderOptions): RichText {
    const laid = this._format(this.data, rootFrame(options.maxWidth));
    // The reference draws no guide at all on an ASCII-only console, so there is
    // no ASCII glyph to fall back to: `null` is none.
    const guide = this.indentGuides ? drawable<typeof GUIDE | null>(options, GUIDE, null, (g) => g ?? "") : null;
    const { plain, guides, arrows } = drawMargins(laid, this.indent, guide);
    // The highlighter reads the text with each arrow's `>` a space — of the
    // repr patterns only the tag's reads a `>` — and the text then shows it
    // again: one code unit for one, so every span lands where it was found.
    let reading = "";
    let from = 0;
    for (const arrow of arrows) {
      reading += plain.slice(from, arrow) + " ";
      from = arrow + 1;
    }
    const text = new RichText(reading + plain.slice(from), { end: "" });
    this.highlighter.highlight(text);
    text.plain = plain;
    for (const [start, end] of guides) text.stylize("repr.indent", start, end);
    return text;
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const formatted = this._format(this.data, rootFrame(_options.maxWidth)).text;
    const lines = formatted.split("\n");
    let max = 0;
    for (const line of lines) {
      max = Math.max(max, cellLen(line));
    }
    return { minimum: 1, maximum: Math.min(max, _options.maxWidth) };
  }

  /**
   * The text a value shows without being reflected on, or `null` when it is an
   * object and the shape arms own it.
   *
   * Every kind answered here renders the same wherever it sits — no
   * indentation, no width to fit — which is why one method serves both
   * traversals.
   */
  private _scalar(value: unknown): string | null {
    if (value === null) return "null";
    if (value === undefined) return "undefined";

    switch (typeof value) {
      case "string":
        return this._string(value);
      case "number":
      case "bigint":
      case "boolean":
        return String(value);
      case "symbol":
        return value.toString();
      case "function":
        return `[Function: ${value.name || "anonymous"}]`;
    }

    return null;
  }

  /**
   * `value` quoted, and cut to `maxString` when it is longer.
   *
   * The dropped count is an annotation about the value, not part of it, so it
   * goes after the closing quote — the way `maxLength`'s `... +N` sits beside
   * the kept entries rather than inside the last one. Inside the quotes it
   * reads as content, and copying it out yields a string the program never
   * held.
   *
   * A cluster is at least one code unit, so a string no longer than the cap in
   * code units is within it in clusters, and needs no segmenting.
   */
  private _string(value: string): string {
    if (this.maxString === undefined || value.length <= this.maxString) return quoted(value);
    return this._cutString(value, this.maxString);
  }

  /**
   * A key as an object literal would spell it: bare when it is a name or an
   * index, which reads as itself, and quoted as a string otherwise. Rich reprs
   * every key; printed raw, `"a b"` was indistinguishable from two words and a
   * `\r` in one was dropped by `RichText`, so the key shown was not the key held.
   * Quoting only what needs it keeps the JavaScript reading `{ a: 1 }`. A
   * quoted key is a string and `maxString` cuts it; a bare one is a name.
   */
  private _key(key: string): string {
    return BARE_KEY.test(key) ? key : this._string(key);
  }

  /**
   * `value` cut to `max` grapheme clusters, with the rest counted after the
   * closing quote.
   *
   * The unit is the cluster of the value, counted before `quoted` escapes it. A code unit cut can keep half a surrogate pair, which
   * JSON.stringify prints as a `\ud83d` escape; a code point cut can keep half
   * a flag or a ZWJ family. Either way the kept prefix shows something the
   * value never held, and the dropped count is in a unit nobody can see.
   *
   * Counting clusters reads the whole string, and the traversals ask for the
   * same scalar once per probe at every level above it, so the answer is
   * memoised per value.
   */
  private _cutString(value: string, max: number): string {
    let cut = this.cutStrings.get(value);
    if (cut === undefined) {
      const clusters = graphemes(value);
      cut = clusters.length <= max
        ? quoted(value)
        : quoted(clusters.slice(0, max).join("")) + `+${clusters.length - max}`;
      this.cutStrings.set(value, cut);
    }
    return cut;
  }

  /**
   * A container, or the text standing in for one that is empty or past the
   * depth cap.
   *
   * `positions` is a thunk because both of those answers are reachable from
   * `size` alone, and reaching a position is not free: a `Map` or `Set` reaches
   * its own through an iterator, so enumerating one only to elide it drains a
   * container to print `Set {...}`. `size` also says how many positions were
   * dropped, which is where the elision marker comes from — one derivation, so
   * the count and the bound cannot disagree.
   */
  private _container(
    open: string,
    close: string,
    pad: string,
    size: number,
    level: number,
    positions: () => Slot[],
  ): Shape {
    if (size === 0) return { kind: "text", text: open + close };
    if (level >= this.maxDepth) return { kind: "text", text: open + "..." + close };

    const slots = positions();
    return { kind: "container", open, close, pad, slots: [...slots, ...elided(size - slots.length)] };
  }

  /**
   * The brackets and positions of an object, layout-free. See `Shape`.
   *
   * `bound` is the most positions the caller could ever use. Laying out passes
   * `Infinity`, because it prints every position it is handed. A probe passes
   * what is left of its line, which is already more positions than a fitting
   * one could hold — `SEPARATOR` charges two cells apiece, so a container with
   * more positions than `budget` overruns however narrow its contents are.
   * Reaching past it only ever feeds a join that returns `null`, and reaching a
   * position is what drains a `Map` or `Set`.
   */
  private _shape(value: object, level: number, bound: number): Shape {
    // Clamped because a probe's budget goes negative once a line is overrun,
    // and `slice` reads a negative end as counting from the far end — it would
    // keep all but the last few keys where the other arms take none.
    const cap = Math.max(0, Math.min(this.maxLength ?? Infinity, bound));

    const form = formOf(value);
    switch (form.kind) {
      case "indexed": {
        const { elements } = form;
        return this._container("[", "]", "", elements.length, level, () => {
          // Positions rather than values: each index is read in its own slot, so
          // one throwing accessor costs its own slot, not the whole sequence.
          const shown = Math.min(elements.length, cap);
          return Array.from({ length: shown }, (_, i): Slot => ({
            head: "",
            join: "",
            holes: [{ read: () => elements[i], tail: flat("") }],
          }));
        });
      }
      case "map":
        return this._container("Map {", "}", " ", form.map.size, level, () =>
          take(form.map.entries(), cap).map(([k, v]): Slot => ({
            head: "",
            join: "",
            holes: [{ read: () => k, tail: ARROW }, { read: () => v, tail: flat("") }],
          })),
        );
      case "set":
        return this._container("Set {", "}", " ", form.set.size, level, () =>
          take(form.set, cap).map((v): Slot => ({
            head: "",
            join: "",
            holes: [{ read: () => v, tail: flat("") }],
          })),
        );
      case "opaque":
        return { kind: "text", text: form.text };
      case "self":
        return { kind: "text", text: String(value) };
      case "keys": {
        // No self-description, so the keys are the whole story.
        const { record } = form;
        const keys = Object.keys(record);
        return this._container("{", "}", " ", keys.length, level, () =>
          keys.slice(0, cap).map((k): Slot => ({
            head: this._key(k),
            join: ": ",
            holes: [{ read: () => record[k], tail: flat("") }],
          })),
        );
      }
    }
  }

  /** The laid-out form of a value, expanded across lines wherever one line will not do. */
  private _format(value: unknown, at: Frame): Laid {
    const scalar = this._scalar(value);
    if (scalar !== null) return this._place(scalar, at);

    const object = value as object;
    if (at.open.has(object)) return this._place("[Circular]", at);
    at.open.add(object);
    try {
      return this._formatObject(object, at);
    } catch (error) {
      // The container's *shape* would not be read — `Object.keys`, an iterator,
      // `toString`. Nothing can be enumerated, so the whole container degrades;
      // a value that merely would not be read degrades alone, in its own slot.
      return this._place(threw(error), at);
    } finally {
      at.open.delete(object);
    }
  }

  /** The arms for a non-null object, with `value` already on the open path. */
  private _formatObject(value: object, from: Frame): Laid {
    const shape = this._shape(value, from.level, Infinity);
    if (shape.kind === "text") return this._place(shape.text, from);

    // Chosen before the compact try, because the choice cannot change its
    // answer where it stands: a line the opener will not fit on cannot hold the
    // one-line form it starts. One pass at the chosen line, and not a second
    // call per move — this method runs once per level of the data, and a
    // thousand levels is within what it is asked to lay out.
    const { lead, at } = this._opening(from, shape.open);

    if (!this.expandAll) {
      // rich-pretty-xms: budget from `at.column` and `at.reserve`, not from
      // `at.inset` alone. `at.column` is where *this* value's text actually
      // starts on its line, which already includes whatever `_expandSlot`
      // prepended for us (a key and its separator, a Map entry's `" => "`,
      // ...); `at.reserve` is what a fixed piece of literal text — the rest
      // of this hole's own tail, or the trailing `,` a non-last slot gets
      // joined with — is known to cost right after, before this value's own
      // text even starts. Deriving the budget from the indent alone assumed
      // nothing precedes *or follows* the value on its line, which is only
      // true at the root and for the last hole of an array's last element.
      const compact = this._joinOneLine(shape, {
        level: at.level + 1,
        budget: at.maxWidth - at.column - at.reserve,
        open: at.open,
      });
      if (compact !== null) return placed(cat(lead, compact), at.inset);
    }

    const innerIndent = at.inset + this.indent;
    // Every non-last slot gets `EXPAND_SEPARATOR` appended right after it
    // below, on the same line as whatever its own last character was — the
    // last slot doesn't. Two frames, not one per slot: `reserve` is the only
    // field that varies, and it only ever takes these two values.
    const base = this._onLine({ ...at, level: at.level + 1, column: innerIndent, margin: innerIndent }, innerIndent);
    const midFrame: Frame = { ...base, reserve: cellLen(EXPAND_SEPARATOR) };
    const lastFrame: Frame = { ...base, reserve: 0 };
    const lastSlot = shape.slots.length - 1;
    const parts = shape.slots.map((slot, i) => this._expandSlot(slot, i === lastSlot ? lastFrame : midFrame));
    return expansion(lead, shape, parts, innerIndent, at.inset);
  }

  /**
   * Where a container starts: where it stands, or — when its opener will not
   * fit after what precedes it on its line and will fit on a hanging line —
   * that hanging line, with `lead` the break that reaches it.
   *
   * This is `_place`'s rule for one-piece text, with `open` as the first word:
   * a bracket is a literal no cut can shorten, so moving is the only way it
   * fits. A container moved there is on a line of that indent, its children
   * and closer included, so it reads as its key's value rather than its key's
   * sibling. It moves only to fit: past the edge, the hanging line has no more
   * room than this one.
   */
  private _opening(at: Frame, open: string): { lead: Lines; at: Frame } {
    const width = cellLen(open);
    if (at.hang === null || at.column + width <= at.maxWidth || at.hang + width > at.maxWidth) {
      return { lead: flat(""), at };
    }
    return {
      lead: newline(at.hang),
      at: { ...this._onLine(at, at.hang), column: at.hang },
    };
  }

  /**
   * `at` on a line that starts at `inset`. The one place a hang is derived: a
   * line's continuation rows and its children both sit one indent past it.
   */
  private _onLine(at: Frame, inset: number): Frame {
    return { ...at, inset, hang: inset + this.indent };
  }

  /**
   * One position, with every value in it laid out.
   *
   * `at.column` is where `slot.head` begins. Rather than hand-tracking a
   * second, parallel "column so far" alongside `out` — two values a future
   * edit could update out of step, silently reintroducing a stale-budget bug
   * of the same shape this file just fixed — each hole derives its own
   * column fresh from `out` via `lineColumn`, the one place "text just
   * emitted" becomes "column now". [LAW:one-source-of-truth] `out` is
   * already the complete record; `column` is a read of it, not a second copy
   * of the same fact. `_joinOneLine`'s probe sibling tracks the analogous
   * thing via `budget` shrinking instead, because a probe already discards
   * anything that overruns and so never needs to know where a multi-line
   * insert's last line ends. Where that line *starts* is the one fact `out`
   * cannot give back, so it comes from each piece's `Laid.inset` instead.
   *
   * Each hole's `reserve` is its own `tail` plus, only for the slot's last
   * hole, whatever `at.reserve` already asked this whole slot to leave room
   * for (`_formatObject`'s trailing `,`). An earlier hole's tail is never
   * folded into a later hole's reserve — it is spent, not carried, the moment
   * `out` grows past it.
   */
  private _expandSlot(slot: Slot, at: Frame): Lines {
    // A key is one piece of text, placed like any other: one wider than its
    // line wraps under its slot rather than running on to column 0. Only a slot
    // with no values has its `at.reserve` land right after the head; a value
    // may move below it.
    const head = this._place(slot.head, { ...at, reserve: cellLen(slot.join) + (slot.holes.length === 0 ? at.reserve : 0) });
    let out = cat(head, flat(slot.join));
    let inset = head.inset;
    const lastHole = slot.holes.length - 1;
    for (let i = 0; i < slot.holes.length; i++) {
      const hole = slot.holes[i]!;
      // This is the read that costs the least when it fails: neighbours are
      // unaffected, so `{ a: 1, b: [Threw: …], c: 3 }` still shows everything
      // that could be read.
      const reserve = cellLen(hole.tail.text) + (i === lastHole ? at.reserve : 0);
      const here: Frame = { ...this._onLine(at, inset), column: lineColumn(at.column, out.text), reserve };
      let laid: Laid;
      try {
        laid = this._format(hole.read(), here);
      } catch (error) {
        laid = this._place(threw(error), here);
      }
      out = follow(out, laid, hole.tail);
      inset = laid.inset;
    }
    return out;
  }

  /**
   * Text that is one piece — a scalar, a value that spells itself, a marker —
   * set down at `at.column` on a line this formatter owns.
   *
   * A container that will not fit expands; one piece of text has no structure
   * to expand into, so it wraps, and the wrap is laid out here rather than left
   * to `RichText`. Left there, it broke at the console's edge and resumed at
   * column 0 — under the enclosing key, or under nothing — which is the
   * structure a reader of nested data relies on, broken. So every line after the
   * first hangs at `at.hang`, a line of the value's own (`Error`'s message, a
   * multi-line `toString`) as much as a wrapped one, and each is cut to the
   * width left there. Every row of the last line also leaves `at.reserve`, as a
   * container's compact try does, for the `,` or `" => "` that follows it.
   *
   * The first line is where the text already stands. When not even its first
   * word fits there, it starts on a hanging line instead — the only case that
   * moves it, and one taken only when that line starts further left and so has
   * more room; otherwise the word is folded where it stands. A Map value after
   * a long key is the case: `[1, 2, 3, 10] =>` ends the line and `"v"` hangs
   * beneath it, where it used to wrap to column 0.
   */
  private _place(text: string, at: Frame): Laid {
    // At the root nothing precedes the text that this formatter wrote, so none
    // of its lines has indent that is the structure's.
    if (at.hang === null) return placed({ text, margins: text.split("\n").slice(1).map(() => 0), arrows: [] }, at.inset);
    // A hanging row needs a cell to stand in. One indent past the slot has none
    // when the value sits one indent from the edge, and a row put there anyway
    // overruns the width and wraps to column 0 — so rows start where the value
    // began instead, and the first word folds where it stands.
    const hang = at.maxWidth - at.hang - at.reserve > 0 ? at.hang : Math.min(at.hang, at.column);

    const lines = text.split("\n");
    const last = lines.length - 1;
    const room = (i: number, column: number): number =>
      at.maxWidth - column - (i === last ? at.reserve : 0);

    const [first, ...rows] = lines.flatMap((line, i) => i === 0
      ? rowsOf(line, stayingLength(line, room(0, at.column), at.column > hang), room(0, hang))
      : rowsOf(line, stayingLength(line, room(i, hang), false), room(i, hang)));
    // A row hangs past its slot's margin, not at a margin of its own: the
    // cells between are the value's, and a guide there would sit inside it.
    const hung = rows.map((row) => cat(newline(at.margin), flat(row === "" ? "" : " ".repeat(hang - at.margin) + row)));
    return placed(cat(flat(first!), ...hung), rows.length === 0 ? at.inset : hang);
  }

  /** The one-line form of a value, or `null` when it will not fit `at.budget`. */
  private _oneLine(value: unknown, at: Probe): Lines | null {
    const scalar = this._scalar(value);
    if (scalar !== null) return fitOneLine(flat(scalar), at.budget);

    const object = value as object;
    if (at.open.has(object)) return fitOneLine(flat("[Circular]"), at.budget);
    at.open.add(object);
    try {
      const shape = this._shape(object, at.level, at.budget);
      if (shape.kind === "text") return fitOneLine(flat(shape.text), at.budget);
      return this._joinOneLine(shape, { level: at.level + 1, budget: at.budget, open: at.open });
    } catch (error) {
      return fitOneLine(flat(threw(error)), at.budget);
    } finally {
      at.open.delete(object);
    }
  }

  /**
   * A container's positions on one line, or `null` as soon as they overrun.
   *
   * The budget is spent as it goes and each position is asked for only what is
   * left, so a subtree that has already outgrown the line is abandoned where it
   * outgrew it rather than formatted in full and then measured.
   *
   * The brackets are charged before anything is read, and that ordering is what
   * bounds the traversal: a budget checked only against the finished text still
   * reads the whole subtree to produce text it then throws away. Charged first,
   * every level costs at least the two cells of its own brackets, so a probe
   * descends at most `budget / 2` levels however deep the data goes.
   */
  private _joinOneLine(shape: Container, at: Probe): Lines | null {
    let used = cellLen(shape.open) + cellLen(shape.close) + 2 * cellLen(shape.pad);
    if (used > at.budget) return null;

    const pieces: Lines[] = [];
    for (const slot of shape.slots) {
      if (pieces.length > 0) {
        used += cellLen(SEPARATOR);
        pieces.push(flat(SEPARATOR));
      }
      const piece = this._slotOneLine(slot, { ...at, budget: at.budget - used });
      if (piece === null) return null;
      used += cellLen(piece.text);
      pieces.push(piece);
    }
    return cat(flat(shape.open + shape.pad), ...pieces, flat(shape.pad + shape.close));
  }

  /** One position on one line, or `null` when any value in it will not fit. */
  private _slotOneLine(slot: Slot, at: Probe): Lines | null {
    let out = flat(slot.head + slot.join);
    for (const hole of slot.holes) {
      const left = at.budget - cellLen(out.text);
      let text: Lines | null;
      try {
        text = this._oneLine(hole.read(), { ...at, budget: left });
      } catch (error) {
        text = fitOneLine(flat(threw(error)), left);
      }
      if (text === null) return null;
      out = cat(out, text, hole.tail);
    }
    return fitOneLine(out, at.budget);
  }
}
