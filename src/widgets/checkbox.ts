/**
 * Checkbox widget — boolean toggle with label.
 * [LAW:dataflow-not-control-flow] one Segment of fixed width every render;
 * the indicator character and style come from observable state.
 * [LAW:one-type-per-behavior] shared widget infrastructure lives on WidgetBase.
 *
 * Visual states:
 *   unchecked — "[ ] label"
 *   checked   — "[✓] label"  (ASCII fallback "[x] label" when options.asciiOnly)
 *   focused   — underline on the rendered segment (no width change)
 *   disabled  — dimmed
 */

import { observable, action, observableRef } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { cellLen } from "../core/cells.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import { drawable, type RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import { ink } from "./ink.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

export interface CheckboxOptions {
  label: string;
  checked?: boolean;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

export class Checkbox extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable accessor checked: boolean;

  // [LAW:types-are-the-program] @observableRef so setTheme() triggers a
  // re-render — see slider.ts.
  @observableRef private accessor _theme: TerminalTheme;

  constructor(options: CheckboxOptions) {
    super();
    this.id = options.id ?? `checkbox-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.checked = options.checked ?? false;
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  @action
  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "space") {
      this.checked = !this.checked;
      this.emitChange();
      event.stop();
      return;
    }
    if (event.key === "enter") {
      this.emitSubmit();
      event.stop();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    // A release that dragged off the checkbox cancels the press.
    if (event.type === "mouse_up" && event.over) {
      this.checked = !this.checked;
      this.emitChange();
    }
  }

  // --- Rendering ---

  protected draw(options: RenderOptions): Iterable<Segment> {
    const indicator = this.checked ? drawable(options, "✓", "x") : " ";
    const text = `[${indicator}] ${this.label}`;

    if (this.disabled) {
      return [new Segment(text, new Style({ color: "#666666", bgcolor: "#333333", dim: true }))];
    }

    const colors = ink(this._theme, this.checked ? "primary" : "foreground", "background");
    return [new Segment(text, new Style({ ...colors, underline: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen — see button.ts.
    const width = cellLen(this.label) + 4;
    return { minimum: width, maximum: width };
  }
}
