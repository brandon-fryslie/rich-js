/**
 * WidgetBase — shared MobX observable foundation for interactive widgets.
 * [LAW:one-type-per-behavior] All widgets share the same base; differences
 * are in configuration and state, not in infrastructure.
 *
 * Reactive state is declared with TC39 decorators, which MobX 7 requires on
 * `accessor` members. Each decorator registers its own member, so there is no
 * makeObservable call and subclasses add observables the same way.
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import type { RenderOptions } from "../core/protocol.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
} from "./types.js";
import type { Unsubscribe } from "../core/subscription.js";

export abstract class WidgetBase implements InteractiveWidget {
  abstract readonly id: string;
  abstract readonly focusable: boolean;

  @observable accessor focused: boolean = false;
  @observable accessor hovered: boolean = false;
  @observable accessor active: boolean = false;
  @observable accessor disabled: boolean = false;

  private readonly changeHandlers = new Set<(w: InteractiveWidget) => void>();
  private readonly submitHandlers = new Set<(w: InteractiveWidget) => void>();

  // --- Event handlers (override in subclass) ---

  abstract handleKey(event: KeyEvent): void;

  handleMouse(_event: WidgetMouseEvent): void {}

  @action
  handleFocus(event: WidgetFocusEvent): void {
    this.focused = event.type === "focus";
  }

  // --- Programmatic control ---

  // [LAW:single-enforcer] focus()/blur() route through handleFocus so any
  // subclass override (e.g. Dropdown collapsing its overlay on blur)
  // participates in the same transition path the event router uses. There
  // is no second code path that flips `focused` directly from the outside.
  @action
  focus(): void {
    this.handleFocus({ type: "focus" });
  }

  @action
  blur(): void {
    this.handleFocus({ type: "blur" });
  }

  @action
  setDisabled(value: boolean): void {
    this.disabled = value;
  }

  // [LAW:single-enforcer] One canonical setter for hover state lives on
  // the base. EventRouter calls it when the pointer moves onto or off this
  // widget; widgets that need to react to hover transitions override
  // handleMouse and read the synthesized `mouse_move`.
  @action
  setHovered(value: boolean): void {
    this.hovered = value;
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

  // --- Renderable + Measurable ---

  // [LAW:single-enforcer] The one place a widget's cells get their anchor, so
  // a hit on any cell names this widget and the cell's place in its output
  // (`widgetAt`). Subclasses draw; none stamps itself. A `RichText` admits no
  // anchor, so stamping has to follow every text layout `draw` does.
  // Every row is padded to the widest, so the widget owns its whole rectangle
  // and a click past the end of a short row still reaches it; every row ends
  // in a newline, so a blank last row survives the next `splitLines`.
  // Reporting itself before it draws is what puts a widget ahead of the
  // widgets nested in it in document order — the order focus traverses.
  render(options: RenderOptions): Iterable<Segment> {
    options.onDraw?.(this);
    const drawn = Segment.splitLines(this.draw(options));
    const [width] = Segment.getShape(drawn);
    const lines = Segment.anchorLines(drawn.map((line) => Segment.adjustLineLength(line, width)), this);
    return lines.flatMap((line) => [...line, Segment.line()]);
  }

  protected abstract draw(options: RenderOptions): Iterable<Segment>;
  abstract measure(options: RenderOptions): { minimum: number; maximum: number };
}
