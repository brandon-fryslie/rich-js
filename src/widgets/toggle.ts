/**
 * Toggle widget — on/off switch with label and variant colour.
 * [LAW:dataflow-not-control-flow] one Segment of fixed width every render;
 * indicator and palette keys come from observable state via lookup tables.
 * [LAW:one-type-per-behavior] shared infrastructure inherited from WidgetBase.
 *
 * Visual states:
 *   off       — "[OFF] label" with muted variant background
 *   on        — "[ON]  label" with full variant accent background
 *   focused   — underline on the segment (no width change)
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

export type ToggleVariant = "default" | "primary" | "success" | "warning" | "danger";

export interface ToggleOptions {
  label: string;
  on?: boolean;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
  variant?: ToggleVariant;
}

const VARIANT_KEYS: Record<
  ToggleVariant,
  { onBg: string; onFg: string; offBg: string; offFg: string }
> = {
  default: { onBg: "primary", onFg: "text-primary", offBg: "surface",       offFg: "foreground" },
  primary: { onBg: "primary", onFg: "text-primary", offBg: "primary-muted", offFg: "text-primary" },
  success: { onBg: "success", onFg: "text-success", offBg: "success-muted", offFg: "text-success" },
  warning: { onBg: "warning", onFg: "text-warning", offBg: "warning-muted", offFg: "text-warning" },
  danger:  { onBg: "error",   onFg: "text-error",   offBg: "error-muted",   offFg: "text-error" },
};

export class Toggle extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable accessor on: boolean;
  @observable.ref accessor variant: ToggleVariant;

  private _theme: TerminalTheme;

  constructor(options: ToggleOptions) {
    super();
    this.id = options.id ?? `toggle-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.on = options.on ?? false;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "space") {
      this.on = !this.on;
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
      this.on = !this.on;
      this.emitChange();
    }
  }

  // --- Hover mutator (router fast-path) ---

  @action
  setHovered(value: boolean): void { this.hovered = value; }

  // --- Rendering ---

  render(_options: RenderOptions): Iterable<Segment> {
    // Both indicators are exactly 5 cells: "[ON] " and "[OFF]".
    const indicator = this.on ? "[ON] " : "[OFF]";
    const text = `${indicator} ${this.label}`;

    if (this.disabled) {
      return [new Segment(text, new Style({ color: "#666666", bgcolor: "#333333", dim: true }))];
    }

    const keys = VARIANT_KEYS[this.variant];
    const fg = this.resolvePalette(this.on ? keys.onFg : keys.offFg);
    const bg = this.resolvePalette(this.on ? keys.onBg : keys.offBg);

    return [new Segment(text, new Style({ color: fg, bgcolor: bg, underline: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const width = 5 + 1 + this.label.length;
    return { minimum: width, maximum: width };
  }

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys; missing is a construction bug.
    return ColorSpec.fromRgba(rgba!);
  }
}
