/**
 * WidgetBase — shared MobX observable foundation for interactive widgets.
 * [LAW:one-type-per-behavior] All widgets share the same base; differences
 * are in configuration and state, not in infrastructure.
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

  handleClick(_event: WidgetMouseEvent): void {}

  @action
  handleFocus(event: WidgetFocusEvent): void {
    this.focused = event.type === "focus";
  }

  // --- Programmatic control ---

  @action
  focus(): void {
    this.focused = true;
  }

  @action
  blur(): void {
    this.focused = false;
  }

  @action
  setDisabled(value: boolean): void {
    this.disabled = value;
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
