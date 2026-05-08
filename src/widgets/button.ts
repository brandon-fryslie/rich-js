/**
 * Button widget — labeled action trigger with variant styling.
 * [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
 * [LAW:one-source-of-truth] extends WidgetBase; all shared widget machinery
 * (state fields, subscriptions, hit-testing, focus/blur, emitChange) lives there.
 *
 * Renders a single line: `  label  ` normally, `[ label ]` when focused.
 * Width is constant across states (focus does not reflow).
 *
 * Visual states (precedence: disabled > active > hover > focus > normal):
 *   disabled — dim grey on dark grey
 *   active   — color reversal of the variant (pressed)
 *   hover    — variant background lightened by HOVER_BG_BOOST
 *   focus    — `[`/`]` brackets replace surrounding spaces
 *   normal   — variant fg on variant bg from the terminal theme
 */

import { makeObservable, observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../core/color.js";
import { cellLen } from "../core/cells.js";
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

// Variant → ANSI color index mapping (theme-aware)
const VARIANT_ANSI: Record<ButtonVariant, { fgIdx: number; bgIdx: number }> = {
  default: { fgIdx: 15, bgIdx: 8 },
  primary: { fgIdx: 15, bgIdx: 4 },
  success: { fgIdx: 15, bgIdx: 2 },
  warning: { fgIdx: 0, bgIdx: 3 },
  danger: { fgIdx: 15, bgIdx: 1 },
};

const HOVER_BG_BOOST = 30;

export class Button extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable.ref accessor variant: ButtonVariant;
  @observable.ref accessor theme: TerminalTheme;

  constructor(options: ButtonOptions) {
    super();
    this.id = options.id ?? `button-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
    this.theme = options.theme ?? DEFAULT_TERMINAL_THEME;

    makeObservable(this);
  }

  @action
  setTheme(theme: TerminalTheme): void {
    this.theme = theme;
    this.emitChange();
  }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "enter" || event.key === "space") {
      this.active = true;
      this.emitChange();
      this.emitSubmit();
      // Clear immediately so a keyboard-activated button does not stay visually pressed.
      this.active = false;
      this.emitChange();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type === "mouse_down") {
      this.active = true;
      this.emitChange();
    }
    if (event.type === "mouse_up") {
      if (this.active) {
        this.active = false;
        this.emitChange();
        this.emitSubmit();
      }
    }
  }

  // --- Rendering ---

  render(_options: RenderOptions): Iterable<Segment> {
    const { fg, bg } = this.resolveColors();
    // [LAW:dataflow-not-control-flow] same segment count and width every state — only style + content vary
    const focused = this.focused;
    const left = focused ? "[" : " ";
    const right = focused ? "]" : " ";
    const text = `${left} ${this.label} ${right}`;

    if (this.disabled) {
      return [new Segment(text, new Style({ color: "#666666", bgcolor: "#333333", dim: true }))];
    }

    // Active — color reversal
    if (this.active) {
      return [new Segment(text, new Style({ color: bg, bgcolor: fg, bold: true }))];
    }

    // Hovered — lightened background
    if (this.hovered) {
      const bgRgba = this.theme.ansiColors.get(VARIANT_ANSI[this.variant].bgIdx);
      const lightened = ColorSpec.fromRgb(
        Math.min(255, bgRgba.red + HOVER_BG_BOOST),
        Math.min(255, bgRgba.green + HOVER_BG_BOOST),
        Math.min(255, bgRgba.blue + HOVER_BG_BOOST),
      );
      return [new Segment(text, new Style({ color: fg, bgcolor: lightened }))];
    }

    // Normal / focused
    return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen is the single authority for terminal cell width.
    const width = cellLen(this.label) + 4; // [ space label space ]
    return { minimum: width, maximum: width };
  }

  // --- Private ---

  private resolveColors(): { fg: ColorSpec; bg: ColorSpec } {
    const ansi = VARIANT_ANSI[this.variant];
    const table = this.theme.ansiColors;
    return {
      fg: ColorSpec.fromRgba(table.get(ansi.fgIdx)),
      bg: ColorSpec.fromRgba(table.get(ansi.bgIdx)),
    };
  }
}
