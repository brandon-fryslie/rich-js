/**
 * Screen — owns the render loop and ANSI output for interactive widgets.
 *
 * [LAW:dataflow-not-control-flow] Same pipeline runs every frame: render
 * widgets to Segment[], split into lines, encode to ANSI, write to stdout
 * with cursor-up + overwrite. Variability lives in the values (which widgets
 * are visible, what they render), never in whether the pipeline runs.
 *
 * [LAW:one-source-of-truth] Layout (widget bounds) is computed here and
 * written to widget.bounds. Mouse hit-testing reads the same bounds — the
 * Screen is the single authority on where each widget is drawn.
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
 */

import { autorun, makeObservable, observable, runInAction, type IReactionDisposer } from "mobx";
import { Segment } from "../core/segment.js";
import { segmentsToString } from "../core/render.js";
import { ColorDepth, resolveColorSystem } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import { DefaultFocusManager } from "./focus-manager.js";
import type {
  Screen,
  InteractiveWidget,
  FocusManager,
  WidgetBounds,
} from "./types.js";

export type ColorSystemSpec =
  | ColorDepth
  | "auto"
  | "truecolor"
  | "256"
  | "ansi"
  | "none"
  | null;

export interface ScreenOptions {
  out?: NodeJS.WritableStream;
  width?: number;
  colorSystem?: ColorSystemSpec;
  focusManager?: FocusManager;
  /**
   * When true (default when stdout is a TTY), hide the cursor on start and
   * restore it on stop. Disable for non-TTY output and tests.
   */
  manageCursor?: boolean;
}

interface FrameLayout {
  lines: Segment[][];
  bounds: { widget: InteractiveWidget; bounds: WidgetBounds }[];
}

const DEFAULT_WIDTH = 80;

export class DefaultScreen implements Screen {
  readonly focusManager: FocusManager;

  // [LAW:one-source-of-truth] The mounted widget list is observable so
  // mount/unmount triggers the render autorun without an extra subscription.
  @observable.shallow
  accessor widgetList: InteractiveWidget[] = [];

  private _running = false;
  private autorunDispose: IReactionDisposer | undefined;
  private renderScheduled = false;
  private lastLineCount = 0;
  // [LAW:one-source-of-truth] The autorun computes the frame to subscribe to
  // observables; draw() consumes the same frame instead of recomputing. One
  // computeFrame() call per reactive tick.
  private pendingFrame: FrameLayout | null = null;

  private readonly out: NodeJS.WritableStream;
  private readonly widthOverride: number | undefined;
  private readonly colorSystem: ColorDepth | null;
  private readonly manageCursor: boolean;

  constructor(options: ScreenOptions = {}) {
    this.out = options.out ?? process.stdout;
    this.widthOverride = options.width;
    this.focusManager = options.focusManager ?? new DefaultFocusManager();

    const isTTY = (this.out as NodeJS.WriteStream).isTTY ?? false;
    this.colorSystem = resolveSpec(options.colorSystem, isTTY);
    this.manageCursor = options.manageCursor ?? isTTY;

    makeObservable(this);
  }

  get running(): boolean {
    return this._running;
  }

  get widgets(): readonly InteractiveWidget[] {
    return this.widgetList;
  }

  // --- Lifecycle ---

  mount(...widgets: InteractiveWidget[]): void {
    runInAction(() => {
      const next = [...this.widgetList];
      for (const w of widgets) {
        if (next.includes(w)) continue;
        next.push(w);
        this.focusManager.register(w);
      }
      this.widgetList = next;
    });
  }

  unmount(widget: InteractiveWidget): void {
    runInAction(() => {
      const idx = this.widgetList.indexOf(widget);
      if (idx === -1) return;
      this.widgetList = this.widgetList.filter((w) => w !== widget);
      this.focusManager.unregister(widget);
    });
  }

  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastLineCount = 0;

    if (this.manageCursor) this.out.write("\x1b[?25l");

    // [LAW:dataflow-not-control-flow] One reactive pipeline. The autorun
    // computes the frame (which transitively reads every observable used
    // during layout/render); MobX subscribes to exactly what was read, so
    // only relevant state changes trigger redraws. We cache the frame here
    // and reuse it in draw() — one computeFrame() per reactive tick.
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
    this.pendingFrame = null;

    if (this.manageCursor) this.out.write("\x1b[?25h");
    if (this.lastLineCount > 0) this.out.write("\n");
  }

  // --- Internal: layout + draw ---

  private get width(): number {
    if (this.widthOverride !== undefined) return this.widthOverride;
    const cols = (this.out as NodeJS.WriteStream).columns;
    return cols ?? DEFAULT_WIDTH;
  }

  private computeFrame(): FrameLayout {
    const renderOptions: RenderOptions = {
      maxWidth: this.width,
      isTerminal: true,
      encoding: "utf-8",
    };

    const lines: Segment[][] = [];
    const boundsList: { widget: InteractiveWidget; bounds: WidgetBounds }[] = [];
    let y = 0;

    for (const widget of this.widgetList) {
      // [LAW:dataflow-not-control-flow] Hidden widgets still pass through the
      // pipeline — their data just produces zero rows and zero-size bounds.
      // The same operations execute every iteration.
      const visible = widget.visible;
      const segments = visible ? Array.from(widget.render(renderOptions)) : [];
      const widgetLines = visible ? Segment.splitLines(segments) : [];
      const [w, h] = Segment.getShape(widgetLines);
      boundsList.push({ widget, bounds: { x: 0, y, width: w, height: h } });
      for (const line of widgetLines) lines.push(line);
      y += h;
    }

    return { lines, bounds: boundsList };
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
    // [LAW:no-defensive-null-guards] draw() only runs after the autorun has
    // populated pendingFrame (start() seeds it before scheduling). Treating
    // a null frame as a bug — fail loudly rather than silently re-compute.
    const frame = this.pendingFrame!;
    const { lines, bounds } = frame;

    // [LAW:single-enforcer] Bounds are written here, the only place that
    // computes layout. Widgets must not set their own bounds.
    runInAction(() => {
      for (const { widget, bounds: b } of bounds) widget.bounds = b;
    });

    const newCount = lines.length;
    const drawCount = Math.max(newCount, this.lastLineCount);

    let buf = "";
    if (this.lastLineCount > 0) {
      buf += `\x1b[${this.lastLineCount}A`;
    }
    buf += "\r";

    for (let i = 0; i < drawCount; i++) {
      const line = lines[i];
      if (line) buf += segmentsToString(line, this.colorSystem);
      // [LAW:single-enforcer] Erase-to-end-of-line is the single mechanism
      // for overwriting stale content. We do not pre-clear lines.
      buf += "\x1b[K";
      if (i < drawCount - 1) buf += "\n";
    }

    this.out.write(buf);
    this.lastLineCount = drawCount;
  }
}

// [LAW:single-enforcer] One function resolves the color-system spec into a
// ColorDepth (or null). String specs route through resolveColorSystem; enum
// values pass through; null/`"none"` strip color.
function resolveSpec(
  spec: ColorSystemSpec | undefined,
  isTTY: boolean,
): ColorDepth | null {
  if (spec === null) return null;
  if (spec === undefined) return resolveColorSystem("auto", { isTTY });
  if (typeof spec === "string") return resolveColorSystem(spec, { isTTY });
  return spec;
}
