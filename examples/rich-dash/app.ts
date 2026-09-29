/**
 * rich-dash demo body — a dashboard of ticking widgets, in an `App` on the
 * alternate screen.
 *
 * The clock advances every widget's state; each frame draws every widget's
 * state, in a Panel, into the Layout cell named for it. The app owns the
 * terminal; this body owns the clock.
 *
 * [LAW:capabilities-over-context] `run` takes a `TerminalHost` and a
 * `DashboardCapabilities` bag — FileSystem, SystemInfo, and the README path
 * the notes widget reads. Node and browser entries supply different values;
 * the demo body has no environment-aware branches.
 */

import { Layout, Panel, RichText, Style, type Renderable } from "../../src/index.js";
import { App, type TerminalHost } from "../../src/host/index.js";
import { buildWidgets, LAYOUT, type DashboardCapabilities } from "./config.js";
import { buildLayout } from "./layout.js";
import type { Widget } from "./widget.js";

const FPS = 8;

// In raw mode Ctrl+C and Ctrl+Z reach the program as keys.
const KEYS: Readonly<Record<string, "quit" | "suspend">> = {
  q: "quit",
  "\x03": "quit",
  "\x1a": "suspend",
};

/** The dashboard, running: `done` settles as `App.run` does. */
export interface Running {
  readonly done: Promise<void>;
  stop(): void;
}

/** A widget, the Layout cell it draws into, and its state now. */
interface Pane {
  readonly widget: Widget;
  readonly cell: Layout;
  state: unknown;
}

// [LAW:parse-dont-validate] Widgets and cells are paired once, here: a widget
// with no cell, or two widgets for one cell, is a config error at startup
// rather than a panel that silently never draws.
function bindPanes(layout: Layout, widgets: readonly Widget[]): Pane[] {
  const ids = new Set<string>();
  return widgets.map((widget) => {
    if (ids.has(widget.id)) {
      throw new Error(`rich-dash: two widgets are named "${widget.id}"`);
    }
    ids.add(widget.id);
    const cell = layout.getByName(widget.id);
    if (!cell) throw new Error(`rich-dash: no layout cell is named "${widget.id}"`);
    return { widget, cell, state: widget.init() };
  });
}

function draw(layout: Layout, panes: readonly Pane[]): Layout {
  for (const { widget, cell, state } of panes) {
    cell.update(inPanel(widget, widget.render(state)));
  }
  return layout;
}

function inPanel(widget: Widget, body: Renderable): Renderable {
  return new Panel(body, {
    title: new RichText(widget.title, { style: Style.parse("bold"), end: "" }),
    borderStyle: widget.borderStyle ?? "cyan",
    padding: [0, 1],
    expand: true,
  });
}

export function run(host: TerminalHost, caps: DashboardCapabilities): Running {
  if (!host.isTTY) {
    throw new Error("rich-dash requires an interactive TTY");
  }

  const layout = buildLayout(LAYOUT);
  const panes = bindPanes(layout, buildWidgets(caps));
  const app = new App({ host, surface: "alternate", view: () => draw(layout, panes) });

  let frame = 0;
  let lastTickAt: number | undefined;
  const tick = (): void => {
    const now = Date.now();
    const ctx = { frame, now, deltaMs: lastTickAt === undefined ? 0 : now - lastTickAt };
    for (const pane of panes) pane.state = pane.widget.tick(pane.state, ctx);
    frame += 1;
    lastTickAt = now;
  };

  const decoder = new TextDecoder();
  host.onData((chunk) => {
    const key = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    switch (KEYS[key]) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        void app.suspend();
        return;
    }
  });

  tick();
  // [LAW:no-ambient-temporal-coupling] The clock lives exactly as long as the
  // app: it starts before the first frame and is cleared on every way `run`
  // settles.
  const clock = setInterval(() => {
    // [LAW:no-silent-failure] The timer calls `tick`, so a widget that throws
    // there would reach neither `done` nor the terminal's hand-back.
    try {
      tick();
    } catch (error) {
      app.fail(error);
      return;
    }
    app.refresh();
  }, 1000 / FPS);
  const done = app.run().finally(() => clearInterval(clock));
  return { done, stop: () => app.stop() };
}
