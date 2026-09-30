# Terminal Apps

`App` runs a terminal application. It takes the terminal, paints one renderable on it, repaints when you ask and when the terminal is resized, and hands the terminal back on every way the program can end — a crash included.

```ts node
import { RichText } from "@promptctl/rich-js";
import { App } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const host = new NodeTerminalHost();
let presses = 0;

const app = new App({
  host,
  surface: "alternate",
  view: () => new RichText(`${presses} keys pressed — q quits, ctrl+z suspends`),
});

host.onData((chunk) => {
  const key = typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
  if (key === "q") return app.stop();
  if (key === "\x1a") return void app.suspend();
  presses += 1;
  app.refresh();
});

await app.run();
```

`App` is on the `host` subpath, beside the `TerminalHost` it runs on. It carries no third-party dependency. An app whose view has [widgets](/widgets) in it — fields, buttons, dropdowns that take focus and clicks — is a `WidgetApp`, which is an `App` with that input added.

## The view is asked for every frame

`view` returns the app's root renderable, and `App` calls it once per frame. Keep your state in variables or a store, and build the view from it: the frame always shows the state as it was when the frame was painted.

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

## Two surfaces

`surface: "alternate"` paints on the alternate screen buffer, the whole terminal, and the terminal reports the pointer — presses, motion and the wheel — as input. When the app stops, the terminal shows what it showed before the app started.

`surface: "inline"` paints downward from the start of the cursor's line, as tall as the frame and no taller than the terminal. That line is the frame's first row, so end anything you print before starting the app with a newline. Each frame overwrites the last one in place. When the app stops, the last frame stays on the terminal and the cursor moves below it. The terminal does not report the pointer: it reports a pointer by its row on the screen, and an inline app does not know which row its frame starts on.

## ASCII-only terminals

`asciiOnly: true` paints every frame for a terminal that draws only ASCII: every glyph the library chooses, from borders to widget marks, is drawn in ASCII. It is the same switch as on a [`Console`](/console#ascii-only-terminals).

## Themes

`theme` is the [`Theme`](/protocol#drawing-with-theme-names) every frame resolves style names against, as on a `Console`. Without one, a frame knows only the built-in names: a `RichText` styled with a name your theme adds draws plain, and `getStyle` throws for it.

```ts silent
import { RichText, Theme } from "@promptctl/rich-js";
import { App } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const app = new App({
  host: new NodeTerminalHost(),
  surface: "inline",
  theme: new Theme({ "health.up": "bold green" }),
  view: () => new RichText("● up", { style: "health.up" }),
});
```

A `WidgetApp` takes the same option.

## Every exit hands the terminal back

While it runs, the app hides the cursor, switches the terminal to raw mode and, on the alternate surface, enters the alternate screen and turns on pointer reporting. All of it is undone when:

- you call `stop()` — `run()` resolves;
- the view throws while a frame is painted — `run()` rejects with that error;
- you call `fail(error)` — `run()` rejects with `error`. Code of yours that the app does not call — a key handler, a timer — ends the app this way when it throws, so the error reaches `run()`'s caller with the terminal already handed back;
- the program ends under the app: `process.exit`, `SIGINT`, `SIGTERM`, `SIGHUP`, an uncaught exception or an unhandled rejection — `run()` does not settle, so no code after it runs while the program ends.

In that last case the program still ends the way it would have without the app. A signal still terminates the process, `process.exit` keeps its exit code, and a crash is still reported — after the terminal is handed back, so the report lands on the normal screen instead of vanishing with the alternate one. That holds for [`installTraceback`](/traceback) whichever you set up first.

## Suspending

In raw mode Ctrl+Z reaches the program as a key (`"\x1a"`), not as the signal that suspends it, so the app decides what it means. `suspend()` hands the terminal back and stops the process the way the shell's job control does — the whole job, so a launcher such as `npm run` stops with it and the shell gets its prompt back. When the user runs `fg`, the app takes the terminal again and repaints; the promise `suspend()` returned resolves then.

## The same app in a browser

Build the app over a `BrowserTerminalHost` instead — it wraps an [xterm.js](https://xtermjs.org) terminal — and nothing else changes. The page owns the terminal, so in a browser nothing ends the program under the app, and `suspend()` hands the terminal back and takes it again at once.

The `rich-explore`, `rich-dash` and `claude-sessions` demos are each an `App`; each runs in node from its own npm script and on this site's [demos page](/demos/) from the same source.
