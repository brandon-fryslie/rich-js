/**
 * Live — animates a portion of the terminal by continuously re-rendering.
 *
 * Two modes:
 * - **Inline** (default): clears and redraws N lines in the current scroll
 *   region. Good for spinners/progress bars below other output.
 * - **Alt-screen** (`altScreen: true`): enters the alternate screen buffer
 *   on start, cursor-homes on each refresh (no clear flicker), and restores
 *   the original buffer on stop. Good for full-screen TUI apps.
 */

import { Console } from "../core/console.js";
import { Segment } from "../core/segment.js";
import type { Renderable } from "../core/protocol.js";

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

    const stream = process.stdout;
    if (this._altScreen) {
      stream.write("\x1b[?1049h"); // enter alt screen
    }
    this._writeCursorControl(false);

    if (this._autoRefresh) {
      const interval = Math.floor(1000 / this._refreshPerSecond);
      this._timer = setInterval(() => this.refresh(), interval);
    }
  }

  stop(): void {
    if (!this._started) return;
    this._started = false;

    if (this._timer) {
      clearInterval(this._timer);
      this._timer = undefined;
    }

    if (!this._transient) {
      this.refresh();
    } else {
      this._clearLast();
    }

    this._writeCursorControl(true);
    if (this._altScreen) {
      const stream = process.stdout;
      stream.write("\x1b[0m\x1b[?1049l"); // reset attrs + exit alt screen
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
    if (!this._renderable) return;

    if (this._altScreen) {
      // Alt-screen mode: cursor home (first refresh clears the buffer)
      const stream = process.stdout;
      stream.write(this._firstRefresh ? "\x1b[2J\x1b[H" : "\x1b[H");
      this._firstRefresh = false;
    } else {
      // Inline mode: erase previous output
      this._clearLast();
    }

    const segments = [...this._renderable.render(this._console.options)];
    const lines = Segment.splitLines(segments);
    const maxHeight = this._console.height;

    let displayLines = lines;
    if (this._verticalOverflow !== "visible" && lines.length > maxHeight) {
      displayLines = lines.slice(0, maxHeight);
      if (this._verticalOverflow === "ellipsis" && displayLines.length > 0) {
        displayLines[displayLines.length - 1] = [new Segment("...")];
      }
    }

    // Apply styles via the Console's color system
    const colorSystem = this._console.colorSystem ?? undefined;
    const output = displayLines.map((line) =>
      line.map((s) =>
        s.style && !s.style.isNull
          ? s.style.render(s.text, colorSystem)
          : s.text,
      ).join(""),
    ).join("\n");

    const stream = process.stdout;
    stream.write(output + "\n");
    this._lastLineCount = displayLines.length;
  }

  private _clearLast(): void {
    if (this._lastLineCount > 0) {
      const stream = process.stdout;
      for (let i = 0; i < this._lastLineCount; i++) {
        stream.write("\x1b[1A\x1b[2K");
      }
      this._lastLineCount = 0;
    }
  }

  private _writeCursorControl(show: boolean): void {
    const stream = process.stdout;
    stream.write(show ? "\x1b[?25h" : "\x1b[?25l");
  }
}
