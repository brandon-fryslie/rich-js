/**
 * Button widget — labeled action trigger with variant styling.
 * [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
 * [LAW:one-type-per-behavior] shared widget infrastructure lives on WidgetBase.
 *
 * Four visual states:
 *   normal  — variant colors from theme semantic palette (muted)
 *   hover   — full variant accent bg + on-accent fg (WCAG contrast)
 *   focus   — brackets [ label ] surrounding the button
 *   active  — same color pair as hover, plus bold (pressed cue)
 *
 * States compose: active > focus > hover > normal. Active and hover
 * deliberately share colors — active differentiates via bold rather
 * than fg/bg inversion, because inversion produces mostly-accent text
 * on bg-tinted surface, which is unreadable for accents whose contrast
 * partner depends on luminance.
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import { cellLen } from "../core/cells.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
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

// Variant → palette key mapping. Per variant:
//   bg / fg     — normal state. Muted accent bg + mostly-accent fg → readable.
//   hover       — full accent bg; pair with hoverFg, NOT with `fg`. The
//                 text-* keys are mostly-accent and would clash on a full
//                 accent bg.
//   hoverFg     — WCAG-correct contrast colour (on-${accent}) for full bg.
const VARIANT_KEYS: Record<ButtonVariant, { bg: string; fg: string; hover: string; hoverFg: string }> = {
  default:  { bg: "surface",       fg: "foreground",   hover: "primary", hoverFg: "on-primary" },
  primary:  { bg: "primary-muted", fg: "text-primary", hover: "primary", hoverFg: "on-primary" },
  success:  { bg: "success-muted", fg: "text-success", hover: "success", hoverFg: "on-success" },
  warning:  { bg: "warning-muted", fg: "text-warning", hover: "warning", hoverFg: "on-warning" },
  danger:   { bg: "error-muted",   fg: "text-error",   hover: "error",   hoverFg: "on-error" },
};

export class Button extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable.ref accessor variant: ButtonVariant;

  // [LAW:types-are-the-program] @observable.ref so setTheme() triggers a
  // re-render — see slider.ts.
  @observable.ref private accessor _theme: TerminalTheme;

  constructor(options: ButtonOptions) {
    super();
    this.id = options.id ?? `button-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  @action
  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "enter" || event.key === "space") {
      this.active = true;
      this.emitSubmit();
      // [LAW:one-source-of-truth] Keyboard activation must leave the widget
      // in the same end state as mouse activation: `active` cleared after
      // the press. Mouse has a natural mouse_up to clear it; keyboard does
      // not, so we schedule the clear on the next microtask. The single-
      // frame `active=true` paint gives the user the visual "pressed" cue
      // and is then cleared, matching mouse behaviour.
      queueMicrotask(() => { if (this.active) this.setActive(false); });
      event.stop();
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

  // --- Active mutator (the keyboard-activation microtask uses this) ---

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

    // Active and hover share the same colour pair (full accent bg + on-accent fg).
    // Active is differentiated by bold, not by inverting fg/bg — inversion gives
    // mostly-accent text on mostly-bg-tinted background, which is unreadable for
    // accents whose contrast partner depends on luminance.
    if (this.active || this.hovered) {
      const fg = this.resolvePalette(VARIANT_KEYS[this.variant].hoverFg);
      const bg = this.resolvePalette(VARIANT_KEYS[this.variant].hover);
      return [new Segment(text, new Style({ color: fg, bgcolor: bg, bold: this.active }))];
    }

    const { fg, bg } = this.resolveColors("bg");
    return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen is the cell-width authority; .length
    // counts UTF-16 code units and miscounts wide / emoji characters.
    const width = cellLen(this.label) + 4;
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

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette is required and must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
