/**
 * Painting frames over one another on a terminal: the bytes that take it,
 * paint each frame over the last one in place, and hand it back.
 *
 * [LAW:one-source-of-truth] Where the cursor rests between frames, and how
 * many rows the next paint goes back over, is one fact, and a `Painter` is its
 * only owner: `App` and `Live` both hold one, so they cannot disagree about
 * it. They once did: `Live` wrote a newline after its last row, and on a
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
const HIDE_CURSOR = "\x1b[?25l";
const SHOW_CURSOR = "\x1b[?25h";
const RESET_STYLE = "\x1b[0m";

/**
 * Paints frames on one surface of a terminal, writing through `write`. It
 * holds the last frame's own rows on the terminal — what the next paint goes
 * back over — from `take` to `handBack`.
 */
export class Painter {
  private readonly geometry: Geometry;
  private rows = 0;

  constructor(
    surface: Surface,
    private readonly write: (bytes: string) => void,
  ) {
    this.geometry = GEOMETRY[surface];
  }

  /** The budget a frame renders under, on a screen `screenRows` tall. */
  height(screenRows: number): Height {
    return { rows: screenRows, exact: this.geometry.exact };
  }

  /** Take the terminal: the surface entered, the cursor hidden. */
  take(): void {
    this.write(this.geometry.enter + HIDE_CURSOR);
  }

  /**
   * Paint `frame` over the last frame, leaving the cursor on its last row,
   * and return it as painted. `frame` is already shaped to its height by
   * whoever set its budget; no row is wider than the screen, since one that
   * soft-wrapped would push every row below it down a row the next paint
   * does not go back over. An empty frame erases the last one.
   */
  paint(frame: Segment[][], screen: Screen, destination: Destination): Segment[][] {
    const rows = frame.map((line) => Segment.adjustLineLength(line, screen.cols, undefined, false));
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
    this.write(this.geometry.home(this.rows) + body + back);
    this.rows = rows.length;
    return rows;
  }

  /**
   * Hand the terminal back: the cursor shown on the program's next line, the
   * surface left. The next `take` starts from wherever the cursor then is.
   */
  handBack(): void {
    this.write(RESET_STYLE + SHOW_CURSOR + this.geometry.below(this.rows) + this.geometry.leave);
    this.rows = 0;
  }
}
