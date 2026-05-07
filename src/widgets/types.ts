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

export interface KeyEvent {
  key: string;
  character: string;
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

export interface WidgetMouseEvent {
  type: "click" | "mouse_down" | "mouse_up" | "mouse_move" | "scroll_up" | "scroll_down";
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
  handleKey(event: KeyEvent): void;
  handleMouse(event: WidgetMouseEvent): void;
  handleFocus(event: WidgetFocusEvent): void;

  // Programmatic control
  focus(): void;
  blur(): void;
  setDisabled(value: boolean): void;

  // Hit-testing
  containsPoint(x: number, y: number): boolean;

  // Subscriptions
  onChange(handler: (widget: InteractiveWidget) => void): () => void;
  onSubmit(handler: (widget: InteractiveWidget) => void): () => void;
}

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
// (bounds.x, bounds.y + bounds.height), and grows widget.bounds to
// include the overlay area for hit-testing. Render order = z-order:
// the overlay pass runs last, so overlay content wins over anything
// rendered earlier in the frame.
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

  onChange(handler: (current: InteractiveWidget | null) => void): Unsubscribe;
}

// --- Screen ---

export interface Screen {
  mount(...widgets: InteractiveWidget[]): void;
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
