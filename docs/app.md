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

`App` is on the `host` subpath, beside the `TerminalHost` it runs on. It carries no third-party dependency.

## The view is asked for every frame

`view` returns the app's root renderable, and `App` calls it once per frame. Keep your state in variables or a store, and build the view from it: the frame always shows the state as it was when the frame was painted.

`refresh()` asks for a frame. It paints once, after the current task, so several changes made together land in one frame. A resize repaints on its own.

The root renders at the terminal's width, with the terminal's rows as its [height](/protocol). On the alternate screen those rows are a region, so a [`Layout`](/layout) fills the whole screen. No row is drawn wider than the terminal or below its last row.

## Two surfaces

`surface: "alternate"` paints on the alternate screen buffer, the whole terminal. When the app stops, the terminal shows what it showed before the app started.

`surface: "inline"` paints below the cursor, as tall as the frame and no taller than the terminal. Each frame overwrites the last one in place. When the app stops, the last frame stays on the terminal and the cursor moves below it.

## Every exit hands the terminal back

While it runs, the app hides the cursor, switches the terminal to raw mode and, on the alternate surface, enters the alternate screen. All three are undone when:

- you call `stop()` — `run()` resolves;
- the view throws while a frame is painted — `run()` rejects with that error;
- the program ends under the app: `process.exit`, `SIGINT`, `SIGTERM`, `SIGHUP`, an uncaught exception or an unhandled rejection — `run()` does not settle, so no code after it runs while the program ends.

In that last case the program still ends the way it would have without the app. A signal still terminates the process, `process.exit` keeps its exit code, and a crash is still reported — after the terminal is handed back, so the report lands on the normal screen instead of vanishing with the alternate one. That holds for [`installTraceback`](/traceback) whichever you set up first.

## Suspending

In raw mode Ctrl+Z reaches the program as a key (`"\x1a"`), not as the signal that suspends it, so the app decides what it means. `suspend()` hands the terminal back and stops the process the way the shell's job control does — the whole job, so a launcher such as `npm run` stops with it and the shell gets its prompt back. When the user runs `fg`, the app takes the terminal again and repaints; the promise `suspend()` returned resolves then.

## The same app in a browser

Build the app over a `BrowserTerminalHost` instead — it wraps an [xterm.js](https://xtermjs.org) terminal — and nothing else changes. The page owns the terminal, so in a browser nothing ends the program under the app, and `suspend()` hands the terminal back and takes it again at once.

The `rich-explore` demo is an `App`; it runs from `npm run demo` in node and on this site's [demos page](/demos/) from the same source.
