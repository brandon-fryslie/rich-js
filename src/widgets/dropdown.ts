/**
 * Dropdown widget — single-select from option list, with built-in filter.
 *
 * [LAW:one-source-of-truth] Inline footprint (always 1 row, the header)
 * is independent of rendered shape (1 row collapsed, 1 + M rows expanded
 * where M = filteredOptions.length, or 1 when no matches). render() emits
 * the header row only; renderOverlay() emits option rows or a
 * "(no matches)" placeholder.
 *
 * [LAW:dataflow-not-control-flow] `expanded` and `filter` are data;
 * layout never reserves space for the option list; the overlay pass
 * paints over whatever is below.
 *
 * [LAW:one-source-of-truth] `options` and `selectedIndex` are canonical.
 * `filter` is internal view state. `filteredOptions` is the derived
 * subsequence (case-insensitive substring match). `highlightedIndex`
 * indexes into `filteredOptions`. Commit maps the filtered position
 * back to canonical idx by reference, so selection survives any filter
 * mutation.
 *
 * Width invariant: measure() always returns maxLabelLen(options) + 4
 * regardless of filter state — the query is right-clipped, never wider
 * than the header. See spec/widgets.md → Dropdown → Filtering.
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import { cellLen, setCellSize, splitText } from "../core/cells.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type {
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
  OverlayRenderable,
} from "./types.js";

export interface DropdownOptions {
  options: string[];
  selectedIndex?: number;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

export class Dropdown extends WidgetBase implements OverlayRenderable {
  readonly id: string;
  readonly focusable = true;

  @observable.shallow accessor options: string[];
  @observable accessor selectedIndex: number;
  @observable accessor expanded: boolean = false;
  @observable accessor highlightedIndex: number;
  @observable accessor filter: string = "";

  // [LAW:dataflow-not-control-flow] Derived view; empty filter falls out
  // naturally because "".includes("") is true for every label — no
  // special-case branch.
  get filteredOptions(): { label: string; idx: number }[] {
    const f = this.filter.toLowerCase();
    const result: { label: string; idx: number }[] = [];
    for (let i = 0; i < this.options.length; i++) {
      const label = this.options[i]!;
      if (label.toLowerCase().includes(f)) result.push({ label, idx: i });
    }
    return result;
  }

  // [LAW:types-are-the-program] @observable.ref so setTheme() triggers a
  // re-render — render() and resolvePalette() read _theme.palette, so the
  // theme reference must participate in MobX reactivity.
  @observable.ref private accessor _theme: TerminalTheme;

  constructor(options: DropdownOptions) {
    super();
    this.id = options.id ?? `dropdown-${Math.random().toString(36).slice(2, 8)}`;
    this.options = [...options.options];
    // [LAW:types-are-the-program] selectedIndex must point to a valid
    // option (or be 0 for the empty-options case). Clamp at the trust
    // boundary so headerText / render / commit logic can all assume
    // validity. Empty options is allowed — render falls back to an
    // empty label and commit is a no-op until options are populated.
    const requested = options.selectedIndex ?? 0;
    this.selectedIndex = this.options.length === 0
      ? 0
      : Math.max(0, Math.min(requested, this.options.length - 1));
    this.highlightedIndex = this.selectedIndex;
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  @action
  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;

    const isPrintable =
      event.character.length === 1 &&
      !event.ctrl &&
      !event.meta &&
      event.character >= " " &&
      event.character !== "\x7f";

    if (!this.expanded) {
      // enter/space remain the explicit "open with selection seeded" gesture.
      if (event.key === "enter" || event.key === "space") {
        this.expanded = true;
        this.highlightedIndex = this.selectedIndex;
        event.stop();
        return;
      }
      // Any other printable char auto-expands and starts filtering.
      if (isPrintable) {
        this.expanded = true;
        this.filter = this.filter + event.character;
        this.highlightedIndex = 0;
        event.stop();
      }
      return;
    }

    // expanded
    switch (event.key) {
      case "up":
        this.highlightedIndex = Math.max(0, this.highlightedIndex - 1);
        event.stop();
        return;
      case "down": {
        const max = Math.max(0, this.filteredOptions.length - 1);
        this.highlightedIndex = Math.min(max, this.highlightedIndex + 1);
        event.stop();
        return;
      }
      case "enter": {
        // [LAW:one-source-of-truth] Map filtered position → canonical idx.
        // No-op when filteredOptions is empty (highlighted is undefined).
        const picked = this.filteredOptions[this.highlightedIndex];
        event.stop();
        if (picked === undefined) return;
        this.selectedIndex = picked.idx;
        this.filter = "";
        this.expanded = false;
        this.emitChange();
        this.emitSubmit();
        return;
      }
      case "escape":
        // Single-step: clear filter + collapse.
        this.filter = "";
        this.expanded = false;
        event.stop();
        return;
      case "backspace":
        // [LAW:dataflow-not-control-flow] slice(0,-1) on "" is "" — no guard.
        this.filter = this.filter.slice(0, -1);
        this.highlightedIndex = 0;
        event.stop();
        return;
      case "tab":
        // First Tab while expanded cancels (clear filter + collapse) and
        // KEEPS focus on the dropdown. event.stop() halts the chain so
        // FocusManager's normal-priority Tab handler never runs — focus
        // traversal only happens on the *next* Tab press, when this widget
        // is collapsed and no longer stops the event. Shift direction is
        // ignored: both Tab and Shift+Tab cancel.
        this.filter = "";
        this.expanded = false;
        event.stop();
        return;
    }

    if (isPrintable) {
      this.filter = this.filter + event.character;
      this.highlightedIndex = 0;
      event.stop();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type !== "mouse_up") return;

    const b = this.bounds;
    if (!b) return;

    const inside =
      event.x >= b.x &&
      event.x < b.x + b.width &&
      event.y >= b.y &&
      event.y < b.y + b.height;

    if (!this.expanded) {
      if (inside) {
        this.expanded = true;
        this.highlightedIndex = this.selectedIndex;
      }
      return;
    }

    // expanded: row 0 is the header; rows 1..M are filtered options.
    if (!inside) {
      // Click outside cancels — clear filter + collapse.
      this.filter = "";
      this.expanded = false;
      return;
    }
    const rowOffset = event.y - b.y;
    if (rowOffset === 0) {
      // Click the header → collapse + clear filter, no selection change.
      this.filter = "";
      this.expanded = false;
      return;
    }
    // [LAW:one-source-of-truth] Filtered position → canonical idx.
    const picked = this.filteredOptions[rowOffset - 1];
    if (picked === undefined) return;
    this.selectedIndex = picked.idx;
    this.filter = "";
    this.expanded = false;
    this.emitChange();
    this.emitSubmit();
  }

  // [LAW:single-enforcer] FocusManager is the single dispatcher of focus
  // transitions; overriding handleFocus here catches every blur path (Tab
  // cycling, programmatic focus, unregister) so the overlay cannot outlive
  // the widget's focus. Collapse is the data; no separate "should I close"
  // branch lives at the router or elsewhere.
  @action
  override handleFocus(event: WidgetFocusEvent): void {
    super.handleFocus(event);
    if (event.type === "blur") {
      this.filter = "";
      this.expanded = false;
    }
  }

  // --- Rendering ---

  render(options: RenderOptions): Iterable<Segment> {
    // Header only — the inline footprint that flow layout sees. Always
    // 1 row regardless of `expanded`/`filter`. Option rows live in
    // renderOverlay. Width invariant: maxLabelLen + 4.
    const arrowChar = options.asciiOnly ? "v" : "▾";
    const maxLabelLen = this.maxLabelLen();

    const baseStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({
          color: this.resolvePalette("foreground"),
          bgcolor: this.resolvePalette("surface"),
          underline: this.focused,
        });

    const headerLabel = this.headerText(maxLabelLen);
    return [
      new Segment("[", baseStyle),
      new Segment(`${headerLabel} ${arrowChar}`, baseStyle),
      new Segment("]", baseStyle),
    ];
  }

  // [LAW:dataflow-not-control-flow] One header text function; the data
  // (filter empty vs not) chooses between selected-label and query+cursor.
  // Both branches yield exactly maxLabelLen cells — width invariant.
  // Selected label is centered; filter input is left-aligned so the caret
  // doesn't jitter horizontally while typing.
  //
  // [LAW:one-source-of-truth] All width math is in terminal cells via
  // cellLen / setCellSize / splitText — plain `.length` would miscount
  // wide / emoji characters and break the width invariant.
  private headerText(maxLabelLen: number): string {
    if (this.filter === "") {
      const raw = this.options[this.selectedIndex] ?? "";
      const w = cellLen(raw);
      if (w >= maxLabelLen) return setCellSize(raw, maxLabelLen);
      const pad = maxLabelLen - w;
      const left = Math.floor(pad / 2);
      const right = pad - left;
      return " ".repeat(left) + raw + " ".repeat(right);
    }
    const cursor = this.focused ? "│" : "";
    // Leading space gives the filter input a small gutter from the [ chrome,
    // matching the visual breathing room of the centered label.
    const filterRoom = Math.max(0, maxLabelLen - cellLen(cursor) - 1);
    const [filterText] = splitText(this.filter, filterRoom);
    return setCellSize(" " + filterText + cursor, maxLabelLen);
  }

  renderOverlay(_options: RenderOptions): Iterable<Segment> | null {
    if (!this.expanded) return null;
    const maxLabelLen = this.maxLabelLen();
    const fopts = this.filteredOptions;
    if (fopts.length === 0) return this.renderNoMatchRow(maxLabelLen);

    const segments: Segment[] = [];
    for (let i = 0; i < fopts.length; i++) {
      if (i > 0) segments.push(new Segment("\n"));
      segments.push(...this.renderOptionRow(fopts[i]!, i, maxLabelLen));
    }
    return segments;
  }

  private renderNoMatchRow(maxLabelLen: number): Segment[] {
    // Right-clipped + padded so width matches a normal option row.
    const text = setCellSize("(no matches)", maxLabelLen);
    const inner = ` ${text} `;
    const style = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({
          color: this.resolvePalette("foreground"),
          bgcolor: this.resolvePalette("surface"),
          dim: true,
        });
    return [
      new Segment(" ", style),
      new Segment(inner, style),
      new Segment(" ", style),
    ];
  }

  private renderOptionRow(
    entry: { label: string; idx: number },
    fpos: number,
    maxLabelLen: number,
  ): Segment[] {
    // Row: "  " + label.padEnd(maxLabelLen) + "  "
    // Width = 1 + 1 + maxLabelLen + 1 + 1 = maxLabelLen + 4.
    // Overlay rows are unbracketed — selection/highlight are conveyed by bg
    // color; the header keeps [ ] as its focus-indicator chrome.
    const label = setCellSize(entry.label, maxLabelLen);
    const inner = ` ${label} `;

    const isSelected = entry.idx === this.selectedIndex;
    const isHighlighted = fpos === this.highlightedIndex;

    // Highlighted: muted bg → text-primary (mostly-accent fg) is readable.
    // Selected:    full primary bg → on-primary (WCAG contrast) for fg.
    const rowStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : isHighlighted
        ? new Style({
            color: this.resolvePalette("text-primary"),
            bgcolor: this.resolvePalette("primary-muted"),
          })
        : isSelected
          ? new Style({
              color: this.resolvePalette("on-primary"),
              bgcolor: this.resolvePalette("primary"),
            })
          : new Style({
              color: this.resolvePalette("foreground"),
              bgcolor: this.resolvePalette("surface"),
            });

    return [
      new Segment(" ", rowStyle),
      new Segment(inner, rowStyle),
      new Segment(" ", rowStyle),
    ];
  }

  private maxLabelLen(): number {
    let m = 0;
    for (const label of this.options) {
      const w = cellLen(label);
      if (w > m) m = w;
    }
    return m;
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const width = this.maxLabelLen() + 4;
    return { minimum: width, maximum: width };
  }

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
