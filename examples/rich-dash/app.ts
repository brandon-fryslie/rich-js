/**
 * rich-dash demo body — a dashboard of ticking widgets, in an `App` on the
 * alternate screen.
 *
 * Each frame period advances every widget's state; each frame draws every
 * widget's state, in a Panel, into the Layout cell named for it. The app owns
 * the terminal and the frame clock.
 *
 * [LAW:effects-at-boundaries] `run` takes a `TerminalHost` and a
 * `DashboardCapabilities` bag — Clock, FileSystem, SystemInfo, and the README
 * path the notes widget reads. Node and browser entries supply different values;
 * the demo body has no environment-aware branches.
 */

import { Layout, Panel, RichText, Style, frameRate, type Renderable } from "@promptctl/rich-js";
import { App, keyName, type TerminalHost } from "@promptctl/rich-js/host";
import { buildWidgets, LAYOUT, type DashboardCapabilities } from "./config.js";
import { buildLayout } from "./layout.js";
import type { Widget } from "./widget.js";

const FPS = 8;

// By `keyName`. In raw mode Ctrl+Z reaches the program as a key; Ctrl+C is
// the app's own quit key.
const KEYS: Readonly<Record<string, "quit" | "suspend">> = {
  q: "quit",
  "ctrl+z": "suspend",
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
  // [LAW:no-ambient-temporal-coupling] The app owns the one frame timer and
  // reads the clock; the widgets advance on the frame time it hands the view.
  // A frame repainted inside the period it already drew — a resize, say —
  // shows the same state, and a suspended app paints nothing, so nothing
  // advances until it resumes.
  let period = Math.floor(caps.clock.now() * FPS);
  const view = (t: number): Layout => {
    const now = Math.floor(t * FPS);
    if (now !== period) for (const pane of panes) pane.state = pane.widget.tick(pane.state);
    period = now;
    return draw(layout, panes);
  };
  const app = new App({ host, surface: "alternate", view, clock: caps.clock, rate: frameRate(FPS) });

  app.onKey((press) => {
    switch (KEYS[keyName(press)]) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        void app.suspend();
        return;
    }
  });

  // The dashboard moves for as long as it runs; the app releases the timer
  // on every way `run` settles.
  app.animate();
  return { done: app.run(), stop: () => app.stop() };
}
