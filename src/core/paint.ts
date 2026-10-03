/**
 * Painting frames over one another on a terminal: the bytes that take it,
 * paint each frame over the last one in place, and hand it back — and, on an
 * output that is not a terminal, the one frame that is left when it is handed
 * back.
 *
 * [LAW:one-source-of-truth] Where the cursor rests between frames, and how
 * many rows the next paint goes back over, is one fact, and a `SurfacePainter`
 * is its only owner: `App` holds one, and so does `Live` on a terminal, so
 * they cannot disagree about it. They once did: `Live` wrote a newline after its last row, and on a
 * frame as tall as the terminal that newline scrolled the screen, so every
 * refresh left the frame's top row behind in scrollback. The cursor rests on
 * the last row, and the newline that ends it is written once, when the frame
 * is handed back.
 */

import type { Destination } from "./color.js";
import type { Height } from "./protocol.js";
import { segmentsToString } from "./render.js";
import { Segment } from "./segment.js";

/**
 * Where a frame is painted. `alternate` is the whole terminal, in the
 * alternate screen buffer, so the rows printed before it are there again when
 * it is handed back. `inline` starts at the cursor's line, as tall as the
 * frame, and stays on the terminal when it is handed back.
 */
export type Surface = "alternate" | "inline";

/** The terminal a frame is painted on, in cells. */
export interface Screen {
  readonly rows: number;
  readonly cols: number;
}

/**
 * [LAW:dataflow-not-control-flow] The two surfaces differ only in these
 * values; every frame is painted by the same steps on both.
 */
interface Geometry {
  /** A region the frame fills, or a ceiling it keeps its own height under. */
  readonly exact: boolean;
  readonly enter: string;
  readonly leave: string;
  /** Bytes to the frame's first row, the last frame `rows` tall. */
  home(rows: number): string;
  /** The rows this frame paints, so a shorter one overwrites the last. */
  painted(frameRows: number, lastRows: number, screenRows: number): number;
  /** Bytes from the cursor on the frame's last row to the line under it. */
  below(rows: number): string;
}

const GEOMETRY: Record<Surface, Geometry> = {
  alternate: {
    exact: true,
    enter: "\x1b[?1049h",
    // Leaving the buffer puts back the cursor the program had.
    leave: "\x1b[?1049l",
    home: () => "\x1b[H",
    // The frame is every row of the screen, so there is nothing left under it
    // — and after the terminal shrinks, painting the old count would scroll.
    painted: (frameRows) => frameRows,
    below: () => "",
  },
  inline: {
    exact: false,
    enter: "",
    leave: "",
    // After N rows written with N-1 newlines between them, the cursor is on
    // the last. `ESC[0A` still moves a row on some terminals, so a one-row
    // frame has no move at all.
    home: (rows) => (rows > 1 ? `\x1b[${rows - 1}A` : ""),
    // A shorter frame blanks the rows the last one left below it, as far as
    // the screen still reaches after a shrink.
    painted: (frameRows, lastRows, screenRows) => Math.max(frameRows, Math.min(lastRows, screenRows)),
    // Where the program's next line belongs.
    below: (rows) => (rows > 0 ? "\n" : ""),
  },
};

// Each row starts at its line's first cell and is erased as it is reached,
// rather than the frame cleared first, so no blank screen shows between two
// frames. The erase leads its row: after a row that fills the width, the
// cursor sits on its last cell, and an erase there would take it.
const ROW_START = "\r\x1b[2K";
// A frame's bytes between these two are shown at once: a terminal that has
// synchronized output (DEC private mode 2026 — iTerm2, kitty, WezTerm,
// Ghostty, foot, Windows Terminal …) holds the screen until the frame has
// fully arrived, so a repaint can never show a row erased and not yet
// redrawn. Thirty full-screen repaints a second show exactly that on a
// terminal that paints whenever bytes land, as a flicker over the whole
// frame. A terminal without the mode ignores both sequences.
const SYNC_START = "\x1b[?2026h";
const SYNC_END = "\x1b[?2026l";
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const RESET_STYLE = "\x1b[0m";

const fitRows = (frame: Segment[][], screen: Screen): Segment[][] =>
  frame.map((line) => Segment.adjustLineLength(line, screen.cols, undefined, false));

/**
 * A frame not yet drawn: the painter calls it when it is about to put the
 * frame on the output, so one that never shows a frame never pays to draw it.
 */
export type FrameSource = () => Segment[][];

/**
 * What paints a run of frames on an output, from `take` to `handBack`.
 */
export interface Painter {
  /** The budget a frame renders under, on a screen `screenRows` tall. */
  height(screenRows: number): Height;
  /** Take the output. */
  take(): void;
  /**
   * Paint `frame` over the last frame. `frame` is already shaped to its
   * height by whoever set its budget. An empty frame erases the last one.
   */
  paint(frame: FrameSource, screen: Screen, destination: Destination): void;
  /**
   * The bytes that write `text` while `frame` is the frame standing on the
   * output, for the caller to write in one piece.
   */
  around(text: string, frame: FrameSource, screen: Screen, destination: Destination): string;
  /** Hand the output back. The next `take` starts from wherever it then is. */
  handBack(): void;
}

/**
 * Paints frames on one surface of a terminal. It holds the last frame's own
 * rows on the terminal — what the next paint goes back over — from `take` to
 * `handBack`.
 */
export class SurfacePainter implements Painter {
  private readonly geometry: Geometry;
  private rows = 0;

  constructor(
    surface: Surface,
    private readonly write: (bytes: string) => void,
  ) {
    this.geometry = GEOMETRY[surface];
  }

  height(screenRows: number): Height {
    return { rows: screenRows, exact: this.geometry.exact };
  }

  /** Take the terminal: the surface entered, the cursor hidden. */
  take(): void {
    this.write(this.geometry.enter + HIDE_CURSOR);
  }

  /**
   * Paint `frame` over the last frame, leaving the cursor on its last row,
   * and return it as painted. No row is wider than the screen, since one that
   * soft-wrapped would push every row below it down a row the next paint does
   * not go back over.
   */
  paint(frame: FrameSource, screen: Screen, destination: Destination): Segment[][] {
    const rows = fitRows(frame(), screen);
    this.write(this.over(rows, screen, destination));
    return rows;
  }

  /**
   * The frame erased, `text` written, and `frame` painted again on the line
   * under it — in one string, so no terminal ever shows the frame gone. The
   * frame fills whole lines, so text that stops mid-line is ended before it.
   */
  around(text: string, frame: FrameSource, screen: Screen, destination: Destination): string {
    // Drawn before `over` moves the row count, so a frame that throws leaves
    // the painter matching the terminal it left untouched.
    const rows = fitRows(frame(), screen);
    const erase = this.over([], screen, destination);
    const ended = text.endsWith("\n") ? text : `${text}\n`;
    return erase + ended + this.over(rows, screen, destination);
  }

  // The bytes that paint `rows` over the last frame. They go out in one
  // string, so whatever takes the last frame away arrives with the new one.
  private over(rows: Segment[][], screen: Screen, destination: Destination): string {
    const painted = this.geometry.painted(rows.length, this.rows, screen.rows);
    const body = Array.from(
      { length: painted },
      (_, row) => ROW_START + segmentsToString(rows[row] ?? [], destination),
    ).join("\n");
    // Rows blanked below the frame are not the frame's: the cursor goes back
    // up to its last row, so the next frame and the program's next line start
    // from the frame's own height.
    const blanked = painted - Math.max(rows.length, 1);
    const back = blanked > 0 ? `\x1b[${blanked}A` : "";
    const bytes = SYNC_START + this.geometry.home(this.rows) + body + back + SYNC_END;
    this.rows = rows.length;
    return bytes;
  }

  /**
   * Hand the terminal back: style reset, then the cursor shown on the
   * program's next line, the surface left.
   */
  handBack(): void {
    this.write(RESET_STYLE + SHOW_CURSOR + this.geometry.below(this.rows) + this.geometry.leave);
    this.rows = 0;
  }
}

/**
 * Paints on an output that is not a terminal — a file, a pipe, a CI log — as
 * Rich's `Live` does: nothing while the frames change, since every one would
 * stay there for good with the escape sequences that move over it as literal
 * bytes, and the last frame once, printed as plain lines through `print`, when
 * the output is handed back. What is written around the frame goes out as it
 * was given. No frame is drawn but the one handed back.
 */
export class FinalFramePainter implements Painter {
  private last: FrameSource = () => [];

  constructor(private readonly print: (frame: Segment[][]) => void) {}

  height(screenRows: number): Height {
    return { rows: screenRows, exact: false };
  }

  take(): void {}

  paint(frame: FrameSource): void {
    this.last = frame;
  }

  around(text: string): string {
    return text;
  }

  handBack(): void {
    const frame = this.last;
    this.last = () => [];
    this.print(frame());
  }
}
