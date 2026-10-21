/**
 * FocusManager — which widget has focus, over the widgets on the frame.
 * [LAW:one-source-of-truth] single authority for which widget has focus.
 * [LAW:dataflow-not-control-flow] focus transitions are observable state;
 * widgets react to focus/blur events, the manager never skips dispatch.
 */

import { action } from "mobx";
import { observableRef } from "./observable.js";
import type {
  InteractiveWidget,
  FocusManager,
  KeyEvent,
} from "./types.js";
import type { Unsubscribe } from "../core/subscription.js";

/** What focus follows: the frame a `WidgetApp` just painted. */
export interface FocusView {
  /** Every widget the view holds, in document order, whether or not it has a cell on screen. */
  present(): readonly InteractiveWidget[];
  /** The widgets with a cell on the frame on screen, in document order. */
  onScreen(): readonly InteractiveWidget[];
  /** The time a frame drawn now is drawn for (`RenderOptions.frame`), which a focus change is stamped with. */
  frameTime(): number;
}

export class DefaultFocusManager implements FocusManager {
  @observableRef
  accessor currentWidget: InteractiveWidget | null = null;

  private readonly changeHandlers = new Set<(current: InteractiveWidget | null) => void>();

  /**
   * [LAW:one-source-of-truth] The view is asked every time rather than kept:
   * a list of the widgets held here would be a second picture of the frame,
   * and wrong from the next paint.
   */
  constructor(private readonly view: FocusView) {}

  get current(): InteractiveWidget | null {
    return this.currentWidget;
  }

  get widgets(): readonly InteractiveWidget[] {
    return this.view.onScreen().filter(takesFocus);
  }

  @action
  next(): void {
    this.step(this.view.present());
  }

  @action
  prev(): void {
    this.step([...this.view.present()].reverse());
  }

  // A widget not on screen yet can take focus: an app that is about to show
  // it focuses it first, and the frame that shows it keeps it (`settle`).
  @action
  focus(widget: InteractiveWidget): void {
    if (!takesFocus(widget)) return;
    this.setFocus(widget);
  }

  /**
   * Put focus where the frame just painted lets it rest: it stays on a widget
   * the view holds (`present`) that can take it, and otherwise moves to the
   * first one on screen that can, or to none.
   *
   * In the view, not on screen: a widget cropped for the moment — the
   * terminal shrank, a viewport scrolled, an overlay covers it, its container
   * handed it no column — is still in the view, and keeps focus and whatever
   * focus holds, like a half-typed filter.
   *
   * [LAW:single-enforcer] The one place focus follows the frame — onto the
   * first widget when the app starts, off a widget that left the view
   * or was disabled.
   */
  @action
  settle(): void {
    const current = this.currentWidget;
    if (current && takesFocus(current) && this.view.present().includes(current)) return;
    const first = this.widgets[0];
    if (first) this.setFocus(first);
    else this.clear();
  }

  onChange(handler: (current: InteractiveWidget | null) => void): Unsubscribe {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  // [LAW:single-enforcer] FocusManager owns Tab/Shift+Tab semantics. The
  // router registers this as a normal-priority handler at construction —
  // it runs after the focused widget, so a widget can `event.stop()`
  // to suppress traversal (e.g. Dropdown when its overlay is open).
  handleKey(event: KeyEvent): void {
    if (event.key !== "tab") return;
    if (event.shift) this.prev();
    else this.next();
    event.stop();
  }

  // --- Private ---

  // To the first widget Tab moves between that follows the focused one in
  // `order`, wrapping. It is found by its place in the view, not among those
  // on screen, so Tab from a widget on no cell moves to its neighbour.
  private step(order: readonly InteractiveWidget[]): void {
    const tabbable = new Set(this.widgets);
    const at = this.currentWidget ? order.indexOf(this.currentWidget) : -1;
    const target = [...order.slice(at + 1), ...order.slice(0, at + 1)].find((widget) => tabbable.has(widget));
    if (target) this.setFocus(target);
  }

  // No focus is where `settle` leaves an app with nothing to focus, and only
  // there: anywhere else the next frame would put focus back on the first
  // widget, so there is no public way in.
  @action
  private clear(): void {
    if (!this.currentWidget) return;
    // [LAW:single-enforcer] WidgetBase.focus()/blur() route through
    // handleFocus; calling it here as well would dispatch twice and run any
    // subclass side effect (e.g. Dropdown clearing its filter) twice.
    this.currentWidget.blur(this.view.frameTime());
    this.currentWidget = null;
    this.emitChange();
  }

  @action
  private setFocus(widget: InteractiveWidget): void {
    if (this.currentWidget === widget) return;
    // [LAW:single-enforcer] focus()/blur() already dispatch handleFocus —
    // see clear() for the rationale.
    const time = this.view.frameTime();
    if (this.currentWidget) this.currentWidget.blur(time);
    this.currentWidget = widget;
    widget.focus(time);
    this.emitChange();
  }

  private emitChange(): void {
    for (const handler of this.changeHandlers) {
      handler(this.currentWidget);
    }
  }
}

function takesFocus(widget: InteractiveWidget): boolean {
  return widget.focusable && !widget.disabled;
}
