/**
 * Interactive widget event types and core interfaces.
 * [LAW:one-source-of-truth] These types are the single authority for the widget contract.
 * Widgets are MobX-observable state machines that implement Renderable,
 * producing Segment[] from current state. They have no knowledge of stdin,
 * terminal escape sequences, or their host environment.
 */

import type { Renderable, Measurable, RenderOptions } from "../core/protocol.js";
import type { Segment } from "../core/segment.js";
import type { Unsubscribe } from "../core/subscription.js";

// --- Event types ---

// [LAW:types-are-the-program] KeyEvent carries a single mutable signal
// (`stopped`) that participants in the dispatch chain set by calling
// `stop()`. Treating it as an interface would force every handler to
// shuttle a return value upward and the router to interpret it — the
// class collapses that into one self-describing value flowing through
// the chain.
export interface KeyEventInit {
  key: string;
  character: string;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

export class KeyEvent {
  readonly key: string;
  readonly character: string;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  private _stopped = false;

  constructor(init: KeyEventInit) {
    this.key = init.key;
    this.character = init.character;
    this.shift = init.shift;
    this.ctrl = init.ctrl;
    this.meta = init.meta;
  }

  get stopped(): boolean { return this._stopped; }

  // Claim this key. Halts further chain dispatch — no high/normal handler
  // and no focused-widget handler downstream of the caller will see it.
  stop(): void { this._stopped = true; }
}

// Priority tier for registered key handlers. The dispatch chain walks
// "high" first, then the focused widget, then "normal" — see
// EventRouter.dispatchKey.
export type KeyHandlerPriority = "high" | "normal";

export interface KeyHandlerOptions {
  priority?: KeyHandlerPriority;
}

// [LAW:one-source-of-truth] Mouse types are exactly what EventRouter emits.
// There is no "click" — clicks are derived by handlers from mouse_down +
// mouse_up pairs on the same widget. Keeping unreachable values in the
// union would force every consumer to handle a case that never arrives.
// `x`/`y` are the terminal cell under the pointer: what `onMouse` hears.
export interface ScreenMouseEvent {
  type: "mouse_down" | "mouse_up" | "mouse_move" | "scroll_up" | "scroll_down";
  x: number;
  y: number;
  button: number;
  shift: boolean;
  ctrl: boolean;
}

// The same event as one widget receives it. `x`/`y` are in the widget's own
// output: column and row of the cell it drew, or, for a drag it captured,
// relative to where it is painted now — so they fall outside the widget once
// the pointer leaves it. `over` is whether it drew the cell under the pointer.
export interface WidgetMouseEvent extends ScreenMouseEvent {
  over: boolean;
}

export interface WidgetFocusEvent {
  type: "focus" | "blur";
}

// --- InteractiveWidget ---

// [LAW:dataflow-not-control-flow] Widget state is observable data; the host
// reacts to changes, widgets never push rendering commands.
export interface InteractiveWidget extends Renderable, Measurable {
  readonly id: string;
  // [LAW:one-source-of-truth] single source for focus eligibility
  readonly focusable: boolean;

  // Widget interaction states — match Textual pseudo-class naming:
  //   focus  — keyboard focus (Textual :focus)
  //   hover  — mouse cursor over widget (Textual :hover)
  //   active — pressed/being activated (web convention, not in Textual)
  focused: boolean;
  hovered: boolean;
  active: boolean;
  disabled: boolean;

  // Event handlers
  // [LAW:single-enforcer] handleKey claims a key by calling `event.stop()`.
  // The router walks an ordered priority chain; once stopped, no later
  // handler (including framework defaults like Tab → focus traversal) runs.
  handleKey(event: KeyEvent): void;
  handleMouse(event: WidgetMouseEvent): void;
  handleFocus(event: WidgetFocusEvent): void;

  // Programmatic control
  focus(): void;
  blur(): void;
  setDisabled(value: boolean): void;
  setHovered(value: boolean): void;

  // Subscriptions
  onChange(handler: (widget: InteractiveWidget) => void): Unsubscribe;
  onSubmit(handler: (widget: InteractiveWidget) => void): Unsubscribe;
}

// --- Overlay protocol ---

// [LAW:one-source-of-truth] Inline footprint and rendered shape are
// independent. `render()` (Renderable) emits the footprint its container
// lays out — for the Dropdown, just the 1-row header. `renderOverlay()` emits
// segments painted ON TOP of the finished frame, directly below the
// footprint at the column of its first row. Returns null when no overlay is
// active.
//
// The runtime (`WidgetApp`) paints overlays last and stamps overlay row i as
// the widget's row footprint+i, so the widget reads a click on its overlay
// in the same coordinates as one on its header. Painting last is what makes
// the overlay topmost: hit-testing reads the painted frame, and whoever
// painted a cell last owns it.
export interface OverlayRenderable {
  renderOverlay(options: RenderOptions): Iterable<Segment> | null;
}

export function hasOverlay(value: object): value is OverlayRenderable {
  return (
    "renderOverlay" in value &&
    typeof (value as OverlayRenderable).renderOverlay === "function"
  );
}

// --- FocusManager ---

// Which widget has focus, and what Tab means. The widgets it moves between are
// the ones on the frame on screen that can take focus, in document order
// (`RenderOptions.onDraw`): nothing registers with it.
export interface FocusManager {
  readonly current: InteractiveWidget | null;
  /** The widgets Tab moves between, in the order it moves. */
  readonly widgets: readonly InteractiveWidget[];

  next(): void;
  prev(): void;
  focus(widget: InteractiveWidget): void;

  // Dispatch participant — EventRouter registers this as a normal-priority
  // handler so Tab/Shift+Tab participate in the chain like any other key.
  handleKey(event: KeyEvent): void;

  onChange(handler: (current: InteractiveWidget | null) => void): Unsubscribe;
}

// What EventRouter routes against: focus for keys, and the frame most
// recently painted for the pointer (`widgetAt`).
export interface FrameSource {
  readonly focusManager: FocusManager;
  readonly frame: readonly (readonly Segment[])[];
}
