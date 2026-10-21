/**
 * rich-dash demo body — a dashboard of ticking widgets, in an `App` on the
 * alternate screen.
 *
 * Once a frame the program advances every widget's state, and the app draws
 * every widget's state, in a Panel, into the Layout cell named for it. The app
 * owns the terminal.
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

function draw(panes: readonly Pane[]): void {
  for (const { widget, cell, state } of panes) {
    cell.update(inPanel(widget, widget.render(state)));
  }
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
  // [LAW:no-ambient-temporal-coupling] The widgets are the program's state —
  // live readings of the system and a simulated build, not values of the
  // time — so the program steps them once a frame on the clock it is given,
  // puts what they show in their cells, and asks for a repaint; the view is
  // the layout as it stands. The program holds the one stepping timer, stops
  // it when it hands the terminal back, and starts it again on resume, so a
  // suspended dashboard stands still.
  const app = new App({ host, surface: "alternate", view: layout, clock: caps.clock, rate: frameRate(FPS) });
  // The widgets are made for the app that draws them — the build pane's
  // Progress is timed on its frames — and the app draws nothing until `run`.
  const panes = bindPanes(layout, buildWidgets(caps, app));
  draw(panes);
  const step = (): void => {
    for (const pane of panes) pane.state = pane.widget.tick(pane.state);
    draw(panes);
    app.refresh();
  };
  let stepping = caps.clock.every(frameRate(FPS), step);

  app.onKey((press) => {
    switch (KEYS[keyName(press)]) {
      case "quit":
        app.stop();
        return;
      case "suspend":
        stepping();
        // Resumed into a running app, not one stopped while away.
        void app.suspend().then(() => {
          if (app.phase === "running") stepping = caps.clock.every(frameRate(FPS), step);
        });
        return;
    }
  });

  // The dashboard steps for as long as it runs, and stops on every way `run` settles.
  return { done: app.run().finally(() => stepping()), stop: () => app.stop() };
}
