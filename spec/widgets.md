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
- Accepts typed events via methods (`handleKey`, `handleClick`, `focus`, `blur`)
- Implements `Renderable.render()` to produce `Segment[]` from current state
- Implements `Measurable.measure()` for width negotiation

The host (rich-js standalone or textual-js wrapper) provides events and consumes segments.

## Interfaces

### WidgetEvent

Lightweight event types — no framework dependency. textual-js adapts these from its Message classes.

```typescript
interface KeyEvent {
  key: string;           // key name: "enter", "tab", "escape", "space", "a", "up", etc.
  character: string;     // printable character or ""
  shift: boolean;
  ctrl: boolean;
  meta: boolean;
}

interface MouseEvent {
  type: "click" | "mouse_down" | "mouse_up" | "mouse_move" | "scroll_up" | "scroll_down";
  x: number;             // column (0-based)
  y: number;             // row (0-based)
  button: number;        // 0=left, 1=middle, 2=right
  shift: boolean;
  ctrl: boolean;
}

interface FocusEvent {
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

  // State (MobX observables)
  readonly focused: boolean;
  readonly disabled: boolean;
  readonly visible: boolean;

  // Geometry — set by host during layout, used for hit-testing
  readonly bounds: { x: number; y: number; width: number; height: number } | null;

  // Event handlers — called by host
  handleKey(event: KeyEvent): void;
  handleClick(event: MouseEvent): void;
  handleFocus(event: FocusEvent): void;

  // Programmatic control
  focus(): void;
  blur(): void;
  setDisabled(value: boolean): void;

  // Hit-testing — does (x,y) fall within this widget's rendered area?
  containsPoint(x: number, y: number): boolean;

  // Change notification — host subscribes to know when to re-render
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

  // Change notification
  onChange(handler: (current: InteractiveWidget | null) => void): () => void;
}
```

### Screen

```typescript
interface Screen {
  // Register widgets to display (ordered left-to-right, top-to-bottom)
  mount(...widgets: InteractiveWidget[]): void;
  unmount(widget: InteractiveWidget): void;

  // Start/stop the event loop
  start(): void;
  stop(): void;

  // Access
  readonly focusManager: FocusManager;
  readonly running: boolean;
}
```

## Widgets

### Button
- **State**: `label: string`, `variant: "default" | "primary" | "success" | "warning" | "danger"`
- **Events**: key=enter or click → `onSubmit`
- **Rendering**: `[ label ]` with style based on focused/disabled state and variant

### Checkbox
- **State**: `checked: boolean`, `label: string`
- **Events**: key=space or click → toggle checked
- **Rendering**: `[✓] label` or `[ ] label`

### Toggle
- **State**: `on: boolean`, `label: string`
- **Events**: key=space or click → toggle on
- **Rendering**: `[ON]  label` / `[OFF] label` with color

### Dropdown
- **State**: `options: string[]`, `selectedIndex: number`, `expanded: boolean`, `filter: string`
- **Events**: key=enter/space or click → expand; up/down → navigate; enter → select; escape → close
- **Rendering collapsed**: `selected ▾`; **expanded**: shows option list with highlight

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
- **Events**: left/right arrows → change value; click → jump to position
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
  // Map textual-js Click message → widget.handleClick()
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
