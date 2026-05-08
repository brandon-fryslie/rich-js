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
 *   disabled    — dim grey on dark grey
 *   active      — full accent bg + on-accent fg + bold (same bg as hover; bold differentiates)
 *   hover       — full accent bg + on-accent fg (WCAG-correct contrast partner)
 *   focus       — `[`/`]` brackets replace surrounding spaces
 *   normal      — muted accent bg + text-accent fg from semantic palette
 */

import { makeObservable, observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
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
      // [LAW:dataflow-not-control-flow] flipping `active` true→false inside one
      // `@action` is invisible to MobX autorun observers — they only see the
      // post-action state. Schedule the clear on the next microtask so the
      // action exits with `active=true` (one reaction cycle) and `setActive(false)`
      // runs in its own action (second cycle), giving observers a render with
      // the pressed state.
      queueMicrotask(() => this.setActive(false));
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
    // [LAW:dataflow-not-control-flow] same segment count and width every state — only style + content vary
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

    const { fg, bg } = this.resolveNormalColors();
    return [new Segment(text, new Style({ color: fg, bgcolor: bg }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen is the single authority for terminal cell width.
    const width = cellLen(this.label) + 4; // [ space label space ]
    return { minimum: width, maximum: width };
  }

  // --- Palette resolution ---

  private resolveNormalColors(): { fg: ColorSpec; bg: ColorSpec } {
    const keys = VARIANT_KEYS[this.variant];
    return {
      fg: this.resolvePalette(keys.fg),
      bg: this.resolvePalette(keys.bg),
    };
  }

  private resolvePalette(key: string): ColorSpec {
    const rgba = this.theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette is required and must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
