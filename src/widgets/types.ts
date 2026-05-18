/**
 * Interactive widget event types and core interfaces.
 * [LAW:one-source-of-truth] These types are the single authority for the widget contract.
 * Widgets are MobX-observable state machines that implement Renderable,
 * producing Segment[] from current state. They have no knowledge of stdin,
 * terminal escape sequences, or their host environment.
 */

import type { Renderable, Measurable, RenderOptions } from "../core/protocol.js";
import type { Segment } from "../core/segment.js";

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
export interface WidgetMouseEvent {
  type: "mouse_down" | "mouse_up" | "mouse_move" | "scroll_up" | "scroll_down";
  x: number;
  y: number;
  button: number;
  shift: boolean;
  ctrl: boolean;
}

export interface WidgetFocusEvent {
  type: "focus" | "blur";
}

// --- Bounds (set by host during layout) ---

export interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
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
  visible: boolean;

  // Geometry — set by host during layout, used for hit-testing
  bounds: WidgetBounds | null;

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

  // Hit-testing
  containsPoint(x: number, y: number): boolean;

  // Subscriptions
  onChange(handler: (widget: InteractiveWidget) => void): Unsubscribe;
  onSubmit(handler: (widget: InteractiveWidget) => void): Unsubscribe;
}

// --- Placement ---

// [LAW:types-are-the-program] Placement is the discriminated union of "where
// does this item go in the frame". Three kinds cover the legal variability:
//
//   flow   — vertical stack at x=0; advances the layout cursor
//   inline — continues the row of the preceding flow/inline item; same y,
//            x packed after that item's right edge (+ a one-cell gap)
//   fixed  — absolute (x, y); does not interact with the layout cursor
//
// Variability lives in the value (the Placement carried by each mount entry),
// never in whether the layout pipeline runs. computeFrame switches on `kind`
// in one place — the single, total switch the type system enforces.
export type Placement =
  | { kind: "flow" }
  | { kind: "inline" }
  | { kind: "fixed"; x: number; y: number };

export const FLOW: Placement = { kind: "flow" };

// --- Overlay protocol ---

// [LAW:one-source-of-truth] Inline footprint and rendered shape are
// independent. `render()` (Renderable) emits the inline footprint that
// participates in flow layout — for the Dropdown, just the 1-row header.
// `renderOverlay()` emits segments painted ON TOP of the frame after
// base layout, anchored directly below the inline footprint at the same
// column. Returns null when no overlay is active.
//
// The host (Screen / demo render loop) is the single enforcer that runs
// the overlay pass: it iterates widgets in mount order, calls
// renderOverlay on those that opt in, paints the segments at
// (bounds.x, bounds.y + bounds.height), grows widget.bounds to include
// the overlay area, AND publishes hit-test z-order so EventRouter routes
// clicks on overlay rows to the overlay owner instead of widgets mounted
// underneath. Render order = z-order for both paint and hit-test: the
// overlay pass runs last, so overlay content wins on the screen, and
// overlay-active widgets sort last in `Screen.widgets`, so the router's
// topmost-hit returns them ahead of base widgets that happen to be
// mounted later.
export interface OverlayRenderable {
  renderOverlay(options: RenderOptions): Iterable<Segment> | null;
}

export function hasOverlay(value: object): value is OverlayRenderable {
  return (
    "renderOverlay" in value &&
    typeof (value as OverlayRenderable).renderOverlay === "function"
  );
}

// --- Unsubscribe helper ---

export type Unsubscribe = () => void;

// --- FocusManager ---

export interface FocusManager {
  readonly current: InteractiveWidget | null;
  readonly widgets: readonly InteractiveWidget[];

  register(widget: InteractiveWidget): void;
  unregister(widget: InteractiveWidget): void;

  next(): void;
  prev(): void;
  focus(widget: InteractiveWidget): void;
  blur(): void;

  // Dispatch participant — EventRouter registers this as a normal-priority
  // handler so Tab/Shift+Tab participate in the chain like any other key.
  handleKey(event: KeyEvent): void;

  onChange(handler: (current: InteractiveWidget | null) => void): Unsubscribe;
}

// --- Screen ---

// A mount entry is either a bare widget (placement defaults to flow) or a
// widget paired with an explicit placement. The two-shape input is a
// convenience; internally Screen normalizes to { widget, placement }.
export type MountEntry =
  | InteractiveWidget
  | { widget: InteractiveWidget; placement: Placement };

export interface Screen {
  mount(...entries: MountEntry[]): void;
  unmount(widget: InteractiveWidget): void;

  start(): void;
  stop(): void;

  readonly focusManager: FocusManager;
  readonly running: boolean;
  // [LAW:one-source-of-truth] The screen owns the live widget list; the
  // router and other consumers read it from here for hit-testing / layout
  // queries.
  readonly widgets: readonly InteractiveWidget[];
}
