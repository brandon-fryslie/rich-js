/**
 * FocusManager — flat focus cycling over registered widgets.
 * [LAW:one-source-of-truth] single authority for which widget has focus.
 * [LAW:dataflow-not-control-flow] focus transitions are observable state;
 * widgets react to focus/blur events, the manager never skips dispatch.
 */

import { makeObservable, observable, action } from "mobx";
import type {
  InteractiveWidget,
  FocusManager,
  Unsubscribe,
} from "./types.js";

export class DefaultFocusManager implements FocusManager {
  @observable.shallow
  accessor widgetList: InteractiveWidget[] = [];

  @observable.ref
  accessor currentWidget: InteractiveWidget | null = null;

  private readonly changeHandlers = new Set<(current: InteractiveWidget | null) => void>();

  constructor() {
    makeObservable(this);
  }

  get current(): InteractiveWidget | null {
    return this.currentWidget;
  }

  get widgets(): readonly InteractiveWidget[] {
    return this.widgetList;
  }

  @action
  register(widget: InteractiveWidget): void {
    this.widgetList = [...this.widgetList, widget];
    if (!this.currentWidget && widget.focusable && !widget.disabled) {
      this.setFocus(widget);
    }
  }

  @action
  unregister(widget: InteractiveWidget): void {
    const idx = this.widgetList.indexOf(widget);
    if (idx === -1) return;
    this.widgetList = this.widgetList.filter((w) => w !== widget);

    if (this.currentWidget === widget) {
      widget.blur();
      widget.handleFocus({ type: "blur" });
      const next = this.widgetList.find((w) => w.focusable && !w.disabled) ?? null;
      if (next) {
        next.focus();
        next.handleFocus({ type: "focus" });
      }
      this.currentWidget = next;
      this.emitChange();
    }
  }

  @action
  next(): void {
    const focusable = this.focusableWidgets();
    if (focusable.length === 0) return;

    const currentIdx = this.currentWidget ? focusable.indexOf(this.currentWidget) : -1;
    const nextIdx = (currentIdx + 1) % focusable.length;
    this.setFocus(focusable[nextIdx]!);
  }

  @action
  prev(): void {
    const focusable = this.focusableWidgets();
    if (focusable.length === 0) return;

    const currentIdx = this.currentWidget ? focusable.indexOf(this.currentWidget) : -1;
    const prevIdx = currentIdx <= 0 ? focusable.length - 1 : currentIdx - 1;
    this.setFocus(focusable[prevIdx]!);
  }

  @action
  focus(widget: InteractiveWidget): void {
    if (!widget.focusable || widget.disabled) return;
    if (!this.widgetList.includes(widget)) return;
    this.setFocus(widget);
  }

  @action
  blur(): void {
    if (!this.currentWidget) return;
    this.currentWidget.blur();
    this.currentWidget.handleFocus({ type: "blur" });
    this.currentWidget = null;
    this.emitChange();
  }

  onChange(handler: (current: InteractiveWidget | null) => void): Unsubscribe {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  // --- Private ---

  private focusableWidgets(): InteractiveWidget[] {
    return this.widgetList.filter((w) => w.focusable && !w.disabled);
  }

  @action
  private setFocus(widget: InteractiveWidget): void {
    if (this.currentWidget === widget) return;
    if (this.currentWidget) {
      this.currentWidget.blur();
      this.currentWidget.handleFocus({ type: "blur" });
    }
    this.currentWidget = widget;
    widget.focus();
    widget.handleFocus({ type: "focus" });
    this.emitChange();
  }

  private emitChange(): void {
    for (const handler of this.changeHandlers) {
      handler(this.currentWidget);
    }
  }
}
