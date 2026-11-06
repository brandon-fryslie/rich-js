/**
 * TextInput widget — editable text field with cursor.
 *
 * Two modes:
 *   - single-line (default): Enter submits; newlines in value are rendered
 *                            as a literal `↵` glyph if they ever appear, and
 *                            any other glyph of zero cells as `◌`.
 *   - multi-line  (`multiline: true`): Enter inserts a `\n`; `value` may
 *                            contain logical line breaks; Up/Down navigate
 *                            between logical lines preserving column intent.
 *                            A glyph of zero cells is drawn as `◌` here too.
 *
 * [LAW:dataflow-not-control-flow] cursor and value are observable data; the
 * keymap dispatches to small `@action` mutators that all flow through the
 * same value/cursor update path. There is no per-key bespoke branch in the
 * render loop or the change-emit path.
 *
 * [LAW:one-source-of-truth] The cursor's logical line — and therefore "what
 * Home/End/Up/Down mean" — is derived from `value` and `cursorPosition` via
 * `_lineStart()` / `_lineEnd()`. Multi-line behavior is the same code path
 * as single-line; with no `\n` in `value`, line bounds collapse to value
 * bounds, so single-line semantics are recovered without a special case.
 *
 * [LAW:types-are-the-program] Three integer spaces coexist: `CellCol` (terminal
 * cell columns), `CodeUnit` (JS UTF-16 indices), and `CodePoint` (code-unit
 * offsets that are additionally on a Unicode code-point boundary — a subtype of
 * `CodeUnit`). `cursorPosition` is `CodePoint`, and stronger: its setter
 * parses any offset to a grapheme-cluster boundary. Visual positions are `CellCol`. The three are never
 * interchangeable — the type system enforces this at every crossing point.
 *
 * [LAW:one-source-of-truth] The cursor moves, deletes and draws one grapheme
 * cluster at a time (`nextGrapheme` / `prevGrapheme`) — the unit `cellLen`
 * measures — so `👍🏽` is one step and one cursor cell, never a glyph and a
 * stray skin-tone swatch.
 *
 * Keymap (readline / emacs compatible):
 *
 *   ─── motion ───
 *   left | Ctrl+B               char left
 *   right | Ctrl+F              char right
 *   up | Ctrl+P                 line up   (preserves preferred column)
 *   down | Ctrl+N               line down (preserves preferred column)
 *   home | Ctrl+A               line start
 *   end | Ctrl+E                line end
 *   Ctrl+Home                   document start
 *   Ctrl+End                    document end
 *   Ctrl+Left | Alt+Left | Alt+B   word left
 *   Ctrl+Right | Alt+Right | Alt+F word right
 *
 *   ─── editing ───
 *   backspace | Ctrl+H          delete char back
 *   delete | Ctrl+D             delete char forward
 *   Ctrl+W | Alt+Backspace      delete word back  (whitespace-bounded; readline parity)
 *   Alt+D                       delete word forward
 *   Ctrl+U                      kill to line start (stores in kill buffer)
 *   Ctrl+K                      kill to line end   (stores in kill buffer)
 *   Ctrl+Y                      yank kill buffer at cursor
 *   Ctrl+T                      transpose chars (swap pre-cursor/at-cursor, advance)
 *   enter                       submit (single-line) or insert `\n` (multiline)
 *
 * Motion and editing primitives are also exposed as public methods
 * (`moveCharLeft`, `killLineForward`, etc.) so a host can bind custom keys
 * or invoke them programmatically.
 */

import { action, runInAction } from "mobx";
import { observableRef } from "./observable.js";
import { Segment } from "../core/segment.js";
import { Style, caretMark, type CaretShape } from "../core/style.js";
import type { PointerShape } from "../core/terminal-requests.js";
import {
  cellLen,
  setCellSize,
  splitText,
  cellFitEnd,
  cellRows,
  clustersBefore,
  clustersFrom,
  asCellCol,
  cellCount,
  asCodePoint,
  asCodeUnit,
  graphemeBoundary,
  graphemes,
  nextGrapheme,
  prevGrapheme,
  type CellCol,
  type CodePoint,
  type CodeUnit,
} from "../core/cells.js";
import { afterPass, drawable, render, type RenderOptions } from "../core/protocol.js";
import { paragraphLevelOf, reorder } from "../core/orient.js";
import { shownWritten } from "../core/seal.js";
import { isBidi } from "../core/bidi.js";
import type { ParagraphLevel, TextOrder } from "../core/text-order.js";
import { State } from "../core/state.js";
import { Viewport, type Lines } from "../renderables/viewport.js";
import { Animation } from "../core/animation.js";
import { stepSequence } from "../core/easing.js";
import { Timeline } from "../core/timeline.js";
import { placed } from "../core/animation.js";
import { levelOf, type Anchor } from "../core/anchor.js";
import type { TerminalTheme } from "../core/color.js";
import { ThemedWidget } from "./themed-widget.js";
import { ink } from "./ink.js";
import type { WidgetKeyEvent, WidgetFocusEvent, WidgetMouseEvent } from "./types.js";
import { pattern } from "../core/pattern.js";
import { Memo } from "../core/memo.js";

/**
 * A soft-wrap strategy. Given one logical line of text and cell-width budgets,
 * return the visual sub-rows that line wraps into. The line arrives as the
 * widget shows it — each glyph of zero cells already its one-cell `◌`, each
 * glyph of a password its mask — so the budget counts the cells drawn. The
 * first sub-row uses `firstWidth` as its capacity; every subsequent
 * (continuation) sub-row uses `continuationWidth` (typically
 * `firstWidth - cellLen(continuationMarker)`).
 *
 * Each returned row is the stretch `[start, end)` of the line as given that
 * the row draws; the widget draws the matching stretch of `value` and
 * prepends the continuation marker itself.
 *
 * [LAW:types-are-the-program] A row names where it falls in the line rather
 * than carrying text of its own, so it cannot draw anything the line does not
 * hold. Budget params are `CellCol`; offsets are `CodePoint` (a `CodeUnit` on
 * a code-point boundary) — the type system prevents mixing these integer
 * spaces inside a custom strategy.
 *
 * Built-in: `charGreedyWrap` (break at any character at the width limit).
 * Custom: any function matching this signature. Template-aware wrapping
 * (break at `{{ }}` atoms, e.g.) is provided by consumers that know the
 * value's domain syntax — the widget stays domain-neutral.
 */
export type WrapStrategy = (
  logicalLine: string,
  budget: { firstWidth: CellCol; continuationWidth: CellCol },
) => readonly WrapRow[];

export interface WrapRow {
  /** Offset into the line as given where the row begins. */
  readonly start: CodePoint;
  /** Offset into the line as given where the row ends, exclusive. */
  readonly end: CodePoint;
}

/**
 * Internal: a visual row in the widget's render, with offsets absolute to
 * `value` (not the logical line a wrap strategy sees). Derived at the width
 * last drawn and consumed by `moveLineUp` / `moveLineDown` so vertical motion
 * follows what's actually on screen — not what the logical-line model would
 * do in the absence of wrap.
 */
interface VisualRow {
  /** The stretch of `value` the row shows, as `value` holds it. */
  readonly content: string;
  /** Code-point offset into `value` where this row's content begins. */
  readonly valueStart: CodePoint;
  readonly isContinuation: boolean;
}

/**
 * One row as the screen shows it: where it starts in `value`, what it holds,
 * its line's direction, whether the offset past its end is one of its stops,
 * and where a step out of its end and out of its start lands.
 */
interface ScreenRow {
  readonly start: CodePoint;
  readonly text: string;
  readonly level: ParagraphLevel;
  readonly endSlot: boolean;
  readonly next: CodePoint;
  readonly prev: CodePoint;
}

/**
 * The stop of `row` the cursor at `cursor` stands on, as an offset into its
 * text. [LAW:one-source-of-truth] Every offset `cursorRowIn` puts on a row is
 * one of its stops: an offset past its text — in what a wrap dropped after it —
 * stands on its end, so the caret is drawn and a step is taken from there.
 */
function stopIn(row: ScreenRow, cursor: CodePoint): number {
  return Math.min(cursor - row.start, row.text.length);
}

/** A cursor stop as a row shows it: its offset into the row's text, and the cells drawn for it. */
interface Seen {
  readonly at: number;
  readonly cells: number;
}

/**
 * The caret a row is drawn with: the cursor it stands for, and its cell drawn
 * over a glyph — its side set where the row is ordered (`orient`).
 */
interface Caret {
  readonly at: CodePoint;
  readonly draw: (glyph: string) => Iterable<Segment>;
}

/**
 * A cell of a drawn row in the order the frame holds it: the stop it shows,
 * what it writes, and whether it is the probe — the blank an end drawn with no
 * cell is ordered as, so that end stands where the caret's blank would, and
 * which the frame never writes.
 */
interface Cell {
  readonly at: number;
  readonly text: string;
  readonly style: Style | undefined;
  readonly cells: number;
  readonly probe: boolean;
}

/** The last frame painted: what it showed of the field, and where it laid it out. */
interface Painted {
  readonly value: string;
  readonly cursor: number;
  readonly caretShown: boolean;
  readonly layout: Layout;
}

/** What a frame drew a field under: the width offered, whether only ASCII could be drawn, and the order its rows are shown in. */
interface Drawn {
  readonly maxWidth: number;
  readonly asciiOnly: boolean;
  readonly textOrder: TextOrder;
}

/** The row of `rows` the cursor at `cursor` sits on: the last that starts at or before it. */
function cursorRowIn(rows: readonly VisualRow[], cursor: CodePoint): number {
  let row = rows.length - 1;
  while (row > 0 && rows[row]!.valueStart > cursor) row--;
  return Math.max(0, row);
}

/**
 * [LAW:one-source-of-truth] Whether the offset past row `index`'s end is one of
 * its stops: the cursor there sits on this row (`cursorRowIn`) where its line
 * ends, or where the wrap dropped what lay between it and the next row.
 */
function endIsStop(rows: readonly VisualRow[], index: number): boolean {
  const row = rows[index]!;
  const next = rows[index + 1];
  return next === undefined || !next.isContinuation || next.valueStart > row.valueStart + row.content.length;
}

/**
 * The content row `shown`'s first row draws: what a viewport showing content
 * stamped by `owner` scrolled it to. [LAW:no-silent-failure] Every content row
 * is padded and stamped, so a first row without the stamp is a broken frame,
 * not an offset of 0.
 */
function shownRow(shown: readonly (readonly Segment[])[], owner: object): number {
  if (shown.length === 0) return 0;
  const anchor = levelOf(Segment.anchorAt(shown, 0, 0), owner);
  if (anchor === undefined) throw new Error("TextInput: the viewport's first row carries no row of the field's content");
  return anchor.row;
}

/**
 * Where one frame laid a field's value out: on one line, the stops its window
 * showed; on rows, the visual rows, the first of them it shows, and the stops
 * of each row it drew. Stops are held both ways `Stops` names.
 */
type Layout = { readonly drawn: Drawn } & (
  | { readonly kind: "line"; readonly start: CodePoint; readonly screen: Stops }
  | { readonly kind: "rows"; readonly rows: readonly VisualRow[]; readonly offset: number; readonly screens: ReadonlyMap<number, Stops> }
);

/**
 * A row's content as the frame holds it (`cells`, as `_orderedRow` stamped and
 * ordered them), whether the terminal orders the line it is written in
 * (`logical`), and the field's own cells around it (`own`): the line, when no
 * frame shows the row. Its stops are read off it two ways, `framed` and
 * `shownIn`.
 */
type Stops = { readonly cells: readonly Cell[]; readonly ordersLine: boolean; readonly own: Outside };

/** A frame's rows of segments, as the router hands one with an event. */
type Frame = readonly (readonly Segment[])[];

/** What is written on a row's line before its content and after it. */
type Outside = { readonly before: readonly Segment[]; readonly after: readonly Segment[] };

/** The stops of `cells` taken in `order`, a glyph's cells merged into its one stop. */
function seenIn(cells: readonly Cell[], order: readonly number[]): Seen[] {
  const screen: Seen[] = [];
  for (const index of order) {
    const { at, cells: width } = cells[index]!;
    const last = screen.at(-1);
    if (last?.at === at) screen[screen.length - 1] = { at, cells: last.cells + width };
    else screen.push({ at, cells: width });
  }
  return screen;
}

/**
 * A row's stops left to right as the frame holds them, which a press reads. A
 * terminal that orders what it is written (`logical`) reports a pointer at the
 * column of what it was written, not where it shows it — the BiDi
 * recommendation's "the reported column is the model's column", VTE's
 * `vis2log` — so a press is already in the frame's order.
 */
function framed(stops: Stops): Seen[] {
  return seenIn(stops.cells, stops.cells.map((_, index) => index));
}

/**
 * A row's stops left to right as the terminal shows them with `outside` around
 * them on their line, which a step walks. One that orders what it is written
 * orders the whole line (`shownWritten`), so where it shows the row depends on
 * what is around it: with nothing but whitespace after it, L1 sets the caret's
 * blank at the end at the line's level, and a neighbour's text after it keeps
 * the blank in the row's run. Elsewhere it shows the frame's order.
 */
function shownIn(stops: Stops, { before, after }: Outside): Seen[] {
  if (!stops.ordersLine) return framed(stops);
  const { cells } = stops;
  const line = [...before, ...cells.map((cell) => new Segment(cell.text, cell.style)), ...after];
  const order = shownWritten(line).map((index) => index - before.length).filter((index) => index >= 0 && index < cells.length);
  return seenIn(cells, order);
}

/**
 * [LAW:one-source-of-truth] The offset into its row of the glyph a cell
 * shows, stamped on the cell before the row is ordered, so the order a row is
 * drawn in is read off the drawn row, never derived a second time.
 */
class Slot {
  constructor(readonly at: number) {}
}

/**
 * The slot stamped on `segment` and its style without it. Ordering adds to a
 * style and never anchors it, so the slot is the outermost anchor; one that is
 * not is a broken row, not a cell of no stop.
 */
function unslotted(segment: Segment): { readonly at: number; readonly style: Style } {
  const anchor = segment.style?.anchor;
  if (!(anchor?.owner instanceof Slot)) throw new Error("TextInput: a drawn row holds a cell no slot was stamped on");
  return { at: anchor.owner.at, style: segment.style!.withAnchor(anchor.inner) };
}

/**
 * [LAW:one-source-of-truth] A frame's layout, as the owner of every cell the
 * field drew in it: a click and the scroll indicator read the layout of the
 * frame they land on off its cells, never one a later frame kept.
 */
class Laid {
  constructor(readonly layout: Layout) {}
}

/**
 * The stop under column `col` of a row, which a press reads in the frame's
 * order (`Stops.framed`): the column a terminal reports. Past its cells — the
 * padding, which every order shows at the row's right — it is the end the
 * frame drew no cell for, where there is one, and otherwise the stop the
 * terminal shows rightmost, beside the pointer, so every stop a step reaches a
 * press reaches too.
 */
function offsetAtCell(stops: Stops, col: CellCol, outside: Outside): CodePoint {
  let cells = 0;
  for (const seen of framed(stops)) {
    cells += seen.cells;
    if (cells > col) return asCodePoint(seen.at);
  }
  const shown = shownIn(stops, outside);
  return asCodePoint((shown.find((seen) => seen.cells === 0) ?? shown.at(-1))?.at ?? 0);
}

/**
 * What `frame` writes around the content of row `row` of the field `layout`
 * was drawn in, the content starting `contentCol` cells into the field's row
 * and `cells` wide; `undefined` when the frame does not show that row.
 */
function outsideIn(frame: readonly (readonly Segment[])[], layout: Layout, row: number, contentCol: number, cells: number): Outside | undefined {
  for (const line of frame) {
    let start = 0;
    for (const segment of line) {
      for (let a = segment.style?.anchor; a !== undefined; a = a.inner) {
        if (!(a.owner instanceof Laid) || a.owner.layout !== layout || a.row !== row) continue;
        const from = start - a.col + contentCol;
        const [before, , after] = Segment.divide(line, [from, from + cells]);
        return { before: before!, after: after ?? [] };
      }
      start += segment.cellLength;
    }
  }
  return undefined;
}

/** The cells a row's content takes on the frame. */
function widthOf(stops: Stops): number {
  return stops.cells.reduce((sum, cell) => sum + cell.cells, 0);
}

/**
 * What `frame` writes around the row it shows the cursor of `field` in, cut
 * at that row's cells in the layout `frame` drew — not the row as drawn
 * since, so a cursor moved after the paint still cuts the line the terminal
 * shows; `undefined` where `frame` does not show that row.
 */
function outsideOf(frame: Frame, field: object, cursor: CodePoint, markerWidth: number): Outside | undefined {
  const layout = layoutIn(frame, field);
  if (layout === undefined) return undefined;
  if (layout.kind === "line") return outsideIn(frame, layout, 0, cellLen(OPEN), widthOf(layout.screen));
  const at = cursorRowIn(layout.rows, cursor);
  const stops = layout.screens.get(at);
  if (stops === undefined) return undefined;
  return outsideIn(frame, layout, at - layout.offset, layout.rows[at]!.isContinuation ? markerWidth : 0, widthOf(stops));
}

/** The layout stamped on the cell `anchor` names, at whatever depth. */
function layoutOn(anchor: Anchor | undefined): Layout | undefined {
  let a = anchor;
  while (a !== undefined && !(a.owner instanceof Laid)) a = a.inner;
  return a === undefined ? undefined : (a.owner as Laid).layout;
}

/** The layout `field` drew in the frame `lines` hold: off the first of its cells. */
function layoutIn(lines: readonly (readonly Segment[])[], field: object): Layout | undefined {
  for (const line of lines) {
    for (const segment of line) {
      const layout = layoutOn(levelOf(segment.style?.anchor, field));
      if (layout !== undefined) return layout;
    }
  }
  return undefined;
}

/**
 * Character-greedy soft wrap. Breaks at any character once `firstWidth`
 * (or `continuationWidth` for continuation rows) cells are exhausted. The
 * textarea default when a consumer says "wrap, I don't care how" — no syntax
 * awareness, just fits the line to the width.
 *
 * Wide characters (CJK, emoji) are treated as atomic: a char that would
 * straddle the budget is moved to the next row rather than split, and one too
 * wide for the whole budget is force-taken — see `cellRows`.
 */
export const charGreedyWrap: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
  if (line.length === 0) return [{ start: asCodePoint(0), end: asCodePoint(0) }];
  const capOf = (row: number): CellCol => (row === 0 ? firstWidth : continuationWidth);
  const rows: WrapRow[] = [];
  for (const row of cellRows(line, capOf)) {
    if (capOf(rows.length) <= 0) break;
    rows.push(row);
  }
  return rows;
};

export interface TextInputOptions {
  value?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
  maxLength?: number;
  password?: boolean;
  /**
   * When true, Enter inserts a `\n` into `value` instead of emitting submit,
   * and Up/Down arrows + Ctrl+P/N navigate between visual rows.
   * Single-line mode (the default) leaves Enter as submit and Up/Down as
   * no-ops, which matches the conventional one-line-input widget shape.
   */
  multiline?: boolean;
  /**
   * Soft-wrap strategy. When set (multiline mode only), each logical line
   * is wrapped to fit available width using this strategy; the widget
   * renders one visual row per wrap row and Up/Down move across *visual*
   * rows, not logical ones. When unset, multiline rendering emits each
   * logical line as one (potentially overflowing) visual row.
   *
   * Pass `charGreedyWrap` for the conventional textarea wrap, or supply
   * a custom strategy that understands the value's domain syntax (e.g. a
   * tokenizer that breaks at expression boundaries instead of mid-token).
   */
  wrap?: WrapStrategy;
  /**
   * Continuation marker rendered at the start of each non-first visual row
   * when a logical line wraps. Defaults to `"↳ "` (2 cells wide). The
   * widget subtracts this marker's display width from the strategy's
   * `continuationWidth` budget so wrapped content fits the available area.
   */
  continuationMarker?: string;
  /**
   * Maximum visible visual rows. When set and the wrapped value exceeds
   * this many rows, the widget scrolls the visible window to keep the
   * cursor row in view. Unset → render every row (let the host bound the
   * pane).
   */
  maxRows?: number;
  /**
   * Minimum visible visual rows. When set and the wrapped value has fewer
   * rows than this, the widget pads with empty rows so the rendered area
   * occupies at least `minRows` lines (useful for stable layouts).
   */
  minRows?: number;
  /**
   * Scroll-state indicator style.
   *
   *   - `"arrows"` (default): the widget renders ▲/▼ inside its own content
   *     area on the first/last visible row when scroll is possible in that
   *     direction. Fully self-contained — host needs no wiring.
   *   - `"indices"`: the widget suppresses in-content arrows and instead
   *     answers `scrollIndicatorText(frame)` (e.g. `"[14/102]"`) for a frame
   *     it is drawn in, which a `Panel`'s `bottomRightAccessory` function
   *     hands it, to display in the border. Useful when the surrounding
   *     chrome should carry the indicator so widget content area stays
   *     untouched.
   *   - `"none"`: no indicator at all.
   */
  scrollIndicator?: "arrows" | "indices" | "none";
  /**
   * Style override for the in-content scroll arrows (▲/▼). Defaults to the
   * widget's `primary` palette color. Has no effect outside `"arrows"` mode.
   */
  indicatorStyle?: Style;
  /**
   * Style override for the cursor cell. Defaults to
   * `bgcolor: primary, color: on-primary` (the WCAG-correct combination
   * derived from the active theme).
   */
  cursorStyle?: Style;
  /**
   * The shape of the terminal's own cursor on the focused field, where the
   * painter shows it (`RenderOptions.caret`) — there it stands in for the
   * drawn cursor cell, which is drawn only where it cannot. Defaults to
   * `"bar"`, an insertion point between two cells.
   */
  caretShape?: CaretShape;
  /**
   * Style override for the rendered content text. Defaults to the
   * theme's `foreground` palette color.
   */
  contentStyle?: Style;
}

const MIN_CONTENT_WIDTH = 8;
// The brackets a one-line field is drawn between; what follows its row on its
// line is part of how a terminal that orders the line shows the row.
const OPEN = "[";
const CLOSE = "]";

// [LAW:one-source-of-truth] The cells single-line content takes: its text and,
// past the text's end, the cell the cursor stands on there — never fewer than
// the floor. The render sizes and scrolls the field by it; `measure` asks it
// with the cursor at the end, the widest a value draws.
function singleLineExtent(textCells: number, cursorCell: number): CellCol {
  return asCellCol(Math.max(MIN_CONTENT_WIDTH, textCells, cursorCell + 1));
}
// What one line shows in place of a glyph of `value`; each is one cell.
const NEWLINE_GLYPH = "↵";
const ASCII_NEWLINE_GLYPH = "~";
const MASK_GLYPH = "•";
const ASCII_MASK_GLYPH = "*";
// The dotted circle Unicode draws for a mark with no base to sit on; `?` is the
// ASCII replacement character.
const ZERO_CELL_GLYPH = "◌";
const ASCII_ZERO_CELL_GLYPH = "?";

// [LAW:one-source-of-truth] `glyph` as one line shows it beside `standIn`, the
// one-cell stand-in a zero-cell glyph is drawn as: on it where the segmenter
// would join it to the glyph before it — a mark the value holds alone — and
// closed by it where it would join the glyph after — a Prepend the value
// holds alone. Each glyph then stays one cluster of what is drawn whatever is
// drawn beside it, so the segmenter decides it and no list of classes does.
const ownClusters = new Memo<string>();
function ownCluster(glyph: string, standIn: string): string {
  return ownClusters.get(standIn + glyph, () => {
    const opened = graphemes(standIn + glyph).length === 1 ? standIn + glyph : glyph;
    return graphemes(opened + standIn).length === 1 ? opened + standIn : opened;
  });
}

// Text a key may insert: anything but the C0 controls, DEL and the C1
// controls, which a terminal reads as escape sequences (U+009B is CSI).
const PRINTABLE = pattern(/^[^\x00-\x1f\x7f-\x9f]+$/u);
// What no key types into a field, a line break aside: PRINTABLE's complement.
const UNTYPABLE = pattern(/[\x00-\x09\x0b-\x1f\x7f-\x9f]/u);

// What a word is made of, for Alt+B/F, Ctrl+Left/Right and Ctrl+W: readline's
// alphanumerics and underscore, in any script, so a word of Arabic or Hebrew is
// one too. A glyph is judged by its base, so a mark rides with its letter and a
// selector does not make an emoji a word.
const WORD_CHAR_RE = pattern(/^[\p{L}\p{N}_]/u);
const WHITESPACE_RE = pattern(/\s/);

/** CRLF and lone CR as LF, the line break `value` holds. */
function toLf(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && WORD_CHAR_RE.test(c);
}

function isWhitespace(c: string | undefined): boolean {
  return c !== undefined && WHITESPACE_RE.test(c);
}

const isNotWordChar = (c: string): boolean => !isWordChar(c);
const isNotWhitespace = (c: string): boolean => !isWhitespace(c);

/**
 * How many code units a word motion crosses: every leading cluster `skipped`
 * accepts, then every one after them `taken` accepts. `clusters` is one walk
 * from the cursor (`clustersFrom` or `clustersBefore`), so a motion across a
 * long word segments the value once, not once a cluster.
 */
function wordSpan(clusters: Iterable<string>, skipped: (c: string) => boolean, taken: (c: string) => boolean): number {
  let span = 0;
  let skipping = true;
  for (const cluster of clusters) {
    skipping &&= skipped(cluster);
    if (!skipping && !taken(cluster)) break;
    span += cluster.length;
  }
  return span;
}

/**
 * The caret's blink, from the moment it restarts: lit for the first half
 * second, so the caret is solid the moment the field is touched, then dark
 * for the next, on a step sequence. A loop, so with its motion taken out it holds lit.
 */
const CARET_BLINK: Animation<boolean> = Animation.map(stepSequence([0.5, 0.5]), (step) => step === 0);

/**
 * The caret's blink restarted at `from`, as one animation of the frame's
 * time: `CARET_BLINK` run forward from `from` at and after it, and backward
 * from it before, so a timeline played backwards also finds the caret lit
 * just after a key. Each answer is the run the time falls in, bounded at
 * `from` where the runs meet — early where it must guess, never late. A
 * function of `from` alone, so the frame hands it its time (`placed`).
 */
function caretBlink(from: number): Animation<boolean> {
  const forward = Timeline.run(Timeline.play(from, 1), CARET_BLINK);
  const backward = Timeline.run(Timeline.play(from, -1), CARET_BLINK);
  return Animation.of({
    at: (t: number) => (t >= from ? forward : backward).at(t),
    validUntil: (t: number) => (t >= from ? forward.validUntil(t) : Math.min(backward.validUntil(t), from)),
    validFrom: (t: number) => (t >= from ? Math.max(forward.validFrom(t), from) : backward.validFrom(t)),
    reduced: () => CARET_BLINK.reduced(),
  });
}

export class TextInput extends ThemedWidget {
  readonly id: string;
  readonly focusable = true;

  @observableRef private accessor _value: string;
  @observableRef private accessor _cursor: CodePoint;
  // The caret's blink, restarted (`caretBlink`) when the field last took
  // focus, a click, or a key it handled, at that event's `time` on the
  // frame's clock. Built at the event, so a frame only reads it.
  @observableRef private accessor _blink: Animation<boolean> = caretBlink(0);

  // [LAW:single-enforcer] Every write to either half of the pair passes
  // `graphemeBoundary`, so the cursor is a cluster boundary inside `value`
  // whoever set it last — a caller replacing `value`, a click, an insert that
  // grew the cluster before it. A line break is `\n`, as in an HTML
  // textarea's value: `\r\n` is one cluster, and a cursor could not rest at
  // its line's end.
  get value(): string { return this._value; }
  set value(v: string) {
    runInAction(() => {
      this._value = toLf(v);
      this._cursor = graphemeBoundary(this._value, this._cursor);
    });
  }
  get cursorPosition(): CodePoint { return this._cursor; }
  set cursorPosition(p: CodeUnit) { this._cursor = graphemeBoundary(this._value, p); }

  /** An I-beam over a field that can be edited. */
  override get pointerShape(): PointerShape {
    return this.disabled ? "default" : "text";
  }
  @observableRef accessor placeholder: string;

  private readonly _maxLength: number | undefined;
  private readonly _password: boolean;
  private readonly _multiline: boolean;
  private readonly _wrap: WrapStrategy | undefined;
  private readonly _continuationMarker: string;
  private readonly _markerWidth: CellCol;
  private readonly _maxRows: number | undefined;
  private readonly _minRows: number | undefined;
  private readonly _scrollIndicator: "arrows" | "indices" | "none";
  @observableRef accessor indicatorStyleOverride: Style | undefined;
  @observableRef accessor cursorStyleOverride: Style | undefined;
  @observableRef accessor caretShape: CaretShape;
  @observableRef accessor contentStyleOverride: Style | undefined;

  // [LAW:types-are-the-program] `_preferredColumn` is a cell column (not a
  // code-unit index) — vertical motion navigates the visual surface, not the
  // string's byte layout. Reset to null on every non-vertical motion or edit
  // so the next Up/Down captures a fresh intent. Without this, Down through a
  // short line then back Up would land at the short-line column instead of the
  // original.
  private readonly _preferredColumn = new State<CellCol | null>(null);

  // Single-slot kill buffer used by Ctrl+U / Ctrl+K → Ctrl+Y. Not a full
  // kill ring (no Alt+Y rotation) — sufficient for the common cut/paste
  // pattern that's the readline 90% case.
  private readonly _killBuffer = new State("");

  // [LAW:one-source-of-truth] What the last frame drew under — the one layout
  // fact only a render learns. The visual rows, the single-line window and
  // the cursor's row are functions of it and of `value`, derived where they
  // are read: a click and Up/Down see the rows of the value as it is now at
  // the width the user last saw. Kept once the frame is drawn (`afterPass`).
  // Before any frame the width bounds nothing, and nothing wraps.
  private readonly _drawn = new State<Drawn>({ maxWidth: Infinity, asciiOnly: false, textOrder: "plain" });
  // The last frame painted, which a step reads its row's stops off.
  private readonly _painted = new State<Painted | undefined>(undefined);

  // [LAW:single-enforcer] The multiline scroll: the viewport keeps the cursor
  // row in view, clamps when the value shrinks, and keeps its offset once the
  // frame is drawn, as it does for a `ListView`.
  private readonly _viewport: Viewport;

  readonly multiline: boolean;

  constructor(options: TextInputOptions = {}) {
    super(options.theme);
    this.id = options.id ?? `text-input-${Math.random().toString(36).slice(2, 8)}`;
    this._value = toLf(options.value ?? "");
    this.placeholder = options.placeholder ?? "";
    // [LAW:dataflow-not-control-flow] Initial cursor position is data, not
    // a render-time branch. Single-line inputs follow the pre-filled-form
    // convention (cursor at end — typing continues the value). Multiline
    // inputs follow the textarea convention (cursor at start — pre-loaded
    // content is read top-to-bottom, and the viewport's "scroll into view"
    // logic does nothing because row 0 is already inside the initial window).
    this._cursor = graphemeBoundary(this._value, asCodeUnit((options.multiline ?? false) ? 0 : this._value.length));
    this.disabled = options.disabled ?? false;
    this._maxLength = options.maxLength;
    this._password = options.password ?? false;
    this._multiline = options.multiline ?? false;
    // Soft wrap is multiline's: one line wraps to nothing.
    this._wrap = this._multiline ? options.wrap : undefined;
    this._continuationMarker = options.continuationMarker ?? "↳ ";
    this._markerWidth = asCellCol(cellLen(this._continuationMarker));
    this._maxRows = options.maxRows;
    this._minRows = options.minRows;
    this._scrollIndicator = options.scrollIndicator ?? "arrows";
    this.indicatorStyleOverride = options.indicatorStyle;
    this.cursorStyleOverride = options.cursorStyle;
    this.caretShape = options.caretShape ?? "bar";
    this.contentStyleOverride = options.contentStyle;
    this.multiline = this._multiline;
    this._viewport = new Viewport();
  }

  // --- Event handlers ---

  // A key the field handles is one it stops; only that restarts the blink,
  // so a key passing through to the app — Tab, Escape — moves nothing here.
  @action
  handleKey(event: WidgetKeyEvent): void {
    this._edit(event);
    if (event.stopped) this._edited(event.time);
  }

  // After an edit at `time`: the blink restarts, and the cursor's row is
  // brought into view, since an edit on it moves no followed range — typing
  // after the wheel scrolled away scrolls back. The rows are the edited
  // value's, at the width last drawn.
  private _edited(time: number): void {
    this._blink = caretBlink(time);
    if (this._multiline) {
      const row = cursorRowIn(this._rows(this._drawn.get()), this.cursorPosition);
      this._viewport.ensureVisible(row, row + 1);
    }
  }

  @action
  override handleFocus(event: WidgetFocusEvent): void {
    super.handleFocus(event);
    this._blink = caretBlink(event.time);
  }

  private _edit(event: WidgetKeyEvent): void {
    if (this.disabled) return;

    // ─── editing keys (modifier-conscious) ───
    if (event.key === "backspace") {
      if (event.meta || event.ctrl) this.deleteWordBack();
      else this.deleteCharBack();
      event.stop();
      return;
    }
    if (event.key === "delete") {
      this.deleteCharForward();
      event.stop();
      return;
    }
    if (event.key === "enter") {
      if (this._multiline && !event.ctrl) this._insertText("\n");
      else this.emitSubmit();
      event.stop();
      return;
    }
    // Escape is intentionally ignored — text-input does not stop it so
    // higher-level UI (dialogs, modals) can react to it.
    if (event.key === "escape") return;

    // ─── unmodified motion ───
    if (!event.ctrl && !event.meta) {
      switch (event.key) {
        case "left":  this.moveCharLeft(event.frame);  event.stop(); return;
        case "right": this.moveCharRight(event.frame); event.stop(); return;
        case "up":    this.moveLineUp();    event.stop(); return;
        case "down":  this.moveLineDown();  event.stop(); return;
        case "home":  this.moveLineStart(); event.stop(); return;
        case "end":   this.moveLineEnd();   event.stop(); return;
      }
    }

    // ─── Ctrl-modified motion + readline editing ───
    if (event.ctrl && !event.meta) {
      switch (event.key) {
        case "left":  this.moveWordLeft(event.frame);      event.stop(); return;
        case "right": this.moveWordRight(event.frame);     event.stop(); return;
        case "home":  this.moveDocStart();      event.stop(); return;
        case "end":   this.moveDocEnd();        event.stop(); return;
        case "a":     this.moveLineStart();     event.stop(); return;
        case "e":     this.moveLineEnd();       event.stop(); return;
        case "b":     this.moveCharBack();         event.stop(); return;
        case "f":     this.moveCharForward();      event.stop(); return;
        case "p":     this.moveLineUp();        event.stop(); return;
        case "n":     this.moveLineDown();      event.stop(); return;
        case "d":     this.deleteCharForward(); event.stop(); return;
        case "h":     this.deleteCharBack();    event.stop(); return;
        case "w":     this.deleteWordBack();    event.stop(); return;
        case "u":     this.killLineBack();      event.stop(); return;
        case "k":     this.killLineForward();   event.stop(); return;
        case "y":     this.yank();              event.stop(); return;
        case "t":     this.transposeChars();    event.stop(); return;
      }
    }

    // ─── Alt-modified (meta) motion + editing ───
    if (event.meta && !event.ctrl) {
      switch (event.key) {
        case "left":  this.moveWordLeft(event.frame);       event.stop(); return;
        case "right": this.moveWordRight(event.frame);      event.stop(); return;
        case "b":     this.moveWordBack();          event.stop(); return;
        case "f":     this.moveWordForward();       event.stop(); return;
        case "d":     this.deleteWordForward();  event.stop(); return;
      }
    }

    // ─── printable insertion ───
    // A non-control `event.character` with no command modifiers is text to
    // insert. Ctrl/meta-modified keys produce empty `character` from the
    // router (see event-router.ts) so they never reach this branch. The router
    // sends one code point per key, so `👍🏽` arrives as `👍` then `🏽`, and an
    // astral code point is two UTF-16 units — a `.length === 1` test drops it.
    if (PRINTABLE.test(event.character) && !event.ctrl && !event.meta) {
      this._insertText(event.character);
      event.stop();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type !== "mouse_down") return;
    this._blink = caretBlink(event.time);

    // [LAW:no-silent-failure] Every cell the field draws carries its frame's
    // layout, so a press without one did not come off a frame it drew.
    const layout = layoutOn(event.cell);
    if (layout === undefined) throw new Error("TextInput: a press carries no layout of the frame it landed on");
    if (layout.kind === "rows") {
      // Multiline has no brackets; rows may have a leading continuation marker.
      // event.y is a row of the window the clicked frame showed; event.x is
      // projected into the row's content.
      const rawRowIdx = layout.offset + event.y;
      // Clicks on minRows-padded empty rows (beyond the last real row) snap to end.
      if (rawRowIdx >= layout.rows.length) {
        this.cursorPosition = asCodeUnit(this.value.length);
        this._preferredColumn.set(null);
        return;
      }
      const row = layout.rows[rawRowIdx]!;
      // Continuation rows start after the marker; non-continuation rows start at column 0.
      const contentXOff = asCellCol(row.isContinuation ? this._markerWidth : 0);
      const relX = asCellCol(Math.max(0, event.x - contentXOff));
      const stops = layout.screens.get(rawRowIdx);
      if (stops === undefined) throw new Error(`TextInput: a press landed on row ${rawRowIdx}, which its frame did not draw`);
      const outside = outsideIn(event.frame, layout, event.y, contentXOff, widthOf(stops)) ?? stops.own;
      this.cursorPosition = asCodeUnit(row.valueStart + offsetAtCell(stops, relX, outside));
    } else {
      // [LAW:types-are-the-program] relX is a column of the window the
      // clicked frame holds, past the bracket; a press on a bracket is one on
      // the cell inside it, beside the pointer.
      const width = widthOf(layout.screen);
      const relX = asCellCol(Math.min(Math.max(0, event.x - 1), Math.max(0, width - 1)));
      const outside = outsideIn(event.frame, layout, 0, cellLen(OPEN), width) ?? layout.screen.own;
      this.cursorPosition = asCodeUnit(layout.start + offsetAtCell(layout.screen, relX, outside));
    }
    this._preferredColumn.set(null);
  }

  // --- Hover mutator (router fast-path) ---

  @action
  override setHovered(value: boolean): void { this.hovered = value; }

  // ─── Public motion primitives ───────────────────────────────────────────

  // Left and Right move across the screen, so on a line shown right to left Left
  // moves on through the text. Under `plain` the screen is the text's order.
  // `frame` is the frame on screen the step is taken in, which orders the line
  // the row is written in (a key's `frame`); without one, the field's own row.
  @action moveCharLeft(frame: Frame = []): void {
    this.cursorPosition = this._screenStep(-1, frame);
    this._preferredColumn.set(null);
  }

  @action moveCharRight(frame: Frame = []): void {
    this.cursorPosition = this._screenStep(1, frame);
    this._preferredColumn.set(null);
  }

  @action moveLineUp(): void {
    this._moveLine(-1);
  }

  @action moveLineDown(): void {
    this._moveLine(1);
  }

  // [LAW:dataflow-not-control-flow] One motion over the rows as last drawn —
  // wraps and marker offsets accounted for. Before any frame they are the
  // logical lines, so motion before mount is this same path, not a fallback.
  private _moveLine(step: -1 | 1): void {
    const rows = this._rows(this._drawn.get());
    const rowIdx = cursorRowIn(rows, this.cursorPosition);
    const targetIdx = rowIdx + step;
    const target = rows[targetIdx];
    if (target === undefined) return;
    const row = rows[rowIdx]!;
    const col = this._preferredColumn.get() ?? this._shownCells(row.content.slice(0, this.cursorPosition - row.valueStart));
    this.cursorPosition = asCodeUnit(target.valueStart + this._clampColForRow(rows, col, targetIdx));
    this._preferredColumn.set(col);
  }

  // Clamp `col` (a cell column) to the target visual row's content, returning
  // the code-unit offset within that row. Where the row's end is one of its
  // stops (`endIsStop`) the column may reach it. Elsewhere the end is the next
  // row's start, so we clamp to the last valid cluster boundary strictly inside
  // the row (which may be more than one cell before the visual end when the
  // last glyph is wide): landing at the boundary would cause `cursorRowIn` to
  // resolve to the *later* row, making every subsequent Up/Down stick there.
  private _clampColForRow(rows: readonly VisualRow[], col: CellCol, targetIdx: number): CodePoint {
    const target = rows[targetIdx]!;
    const contentCellWidth = this._shownCells(target.content);
    const capCells = endIsStop(rows, targetIdx)
      ? contentCellWidth
      : asCellCol(Math.max(0, contentCellWidth - 1));
    return this._offsetAtShownCell(target.content, asCellCol(Math.min(col, capCells)), this._drawn.get());
  }

  @action moveLineStart(): void {
    this.cursorPosition = this._lineStart();
    this._preferredColumn.set(null);
  }

  @action moveLineEnd(): void {
    this.cursorPosition = this._lineEnd();
    this._preferredColumn.set(null);
  }

  @action moveDocStart(): void {
    this.cursorPosition = asCodeUnit(0);
    this._preferredColumn.set(null);
  }

  @action moveDocEnd(): void {
    this.cursorPosition = asCodeUnit(this.value.length);
    this._preferredColumn.set(null);
  }

  @action moveWordLeft(frame: Frame = []): void {
    this._wordStep(-1, frame);
  }

  @action moveWordRight(frame: Frame = []): void {
    this._wordStep(1, frame);
  }

  // Readline's back and forward: through the text, whatever the screen shows.
  @action moveWordBack(): void {
    const at = this.cursorPosition;
    this.cursorPosition = asCodePoint(at - wordSpan(clustersBefore(this.value, at), isNotWordChar, isWordChar));
    this._preferredColumn.set(null);
  }

  @action moveWordForward(): void {
    const at = this.cursorPosition;
    this.cursorPosition = asCodePoint(at + wordSpan(clustersFrom(this.value, at), isNotWordChar, isWordChar));
    this._preferredColumn.set(null);
  }

  @action moveCharBack(): void {
    this.cursorPosition = prevGrapheme(this.value, this.cursorPosition);
    this._preferredColumn.set(null);
  }

  @action moveCharForward(): void {
    this.cursorPosition = nextGrapheme(this.value, this.cursorPosition);
    this._preferredColumn.set(null);
  }

  // ─── Public editing primitives ──────────────────────────────────────────

  @action deleteCharBack(): void {
    if (this.cursorPosition === 0) return;
    const newPos = prevGrapheme(this.value, this.cursorPosition);
    this.value = this.value.slice(0, newPos) + this.value.slice(this.cursorPosition);
    this.cursorPosition = newPos;
    this._preferredColumn.set(null);
    this.emitChange();
  }

  @action deleteCharForward(): void {
    if (this.cursorPosition >= this.value.length) return;
    const nextPos = nextGrapheme(this.value, this.cursorPosition);
    this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(nextPos);
    this._preferredColumn.set(null);
    this.emitChange();
  }

  @action deleteWordBack(): void {
    // Readline `unix-word-rubout` semantics: delete back to nearest whitespace,
    // skipping trailing whitespace first so successive Ctrl+W at "foo bar |"
    // → "foo |" → "|" rather than getting stuck on the trailing space.
    const p = asCodePoint(this.cursorPosition - wordSpan(clustersBefore(this.value, this.cursorPosition), isWhitespace, isNotWhitespace));
    if (p === this.cursorPosition) return;
    this._killBuffer.set(this.value.slice(p, this.cursorPosition));
    this.value = this.value.slice(0, p) + this.value.slice(this.cursorPosition);
    this.cursorPosition = p;
    this._preferredColumn.set(null);
    this.emitChange();
  }

  @action deleteWordForward(): void {
    const p = this.cursorPosition + wordSpan(clustersFrom(this.value, this.cursorPosition), isNotWordChar, isWordChar);
    if (p === this.cursorPosition) return;
    this._killBuffer.set(this.value.slice(this.cursorPosition, p));
    this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(p);
    this._preferredColumn.set(null);
    this.emitChange();
  }

  @action killLineBack(): void {
    const start = this._lineStart();
    if (start === this.cursorPosition) return;
    this._killBuffer.set(this.value.slice(start, this.cursorPosition));
    this.value = this.value.slice(0, start) + this.value.slice(this.cursorPosition);
    this.cursorPosition = start;
    this._preferredColumn.set(null);
    this.emitChange();
  }

  @action killLineForward(): void {
    const end = this._lineEnd();
    if (end > this.cursorPosition) {
      this._killBuffer.set(this.value.slice(this.cursorPosition, end));
      this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(end);
      this._preferredColumn.set(null);
      this.emitChange();
      return;
    }
    // Already at line end → kill the trailing `\n` (join next line).
    if (this.cursorPosition < this.value.length) {
      this._killBuffer.set("\n");
      this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(this.cursorPosition + 1);
      this._preferredColumn.set(null);
      this.emitChange();
    }
  }

  @action yank(): void {
    const killed = this._killBuffer.get();
    if (killed.length === 0) return;
    this._insertText(killed);
  }

  @action transposeChars(): void {
    // Readline `transpose-chars`: swap the char before the cursor with the
    // char at the cursor and advance. At end-of-value, swap the trailing
    // two chars without advancing. At position 0, no-op.
    if (this.cursorPosition === 0) return;
    const p = this.cursorPosition;
    if (p === this.value.length) {
      // End-of-value: swap the trailing two glyphs; cursor stays. One glyph
      // has nothing to swap with.
      const cp2 = prevGrapheme(this.value, p);
      if (cp2 === 0) return;
      const cp1 = prevGrapheme(this.value, cp2);
      this.value = this.value.slice(0, cp1) + this.value.slice(cp2) + this.value.slice(cp1, cp2);
      this._preferredColumn.set(null);
      this.emitChange();
      return;
    }
    // Normal case: the whole glyphs before and at the cursor.
    const cpBefore = prevGrapheme(this.value, p);
    const cpAfter = nextGrapheme(this.value, p);
    const charBefore = this.value.slice(cpBefore, p);
    const charAt = this.value.slice(p, cpAfter);
    this.value = this.value.slice(0, cpBefore) + charAt + charBefore + this.value.slice(cpAfter);
    this.cursorPosition = cpAfter;
    this._preferredColumn.set(null);
    this.emitChange();
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  private _lineStart(): CodePoint {
    let p: number = this.cursorPosition;
    while (p > 0 && this.value[p - 1] !== "\n") p--;
    return asCodePoint(p);
  }

  private _lineEnd(): CodePoint {
    let p: number = this.cursorPosition;
    while (p < this.value.length && this.value[p] !== "\n") p++;
    return asCodePoint(p);
  }

  /**
   * A paste goes in as text, never as the keys it holds: a line break in it
   * submits nothing. What it keeps is what typing could put in — no control,
   * a tab made a space — and its line breaks: on one line each is a space, but
   * a final one, which copying a line brings along, is dropped.
   */
  @action
  handlePaste(text: string, time: number): void {
    if (this.disabled) return;
    const lines = text.replaceAll("\t", " ").replace(new RegExp(UNTYPABLE.source, "gu"), "").split("\n");
    if (!this._multiline && lines.length > 1 && lines.at(-1) === "") lines.pop();
    const before = this.value;
    this._insertText(lines.join(this._multiline ? "\n" : " "));
    if (this.value !== before) this._edited(time);
  }

  @action
  private _insertText(text: string): void {
    let toInsert = text;
    if (this._maxLength !== undefined) {
      const room = this._maxLength - this.value.length;
      // Cut between glyphs: the longest run of whole clusters within `room`.
      let fit = 0;
      for (const g of graphemes(toInsert)) {
        if (fit + g.length > room) break;
        fit += g.length;
      }
      toInsert = toInsert.slice(0, fit);
    }
    if (toInsert.length === 0) return;
    // The end is taken before the write: the value setter has already moved
    // the cursor past a cluster the insert grew.
    const end = asCodeUnit(this.cursorPosition + toInsert.length);
    this.value =
      this.value.slice(0, this.cursorPosition) +
      toInsert +
      this.value.slice(this.cursorPosition);
    this.cursorPosition = end;
    this._preferredColumn.set(null);
    this.emitChange();
  }

  // --- Rendering ---

  // [LAW:one-source-of-truth] The style a value is drawn in is also what a
  // short row is padded with, so a caller's `contentStyle` fills the row.
  protected override get ground(): Style {
    return this.disabled
      ? new Style(this.disabledInk)
      : this.contentStyleOverride ?? super.ground;
  }

  protected draw(options: RenderOptions): Iterable<Segment> {
    const drawn: Drawn = { maxWidth: options.maxWidth, asciiOnly: options.asciiOnly ?? false, textOrder: options.textOrder ?? "plain" };
    // [LAW:effects-at-boundaries] Kept once the frame is drawn, never while it is.
    const { lines, layout } = this._multiline ? this._renderMultiline(options, drawn) : this._renderSingleLine(options, drawn);
    const painted: Painted = { value: this.value, cursor: this.cursorPosition, caretShown: this.focused && !this.disabled, layout };
    afterPass(() => {
      this._drawn.set(drawn);
      this._painted.set(painted);
    });
    return Segment.anchorLines(lines, new Laid(layout)).flatMap((line) => [...line, Segment.line()]);
  }

  // [LAW:dataflow-not-control-flow] How a stretch of `value` is shown in one
  // line derives glyph by glyph from mode: a mask cell in password mode, else
  // the glyph itself — or, for a glyph of zero cells, a stand-in of one cell.
  // Every glyph then has a column of its own, so each cursor stop draws the
  // cursor somewhere new. The render and the click hit-test both read it.
  // Every other glyph is `ownCluster`: every glyph stays one cluster of what is
  // drawn, and so one stop.
  private _shownAs(options: { readonly asciiOnly?: boolean }): (glyph: string) => string {
    const mask = drawable(options, MASK_GLYPH, ASCII_MASK_GLYPH);
    const newline = drawable(options, NEWLINE_GLYPH, ASCII_NEWLINE_GLYPH);
    const zeroCell = drawable(options, ZERO_CELL_GLYPH, ASCII_ZERO_CELL_GLYPH);
    return (g) =>
      this._password ? mask
        : cellLen(g) === 0 ? (g === "\n" ? newline : zeroCell)
        : ownCluster(g, zeroCell);
  }

  /**
   * `row` drawn as the frame draws it, in the order the frame holds it: each
   * glyph as `drawn` shows it, the caret on the stop the cursor at `caret.at`
   * stands on (`stopIn`), and — on a row whose end is a stop — the slot past
   * its end, `endCells` wide (what pads the row; the caret's blank, when it is
   * there, is drawn beside them). Ordered at the row's line's direction, its
   * runs of one style merged so a frame still writes a row as a few runs, and
   * returned with its stops (`Stops`) given the field's own cells around it
   * on its line.
   */
  private _drawnRow(
    row: ScreenRow,
    drawn: Drawn,
    contentStyle: Style,
    caret?: Caret,
    endCells = 0,
  ): { segments: Segment[]; screen: (own: Outside) => Stops } {
    const { ordered, screen } = this._orderedRow(row, drawn, contentStyle, caret, endCells);
    const segments: Segment[] = [];
    for (const { text, style, probe } of ordered) {
      if (probe) continue;
      const last = segments.at(-1);
      if (style !== undefined && last?.style?.equals(style)) segments[segments.length - 1] = new Segment(last.text + text, last.style);
      else segments.push(new Segment(text, style));
    }
    return { segments, screen };
  }

  /**
   * `row`'s cells in the order the frame holds them, unmerged, and its stops
   * (`Stops`). Under `plain` the order is the row's own, so
   * each glyph's stop is where it was drawn. Elsewhere each glyph is stamped
   * with its offset into the row (a `Slot`) before the row is ordered, and the
   * stops are read off the stamps after: [LAW:one-source-of-truth] the order
   * is never derived a second time.
   */
  private _orderedRow(
    row: ScreenRow,
    drawn: Drawn,
    contentStyle: Style,
    caret?: Caret,
    endCells = 0,
  ): { ordered: Cell[]; screen: (own: Outside) => Stops } {
    const shownAs = this._shownAs(drawn);
    const caretAt = caret === undefined ? undefined : stopIn(row, caret.at);
    const pieces: { readonly at: number; readonly segments: Segment[] }[] = [];
    let at = 0;
    for (const glyph of graphemes(row.text)) {
      const shown = shownAs(glyph);
      pieces.push({ at, segments: caretAt === at ? [...caret!.draw(shown)] : [new Segment(shown, contentStyle)] });
      at += glyph.length;
    }
    // The end is one blank holding no character (`Style.textEnd`): the caret's,
    // drawn, when it is there, and otherwise a probe the frame drops, so no row
    // shows a blank its value does not hold. [LAW:one-source-of-truth] The
    // order places that end, with a caret or without, never a rule beside it.
    let probe: Segment | undefined;
    if (row.endSlot) {
      const atEnd = contentStyle.asTextEnd;
      const end = caretAt === at
        ? [...caret!.draw(" ")].map((segment) => new Segment(segment.text, (segment.style ?? contentStyle).asTextEnd, segment.control))
        : [probe = new Segment(" ", atEnd)];
      const pad = endCells - Segment.getLineLength(probe === undefined ? end : []);
      if (pad > 0) end.push(new Segment(" ".repeat(pad), contentStyle));
      pieces.push({ at, segments: end });
    }
    const cell = (at: number, segment: Segment, style: Style | undefined, isProbe: boolean): Cell =>
      ({ at, text: segment.text, style, cells: isProbe ? 0 : segment.cellLength, probe: isProbe });
    if (drawn.textOrder === "plain") {
      const ordered = pieces.flatMap((piece) => piece.segments.map((segment) => cell(piece.at, segment, segment.style, segment === probe)));
      return { ordered, screen: (own) => ({ cells: ordered, ordersLine: false, own }) };
    }
    const stamped = pieces.flatMap((piece) => Segment.anchorLines([piece.segments], new Slot(piece.at))[0]!);
    const probed = probe === undefined ? undefined : stamped[pieces.flatMap((piece) => piece.segments).indexOf(probe)];
    const ordered = this._oriented(stamped, drawn.textOrder, row.level).map((segment) => {
      const { at, style } = unslotted(segment);
      return cell(at, segment, style, probed !== undefined && segment.style?.anchor === probed.style?.anchor);
    });
    return { ordered, screen: (own) => ({ cells: ordered, ordersLine: drawn.textOrder === "logical", own }) };
  }

  /**
   * The row the cursor is drawn in and its stops on the screen, as `frame`
   * shows them. [LAW:one-source-of-truth] They are the stops the last frame
   * recorded while that frame still shows this value with this cursor;
   * otherwise they are drawn by the frame's own path, the caret included,
   * since the caret's blank is a cell the order places.
   */
  private _cursorScreen(frame: Frame): { row: ScreenRow; screen: readonly Seen[] } {
    const drawn = this._drawn.get();
    const caretShown = this.focused && !this.disabled;
    const painted = this._painted.get();
    // What `frame` writes around the cursor's row — the line the terminal
    // orders the row in — and, where it does not show the field, the field's
    // own cells around it.
    const outside = (stops: Stops): Outside => outsideOf(frame, this, this.cursorPosition, this._markerWidth) ?? stops.own;
    if (painted !== undefined && painted.value === this.value && painted.cursor === this.cursorPosition && painted.caretShown === caretShown) {
      const { layout } = painted;
      const stops = layout.kind === "line" ? layout.screen : layout.screens.get(cursorRowIn(layout.rows, this.cursorPosition));
      if (stops !== undefined) return { row: this._screenRow(drawn), screen: shownIn(stops, outside(stops)) };
    }
    const caret: Caret | undefined = caretShown ? { at: this.cursorPosition, draw: (glyph) => [new Segment(glyph, this.ground)] } : undefined;
    if (!this._multiline) {
      const { window, endCells } = this._singleLineWindow(drawn);
      const stops = this._orderedRow(window, drawn, this.ground, caret, endCells).screen({ before: [new Segment(OPEN)], after: [new Segment(CLOSE)] });
      return { row: window, screen: shownIn(stops, outside(stops)) };
    }
    const row = this._screenRow(drawn);
    const stops = this._orderedRow(row, drawn, this.ground, caret).screen({ before: [], after: [] });
    return { row, screen: shownIn(stops, outside(stops)) };
  }

  // The stretch of the value a one-line frame's window showed, `width` cells from
  // `startCell`, at the whole value's direction, as the frame ordered it.
  private _windowOf(value: string, startCell: CellCol, width: CellCol, drawn: Drawn): ScreenRow {
    const start = this._offsetAtShownCell(value, startCell, drawn);
    const text = value.slice(start, this._offsetAtShownCell(value, asCellCol(startCell + width), drawn));
    return {
      start,
      text,
      level: this._levelOf(value, drawn),
      endSlot: true,
      next: nextGrapheme(value, asCodePoint(start + text.length)),
      prev: prevGrapheme(value, start),
    };
  }

  // The window a one-line frame under `drawn` shows the value in, and the cells
  // past its text it pads with: the render draws it and a step reads it.
  private _singleLineWindow(drawn: Drawn): { window: ScreenRow; contentWidth: CellCol; endCells: number } {
    const { startCell, contentWidth } = this._singleLine(drawn);
    const window = this._windowOf(this.value, startCell, contentWidth, drawn);
    return { window, contentWidth, endCells: Math.max(0, contentWidth - cellLen(this._shown(window.text, drawn))) };
  }

  // The row the caret is drawn in, under `drawn`: on one line the window a frame
  // shows the caret in (`_singleLine`), derived as the render derives it.
  private _screenRow(drawn: Drawn): ScreenRow {
    if (!this._multiline) return this._singleLineWindow(drawn).window;
    const rows = this._rows(drawn);
    return this._screenRowAt(rows, cursorRowIn(rows, this.cursorPosition), drawn);
  }

  // Row `index` of `rows`, at the direction of the line it is a row of: read off
  // that line alone, unless the render's `levelOf` already holds it. A step out
  // of its end lands on the next row's start, and out of its start on the
  // previous row's end where that end is a stop, its last glyph where it is not.
  private _screenRowAt(rows: readonly VisualRow[], index: number, drawn: Drawn, levelOf?: (index: number) => ParagraphLevel): ScreenRow {
    const row = rows[index]!;
    let first = index;
    while (levelOf === undefined && first > 0 && rows[first]!.isContinuation) first--;
    let last = index;
    while (levelOf === undefined && !(last + 1 === rows.length || !rows[last + 1]!.isContinuation)) last++;
    const level = levelOf?.(index) ?? this._levelOf(rows.slice(first, last + 1).map((shown) => shown.content).join(""), drawn);
    const end = asCodePoint(row.valueStart + row.content.length);
    const before = rows[index - 1];
    const prev = before === undefined ? row.valueStart
      : endIsStop(rows, index - 1) ? asCodePoint(before.valueStart + before.content.length)
      : prevGrapheme(this.value, row.valueStart);
    return { start: row.valueStart, text: row.content, level, endSlot: endIsStop(rows, index), next: rows[index + 1]?.valueStart ?? end, prev };
  }

  // The direction of each of `rows`, its line's: each line's read once, however
  // many rows it wraps to, so a render pays for its rows and not their square.
  private _rowLevels(rows: readonly VisualRow[], drawn: Drawn): (index: number) => ParagraphLevel {
    const first: number[] = [];
    rows.forEach((row, index) => first.push(row.isContinuation && index > 0 ? first[index - 1]! : index));
    const levels = new Map<number, ParagraphLevel>();
    return (index) => {
      const start = first[index]!;
      let level = levels.get(start);
      if (level === undefined) {
        let end = start + 1;
        while (end < rows.length && rows[end]!.isContinuation) end++;
        level = this._levelOf(rows.slice(start, end).map((row) => row.content).join(""), drawn);
        levels.set(start, level);
      }
      return level;
    };
  }

  // The direction of a line of the value, read off what `drawn` shows of it.
  private _levelOf(line: string, drawn: Drawn): ParagraphLevel {
    return paragraphLevelOf(this._shown(line, drawn), undefined);
  }

  // Whether the screen shows `row` in the text's own order, so a step across
  // the screen is a step through the text.
  private _screenIsText(row: ScreenRow, drawn: Drawn): boolean {
    return drawn.textOrder === "plain" || (row.level === 0 && !isBidi(row.text));
  }

  // Where the caret is after one glyph `step` across the screen: within its row,
  // or out of the side of the row the step leaves by.
  private _screenStep(step: -1 | 1, frame: Frame): CodePoint {
    const drawn = this._drawn.get();
    const row = this._screenRow(drawn);
    const stop = stopIn(row, this.cursorPosition);
    // Off the row: its end leads on into what follows it, its start back into what precedes it.
    const off = (forward: boolean): CodePoint => forward ? row.next : row.prev;
    if (this._screenIsText(row, drawn)) {
      if (step === -1) return stop === 0 ? off(false) : prevGrapheme(this.value, asCodePoint(row.start + stop));
      return stop === row.text.length ? off(true) : nextGrapheme(this.value, asCodePoint(row.start + stop));
    }
    const { screen } = this._cursorScreen(frame);
    const here = screen.findIndex((glyph) => glyph.at === stop);
    if (here < 0) throw new Error(`TextInput: the cursor at ${this.cursorPosition} is not a slot of the row it is drawn in`);
    const next = screen[here + step];
    if (next !== undefined) return asCodePoint(row.start + next.at);
    // Off the screen's edge: the row's end leads forward and its start back,
    // wherever the order shows them; a glyph between them at the edge leaves
    // by the side the line runs to. With nothing past the row, the cursor stays.
    const { at } = screen[here]!;
    const forward = at === row.text.length && at !== 0 ? true : at === 0 && row.text.length !== 0 ? false : (step === 1) === (row.level === 0);
    const to = off(forward);
    const stays = forward ? row.endSlot && to === row.start + row.text.length : to === row.start;
    return stays ? this.cursorPosition : to;
  }

  // A word step across the screen: to the nearest word edge on the key's side
  // of the caret. A word's edges are its start and its end, set on the side
  // its glyphs run from and to, so in left-to-right text Left and Right are
  // readline's back and forward a word, and in right-to-left text the same
  // keys reach the same edges mirrored. With no edge on that side it is the
  // glyph step that leaves the row.
  private _wordStep(step: -1 | 1, frame: Frame): void {
    const drawn = this._drawn.get();
    const row = this._screenRow(drawn);
    if (this._screenIsText(row, drawn)) {
      if (step === 1) this.moveWordForward();
      else this.moveWordBack();
      return;
    }
    const { screen } = this._cursorScreen(frame);
    const indexOf = new Map(screen.map((glyph, index) => [glyph.at, index]));
    const from = indexOf.get(stopIn(row, this.cursorPosition));
    if (from === undefined) throw new Error(`TextInput: the cursor at ${this.cursorPosition} is not a slot of the row it is drawn in`);
    const glyphEnd = (at: number): number => nextGrapheme(row.text, asCodePoint(at));
    const isWord = (index: number): boolean => {
      const { at } = screen[index]!;
      return at < row.text.length && isWordChar(row.text.slice(at, glyphEnd(at)));
    };
    const edges: number[] = [];
    for (let left = 0; left < screen.length; left++) {
      if (!isWord(left)) continue;
      let right = left;
      while (right + 1 < screen.length && isWord(right + 1)) right++;
      const ats = screen.slice(left, right + 1).map((glyph) => glyph.at);
      const start = Math.min(...ats);
      const end = glyphEnd(Math.max(...ats));
      const leftToRight = left === right ? row.level === 0 : screen[left]!.at < screen[right]!.at;
      for (const edge of leftToRight ? [start, end] : [end, start]) {
        const index = indexOf.get(edge);
        if (index !== undefined) edges.push(index);
      }
      left = right;
    }
    const ahead = edges.filter((index) => (index - from) * step > 0);
    const to = ahead.length === 0 ? undefined : step === 1 ? Math.min(...ahead) : Math.max(...ahead);
    this.cursorPosition = to === undefined ? this._screenStep(step, frame) : asCodePoint(row.start + screen[to]!.at);
    this._preferredColumn.set(null);
  }

  private _shown(text: string, options: { readonly asciiOnly?: boolean }): string {
    return graphemes(text).map(this._shownAs(options)).join("");
  }

  // The cells a stretch of `value` took in the last render.
  private _shownCells(text: string): CellCol {
    return asCellCol(cellLen(this._shown(text, this._drawn.get())));
  }

  // The end of the glyphs of `text` whose cells, as a frame drawn under `drawn`
  // shows them, lie wholly left of `col`, so a column inside a wide glyph
  // lands before it.
  private _offsetAtShownCell(text: string, col: CellCol, drawn: Drawn): CodePoint {
    const shownAs = this._shownAs(drawn);
    let at = 0;
    let cells = 0;
    for (const g of graphemes(text)) {
      cells += cellLen(shownAs(g));
      if (cells > col) break;
      at += g.length;
    }
    return asCodePoint(at);
  }

  // The window single-line content shows at `drawn`: how many cells wide, and
  // from which cell. The render draws it and a click maps through it.
  private _singleLine(drawn: Drawn): { contentWidth: CellCol; startCell: CellCol } {
    // The cursor's column is the width of the shown text before it, whatever
    // the mode — a placeholder is shown only over an empty value.
    const shown = (text: string): string => this._shown(text, drawn);
    const rawCellWidth = asCellCol(cellLen(this._showsPlaceholder() ? this.placeholder : shown(this.value)));
    const beforeCursor = shown(this.value.slice(0, this.cursorPosition));
    const cursorCellCol = asCellCol(cellLen(beforeCursor));
    // The cursor's glyph, or the one cell past the text's end.
    const cursorCells = Math.max(1, cellLen(shown(this.value.slice(this.cursorPosition, nextGrapheme(this.value, this.cursorPosition)))));
    const maxAvailable = asCellCol(Math.max(MIN_CONTENT_WIDTH, drawn.maxWidth - 2));
    const contentWidth = asCellCol(Math.min(maxAvailable, singleLineExtent(rawCellWidth, cursorCellCol)));

    // The window (in cells) starts where the most of the text before the
    // cursor that fits beside the cursor's glyph begins: a glyph boundary, so
    // a wide glyph is never cut, and the cursor's glyph always in view.
    const startCell = asCellCol(cursorCellCol - cellLen(cellFitEnd(beforeCursor, asCellCol(contentWidth - cursorCells))));
    return { contentWidth, startCell };
  }

  private _showsPlaceholder(): boolean {
    return this.focused && this.value.length === 0 && this.placeholder.length > 0;
  }

  private _renderSingleLine(options: RenderOptions, drawn: Drawn): { lines: Segment[][]; layout: Layout } {

    const bracketStyle = this.disabled
      ? new Style(this.disabledInk)
      : new Style(ink(this.theme, "foreground", "background"));

    const contentStyle = this._showsPlaceholder() && !this.disabled
      ? new Style({ ...ink(this.theme, "foreground", "background"), dim: true })
      : this.ground;

    const cursorStyle = this.cursorStyleOverride ?? new Style(ink(this.theme, "on-primary", "primary"));

    const caret = this.focused && !this.disabled
      ? { at: this.cursorPosition, draw: (glyph: string) => this._caret(glyph, cursorStyle, contentStyle, options) }
      : undefined;
    // [LAW:one-source-of-truth] The window is a row of the value drawn as every
    // row is, so the stops a press reads are the cells the frame holds; a
    // placeholder is one row of its own, every cell of it the empty value's
    // only stop.
    const { window, contentWidth, endCells } = this._singleLineWindow(drawn);
    const close = new Segment(CLOSE, bracketStyle);
    const { segments: drawnRow, screen } = this._showsPlaceholder()
      ? this._placeholderRow(this.placeholder, drawn, contentStyle, caret, contentWidth)
      : this._drawnRow(window, drawn, contentStyle, caret, endCells);
    const open = new Segment(OPEN, bracketStyle);
    const segments = [open, ...drawnRow, close];
    return { lines: [segments], layout: { drawn, kind: "line", start: window.start, screen: screen({ before: [open], after: [close] }) } };
  }

  // The placeholder over an empty value: shown as written at its own
  // direction, the caret on its first glyph, padded to the window, every cell
  // the value's one stop.
  private _placeholderRow(
    text: string,
    drawn: Drawn,
    contentStyle: Style,
    caret: Caret | undefined,
    width: number,
  ): { segments: Segment[]; screen: (own: Outside) => Stops } {
    const [visible] = splitText(text, asCellCol(width));
    const display = setCellSize(visible, asCellCol(width));
    const first = display.slice(0, nextGrapheme(display, asCodePoint(0)));
    const content = caret === undefined
      ? [new Segment(display, contentStyle)]
      : [...caret.draw(first || " "), ...(display.length > first.length ? [new Segment(display.slice(first.length), contentStyle)] : [])];
    const segments = this._oriented(content, drawn.textOrder, paragraphLevelOf(display, undefined));
    const cells = [{ at: 0, text: display, style: contentStyle, cells: Segment.getLineLength(segments), probe: false }];
    return { segments, screen: (own) => ({ cells, ordersLine: false, own }) };
  }

  // A row's content in the order the frame shows it, as a button's label is
  // (`labeled`): the caret is a styled cell, so it goes where its glyph goes.
  // A row of a wrapped line or a scrolled window is ordered at its line's
  // direction, which it is stated only where its own text would guess otherwise,
  // so a row with nothing bidi in it stays as it was.
  private _oriented(content: readonly Segment[], order: TextOrder, level: ParagraphLevel): Segment[] {
    if (order === "plain") return [...content];
    const own = paragraphLevelOf(Segment.plainOf(content), undefined);
    const { line, oriented, orient } = reorder(content, order, own === level ? undefined : level);
    return oriented ? orient(line, 0, Segment.plainOf(line)) : [...line];
  }

  private _renderMultiline(options: RenderOptions, drawn: Drawn): { lines: Segment[][]; layout: Layout } {
    // [LAW:dataflow-not-control-flow] Decompose `value` into visual rows once,
    // then drive both display and cursor projection from the same array.
    const visualRows = this._rows(drawn);
    const total = visualRows.length;
    const cursorRow = cursorRowIn(visualRows, this.cursorPosition);
    const levelOf = drawn.textOrder === "plain" ? () => 0 as const : this._rowLevels(visualRows, drawn);
    const arrows = this._drawsArrows(total);
    const contentStyle = this.ground;
    const markerStyle = new Style({ ...ink(this.theme, "foreground", "background"), dim: true });
    const cursorStyle = this.cursorStyleOverride ?? new Style(ink(this.theme, "on-primary", "primary"));
    const caret = this.focused && !this.disabled
      ? { at: this.cursorPosition, draw: (glyph: string) => this._caret(glyph, cursorStyle, contentStyle, options) }
      : undefined;
    // One visual row as drawn: its continuation marker, then its content, the
    // caret on the cursor's row, and its stops once what follows it on its
    // line is known. Drawn once a frame, however often it is asked for.
    type RowDrawn = { readonly line: Segment[]; readonly screen?: (after: readonly Segment[]) => Stops };
    const drawnRows = new Map<number, RowDrawn>();
    const drawnAt = (rowIdx: number): RowDrawn => {
      let drawnRow = drawnRows.get(rowIdx);
      if (drawnRow === undefined) drawnRows.set(rowIdx, drawnRow = drawRow(rowIdx));
      return drawnRow;
    };
    const rowAt = (rowIdx: number): Segment[] => drawnAt(rowIdx).line;
    const drawRow = (rowIdx: number): RowDrawn => {
      const row = visualRows[rowIdx];
      // A row past the value's last is `minRows` padding: blank.
      if (row === undefined) return { line: [] };
      const line: Segment[] = [];
      if (row.isContinuation) {
        // An ASCII stand-in as wide as the marker, so the rows keep their geometry.
        line.push(new Segment(drawable(options, this._continuationMarker, ">".padEnd(this._markerWidth)), markerStyle));
      }
      const shown = this._screenRowAt(visualRows, rowIdx, drawn, levelOf);
      const onRow = rowIdx === cursorRow ? caret : undefined;
      const before = [...line];
      const { segments, screen } = this._drawnRow(shown, drawn, contentStyle, onRow);
      line.push(...segments);
      return { line, screen: (after) => screen({ before, after }) };
    };
    // The window is drawn at the width offered, or wider where the cursor's
    // row draws past it: a caret past the end of a full row.
    const offered = cellCount(options.maxWidth);
    const width = Math.max(offered, Segment.getLineLength(rowAt(cursorRow)));
    // Pad with empty rows when the value is shorter than `minRows`.
    const padRows = this._minRows !== undefined && this._maxRows === undefined ? Math.max(0, this._minRows - total) : 0;
    // [LAW:dataflow-not-control-flow] Only the rows a frame shows are drawn,
    // so a frame costs the rows in view and not the value's length. Every row
    // is padded to the width, so each has cells to stamp — a blank row
    // included — and the stamp names its row of the content.
    const owner = {};
    const rowLines: Lines = {
      layout: () => ({
        length: total + padRows,
        lines: (start, end) => Segment.anchorLines(
          Array.from({ length: end - start }, (_, i) => Segment.adjustLineLength(rowAt(start + i), width, contentStyle)),
          owner,
          start,
        ),
      }),
      measure: () => ({ minimum: width, maximum: width }),
    };

    // The viewport picks the window, at most `maxRows` tall whatever region the
    // field is placed in, with the cursor's row followed.
    const shown = Segment.splitLines(render(
      this._viewport.showingLines(rowLines, { start: cursorRow, end: cursorRow + 1 }),
      { ...options, maxWidth: width, height: this._maxRows === undefined ? undefined : { rows: this._maxRows, exact: false } },
    ));

    // The content row the window's first row shows: the offset this frame
    // drew, read off what the viewport drew.
    const offset = shownRow(shown, owner);
    // The field is as wide as the widest row it shows, and never narrower than
    // its least measure the offer allows, so a blank field has cells to click;
    // a field with arrows is the whole offer, the arrows in its last cell. Read
    // off the rows in view, so a frame never measures the whole value.
    const widest = shown.reduce((w, _, i) => Math.max(w, Segment.getLineLength(rowAt(offset + i))), 0);
    const fieldWidth = arrows ? width : Math.min(width, Math.max(widest, Math.min(offered, MIN_CONTENT_WIDTH + 2)));
    // Scroll-direction arrows appear in the rightmost cell of the first/last
    // visible row, *only* when scroll is actually possible in that direction.
    // Only emitted in `"arrows"` mode; other modes leave the content area
    // untouched and rely on the host to surface scroll state externally (e.g.
    // Panel border accessory).
    const indicatorStyle = this.indicatorStyleOverride ?? new Style(ink(this.theme, "text-primary", "background"));
    const arrowOn = (i: number): string | undefined =>
      !arrows ? undefined
        : i === 0 && offset > 0 ? drawable(options, "▲", "^")
        : i === shown.length - 1 && offset + shown.length < total ? drawable(options, "▼", "v")
        : undefined;
    // The arrow's cells are reserved at the end of the offer, so a wide glyph
    // never collides with it: the row is cut to the cells before it. The arrow
    // keeps the place of the cell it covers, the viewport's included, so the
    // wheel over it scrolls the field.
    const withArrows = shown.map((line, i) => {
      const arrow = arrowOn(i);
      if (arrow === undefined) return Segment.adjustLineLength(line, fieldWidth, contentStyle);
      const at = offered - cellLen(arrow);
      const cell = indicatorStyle.withAnchor(Segment.anchorAt([line], at, 0));
      return Segment.adjustLineLength([...Segment.adjustLineLength(line, at, contentStyle), new Segment(arrow, cell)], fieldWidth, contentStyle);
    });
    // The stops of each row shown, read with the arrow drawn after it on its
    // line, which is part of the line a terminal orders.
    const screens = new Map<number, Stops>();
    shown.forEach((_, i) => {
      const arrow = arrowOn(i);
      const screen = drawnAt(offset + i).screen?.(arrow === undefined ? [] : [new Segment(arrow, indicatorStyle)]);
      if (screen !== undefined) screens.set(offset + i, screen);
    });
    return { lines: withArrows, layout: { drawn, kind: "rows", rows: visualRows, offset, screens } };
  }

  // The caret's cell for the frame `options` draws: the blink restarted at the
  // last touch, placed as every animation is (`placed`), so it draws at the
  // frame's time, holds lit under reduced motion, and the cell says when it
  // next flips, which is when a host draws again. A print, drawn for no
  // moment, draws it at 0 like any placed animation. Lit, the cell is the
  // cursor's; dark, it is drawn as the text around it, since the cursor is a
  // color pair and no attribute hides it. Where the painter shows the
  // terminal's cursor, the cell is the text's, marked for it: the terminal
  // blinks its own, and an IME's candidate window and a screen reader follow
  // it to the editing point.
  private _caret(at: string, cursorStyle: Style, contentStyle: Style, options: RenderOptions): Iterable<Segment> {
    if (options.caret === true) return [new Segment(at, contentStyle.withCaret(caretMark(this.caretShape)))];
    return placed(this._blink, options, (lit) => [new Segment(at, lit ? cursorStyle : contentStyle)]);
  }

  // Whether `rows` visual rows draw a scroll arrow in the last cell of a row.
  private _drawsArrows(rows: number): boolean {
    return this._scrollIndicator === "arrows" && this._maxRows !== undefined && rows > this._maxRows;
  }

  // The visual rows `value` lays out into at `drawn`. A width that bounds
  // nothing wraps nothing, so before any frame they are the logical lines.
  private _rows(drawn: Drawn): VisualRow[] {
    const wrap = Number.isFinite(drawn.maxWidth) ? this._wrap : undefined;
    const firstWidth = asCellCol(Math.max(1, drawn.maxWidth));
    const continuationWidth = asCellCol(Math.max(1, firstWidth - this._markerWidth));
    const shownAs = this._shownAs(drawn);

    const rows: VisualRow[] = [];
    const lines = this.value.split("\n");
    let pos = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      if (wrap !== undefined) {
        // `lineOffset[s]` is where offset `s` of the line as shown falls in
        // `line`: a glyph shown as itself maps code unit for code unit, and
        // every offset inside a stand-in falls at the start of its glyph, so
        // a row the strategy ends there draws the glyph on the next row.
        let shownLine = "";
        const lineOffset: number[] = [];
        let at = 0;
        for (const g of graphemes(line)) {
          const s = shownAs(g);
          for (let i = 0; i < s.length; i++) lineOffset.push(s === g ? at + i : at);
          shownLine += s;
          at += g.length;
        }
        lineOffset.push(at);
        const wrapRows = wrap(shownLine, { firstWidth, continuationWidth });
        if (wrapRows.length === 0) {
          rows.push({ content: "", valueStart: asCodePoint(pos), isContinuation: false });
        } else {
          for (let ri = 0; ri < wrapRows.length; ri++) {
            const wr = wrapRows[ri]!;
            const start = lineOffset[wr.start]!;
            rows.push({
              content: line.slice(start, lineOffset[wr.end]!),
              valueStart: asCodePoint(pos + start),
              isContinuation: ri > 0,
            });
          }
        }
      } else {
        rows.push({ content: line, valueStart: asCodePoint(pos), isContinuation: false });
      }
      pos += line.length + 1; // +1 for the \n separator
    }
    return rows;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const minimum = MIN_CONTENT_WIDTH + 2;
    const shownCells = (line: string): number => cellLen(this._shown(line, options));
    // The widest the value draws, its cursor at the end of a line included. A
    // multi-line value draws each logical line on rows of its own, with no
    // brackets and no placeholder, and a scroll arrow's cell past each line
    // when its lines outnumber the rows.
    if (this._multiline) {
      const lines = this.value.split("\n");
      const arrowCells = this._drawsArrows(lines.length) ? 1 : 0;
      return { minimum, maximum: lines.reduce((w, line) => Math.max(w, shownCells(line) + 1 + arrowCells), minimum) };
    }
    // A single-line value draws its breaks as glyphs between brackets, and its
    // placeholder over an empty value.
    const valueCells = shownCells(this.value);
    return { minimum, maximum: singleLineExtent(this.value === "" ? cellLen(this.placeholder) : valueCells, valueCells) + 2 };
  }

  /**
   * `[X/Y]` scroll-position string when there's actually something to
   * scroll, else `undefined`. X is the cursor's 1-indexed visual row; Y is
   * the total visual row count. Hand it a frame this field is drawn in — a
   * `Panel`'s `bottomRightAccessory` function is handed its body's:
   *
   *   bottomRightAccessory: (body) => input.scrollIndicatorText(body)
   *
   * It counts the rows that frame laid out, read off the field's own cells, so
   * it is right on the frame it labels however deep the field sits in it.
   *
   * Returns `undefined` when:
   *   - `scrollIndicator` is not `"indices"`, or
   *   - `maxRows` is unset, or total visual rows ≤ maxRows (nothing to
   *     scroll), or
   *   - `frame` shows none of the field's rows (a width too narrow to draw it).
   */
  scrollIndicatorText(frame: readonly (readonly Segment[])[]): string | undefined {
    if (this._scrollIndicator !== "indices") return undefined;
    if (this._maxRows === undefined) return undefined;
    const layout = layoutIn(frame, this);
    if (layout?.kind !== "rows" || layout.rows.length <= this._maxRows) return undefined;
    return `[${cursorRowIn(layout.rows, this.cursorPosition) + 1}/${layout.rows.length}]`;
  }
}
