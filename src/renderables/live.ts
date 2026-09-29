/**
 * Live — animates a portion of the terminal by continuously re-rendering.
 *
 * Two modes:
 * - **Inline** (default): clears and redraws N lines in the current scroll
 *   region. Good for spinners/progress bars below other output.
 * - **Alt-screen** (`altScreen: true`): enters the alternate screen buffer
 *   on start, cursor-homes on each refresh (no clear flicker), and restores
 *   the original buffer on stop. The screen is the frame's region, so a
 *   `Layout` fills it. Good for full-screen TUI apps.
 */

import { Console } from "../core/console.js";
import { Segment } from "../core/segment.js";
import { segmentsToString } from "../core/render.js";
import { fitHeight, type Height, type Renderable } from "../core/protocol.js";

export interface LiveOptions {
  refreshPerSecond?: number;
  autoRefresh?: boolean;
  transient?: boolean;
  console?: Console;
  verticalOverflow?: "crop" | "ellipsis" | "visible";
  /** When true, Live enters the alternate screen buffer on start() and
   *  restores the original on stop(). Refresh uses cursor-home instead of
   *  cursor-up-and-clear, eliminating flicker for full-screen layouts. */
  altScreen?: boolean;
}

export class Live {
  private _renderable: Renderable | undefined;
  private _console: Console;
  private _refreshPerSecond: number;
  private _autoRefresh: boolean;
  private _transient: boolean;
  private _verticalOverflow: "crop" | "ellipsis" | "visible";
  private _altScreen: boolean;
  private _timer: ReturnType<typeof setInterval> | undefined;
  private _lastLineCount: number;
  private _started: boolean;
  private _firstRefresh: boolean;

  constructor(renderable?: Renderable, options?: LiveOptions) {
    this._renderable = renderable;
    this._console = options?.console ?? new Console({ forceTerminal: true });
    this._refreshPerSecond = options?.refreshPerSecond ?? 4;
    this._autoRefresh = options?.autoRefresh !== false;
    this._transient = options?.transient ?? false;
    this._verticalOverflow = options?.verticalOverflow ?? "ellipsis";
    this._altScreen = options?.altScreen ?? false;
    this._lastLineCount = 0;
    this._started = false;
    this._firstRefresh = true;
  }

  get console(): Console {
    return this._console;
  }

  get renderable(): Renderable | undefined {
    return this._renderable;
  }

  start(): void {
    if (this._started) return;
    this._started = true;
    this._firstRefresh = true;

    const stream = this._console.file;
    if (this._altScreen) {
      stream.write("\x1b[?1049h"); // enter alt screen
    }
    this._writeCursorControl(false);

    if (this._autoRefresh) {
      const interval = Math.floor(1000 / this._refreshPerSecond);
      // No caller is on the stack to run `stop()` for a frame that throws
      // here, and in Node the throw ends the process — so the terminal is
      // handed back first, and the error then goes on to wherever an uncaught
      // one goes.
      this._timer = setInterval(() => {
        try {
          this.refresh();
        } catch (error) {
          this._release();
          throw error;
        }
      }, interval);
    }
  }

  stop(): void {
    if (!this._started) return;
    // [LAW:no-silent-failure] A final frame that throws still propagates, and
    // the terminal is handed back on the way out.
    try {
      if (this._transient) {
        this._console.file.write(this._erase());
        this._lastLineCount = 0;
      } else {
        this.refresh();
      }
    } finally {
      this._release();
    }
  }

  update(renderable?: Renderable, options?: { refresh?: boolean }): void {
    if (renderable !== undefined) {
      this._renderable = renderable;
    }
    if (options?.refresh) {
      this.refresh();
    }
  }

  refresh(): void {
    // A frame is drawn only while this Live holds the terminal, as in Rich:
    // before `start()` or after the hand-back it would land on a screen that
    // belongs to someone else — the main buffer, under the user's own output.
    if (!this._started || !this._renderable) return;

    // [LAW:dataflow-not-control-flow] Both modes render under the terminal's
    // rows and differ only in what those rows are: the alternate screen is a
    // region the frame stands in, and an inline frame keeps its natural height
    // under them as a ceiling. Live set the budget, so Live shapes what comes
    // back — its overflow policy, then `fitHeight`, which pads only a region.
    const options = this._console.options;
    const height: Height = { rows: options.height.rows, exact: this._altScreen };
    const lines = Segment.splitLines(this._renderable.render({ ...options, height }));
    const displayLines = fitHeight(this._overflow(lines, height.rows), height);

    // [LAW:single-enforcer] Per-line encoding routes through the same
    // tree-coalescer `Console._writeSegments` uses, so Live frames coalesce
    // adjacent same-style segments into shared SGR pairs on the wire and
    // encode for the console's own destination.
    // The alternate screen is not erased between frames — the cursor only goes
    // home — so each of its rows is erased before it is drawn, or a shorter
    // frame leaves the last one's rows and line tails showing. The erase comes
    // first because the cursor is then at the row's start; after a row that
    // fills the width it would take the last cell. An inline frame's rows are
    // erased by `_erase`.
    const lead = this._altScreen ? "\x1b[2K" : "";
    const destination = this._console.destination;
    const output = displayLines
      .map((line) => lead + segmentsToString(line, destination))
      .join("\n");

    // [LAW:effects-at-boundaries] The frame is fully rendered before a byte
    // reaches the terminal, and whatever takes the last frame away goes out in
    // the same write as the new one — so a render that throws leaves the last
    // good frame showing. The first alternate-screen frame clears the buffer
    // it walked into; after that the cursor only goes home.
    const replace = this._altScreen ? (this._firstRefresh ? "\x1b[2J\x1b[H" : "\x1b[H") : this._erase();
    // Inline, the newline leaves the cursor under the frame, where `_erase`
    // counts up from. On the alternate screen the next frame starts from home,
    // and a newline after a full-height frame's last row scrolls its first row
    // off the top.
    this._console.file.write(replace + (this._altScreen ? output : output + "\n"));
    this._firstRefresh = false;
    // What `_erase` erases: an inline frame's rows. An alternate-screen frame
    // is erased by leaving the buffer.
    this._lastLineCount = this._altScreen ? 0 : displayLines.length;
  }

  // Lines past `rows`: dropped, with the last kept row replaced by an ellipsis,
  // or left for the terminal to scroll.
  private _overflow(lines: Segment[][], rows: number): Segment[][] {
    if (this._verticalOverflow === "visible" || lines.length <= rows) return lines;
    const kept = lines.slice(0, rows);
    if (this._verticalOverflow === "ellipsis" && kept.length > 0) {
      kept[kept.length - 1] = [new Segment("...")];
    }
    return kept;
  }

  // Cursor-up and erase-line for each row of the last inline frame.
  private _erase(): string {
    return "\x1b[1A\x1b[2K".repeat(this._lastLineCount);
  }

  // [LAW:single-enforcer] The one way the terminal is handed back — the timer
  // stopped, the cursor shown, the alternate screen left — whether `stop()`
  // ran or a frame threw with no caller to run it.
  private _release(): void {
    this._started = false;
    clearInterval(this._timer);
    this._timer = undefined;
    this._writeCursorControl(true);
    if (this._altScreen) {
      this._console.file.write("\x1b[0m\x1b[?1049l"); // reset attrs + exit alt screen
    }
  }

  private _writeCursorControl(show: boolean): void {
    this._console.file.write(show ? "\x1b[?25h" : "\x1b[?25l");
  }
}
