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
import { cellLen } from "../core/cells.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

/**
 * A soft-wrap strategy. Given one logical line of text and width budgets,
 * return the visual sub-rows that line wraps into. The first sub-row uses
 * `firstWidth` as its capacity; every subsequent (continuation) sub-row uses
 * `continuationWidth` (typically `firstWidth - cellLen(continuationMarker)`).
 *
 * Each returned row carries:
 *   - `content` — the displayed text for that visual row (the widget prepends
 *     the continuation marker itself; the strategy never includes it).
 *   - `start`   — byte offset into the *logical line* where `content` begins,
 *     so the widget can map visual positions back to absolute `value` offsets
 *     for cursor projection.
 *
 * [LAW:types-are-the-program] The strategy returns visual rows directly
 * rather than break points or token streams — the widget then consumes a
 * uniform `VisualRow` shape regardless of which strategy produced it,
 * collapsing all wrap-policy variability into one boundary.
 *
 * Built-in: `charGreedyWrap` (break at any character at the width limit).
 * Custom: any function matching this signature. Template-aware wrapping
 * (break at `{{ }}` atoms, e.g.) is provided by consumers that know the
 * value's domain syntax — the widget stays domain-neutral.
 */
export type WrapStrategy = (
  logicalLine: string,
  budget: { firstWidth: number; continuationWidth: number },
) => readonly WrapRow[];

export interface WrapRow {
  readonly content: string;
  readonly start: number;
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
  readonly valueStart: number;
  readonly isContinuation: boolean;
}

/**
 * Character-greedy soft wrap. Breaks at any character once `firstWidth`
 * (or `continuationWidth` for continuation rows) is exhausted. The textarea
 * default when a consumer says "wrap, I don't care how" — no syntax
 * awareness, just fits the line to the width.
 */
export const charGreedyWrap: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
  if (line.length === 0) return [{ content: "", start: 0 }];
  const rows: WrapRow[] = [];
  let pos = 0;
  let isFirst = true;
  while (pos < line.length) {
    const cap = isFirst ? firstWidth : continuationWidth;
    if (cap <= 0) break;
    const take = Math.min(cap, line.length - pos);
    rows.push({ content: line.slice(pos, pos + take), start: pos });
    pos += take;
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
}

const MIN_CONTENT_WIDTH = 8;
// Visible placeholder for a `\n` in the rendered single-line view. Picked so
// the cursor's 1:1 char-index ↔ display-column mapping is preserved — every
// raw char in `value` (newlines included) shows as exactly one cell.
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
  @observable accessor cursorPosition: number;
  @observable.ref accessor placeholder: string;

  private _theme: TerminalTheme;
  private readonly _maxLength: number | undefined;
  private readonly _password: boolean;
  private readonly _multiline: boolean;
  private readonly _wrap: WrapStrategy | undefined;
  private readonly _continuationMarker: string;
  private readonly _markerWidth: number;
  private readonly _maxRows: number | undefined;
  private readonly _minRows: number | undefined;

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

  // [LAW:types-are-the-program] `_preferredColumn` exists because vertical
  // motion needs to remember "what column the user *intended*" even after
  // passing through a short line that clamped them right. Reset to null on
  // every non-vertical motion or edit so the next Up/Down captures a fresh
  // intent. Without this, Down through a short line then back Up would
  // land at the short-line column instead of the original.
  private _preferredColumn: number | null = null;

  // Single-slot kill buffer used by Ctrl+U / Ctrl+K → Ctrl+Y. Not a full
  // kill ring (no Alt+Y rotation) — sufficient for the common cut/paste
  // pattern that's the readline 90% case.
  private _killBuffer: string = "";

  readonly multiline: boolean;

  constructor(options: TextInputOptions = {}) {
    super();
    this.id = options.id ?? `text-input-${Math.random().toString(36).slice(2, 8)}`;
    this.value = options.value ?? "";
    this.placeholder = options.placeholder ?? "";
    this.cursorPosition = this.value.length;
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
    this._maxLength = options.maxLength;
    this._password = options.password ?? false;
    this._multiline = options.multiline ?? false;
    this._wrap = options.wrap;
    this._continuationMarker = options.continuationMarker ?? "↳ ";
    this._markerWidth = cellLen(this._continuationMarker);
    this._maxRows = options.maxRows;
    this._minRows = options.minRows;
    this.multiline = this._multiline;
  }

  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;

    // ─── editing keys (modifier-conscious) ───
    if (event.key === "backspace") {
      if (event.meta || event.ctrl) return this.deleteWordBack();
      return this.deleteCharBack();
    }
    if (event.key === "delete") {
      return this.deleteCharForward();
    }
    if (event.key === "enter") {
      if (this._multiline && !event.ctrl) {
        this._insertText("\n");
        return;
      }
      this.emitSubmit();
      return;
    }
    if (event.key === "escape") return;

    // ─── unmodified motion ───
    if (!event.ctrl && !event.meta) {
      switch (event.key) {
        case "left":  return this.moveCharLeft();
        case "right": return this.moveCharRight();
        case "up":    return this.moveLineUp();
        case "down":  return this.moveLineDown();
        case "home":  return this.moveLineStart();
        case "end":   return this.moveLineEnd();
      }
    }

    // ─── Ctrl-modified motion + readline editing ───
    if (event.ctrl && !event.meta) {
      switch (event.key) {
        case "left":  return this.moveWordLeft();
        case "right": return this.moveWordRight();
        case "home":  return this.moveDocStart();
        case "end":   return this.moveDocEnd();
        case "a":     return this.moveLineStart();
        case "e":     return this.moveLineEnd();
        case "b":     return this.moveCharLeft();
        case "f":     return this.moveCharRight();
        case "p":     return this.moveLineUp();
        case "n":     return this.moveLineDown();
        case "d":     return this.deleteCharForward();
        case "h":     return this.deleteCharBack();
        case "w":     return this.deleteWordBack();
        case "u":     return this.killLineBack();
        case "k":     return this.killLineForward();
        case "y":     return this.yank();
        case "t":     return this.transposeChars();
      }
    }

    // ─── Alt-modified (meta) motion + editing ───
    if (event.meta && !event.ctrl) {
      switch (event.key) {
        case "left":  return this.moveWordLeft();
        case "right": return this.moveWordRight();
        case "b":     return this.moveWordLeft();
        case "f":     return this.moveWordRight();
        case "d":     return this.deleteWordForward();
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
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type !== "mouse_down") return;

    const b = this.bounds;
    if (!b) return;
    // Click position relative to the content area (skip the leading "[" bracket).
    const relX = event.x - b.x - 1;
    this.cursorPosition = Math.max(0, Math.min(this.value.length, relX));
    this._preferredColumn = null;
  }

  // --- Hover mutator (router fast-path) ---

  @action
  setHovered(value: boolean): void { this.hovered = value; }

  // ─── Public motion primitives ───────────────────────────────────────────

  @action moveCharLeft(): void {
    this.cursorPosition = Math.max(0, this.cursorPosition - 1);
    this._preferredColumn = null;
  }

  @action moveCharRight(): void {
    this.cursorPosition = Math.min(this.value.length, this.cursorPosition + 1);
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
      this.cursorPosition = target.valueStart + this._clampColForRow(col, rowIdx - 1);
      this._preferredColumn = col;
      return;
    }
    const lineStart = this._lineStart();
    if (lineStart === 0) return;
    const col = this._preferredColumn ?? (this.cursorPosition - lineStart);
    const prevLineEnd = lineStart - 1;
    let prevLineStart = prevLineEnd;
    while (prevLineStart > 0 && this.value[prevLineStart - 1] !== "\n") prevLineStart--;
    const prevLineLen = prevLineEnd - prevLineStart;
    this.cursorPosition = prevLineStart + Math.min(col, prevLineLen);
    this._preferredColumn = col;
  }

  @action moveLineDown(): void {
    if (this._visualRows !== null && this._visualRows.length > 1) {
      const rowIdx = this._cursorVisualRow();
      if (rowIdx === this._visualRows.length - 1) return;
      const col = this._preferredColumn ?? this._cursorVisualCol();
      this.cursorPosition = this._visualRows[rowIdx + 1]!.valueStart + this._clampColForRow(col, rowIdx + 1);
      this._preferredColumn = col;
      return;
    }
    const lineEnd = this._lineEnd();
    if (lineEnd === this.value.length) return;
    const lineStart = this._lineStart();
    const col = this._preferredColumn ?? (this.cursorPosition - lineStart);
    const nextLineStart = lineEnd + 1;
    let nextLineEnd = nextLineStart;
    while (nextLineEnd < this.value.length && this.value[nextLineEnd] !== "\n") nextLineEnd++;
    const nextLineLen = nextLineEnd - nextLineStart;
    this.cursorPosition = nextLineStart + Math.min(col, nextLineLen);
    this._preferredColumn = col;
  }

  // Clamp `col` to a target visual row's content length, accounting for
  // the wrap-boundary trap. When the row IS followed by a continuation of
  // the same logical line, the position `target.valueStart + target.length`
  // equals the next row's `valueStart` — i.e. a boundary that
  // `_cursorVisualRow` resolves to the *later* row. Landing there leaves
  // cursorPosition stuck at the boundary on every subsequent Up/Down, since
  // the clamp re-computes to the same value. Clamping to `length - 1`
  // instead keeps cursor strictly inside the target row.
  //
  // For rows NOT followed by a continuation (last row of a wrap, or any
  // non-wrapped logical line), allow end-of-line clamp (`length`) — there
  // is no later row to collide with at that position, only the `\n`
  // separator, so the boundary case doesn't apply.
  private _clampColForRow(col: number, targetIdx: number): number {
    const rows = this._visualRows!;
    const target = rows[targetIdx]!;
    const nextIsContinuation = targetIdx + 1 < rows.length && rows[targetIdx + 1]!.isContinuation;
    const cap = nextIsContinuation
      ? Math.max(0, target.content.length - 1)
      : target.content.length;
    return Math.min(col, cap);
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

  private _cursorVisualCol(): number {
    const rows = this._visualRows!;
    const idx = this._cursorVisualRow();
    return this.cursorPosition - rows[idx]!.valueStart;
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
    this.cursorPosition = 0;
    this._preferredColumn = null;
  }

  @action moveDocEnd(): void {
    this.cursorPosition = this.value.length;
    this._preferredColumn = null;
  }

  @action moveWordLeft(): void {
    let p = this.cursorPosition;
    while (p > 0 && !isWordChar(this.value[p - 1])) p--;
    while (p > 0 && isWordChar(this.value[p - 1])) p--;
    this.cursorPosition = p;
    this._preferredColumn = null;
  }

  @action moveWordRight(): void {
    let p = this.cursorPosition;
    while (p < this.value.length && !isWordChar(this.value[p])) p++;
    while (p < this.value.length && isWordChar(this.value[p])) p++;
    this.cursorPosition = p;
    this._preferredColumn = null;
  }

  // ─── Public editing primitives ──────────────────────────────────────────

  @action deleteCharBack(): void {
    if (this.cursorPosition === 0) return;
    this.value = this.value.slice(0, this.cursorPosition - 1) + this.value.slice(this.cursorPosition);
    this.cursorPosition -= 1;
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteCharForward(): void {
    if (this.cursorPosition >= this.value.length) return;
    this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(this.cursorPosition + 1);
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteWordBack(): void {
    // Readline `unix-word-rubout` semantics: delete back to nearest whitespace,
    // skipping trailing whitespace first so successive Ctrl+W at "foo bar |"
    // → "foo |" → "|" rather than getting stuck on the trailing space.
    let p = this.cursorPosition;
    while (p > 0 && isWhitespace(this.value[p - 1])) p--;
    while (p > 0 && !isWhitespace(this.value[p - 1])) p--;
    if (p === this.cursorPosition) return;
    this._killBuffer = this.value.slice(p, this.cursorPosition);
    this.value = this.value.slice(0, p) + this.value.slice(this.cursorPosition);
    this.cursorPosition = p;
    this._preferredColumn = null;
    this.emitChange();
  }

  @action deleteWordForward(): void {
    let p = this.cursorPosition;
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
    let p = this.cursorPosition;
    if (p === len) {
      this.value = this.value.slice(0, p - 2) + this.value[p - 1] + this.value[p - 2];
      this._preferredColumn = null;
      this.emitChange();
      return;
    }
    const a = this.value[p - 1]!;
    const b = this.value[p]!;
    this.value = this.value.slice(0, p - 1) + b + a + this.value.slice(p + 1);
    this.cursorPosition = p + 1;
    this._preferredColumn = null;
    this.emitChange();
  }

  // ─── Internal helpers ───────────────────────────────────────────────────

  private _lineStart(): number {
    let p = this.cursorPosition;
    while (p > 0 && this.value[p - 1] !== "\n") p--;
    return p;
  }

  private _lineEnd(): number {
    let p = this.cursorPosition;
    while (p < this.value.length && this.value[p] !== "\n") p++;
    return p;
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
    this.cursorPosition += toInsert.length;
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
    // mode (password / placeholder / plain); a stray newline in a *single-
    // line* value maps to a visible glyph so cursor-position math against
    // `value.length` stays valid without a special branch here.
    const rawDisplay = showPlaceholder
      ? this.placeholder
      : this._password
        ? "•".repeat(this.value.length)
        : this.value.indexOf("\n") >= 0
          ? this.value.replace(/\n/g, NEWLINE_GLYPH)
          : this.value;

    const maxAvailable = Math.max(MIN_CONTENT_WIDTH, options.maxWidth - 2);
    const desiredWidth = Math.max(MIN_CONTENT_WIDTH, rawDisplay.length, this.cursorPosition + 1);
    const contentWidth = Math.min(maxAvailable, desiredWidth);

    // Slide window to keep cursor visible when content overflows.
    const startIdx = Math.max(0, Math.min(rawDisplay.length - contentWidth, this.cursorPosition - contentWidth + 1));
    const sliced = rawDisplay.slice(Math.max(0, startIdx), Math.max(0, startIdx) + contentWidth);
    const display = sliced.padEnd(contentWidth, " ");
    const cursorDisplayIdx = this.cursorPosition - Math.max(0, startIdx);

    const bracketStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({ color: this.resolvePalette("foreground") });

    const contentStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : showPlaceholder
        ? new Style({ color: this.resolvePalette("foreground"), dim: true })
        : new Style({ color: this.resolvePalette("foreground") });

    const cursorStyle = new Style({
      color: this.resolvePalette("on-primary"),
      bgcolor: this.resolvePalette("primary"),
    });

    const segments: Segment[] = [new Segment("[", bracketStyle)];

    if (this.focused && !this.disabled && cursorDisplayIdx >= 0 && cursorDisplayIdx < contentWidth) {
      const before = display.slice(0, cursorDisplayIdx);
      const at = display.slice(cursorDisplayIdx, cursorDisplayIdx + 1);
      const after = display.slice(cursorDisplayIdx + 1);
      if (before.length > 0) segments.push(new Segment(before, contentStyle));
      segments.push(new Segment(at.length > 0 ? at : " ", cursorStyle));
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

    // Scroll window: clamp the visible range to `maxRows`, keeping the
    // cursor row in view. When `maxRows` is unset, render every row.
    const total = visualRows.length;
    const cursorRow = this._cursorVisualRow();
    let scrollStart = 0;
    let visibleCount = total;
    if (this._maxRows !== undefined && total > this._maxRows) {
      scrollStart = Math.max(0, Math.min(total - this._maxRows, cursorRow - this._maxRows + 1));
      visibleCount = this._maxRows;
    }
    // Pad with empty rows when the value is shorter than `minRows`.
    let padRows = 0;
    if (this._minRows !== undefined && total < this._minRows && this._maxRows === undefined) {
      padRows = this._minRows - total;
    }

    const contentStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({ color: this.resolvePalette("foreground") });
    const markerStyle = new Style({ color: this.resolvePalette("foreground"), dim: true });
    const cursorStyle = new Style({
      color: this.resolvePalette("on-primary"),
      bgcolor: this.resolvePalette("primary"),
    });

    const segments: Segment[] = [];
    const showCursor = this.focused && !this.disabled;
    for (let i = 0; i < visibleCount; i++) {
      const rowIdx = scrollStart + i;
      const row = visualRows[rowIdx]!;
      if (i > 0) segments.push(new Segment("\n"));
      if (row.isContinuation) {
        segments.push(new Segment(this._continuationMarker, markerStyle));
      }
      this._emitRowContent(segments, row, rowIdx === cursorRow && showCursor, contentStyle, cursorStyle);
    }
    // Trailing empty rows for minRows padding (no cursor, no marker).
    for (let i = 0; i < padRows; i++) {
      segments.push(new Segment("\n"));
    }
    return segments;
  }

  private _emitRowContent(
    out: Segment[],
    row: VisualRow,
    cursorOnRow: boolean,
    contentStyle: Style,
    cursorStyle: Style,
  ): void {
    const content = row.content;
    if (!cursorOnRow) {
      if (content.length > 0) out.push(new Segment(content, contentStyle));
      return;
    }
    const col = this.cursorPosition - row.valueStart;
    const before = content.slice(0, col);
    const at = content.slice(col, col + 1) || " ";
    const after = content.slice(col + 1);
    if (before.length > 0) out.push(new Segment(before, contentStyle));
    out.push(new Segment(at, cursorStyle));
    if (after.length > 0) out.push(new Segment(after, contentStyle));
  }

  private _computeVisualRows(maxWidth: number): VisualRow[] {
    const firstWidth = Math.max(1, maxWidth);
    const continuationWidth = Math.max(1, firstWidth - this._markerWidth);

    const rows: VisualRow[] = [];
    const lines = this.value.split("\n");
    let pos = 0;
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li]!;
      if (this._wrap !== undefined) {
        const wrapRows = this._wrap(line, { firstWidth, continuationWidth });
        if (wrapRows.length === 0) {
          rows.push({ content: "", valueStart: pos, isContinuation: false });
        } else {
          for (let ri = 0; ri < wrapRows.length; ri++) {
            const wr = wrapRows[ri]!;
            rows.push({
              content: wr.content,
              valueStart: pos + wr.start,
              isContinuation: ri > 0,
            });
          }
        }
      } else {
        rows.push({ content: line, valueStart: pos, isContinuation: false });
      }
      pos += line.length + 1; // +1 for the \n separator
    }
    return rows;
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const minimum = MIN_CONTENT_WIDTH + 2;
    const maximum = Math.max(minimum, Math.max(this.value.length, this.placeholder.length) + 2);
    return { minimum, maximum };
  }

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
