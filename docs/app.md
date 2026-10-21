# Terminal Apps

`App` runs a terminal application. It takes the terminal, paints one renderable on it, repaints when you ask and when the terminal is resized, and hands the terminal back on every way the program can end — a crash included.

```ts node
import { RichText } from "@promptctl/rich-js";
import { App, keyName } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const host = new NodeTerminalHost();
let presses = 0;

const app = new App({
  host,
  surface: "alternate",
  view: () => new RichText(`${presses} keys pressed — ctrl+c quits, ctrl+z suspends`),
});

app.onKey((press) => {
  if (keyName(press) === "ctrl+z") return void app.suspend();
  presses += 1;
  app.refresh();
});

await app.run();
```

`App` is on the `host` subpath, beside the `TerminalHost` it runs on. It carries no third-party dependency. An app whose view has [widgets](/widgets) in it — fields, buttons, dropdowns that take focus and clicks — is a `WidgetApp`, which is an `App` with that input added.

## Keys and the pointer

`onKey(handler)` hears every key the terminal sends, as a `KeyPress`: the `key`, the `character` it types (`""` for a key that types none), and whether `shift`, `ctrl` and `meta` were held. `keyName(press)` is the one name a key goes by, so a keymap is a table keyed by it. A key that types a character is named by that character — `q`, `G`, `>` — and any other key by its name — `up`, `enter`, `space`, `f5` — with the modifiers held in front, always in the order `ctrl+`, `meta+`, `shift+`: `ctrl+z`, `shift+tab`, `meta+left`. Shift is never named on a character, which already carries it, with Alt held or not: Shift+G is `G`, Alt+Shift+G is `meta+G`.

`onMouse(handler)` hears every pointer event but the vertical wheel — presses, releases, motion and sideways scrolling — at the terminal cell under the pointer, counted from 0. Only the alternate surface reports the pointer. Each returns a function that stops the handler hearing.

`onWheel(handler)` is offered each notch of the wheel as a `Wheel` — the cell under the pointer and `lines`, `1` towards the end of the content and `-1` back — and returns whether it moved anything with it. A notch nothing moved with is passed outward, to the host's `passWheel`: on a page the page scrolls, and in a terminal, which is the outermost thing, nothing happens. An app that reads no wheel passes every notch, so a still app on a page never traps the page's scrolling. A `WidgetApp` offers the wheel to the viewport under the pointer first, then to its own `onWheel` handlers.

Ctrl+C stops the app. No other key means anything to the app: every other key does what your handlers make it do, so `q` quits only an app that binds it. `quitKeys` lists the keys that stop the app, by `keyName`, and they are heard before any handler, so no handler can swallow one. `["ctrl+c"]` is the default; `[]` leaves every key to you. A name no key goes by — `esc`, `Ctrl+C`, `shift+g` — throws when the app is made, rather than binding a key that never fires:

```ts silent
import { RichText } from "@promptctl/rich-js";
import { App, keyName } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

let last = "nothing yet";
const app = new App({
  host: new NodeTerminalHost(),
  surface: "inline",
  quitKeys: ["q", "escape"],
  view: () => new RichText(`last key: ${last} — q or escape quits`),
});
app.onKey((press) => {
  last = keyName(press);
  app.refresh();
});
```

A handler that throws ends the app with its error, as a frame that throws does.

## The view is asked for every frame

`view` returns the app's root renderable, and `App` calls it once per frame. Keep your state in variables or a store, and build the view from it: the frame always shows the state as it was when the frame was painted. The function is called while the frame is drawn, so it builds and changes nothing; change state in a handler, then ask for a frame. `view` can also be the renderable itself, such as a `Layout` whose cells you update.

`refresh()` asks for a frame. It paints once, after the current task, so several changes made together land in one frame. A resize repaints on its own, so a view that reads the terminal's size shows the new one with no handler of yours:

```ts silent
import { RichText } from "@promptctl/rich-js";
import { App } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const host = new NodeTerminalHost();
const app = new App({
  host,
  surface: "alternate",
  view: () => new RichText(`${host.size().cols} × ${host.size().rows}`),
});
```

The root renders at the terminal's width, with the terminal's rows as its [height](/protocol). On the alternate screen those rows are a region, so a [`Layout`](/layout) fills the whole screen. No row is drawn wider than the terminal or below its last row.

## Animating at a frame rate

What moves in a view is an [`Animation`](/animation#placing-one) placed in it, and the frame it draws says when it next changes. The app paints at its `rate` while the frame says it moves. It wakes once when the frame says it holds until a moment, however soon that is and whatever the rate. It stops ticking when the frame says it never changes, and paints again only when asked. A stopped or suspended app never ticks. Nothing else decides whether the app ticks, so the view is never handed a time.

Every animation is drawn at the frame's time: the app's `clock` read through its [timeline](/animation#playing-in-a-live-or-an-app), which plays from when the app was made at the clock's pace unless the `timeline` option gives another. Setting `app.timeline` paints one frame for the new time, and a paused timeline leaves nothing ticking until it plays again. To show the time itself, map `Animation.time()` to what shows it:

```ts silent
import { Animation, RichText, frameRate } from "@promptctl/rich-js";
import { App } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const app = new App({
  host: new NodeTerminalHost(),
  surface: "inline",
  rate: frameRate(0.5),
  view: Animation.map(Animation.time(), (t) => new RichText(`${Math.floor(t)} s since start`)),
});
```

`frameRate` takes any positive, finite number of frames a second, so `frameRate(0.5)` paints once every two seconds; anything else throws. The rate is 30 frames a second unless you give one, and `app.rate` reads it and sets it: an animation under way goes on at the new rate from its next frame. Nothing the view draws reads a clock: an [effect](/effects) is drawn at the frame's time, so the same view runs at 30 frames a second and at one every two seconds.

`clock` is what the app reads the time from and ticks on. `systemClock()` — the platform's monotonic clock and timers — is the default. Pass your own `Clock` in a test, with a `now()`, an `every(rate, tick)` and an `at(time, tick)` — one tick when the clock reads `time`, which a [`Live`](/live#auto-refresh) waits on until its frame next changes — whose time you move by hand, to count frames with no real timer.

## Two surfaces

`surface: "alternate"` paints on the alternate screen buffer, the whole terminal, and the terminal reports the pointer — presses, motion and the wheel — as input. When the app stops, the terminal shows what it showed before the app started.

`surface: "inline"` paints downward from the start of the cursor's line, as tall as the frame and no taller than the terminal. That line is the frame's first row, so end anything you print before starting the app with a newline. Each frame overwrites the last one in place. When the app stops, the last frame stays on the terminal and the cursor moves below it. The terminal does not report the pointer: it reports a pointer by its row on the screen, and an inline app does not know which row its frame starts on.

## ASCII-only terminals

`asciiOnly: true` paints every frame for a terminal that draws only ASCII: every glyph the library chooses, from borders to widget marks, is drawn in ASCII. It is the same switch as on a [`Console`](/console#ascii-only-terminals).

## Reduced motion

`reducedMotion: true` paints every animation placed in the view as its `reduced()` form, with its motion taken out, and wakes only when content changes. The time itself is not motion: a clock mapped from `Animation.time()` keeps the time, and the app paints it at its rate. It is the same switch as on a [`Console`](/console#reduced-motion); [Animation](/animation#reduced-motion) says what each kind is reduced to.

## Style names and drawing options

`theme`, `onStyleError`, `markup`, `highlight` and `highlighter` are the [`Console`](/console) options of the same names, and every frame is drawn with them, as `asciiOnly` is above. `theme` is the [`Theme`](/protocol#drawing-with-theme-names) a frame resolves style names against. Without one, a frame knows only the built-in names: a `RichText` styled with a name your theme adds draws plain, and `getStyle` throws for it. `onStyleError` [hears each style a frame drops](/style#reporting-dropped-styles), a name your theme lacks included:

```ts silent
import { RichText, Theme } from "@promptctl/rich-js";
import { App } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const app = new App({
  host: new NodeTerminalHost(),
  surface: "inline",
  theme: new Theme({ "health.up": "bold green" }),
  onStyleError: (error) => {
    throw error;
  },
  view: () => new RichText("● up", { style: "health.up" }),
});
```

A `WidgetApp` takes the same options. Its `theme` names styles; it does not colour the widgets, each of which takes its own [`theme`](/widgets#the-widgets) palette.

## Every exit hands the terminal back

While it runs, the app hides the cursor, switches the terminal to raw mode and, on the alternate surface, enters the alternate screen and turns on pointer reporting. All of it is undone when:

- you call `stop()` — `run()` resolves;
- the view throws while a frame is painted — `run()` rejects with that error;
- a key or pointer handler throws — `run()` rejects with that error;
- you call `fail(error)` — `run()` rejects with `error`. Code of yours that the app does not call — a timer, a promise's callback — ends the app this way when it throws, so the error reaches `run()`'s caller with the terminal already handed back;
- the program ends under the app: `process.exit`, `SIGINT`, `SIGTERM`, `SIGHUP`, an uncaught exception or an unhandled rejection — `run()` does not settle, so no code after it runs while the program ends.

In that last case the program still ends the way it would have without the app. A signal still terminates the process, `process.exit` keeps its exit code, and a crash is still reported — after the terminal is handed back, so the report lands on the normal screen instead of vanishing with the alternate one. That holds for [`installTraceback`](/traceback) whichever you set up first.

## Suspending

In raw mode Ctrl+Z reaches the program as a key (`ctrl+z`), not as the signal that suspends it, so the app decides what it means: bind it to `suspend()`, as the first example does. `suspend()` hands the terminal back and stops the process the way the shell's job control does — the whole job, so a launcher such as `npm run` stops with it and the shell gets its prompt back. When the user runs `fg`, the app takes the terminal again and repaints; the promise `suspend()` returned resolves then.

## The same app in a browser

Build the app over a `BrowserTerminalHost` instead — it wraps an [xterm.js](https://xtermjs.org) terminal and takes `passWheel`, what scrolls the page by a notch the app passed outward — and nothing else changes. The page owns the terminal, so in a browser nothing ends the program under the app, and `suspend()` hands the terminal back and takes it again at once.

The `rich-explore`, `rich-dash` and `claude-sessions` demos are each an `App`; each runs in node from its own npm script and on this site's [demos page](/demos/) from the same source.
