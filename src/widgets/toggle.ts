/**
 * Toggle widget — on/off switch with label and variant color.
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

import { labeled } from "../core/orient.js";
import { action } from "mobx";
import { observableRef } from "./observable.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { cellLen } from "../core/cells.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { ThemedWidget } from "./themed-widget.js";
import { ink, VARIANT_INK, type InkVariant } from "./ink.js";
import type { WidgetKeyEvent, WidgetMouseEvent } from "./types.js";

export type ToggleVariant = InkVariant;

export interface ToggleOptions {
  label: string;
  on?: boolean;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
  variant?: ToggleVariant;
}

export class Toggle extends ThemedWidget {
  readonly id: string;
  readonly focusable = true;

  @observableRef accessor label: string;
  @observableRef accessor on: boolean;
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
  handleKey(event: WidgetKeyEvent): void {
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

  protected draw(options: RenderOptions): Iterable<Segment> {
    // Both indicators are exactly 5 cells: "[ON] " and "[OFF]".
    const indicator = this.on ? "[ON] " : "[OFF]";
    const drawn = (style: Style): Segment[] => labeled(`${indicator} `, [new Segment(this.label, style)], "", style, options.textOrder);

    if (this.disabled) {
      return drawn(new Style(this.disabledInk));
    }

    const pairs = VARIANT_INK[this.variant];
    const colors = ink(this.theme, ...(this.on ? pairs.lit : pairs.quiet));

    return drawn(new Style({ ...colors, underline: this.focused }));
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen — see button.ts.
    const width = 5 + 1 + cellLen(this.label);
    return { minimum: width, maximum: width };
  }
}
