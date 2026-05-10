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
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
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

  private _theme: TerminalTheme;

  constructor(options: CheckboxOptions) {
    super();
    this.id = options.id ?? `checkbox-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.checked = options.checked ?? false;
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "space") {
      this.checked = !this.checked;
      this.emitChange();
      return;
    }
    if (event.key === "enter") {
      this.emitSubmit();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type === "mouse_up") {
      this.checked = !this.checked;
      this.emitChange();
    }
  }

  // --- Hover/active mutators (router fast-path uses setHovered) ---

  @action
  setHovered(value: boolean): void { this.hovered = value; }

  // --- Rendering ---

  render(options: RenderOptions): Iterable<Segment> {
    const indicator = this.checked ? (options.asciiOnly ? "x" : "✓") : " ";
    const text = `[${indicator}] ${this.label}`;

    if (this.disabled) {
      return [new Segment(text, new Style({ color: "#666666", bgcolor: "#333333", dim: true }))];
    }

    const fg = this.checked ? this.resolvePalette("primary") : this.resolvePalette("foreground");
    return [new Segment(text, new Style({ color: fg, underline: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const width = this.label.length + 4;
    return { minimum: width, maximum: width };
  }

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys; missing is a construction bug.
    return ColorSpec.fromRgba(rgba!);
  }
}
