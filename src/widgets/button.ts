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

export type ButtonVariant = InkVariant;

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

export class Button extends ThemedWidget {
  readonly id: string;
  readonly focusable = true;

  @observableRef accessor label: string;
  @observableRef accessor variant: ButtonVariant;

  constructor(options: ButtonOptions) {
    super(options.theme);
    this.id = options.id ?? `button-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;
  }

  // --- Event handlers ---

  @action
  handleKey(event: WidgetKeyEvent): void {
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
    // A release that dragged off the button cancels the press.
    if (event.type === "mouse_up") {
      if (this.active) {
        this.active = false;
        if (event.over) this.emitSubmit();
      }
    }
  }

  // --- Active mutator (the keyboard-activation microtask uses this) ---

  @action
  setActive(value: boolean): void { this.active = value; }

  // --- Rendering ---

  protected draw(options: RenderOptions): Iterable<Segment> {
    // [LAW:dataflow-not-control-flow] same segment count and width every state
    const focused = this.focused;
    const left = focused ? "[" : " ";
    const right = focused ? "]" : " ";
    const drawn = (style: Style): Segment[] => labeled(`${left} `, [new Segment(this.label, style)], ` ${right}`, style, options.textOrder);

    if (this.disabled) {
      return drawn(new Style(this.disabledInk));
    }

    // Active and hover share the lit pair. Active is differentiated by bold,
    // not by inverting fg/bg — inversion gives mostly-accent text on
    // mostly-bg-tinted background, which is unreadable for accents whose
    // contrast partner depends on luminance.
    const pairs = VARIANT_INK[this.variant];
    if (this.active || this.hovered) {
      return drawn(new Style({ ...ink(this.theme, ...pairs.lit), bold: this.active }));
    }

    return drawn(new Style(ink(this.theme, ...pairs.quiet)));
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    // [LAW:one-source-of-truth] cellLen is the cell-width authority; .length
    // counts UTF-16 code units and miscounts wide / emoji characters.
    const width = cellLen(this.label) + 4;
    return { minimum: width, maximum: width };
  }
}
