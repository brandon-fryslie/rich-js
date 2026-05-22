/**
 * TextInput widget — editable text field with cursor.
 *
 * Two modes:
 *   - single-line (default): Enter submits; newlines in value are rendered
 *                            as a literal `↵` glyph if they ever appear.
 *   - multi-line  (`multiline: true`): Enter inserts a `\n`; `value` may
 *                            contain logical line breaks; Up/Down navigate
 *                            between logical lines preserving column intent.
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
 * `CodeUnit`). `cursorPosition` is `CodePoint`; it is never inside a surrogate
 * pair by construction. Visual positions are `CellCol`. The three are never
 * interchangeable — the type system enforces this at every crossing point.
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

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import {
  cellLen,
  setCellSize,
  splitText,
  cellFit,
  cellColToCodeUnitOffset,
  asCellCol,
  asCodePoint,
  nextCodePoint,
  prevCodePoint,
  type CellCol,
  type CodePoint,
} from "../core/cells.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

/**
 * A soft-wrap strategy. Given one logical line of text and cell-width budgets,
 * return the visual sub-rows that line wraps into. The first sub-row uses
 * `firstWidth` as its capacity; every subsequent (continuation) sub-row uses
 * `continuationWidth` (typically `firstWidth - cellLen(continuationMarker)`).
 *
 * Each returned row carries:
 *   - `content` — the displayed text for that visual row (the widget prepends
 *     the continuation marker itself; the strategy never includes it).
 *   - `start`   — code-unit offset into the *logical line* where `content`
 *     begins, so the widget can map visual positions back to absolute `value`
 *     offsets for cursor projection.
 *
 * [LAW:types-are-the-program] Budget params are `CellCol`; `start` is
 * `CodePoint` (a `CodeUnit` on a code-point boundary) — the type system
 * prevents mixing these integer spaces inside a custom strategy.
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
  readonly content: string;
  /** Code-point offset into the logical line where `content` begins. */
  readonly start: CodePoint;
}

/**
 * Internal: a visual row in the widget's render, with offsets absolute to
 * `value` (not the logical line a wrap strategy sees). Cached on `render()`
 * and consumed by `moveLineUp` / `moveLineDown` so vertical motion follows
 * what's actually on screen — not what the logical-line model would do in
 * the absence of wrap.
 */
interface VisualRow {
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
 * straddle the budget is moved to the next row rather than split. When the
 * budget is too narrow to fit even one character, that character is
 * force-taken to guarantee progress (avoids an infinite loop).
 */
export const charGreedyWrap: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
  if (line.length === 0) return [{ content: "", start: asCodePoint(0) }];
  const rows: WrapRow[] = [];
  let pos = 0;
  let isFirst = true;
  while (pos < line.length) {
    const cap = isFirst ? firstWidth : continuationWidth;
    if (cap <= 0) break;
    let take = cellFit(line.slice(pos), cap);
    if (take.length === 0) {
      // Leading character exceeds cap — force-take one code point to guarantee
      // progress when the terminal is extremely narrow.
      for (const ch of line.slice(pos)) { take = ch; break; }
      if (take.length === 0) break;
    }
    // pos advances by take.length — cellFit uses for...of (code-point iteration)
    // so pos always lands on a code-point boundary.
    rows.push({ content: take, start: asCodePoint(pos) });
    pos += take.length;
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
const NEWLINE_GLYPH = "↵";

// Word-character regex used by Alt+B/F and Ctrl+Left/Right. Matches the
// readline default (alphanumeric + underscore), which is what users typing
// shell commands or code identifiers expect.
const WORD_CHAR_RE = /[A-Za-z0-9_]/;
const WHITESPACE_RE = /\s/;

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && WORD_CHAR_RE.test(c);
}

function isWhitespace(c: string | undefined): boolean {
  return c !== undefined && WHITESPACE_RE.test(c);
}

export class TextInput extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor value: string;
  @observable accessor cursorPosition: CodePoint;
  @observable.ref accessor placeholder: string;

  private _theme: TerminalTheme;
  private readonly _maxLength: number | undefined;
  private readonly _password: boolean;
  private readonly _multiline: boolean;
  private readonly _wrap: WrapStrategy | undefined;
  private readonly _continuationMarker: string;
  private readonly _markerWidth: CellCol;
  private readonly _maxRows: number | undefined;
  private readonly _minRows: number | undefined;
  private readonly _scrollIndicator: "arrows" | "indices" | "none";
  @observable.ref accessor indicatorStyleOverride: Style | undefined;
  @observable.ref accessor cursorStyleOverride: Style | undefined;
  @observable.ref accessor contentStyleOverride: Style | undefined;

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

  readonly multiline: boolean;

  constructor(options: TextInputOptions = {}) {
    super();
    this.id = options.id ?? `text-input-${Math.random().toString(36).slice(2, 8)}`;
    this.value = options.value ?? "";
    this.placeholder = options.placeholder ?? "";
    // [LAW:dataflow-not-control-flow] Initial cursor position is data, not
    // a render-time branch. Single-line inputs follow the pre-filled-form
    // convention (cursor at end — typing continues the value). Multiline
    // inputs follow the textarea convention (cursor at start — pre-loaded
    // content is read top-to-bottom, and the viewport's "scroll into view"
    // logic does nothing because row 0 is already inside the initial window).
    this.cursorPosition = (options.multiline ?? false) ? asCodePoint(0) : asCodePoint(this.value.length);
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
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

  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
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
    // A single-char `event.character` with no command modifiers is text to
    // insert. Ctrl/meta-modified keys produce empty `character` from the
    // router (see event-router.ts) so they never reach this branch.
    if (
      event.character.length === 1 &&
      !event.ctrl &&
      !event.meta &&
      event.character >= " " &&
      event.character !== "\x7f"
    ) {
      this._insertText(event.character);
      event.stop();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type !== "mouse_down") return;

    const b = this.bounds;
    if (!b) return;
    // [LAW:types-are-the-program] relX is a cell-column offset; convert to
    // code-unit via the same display string _renderSingleLine produces so that
    // password bullets (1 cell/code-unit) and NEWLINE_GLYPH substitution
    // (also 1:1) yield correct positions for wide-char values.
    const relX = asCellCol(Math.max(0, event.x - b.x - 1));
    const displayForHitTest = this._password
      ? "•".repeat(this.value.length)
      : this.value.indexOf("\n") >= 0
        ? this.value.replace(/\n/g, NEWLINE_GLYPH)
        : this.value;
    this.cursorPosition = cellColToCodeUnitOffset(displayForHitTest, relX);
    this._preferredColumn = null;
  }

  // --- Hover mutator (router fast-path) ---

  @action
  override setHovered(value: boolean): void { this.hovered = value; }

  // ─── Public motion primitives ───────────────────────────────────────────

  @action moveCharLeft(): void {
    this.cursorPosition = prevCodePoint(this.value, this.cursorPosition);
    this._preferredColumn = null;
  }

  @action moveCharRight(): void {
    this.cursorPosition = nextCodePoint(this.value, this.cursorPosition);
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
      this.cursorPosition = asCodePoint(target.valueStart + this._clampColForRow(col, rowIdx - 1));
      this._preferredColumn = col;
      return;
    }
    const lineStart = this._lineStart();
    if (lineStart === 0) return;
    // Fallback: no render cache yet (ASCII-only assumption is acceptable here).
    const col = this._preferredColumn ?? asCellCol(this.cursorPosition - lineStart);
    const prevLineEnd = lineStart - 1;
    let prevLineStart: number = prevLineEnd;
    while (prevLineStart > 0 && this.value[prevLineStart - 1] !== "\n") prevLineStart--;
    const prevLineLen = prevLineEnd - prevLineStart;
    this.cursorPosition = asCodePoint(prevLineStart + Math.min(col, prevLineLen));
    this._preferredColumn = col;
  }

  @action moveLineDown(): void {
    if (this._visualRows !== null && this._visualRows.length > 1) {
      const rowIdx = this._cursorVisualRow();
      if (rowIdx === this._visualRows.length - 1) return;
      const col = this._preferredColumn ?? this._cursorVisualCol();
      this.cursorPosition = asCodePoint(this._visualRows[rowIdx + 1]!.valueStart + this._clampColForRow(col, rowIdx + 1));
      this._preferredColumn = col;
      return;
    }
    const lineEnd = this._lineEnd();
    if (lineEnd === this.value.length) return;
    const lineStart = this._lineStart();
    // Fallback: no render cache yet (ASCII-only assumption is acceptable here).
    const col = this._preferredColumn ?? asCellCol(this.cursorPosition - lineStart);
    const nextLineStart = lineEnd + 1;
    let nextLineEnd: number = nextLineStart;
    while (nextLineEnd < this.value.length && this.value[nextLineEnd] !== "\n") nextLineEnd++;
    const nextLineLen = nextLineEnd - nextLineStart;
    this.cursorPosition = asCodePoint(nextLineStart + Math.min(col, nextLineLen));
    this._preferredColumn = col;
  }

  // Clamp `col` (a cell column) to the target visual row's content, returning
  // the code-unit offset within that row. When the row IS followed by a
  // continuation of the same logical line, we clamp to one cell before the
  // end so the cursor stays strictly inside the target row — landing at the
  // boundary would cause `_cursorVisualRow` to resolve to the *later* row,
  // which makes every subsequent Up/Down stick at the boundary.
  //
  // For rows NOT followed by a continuation (last wrap row, or any unwrapped
  // logical line), the end-of-line position is valid — there is no adjacent
  // continuation row to collide with.
  private _clampColForRow(col: CellCol, targetIdx: number): CodePoint {
    const rows = this._visualRows!;
    const target = rows[targetIdx]!;
    const nextIsContinuation = targetIdx + 1 < rows.length && rows[targetIdx + 1]!.isContinuation;
    const contentCellWidth = asCellCol(cellLen(target.content));
    const capCells = nextIsContinuation
      ? asCellCol(Math.max(0, contentCellWidth - 1))
      : contentCellWidth;
    return cellColToCodeUnitOffset(target.content, asCellCol(Math.min(col, capCells)));
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
    return asCellCol(cellLen(row.content.slice(0, this.cursorPosition - row.valueStart)));
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
    this.cursorPosition = asCodePoint(0);
    this._preferredColumn = null;
  }

  @action moveDocEnd(): void {
    this.cursorPosition = asCodePoint(this.value.length);
    this._preferredColumn = null;
  }

  @action moveWordLeft(): void {
    let p: number = this.cursorPosition;
    while (p > 0 && !isWordChar(this.value[p - 1])) p--;
    while (p > 0 && isWordChar(this.value[p - 1])) p--;
    this.cursorPosition = asCodePoint(p);
    this._preferredColumn = null;
  }

  @action moveWordRight(): void {
    let p: number = this.cursorPosition;
    while (p < this.value.length && !isWordChar(this.value[p])) p++;
    while (p < this.value.length && isWordChar(this.value[p])) p++;
    this.cursorPosition = asCodePoint(p);
    this._preferredColumn = null;
  }

  // ─── Public editing primitives ──────────────────────────────────────────

  @action deleteCharBack(): void {
    if (this.cursorPosition === 0) return;
    const newPos = prevCodePoint(this.value, this.cursorPosition);
    this.value = this.value.slice(0, newPos) + this.value.slice(this.cursorPosition);
    this.cursorPosition = newPos;
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteCharForward(): void {
    if (this.cursorPosition >= this.value.length) return;
    const nextPos = nextCodePoint(this.value, this.cursorPosition);
    this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(nextPos);
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteWordBack(): void {
    // Readline `unix-word-rubout` semantics: delete back to nearest whitespace,
    // skipping trailing whitespace first so successive Ctrl+W at "foo bar |"
    // → "foo |" → "|" rather than getting stuck on the trailing space.
    let p: number = this.cursorPosition;
    while (p > 0 && isWhitespace(this.value[p - 1])) p--;
    while (p > 0 && !isWhitespace(this.value[p - 1])) p--;
    if (p === this.cursorPosition) return;
    this._killBuffer = this.value.slice(p, this.cursorPosition);
    this.value = this.value.slice(0, p) + this.value.slice(this.cursorPosition);
    this.cursorPosition = asCodePoint(p);
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteWordForward(): void {
    let p: number = this.cursorPosition;
    while (p < this.value.length && !isWordChar(this.value[p])) p++;
    while (p < this.value.length && isWordChar(this.value[p])) p++;
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
    const len = this.value.length;
    if (len < 2 || this.cursorPosition === 0) return;
    let p: number = this.cursorPosition;
    if (p === len) {
      this.value = this.value.slice(0, p - 2) + this.value[p - 1] + this.value[p - 2];
      this._preferredColumn = null;
      this.emitChange();
      return;
    }
    const a = this.value[p - 1]!;
    const b = this.value[p]!;
    this.value = this.value.slice(0, p - 1) + b + a + this.value.slice(p + 1);
    this.cursorPosition = asCodePoint(p + 1);
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
      if (room <= 0) return;
      if (toInsert.length > room) toInsert = toInsert.slice(0, room);
    }
    this.value =
      this.value.slice(0, this.cursorPosition) +
      toInsert +
      this.value.slice(this.cursorPosition);
    this.cursorPosition = asCodePoint(this.cursorPosition + toInsert.length);
    this._preferredColumn = null;
    this.emitChange();
  }

  // --- Rendering ---

  render(options: RenderOptions): Iterable<Segment> {
    if (this._multiline) return this._renderMultiline(options);
    return this._renderSingleLine(options);
  }

  private _renderSingleLine(options: RenderOptions): Segment[] {
    const showPlaceholder = this.focused && this.value.length === 0 && this.placeholder.length > 0;

    // [LAW:dataflow-not-control-flow] Single rawDisplay value derives from
    // mode (password / placeholder / plain). NEWLINE_GLYPH substitution maps
    // every code unit in value 1:1 to rawDisplay so cursorPosition (a code-
    // unit index) is a valid index into rawDisplay regardless of mode.
    const rawDisplay = showPlaceholder
      ? this.placeholder
      : this._password
        ? "•".repeat(this.value.length)
        : this.value.indexOf("\n") >= 0
          ? this.value.replace(/\n/g, NEWLINE_GLYPH)
          : this.value;

    // Measure in cell space — cursorPosition is a code-unit index; convert to
    // cell column for all viewport arithmetic.
    const rawCellWidth = asCellCol(cellLen(rawDisplay));
    const cursorCellCol = asCellCol(cellLen(rawDisplay.slice(0, this.cursorPosition)));
    const maxAvailable = asCellCol(Math.max(MIN_CONTENT_WIDTH, options.maxWidth - 2));
    const desiredWidth = asCellCol(Math.max(MIN_CONTENT_WIDTH, rawCellWidth, cursorCellCol + 1));
    const contentWidth = asCellCol(Math.min(maxAvailable, desiredWidth));

    // Slide viewport (in cells) to keep cursor visible when content overflows.
    const startCell = asCellCol(Math.max(0, Math.min(rawCellWidth - contentWidth, cursorCellCol - contentWidth + 1)));
    const [, afterStart] = splitText(rawDisplay, startCell);
    // splitText snaps backward when startCell falls mid-wide-char, so afterStart
    // may start 1 cell earlier than requested. actualStartCell is the real offset.
    const actualStartCell = asCellCol(rawCellWidth - cellLen(afterStart));
    const [visible] = splitText(afterStart, contentWidth);
    const display = setCellSize(visible, contentWidth);
    const cursorDisplayCellCol = asCellCol(cursorCellCol - actualStartCell);

    const bracketStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({ color: this.resolvePalette("foreground") });

    const contentStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : showPlaceholder
        ? new Style({ color: this.resolvePalette("foreground"), dim: true })
        : this.contentStyleOverride ?? new Style({ color: this.resolvePalette("foreground") });

    const cursorStyle = this.cursorStyleOverride ?? new Style({
      color: this.resolvePalette("on-primary"),
      bgcolor: this.resolvePalette("primary"),
    });

    const segments: Segment[] = [new Segment("[", bracketStyle)];

    if (this.focused && !this.disabled && cursorDisplayCellCol >= 0 && cursorDisplayCellCol < contentWidth) {
      const [before, rest] = splitText(display, cursorDisplayCellCol);
      let firstCh = "";
      for (const ch of rest) { firstCh = ch; break; }
      const at = firstCh || " ";
      const after = rest.slice(firstCh.length);
      if (before.length > 0) segments.push(new Segment(before, contentStyle));
      segments.push(new Segment(at, cursorStyle));
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
    const visualRows = this._computeVisualRows(options.maxWidth);
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

    const contentStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : this.contentStyleOverride ?? new Style({ color: this.resolvePalette("foreground") });
    const markerStyle = new Style({ color: this.resolvePalette("foreground"), dim: true });
    const cursorStyle = this.cursorStyleOverride ?? new Style({
      color: this.resolvePalette("on-primary"),
      bgcolor: this.resolvePalette("primary"),
    });

    // Scroll-direction arrows appear in the rightmost cell of the first/last
    // visible row, *only* when scroll is actually possible in that direction.
    // _emitRowContent reserves the indicator's cells so content never
    // collides with the arrow. Only emitted in `"arrows"` mode; other modes
    // leave the content area untouched and rely on the host to surface scroll
    // state externally (e.g. Panel border accessory).
    const scrollable = this._maxRows !== undefined && total > this._maxRows;
    const arrowsMode = this._scrollIndicator === "arrows";
    const canScrollUp = arrowsMode && scrollable && this._scrollStart > 0;
    const canScrollDown =
      arrowsMode && scrollable && this._scrollStart + this._maxRows! < total;
    const indicatorStyle = this.indicatorStyleOverride ?? new Style({ color: this.resolvePalette("primary") });

    const segments: Segment[] = [];
    const showCursor = this.focused && !this.disabled;
    for (let i = 0; i < visibleCount; i++) {
      const rowIdx = scrollStart + i;
      const row = visualRows[rowIdx]!;
      if (i > 0) segments.push(new Segment("\n"));
      if (row.isContinuation) {
        segments.push(new Segment(this._continuationMarker, markerStyle));
      }
      let indicator: { ch: string; style: Style } | undefined;
      if (i === 0 && canScrollUp) {
        indicator = { ch: "▲", style: indicatorStyle };
      } else if (i === visibleCount - 1 && canScrollDown) {
        indicator = { ch: "▼", style: indicatorStyle };
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
        row,
        rowIdx === cursorRow && showCursor,
        contentStyle,
        cursorStyle,
        indicator,
        rowPrintWidth,
      );
    }
    // Trailing empty rows for minRows padding (no cursor, no marker).
    for (let i = 0; i < padRows; i++) {
      segments.push(new Segment("\n"));
      const emptyRow: VisualRow = { content: "", valueStart: asCodePoint(this.value.length), isContinuation: false };
      this._emitRowContent(segments, emptyRow, false, contentStyle, cursorStyle, undefined, asCellCol(options.maxWidth));
    }
    return segments;
  }

  private _emitRowContent(
    out: Segment[],
    row: VisualRow,
    cursorOnRow: boolean,
    contentStyle: Style,
    cursorStyle: Style,
    indicator?: { ch: string; style: Style },
    rowPrintWidth?: CellCol,
  ): void {
    const content = row.content;
    // cursorCol is a code-unit offset into row.content; both cursorPosition
    // and valueStart are CodePoint, so their difference lands on a code-point
    // boundary within content and is safe for string slicing.
    const cursorCol: number = cursorOnRow ? this.cursorPosition - row.valueStart : -1;

    // Fast path: no indicator on this row. Let the wrapper pad to width.
    if (indicator === undefined) {
      if (!cursorOnRow) {
        if (content.length > 0) out.push(new Segment(content, contentStyle));
        return;
      }
      const before = content.slice(0, cursorCol);
      const nextCp = nextCodePoint(content, asCodePoint(cursorCol));
      const at = content.slice(cursorCol, nextCp) || " ";
      const after = content.slice(nextCp);
      if (before.length > 0) out.push(new Segment(before, contentStyle));
      out.push(new Segment(at, cursorStyle));
      if (after.length > 0) out.push(new Segment(after, contentStyle));
      return;
    }

    // Indicator path: reserve the indicator's cells at the end of the row so
    // wide characters never collide with it. Content fills [0, contentCellWidth)
    // cells; the indicator occupies the remaining cells.
    const indicatorWidth = asCellCol(cellLen(indicator.ch));
    const contentCellWidth = asCellCol(Math.max(0, rowPrintWidth! - indicatorWidth));

    // Clip row content to the non-indicator region and pad to exact cell width.
    const [visibleContent] = splitText(content, contentCellWidth);
    const paddedContent = setCellSize(visibleContent, contentCellWidth);

    // Map the code-unit cursor offset to a cell column within this row.
    const cursorCellColInRow = cursorOnRow && cursorCol >= 0
      ? cellLen(content.slice(0, cursorCol))
      : -1;

    if (cursorCellColInRow >= 0 && cursorCellColInRow < contentCellWidth) {
      const [before, rest] = splitText(paddedContent, asCellCol(cursorCellColInRow));
      let firstCh = "";
      for (const ch of rest) { firstCh = ch; break; }
      const at = firstCh || " ";
      const after = rest.slice(firstCh.length);
      if (before.length > 0) out.push(new Segment(before, contentStyle));
      out.push(new Segment(at, cursorStyle));
      if (after.length > 0) out.push(new Segment(after, contentStyle));
    } else {
      if (paddedContent.length > 0) out.push(new Segment(paddedContent, contentStyle));
    }
    out.push(new Segment(indicator.ch, indicator.style));
  }

  private _computeVisualRows(maxWidth: number): VisualRow[] {
    const firstWidth = asCellCol(Math.max(1, maxWidth));
    const continuationWidth = asCellCol(Math.max(1, firstWidth - this._markerWidth));

    const rows: VisualRow[] = [];
    const lines = this.value.split("\n");
    let pos = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      if (this._wrap !== undefined) {
        const wrapRows = this._wrap(line, { firstWidth, continuationWidth });
        if (wrapRows.length === 0) {
          rows.push({ content: "", valueStart: asCodePoint(pos), isContinuation: false });
        } else {
          for (let ri = 0; ri < wrapRows.length; ri++) {
            const wr = wrapRows[ri]!;
            rows.push({
              content: wr.content,
              valueStart: asCodePoint(pos + wr.start),
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

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const minimum = MIN_CONTENT_WIDTH + 2;
    const maximum = Math.max(minimum, Math.max(cellLen(this.value), cellLen(this.placeholder)) + 2);
    return { minimum, maximum };
  }

  /**
   * `[X/Y]` scroll-position string when there's actually something to
   * scroll, else `undefined`. X is the cursor's 1-indexed visual row; Y is
   * the total visual row count. Reads cached state populated by the most
   * recent `render()` — call from a `Panel.bottomRightAccessory` thunk so
   * it evaluates after content has been rendered for the current frame.
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

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
