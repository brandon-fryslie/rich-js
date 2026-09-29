---
exampleContext: |
  import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
  import { Button, Slider, StaticItem, TextInput, WidgetApp } from "@promptctl/rich-js/widgets";
  const host = new NodeTerminalHost();
  const app = new WidgetApp({ host, surface: "alternate", view: () => new StaticItem({ id: "empty", render: () => [] }) });
  const save = (): void => {};
  const closeDialog = (): void => {};
  const header = new StaticItem({ id: "header", render: () => [] });
  const nameField = new TextInput({ id: "name" });
  const saveButton = new Button({ label: "Save" });
  const status = new StaticItem({ id: "status", render: () => [] });
---

# Interactive Widgets

Everything else in rich-js draws once and returns. Widgets stay on screen and respond: a button that highlights under the cursor, a text field with a cursor you can move, a dropdown you filter by typing. They are MobX-observable state machines that implement [`Renderable`](/protocol) — you change their state, and the app repaints.

A widget knows nothing about stdin, escape sequences, or the terminal it lives in. It holds state, accepts typed events (`handleKey`, `handleMouse`, `handleFocus`), and renders `Segment[]`. Everything about the outside world is supplied by a host, which is why the same `Button` runs against a real TTY, an xterm.js canvas in a browser, or a mock stream in a test.

Widgets are imported from `@promptctl/rich-js/widgets`, not from the main entry point. They are one of two parts of the library that carry a third-party runtime dependency of their own — MobX here, for the observable state above; `@promptctl/go-template-js` for [template bindings](/template-bindings) — and each gets its own subpath so that dependency stays off the back of a program that only wanted to print a table. MobX is a peer dependency, not a bundled one, so install it alongside this package — `npm install @promptctl/rich-js mobx` — whenever you are using widgets. Without it, importing the subpath fails at import time with `ERR_MODULE_NOT_FOUND`; the main entry point is unaffected.

Two other paths show up in the examples below. `@promptctl/rich-js/host` is the terminal seam — `TerminalHost`, `BrowserTerminalHost`, [`App`](/app) — which is separate because plenty of non-interactive programs want to write through a host and should not pay for the widget set to do it. Core types (`Segment`, `Style`, `Panel`, `Group`) still come from `@promptctl/rich-js`.

## A running app

This is a complete program. Tab between the fields, type a name, Enter on the button:

```typescript live
import { Group, Panel } from "@promptctl/rich-js";
import { Button, Checkbox, TextInput, WidgetApp } from "@promptctl/rich-js/widgets";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const name = new TextInput({ placeholder: "your name" });
const subscribe = new Checkbox({ label: "Subscribe to updates" });
const submit = new Button({ label: "Submit", variant: "primary" });
const form = new Panel(new Group(name, subscribe, submit), { title: "Sign up" });

const app = new WidgetApp({
  host: new NodeTerminalHost(),
  surface: "alternate",
  view: () => form,
});

submit.onSubmit(() => app.stop());

// Raw mode swallows Ctrl+C, so the app must handle it itself.
app.onKey(
  (event) => {
    if (event.ctrl && event.key === "c") {
      event.stop();
      app.stop();
    }
  },
  { priority: "high" },
);

await app.run();
console.log(`${name.value} — subscribed: ${subscribe.checked}`);
```

::: warning Always wire up an exit
While the app runs, the terminal is in raw mode, where Ctrl+C arrives as a key event instead of ending the program. Without a handler like the one above, the only way out is another terminal. `app.stop()` hands the terminal back — raw mode off, pointer reporting off, the cursor shown, the screen as it was — and `run()` resolves. A crash or a signal hands it back too.
:::

## What WidgetApp adds to an App

`WidgetApp` is an [`App`](/app) whose view has widgets in it. It takes the same `host`, `surface` and `view`, runs the same way, and hands the terminal back on the same exits. What it adds is input: keys go to the focused widget, the pointer goes to the widget under it, and a change to anything a frame read paints the next frame.

**Widgets go anywhere a renderable goes.** The form above puts three widgets in a `Group` in a `Panel`; they could as well sit in a [`Layout`](/layout) pane or a [`Table`](/tables) cell. Nothing registers them. Every cell a widget draws is marked as its own, the marks survive every container, and the app reads them off the painted frame to find which widget is where — so a widget nested three containers deep receives a click on the cell the user sees it in.

**Focus moves in document order**, among the widgets on the frame that can take it: the order they are drawn in, so a container's children come in the order it renders them. That is not reading order — in a `Layout` split into two columns, Tab finishes the left column before it starts the right. The first widget that can take focus has it before any key, so the example's `TextInput` is ready to type into. When the focused widget stops being drawn, or is disabled, focus moves to the first one that can take it. `app.focusManager` reads and moves focus directly — `focus(widget)`, `next()`, `prev()`, `blur()` — and `onChange` hears every move.

**Repainting is automatic.** The app tracks every MobX observable read while it draws a frame — a label, `focused`, `checked`, or the state your `view` function reads to decide what to show — and paints a new frame when one changes. Changes made in the same task land in one frame.

**The pointer reaches the widget that drew the cell under it**, as a `WidgetMouseEvent` in the widget's own coordinates: `x` and `y` are the column and row of the cell in its own output, and `over` says whether it drew that cell. A press starts a drag the widget keeps until the button is released, measured from where the widget is painted now, so a slider dragged past its end reads a column beyond its width. Only the alternate surface reports the pointer: an inline frame does not know which row of the screen it starts on, so it gets keys alone.

Construct widgets once, outside the view function. A widget holds its own state — its value, whether it has focus — and a `view` that built a new `TextInput` every frame would never settle: focus moves onto the new one, which repaints, which builds another, and the app spins without ever reading a key.

## Reacting to changes

Every widget exposes two subscriptions, and both return an unsubscribe function.

`onChange` fires when the value changes — a checkbox toggled, a slider moved, a dropdown selection committed. `onSubmit` fires on user-confirmed activation — Enter or a click on a `Button`, Enter in a single-line `TextInput`.

```typescript silent
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

These are notifications about your application's data, not a redraw contract. Redrawing is the app's job: it already tracks the observables that `render()` touches, so a value change repaints whether or not anyone subscribed.

## Key dispatch

One key event walks a three-stage chain, in this order:

1. **High-priority handlers**, in registration order. This tier is for global overrides that must beat whatever is focused — Ctrl+C shutdown, application-level navigation.
2. **The focused widget**, via its `handleKey(event)`.
3. **Normal-priority handlers**, in registration order. The app registers its focus manager's Tab handling here, ahead of anything you add, which is what makes Tab work.

Any participant claims the key by calling `event.stop()`. Once stopped, the chain skips every remaining stage. There is no other way to halt dispatch — no return value, no key-specific branch in the app.

That ordering has a deliberate consequence: Tab traversal runs *after* the focused widget, so a widget suppresses it by claiming Tab itself. `Dropdown` does exactly this while its overlay is open — Tab clears the filter, collapses the list, and keeps focus. Traversal happens on the next Tab, once the widget is collapsed and no longer claims the key.

```typescript silent
// A global handler that beats the focused widget.
app.onKey(
  (event) => {
    if (event.ctrl && event.key === "s") {
      save();
      event.stop();
    }
  },
  { priority: "high" },
);

// A fallback that only sees keys no widget claimed.
app.onKey((event) => {
  if (event.key === "escape") closeDialog();
});
```

Pointer events do not use the chain. Subscribe with `app.onMouse(handler)` and your handler runs *first*, in terminal cells — before the app finds the widget under the pointer, updates hover state, and delivers the event to it. That order makes `onMouse` the place to intercept, which is how an app implements click-to-focus: ask `widgetAt(app.frame, event.x, event.y)` which widget drew the cell, call `app.focusManager.focus(hit.widget)`, and the widget still receives its own event afterwards.

## Layout

Widgets are laid out the way any renderable is: by the container you put them in. A [`Group`](/group) stacks them, [`Columns`](/columns) puts a row of them side by side, and a [`Layout`](/layout) divides the screen into regions — the way to keep a status line on the last row whatever the terminal's height:

```typescript silent
import { Columns, Group, Layout } from "@promptctl/rich-js";

const body = new Group(header, new Columns([nameField, saveButton]));
const view = new Layout();
view.splitColumn(new Layout(body), new Layout(status, { size: 1 }));
```

On the alternate surface the view's height is the whole screen, so the status pane is the terminal's last row.

## The widgets

The six interactive widgets all accept `id`, `disabled`, and `theme` — a [`TerminalTheme`](/transpose) whose palette supplies the widget's colors — and all expose the observable state `focused`, `hovered`, `active`, and `disabled`. `StaticItem`, described last, is the exception: it takes none of those.

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

```ts silent
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

Left and Right move by `step`, Home and End jump to the ends; all values are clamped to `[min, max]` and snapped to the nearest step boundary. Dragging works: mouse-down jumps to the position and starts a drag, and the app keeps sending it the motion outside the widget until the button is released. Renders as `────●────────` at `width` cells, defaulting to 20. A `width` that is not a positive integer throws a `RangeError` at construction.

### StaticItem

`new StaticItem({ id, render, measure? })`

Not interactive — it takes no focus and ignores keys — but it goes in the view like anything else. Use it for headers, labels, and status lines. `render` is either a `Renderable` or a function returning segments; the function form is what you want for a status line that reads observables and repaints when they change.

```typescript silent
import { Segment, Style } from "@promptctl/rich-js";
import { StaticItem } from "@promptctl/rich-js/widgets";

const status = new StaticItem({
  id: "status",
  render: () => [new Segment(`volume: ${volume.value}`, new Style({ dim: true }))],
});
```

Because `render` runs while the app draws a frame, reading `volume.value` there subscribes the frame to it — moving the slider repaints the status line with no extra wiring.

## Writing your own widget

Extend `WidgetBase`. It provides the observable state, focus and hover plumbing, hit-testing, and the `onChange` / `onSubmit` machinery; you supply an `id`, whether the widget is `focusable`, and the three abstract members `handleKey`, `draw`, and `measure`. `WidgetBase.render` calls your `draw` and stamps every cell it returns as this widget's, which is how a click anywhere on it finds it. Call the protected `emitChange()` and `emitSubmit()` to fire subscriptions.

```typescript silent
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

  protected draw(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(`count: ${this.count}`, new Style({ bold: this.focused }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 16, maximum: 16 };
  }
}
```

Two rules keep a custom widget composable. Return a stable width from `measure()` where you can — containers such as `Columns` size by it, and a widget whose width changes with its state makes its neighbours jump. And never emit cursor-positioning control segments: the host owns the screen, and a widget that moves the cursor corrupts the frame around it.

Both decorators are load-bearing. MobX tracks only decorated members, so without `@observable accessor` the counter would change its value, fire `onChange`, and never repaint — the app would have no read to react to. And `@action` on the handler is what keeps MobX's strict mode quiet; mutating an observable outside one warns on every keypress. Importing from `"mobx"` adds nothing to what you already installed to get the widget layer running.

## Overlays

A `Dropdown` expanded over the widgets below it is drawing outside its own footprint, and the mechanism is open to any widget: implement `renderOverlay(options)` alongside `draw(options)`.

`render()` emits the footprint its container lays out — for the dropdown, just the collapsed header. `renderOverlay()` emits segments painted on top of the finished frame, directly below that footprint at the column of its first row, or returns `null` when nothing is active. The app paints overlays after the view, in document order, and marks overlay row *i* as the widget's row *footprint + i*, so the widget reads a click on its overlay in the same coordinates as one on its footprint. Whoever paints a cell last owns it, so a click on an overlay row reaches the widget that drew it rather than whatever lies underneath, and of two overlays that meet, the later one is on top. A widget whose first row is not on the frame — scrolled out of a [`Viewport`](/viewport), say — has nowhere to hang an overlay and paints none.

## Hosting widgets elsewhere

Nothing in a widget depends on `WidgetApp`. Because the contract is `InteractiveWidget` — typed events in, segments out — another framework can drive the same widgets through a thin adapter that maps its own message types onto `handleKey`, `handleMouse`, and `handleFocus`, and feeds `render()` output into its compositor. That adapter belongs in the host framework; rich-js widgets have no knowledge of it.

The same seam makes widgets testable without a terminal. Construct one, call `handleKey(new KeyEvent({ key: "space", character: " ", shift: false, ctrl: false, meta: false }))`, and assert on the state or on the segments `render()` returns — no app, no host, no event loop.
