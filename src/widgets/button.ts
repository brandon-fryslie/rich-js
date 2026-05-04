/**
 * Button widget — labeled action trigger with variant styling.
 * [LAW:dataflow-not-control-flow] rendering is a pure function of observable state.
 */

import { makeObservable, observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import type { RenderOptions } from "../core/protocol.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  WidgetBounds,
  Unsubscribe,
} from "./types.js";

export type ButtonVariant = "default" | "primary" | "success" | "warning" | "danger";

export interface ButtonOptions {
  label: string;
  variant?: ButtonVariant;
  id?: string;
  disabled?: boolean;
}

// Variant foreground/background color pairs
const VARIANT_STYLES: Record<ButtonVariant, { color: string; bgcolor: string }> = {
  default: { color: "#ffffff", bgcolor: "#4a4a4a" },
  primary: { color: "#ffffff", bgcolor: "#0055d4" },
  success: { color: "#ffffff", bgcolor: "#008000" },
  warning: { color: "#000000", bgcolor: "#d4a017" },
  danger: { color: "#ffffff", bgcolor: "#cc0000" },
};

const FOCUSSED_DEFAULT_BG = "#6a6a6a";

export class Button implements InteractiveWidget {
  readonly id: string;
  readonly focusable = true;

  @observable accessor label: string;
  @observable.ref accessor variant: ButtonVariant;
  @observable accessor focused: boolean = false;
  @observable accessor disabled: boolean;
  @observable accessor visible: boolean = true;
  @observable.ref accessor bounds: WidgetBounds | null = null;

  private readonly changeHandlers = new Set<(w: InteractiveWidget) => void>();
  private readonly submitHandlers = new Set<(w: InteractiveWidget) => void>();

  constructor(options: ButtonOptions) {
    this.id = options.id ?? `button-${options.label.toLowerCase().replace(/\s+/g, "-")}`;
    this.label = options.label;
    this.variant = options.variant ?? "default";
    this.disabled = options.disabled ?? false;

    makeObservable(this);
  }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;
    if (event.key === "enter" || event.key === "space") {
      this.emitSubmit();
    }
  }

  @action
  handleClick(_event: WidgetMouseEvent): void {
    if (this.disabled) return;
    this.emitSubmit();
  }

  @action
  handleFocus(event: { type: "focus" | "blur" }): void {
    this.focused = event.type === "focus";
  }

  // --- Programmatic control ---

  @action
  focus(): void { this.focused = true; }

  @action
  blur(): void { this.focused = false; }

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
    const width = this.label.length + 2; // spaces around label
    return { minimum: width, maximum: width };
  }

  // --- Private ---

  private computeStyle(): Style {
    if (this.disabled) {
      return new Style({ color: "#666666", bgcolor: "#333333", dim: true });
    }

    const colors = VARIANT_STYLES[this.variant];
    const bg = this.focused && this.variant === "default"
      ? FOCUSSED_DEFAULT_BG
      : colors.bgcolor;

    return new Style({
      color: colors.color,
      bgcolor: bg,
      bold: this.focused,
    });
  }

  private emitSubmit(): void {
    for (const handler of this.submitHandlers) handler(this);
  }
}
