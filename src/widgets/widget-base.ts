/**
 * WidgetBase — shared MobX observable foundation for interactive widgets.
 * [LAW:one-type-per-behavior] All widgets share the same base; differences
 * are in configuration and state, not in infrastructure.
 * [LAW:single-enforcer] Subscription emission lives here, not duplicated per widget.
 *
 * Uses makeObservable (not makeAutoObservable) because subclasses extend this.
 * MobX 6.x with TC39 decorators requires `accessor` keyword.
 */

import { makeObservable, observable, action } from "mobx";
import type { Segment } from "../core/segment.js";
import type { RenderOptions } from "../core/protocol.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
  WidgetBounds,
  Unsubscribe,
} from "./types.js";

export abstract class WidgetBase implements InteractiveWidget {
  abstract readonly id: string;
  abstract readonly focusable: boolean;

  @observable accessor focused: boolean = false;
  @observable accessor hovered: boolean = false;
  @observable accessor active: boolean = false;
  @observable accessor disabled: boolean = false;
  @observable accessor visible: boolean = true;
  @observable.ref accessor bounds: WidgetBounds | null = null;

  private readonly changeHandlers = new Set<(w: InteractiveWidget) => void>();
  private readonly submitHandlers = new Set<(w: InteractiveWidget) => void>();

  constructor() {
    makeObservable(this);
  }

  // --- Event handlers (override in subclass) ---

  abstract handleKey(event: KeyEvent): void;

  handleMouse(_event: WidgetMouseEvent): void {}

  @action
  handleFocus(event: WidgetFocusEvent): void {
    this.focused = event.type === "focus";
    this.emitChange();
  }

  // --- Programmatic control ---
  // [LAW:single-enforcer] `handleFocus` is the canonical site that mutates
  // `focused` and emits change. `focus()` / `blur()` are public-API
  // delegates so external callers and the focus manager converge on one
  // implementation rather than dispatching the transition twice.

  focus(): void {
    this.handleFocus({ type: "focus" });
  }

  blur(): void {
    this.handleFocus({ type: "blur" });
  }

  // [LAW:single-enforcer] One canonical mutator for the hovered observable.
  // The router and tests both call this; widgets never need to override it.
  @action
  setHovered(value: boolean): void {
    this.hovered = value;
    this.emitChange();
  }

  @action
  setActive(value: boolean): void {
    this.active = value;
    this.emitChange();
  }

  @action
  setDisabled(value: boolean): void {
    this.disabled = value;
    this.emitChange();
  }

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

  protected emitChange(): void {
    for (const handler of this.changeHandlers) {
      handler(this);
    }
  }

  protected emitSubmit(): void {
    for (const handler of this.submitHandlers) {
      handler(this);
    }
  }

  // --- Renderable + Measurable (abstract) ---

  abstract render(options: RenderOptions): Iterable<Segment>;
  abstract measure(options: RenderOptions): { minimum: number; maximum: number };
}
