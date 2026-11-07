/**
 * Painting frames over one another on a terminal: the bytes that take it,
 * paint each frame over the last one in place, and hand it back — and, on an
 * output that is not a terminal, the one frame that is left when it is handed
 * back.
 *
 * [LAW:one-source-of-truth] Where the cursor rests between frames, and how
 * many rows the next paint goes back over, is one fact, and a `SurfaceRenderer`
 * is its only owner: `App` holds one, and so does `Live` on a terminal, so
 * they cannot disagree about it. They once did: `Live` wrote a newline after its last row, and on a
 * frame as tall as the terminal that newline scrolled the screen, so every
 * refresh left the frame's top row behind in scrollback. The cursor rests on
 * the last row, and the newline that ends it is written once, when the frame
 * is handed back.
 */

import { asCodePoint, cellLen, nextGrapheme } from "./cells.js";
import type { OutputTarget } from "./color.js";
import type { Height } from "./protocol.js";
import { segmentsToString, shownOn } from "./render.js";
import { Segment } from "./segment.js";
import type { CaretShape } from "./style.js";

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
  /** Bytes to the frame's first row from the cursor on its row `row`. */
  home(row: number): string;
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
    // `ESC[0A` still moves a row on some terminals, so a cursor already on
    // the first row has no move at all.
    home: (row) => up(row),
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
// DECSCUSR: the cursor's shape, each blinking (odd) or steady (even); 0 is
// the terminal's default shape — its configured one on most, a
// blinking block on xterm. No sequence restores the shape a program before
// the take had set.
const CARET_CODES: Record<CaretShape, number> = { block: 1, underline: 3, bar: 5 };
const caretShape = (shape: CaretShape, destination: OutputTarget): string =>
  `\x1b[${CARET_CODES[shape] + (destination.reducedMotion ? 1 : 0)} q`;
const DEFAULT_SHAPE = "\x1b[0 q";

const up = (rows: number): string => (rows > 0 ? `\x1b[${rows}A` : "");
const down = (rows: number): string => (rows > 0 ? `\x1b[${rows}B` : "");

/**
 * Where a frame asks for the terminal's cursor: its first cell with a `caret`
 * style. A bar stands at the left edge of the column it is moved to, so one
 * marked on its cell's right side is moved past the cell; a block or an
 * underline covers the cell, whichever side the insertion point is on.
 */
interface Caret {
  readonly row: number;
  readonly col: number;
  readonly shape: CaretShape;
}

function caretIn(rows: readonly Segment[][]): Caret | undefined {
  for (const [row, line] of rows.entries()) {
    let col = 0;
    for (const segment of line) {
      const mark = segment.style?.caret;
      if (mark !== undefined && segment.text.length > 0) {
        const past = mark.shape === "bar" && mark.side === "right" ? cellLen(segment.text.slice(0, nextGrapheme(segment.text, asCodePoint(0)))) : 0;
        return { row, col: col + past, shape: mark.shape };
      }
      col += segment.cellLength;
    }
  }
  return undefined;
}

/**
 * `frame` fitted to the screen, and its caret where the terminal can show it.
 * A frame's rows are filled by the screen, so a right-to-left row its text
 * left unplaced stands at its start edge, and the caret is found on the row
 * as placed. It is found before the cut, so one past the screen's edge — a
 * row wider than the screen — stands on the last column rather than going
 * unshown.
 */
function fitted(frame: Segment[][], screen: Screen): { rows: Segment[][]; caret: Caret | undefined } {
  const placed = frame.map((line) => Segment.withLeadingFill(line, screen.cols));
  const caret = caretIn(placed);
  const rows = placed.map((line) => Segment.adjustLineLength(line, screen.cols, undefined, false));
  return { rows, caret: caret && { ...caret, col: Math.min(caret.col, Math.max(screen.cols - 1, 0)) } };
}

/**
 * A frame not yet drawn: the painter calls it when it is about to put the
 * frame on the output, so one that never shows a frame never pays to draw it.
 */
export type FrameSource = () => Segment[][];

/**
 * What paints a run of frames on an output, from `take` to `handBack`.
 */
export interface Renderer {
  /** The budget a frame renders under, on a screen `screenRows` tall. */
  height(screenRows: number): Height;
  /**
   * Whether this painter shows the terminal's cursor where a frame asks for
   * it (`Style.caret`) on `destination`: what a frame is drawn under as
   * `RenderOptions.caret`.
   */
  caret(destination: OutputTarget): boolean;
  /** Take the output. */
  take(): void;
  /**
   * Paint `frame` over the last frame. `frame` is already shaped to its
   * height by whoever set its budget. An empty frame erases the last one.
   */
  paint(frame: FrameSource, screen: Screen, destination: OutputTarget): void;
  /**
   * The bytes that write `text` while `frame` is the frame standing on the
   * output, for the caller to write in one piece.
   */
  around(text: string, frame: FrameSource, screen: Screen, destination: OutputTarget): string;
  /** Hand the output back. The next `take` starts from wherever it then is. */
  handBack(): void;
}

/**
 * Paints frames on one surface of a terminal. It holds the last frame's own
 * rows on the terminal — what the next paint goes back over — from `take` to
 * `handBack`.
 */
export class SurfaceRenderer implements Renderer {
  private readonly geometry: Geometry;
  private rows = 0;
  // The frame's row the cursor stands on: its last, or the caret's.
  private at = 0;
  // Whether the cursor is shown, on the last frame's caret.
  private shown = false;
  // The shape a frame last gave the cursor since the take: written again only
  // when it changes, since a terminal restarts its blink on every DECSCUSR.
  private shaped: CaretShape | undefined;

  constructor(
    surface: Surface,
    private readonly write: (bytes: string) => void,
  ) {
    this.geometry = GEOMETRY[surface];
  }

  height(screenRows: number): Height {
    return { rows: screenRows, exact: this.geometry.exact };
  }

  /**
   * Where the terminal puts each glyph itself — a `logical` order, which it
   * reorders — a cell's place in the frame is not its column on the screen,
   * so the cursor would stand off its cell; the caret is drawn there instead.
   */
  caret(destination: OutputTarget): boolean {
    return destination.textOrder !== "logical";
  }

  /** Take the terminal: the surface entered, the cursor hidden. */
  take(): void {
    this.write(this.geometry.enter + HIDE_CURSOR);
  }

  /**
   * Paint `frame` over the last frame, and return it as painted. The cursor
   * is left shown on the frame's caret, if it asks for one, and hidden on its
   * last row otherwise. No row is wider than the screen, since one that
   * soft-wrapped would push every row below it down a row the next paint does
   * not go back over. The rows returned are what `destination` shows
   * (`shownOn`): under reduced motion, nothing in them blinks.
   */
  paint(frame: FrameSource, screen: Screen, destination: OutputTarget): Segment[][] {
    const { rows: fit, caret } = fitted(frame(), screen);
    const rows = fit.map((row) => row.map((segment) => shownOn(segment, destination)));
    this.write(SYNC_START + this.over(rows, caret, screen, destination) + SYNC_END);
    return rows;
  }

  /**
   * The frame erased, `text` written, and `frame` painted again on the line
   * under it — in one string, so no terminal ever shows the frame gone. The
   * frame fills whole lines, so text that stops mid-line is ended before it.
   */
  around(text: string, frame: FrameSource, screen: Screen, destination: OutputTarget): string {
    // Drawn before `over` moves the row count, so a frame that throws leaves
    // the painter matching the terminal it left untouched.
    const { rows, caret } = fitted(frame(), screen);
    const erase = this.over([], undefined, screen, destination);
    const ended = text.endsWith("\n") ? text : `${text}\n`;
    // One synchronized block around all three, so the terminal is released
    // only once the frame is back.
    return SYNC_START + erase + ended + this.over(rows, caret, screen, destination) + SYNC_END;
  }

  // The bytes that paint `rows` over the last frame. They go out in one
  // string, so whatever takes the last frame away arrives with the new one.
  // The cursor is hidden while they are written and shown again on the caret.
  private over(rows: Segment[][], found: Caret | undefined, screen: Screen, destination: OutputTarget): string {
    const caret = this.caret(destination) ? found : undefined;
    const painted = this.paintRows(rows, screen, destination);
    this.shown = caret !== undefined;
    if (caret === undefined) return painted;
    this.at = caret.row;
    const shape = caret.shape === this.shaped ? "" : caretShape(caret.shape, destination);
    this.shaped = caret.shape;
    // From the frame's last row: up to the caret's, then to its cell.
    const to = up(rows.length - 1 - caret.row) + "\r" + (caret.col > 0 ? `\x1b[${caret.col}C` : "");
    return painted + to + shape + SHOW_CURSOR;
  }

  private paintRows(rows: Segment[][], screen: Screen, destination: OutputTarget): string {
    const hide = this.shown ? HIDE_CURSOR : "";
    const painted = this.geometry.painted(rows.length, this.rows, screen.rows);
    const body = Array.from(
      { length: painted },
      (_, row) => ROW_START + segmentsToString(rows[row] ?? [], destination),
    ).join("\n");
    // Rows blanked below the frame are not the frame's: the cursor goes back
    // up to its last row, so the next frame and the program's next line start
    // from the frame's own height.
    const blanked = painted - Math.max(rows.length, 1);
    const back = up(blanked);
    const bytes = hide + this.geometry.home(this.at) + body + back;
    this.rows = rows.length;
    this.at = Math.max(rows.length - 1, 0);
    return bytes;
  }

  /**
   * Hand the terminal back: style reset, then the cursor shown on the
   * program's next line, the surface left.
   */
  handBack(): void {
    const last = down(this.rows - 1 - this.at);
    const shape = this.shaped === undefined ? "" : DEFAULT_SHAPE;
    this.write(RESET_STYLE + last + shape + SHOW_CURSOR + this.geometry.below(this.rows) + this.geometry.leave);
    this.rows = 0;
    this.at = 0;
    this.shown = false;
    this.shaped = undefined;
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
export class FinalFrameRenderer implements Renderer {
  private last: FrameSource = () => [];

  constructor(private readonly print: (frame: Segment[][]) => void) {}

  height(screenRows: number): Height {
    return { rows: screenRows, exact: false };
  }

  caret(): boolean {
    return false;
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
