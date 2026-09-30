/**
 * Painting a frame over the last one: the bytes that take the cursor from
 * where the last frame left it to the new frame's first cell, draw every row,
 * and leave the cursor on the frame's last row.
 *
 * [LAW:one-source-of-truth] Where the cursor rests between frames is one fact,
 * and `App` and `Live` both paint through here so they cannot disagree about
 * it. They once did: `Live` wrote a newline after its last row, and on a
 * frame as tall as the terminal that newline scrolled the screen, so every
 * refresh left the frame's top row behind in scrollback. The cursor rests on
 * the last row, and the newline that ends it is written once, when the frame
 * is handed back (`belowFrame`).
 */

import type { Destination } from "./color.js";
import type { Height } from "./protocol.js";
import { segmentsToString } from "./render.js";
import type { Segment } from "./segment.js";

/**
 * Where a frame is painted. `alternate` is the whole terminal, in the
 * alternate screen buffer, so the rows printed before it are there again when
 * it is handed back. `inline` starts at the cursor's line, as tall as the
 * frame, and stays on the terminal when it is handed back.
 */
export type Surface = "alternate" | "inline";

/**
 * [LAW:dataflow-not-control-flow] The two surfaces differ only in these
 * values; every frame is painted by the same steps on both.
 */
interface Geometry {
  /** A region the frame fills, or a ceiling it keeps its own height under. */
  readonly exact: boolean;
  /** Bytes to the frame's first cell, the last frame `rows` tall. */
  home(rows: number): string;
  /** The rows this frame paints, so a shorter one overwrites the last. */
  painted(frameRows: number, lastRows: number, screenRows: number): number;
  /** Bytes from the cursor on the frame's last row to the line under it. */
  below(rows: number): string;
}

const GEOMETRY: Record<Surface, Geometry> = {
  alternate: {
    exact: true,
    home: () => "\x1b[H",
    // The frame is every row of the screen, so there is nothing left under it
    // — and after the terminal shrinks, painting the old count would scroll.
    painted: (frameRows) => frameRows,
    // Leaving the buffer puts back the cursor the program had.
    below: () => "",
  },
  inline: {
    exact: false,
    // After N rows written with N-1 newlines between them, the cursor is on
    // the last. `ESC[0A` still moves a row on some terminals, so a one-row
    // frame is returned to with the carriage return alone.
    home: (rows) => (rows > 1 ? `\x1b[${rows - 1}A\r` : "\r"),
    // A shorter frame blanks the rows the last one left below it, as far as
    // the screen still reaches after a shrink.
    painted: (frameRows, lastRows, screenRows) => Math.max(frameRows, Math.min(lastRows, screenRows)),
    // Where the program's next line belongs.
    below: (rows) => (rows > 0 ? "\n" : ""),
  },
};

const ERASE_LINE = "\x1b[2K";

/** The budget a frame on `surface` renders under, on a screen `screenRows` tall. */
export function frameHeight(surface: Surface, screenRows: number): Height {
  return { rows: screenRows, exact: GEOMETRY[surface].exact };
}

/**
 * The bytes that paint `frame` over the last frame, which was `lastRows` tall,
 * leaving the cursor on the frame's last row. `frame` is already shaped by
 * whoever set its budget; an empty one erases the last frame and leaves the
 * cursor where it began.
 */
export function paintFrame(
  surface: Surface,
  frame: readonly (readonly Segment[])[],
  lastRows: number,
  screenRows: number,
  destination: Destination,
): string {
  const geometry = GEOMETRY[surface];
  const painted = geometry.painted(frame.length, lastRows, screenRows);
  // Each row is erased as it is reached rather than the frame cleared first,
  // so no blank screen shows between two frames. The erase leads its row:
  // after a row that fills the width, the cursor sits on its last cell, and
  // an erase there would take it.
  const body = Array.from({ length: painted }, (_, row) =>
    ERASE_LINE + segmentsToString(frame[row] ?? [], destination),
  ).join("\n");
  // Rows blanked below the frame are not the frame's: the cursor goes back up
  // to its last row, so the next frame and the program's next line start from
  // the frame's own height.
  const blanked = painted - Math.max(frame.length, 1);
  const back = blanked > 0 ? `\x1b[${blanked}A` : "";
  return geometry.home(lastRows) + body + back;
}

/** Bytes from a frame `rows` tall, handed back, to the program's next line. */
export function belowFrame(surface: Surface, rows: number): string {
  return GEOMETRY[surface].below(rows);
}
