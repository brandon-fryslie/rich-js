/**
 * Dropdown widget — single-select from option list.
 * [LAW:dataflow-not-control-flow] each render emits a fixed segment-shape
 * for collapsed (1 row) or expanded (1 + N rows). The expanded flag is
 * data; Screen re-runs computeFrame on the @observable change so widgets
 * below shift down naturally.
 * [LAW:single-enforcer] Screen owns vertical layout; Dropdown emits row
 * segments separated by "\n" and Screen splits via Segment.splitLines.
 *
 * Visual states:
 *   collapsed — "[ selected ▾ ]"  (ASCII fallback "v")
 *   expanded  — header row + N option rows; highlighted option uses
 *               primary-muted bg, selected option uses primary bg.
 *   focused   — underline on the segments (no width change)
 *   disabled  — dimmed
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { cellLen, setCellSize } from "../core/cells.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

export interface DropdownOptions {
  options: string[];
  selectedIndex?: number;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

export class Dropdown extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable.shallow accessor options: string[];
  @observable accessor selectedIndex: number;
  @observable accessor expanded: boolean = false;
  @observable accessor highlightedIndex: number;

  // [LAW:dataflow-not-control-flow] theme is observable.ref so render() reads
  // it as a reactive dependency; setTheme triggers the screen's autorun.
  @observable.ref private accessor _theme: TerminalTheme;

  constructor(options: DropdownOptions) {
    super();
    // [LAW:types-are-the-program] A Dropdown with zero options is an illegal
    // state — `selectedIndex` has no valid value and navigation paths
    // (Math.min(options.length - 1, ...)) can produce -1. Forbid it at the
    // constructor edge so every callsite downstream can assume non-empty.
    if (options.options.length === 0) {
      throw new RangeError("Dropdown requires at least one option");
    }
    this.id = options.id ?? `dropdown-${Math.random().toString(36).slice(2, 8)}`;
    this.options = [...options.options];
    const initialIdx = options.selectedIndex ?? 0;
    if (initialIdx < 0 || initialIdx >= this.options.length) {
      throw new RangeError(
        `Dropdown selectedIndex ${initialIdx} is out of range (0..${this.options.length - 1})`,
      );
    }
    this.selectedIndex = initialIdx;
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

    if (!this.expanded) {
      if (event.key === "enter" || event.key === "space") {
        this.expanded = true;
        this.highlightedIndex = this.selectedIndex;
      }
      return;
    }

    // expanded
    switch (event.key) {
      case "up":
        this.highlightedIndex = Math.max(0, this.highlightedIndex - 1);
        return;
      case "down":
        this.highlightedIndex = Math.min(this.options.length - 1, this.highlightedIndex + 1);
        return;
      case "enter":
        this.selectedIndex = this.highlightedIndex;
        this.expanded = false;
        this.emitChange();
        this.emitSubmit();
        return;
      case "escape":
        this.expanded = false;
        return;
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

    // expanded: row 0 is the header; rows 1..N are options.
    if (!inside) {
      this.expanded = false;
      return;
    }
    const rowOffset = event.y - b.y;
    if (rowOffset === 0) {
      // Click the header → collapse without change.
      this.expanded = false;
      return;
    }
    const optionIdx = rowOffset - 1;
    if (optionIdx >= 0 && optionIdx < this.options.length) {
      this.selectedIndex = optionIdx;
      this.expanded = false;
      this.emitChange();
      this.emitSubmit();
    }
  }

  // --- Rendering ---

  render(options: RenderOptions): Iterable<Segment> {
    const arrowChar = options.asciiOnly ? "v" : "▾";
    const maxLabelLen = this.maxLabelLen();
    const segments: Segment[] = [];

    const baseStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({
          color: this.resolvePalette("foreground"),
          bgcolor: this.resolvePalette("surface"),
          underline: this.focused,
        });

    // Header: "[" + label (padded to maxLabelLen cells) + " " + arrow + "]"
    // Width = 1 + maxLabelLen + 1 + 1 + 1 = maxLabelLen + 4.
    const headerLabel = setCellSize(this.options[this.selectedIndex] ?? "", maxLabelLen);
    segments.push(new Segment("[", baseStyle));
    segments.push(new Segment(`${headerLabel} ${arrowChar}`, baseStyle));
    segments.push(new Segment("]", baseStyle));

    if (this.expanded) {
      for (let i = 0; i < this.options.length; i++) {
        segments.push(new Segment("\n", baseStyle));
        segments.push(...this.renderOptionRow(i, maxLabelLen));
      }
    }

    return segments;
  }

  private renderOptionRow(idx: number, maxLabelLen: number): Segment[] {
    // Row: "[ " + label (padded to maxLabelLen cells) + " ]"
    // Width = 1 + 1 + maxLabelLen + 1 + 1 = maxLabelLen + 4.
    const label = setCellSize(this.options[idx] ?? "", maxLabelLen);
    const inner = ` ${label} `;

    const isSelected = idx === this.selectedIndex;
    const isHighlighted = idx === this.highlightedIndex;

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
