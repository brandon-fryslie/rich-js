/**
 * Screen — owns the render loop and ANSI output for interactive widgets.
 *
 * [LAW:dataflow-not-control-flow] Same pipeline runs every frame: render
 * widgets to Segment[], split into lines, encode to ANSI, write to stdout
 * with cursor-up + overwrite. Variability lives in the values (which widgets
 * are visible, what they render), never in whether the pipeline runs.
 *
 * [LAW:one-source-of-truth] The frame this screen last painted is its hit
 * map (`frame`): every widget stamps its own cells, so the router reads who
 * drew the cell under the pointer straight off the picture the user sees.
 *
 * [LAW:single-enforcer] Cursor management lives in one place: `draw()`
 * tracks `lastLineCount` and emits a single `\x1b[<n>A` to reposition.
 * Per-line `\x1b[K` (erase to end of line) overwrites old content without
 * flicker — no clear-and-redraw cycle.
 *
 * Reactivity: `mobx.autorun` re-fires on any observable read during render
 * (label, focused, hovered, active, disabled, visible, the widget list
 * itself). Renders are debounced to a microtask so a burst of state changes
 * within one tick produces one frame.
 *
 * Layout (per-widget Placement):
 *
 *   flow   — vertical stack at x=0; advances the layout cursor by the
 *            widget's measured height. Default placement; preserves the
 *            historical single-column behavior so existing consumers
 *            (and the screen tests) need no migration.
 *   inline — same row as the preceding flow/inline neighbor; x packs
 *            after that neighbor's right edge plus a one-cell gap. The
 *            row's height is the max of its members; the cursor advances
 *            past the tallest member when the next non-inline item is
 *            placed (or at end of frame).
 *   fixed  — absolute (x, y); independent of the cursor. Used for
 *            anchored content like status/log rows that the host wants
 *            placed at a known coordinate regardless of flow growth.
 *
 * The overlay pass (single enforcer) runs after base layout: any widget
 * implementing OverlayRenderable contributes overlay segments painted
 * directly below its inline footprint and stamped as that widget's rows
 * below it, so a click on the overlay reaches the widget that drew it.
 *
 * Design alternatives considered:
 *   1. Per-widget Placement (chosen) — smallest type that covers the legal
 *      variability; one total switch in computeFrame; back-compat default.
 *   2. Named regions (header/body/status as flow containers) — adds a
 *      two-step API surface (declare regions, then mount into them) and
 *      another concept; rejected as larger than the problem requires.
 *   3. Host-supplied layout function — pushes layout out of Screen,
 *      defeating single-enforcer; rejected.
 */

import { autorun, observableShallow, runInAction, type IReactionDisposer } from "mobx";
import { Segment } from "../core/segment.js";
import { asCellCol, type CellCol } from "../core/cells.js";
import { segmentsToString } from "../core/render.js";
import { ColorDepth, resolveDestination } from "../core/color.js";
import type { Destination } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import { DefaultFocusManager } from "./focus-manager.js";
import { FLOW, hasOverlay } from "./types.js";
import type {
  Screen,
  InteractiveWidget,
  FocusManager,
  MountEntry,
  Placement,
} from "./types.js";
import type { TerminalHost } from "../host/terminal-host.js";

export type ColorSystemSpec =
  | ColorDepth
  | "auto"
  | "truecolor"
  | "256"
  | "ansi"
  | "none"
  | null;

export interface ScreenOptions {
  /**
   * The I/O capability the screen renders against. Construct a
   * `NodeTerminalHost` for production node demos, or pass a host that
   * wraps mock streams for tests. The seam is the type — Screen never
   * reaches for `process.*`.
   */
  host: TerminalHost;
  width?: number;
  colorSystem?: ColorSystemSpec;
  focusManager?: FocusManager;
  /**
   * When true (default when the host reports `isTTY`), hide the cursor
   * on start and restore it on stop. Disable for non-TTY output and tests.
   */
  manageCursor?: boolean;
}

interface FrameLayout {
  // [LAW:one-source-of-truth] The width used to compute this frame.
  // Captured once so layout + clipping + paint all see the same value
  // even if the terminal is resized between the autorun's compute and
  // the microtask-scheduled draw.
  width: number;
  lines: Segment[][];
}

export class DefaultScreen implements Screen {
  readonly focusManager: FocusManager;

  // [LAW:one-source-of-truth] The mounted widget list is observable so
  // mount/unmount triggers the render autorun without an extra subscription.
  @observableShallow
  accessor widgetList: InteractiveWidget[] = [];

  // [LAW:one-source-of-truth] Placements live in a parallel Map keyed by
  // widget. Placements are immutable per mount — Screen sets them and never
  // mutates them, so they don't need to be observable. The observable
  // `widgetList` above already fires reactivity on mount/unmount.
  private readonly placements = new Map<InteractiveWidget, Placement>();

  // [LAW:one-source-of-truth] What the terminal shows now: written by draw()
  // as it writes the same lines to the host, and nowhere else.
  private painted: readonly (readonly Segment[])[] = [];

  private _running = false;
  private autorunDispose: IReactionDisposer | undefined;
  private renderScheduled = false;
  // [LAW:one-source-of-truth] The autorun computes the next frame once and
  // stores it here; draw() reads and clears. Not observable — only the
  // autorun writes, only draw reads, both run in the same single-threaded
  // event loop.
  private pendingFrame: FrameLayout | null = null;
  private lastLineCount = 0;

  private readonly host: TerminalHost;
  private readonly widthOverride: number | undefined;
  private readonly destination: Destination;
  private readonly manageCursor: boolean;

  constructor(options: ScreenOptions) {
    this.host = options.host;
    this.widthOverride = options.width;
    this.focusManager = options.focusManager ?? new DefaultFocusManager();

    this.destination = resolveDestination(
      options.colorSystem === undefined ? "auto" : options.colorSystem,
      { isTTY: this.host.writesToTerminal, env: this.host.env },
    );
    this.manageCursor = options.manageCursor ?? this.host.isTTY;
  }

  get running(): boolean {
    return this._running;
  }

  get frame(): readonly (readonly Segment[])[] {
    return this.painted;
  }

  // --- Lifecycle ---

  mount(...entries: MountEntry[]): void {
    runInAction(() => {
      const next = [...this.widgetList];
      for (const entry of entries) {
        const { widget, placement } = normalizeEntry(entry);
        if (next.includes(widget)) continue;
        next.push(widget);
        this.placements.set(widget, placement);
        this.focusManager.register(widget);
      }
      this.widgetList = next;
    });
  }

  unmount(widget: InteractiveWidget): void {
    runInAction(() => {
      const idx = this.widgetList.indexOf(widget);
      if (idx === -1) return;
      this.widgetList = this.widgetList.filter((w) => w !== widget);
      this.placements.delete(widget);
      this.focusManager.unregister(widget);
    });
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastLineCount = 0;

    if (this.manageCursor) this.host.write("\x1b[?25l");

    // [LAW:dataflow-not-control-flow] One reactive pipeline. The autorun
    // computes the frame (which reads observables; MobX subscribes to
    // exactly what was read so only relevant state changes trigger redraws),
    // caches it as `pendingFrame`, and schedules a microtask to paint it.
    // draw() consumes the cached frame instead of recomputing — without the
    // cache, every tick laid the frame out twice (once for subscription,
    // once for paint).
    this.autorunDispose = autorun(() => {
      this.pendingFrame = this.computeFrame();
      this.scheduleRender();
    });
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;

    if (this.autorunDispose) {
      this.autorunDispose();
      this.autorunDispose = undefined;
    }

    // [LAW:one-source-of-truth] stop() returns the screen to a clean
    // baseline. Without these resets a stopped screen would retain the
    // last FrameLayout — unnecessary memory and a restart hazard where the
    // first frame after restart could leak the pre-stop layout. Same
    // idempotent-cleanup pattern as EventRouter.stop.
    this.pendingFrame = null;
    this.renderScheduled = false;
    this.painted = [];

    if (this.manageCursor) this.host.write("\x1b[?25h");
    if (this.lastLineCount > 0) this.host.write("\n");
  }

  // --- Internal: layout + draw ---

  private get width(): number {
    if (this.widthOverride !== undefined) return this.widthOverride;
    return this.host.size().cols;
  }

  private computeFrame(): FrameLayout {
    // [LAW:one-source-of-truth] Snapshot the width ONCE at the top of
    // the frame so layout, per-widget clipping, per-line clipping, and
    // the final paint all see the same value. Reading `this.width`
    // multiple times can drift across a microtask boundary if the
    // terminal is resized between compute and draw.
    const width = this.width;
    const renderOptions: RenderOptions = {
      maxWidth: width,
      isTerminal: true,
      encoding: "utf-8",
      // [LAW:one-source-of-truth] The depth the frame is encoded at (below,
      // `segmentsToString`), so a renderable that decides on drawn colours
      // decides on the ones this screen draws.
      colorSystem: this.destination.colorSystem,
    };

    const lines: Segment[][] = [];
    // Where pass 1 put each widget's footprint, for pass 2 to paint below.
    const footprints: { widget: InteractiveWidget; x: number; y: number; height: number }[] = [];

    // Layout cursor for flow placement. `cursorY` is the next free row.
    // `lastFlowRow` tracks the most recent flow/inline row so that a
    // following inline placement can pack against its right edge.
    let cursorY = 0;
    interface FlowRow { startY: number; height: number; rightX: number }
    let lastFlowRow: FlowRow | null = null;

    // Pass 1 — base layout. Each widget contributes its inline footprint
    // (Renderable.render). Position is determined by the widget's Placement.
    for (const widget of this.widgetList) {
      // [LAW:dataflow-not-control-flow] Hidden widgets still pass through the
      // pipeline — their data just produces zero rows.
      // The same operations execute every iteration.
      const visible = widget.visible;
      const segments = visible ? Array.from(widget.render(renderOptions)) : [];
      const rawLines = visible ? Segment.splitLines(segments) : [];

      const placement = this.placements.get(widget) ?? FLOW;

      // [LAW:types-are-the-program] Single total switch on the discriminated
      // union: every legal placement gets exactly one branch, the compiler
      // enforces exhaustiveness, and the rest of the pipeline (clip to the
      // remaining screen width, paint into `lines`, record the footprint) is
      // identical for every kind. x/y come from the placement; the available
      // width comes from `this.width - x`.
      let x: number;
      let y: number;
      let prevAtPlacement: FlowRow | null = null;
      switch (placement.kind) {
        case "flow":
          x = 0;
          y = cursorY;
          break;
        case "inline": {
          // Pack onto the most recent flow/inline row. If there is no prior
          // row (inline used as the first item), fall back to flow at x=0.
          prevAtPlacement = lastFlowRow;
          if (prevAtPlacement === null) {
            x = 0;
            y = cursorY;
          } else {
            x = prevAtPlacement.rightX + (prevAtPlacement.rightX > 0 ? 1 : 0);
            y = prevAtPlacement.startY;
          }
          break;
        }
        case "fixed":
          x = placement.x;
          y = placement.y;
          break;
      }

      // [LAW:single-enforcer] Clip widget lines to the remaining screen
      // width here so the footprint matches what actually gets painted. A
      // renderable that emits more cells than its allotted slot (rogue
      // widget, or an inline placement overflowing the screen edge) would
      // otherwise push the inline rightX that subsequent inline widgets pack
      // against past the screen edge.
      const available = Math.max(0, width - x);
      const widgetLines = available > 0
        ? rawLines.map((line) => Segment.adjustLineLength(line, available, undefined, false))
        : [];
      const [w, h] = Segment.getShape(widgetLines);

      paintLines(lines, widgetLines, x, y);
      if (placement.kind === "flow" && h > 0) {
        cursorY = y + h;
        lastFlowRow = { startY: y, height: h, rightX: x + w };
      } else if (placement.kind === "inline" && h > 0) {
        const rowStart: number = prevAtPlacement?.startY ?? y;
        const rowHeight: number = Math.max(prevAtPlacement?.height ?? 0, h);
        cursorY = Math.max(cursorY, rowStart + rowHeight);
        lastFlowRow = { startY: rowStart, height: rowHeight, rightX: x + w };
      }
      // Fixed placements never advance the flow cursor — they are
      // independent anchors. paintLines grows the canvas as needed.

      footprints.push({ widget, x, y, height: h });
    }

    // Pass 2 — overlays. Widgets that implement OverlayRenderable paint
    // ON TOP of the frame, directly below their inline footprint. Render
    // order = z-order: the overlay pass runs last, so overlay rows overwrite
    // anything that was placed below the widget by pass 1, and a click on
    // one reaches the overlay's owner because it painted that cell last.
    // [LAW:single-enforcer] Overlay placement and stamping happen here;
    // widgets never draw their own overlays.
    for (const { widget, x, y, height } of footprints) {
      if (!widget.visible) continue;
      if (!hasOverlay(widget)) continue;
      const overlaySegs = widget.renderOverlay(renderOptions);
      if (overlaySegs === null) continue;
      // Overlay row i is the widget's row height+i: stamp it below `height`
      // empty rows standing in for the footprint, then drop them.
      const overlayRawLines = Segment.anchorLines(
        [...Array.from({ length: height }, () => []), ...Segment.splitLines(overlaySegs)],
        widget,
      ).slice(height);

      // [LAW:single-enforcer] Same per-line clip as the base pass.
      const overlayAvailable = Math.max(0, width - x);
      const overlayLines = overlayAvailable > 0
        ? overlayRawLines.map((line) => Segment.adjustLineLength(line, overlayAvailable, undefined, false))
        : [];
      paintLines(lines, overlayLines, x, y + height);
    }

    return { width, lines };
  }

  private scheduleRender(): void {
    if (this.renderScheduled) return;
    this.renderScheduled = true;
    queueMicrotask(() => {
      this.renderScheduled = false;
      if (this._running) this.draw();
    });
  }

  private draw(): void {
    // [LAW:single-enforcer] One frame per tick. The autorun populates
    // `pendingFrame`; we consume it here. Fall back to a fresh compute if
    // draw is reached without a pending frame (test paths that call draw
    // outside the autorun, or the very first frame before autorun fired).
    const frame = this.pendingFrame ?? this.computeFrame();
    this.pendingFrame = null;
    const { width, lines } = frame;

    // [LAW:single-enforcer] Clip each line to terminal width so wide
    // content can't soft-wrap and break the "1 frame row = 1 terminal
    // row" invariant the redraw loop depends on. Without this, a wrapped
    // line shifts every later row down by one terminal cell, which
    // misaligns overlays and leaves wrap-continuation residue when later
    // frames write narrower content over the same logical row.
    // Use the frame's captured width, not a re-read of this.width —
    // see FrameLayout for the rationale.
    const painted = lines.map((line) => Segment.adjustLineLength(line, width, undefined, false));
    this.painted = painted;

    const newCount = lines.length;
    const drawCount = Math.max(newCount, this.lastLineCount);

    // [LAW:types-are-the-program] After the previous frame wrote N lines
    // with N-1 newlines between them, the cursor sits at end-of-row-N (no
    // trailing newline). Rewinding to the top of the frame is N-1 rows up
    // plus a CR. `\x1b[0A` is still one row up on some terminals, so we
    // skip the CSI entirely when there's only one row to overwrite.
    let buf = "";
    if (this.lastLineCount > 1) {
      buf += `\x1b[${this.lastLineCount - 1}A`;
    }
    buf += "\r";

    for (let i = 0; i < drawCount; i++) {
      const line = painted[i];
      if (line) buf += segmentsToString(line, this.destination);
      // [LAW:single-enforcer] Erase-to-end-of-line is the single mechanism
      // for overwriting stale content. We do not pre-clear lines.
      buf += "\x1b[K";
      if (i < drawCount - 1) buf += "\n";
    }

    this.host.write(buf);
    this.lastLineCount = drawCount;
  }
}

// Normalize a MountEntry into its internal { widget, placement } form.
// Bare widgets default to flow placement so existing call sites (and tests)
// that pass `mount(a, b, c)` keep working unchanged.
function normalizeEntry(entry: MountEntry): { widget: InteractiveWidget; placement: Placement } {
  if ("widget" in entry && "placement" in entry) {
    validatePlacement(entry.placement);
    return { widget: entry.widget, placement: entry.placement };
  }
  return { widget: entry as InteractiveWidget, placement: FLOW };
}

// [LAW:types-are-the-program] mount() is the trust boundary for placements.
// `x` and `y` are typed as `number` but the layout pipeline assumes
// non-negative integers — negative coordinates would index out of bounds in
// paintLines and either crash on bang-asserts or silently skip rows. Reject
// at construction so the rest of the pipeline can assume validity.
function validatePlacement(p: Placement): void {
  if (p.kind !== "fixed") return;
  if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0) {
    throw new RangeError(
      `fixed Placement requires non-negative integer x and y; got (${p.x}, ${p.y})`,
    );
  }
}

// Paint `widgetLines` into the frame `lines` at top-left (x, y). Grows the
// frame as needed and uses cell-accurate splice semantics so a fixed
// placement or overlay overwrites whatever was painted earlier underneath.
//
// [LAW:single-enforcer] All compositing into the frame buffer goes through
// this function. flow/inline/fixed placements and the overlay pass all call
// it, so the rules for "how characters land at (x, y)" live in one place.
function paintLines(
  lines: Segment[][],
  widgetLines: Segment[][],
  x: number,
  y: number,
): void {
  if (widgetLines.length === 0) return;
  while (lines.length < y + widgetLines.length) lines.push([]);
  for (let i = 0; i < widgetLines.length; i++) {
    const target = lines[y + i]!;
    const source = widgetLines[i]!;
    const sourceWidth = lineCellLength(source);
    if (sourceWidth === 0) continue;
    if (x === 0 && target.length === 0) {
      lines[y + i] = source.slice();
      continue;
    }
    lines[y + i] = spliceCells(target, asCellCol(x), sourceWidth, source);
  }
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
