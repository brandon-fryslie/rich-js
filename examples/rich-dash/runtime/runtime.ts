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
 * [LAW:locality-or-seam] The runtime owns the tick loop; the entrypoint owns
 *   process lifecycle (signal handling, exit). Don't conflate the two.
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
import { ClipHeight, InjectMaxHeight } from "./clip.js";
import type { TickContext, Widget } from "./widget.js";

export interface RuntimeOptions {
  /** Tree of layout cells; leaf cells have a `name` matching a widget id. */
  layout: Layout;
  /** List of widgets; widget ids must be unique and match Layout cell names. */
  widgets: Widget[];
  /** Frames per second. Must be a finite number > 0. Defaults to 4. */
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
  private _timer: ReturnType<typeof setInterval> | null;

  constructor(options: RuntimeOptions) {
    const fps = options.fps ?? 4;
    if (!Number.isFinite(fps) || fps <= 0) {
      throw new Error(
        `DashboardRuntime: fps must be a finite number > 0 (got ${String(fps)})`,
      );
    }
    this._layout = options.layout;
    this._widgets = options.widgets;
    this._state = new Map();
    this._fps = fps;
    this._frame = 0;
    this._lastTickAt = 0;
    this._stopped = false;
    this._timer = null;

    // [LAW:one-source-of-truth] _state is keyed by widget id; duplicate ids
    // would silently overwrite each other. Fail loudly at construction.
    const seen = new Set<string>();
    for (const widget of this._widgets) {
      if (seen.has(widget.id)) {
        throw new Error(
          `DashboardRuntime: duplicate widget id "${widget.id}". Widget ids must be unique.`,
        );
      }
      seen.add(widget.id);
      this._state.set(widget.id, widget.init());
    }

    const consoleOut = options.console ?? new Console({ forceTerminal: true });
    // Inject the terminal height into the root render so Layout's column
    // splits distribute correctly, and reserve one row to keep Live's
    // trailing newline from scrolling the alt-screen buffer.
    const root = new InjectMaxHeight(this._layout, () => consoleOut.height - 1);
    this._live = new Live(root, {
      console: consoleOut,
      refreshPerSecond: this._fps,
      autoRefresh: false,
      altScreen: true,
    });
  }

  start(): void {
    if (this._timer !== null) {
      throw new Error("DashboardRuntime: already started");
    }
    this._stopped = false;
    this._live.start();
    this._tickAndRender();
    const interval = Math.floor(1000 / this._fps);
    this._timer = setInterval(() => {
      this._tickAndRender();
    }, interval);
  }

  stop(): void {
    if (this._stopped) return;
    this._stopped = true;
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
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
  // Reserve 2 rows for the panel's top/bottom borders so the body never
  // overflows its cell. The 2-row reserve is the same constant Panel uses
  // internally; encoding it once at the seam keeps panel and body in sync.
  return new Panel(new ClipHeight(body, 2), {
    title,
    borderStyle: widget.borderStyle ?? "cyan",
    padding: [0, 1],
    expand: true,
  });
}
