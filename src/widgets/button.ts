/**
 * Button widget — labeled action trigger with variant styling.
 * [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
 *
 * Four visual states:
 *   normal  — variant colors from theme semantic palette (muted)
 *   hover   — full variant accent color (brighter than muted)
 *   focus   — brackets [ label ] surrounding the button
 *   active  — color reversal (pressed)
 *
 * States compose: active > focus > hover > normal.
 */

import { makeObservable, observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
  WidgetBounds,
  Unsubscribe,
} from "./types.js";

export type ButtonVariant = "default" | "primary" | "success" | "warning" | "danger";

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

// Variant → palette key mapping for normal (muted bg) and hover (full color bg)
const VARIANT_KEYS: Record<ButtonVariant, { bg: string; fg: string; hover: string }> = {
  default:  { bg: "surface",          fg: "foreground",    hover: "primary" },
  primary:  { bg: "primary-muted",    fg: "text-primary",  hover: "primary" },
  success:  { bg: "success-muted",    fg: "text-success",  hover: "success" },
  warning:  { bg: "warning-muted",    fg: "text-warning",  hover: "warning" },
  danger:   { bg: "error-muted",      fg: "text-error",    hover: "error" },
};

export class Button implements InteractiveWidget {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable.ref accessor variant: ButtonVariant;
  @observable accessor focused: boolean = false;
  @observable accessor hovered: boolean = false;
  @observable accessor active: boolean = false;
  @observable accessor disabled: boolean = false;
  @observable accessor visible: boolean = true;
  @observable.ref accessor bounds: WidgetBounds | null = null;

  private readonly changeHandlers = new Set<(w: InteractiveWidget) => void>();
  private readonly submitHandlers = new Set<(w: InteractiveWidget) => void>();
  private _theme: TerminalTheme;

  constructor(options: ButtonOptions) {
    this.id = options.id ?? `button-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;

    makeObservable(this);
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
  handleMouse(event: WidgetMouseEvent): void {
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

  @action
  handleFocus(event: WidgetFocusEvent): void {
    this.focused = event.type === "focus";
  }

  // --- Programmatic control ---

  @action
  focus(): void { this.focused = true; }
  @action
  blur(): void { this.focused = false; }
  @action
  setHovered(value: boolean): void { this.hovered = value; }
  @action
  setActive(value: boolean): void { this.active = value; }
  @action
  setDisabled(value: boolean): void { this.disabled = value; }

  // --- Hit-testing ---

  containsPoint(x: number, y: number): boolean {
    const b = this.bounds;
    if (!b) return false;
    return x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height;
  }

  // --- Subscriptions ---

  onChange(handler: (widget: InteractiveWidget) => void): Unsubscribe {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  onSubmit(handler: (widget: InteractiveWidget) => void): Unsubscribe {
    this.submitHandlers.add(handler);
    return () => this.submitHandlers.delete(handler);
  }

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

    // Active — color reversal (fg/bg swapped)
    if (this.active) {
      const { fg, bg } = this.resolveColors("bg");
      return [new Segment(text, new Style({ color: bg, bgcolor: fg, bold: true }))];
    }

    // Hovered — full variant accent color
    if (this.hovered) {
      const fg = this.resolveFg();
      const bg = this.resolvePalette(VARIANT_KEYS[this.variant].hover);
      return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
    }

    // Normal / focused
    const { fg, bg } = this.resolveColors("bg");
    return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const width = this.label.length + 4; // [ space label space ]
    return { minimum: width, maximum: width };
  }

  // --- Private ---

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
    // If a key is missing, that's a palette construction bug — fail loudly.
    return ColorSpec.fromRgba(rgba!);
  }

  private emitSubmit(): void {
    for (const handler of this.submitHandlers) handler(this);
  }
}
