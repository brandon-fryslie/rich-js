/**
 * EventRouter — dispatches the keys and pointer events an `App` hears to
 * widgets, via a FocusManager and the frame on screen.
 *
 * It parses nothing and reads no terminal: `App` owns the one parser over its
 * host's input (`host/input`), and `WidgetApp` hands this what the app hears.
 */

import { KeyEvent } from "./types.js";
import type {
  FrameSource,
  InteractiveWidget,
  KeyHandlerOptions,
  KeyHandlerPriority,
} from "./types.js";
import { drew, originOf, scrollTargetAt, widgetAt } from "./hit.js";
import type { Segment } from "../core/segment.js";
import type { Unsubscribe } from "../core/subscription.js";
import type { KeyPress, ScreenMouseEvent } from "../host/input.js";

type KeyHandler = (event: KeyEvent) => void;
interface RegisteredKeyHandler {
  handler: KeyHandler;
  priority: KeyHandlerPriority;
}

// Where a pointer event is delivered: the widget, and the screen position of
// its output's first cell. The widget receives the event minus this origin.
interface Target {
  widget: InteractiveWidget;
  originX: number;
  originY: number;
}

export interface EventRouterOptions {
  source: FrameSource;
}

export class EventRouter {
  private readonly source: FrameSource;
  // [LAW:single-enforcer] Drag capture lives only here. A mouse_down's
  // target is recorded; mouse_move/mouse_up between then and the next
  // mouse_up route to it unconditionally and relative to where it is painted
  // (`relocate`), so a drag past the widget's edge still drives its state
  // (Slider's _dragging) and reports a column outside it. Cleared on the next
  // mouse_up.
  private captured: Target | null = null;
  // Where the terminal last reported the pointer, and the widget under it on
  // the frame on screen — the one widget `hovered` is true on.
  private pointer: { readonly x: number; readonly y: number } | null = null;
  private hoveredWidget: InteractiveWidget | null = null;

  // [LAW:dataflow-not-control-flow] Ordered chain; the dispatcher walks it
  // in priority tiers and stops as soon as some participant calls
  // `event.stop()`. Insertion order is preserved within each tier.
  private readonly keyChain: RegisteredKeyHandler[] = [];
  private readonly mouseHandlers = new Set<(event: ScreenMouseEvent) => void>();

  constructor(options: EventRouterOptions) {
    this.source = options.source;

    // [LAW:single-enforcer] FocusManager owns Tab/Shift+Tab traversal —
    // register it as a normal-priority handler so it participates in the
    // chain. This MUST be the first registration so it lands ahead of any
    // user-added normal handlers; widgets that want to suppress traversal
    // call `event.stop()` from their own handleKey and FocusManager
    // never runs for that event.
    this.onKey((event) => this.source.focusManager.handleKey(event));
  }

  /**
   * Drop what a run left behind — a captured drag, the pointer, hover — so the
   * router is in the shape a fresh construction would be.
   *
   * [LAW:one-source-of-truth] Per-session state belongs to one session.
   */
  reset(): void {
    this.captured = null;
    this.pointer = null;
    this.hover(null);
  }

  /**
   * Read hover again off the frame just painted: under a pointer that has not
   * moved, a widget may have gone, moved, or arrived.
   *
   * [LAW:one-source-of-truth] Hover is the widget under the pointer on the
   * frame on screen, so it is re-read whenever either one changes.
   */
  framePainted(): void {
    const hit = this.pointer && widgetAt(this.source.frame, this.pointer.x, this.pointer.y);
    this.hover(hit ? hit.widget : null);
  }

  // --- External hooks ---

  onKey(handler: KeyHandler, options?: KeyHandlerOptions): Unsubscribe {
    const entry: RegisteredKeyHandler = {
      handler,
      priority: options?.priority ?? "normal",
    };
    this.keyChain.push(entry);
    return () => {
      const idx = this.keyChain.indexOf(entry);
      if (idx !== -1) this.keyChain.splice(idx, 1);
    };
  }

  onMouse(handler: (event: ScreenMouseEvent) => void): Unsubscribe {
    this.mouseHandlers.add(handler);
    return () => this.mouseHandlers.delete(handler);
  }

  /** Route a key the app heard. */
  key(press: KeyPress): void {
    this.dispatchKey(new KeyEvent(press));
  }

  /** Route a pointer event the app heard. */
  mouse(event: ScreenMouseEvent): void {
    this.dispatchMouse(event);
  }

  // --- Dispatch ---

  // [LAW:dataflow-not-control-flow] Three-stage walk; same shape every
  // dispatch, only the event's `stopped` flag short-circuits later stages.
  // The router holds NO key-specific policy — Tab semantics live entirely
  // in FocusManager (registered as a normal-priority handler at construction).
  private dispatchKey(event: KeyEvent): void {
    // [LAW:one-source-of-truth] Snapshot the chain once at the start of
    // dispatch. A handler that unsubscribes itself (or another handler)
    // splices the live keyChain and would shift indices under the running
    // for-of loop, silently skipping the next handler. The snapshot
    // freezes the participant set for this dispatch; later registrations
    // join the chain for the next event, removals take effect after.
    const chain = [...this.keyChain];

    // Stage 1: high-priority handlers (global overrides like Ctrl+C).
    for (const entry of chain) {
      if (event.stopped) return;
      if (entry.priority === "high") entry.handler(event);
    }
    if (event.stopped) return;

    // Stage 2: the focused widget.
    this.source.focusManager.current?.handleKey(event);
    if (event.stopped) return;

    // Stage 3: normal-priority handlers (FocusManager's Tab traversal,
    // plus any app-registered fallbacks).
    for (const entry of chain) {
      if (event.stopped) return;
      if (entry.priority === "normal") entry.handler(event);
    }
  }

  private dispatchMouse(event: ScreenMouseEvent): void {
    for (const handler of this.mouseHandlers) handler(event);

    const frame = this.source.frame;
    const hit = widgetAt(frame, event.x, event.y);
    this.pointer = { x: event.x, y: event.y };
    this.hover(hit?.widget ?? null);

    // The wheel scrolls the innermost viewport under the pointer that can
    // move, a line a notch, past any widget it shows there and whatever a
    // drag captured. With none, nothing moved and there is nothing to paint.
    if (event.type === "scroll_up" || event.type === "scroll_down") {
      const lines = event.type === "scroll_down" ? 1 : -1;
      const target = scrollTargetAt(frame, event.x, event.y, lines);
      if (!target) return;
      target.scrollBy(lines);
      this.source.refresh();
      return;
    }

    // [LAW:dataflow-not-control-flow] Same pipeline every event; the
    // capture value and event type pick the target. mouse_down opens a
    // capture, mouse_up closes it, mouse_move in between routes to the
    // captured widget regardless of pointer position. A hit's origin puts the
    // pressed cell at its own column and row, so every delivery is the same
    // subtraction.
    const useCapture = event.type === "mouse_move" || event.type === "mouse_up";
    const target: Target | null =
      (useCapture && this.captured ? relocate(frame, this.captured) : null) ??
      (hit ? { widget: hit.widget, originX: event.x - hit.col, originY: event.y - hit.row } : null);
    target?.widget.handleMouse({
      ...event,
      x: event.x - target.originX,
      y: event.y - target.originY,
      over: drew(frame, target.widget, event.x, event.y),
    });

    if (event.type === "mouse_down") this.captured = target;
    else if (event.type === "mouse_up") this.captured = null;
  }

  // [LAW:single-enforcer] The canonical setter on the widget is the only
  // writer of `hovered`; this is the only caller, and only on a change.
  private hover(widget: InteractiveWidget | null): void {
    if (widget === this.hoveredWidget) return;
    this.hoveredWidget?.setHovered(false);
    widget?.setHovered(true);
    this.hoveredWidget = widget;
  }
}

// --- Helpers ---

// [LAW:one-source-of-truth] A captured widget's origin is read off the frame
// just painted, so a drag follows the widget if it moved since the press; one
// no longer painted is where the press found it.
function relocate(frame: readonly (readonly Segment[])[], target: Target): Target {
  const origin = originOf(frame, target.widget);
  return origin ? { widget: target.widget, originX: origin.x, originY: origin.y } : target;
}
