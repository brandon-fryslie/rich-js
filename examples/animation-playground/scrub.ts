/**
 * The scrub bar: the window of the timeline the time is in, with a marker on
 * the time, that a press, a drag or the arrow keys seek.
 *
 * THIS IS A DEMO (`examples/animation-playground/`), and a widget the library
 * does not ship, written on `WidgetBase` as `Slider` is. Drag capture is the
 * widget event router's, so a drag past either end keeps reaching it.
 *
 * It draws from the frame's time, through an animation placed in its draw, so
 * it says where the time is in every frame and, the time being information
 * and not motion, with motion reduced too. Every cell it draws is anchored to
 * the window it showed, so a press reads the time off the frame the reader
 * was looking at, never off one the time has since moved past. What it asks
 * for is `requested`, the time to seek to given the time now; the session
 * seeks the app's timeline there on every change.
 */
import { Animation, RichText, Segment, render, type RenderOptions } from "@promptctl/rich-js";
import { WidgetBase, type WidgetKeyEvent, type WidgetMouseEvent } from "@promptctl/rich-js/widgets";

/** The seconds the bar spans: the window of the timeline the time is in. */
export const WINDOW = 30;
/** The cells it takes at most: a cell for every half second. */
const TRACK = 60;
/** The fewest cells it is drawn in, so a narrow terminal still has a track to press. */
const SHORTEST = 10;
/** How far an arrow key seeks: a cell of the full track. */
const NUDGE = WINDOW / TRACK;

/** The window a track showed, and the cells it took: what a press on one of them reads its time off. */
class ScrubWindow {
  constructor(
    readonly start: number,
    readonly cells: number,
  ) {}

  /** The time under column `col`, the middle of the stretch it covers, pinned to the window past either end. */
  timeAt(col: number): number {
    const cell = Math.max(0, Math.min(this.cells - 1, col));
    return this.start + ((cell + 0.5) * WINDOW) / this.cells;
  }
}

const TIME = Animation.time();

export class ScrubBar extends WidgetBase {
  readonly id = "scrub";
  readonly focusable = true;

  /** The time to seek to, given the time now: set by a press, a drag or a key, then announced by a change. Nothing draws it, so it is not observed. */
  requested: (now: number) => number = (now) => now;

  /** The window a press landed in, held until it is let go, so a drag reads it whatever the time has done since. */
  #pressed: ScrubWindow | null = null;

  handleKey(event: WidgetKeyEvent): void {
    const by = event.key === "left" ? -NUDGE : event.key === "right" ? NUDGE : 0;
    if (by === 0) return;
    this.seek((now) => now + by);
    event.stop();
  }

  override handleMouse(event: WidgetMouseEvent): void {
    if (event.type === "mouse_down") this.#pressed = event.cell?.owner instanceof ScrubWindow ? event.cell.owner : null;
    const pressed = this.#pressed;
    if (pressed === null) return;
    if (event.type === "mouse_up") this.#pressed = null;
    const to = pressed.timeAt(event.x);
    this.seek(() => to);
  }

  private seek(requested: (now: number) => number): void {
    this.requested = requested;
    this.emitChange();
  }

  protected draw(options: RenderOptions): Iterable<Segment> {
    const cells = Math.min(TRACK, options.maxWidth);
    return render(
      Animation.map(TIME, (t) => {
        const window = new ScrubWindow(Math.floor(t / WINDOW) * WINDOW, cells);
        const col = Math.min(cells - 1, Math.floor(((t - window.start) * cells) / WINDOW));
        const text = new RichText("", { end: "" });
        text.append("━".repeat(col), "#89b4fa");
        text.append("●", "bold #f9e2af");
        text.append("─".repeat(cells - col - 1), "#6c7086");
        return { render: (inner: RenderOptions) => Segment.anchorLines(Segment.splitLines(render(text, inner)), window).flatMap((line) => [...line, Segment.line()]) };
      }),
      options,
    );
  }

  measure(): { minimum: number; maximum: number } {
    return { minimum: SHORTEST, maximum: TRACK };
  }
}
