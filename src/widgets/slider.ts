/**
 * Slider widget — numeric value within [min, max] with step increments.
 * [LAW:dataflow-not-control-flow] every render emits exactly `width`
 * track cells; the marker cell index is data, not a branch.
 * [LAW:one-type-per-behavior] shared infrastructure inherited from
 * WidgetBase.
 *
 * Visual:
 *   track    — `width` cells of "─" (ASCII fallback "-")
 *   marker   — "●" (ASCII fallback "*") at round((value - min) / range * (width - 1))
 *   filled   — cells left of and including the marker use primary fg
 *   unfilled — cells right of the marker use surface bg / foreground
 *   focused  — underline on the segments
 *   disabled — dim
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

export interface SliderOptions {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  width?: number;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
}

const DEFAULT_WIDTH = 20;

export class Slider extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor value: number;
  @observable.ref accessor min: number;
  @observable.ref accessor max: number;
  @observable.ref accessor step: number;
  @observable.ref accessor width: number;

  private _theme: TerminalTheme;
  private _dragging = false;

  constructor(options: SliderOptions = {}) {
    super();
    this.id = options.id ?? `slider-${Math.random().toString(36).slice(2, 8)}`;
    this.min = options.min ?? 0;
    this.max = options.max ?? 100;
    this.step = options.step ?? 1;
    this.width = options.width ?? DEFAULT_WIDTH;
    this.value = clampSnap(options.value ?? this.min, this.min, this.max, this.step);
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
  }

  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    switch (event.key) {
      case "left":
        this.setValue(this.value - this.step);
        return;
      case "right":
        this.setValue(this.value + this.step);
        return;
      case "home":
        this.setValue(this.min);
        return;
      case "end":
        this.setValue(this.max);
        return;
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;

    if (event.type === "mouse_down") {
      this._dragging = true;
      this.setValueFromMouseX(event.x);
      return;
    }

    if (event.type === "mouse_move") {
      if (this._dragging) this.setValueFromMouseX(event.x);
      return;
    }

    if (event.type === "mouse_up") {
      const wasDragging = this._dragging;
      this._dragging = false;
      if (wasDragging) {
        this.setValueFromMouseX(event.x);
        this.emitSubmit();
      }
      return;
    }
  }

  // --- Hover mutator (router fast-path) ---

  @action
  setHovered(value: boolean): void { this.hovered = value; }

  // --- Value mutation ---

  @action
  private setValue(next: number): void {
    const snapped = clampSnap(next, this.min, this.max, this.step);
    if (snapped === this.value) return;
    this.value = snapped;
    this.emitChange();
  }

  private setValueFromMouseX(x: number): void {
    const b = this.bounds;
    if (!b) return;
    const cellsAvailable = Math.max(1, this.width - 1);
    const clamped = Math.max(0, Math.min(this.width - 1, x - b.x));
    const fraction = clamped / cellsAvailable;
    const next = this.min + fraction * (this.max - this.min);
    this.setValue(next);
  }

  // --- Rendering ---

  render(options: RenderOptions): Iterable<Segment> {
    const trackChar = options.asciiOnly ? "-" : "─";
    const markerChar = options.asciiOnly ? "*" : "●";
    const range = this.max - this.min;
    const fraction = range === 0 ? 0 : (this.value - this.min) / range;
    const markerIdx = Math.round(fraction * (this.width - 1));

    const baseAttrs = { underline: this.focused };
    const filledStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true, ...baseAttrs })
      : new Style({ color: this.resolvePalette("primary"), ...baseAttrs });
    const unfilledStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true, ...baseAttrs })
      : new Style({ color: this.resolvePalette("surface"), ...baseAttrs });
    const markerStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true, bold: true, ...baseAttrs })
      : new Style({ color: this.resolvePalette("primary"), bold: true, ...baseAttrs });

    const segments: Segment[] = [];
    if (markerIdx > 0) {
      segments.push(new Segment(trackChar.repeat(markerIdx), filledStyle));
    }
    segments.push(new Segment(markerChar, markerStyle));
    const tail = this.width - markerIdx - 1;
    if (tail > 0) {
      segments.push(new Segment(trackChar.repeat(tail), unfilledStyle));
    }
    return segments;
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: this.width, maximum: this.width };
  }

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}

// [LAW:single-enforcer] Single function clamps a numeric value into the
// [min, max] range and snaps to the nearest step boundary. All value
// mutations route through this; min/max/step never produce out-of-bounds
// observable state.
function clampSnap(value: number, min: number, max: number, step: number): number {
  const clamped = Math.max(min, Math.min(max, value));
  if (step <= 0) return clamped;
  const snapped = min + Math.round((clamped - min) / step) * step;
  // Floating-point cleanup: re-clamp in case rounding nudged past max.
  return Math.max(min, Math.min(max, snapped));
}
