/**
 * Interactive widget event types and core interfaces.
 * [LAW:one-source-of-truth] These types are the single authority for the widget contract.
 * Widgets are MobX-observable state machines that implement Renderable,
 * producing Segment[] from current state. They have no knowledge of stdin,
 * terminal escape sequences, or their host environment.
 */

import type { Renderable, Measurable } from "../core/protocol.js";

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

  // Observable state
  readonly focused: boolean;
  readonly disabled: boolean;
  readonly visible: boolean;

  // Geometry — set by host during layout, used for hit-testing
  readonly bounds: WidgetBounds | null;

  // Event handlers
  handleKey(event: KeyEvent): void;
  handleClick(event: WidgetMouseEvent): void;
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
}
