# Interactive Widget Framework Spec

## Overview

Interactive widgets for rich-js: MobX-observable state machines that implement `Renderable`, producing `Segment[]` from current state. Two host environments drive the same widgets:

1. **rich-js standalone** — minimal event loop (raw stdin, focus manager, screen re-render)
2. **textual-js** — existing TUI framework wraps widgets, maps its message system to widget methods

## Architecture

### Dependency graph (no back-edges)

```
protocol (Renderable, Measurable)
    ↓
widget-types (WidgetEvent, InteractiveWidget interface)
    ↓
widgets (Button, Checkbox, Toggle, Dropdown, Slider, TextInput)
    ↓
focus-manager (FocusManager)
    ↓
event-router (parse stdin → WidgetEvent, dispatch)
    ↓
screen (render loop, ANSI output)
```

### Key principle: widgets are pure state machines

A widget does not know about stdin, terminal escape sequences, or its host. It:
- Holds observable state (MobX)
- Accepts typed events via methods (`handleKey`, `handleMouse`, `handleFocus`, `focus`, `blur`)
- Implements `Renderable.render()` to produce `Segment[]` from current state
- Implements `Measurable.measure()` for width negotiation

The host (rich-js standalone or textual-js wrapper) provides events and consumes segments.

## Interfaces

### WidgetEvent

Lightweight event types — no framework dependency. textual-js adapts these from its Message classes.

```typescript
interface KeyEventInit {
  key: string;           // key name: "enter", "tab", "escape", "space", "a", "up", etc.
  character: string;     // printable character or ""
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

// [LAW:types-are-the-program] The "did anyone claim this key?" signal lives
// inside the event value itself, not in a return convention up the call
// stack. A handler that consumes the key calls `event.stop()`; downstream
// participants in the dispatch chain (the focused widget, FocusManager's
// Tab traversal, normal-priority observers) see `event.stopped === true`
// and skip themselves.
class KeyEvent {
  readonly key: string;
  readonly character: string;
  readonly shift: boolean;
  readonly ctrl: boolean;
  readonly meta: boolean;
  readonly stopped: boolean;     // getter; true once any handler called stop()

  constructor(init: KeyEventInit);
  stop(): void;                  // claim this key; halts further chain dispatch
}

interface WidgetMouseEvent {
  type: "mouse_down" | "mouse_up" | "mouse_move" | "scroll_up" | "scroll_down";
  x: number;             // column (0-based)
  y: number;             // row (0-based)
  button: number;        // 0=left, 1=middle, 2=right
  shift: boolean;
  ctrl: boolean;
}

interface WidgetFocusEvent {
  type: "focus" | "blur";
}
```

### InteractiveWidget

The contract every widget implements. Extends existing `Renderable` and `Measurable`.

```typescript
interface InteractiveWidget extends Renderable, Measurable {
  // Identity
  readonly id: string;
  readonly focusable: boolean;  // [LAW:one-source-of-truth] single source for focus eligibility

  // State (MobX observables — mutable; widgets and the host write them
  // through actions, never directly. Treat as read-only from the outside,
  // but TypeScript does not mark these `readonly` because the host
  // (Screen, EventRouter) and the widget itself need write access.)
  focused: boolean;
  hovered: boolean;
  active: boolean;
  disabled: boolean;
  visible: boolean;

  // Geometry — set by host during layout, used for hit-testing
  bounds: { x: number; y: number; width: number; height: number } | null;

  // Event handlers — called by host
  handleKey(event: KeyEvent): void;
  handleMouse(event: WidgetMouseEvent): void;
  handleFocus(event: WidgetFocusEvent): void;

  // Programmatic control
  focus(): void;
  blur(): void;
  setDisabled(value: boolean): void;
  setHovered(value: boolean): void;

  // Hit-testing — does (x,y) fall within this widget's rendered area?
  containsPoint(x: number, y: number): boolean;

  // Semantic notifications — `onChange` fires on app-level value changes
  // (Checkbox toggled, Slider value mutated, Dropdown selection committed);
  // `onSubmit` fires on user-confirmed activation (Enter on Button,
  // mouse_up on Toggle, etc.). They are NOT a render-trigger contract —
  // re-rendering is driven by MobX observables in the widget's render path
  // (a non-MobX host would re-render on every input tick / animation frame,
  // not in reaction to these handlers).
  onChange(handler: (widget: InteractiveWidget) => void): () => void;
  onSubmit(handler: (widget: InteractiveWidget) => void): () => void;
}
```

### FocusManager

```typescript
interface FocusManager {
  readonly current: InteractiveWidget | null;
  readonly widgets: readonly InteractiveWidget[];

  register(widget: InteractiveWidget): void;
  unregister(widget: InteractiveWidget): void;

  // Navigation
  next(): void;   // tab forward
  prev(): void;   // shift+tab
  focus(widget: InteractiveWidget): void;
  blur(): void;

  // [LAW:single-enforcer] FocusManager is the sole owner of Tab/Shift+Tab
  // semantics. EventRouter registers this as a normal-priority chain
  // participant so Tab flows through the same dispatch as any other key —
  // the router holds no key-specific policy.
  handleKey(event: KeyEvent): void;

  // Change notification
  onChange(handler: (current: InteractiveWidget | null) => void): () => void;
}
```

### EventRouter dispatch chain

EventRouter dispatches each parsed `KeyEvent` through a three-stage chain.
Every stage walks the *same* shape — the only thing that varies between
invocations is whether `event.stopped` short-circuits later stages.

```typescript
type KeyHandlerPriority = "high" | "normal";
interface KeyHandlerOptions { priority?: KeyHandlerPriority }  // default "normal"

class EventRouter {
  onKey(handler: (event: KeyEvent) => void, options?: KeyHandlerOptions): Unsubscribe;
  // ...
}
```

Dispatch order for one key event:

1. **High-priority handlers** (insertion order). Use this tier for global
   overrides that must beat a focused widget — e.g. `Ctrl+C` shutdown,
   app-level section navigation.
2. **The focused widget**, via `focusManager.current?.handleKey(event)`.
3. **Normal-priority handlers** (insertion order). FocusManager registers
   its `handleKey` here at router construction, so Tab/Shift+Tab traversal
   happens *after* the focused widget — letting a widget suppress traversal
   simply by calling `event.stop()` from its own `handleKey` (e.g. Dropdown
   while its overlay is open).

Once any participant calls `event.stop()`, the chain skips every remaining
stage. There is no other mechanism for halting dispatch — no return value,
no router-side special case for any specific key.

### Screen

```typescript
// A MountEntry is either a bare widget (defaults to flow placement) or
// a widget paired with an explicit Placement.
//   flow   — vertical stack at x=0; advances the layout cursor
//   inline — continues the row of the preceding flow/inline item, with
//            a one-cell gap, on the same y
//   fixed  — absolute (x, y); does not interact with the layout cursor
type Placement =
  | { kind: "flow" }
  | { kind: "inline" }
  | { kind: "fixed"; x: number; y: number };

type MountEntry =
  | InteractiveWidget
  | { widget: InteractiveWidget; placement: Placement };

interface Screen {
  // Register widgets to display. Bare widgets default to flow placement;
  // pass `{ widget, placement }` for inline / fixed layout.
  mount(...entries: MountEntry[]): void;
  unmount(widget: InteractiveWidget): void;

  // Start/stop the event loop
  start(): void;
  stop(): void;

  // Access
  readonly focusManager: FocusManager;
  readonly running: boolean;
  readonly widgets: readonly InteractiveWidget[];
}
```

## Widgets

### Button
- **State**: `label: string`, `variant: "default" | "primary" | "success" | "warning" | "danger"`
- **Events**: key=enter/space or mouse_up → `onSubmit`
- **Rendering**: `  label  ` when unfocused, `[ label ]` when focused (brackets appear only on focus). Color states compose: `disabled > active > hover > normal`. Active and hover share the same accent-on / WCAG-contrast color pair; active differentiates with bold so the visual press still reads on terminals that don't honor bold weight as a brightness shift.

### Checkbox
- **State**: `checked: boolean`, `label: string`
- **Events**: key=space or mouse_up → toggle checked
- **Rendering**: `[✓] label` or `[ ] label`

### Toggle
- **State**: `on: boolean`, `label: string`
- **Events**: key=space or mouse_up → toggle on
- **Rendering**: `[ON]  label` / `[OFF] label` with color

### Dropdown
- **State**: `options: string[]`, `selectedIndex: number`, `expanded: boolean`, `filter: string`
- **Events**: key=enter/space or mouse_up → expand; up/down → navigate; enter → select; escape → close
- **Rendering collapsed**: `[ <padded-label> ▾ ]` — a 1-row header at width `maxLabelLen + 4` (the `[` + space gutter + centered selected label + arrow + `]`). When filtering, the centered label is replaced by a left-aligned query with a caret (`│` normally, `|` under `asciiOnly`); the header width never changes. The arrow falls back to `v` under `asciiOnly`.
- **Rendering expanded**: the collapsed header stays on the inline row; option rows (or `(no matches)` when filter excludes everything) paint as an overlay directly below, anchored to the header's left edge. Each option row matches the header width. Highlight uses a muted-accent bg + accent fg; the selected row uses the full accent bg + on-accent fg.

#### Filtering (built-in)

The Dropdown has a built-in type-to-filter. The header doubles as the filter input — no sibling TextInput required.

- **Canonical state**: `options` and `selectedIndex` are canonical. `filter: string` is internal view state. `filteredOptions` is derived: the subsequence of `options` whose label contains `filter` (case-insensitive). `highlightedIndex` indexes into `filteredOptions`.
- **Width invariant**: `measure()` returns `maxLabelLen(options) + 4` regardless of filter state. The header reserves this width always; the query is right-clipped if it exceeds `maxLabelLen`. Filtering never changes the inline footprint or the overlay width.
- **Auto-expand on type**: A printable character handled while collapsed expands the dropdown and appends to the filter in one transition. There is no separate "enter filter mode" gesture.
- **Escape**: clears the filter and collapses in a single step. Backspace exists for incremental clearing.
- **Commit (enter or click)**: maps `filteredOptions[highlightedIndex]` back to its index in canonical `options`, assigns to `selectedIndex`, then clears the filter and collapses. Enter while `filteredOptions` is empty is a no-op.
- **Selection preservation under filter**: `selectedIndex` is invariant under filter mutations. If the filter excludes the canonical selection, the overlay simply does not paint a "selected" row — the canonical state is still there and reappears whenever the filter clears.
- **Highlight reset**: any change to `filter` resets `highlightedIndex` to 0. (When the filter is empty, `highlightedIndex` is seeded from `selectedIndex` on expand, as today.)
- **Zero matches**: when `filteredOptions` is empty, the overlay paints a single dimmed row `(no matches)`. Enter is a no-op in this state.
- **Header rendering**:
  - `filter === ""` → `[ selected-label ▾ ]` (today's behavior).
  - `filter !== ""` → `[ query│       ▾ ]` — query left, cursor indicator (when focused), padded out to `maxLabelLen`. Long queries are right-clipped so the header width never grows.

### Slider
- **State**: `value: number`, `min: number`, `max: number`, `step: number`
- **Events**: left/right/home/end → change value; mouse_down → jump to position + start drag; mouse_move while dragging tracks the cursor (EventRouter holds drag capture so motion outside slider bounds still updates value); mouse_up commits + emits submit
- **Rendering**: `────●────────` with position marker

### TextInput
- **State**: `value: string`, `placeholder: string`, `cursorPosition: number`
- **Events**: printable keys → insert; backspace/delete → remove; left/right → cursor; home/end → jump
- **Rendering**: `[value│]` with cursor indicator when focused

## Rendering conventions

- Focused widgets use a distinctive border/highlight style (bright color, underline, or reverse)
- Disabled widgets render dimmed
- All widgets have a deterministic visual size derivable from their state and `maxWidth`
- Widgets never emit cursor-positioning control segments — the host manages screen layout

## textual-js integration

textual-js wraps rich-js widgets via a thin adapter:

```typescript
class RichJsWidgetAdapter {
  constructor(private widget: InteractiveWidget) {}

  // Map textual-js Key message → widget.handleKey()
  // Map textual-js Click / mouse messages → widget.handleMouse() with the
  //   appropriate WidgetMouseEvent type (mouse_down / mouse_up / mouse_move /
  //   scroll_up / scroll_down)
  // Map textual-js Focus/Blur → widget.handleFocus()
  // Wrap widget.render() → Visual for compositor
  // Subscribe to widget.onChange/onSubmit → textual-js state updates
}
```

The adapter lives in textual-js, not rich-js. Rich-js widgets have no knowledge of textual-js.

## Dependencies

- **mobx** — observable state for widgets (already used by textual-js)
- **Existing rich-js core** — Segment, Style, Renderable, Measurable, cellLen
- **No other runtime dependencies**

## Out of scope (v1)

- Layout engine (grid, flex, etc.) — widgets are positioned manually or linearly
- CSS/styling system — widgets accept style params, no cascade
- Scroll regions / virtual scrolling
- Widget trees / nesting
- Keyboard shortcuts beyond tab/shift-tab navigation
- Drag and drop
- Multi-select (dropdown is single-select)
- Accessibility (screen reader announcements)
- Animation
