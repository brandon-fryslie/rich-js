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

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { cellLen } from "../core/cells.js";
import { drawable, type RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { ThemedWidget } from "./themed-widget.js";
import { ink } from "./ink.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

export interface CheckboxOptions {
  label: string;
  checked?: boolean;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

export class Checkbox extends ThemedWidget {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable accessor checked: boolean;

  constructor(options: CheckboxOptions) {
    super(options.theme);
    this.id = options.id ?? `checkbox-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.checked = options.checked ?? false;
    this.disabled = options.disabled ?? false;
  }

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
      return [new Segment(text, new Style(this.disabledInk))];
    }

    const colors = ink(this.theme, this.checked ? "text-primary" : "foreground", "background");
    return [new Segment(text, new Style({ ...colors, underline: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen — see button.ts.
    const width = cellLen(this.label) + 4;
    return { minimum: width, maximum: width };
  }
}
