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

interface WidgetMouseEvent {
  type: "click" | "mouse_down" | "mouse_up" | "mouse_move" | "scroll_up" | "scroll_down";
  x: number;             // column (0-based)
  y: number;             // row (0-based)
  button: number;        // 0=left, 1=middle, 2=right
  shift: boolean;
  ctrl: boolean;
}

interface WidgetFocusEvent {
  type: "focus" | "blur";
}

interface WidgetBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### InteractiveWidget

The contract every widget implements. Extends existing `Renderable` and `Measurable`.
Mirrors `src/widgets/types.ts` — that file is the source of truth.

```typescript
interface InteractiveWidget extends Renderable, Measurable {
  // Identity
  readonly id: string;
  readonly focusable: boolean;  // [LAW:one-source-of-truth] single source for focus eligibility

  // Interaction state (MobX observables — mutable so the host and widget itself
  // can drive transitions; pseudo-class names match Textual where applicable):
  //   focus   — keyboard focus (Textual :focus)
  //   hover   — mouse cursor over widget (Textual :hover)
  //   active  — pressed/being activated (web convention, not in Textual)
  focused: boolean;
  hovered: boolean;
  active: boolean;
  disabled: boolean;
  visible: boolean;

  // Geometry — set by host during layout, used for hit-testing
  bounds: WidgetBounds | null;

  // Event handlers — called by host
  handleKey(event: KeyEvent): void;
  handleMouse(event: WidgetMouseEvent): void;
  handleFocus(event: WidgetFocusEvent): void;

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
- **Events**: key=enter/space or mouse_down/up → `onSubmit`
- **Rendering**: single line, fixed width = `cellLen(label) + 4`. Spaces around the label when not focused (`  label  `), `[`/`]` brackets when focused (`[ label ]`). State precedence (highest first): disabled → active → hover → focus → normal.

### Checkbox
- **State**: `checked: boolean`, `label: string`
- **Events**: key=space or click → toggle checked
- **Rendering**: `[✓] label` or `[ ] label`

### Toggle
- **State**: `on: boolean`, `label: string`
- **Events**: key=space or click → toggle on
- **Rendering**: `[ON]  label` / `[OFF] label` with color

### Dropdown
- **State**: `options: string[]`, `selectedIndex: number`, `expanded: boolean`
- **Events**: key=enter/space or click → expand; up/down → navigate; enter → select; escape → close
- **Rendering collapsed**: `selected ▾`; **expanded**: shows option list with highlight

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
  // Map textual-js Click/Mouse message → widget.handleMouse()
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
