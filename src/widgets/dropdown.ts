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
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent, OverlayRenderable } from "./types.js";

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

  // [LAW:single-enforcer] All filter writes go through setFilter(); it owns
  // both the filter value and the highlightedIndex reset.
  @action
  private setFilter(value: string): void {
    this.filter = value;
    this.highlightedIndex = 0;
  }

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

  private _theme: TerminalTheme;

  constructor(options: DropdownOptions) {
    super();
    this.id = options.id ?? `dropdown-${Math.random().toString(36).slice(2, 8)}`;
    this.options = [...options.options];
    this.selectedIndex = options.selectedIndex ?? 0;
    this.highlightedIndex = this.selectedIndex;
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

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
        return;
      }
      // Any other printable char auto-expands and starts filtering.
      if (isPrintable) {
        this.expanded = true;
        this.setFilter(this.filter + event.character);
      }
      return;
    }

    // expanded
    switch (event.key) {
      case "up":
        this.highlightedIndex = Math.max(0, this.highlightedIndex - 1);
        return;
      case "down": {
        const max = Math.max(0, this.filteredOptions.length - 1);
        this.highlightedIndex = Math.min(max, this.highlightedIndex + 1);
        return;
      }
      case "enter": {
        // [LAW:one-source-of-truth] Map filtered position → canonical idx.
        // No-op when filteredOptions is empty (highlighted is undefined).
        const picked = this.filteredOptions[this.highlightedIndex];
        if (picked === undefined) return;
        this.selectedIndex = picked.idx;
        this.setFilter("");
        this.expanded = false;
        this.emitChange();
        this.emitSubmit();
        return;
      }
      case "escape":
        // Single-step: clear filter + collapse.
        this.setFilter("");
        this.expanded = false;
        return;
      case "backspace":
        // [LAW:dataflow-not-control-flow] slice(0,-1) on "" is "" — no guard.
        this.setFilter(this.filter.slice(0, -1));
        return;
    }

    if (isPrintable) {
      this.setFilter(this.filter + event.character);
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
      this.setFilter("");
      this.expanded = false;
      return;
    }
    const rowOffset = event.y - b.y;
    if (rowOffset === 0) {
      // Click the header → collapse + clear filter, no selection change.
      this.setFilter("");
      this.expanded = false;
      return;
    }
    // [LAW:one-source-of-truth] Filtered position → canonical idx.
    const picked = this.filteredOptions[rowOffset - 1];
    if (picked === undefined) return;
    this.selectedIndex = picked.idx;
    this.setFilter("");
    this.expanded = false;
    this.emitChange();
    this.emitSubmit();
  }

  // --- Hover mutator (router fast-path) ---

  @action
  setHovered(value: boolean): void { this.hovered = value; }

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
  private headerText(maxLabelLen: number): string {
    if (this.filter === "") {
      return (this.options[this.selectedIndex] ?? "").padEnd(maxLabelLen, " ");
    }
    const cursor = this.focused ? "│" : "";
    const filterRoom = Math.max(0, maxLabelLen - cursor.length);
    const filterText = this.filter.slice(0, filterRoom);
    return (filterText + cursor).padEnd(maxLabelLen, " ");
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
    const text = "(no matches)".slice(0, maxLabelLen).padEnd(maxLabelLen, " ");
    const inner = ` ${text} `;
    const style = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({
          color: this.resolvePalette("foreground"),
          bgcolor: this.resolvePalette("surface"),
          dim: true,
        });
    return [
      new Segment("[", style),
      new Segment(inner, style),
      new Segment("]", style),
    ];
  }

  private renderOptionRow(
    entry: { label: string; idx: number },
    fpos: number,
    maxLabelLen: number,
  ): Segment[] {
    // Row: "[ " + label.padEnd(maxLabelLen) + " ]"
    // Width = 1 + 1 + maxLabelLen + 1 + 1 = maxLabelLen + 4.
    const label = entry.label.padEnd(maxLabelLen, " ");
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
      new Segment("[", rowStyle),
      new Segment(inner, rowStyle),
      new Segment("]", rowStyle),
    ];
  }

  private maxLabelLen(): number {
    let m = 0;
    for (const label of this.options) if (label.length > m) m = label.length;
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
