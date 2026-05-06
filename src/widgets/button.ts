/**
 * Button widget — labeled action trigger with variant styling.
 * [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
 * [LAW:one-type-per-behavior] shared widget infrastructure lives on WidgetBase.
 *
 * Four visual states:
 *   normal  — variant colors from theme semantic palette (muted)
 *   hover   — full variant accent color (brighter than muted)
 *   focus   — brackets [ label ] surrounding the button
 *   active  — color reversal (pressed)
 *
 * States compose: active > focus > hover > normal.
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

export type ButtonVariant = "default" | "primary" | "success" | "warning" | "danger";

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

const VARIANT_KEYS: Record<ButtonVariant, { bg: string; fg: string; hover: string }> = {
  default:  { bg: "surface",          fg: "foreground",    hover: "primary" },
  primary:  { bg: "primary-muted",    fg: "text-primary",  hover: "primary" },
  success:  { bg: "success-muted",    fg: "text-success",  hover: "success" },
  warning:  { bg: "warning-muted",    fg: "text-warning",  hover: "warning" },
  danger:   { bg: "error-muted",      fg: "text-error",    hover: "error" },
};

export class Button extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable.ref accessor variant: ButtonVariant;

  private _theme: TerminalTheme;

  constructor(options: ButtonOptions) {
    super();
    this.id = options.id ?? `button-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "enter" || event.key === "space") {
      this.active = true;
      this.emitSubmit();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type === "mouse_down") {
      this.active = true;
    }
    if (event.type === "mouse_up") {
      if (this.active) {
        this.active = false;
        this.emitSubmit();
      }
    }
  }

  // --- Hover/active mutators (router fast-path uses setHovered) ---

  @action
  setHovered(value: boolean): void { this.hovered = value; }

  @action
  setActive(value: boolean): void { this.active = value; }

  // --- Rendering ---

  render(_options: RenderOptions): Iterable<Segment> {
    // [LAW:dataflow-not-control-flow] same segment count and width every state
    const focused = this.focused;
    const left = focused ? "[" : " ";
    const right = focused ? "]" : " ";
    const text = `${left} ${this.label} ${right}`;

    if (this.disabled) {
      return [new Segment(text, new Style({ color: "#666666", bgcolor: "#333333", dim: true }))];
    }

    if (this.active) {
      const { fg, bg } = this.resolveColors("bg");
      return [new Segment(text, new Style({ color: bg, bgcolor: fg, bold: true }))];
    }

    if (this.hovered) {
      const fg = this.resolveFg();
      const bg = this.resolvePalette(VARIANT_KEYS[this.variant].hover);
      return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
    }

    const { fg, bg } = this.resolveColors("bg");
    return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const width = this.label.length + 4;
    return { minimum: width, maximum: width };
  }

  // --- Palette resolution ---

  private resolveColors(
    bgKey: "bg" | "hover",
  ): { fg: ColorSpec; bg: ColorSpec } {
    const keys = VARIANT_KEYS[this.variant];
    return {
      fg: this.resolvePalette(keys.fg),
      bg: this.resolvePalette(bgKey === "hover" ? keys.hover : keys.bg),
    };
  }

  private resolveFg(): ColorSpec {
    return this.resolvePalette(VARIANT_KEYS[this.variant].fg);
  }

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette is required and must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
