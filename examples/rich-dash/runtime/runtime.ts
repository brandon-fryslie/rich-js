/**
 * DashboardRuntime — owns the screen, the clock, and widget state.
 *
 * One Live (alt-screen). One tick scheduler. One immutable state map.
 * Each frame:
 *   1. tick every widget (pure state -> state)
 *   2. render every widget (pure state -> Renderable), wrap in a Panel
 *   3. slot panels into named Layout cells
 *   4. refresh Live with the root Layout
 *
 * [LAW:single-enforcer] Live owns the screen. Widgets never write to stdout.
 * [LAW:one-source-of-truth] _state is the canonical map of widget state.
 */

import {
  Console,
  Layout,
  Live,
  Panel,
  RichText,
  Style,
  type Renderable,
} from "../../../src/index.js";
import type { TickContext, Widget } from "./widget.js";

export interface RuntimeOptions {
  /** Tree of layout cells; leaf cells have a `name` matching a widget id. */
  layout: Layout;
  /** Widget registry, keyed by widget id (== Layout cell name). */
  widgets: Widget[];
  /** Frames per second. Defaults to 4. */
  fps?: number;
  /** Console to render into. Defaults to a new alt-screen-capable Console. */
  console?: Console;
}

export class DashboardRuntime {
  private readonly _layout: Layout;
  private readonly _widgets: Widget[];
  private readonly _state: Map<string, unknown>;
  private readonly _live: Live;
  private readonly _fps: number;
  private _frame: number;
  private _lastTickAt: number;
  private _stopped: boolean;

  constructor(options: RuntimeOptions) {
    this._layout = options.layout;
    this._widgets = options.widgets;
    this._state = new Map();
    this._fps = options.fps ?? 4;
    this._frame = 0;
    this._lastTickAt = 0;
    this._stopped = false;

    for (const widget of this._widgets) {
      this._state.set(widget.id, widget.init());
    }

    const consoleOut = options.console ?? new Console({ forceTerminal: true });
    this._live = new Live(this._layout, {
      console: consoleOut,
      refreshPerSecond: this._fps,
      autoRefresh: false,
      altScreen: true,
    });
  }

  start(): void {
    this._live.start();
    this._tickAndRender();
    const interval = Math.floor(1000 / this._fps);
    const timer = setInterval(() => {
      if (this._stopped) {
        clearInterval(timer);
        return;
      }
      this._tickAndRender();
    }, interval);

    const onSignal = (): void => {
      this.stop();
      process.exit(0);
    };
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  }

  stop(): void {
    if (this._stopped) return;
    this._stopped = true;
    this._live.stop();
  }

  private _tickAndRender(): void {
    const now = Date.now();
    const ctx: TickContext = {
      frame: this._frame,
      now,
      deltaMs: this._lastTickAt === 0 ? 0 : now - this._lastTickAt,
    };

    for (const widget of this._widgets) {
      const prev = this._state.get(widget.id);
      const next = widget.tick(prev, ctx);
      this._state.set(widget.id, next);

      const cell = this._layout.getByName(widget.id);
      if (cell) {
        cell.update(wrapInPanel(widget, widget.render(next)));
      }
    }

    this._frame += 1;
    this._lastTickAt = now;
    this._live.refresh();
  }
}

function wrapInPanel(widget: Widget, body: Renderable): Renderable {
  const title = new RichText(widget.title, {
    style: Style.parse("bold"),
    end: "",
  });
  return new Panel(body, {
    title,
    borderStyle: widget.borderStyle ?? "cyan",
    padding: [0, 1],
    expand: true,
  });
}
