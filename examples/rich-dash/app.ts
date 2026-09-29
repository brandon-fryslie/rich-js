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
  "\x1b": "quit",
  "\x1a": "suspend",
};

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

export async function run(host: TerminalHost, caps: DashboardCapabilities): Promise<void> {
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

  // [LAW:no-silent-failure] A widget that throws on a tick ends the app with
  // that error, as a frame that throws does: the timer calls it, so a throw
  // left there would reach neither `run`'s caller nor the terminal's hand-back.
  let failure: { readonly error: unknown } | undefined;
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
    try {
      tick();
    } catch (error) {
      failure = { error };
      app.stop();
      return;
    }
    app.refresh();
  }, 1000 / FPS);
  try {
    await app.run();
  } finally {
    clearInterval(clock);
  }
  if (failure) throw failure.error;
}
