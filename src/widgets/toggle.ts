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

import { observable, action, observableRef } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { cellLen } from "../core/cells.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { ThemedWidget } from "./themed-widget.js";
import { ink } from "./ink.js";
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

// onFg uses on-${accent} (WCAG-correct contrast, picked once at palette
// build time) so the ON state stays readable on a full accent bg. Earlier
// versions used text-${accent} here, which is mostly-accent and clashed
// with the same accent as background. offFg keeps text-${accent} because
// offBg is mostly-bg-tinted and the contrast holds.
const VARIANT_KEYS: Record<
  ToggleVariant,
  { onBg: string; onFg: string; offBg: string; offFg: string }
> = {
  default: { onBg: "primary", onFg: "on-primary", offBg: "surface",       offFg: "foreground" },
  primary: { onBg: "primary", onFg: "on-primary", offBg: "primary-muted", offFg: "text-primary" },
  success: { onBg: "success", onFg: "on-success", offBg: "success-muted", offFg: "text-success" },
  warning: { onBg: "warning", onFg: "on-warning", offBg: "warning-muted", offFg: "text-warning" },
  danger:  { onBg: "error",   onFg: "on-error",   offBg: "error-muted",   offFg: "text-error" },
};

export class Toggle extends ThemedWidget {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable accessor on: boolean;
  @observableRef accessor variant: ToggleVariant;

  constructor(options: ToggleOptions) {
    super(options.theme);
    this.id = options.id ?? `toggle-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.on = options.on ?? false;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
  }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "space") {
      this.on = !this.on;
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
    // A release that dragged off the toggle cancels the press.
    if (event.type === "mouse_up" && event.over) {
      this.on = !this.on;
      this.emitChange();
    }
  }

  // --- Rendering ---

  protected draw(_options: RenderOptions): Iterable<Segment> {
    // Both indicators are exactly 5 cells: "[ON] " and "[OFF]".
    const indicator = this.on ? "[ON] " : "[OFF]";
    const text = `${indicator} ${this.label}`;

    if (this.disabled) {
      return [new Segment(text, new Style(this.disabledInk))];
    }

    const keys = VARIANT_KEYS[this.variant];
    const colors = this.on ? ink(this.theme, keys.onFg, keys.onBg) : ink(this.theme, keys.offFg, keys.offBg);

    return [new Segment(text, new Style({ ...colors, underline: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen — see button.ts.
    const width = 5 + 1 + cellLen(this.label);
    return { minimum: width, maximum: width };
  }
}
