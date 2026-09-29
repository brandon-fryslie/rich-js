/**
 * FocusManager — which widget has focus, over the widgets on the frame.
 * [LAW:one-source-of-truth] single authority for which widget has focus.
 * [LAW:dataflow-not-control-flow] focus transitions are observable state;
 * widgets react to focus/blur events, the manager never skips dispatch.
 */

import { action, observableRef } from "mobx";
import type {
  InteractiveWidget,
  FocusManager,
  KeyEvent,
} from "./types.js";
import type { Unsubscribe } from "../core/subscription.js";

export class DefaultFocusManager implements FocusManager {
  @observableRef
  accessor currentWidget: InteractiveWidget | null = null;

  private readonly changeHandlers = new Set<(current: InteractiveWidget | null) => void>();

  /**
   * `onScreen` is the widgets on the frame on screen, in document order.
   *
   * [LAW:one-source-of-truth] It is asked every time rather than kept: a list
   * of the widgets held here would be a second picture of the frame, and
   * wrong from the next paint.
   */
  constructor(private readonly onScreen: () => readonly InteractiveWidget[]) {}

  get current(): InteractiveWidget | null {
    return this.currentWidget;
  }

  get widgets(): readonly InteractiveWidget[] {
    return this.onScreen().filter(takesFocus);
  }

  @action
  next(): void {
    const focusable = this.widgets;
    if (focusable.length === 0) return;

    const currentIdx = this.currentWidget ? focusable.indexOf(this.currentWidget) : -1;
    const nextIdx = (currentIdx + 1) % focusable.length;
    this.setFocus(focusable[nextIdx]!);
  }

  @action
  prev(): void {
    const focusable = this.widgets;
    if (focusable.length === 0) return;

    const currentIdx = this.currentWidget ? focusable.indexOf(this.currentWidget) : -1;
    const prevIdx = currentIdx <= 0 ? focusable.length - 1 : currentIdx - 1;
    this.setFocus(focusable[prevIdx]!);
  }

  // A widget not on screen yet can take focus: an app that is about to show
  // it focuses it first, and the frame that shows it keeps it (`settle`).
  @action
  focus(widget: InteractiveWidget): void {
    if (!takesFocus(widget)) return;
    this.setFocus(widget);
  }

  @action
  blur(): void {
    if (!this.currentWidget) return;
    // [LAW:single-enforcer] WidgetBase.focus()/blur() route through
    // handleFocus; calling it here as well would dispatch twice and run any
    // subclass side effect (e.g. Dropdown clearing its filter) twice.
    this.currentWidget.blur();
    this.currentWidget = null;
    this.emitChange();
  }

  /**
   * Put focus where the frame just painted lets it rest: it stays on a widget
   * the view drew (`drawn`) that can take it, and otherwise moves to the first
   * one on screen that can, or to none.
   *
   * Drawn, not on screen: a widget cropped for the moment — the terminal
   * shrank, a viewport scrolled, an overlay covers it — is still in the view,
   * and keeps focus and whatever focus holds, like a half-typed filter.
   *
   * [LAW:single-enforcer] The one place focus follows the frame — onto the
   * first widget when the app starts, off a widget that stopped being drawn
   * or was disabled.
   */
  @action
  settle(drawn: readonly InteractiveWidget[]): void {
    const current = this.currentWidget;
    if (current && takesFocus(current) && drawn.includes(current)) return;
    const first = this.widgets[0];
    if (first) this.setFocus(first);
    else this.blur();
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

  @action
  private setFocus(widget: InteractiveWidget): void {
    if (this.currentWidget === widget) return;
    // [LAW:single-enforcer] focus()/blur() already dispatch handleFocus —
    // see blur() for the rationale.
    if (this.currentWidget) this.currentWidget.blur();
    this.currentWidget = widget;
    widget.focus();
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
