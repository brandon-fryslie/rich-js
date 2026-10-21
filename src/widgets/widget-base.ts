/**
 * WidgetBase — shared MobX observable foundation for interactive widgets.
 * [LAW:one-type-per-behavior] All widgets share the same base; differences
 * are in configuration and state, not in infrastructure.
 *
 * Reactive state is declared with TC39 decorators, which MobX 7 requires on
 * `accessor` members. Each decorator registers its own member, so there is no
 * makeObservable call and subclasses add observables the same way.
 */

import { action } from "mobx";
import { observableRef } from "./observable.js";
import { Segment } from "../core/segment.js";
import { NULL_STYLE, type Style } from "../core/style.js";
import type { RenderOptions } from "../core/protocol.js";
import type {
  InteractiveWidget,
  KeyEvent,
  WidgetMouseEvent,
  WidgetFocusEvent,
} from "./types.js";
import type { Unsubscribe } from "../core/subscription.js";
import { State } from "../core/state.js";

export abstract class WidgetBase implements InteractiveWidget {
  abstract readonly id: string;
  abstract readonly focusable: boolean;

  @observableRef accessor focused: boolean = false;
  @observableRef accessor hovered: boolean = false;
  @observableRef accessor active: boolean = false;
  @observableRef accessor disabled: boolean = false;

  // Subscribed and let go between frames; each set is replaced whole.
  private readonly changeHandlers = new State<ReadonlySet<(w: InteractiveWidget) => void>>(new Set());
  private readonly submitHandlers = new State<ReadonlySet<(w: InteractiveWidget) => void>>(new Set());

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
  focus(time: number): void {
    this.handleFocus({ type: "focus", time });
  }

  @action
  blur(time: number): void {
    this.handleFocus({ type: "blur", time });
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
    return subscribe(this.changeHandlers, handler);
  }

  onSubmit(handler: (widget: InteractiveWidget) => void): Unsubscribe {
    return subscribe(this.submitHandlers, handler);
  }

  protected emitChange(): void {
    for (const handler of this.changeHandlers.get()) {
      handler(this);
    }
  }

  protected emitSubmit(): void {
    for (const handler of this.submitHandlers.get()) {
      handler(this);
    }
  }

  // --- Renderable + Measurable ---

  // [LAW:single-enforcer] The one place a widget's cells get their anchor, so
  // a hit on any cell names this widget and the cell's place in its output
  // (`widgetAt`). Subclasses draw; none stamps itself — what a draw stamps
  // inside this stamp is its own (`WidgetMouseEvent.cell`). A `RichText` admits no
  // anchor, so stamping has to follow every text layout `draw` does.
  // Every row is padded to the widest, so the widget owns its whole rectangle
  // and a click past the end of a short row still reaches it; every row ends
  // in a newline, so a blank last row survives the next `splitLines`. The
  // padding stands on `ground`, whatever the widget draws its own cells on.
  render(options: RenderOptions): Iterable<Segment> {
    const drawn = Segment.splitLines(this.draw(options));
    const [width] = Segment.getShape(drawn);
    const lines = Segment.anchorLines(drawn.map((line) => Segment.adjustLineLength(line, width, this.ground)), this);
    return lines.flatMap((line) => [...line, Segment.line()]);
  }

  // What a padded row stands on. None by default: the padding shows whatever
  // the widget is drawn over, as the cells of content it did not draw do.
  protected get ground(): Style {
    return NULL_STYLE;
  }

  protected abstract draw(options: RenderOptions): Iterable<Segment>;
  abstract measure(options: RenderOptions): { minimum: number; maximum: number };
}

/** `handler` added to `handlers` until the returned call takes it out. */
function subscribe<H>(handlers: State<ReadonlySet<H>>, handler: H): Unsubscribe {
  handlers.set(new Set(handlers.get()).add(handler));
  return () => {
    const left = new Set(handlers.get());
    left.delete(handler);
    handlers.set(left);
  };
}
