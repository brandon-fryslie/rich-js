/**
 * Button widget — labeled action trigger with variant styling.
 * [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
 *
 * Four visual states, composed from observable booleans:
 *   normal  — focused=false, hovered=false, active=false
 *   hover   — hovered=true (mouse cursor over, not pressed)
 *   focus   — focused=true (keyboard focus, distinct visual)
 *   active  — active=true (pressed, mouse_down or key held)
 *
 * States compose: a focused+hovered button shows focus styling (focus wins).
 * An active button always shows active styling (active wins).
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

// Variant → ANSI color index mapping (theme-aware)
// Uses standard ANSI positions: 0=black, 1=red, 2=green, 3=yellow, 4=blue,
// 7=white, 8=bright_black, 9=bright_red, 15=bright_white
const VARIANT_ANSI: Record<ButtonVariant, { fgIdx: number; bgIdx: number }> = {
  default: { fgIdx: 15, bgIdx: 8 },    // bright_white on bright_black
  primary: { fgIdx: 15, bgIdx: 4 },     // bright_white on blue
  success: { fgIdx: 15, bgIdx: 2 },     // bright_white on green
  warning: { fgIdx: 0, bgIdx: 3 },      // black on yellow
  danger: { fgIdx: 15, bgIdx: 1 },      // bright_white on red
};

const HOVER_BG_BOOST = 30;

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
    const style = this.computeStyle();
    const text = ` ${this.label} `;
    return [new Segment(text, style)];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const width = this.label.length + 2;
    return { minimum: width, maximum: width };
  }

  // --- Private ---

  private resolveColors(): { fg: ColorSpec; bg: ColorSpec } {
    const ansi = VARIANT_ANSI[this.variant];
    const table = this._theme.ansiColors;
    return {
      fg: ColorSpec.fromRgba(table.get(ansi.fgIdx)),
      bg: ColorSpec.fromRgba(table.get(ansi.bgIdx)),
    };
  }

  private computeStyle(): Style {
    const { fg, bg } = this.resolveColors();

    if (this.disabled) {
      return new Style({ color: "#666666", bgcolor: "#333333", dim: true });
    }

    // Active (pressed) — reverse + bold + underline
    if (this.active) {
      return new Style({ color: bg, bgcolor: fg, bold: true, underline: true });
    }

    // Focused — reverse colors + bold
    if (this.focused) {
      return new Style({ color: bg, bgcolor: fg, bold: true });
    }

    // Hovered — lighten background slightly
    if (this.hovered) {
      const bgRgba = this._theme.ansiColors.get(VARIANT_ANSI[this.variant].bgIdx);
      const lightened = ColorSpec.fromRgb(
        Math.min(255, bgRgba.red + HOVER_BG_BOOST),
        Math.min(255, bgRgba.green + HOVER_BG_BOOST),
        Math.min(255, bgRgba.blue + HOVER_BG_BOOST),
      );
      return new Style({ color: fg, bgcolor: lightened });
    }

    // Normal
    return new Style({ color: fg, bgcolor: bg });
  }

  private emitSubmit(): void {
    for (const handler of this.submitHandlers) handler(this);
  }
}
