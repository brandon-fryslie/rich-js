# Interactive Widgets

Everything else in rich-js draws once and returns. Widgets stay on screen and respond: a button that highlights under the cursor, a text field with a cursor you can move, a dropdown you filter by typing. They are MobX-observable state machines that implement [`Renderable`](/protocol) — you change their state, and the screen redraws itself.

A widget knows nothing about stdin, escape sequences, or the terminal it lives in. It holds state, accepts typed events (`handleKey`, `handleMouse`, `handleFocus`), and renders `Segment[]`. Everything about the outside world is supplied by a host, which is why the same `Button` runs against a real TTY, an xterm.js canvas in a browser, or a mock stream in a test.

Widgets are imported from `@promptctl/rich-js/widgets`, not from the main entry point. They are one of two parts of the library that carry a third-party runtime dependency of their own — MobX here, for the observable state above; `@promptctl/go-template-js` for [template bindings](/template-bindings) — and each gets its own subpath so that dependency stays off the back of a program that only wanted to print a table.

Two other paths show up in the examples below. `@promptctl/rich-js/host` is the terminal seam — `TerminalHost`, `BrowserTerminalHost`, `hostStream` — which is separate because plenty of non-interactive programs want to write through a host and should not pay for the widget set to do it. Core types (`Segment`, `Style`, `RenderOptions`) still come from `@promptctl/rich-js`.

## A running app

This is a complete program. Save it, run it, Tab between the fields, Enter on the button:

```typescript
import {
  Button,
  Checkbox,
  TextInput,
  DefaultScreen,
  DefaultFocusManager,
  EventRouter,
} from "@promptctl/rich-js/widgets";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const host = new NodeTerminalHost();
const focusManager = new DefaultFocusManager();
const screen = new DefaultScreen({ host, focusManager });
const router = new EventRouter({ screen, host });

const name = new TextInput({ placeholder: "your name" });
const subscribe = new Checkbox({ label: "Subscribe to updates" });
const submit = new Button({ label: "Submit", variant: "primary" });

const quit = (): void => {
  router.stop();
  screen.stop();
  host.write("\n");
};

submit.onSubmit(() => {
  quit();
  host.write(`${name.value} — subscribed: ${subscribe.checked}\n`);
  process.exit(0);
});

// Raw mode swallows Ctrl+C, so the app must handle it itself.
router.onKey(
  (event) => {
    if (event.ctrl && event.key === "c") {
      event.stop();
      quit();
      process.exit(0);
    }
  },
  { priority: "high" },
);

screen.mount(name, subscribe, submit);
screen.start();
router.start();
```

::: warning Always wire up an exit
`router.start()` puts the terminal into raw mode, where Ctrl+C arrives as a key event instead of killing the process. Without a handler like the one above, the only way out is another terminal. Both `router.stop()` and `screen.stop()` matter on the way out: between them they restore raw mode, disable mouse tracking, and show the cursor again.
:::

## The four runtime pieces

The example constructs four objects before a single widget appears, and each one owns a different question.

**`NodeTerminalHost`** is how the runtime reaches a node terminal — nothing in the widget layer itself touches `process`, so the same widget code runs anywhere a host can be built. Reading node's process streams is why it lives on the `node/terminal-host` subpath rather than in the main barrel — the barrel stays browser-safe. It is the seam: swap it for `BrowserTerminalHost` (which wraps an xterm.js terminal and sits on the `host` subpath beside the `TerminalHost` interface itself) and the rest of the program is unchanged. In tests, construct it over `PassThrough` streams — `new NodeTerminalHost({ stdin, stdout })` — and nothing else needs to know.

**`EventRouter`** reads bytes from the host and turns them into `KeyEvent` and `WidgetMouseEvent` values. It parses escape sequences, holds drag capture during a slider drag, and hit-tests mouse coordinates against widget bounds. On `start()` it enables raw mode and mouse tracking; on `stop()` it puts both back.

**`DefaultFocusManager`** owns which widget has focus and what Tab means. Registering the first focusable, non-disabled widget focuses it, so the example's `TextInput` is focused before the user touches anything.

**`DefaultScreen`** computes layout, runs the render loop, and writes ANSI to the host. It re-renders through a `mobx.autorun`, so any observable read during rendering — a label, `focused`, `checked`, the widget list itself — triggers the next frame. Renders are debounced to a microtask, so a burst of state changes in one tick produces one frame, not five.

You do not have to construct a `DefaultFocusManager` yourself; `DefaultScreen` makes one if you omit it. The example passes one in because the focus manager is often useful directly, for instance to focus a widget on click.

`screen.mount()` registers widgets with the focus manager as well as the layout, so mounting is the only registration step. Nothing renders until `screen.start()`, and no input arrives until `router.start()`.

## Reacting to changes

Every widget exposes two subscriptions, and both return an unsubscribe function.

`onChange` fires when the value changes — a checkbox toggled, a slider moved, a dropdown selection committed. `onSubmit` fires on user-confirmed activation — Enter or a click on a `Button`, Enter in a single-line `TextInput`.

```typescript
const volume = new Slider({ min: 0, max: 11, value: 5 });

const unsubscribe = volume.onChange((widget) => {
  // `widget` is the InteractiveWidget that changed; narrow to read its value.
  if (widget instanceof Slider) {
    host.write(`\nvolume: ${widget.value}\n`);
  }
});

// later
unsubscribe();
```

These are notifications about your application's data, not a redraw contract. Redrawing is MobX's job: the screen's autorun already reads the observables that `render()` touches, so a value change repaints whether or not anyone subscribed.

## Key dispatch

One key event walks a three-stage chain, in this order:

1. **High-priority handlers**, in registration order. This tier is for global overrides that must beat whatever is focused — Ctrl+C shutdown, application-level navigation.
2. **The focused widget**, via `focusManager.current?.handleKey(event)`.
3. **Normal-priority handlers**, in registration order. `EventRouter` registers `FocusManager.handleKey` here at construction, ahead of anything you add, which is what makes Tab work.

Any participant claims the key by calling `event.stop()`. Once stopped, the chain skips every remaining stage. There is no other way to halt dispatch — no return value, no key-specific branch inside the router.

That ordering has a deliberate consequence: Tab traversal runs *after* the focused widget, so a widget suppresses it by claiming Tab itself. `Dropdown` does exactly this while its overlay is open — Tab clears the filter, collapses the list, and keeps focus. Traversal happens on the next Tab, once the widget is collapsed and no longer claims the key.

```typescript
// A global handler that beats the focused widget.
router.onKey(
  (event) => {
    if (event.ctrl && event.key === "s") {
      save();
      event.stop();
    }
  },
  { priority: "high" },
);

// A fallback that only sees keys no widget claimed.
router.onKey((event) => {
  if (event.key === "escape") closeDialog();
});
```

Mouse events do not use the chain. Subscribe with `router.onMouse(handler)` and your handler runs *first* — before the router hit-tests, updates hover state, and delivers the event to the widget under the cursor. That order makes `onMouse` the place to intercept, which is how an app implements click-to-focus: hit-test yourself with `containsPoint`, call `focusManager.focus(hit)`, and the widget still receives its own event afterwards.

## Layout

`DefaultScreen` places each mounted widget according to a `Placement`, and there are three kinds:

- **`flow`** — a vertical stack at column 0, advancing the layout cursor by the widget's height. This is the default, so a bare `screen.mount(a, b, c)` stacks them.
- **`inline`** — the same row as the preceding item, packed after its right edge with a one-cell gap. The row's height is that of its tallest member.
- **`fixed`** — an absolute `(x, y)`, ignoring the layout cursor entirely. Use it for a status line pinned near the bottom of the terminal.

Pass a placement by mounting `{ widget, placement }` instead of a bare widget:

```typescript
import { FLOW } from "@promptctl/rich-js/widgets";

screen.mount(
  header,                                                        // flow (default)
  { widget: nameField, placement: FLOW },
  { widget: saveButton, placement: { kind: "inline" } },         // beside nameField
  { widget: status, placement: { kind: "fixed", x: 0, y: host.size().rows - 1 } },
);
```

## The widgets

The six interactive widgets all accept `id`, `disabled`, and `theme` — a [`TerminalTheme`](/transpose) whose palette supplies the widget's colors — and all expose the observable state `focused`, `hovered`, `active`, `disabled`, and `visible`, plus `bounds` written by the screen during layout. `StaticItem`, described last, is the exception: it takes none of those.

Omit `id` and you get a generated one, but the two kinds differ in a way that matters if you are writing test selectors. `Button`, `Checkbox`, and `Toggle` slugify their label — `new Button({ label: "Save changes" })` is `button-save-changes`, and it is stable. `Dropdown`, `Slider`, and `TextInput` have no label to work from and fall back to a random suffix (`slider-k3f9x1`), which changes on every construction. Pass an explicit `id` to those three whenever anything downstream needs to name them.

### Button

`new Button({ label, variant?, id?, disabled?, theme? })`

Enter, Space, or a click emits `onSubmit`. Renders as `  label  `, with the padding replaced by brackets — `[ label ]` — when focused, so the width never changes between states. The `variant` picks which theme colors it draws in: `"default"`, `"primary"`, `"success"`, `"warning"`, or `"danger"`.

### Checkbox

`new Checkbox({ label, checked?, id?, disabled?, theme? })`

Space or a click toggles `checked` and emits `onChange`; Enter emits `onSubmit` without toggling. Renders as `[✓] label` or `[ ] label`, falling back to `x` when the render options ask for ASCII only.

### Toggle

`new Toggle({ label, on?, variant?, id?, disabled?, theme? })`

Same gestures as `Checkbox`, over an `on` boolean. Renders `[ON]  label` or `[OFF] label` — both indicators are exactly five cells, so the label never shifts. Takes the same five variants as `Button`.

### TextInput

`new TextInput({ value?, placeholder?, maxLength?, password?, multiline?, ... })`

An editable field with a full readline-style key map: arrows and Home/End for character and line motion, Ctrl+A/E/B/F for the same, Alt+B/F and Ctrl+Left/Right for word motion, Ctrl+W/U/K for deletion, Ctrl+Y to yank back, Ctrl+T to transpose. Read the current text from `value`.

In single-line mode, Enter emits `onSubmit` and Up/Down do nothing. Set `multiline: true` and Enter inserts a newline instead, while Up/Down (and Ctrl+P/N) move between *visual* rows.

Multiline mode has a set of options for behaving like a textarea:

| Option | Effect |
| --- | --- |
| `wrap` | A `WrapStrategy` — a function receiving a logical line and a `{ firstWidth, continuationWidth }` budget, returning the `WrapRow`s to draw. Pass the built-in `charGreedyWrap` for a conventional textarea wrap, or write your own to break at token boundaries instead of mid-token. Unset, long lines overflow rather than wrap. |
| `continuationMarker` | Prefix drawn on wrapped continuation rows. Defaults to `"↳ "`, whose width is subtracted from the wrap budget. |
| `minRows` / `maxRows` | Pad to at least, and scroll within at most, this many visual rows. |
| `scrollIndicator` | `"arrows"` (default) draws ▲/▼ in the content area; `"indices"` suppresses them and publishes `scrollIndicatorText` (`"[14/102]"`) for a [`Panel`](/panel) accessory to display; `"none"` draws nothing. |
| `indicatorStyle`, `cursorStyle`, `contentStyle` | [`Style`](/style) overrides for the arrows, the cursor cell, and the text. |

`charGreedyWrap` breaks wherever the line stops fitting, treating wide characters as atomic:

```ts
import { TextInput, charGreedyWrap } from "@promptctl/rich-js/widgets";

const notes = new TextInput({ multiline: true, wrap: charGreedyWrap, maxRows: 6 });
```

A custom strategy is worth writing when the value has a syntax worth respecting. The `rich-template-bindings` demo wraps templates at template-tag boundaries, and falls back to `charGreedyWrap` inside a tag that is itself too wide to fit — where no break point is better than any other.

### Dropdown

`new Dropdown({ options, selectedIndex?, id?, disabled?, theme? })`

Collapsed, it draws a one-row header — `[ selected ▾ ]` — sized to the longest option plus four cells. Enter or Space expands it with the current selection highlighted; Up/Down move; Enter commits and emits both `onChange` and `onSubmit`; Escape clears and closes in one step.

Typing filters. Any printable character expands the dropdown and starts a case-insensitive filter, with no separate "enter filter mode" gesture; the header becomes the filter input, showing the query and a caret. Backspace removes one character. `filteredOptions` derives from `options` and `filter`, and `highlightedIndex` indexes into it — but `selectedIndex` stays canonical and survives filtering untouched. When the filter matches nothing, the list shows a dimmed `(no matches)` and Enter does nothing.

The header's width is invariant: `measure()` returns the same number whatever the filter holds, and a long query is right-clipped rather than allowed to widen the widget.

### Slider

`new Slider({ value?, min?, max?, step?, width?, id?, disabled?, theme? })`

Left and Right move by `step`, Home and End jump to the ends; all values are clamped to `[min, max]` and snapped to the nearest step boundary. Dragging works: mouse-down jumps to the position and starts a drag, and the router keeps capture so motion outside the widget still tracks. Renders as `────●────────` at `width` cells, defaulting to 20. A `width` that is not a positive integer throws a `RangeError` at construction.

### StaticItem

`new StaticItem({ id, render, measure? })`

Not interactive — it takes no focus and ignores keys — but it participates in mount order and layout like anything else. Use it for headers, labels, and status lines. `render` is either a `Renderable` or a function returning segments; the function form is what you want for a status line that reads observables and repaints when they change.

```typescript
import { Segment, Style } from "@promptctl/rich-js";
import { StaticItem } from "@promptctl/rich-js/widgets";

const status = new StaticItem({
  id: "status",
  render: () => [new Segment(`volume: ${volume.value}`, new Style({ dim: true }))],
});
```

Because `render` runs inside the screen's autorun, reading `volume.value` there subscribes the frame to it — moving the slider repaints the status line with no extra wiring.

## Writing your own widget

Extend `WidgetBase`. It provides the observable state, focus and hover plumbing, hit-testing, and the `onChange` / `onSubmit` machinery; you supply an `id`, whether the widget is `focusable`, and the three abstract members `handleKey`, `render`, and `measure`. Call the protected `emitChange()` and `emitSubmit()` to fire subscriptions.

```typescript
import { observable, action } from "mobx";
import { Segment, Style } from "@promptctl/rich-js";
import type { RenderOptions } from "@promptctl/rich-js";
import { WidgetBase } from "@promptctl/rich-js/widgets";
import type { KeyEvent } from "@promptctl/rich-js/widgets";

class Counter extends WidgetBase {
  readonly id = "counter";
  readonly focusable = true;

  @observable accessor count = 0;

  @action
  handleKey(event: KeyEvent): void {
    if (event.key === "up") {
      this.count++;
      this.emitChange();
      event.stop();
    }
  }

  render(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(`count: ${this.count}`, new Style({ bold: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 16, maximum: 16 };
  }
}
```

Two rules keep a custom widget composable. Return a stable width from `measure()` where you can — the screen uses it for layout and hit-testing, and a widget whose width changes with its state makes neighbouring `inline` items jump. And never emit cursor-positioning control segments: the host owns the screen, and a widget that moves the cursor corrupts the frame around it.

Both decorators are load-bearing. `WidgetBase` calls `makeObservable(this)`, which wires up only decorated members, so without `@observable accessor` the counter would change its value, fire `onChange`, and never repaint — the screen's autorun would have no read to react to. And `@action` on the handler is what keeps MobX's strict mode quiet; mutating an observable outside one warns on every keypress. MobX is a dependency of rich-js, so importing from `"mobx"` adds nothing to your install.

## Overlays

A `Dropdown` expanded over the widgets below it is drawing outside its own footprint, and the mechanism is open to any widget: implement `renderOverlay(options)` alongside `render(options)`.

`render()` emits the inline footprint that participates in flow layout — for the dropdown, just the collapsed header. `renderOverlay()` emits segments painted on top of the finished frame, anchored directly below that footprint at the same column, or returns `null` when nothing is active. The screen runs the overlay pass last, grows the widget's `bounds` to cover the painted area, and sorts overlay-active widgets last for hit-testing, so a click on an overlay row reaches the widget that drew it rather than whatever is mounted underneath.

## Hosting widgets elsewhere

Nothing in a widget depends on `DefaultScreen`. Because the contract is `InteractiveWidget` — typed events in, segments out — another framework can drive the same widgets through a thin adapter that maps its own message types onto `handleKey`, `handleMouse`, and `handleFocus`, and feeds `render()` output into its compositor. That adapter belongs in the host framework; rich-js widgets have no knowledge of it.

The same seam makes widgets testable without a terminal. Construct one, call `handleKey(new KeyEvent({ key: "space", character: " ", shift: false, ctrl: false, meta: false }))`, and assert on the state or on the segments `render()` returns — no screen, no host, no event loop.
