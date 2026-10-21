/**
 * WidgetApp — an `App` whose view has widgets in it: keys reach the focused
 * widget, the pointer reaches the widget that drew the cell under it, and a
 * change to anything a frame read paints the next one.
 *
 * A widget goes wherever a renderable goes — in a `Panel`, a `Layout` pane, a
 * `Table` cell — and nothing lays it out a second time. Everything added here
 * reads the frame the view drew:
 *
 * - Focus moves in document order: the order the view reports its widgets in
 *   (`RenderOptions.onPresent`), among those with a cell on the frame on screen.
 *   A widget its container hands no column is reported held, not drawn: it is
 *   in the view, so it keeps focus, and it has no cell, so Tab passes it.
 *   Not reading order — in a `Layout` split into columns, reading order
 *   zigzags between the columns row by row.
 * - Overlays are painted over the view's frame, in document order, directly
 *   below their owner's footprint (`OverlayRenderable`). Paint order is the
 *   z-order: a later overlay covers an earlier one.
 * - A pointer event goes to the innermost widget that drew the cell under it
 *   (`widgetAt`), in that widget's own coordinates; the wheel goes to the
 *   innermost `Viewport` that can move (`scrollTargetAt`).
 *
 * [LAW:locality-or-seam] `App` knows nothing of widgets — `host/` depends on
 * `core/` alone — and this reaches it only through the seams it already has:
 * the view is a renderable, `onPaint` hears the frame, and `onKey`/`onMouse`
 * hear the input.
 */

import { Reaction } from "mobx";
import { Segment } from "../core/segment.js";
import type { FrameHost, Presence, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import type { Clock, FrameRate } from "../core/clock.js";
import type { Timeline } from "../core/timeline.js";
import { mapView } from "../core/view.js";
import { App, type AppOptions, type AppPhase, type Wheel } from "../host/app.js";
import { DefaultFocusManager } from "./focus-manager.js";
import { EventRouter } from "./event-router.js";
import { footprintOf, ownersOn } from "./hit.js";
import { hasOverlay } from "./types.js";
import type {
  FocusManager,
  FrameSource,
  KeyEvent,
  KeyHandlerOptions,
} from "./types.js";
import type { AppMouseEvent } from "../host/app.js";
import { WidgetBase } from "./widget-base.js";

export interface WidgetAppOptions extends AppOptions {
  /**
   * Whether a left-button press focuses the widget under it, before it hears the
   * press. `true` unless given.
   */
  readonly focusOnClick?: boolean;
}

/** A widget the view reported for a frame, and whether it was drawn or held. */
export interface WidgetPresence {
  readonly widget: WidgetBase;
  readonly presence: Presence;
}

export class WidgetApp implements FrameSource, FrameHost {
  readonly focusManager: FocusManager;
  private readonly focus: DefaultFocusManager;
  private readonly app: App;
  private readonly router: EventRouter;
  // Paints the next frame when anything the last one read changes.
  private readonly reaction: Reaction;
  private _present: readonly WidgetPresence[] = [];

  constructor(options: WidgetAppOptions) {
    const { focusOnClick = true } = options;
    this.reaction = new Reaction("WidgetApp", () => this.app.refresh());
    // The view is drawn inside `compose`, where what it reads is tracked,
    // whichever shape it was given; it stays the kind of view it was, and
    // when it changes is its own to say, as it would be to the App.
    // Its frames are its own, drawn for its `frameTime`: what draws in them
    // is told this app is the host, not the App it paints through, so
    // `drawnBy: widgetApp` names the host its frames carry.
    this.app = new App({
      ...options,
      view: mapView(options.view, (view) => ({
        render: (renderOptions) =>
          this.compose(view, { ...renderOptions, frame: renderOptions.frame && { time: renderOptions.frame.time, host: this } }),
      })),
    });
    this.focus = new DefaultFocusManager({
      present: () => this.widgets,
      onScreen: () => {
        const owners = ownersOn(this.app.frame);
        return this.widgets.filter((widget) => owners.has(widget));
      },
      frameTime: () => this.frameTime,
    });
    this.focusManager = this.focus;
    this.router = new EventRouter({ source: this, focusOnClick });
    // [LAW:single-enforcer] The app reads the terminal; the router routes
    // what it hears, after the app's quit keys.
    this.app.onKey((press) => this.router.key(press));
    this.app.onMouse((event) => this.router.mouse(event));
    this.app.onWheel((wheel) => this.router.wheel(wheel));
    this.app.onPaint(() => {
      this.focus.settle();
      this.router.framePainted();
    });
    // [LAW:single-enforcer] `settle` judges every focus move, so every move
    // paints — including one onto a widget no frame has read yet.
    this.focus.onChange(() => this.app.refresh());
  }

  get phase(): AppPhase {
    return this.app.phase;
  }

  /** The clock the app reads the time from: where the host time a `Timeline` operation takes is read. */
  get clock(): Clock {
    return this.app.clock;
  }

  /** The map from the clock to the time the view is drawn for; setting it paints the frame for the new time, as `App.timeline` does. */
  get timeline(): Timeline {
    return this.app.timeline;
  }

  set timeline(timeline: Timeline) {
    this.app.timeline = timeline;
  }

  /** How often the app paints while what it shows moves; setting it goes on at the new rate from the next frame, as `App.rate` does. */
  get rate(): FrameRate {
    return this.app.rate;
  }

  set rate(rate: FrameRate) {
    this.app.rate = rate;
  }

  /**
   * The widgets the view reported for the frame on screen, in document order,
   * each drawn or held (`RenderOptions.onPresent`). A held widget is one its
   * container handed no column: in the view, with no cell on the frame.
   */
  get present(): readonly WidgetPresence[] {
    return this._present;
  }

  private get widgets(): readonly WidgetBase[] {
    return this._present.map(({ widget }) => widget);
  }

  /** The rows on screen now, as painted: what a pointer event lands on. */
  get frame(): readonly (readonly Segment[])[] {
    return this.app.frame;
  }

  /** The time a frame drawn now is drawn for, as `App.frameTime` reads it. */
  get frameTime(): number {
    return this.app.frameTime;
  }

  /**
   * Take the terminal, paint the first frame, and route input to its widgets
   * until the app stops — `App.run`, with the input.
   */
  async run(): Promise<void> {
    // App refuses a second run; this one must not end the state of the first.
    if (this.app.phase !== "idle") return this.app.run();
    try {
      await this.app.run();
    } finally {
      this.router.reset();
      this.reaction.dispose();
    }
  }

  stop(): void {
    this.app.stop();
  }

  fail(error: unknown): void {
    this.app.fail(error);
  }

  /**
   * Paint the next frame, as `App.refresh` does. A change to an observable
   * the view read needs none; one no observable carries — a `Viewport`
   * scrolled from a key handler — does.
   */
  refresh(): void {
    this.app.refresh();
  }

  suspend(): Promise<void> {
    return this.app.suspend();
  }

  /** Paint at the app's rate until the returned function is called, as `App.animate` does. */
  animate(): Unsubscribe {
    return this.app.animate();
  }

  /**
   * Hear every key the app does not quit on. A `high` handler hears it before the focused widget, a
   * `normal` one after it — and after Tab has moved focus — and a handler
   * that calls `event.stop()` ends the key there.
   */
  onKey(handler: (event: KeyEvent) => void, options?: KeyHandlerOptions): Unsubscribe {
    return this.router.onKey(handler, options);
  }

  /** Hear every pointer event but the vertical wheel, in terminal cells, before any widget does. */
  onMouse(handler: (event: AppMouseEvent) => void): Unsubscribe {
    return this.router.onMouse(handler);
  }

  /**
   * Offer each wheel turn the viewport under the pointer did not move with to
   * `handler`, as `App.onWheel` does: it returns whether it moved something,
   * and a turn nothing moved with is passed outward.
   */
  onWheel(handler: (wheel: Wheel) => boolean): Unsubscribe {
    return this.app.onWheel(handler);
  }

  private compose(view: () => Renderable, options: RenderOptions): Segment[] {
    // Each widget once, where it was first reported; drawn anywhere, it is drawn.
    const present = new Map<WidgetBase, Presence>();
    // [LAW:parse-dont-validate] What the view reports is any renderable; only
    // a `WidgetBase` is a widget, so this is where a renderable becomes one.
    const onPresent = (renderable: Renderable, presence: Presence): void => {
      if (renderable instanceof WidgetBase) present.set(renderable, present.get(renderable) === "drawn" ? "drawn" : presence);
    };
    // The view, its render and the overlays are all tracked, so an observable
    // any of them reads — a label, `focused`, the state that picks what the
    // view shows — paints the next frame when it changes.
    // An overlay reports what it draws too: a widget in it is in the view,
    // and visiting `present` in report order paints its overlay in turn. A
    // held widget has no footprint on the frame, and so paints none.
    const drawing = { ...options, onPresent };
    const lines = tracked(this.reaction, () => {
      const base = Segment.splitLines(render(view(), drawing));
      for (const widget of present.keys()) paintOverlay(base, widget, drawing);
      return base;
    });
    this._present = [...present].map(([widget, presence]) => ({ widget, presence }));
    return lines.flatMap((line) => [...line, Segment.line()]);
  }
}

/**
 * `fn`, with every observable it reads subscribed to by `reaction`.
 *
 * [LAW:no-silent-failure] mobx reports an error thrown inside `track` and
 * carries on, which would paint an empty frame for a view that threw. The
 * error is carried out instead, and fails the app as `App` fails on any frame
 * that throws.
 */
function tracked<T>(reaction: Reaction, fn: () => T): T {
  // Written inside `track`, which the compiler cannot see run.
  let outcome = {
    ok: false,
    error: new Error("WidgetApp: a frame drawn after the app stopped"),
  } as { ok: true; value: T } | { ok: false; error: unknown };
  reaction.track(() => {
    try {
      outcome = { ok: true, value: fn() };
    } catch (error) {
      outcome = { ok: false, error };
    }
  });
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

/**
 * Paint `widget`'s overlay over `lines`, below its footprint and at the column
 * of its row 0, each overlay row stamped as the widget's row below its last —
 * so a click there reaches the widget, in its own coordinates. A widget whose
 * row 0 is not on the frame has nowhere to hang an overlay, and paints none.
 */
function paintOverlay(lines: Segment[][], widget: WidgetBase, options: RenderOptions): void {
  if (!hasOverlay(widget)) return;
  const at = footprintOf(lines, widget);
  if (!at) return;
  // An overlay floats over the frame; no region holds it, and the cells right
  // of its column are all it can reach.
  const width = Math.max(0, options.maxWidth - at.x);
  const overlay = widget.renderOverlay({ ...options, maxWidth: width, height: undefined });
  if (overlay === null) return;
  const rows = Segment.anchorLines(Segment.splitLines(Segment.cropLines(overlay, width)), widget, at.rows);
  paintLines(lines, rows, at.x, at.y + at.rows);
}

// Paint `rows` into `lines` with its top-left cell at (x, y), growing `lines`
// as needed; each painted cell replaces the one beneath it.
function paintLines(lines: Segment[][], rows: Segment[][], x: number, y: number): void {
  while (lines.length < y + rows.length) lines.push([]);
  rows.forEach((source, i) => {
    const row = lines[y + i]!;
    // Padded to `x`, so a row that ends short of the overlay still reaches it.
    const gap = Math.max(0, x - Segment.getLineLength(row));
    const [before = [], , after = []] = Segment.divide(
      [...row, new Segment(" ".repeat(gap))],
      [x, x + Segment.getLineLength(source)],
    );
    lines[y + i] = [...before, ...source, ...after];
  });
}
