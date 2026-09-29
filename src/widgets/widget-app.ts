/**
 * WidgetApp — an `App` whose view has widgets in it: keys reach the focused
 * widget, the pointer reaches the widget that drew the cell under it, and a
 * change to anything a frame read paints the next one.
 *
 * A widget goes wherever a renderable goes — in a `Panel`, a `Layout` pane, a
 * `Table` cell — and nothing lays it out a second time. Everything added here
 * reads the frame the view drew:
 *
 * - Focus moves in document order: the order widgets start to render in
 *   (`RenderOptions.onDraw`), among those with a cell on the frame on screen.
 *   Not reading order — in a `Layout` split into columns, reading order
 *   zigzags between the columns row by row.
 * - Overlays are painted over the view's frame, in document order, directly
 *   below their owner's footprint (`OverlayRenderable`). Paint order is the
 *   z-order: a later overlay covers an earlier one.
 * - A pointer event goes to the innermost widget that drew the cell under it
 *   (`widgetAt`), in that widget's own coordinates.
 *
 * [LAW:locality-or-seam] `App` knows nothing of widgets — `host/` depends on
 * `core/` alone — and this reaches it only through the seams it already has:
 * the view is a renderable, and `onPaint` hears the frame.
 */

import { Reaction } from "mobx";
import { Segment } from "../core/segment.js";
import { asCellCol, type CellCol } from "../core/cells.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";
import type { Unsubscribe } from "../core/subscription.js";
import { App, type AppOptions, type AppPhase } from "../host/app.js";
import { DefaultFocusManager } from "./focus-manager.js";
import { EventRouter } from "./event-router.js";
import { footprintOf, ownersOn } from "./hit.js";
import { hasOverlay } from "./types.js";
import type {
  FocusManager,
  FrameSource,
  KeyEvent,
  KeyHandlerOptions,
  ScreenMouseEvent,
} from "./types.js";
import { WidgetBase } from "./widget-base.js";

export class WidgetApp implements FrameSource {
  readonly focusManager: FocusManager;
  private readonly focus: DefaultFocusManager;
  private readonly app: App;
  private readonly router: EventRouter;
  // Paints the next frame when anything the last one read changes.
  private readonly reaction: Reaction;
  // The widgets the view drew for the frame on screen, in document order.
  private drawn: readonly WidgetBase[] = [];

  constructor(options: AppOptions) {
    const { view } = options;
    this.reaction = new Reaction("WidgetApp", () => this.app.refresh());
    const root: Renderable = { render: (renderOptions) => this.compose(view, renderOptions) };
    this.app = new App({ ...options, view: () => root });
    this.focus = new DefaultFocusManager(() => {
      const owners = ownersOn(this.app.frame);
      return this.drawn.filter((widget) => owners.has(widget));
    });
    this.focusManager = this.focus;
    this.router = new EventRouter({ source: this, host: options.host });
    this.app.onPaint(() => this.focus.settle());
  }

  get phase(): AppPhase {
    return this.app.phase;
  }

  /** The rows on screen now, as painted: what a pointer event lands on. */
  get frame(): readonly (readonly Segment[])[] {
    return this.app.frame;
  }

  /**
   * Take the terminal, paint the first frame, and route input to its widgets
   * until the app stops — `App.run`, with the input.
   */
  async run(): Promise<void> {
    // App refuses a second run; this one must not end the input of the first.
    if (this.app.phase !== "idle") return this.app.run();
    const running = this.app.run();
    this.router.start();
    try {
      await running;
    } finally {
      this.router.stop();
      this.reaction.dispose();
    }
  }

  stop(): void {
    this.app.stop();
  }

  suspend(): Promise<void> {
    return this.app.suspend();
  }

  /**
   * Hear every key. A `high` handler hears it before the focused widget, a
   * `normal` one after it — and after Tab has moved focus — and a handler
   * that calls `event.stop()` ends the key there.
   */
  onKey(handler: (event: KeyEvent) => void, options?: KeyHandlerOptions): Unsubscribe {
    return this.router.onKey(handler, options);
  }

  /** Hear every pointer event, in terminal cells, before any widget does. */
  onMouse(handler: (event: ScreenMouseEvent) => void): Unsubscribe {
    return this.router.onMouse(handler);
  }

  private compose(view: () => Renderable, options: RenderOptions): Segment[] {
    const drawn = new Set<WidgetBase>();
    // [LAW:parse-dont-validate] An owner is any object; only a `WidgetBase`
    // reports itself as a widget, so this is where `object` becomes one.
    const onDraw = (owner: object): void => {
      if (owner instanceof WidgetBase) drawn.add(owner);
    };
    // The view, its render and the overlays are all tracked, so an observable
    // any of them reads — a label, `focused`, the state that picks what the
    // view shows — paints the next frame when it changes.
    const lines = tracked(this.reaction, () => {
      const base = Segment.splitLines(view().render({ ...options, onDraw }));
      for (const widget of drawn) paintOverlay(base, widget, options);
      return base;
    });
    this.drawn = [...drawn];
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
  // An overlay floats over the frame; no region holds it.
  const overlay = widget.renderOverlay({ ...options, height: undefined });
  if (overlay === null) return;
  const width = Math.max(0, options.maxWidth - at.x);
  const rows = Segment.anchorLines(Segment.splitLines(overlay), widget, at.rows).map((line) =>
    Segment.adjustLineLength(line, width, undefined, false),
  );
  paintLines(lines, rows, at.x, at.y + at.rows);
}

// Paint `rows` into `lines` with its top-left cell at (x, y), growing `lines`
// as needed; each painted cell replaces the one beneath it.
function paintLines(lines: Segment[][], rows: Segment[][], x: number, y: number): void {
  while (lines.length < y + rows.length) lines.push([]);
  rows.forEach((source, i) => {
    const width = lineCellLength(source);
    if (width > 0) lines[y + i] = spliceCells(lines[y + i]!, asCellCol(x), width, source);
  });
}

function lineCellLength(line: Segment[]): CellCol {
  let total = 0;
  for (const s of line) total += s.cellLength;
  return asCellCol(total);
}

// Return a new row with cells [start, start+length) replaced by
// `replacement`. Pads the prefix with spaces if `row` is shorter than
// `start`. Honors wide characters and styled segments by splitting at cell
// boundaries.
function spliceCells(
  row: Segment[],
  start: CellCol,
  length: CellCol,
  replacement: Segment[],
): Segment[] {
  const rowWidth = lineCellLength(row);
  const padded: Segment[] = row.slice();
  if (rowWidth < start) {
    padded.push(new Segment(" ".repeat(start - rowWidth)));
  }

  const prefix: Segment[] = [];
  const suffix: Segment[] = [];
  let cursor = 0;
  for (const seg of padded) {
    const segEnd = cursor + seg.cellLength;
    if (segEnd <= start) {
      prefix.push(seg);
    } else if (cursor >= start + length) {
      suffix.push(seg);
    } else {
      if (cursor < start) {
        const [head] = seg.splitCells(asCellCol(start - cursor));
        if (head.hasText) prefix.push(head);
      }
      if (segEnd > start + length) {
        const [, tail] = seg.splitCells(asCellCol(start + length - cursor));
        if (tail.hasText) suffix.push(tail);
      }
    }
    cursor = segEnd;
  }

  return [...prefix, ...replacement, ...suffix];
}
