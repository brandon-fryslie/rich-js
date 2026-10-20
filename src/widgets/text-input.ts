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

import { observable, action, observableRef, runInAction } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import {
  cellLen,
  setCellSize,
  splitText,
  cellFitEnd,
  cellStepFrom,
  asCellCol,
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
import { drawable, type RenderOptions } from "../core/protocol.js";
import { Animation } from "../core/animation.js";
import { beat } from "../core/easing.js";
import { Timeline } from "../core/timeline.js";
import { shownAt } from "../core/view.js";
import { stampFrame } from "../renderables/frames.js";
import type { TerminalTheme } from "../core/color.js";
import { ThemedWidget } from "./themed-widget.js";
import { ink } from "./ink.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

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
 * `value` (not the logical line a wrap strategy sees). Cached on `render()`
 * and consumed by `moveLineUp` / `moveLineDown` so vertical motion follows
 * what's actually on screen — not what the logical-line model would do in
 * the absence of wrap.
 */
interface VisualRow {
  /** The stretch of `value` the row shows, as `value` holds it. */
  readonly content: string;
  /** Code-point offset into `value` where this row's content begins. */
  readonly valueStart: CodePoint;
  readonly isContinuation: boolean;
}

/**
 * Character-greedy soft wrap. Breaks at any character once `firstWidth`
 * (or `continuationWidth` for continuation rows) cells are exhausted. The
 * textarea default when a consumer says "wrap, I don't care how" — no syntax
 * awareness, just fits the line to the width.
 *
 * Wide characters (CJK, emoji) are treated as atomic: a char that would
 * straddle the budget is moved to the next row rather than split, and one too
 * wide for the whole budget is force-taken — see `cellStepFrom`.
 */
export const charGreedyWrap: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
  if (line.length === 0) return [{ start: asCodePoint(0), end: asCodePoint(0) }];
  const rows: WrapRow[] = [];
  let pos: CodePoint = asCodePoint(0);
  let isFirst = true;
  while (pos < line.length) {
    const cap = isFirst ? firstWidth : continuationWidth;
    if (cap <= 0) break;
    const end = cellStepFrom(line, pos, cap);
    rows.push({ start: pos, end });
    pos = end;
    isFirst = false;
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
   *     publishes `scrollIndicatorText` (e.g. `"[14/102]"`) for the host
   *     (typically a `Panel`'s `bottomRightAccessory`) to display in the
   *     border. Useful when the surrounding chrome should carry the
   *     indicator so widget content area stays untouched.
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
   * Style override for the rendered content text. Defaults to the
   * theme's `foreground` palette color.
   */
  contentStyle?: Style;
}

const MIN_CONTENT_WIDTH = 8;

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

// Text a key may insert: anything but the C0 controls, DEL and the C1
// controls, which a terminal reads as escape sequences (U+009B is CSI).
const PRINTABLE = /^[^\x00-\x1f\x7f-\x9f]+$/u;

// Word-character regex used by Alt+B/F and Ctrl+Left/Right. Matches the
// readline default (alphanumeric + underscore), which is what users typing
// shell commands or code identifiers expect.
const WORD_CHAR_RE = /[A-Za-z0-9_]/;
const WHITESPACE_RE = /\s/;

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

/**
 * The caret's blink, from the moment it restarts: lit for the first half
 * second, so the caret is solid the moment a key lands, then dark for the
 * next, on a `beat`. A loop, so with its motion taken out it holds lit.
 */
const CARET_BLINK: Animation<boolean> = Animation.map(beat([0.5, 0.5]), (hold) => hold === 0);

/** The caret of a frame drawn for no moment — a `print` — which nothing moves: lit, and never changing. */
const CARET_UNTIMED = { value: true, nextChange: Number.POSITIVE_INFINITY } as const;

export class TextInput extends ThemedWidget {
  readonly id: string;
  readonly focusable = true;

  @observable private accessor _value: string;
  @observable private accessor _cursor: CodePoint;
  // When the field last heard a key, on the frame's clock (`KeyEvent.time`):
  // where the caret's blink restarts. The blink itself is a function of this
  // and the time a frame is drawn for, so nothing about it is kept.
  @observable private accessor _typedAt = 0;

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
  @observableRef accessor contentStyleOverride: Style | undefined;

  /**
   * Last computed visual-row decomposition. Cached at the end of `render()`
   * so vertical motion (Up/Down) can step row-by-row without re-running the
   * wrap strategy. Null before the first render — vertical motion falls
   * back to logical-line motion in that case.
   *
   * [LAW:dataflow-not-control-flow] One source of truth for "what does Up
   * mean right now": the row table the renderer just produced. No parallel
   * "where would the cursor go" math; both the renderer and the keymap
   * read from the same array.
   */
  private _visualRows: readonly VisualRow[] | null = null;

  // [LAW:types-are-the-program] `_preferredColumn` is a cell column (not a
  // code-unit index) — vertical motion navigates the visual surface, not the
  // string's byte layout. Reset to null on every non-vertical motion or edit
  // so the next Up/Down captures a fresh intent. Without this, Down through a
  // short line then back Up would land at the short-line column instead of the
  // original.
  private _preferredColumn: CellCol | null = null;

  // Single-slot kill buffer used by Ctrl+U / Ctrl+K → Ctrl+Y. Not a full
  // kill ring (no Alt+Y rotation) — sufficient for the common cut/paste
  // pattern that's the readline 90% case.
  private _killBuffer: string = "";

  // [LAW:one-source-of-truth] Top visual row of the scroll viewport.
  // Persisted across renders so the cursor can move *within* the viewport
  // without dragging it along — the viewport scrolls only when the cursor
  // would leave it. Without this, recomputing scroll from cursor position
  // alone pins the cursor to the viewport's bottom edge whenever
  // `cursorRow >= maxRows`, making every subsequent Up/Down scroll in
  // lockstep with the cursor.
  private _scrollStart: number = 0;

  // [LAW:one-source-of-truth] Viewport scroll offset in cells for the
  // single-line renderer. Captured by _renderSingleLine and read by
  // handleMouse so the hit-test uses the same visual origin the user sees.
  private _singleLineViewportStart: CellCol = asCellCol(0);
  // How the last render could draw, so the hit-test and vertical motion
  // measure `value` as it was shown.
  private _drawn: { readonly asciiOnly: boolean } = { asciiOnly: false };

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
    this._wrap = options.wrap;
    this._continuationMarker = options.continuationMarker ?? "↳ ";
    this._markerWidth = asCellCol(cellLen(this._continuationMarker));
    this._maxRows = options.maxRows;
    this._minRows = options.minRows;
    this._scrollIndicator = options.scrollIndicator ?? "arrows";
    this.indicatorStyleOverride = options.indicatorStyle;
    this.cursorStyleOverride = options.cursorStyle;
    this.contentStyleOverride = options.contentStyle;
    this.multiline = this._multiline;
  }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    this._typedAt = event.time;

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
        case "left":  this.moveCharLeft();  event.stop(); return;
        case "right": this.moveCharRight(); event.stop(); return;
        case "up":    this.moveLineUp();    event.stop(); return;
        case "down":  this.moveLineDown();  event.stop(); return;
        case "home":  this.moveLineStart(); event.stop(); return;
        case "end":   this.moveLineEnd();   event.stop(); return;
      }
    }

    // ─── Ctrl-modified motion + readline editing ───
    if (event.ctrl && !event.meta) {
      switch (event.key) {
        case "left":  this.moveWordLeft();      event.stop(); return;
        case "right": this.moveWordRight();     event.stop(); return;
        case "home":  this.moveDocStart();      event.stop(); return;
        case "end":   this.moveDocEnd();        event.stop(); return;
        case "a":     this.moveLineStart();     event.stop(); return;
        case "e":     this.moveLineEnd();       event.stop(); return;
        case "b":     this.moveCharLeft();      event.stop(); return;
        case "f":     this.moveCharRight();     event.stop(); return;
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
        case "left":  this.moveWordLeft();       event.stop(); return;
        case "right": this.moveWordRight();      event.stop(); return;
        case "b":     this.moveWordLeft();       event.stop(); return;
        case "f":     this.moveWordRight();      event.stop(); return;
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

    if (this._multiline) {
      // Multiline has no brackets; rows may have a leading continuation marker.
      // Use event.y to pick the visual row, then project event.x into its content.
      const rows = this._visualRows;
      if (!rows || rows.length === 0) return;
      const rawRowIdx = this._scrollStart + event.y;
      // Clicks on minRows-padded empty rows (beyond the last real row) snap to end.
      if (rawRowIdx >= rows.length) {
        this.cursorPosition = asCodeUnit(this.value.length);
        this._preferredColumn = null;
        return;
      }
      const rowIdx = Math.max(0, rawRowIdx);
      const row = rows[rowIdx]!;
      // Continuation rows start after the marker; non-continuation rows start at column 0.
      const contentXOff = asCellCol(row.isContinuation ? this._markerWidth : 0);
      const relX = asCellCol(Math.max(0, event.x - contentXOff));
      this.cursorPosition = asCodeUnit(row.valueStart + this._offsetAtShownCell(row.content, relX));
    } else {
      // [LAW:types-are-the-program] relX is a cell-column offset into the full
      // display string. Add _singleLineViewportStart (the scroll offset captured
      // by _renderSingleLine) so a click on a scrolled viewport maps to the
      // correct code-unit in the underlying value.
      const relX = asCellCol(Math.max(0, event.x - 1) + this._singleLineViewportStart);
      this.cursorPosition = this._offsetAtShownCell(this.value, relX);
    }
    this._preferredColumn = null;
  }

  // --- Hover mutator (router fast-path) ---

  @action
  override setHovered(value: boolean): void { this.hovered = value; }

  // ─── Public motion primitives ───────────────────────────────────────────

  @action moveCharLeft(): void {
    this.cursorPosition = prevGrapheme(this.value, this.cursorPosition);
    this._preferredColumn = null;
  }

  @action moveCharRight(): void {
    this.cursorPosition = nextGrapheme(this.value, this.cursorPosition);
    this._preferredColumn = null;
  }

  @action moveLineUp(): void {
    // Prefer the on-screen visual decomposition when it exists — wraps,
    // marker offsets, and scroll alignment are all already accounted for.
    // Fall back to logical-line motion only when no render has occurred yet
    // (e.g. cursor motion before mount).
    if (this._visualRows !== null && this._visualRows.length > 1) {
      const rowIdx = this._cursorVisualRow();
      if (rowIdx === 0) return;
      const col = this._preferredColumn ?? this._cursorVisualCol();
      const target = this._visualRows[rowIdx - 1]!;
      this.cursorPosition = asCodeUnit(target.valueStart + this._clampColForRow(col, rowIdx - 1));
      this._preferredColumn = col;
      return;
    }
    const lineStart = this._lineStart();
    if (lineStart === 0) return;
    // Fallback: no render cache yet; use cell-space arithmetic for wide-char correctness.
    const col = this._preferredColumn ?? this._shownCells(this.value.slice(lineStart, this.cursorPosition));
    const prevLineEnd = lineStart - 1;
    let prevLineStart: number = prevLineEnd;
    while (prevLineStart > 0 && this.value[prevLineStart - 1] !== "\n") prevLineStart--;
    const prevLineContent = this.value.slice(prevLineStart, prevLineEnd);
    this.cursorPosition = asCodeUnit(prevLineStart + this._offsetAtShownCell(prevLineContent, col));
    this._preferredColumn = col;
  }

  @action moveLineDown(): void {
    if (this._visualRows !== null && this._visualRows.length > 1) {
      const rowIdx = this._cursorVisualRow();
      if (rowIdx === this._visualRows.length - 1) return;
      const col = this._preferredColumn ?? this._cursorVisualCol();
      this.cursorPosition = asCodeUnit(this._visualRows[rowIdx + 1]!.valueStart + this._clampColForRow(col, rowIdx + 1));
      this._preferredColumn = col;
      return;
    }
    const lineEnd = this._lineEnd();
    if (lineEnd === this.value.length) return;
    const lineStart = this._lineStart();
    // Fallback: no render cache yet; use cell-space arithmetic for wide-char correctness.
    const col = this._preferredColumn ?? this._shownCells(this.value.slice(lineStart, this.cursorPosition));
    const nextLineStart = lineEnd + 1;
    let nextLineEnd: number = nextLineStart;
    while (nextLineEnd < this.value.length && this.value[nextLineEnd] !== "\n") nextLineEnd++;
    const nextLineContent = this.value.slice(nextLineStart, nextLineEnd);
    this.cursorPosition = asCodeUnit(nextLineStart + this._offsetAtShownCell(nextLineContent, col));
    this._preferredColumn = col;
  }

  // Clamp `col` (a cell column) to the target visual row's content, returning
  // the code-unit offset within that row. When the row IS followed by a
  // continuation of the same logical line, we clamp to the last valid
  // cluster boundary strictly inside the row (which may be more than
  // one cell before the visual end when the last glyph is wide) so the
  // cursor stays strictly inside the target row — landing at the boundary
  // would cause `_cursorVisualRow` to resolve to the *later* row, making
  // every subsequent Up/Down stick at the boundary.
  //
  // For rows NOT followed by a continuation (last wrap row, or any unwrapped
  // logical line), the end-of-line position is valid — there is no adjacent
  // continuation row to collide with.
  private _clampColForRow(col: CellCol, targetIdx: number): CodePoint {
    const rows = this._visualRows!;
    const target = rows[targetIdx]!;
    const nextIsContinuation = targetIdx + 1 < rows.length && rows[targetIdx + 1]!.isContinuation;
    const contentCellWidth = this._shownCells(target.content);
    const capCells = nextIsContinuation
      ? asCellCol(Math.max(0, contentCellWidth - 1))
      : contentCellWidth;
    return this._offsetAtShownCell(target.content, asCellCol(Math.min(col, capCells)));
  }

  // Locate which cached visual row the cursor sits on. Returns the row index
  // for use in `moveLineUp`/`moveLineDown`; caller must guard `_visualRows`.
  private _cursorVisualRow(): number {
    const rows = this._visualRows!;
    let idx = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i]!.valueStart <= this.cursorPosition) { idx = i; break; }
    }
    return idx;
  }

  // Returns the cursor's cell column within its current visual row.
  private _cursorVisualCol(): CellCol {
    const rows = this._visualRows!;
    const idx = this._cursorVisualRow();
    const row = rows[idx]!;
    return this._shownCells(row.content.slice(0, this.cursorPosition - row.valueStart));
  }

  @action moveLineStart(): void {
    this.cursorPosition = this._lineStart();
    this._preferredColumn = null;
  }

  @action moveLineEnd(): void {
    this.cursorPosition = this._lineEnd();
    this._preferredColumn = null;
  }

  @action moveDocStart(): void {
    this.cursorPosition = asCodeUnit(0);
    this._preferredColumn = null;
  }

  @action moveDocEnd(): void {
    this.cursorPosition = asCodeUnit(this.value.length);
    this._preferredColumn = null;
  }

  @action moveWordLeft(): void {
    let p: CodePoint = this.cursorPosition;
    while (p > 0) {
      const prev = prevGrapheme(this.value, p);
      if (isWordChar(this.value.slice(prev, p))) break;
      p = prev;
    }
    while (p > 0) {
      const prev = prevGrapheme(this.value, p);
      if (!isWordChar(this.value.slice(prev, p))) break;
      p = prev;
    }
    this.cursorPosition = p;
    this._preferredColumn = null;
  }

  @action moveWordRight(): void {
    let p: CodePoint = this.cursorPosition;
    while (p < this.value.length) {
      const next = nextGrapheme(this.value, p);
      if (isWordChar(this.value.slice(p, next))) break;
      p = next;
    }
    while (p < this.value.length) {
      const next = nextGrapheme(this.value, p);
      if (!isWordChar(this.value.slice(p, next))) break;
      p = next;
    }
    this.cursorPosition = p;
    this._preferredColumn = null;
  }

  // ─── Public editing primitives ──────────────────────────────────────────

  @action deleteCharBack(): void {
    if (this.cursorPosition === 0) return;
    const newPos = prevGrapheme(this.value, this.cursorPosition);
    this.value = this.value.slice(0, newPos) + this.value.slice(this.cursorPosition);
    this.cursorPosition = newPos;
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteCharForward(): void {
    if (this.cursorPosition >= this.value.length) return;
    const nextPos = nextGrapheme(this.value, this.cursorPosition);
    this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(nextPos);
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteWordBack(): void {
    // Readline `unix-word-rubout` semantics: delete back to nearest whitespace,
    // skipping trailing whitespace first so successive Ctrl+W at "foo bar |"
    // → "foo |" → "|" rather than getting stuck on the trailing space.
    let p: CodePoint = this.cursorPosition;
    while (p > 0) {
      const prev = prevGrapheme(this.value, p);
      if (!isWhitespace(this.value.slice(prev, p))) break;
      p = prev;
    }
    while (p > 0) {
      const prev = prevGrapheme(this.value, p);
      if (isWhitespace(this.value.slice(prev, p))) break;
      p = prev;
    }
    if (p === this.cursorPosition) return;
    this._killBuffer = this.value.slice(p, this.cursorPosition);
    this.value = this.value.slice(0, p) + this.value.slice(this.cursorPosition);
    this.cursorPosition = p;
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteWordForward(): void {
    let p: CodePoint = this.cursorPosition;
    while (p < this.value.length) {
      const next = nextGrapheme(this.value, p);
      if (isWordChar(this.value.slice(p, next))) break;
      p = next;
    }
    while (p < this.value.length) {
      const next = nextGrapheme(this.value, p);
      if (!isWordChar(this.value.slice(p, next))) break;
      p = next;
    }
    if (p === this.cursorPosition) return;
    this._killBuffer = this.value.slice(this.cursorPosition, p);
    this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(p);
    this._preferredColumn = null;
    this.emitChange();
  }

  @action killLineBack(): void {
    const start = this._lineStart();
    if (start === this.cursorPosition) return;
    this._killBuffer = this.value.slice(start, this.cursorPosition);
    this.value = this.value.slice(0, start) + this.value.slice(this.cursorPosition);
    this.cursorPosition = start;
    this._preferredColumn = null;
    this.emitChange();
  }

  @action killLineForward(): void {
    const end = this._lineEnd();
    if (end > this.cursorPosition) {
      this._killBuffer = this.value.slice(this.cursorPosition, end);
      this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(end);
      this._preferredColumn = null;
      this.emitChange();
      return;
    }
    // Already at line end → kill the trailing `\n` (join next line).
    if (this.cursorPosition < this.value.length) {
      this._killBuffer = "\n";
      this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(this.cursorPosition + 1);
      this._preferredColumn = null;
      this.emitChange();
    }
  }

  @action yank(): void {
    if (this._killBuffer.length === 0) return;
    this._insertText(this._killBuffer);
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
      this._preferredColumn = null;
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
    this._preferredColumn = null;
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
    this._preferredColumn = null;
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
    this._drawn = { asciiOnly: options.asciiOnly ?? false };
    if (this._multiline) return this._renderMultiline(options);
    return this._renderSingleLine(options);
  }

  // [LAW:dataflow-not-control-flow] How a stretch of `value` is shown in one
  // line derives glyph by glyph from mode: a mask cell in password mode, else
  // the glyph itself — or, for a glyph of zero cells, a stand-in of one cell.
  // Every glyph then has a column of its own, so each cursor stop draws the
  // cursor somewhere new. The render and the click hit-test both read it.
  private _shownAs(options: { readonly asciiOnly?: boolean }): (glyph: string) => string {
    const mask = drawable(options, MASK_GLYPH, ASCII_MASK_GLYPH);
    const newline = drawable(options, NEWLINE_GLYPH, ASCII_NEWLINE_GLYPH);
    const zeroCell = drawable(options, ZERO_CELL_GLYPH, ASCII_ZERO_CELL_GLYPH);
    return (g) =>
      this._password ? mask
        : cellLen(g) > 0 ? g
        : g === "\n" ? newline : zeroCell;
  }

  private _shown(text: string, options: { readonly asciiOnly?: boolean }): string {
    return graphemes(text).map(this._shownAs(options)).join("");
  }

  // The cells a stretch of `value` took in the last render.
  private _shownCells(text: string): CellCol {
    return asCellCol(cellLen(this._shown(text, this._drawn)));
  }

  // The end of the glyphs of `text` whose cells in the last render lie wholly
  // left of `col`, so a column inside a wide glyph lands before it.
  private _offsetAtShownCell(text: string, col: CellCol): CodePoint {
    const shownAs = this._shownAs(this._drawn);
    let at = 0;
    let cells = 0;
    for (const g of graphemes(text)) {
      cells += cellLen(shownAs(g));
      if (cells > col) break;
      at += g.length;
    }
    return asCodePoint(at);
  }

  private _renderSingleLine(options: RenderOptions): Segment[] {
    const showPlaceholder = this.focused && this.value.length === 0 && this.placeholder.length > 0;

    // The cursor's column is the width of the shown text before it, whatever
    // the mode — a placeholder is shown only over an empty value.
    const shown = (text: string): string => this._shown(text, options);
    const rawDisplay = showPlaceholder ? this.placeholder : shown(this.value);

    const rawCellWidth = asCellCol(cellLen(rawDisplay));
    const beforeCursor = shown(this.value.slice(0, this.cursorPosition));
    const cursorCellCol = asCellCol(cellLen(beforeCursor));
    // The cursor's glyph, or the one cell past the text's end.
    const cursorCells = Math.max(1, cellLen(shown(this.value.slice(this.cursorPosition, nextGrapheme(this.value, this.cursorPosition)))));
    const maxAvailable = asCellCol(Math.max(MIN_CONTENT_WIDTH, options.maxWidth - 2));
    const contentWidth = asCellCol(Math.min(maxAvailable, singleLineExtent(rawCellWidth, cursorCellCol)));

    // The viewport (in cells) starts where the most of the text before the
    // cursor that fits beside the cursor's glyph begins: a glyph boundary, so
    // a wide glyph is never cut, and the cursor's glyph always in view.
    const startCell = asCellCol(cursorCellCol - cellLen(cellFitEnd(beforeCursor, asCellCol(contentWidth - cursorCells))));
    this._singleLineViewportStart = startCell;
    const [, afterStart] = splitText(rawDisplay, startCell);
    const [visible] = splitText(afterStart, contentWidth);
    const display = setCellSize(visible, contentWidth);
    const cursorDisplayCellCol = asCellCol(cursorCellCol - startCell);

    const bracketStyle = this.disabled
      ? new Style(this.disabledInk)
      : new Style(ink(this.theme, "foreground", "background"));

    const contentStyle = showPlaceholder && !this.disabled
      ? new Style({ ...ink(this.theme, "foreground", "background"), dim: true })
      : this.ground;

    const cursorStyle = this.cursorStyleOverride ?? new Style(ink(this.theme, "on-primary", "primary"));

    const segments: Segment[] = [new Segment("[", bracketStyle)];

    if (this.focused && !this.disabled) {
      const [before, rest] = splitText(display, cursorDisplayCellCol);
      const firstCh = rest.slice(0, nextGrapheme(rest, asCodePoint(0)));
      const at = firstCh || " ";
      const after = rest.slice(firstCh.length);
      if (before.length > 0) segments.push(new Segment(before, contentStyle));
      segments.push(...this._caret(at, cursorStyle, contentStyle, options));
      if (after.length > 0) segments.push(new Segment(after, contentStyle));
    } else {
      segments.push(new Segment(display, contentStyle));
    }

    segments.push(new Segment("]", bracketStyle));
    return segments;
  }

  private _renderMultiline(options: RenderOptions): Segment[] {
    // [LAW:dataflow-not-control-flow] Decompose `value` into visual rows
    // exactly once per render, cache the result, then drive both display
    // *and* cursor projection from the same array. Vertical motion reads
    // from the cache so Up/Down step through whatever the user actually
    // sees, including soft-wrap continuations.
    const visualRows = this._computeVisualRows(options);
    this._visualRows = visualRows;

    // Scroll window: keep `_scrollStart` (the viewport's top row) stable
    // across renders, adjusting only when the cursor would leave the
    // viewport. This is the textarea-conventional "viewport follows cursor
    // when it has to" behavior — cursor moves freely *within* the visible
    // rows; the window scrolls only at the edges. When `maxRows` is unset,
    // render every row.
    const total = visualRows.length;
    const cursorRow = this._cursorVisualRow();
    let scrollStart = 0;
    let visibleCount = total;
    if (this._maxRows !== undefined && total > this._maxRows) {
      const maxStart = total - this._maxRows;
      if (cursorRow < this._scrollStart) {
        this._scrollStart = cursorRow;
      } else if (cursorRow >= this._scrollStart + this._maxRows) {
        this._scrollStart = cursorRow - this._maxRows + 1;
      }
      this._scrollStart = Math.max(0, Math.min(maxStart, this._scrollStart));
      scrollStart = this._scrollStart;
      visibleCount = this._maxRows;
    } else {
      this._scrollStart = 0;
    }
    // Pad with empty rows when the value is shorter than `minRows`.
    let padRows = 0;
    if (this._minRows !== undefined && total < this._minRows && this._maxRows === undefined) {
      padRows = this._minRows - total;
    }

    const contentStyle = this.ground;
    const markerStyle = new Style({ ...ink(this.theme, "foreground", "background"), dim: true });
    const cursorStyle = this.cursorStyleOverride ?? new Style(ink(this.theme, "on-primary", "primary"));

    // Scroll-direction arrows appear in the rightmost cell of the first/last
    // visible row, *only* when scroll is actually possible in that direction.
    // _emitRowContent reserves the indicator's cells so content never
    // collides with the arrow. Only emitted in `"arrows"` mode; other modes
    // leave the content area untouched and rely on the host to surface scroll
    // state externally (e.g. Panel border accessory).
    const arrows = this._drawsArrows(total);
    const canScrollUp = arrows && this._scrollStart > 0;
    const canScrollDown = arrows && this._scrollStart + this._maxRows! < total;
    const indicatorStyle = this.indicatorStyleOverride ?? new Style(ink(this.theme, "text-primary", "background"));

    const segments: Segment[] = [];
    const showCursor = this.focused && !this.disabled;
    for (let i = 0; i < visibleCount; i++) {
      const rowIdx = scrollStart + i;
      const row = visualRows[rowIdx]!;
      if (i > 0) segments.push(new Segment("\n"));
      if (row.isContinuation) {
        // An ASCII stand-in as wide as the marker, so the rows keep their geometry.
        segments.push(new Segment(drawable(options, this._continuationMarker, ">".padEnd(this._markerWidth)), markerStyle));
      }
      let indicator: { ch: string; style: Style } | undefined;
      if (i === 0 && canScrollUp) {
        indicator = { ch: drawable(options, "▲", "^"), style: indicatorStyle };
      } else if (i === visibleCount - 1 && canScrollDown) {
        indicator = { ch: drawable(options, "▼", "v"), style: indicatorStyle };
      }
      // When a continuation marker was emitted, the row's printable width is
      // reduced by the marker width — the indicator column is still at
      // `options.maxWidth - 1` in the panel's view, which is
      // `options.maxWidth - markerWidth - 1` columns past the marker.
      const rowPrintWidth: CellCol = row.isContinuation
        ? asCellCol(Math.max(0, options.maxWidth - this._markerWidth))
        : asCellCol(options.maxWidth);
      this._emitRowContent(
        segments,
        options,
        row,
        rowIdx === cursorRow && showCursor,
        contentStyle,
        cursorStyle,
        indicator,
        rowPrintWidth,
      );
    }
    // Trailing empty rows for minRows padding (no cursor, no marker).
    // Emit a whitespace segment of the full content width so Segment.splitLines
    // does not drop the row — an empty segment before a newline would produce
    // an invisible row that the renderer discards.
    for (let i = 0; i < padRows; i++) {
      segments.push(new Segment("\n"));
      segments.push(new Segment(setCellSize("", asCellCol(options.maxWidth)), contentStyle));
    }
    return segments;
  }

  // The caret's cell for the frame `options` draws: the blink restarted at the
  // last key, sampled at the frame's time (`shownAt`, so under reduced motion
  // it holds lit). Lit, the cell is the cursor's; dark, it is drawn as the
  // text around it, since the cursor is a colour pair and no attribute hides
  // it. The cell says when it next flips, which is when a host draws again.
  private _caret(at: string, cursorStyle: Style, contentStyle: Style, options: RenderOptions): Iterable<Segment> {
    const { value: lit, nextChange } = options.frameTime === undefined
      ? CARET_UNTIMED
      : shownAt(Timeline.run(Timeline.play(this._typedAt), CARET_BLINK), options.frameTime, options);
    return stampFrame([new Segment(at, lit ? cursorStyle : contentStyle)], nextChange);
  }

  // Whether `rows` visual rows draw a scroll arrow in the last cell of a row.
  private _drawsArrows(rows: number): boolean {
    return this._scrollIndicator === "arrows" && this._maxRows !== undefined && rows > this._maxRows;
  }

  private _emitRowContent(
    out: Segment[],
    options: RenderOptions,
    row: VisualRow,
    cursorOnRow: boolean,
    contentStyle: Style,
    cursorStyle: Style,
    indicator?: { ch: string; style: Style },
    rowPrintWidth?: CellCol,
  ): void {
    const shown = this._shown(row.content, options);
    // An indicator's cells are reserved at the end of the row, so wide glyphs
    // never collide with it: the content is cut to the cells before it and
    // padded out to them. With no indicator the wrapper pads the row.
    const contentCellWidth = indicator === undefined
      ? Infinity
      : Math.max(0, rowPrintWidth! - cellLen(indicator.ch));
    const display = indicator === undefined
      ? shown
      : setCellSize(splitText(shown, asCellCol(contentCellWidth))[0], asCellCol(contentCellWidth));
    // cursorPosition and valueStart are both cluster boundaries, so the
    // cursor's offset into the row is one too, and the shown cells before it
    // are its column.
    const cursorCell = cursorOnRow
      ? cellLen(this._shown(row.content.slice(0, this.cursorPosition - row.valueStart), options))
      : -1;

    if (cursorCell >= 0 && cursorCell < contentCellWidth) {
      const [before, rest] = splitText(display, asCellCol(cursorCell));
      const firstCh = rest.slice(0, nextGrapheme(rest, asCodePoint(0)));
      const at = firstCh || " ";
      const after = rest.slice(firstCh.length);
      if (before.length > 0) out.push(new Segment(before, contentStyle));
      out.push(...this._caret(at, cursorStyle, contentStyle, options));
      if (after.length > 0) out.push(new Segment(after, contentStyle));
    } else if (display.length > 0) {
      out.push(new Segment(display, contentStyle));
    }
    if (indicator !== undefined) out.push(new Segment(indicator.ch, indicator.style));
  }

  private _computeVisualRows(options: RenderOptions): VisualRow[] {
    const firstWidth = asCellCol(Math.max(1, options.maxWidth));
    const continuationWidth = asCellCol(Math.max(1, firstWidth - this._markerWidth));
    const shownAs = this._shownAs(options);

    const rows: VisualRow[] = [];
    const lines = this.value.split("\n");
    let pos = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      if (this._wrap !== undefined) {
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
        const wrapRows = this._wrap(shownLine, { firstWidth, continuationWidth });
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
   * the total visual row count. Reads cached state populated by the most
   * recent `render()` — call from a `Panel.bottomRightAccessory` thunk so
   * it evaluates after content has been rendered for the current frame;
   * `BorderAccessory` names the widths where it has not.
   *
   * Returns `undefined` when:
   *   - `scrollIndicator` is not `"indices"`, or
   *   - `maxRows` is unset, or total visual rows ≤ maxRows (nothing to
   *     scroll), or
   *   - no render has happened yet (cache is empty).
   */
  get scrollIndicatorText(): string | undefined {
    if (this._scrollIndicator !== "indices") return undefined;
    if (this._maxRows === undefined) return undefined;
    const rows = this._visualRows;
    if (rows === null || rows.length <= this._maxRows) return undefined;
    const cursorRow1 = this._cursorVisualRow() + 1;
    return `[${cursorRow1}/${rows.length}]`;
  }
}
