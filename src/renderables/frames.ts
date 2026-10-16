/**
 * Frames — content that changes on a beat: a sequence of frames, each held
 * for its own seconds and looping, drawn as the one in progress at a time
 * the host hands in.
 *
 * An effect moves a cell's colours and may never change a glyph
 * (`./effect.ts`: "It changes how cells look, never which cells exist or who
 * drew them"). A frame is the other kind of motion — what the element shows
 * changes — so it is its own primitive and not a wider `Effect`, and the two
 * compose by nesting: `new Effected(new Frames(…), …)` lights whichever frame
 * is up.
 *
 * [LAW:no-ambient-temporal-coupling] `t` is a constructor argument, as
 * `Effected`'s is, never a clock read: whoever draws frames hands each one
 * its time (`core/clock.ts`), so the same `t` draws the same bytes at one
 * redraw a second or sixty. The host's rate is the host's. At sixty a frame
 * shows for exactly its hold; at one a second a hold shorter than a second is
 * skipped and a period of whole seconds freezes on one frame, and nothing
 * here adapts to that — the beat is `core/easing.ts`'s, the one timing
 * vocabulary, and a draw costs the same at `t = 0` and `t = 10⁶`.
 *
 * Every frame is drawn at one width, the widest frame's, each padded on the
 * right to it, so whatever sits beside the frames never moves as they turn;
 * and the frame is a fragment of a line (`setIntoLine`), ending no line of
 * its own, so it sits among other cells. Frames are `RichText`, each free to
 * carry its own style, and read once, here: markup is a string's reading
 * under the console that draws it, which a frame handed to a template
 * binding has no console for, so the frame arrives read, as a `Group`'s
 * children do.
 */

import { beat, type Beat } from "../core/easing.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import type { Segment } from "../core/segment.js";
import type { RichText } from "../core/text.js";
import { setIntoLine } from "./embed.js";

/** One frame: what it shows, and how long it is held, in seconds. */
export interface Frame {
  readonly text: RichText;
  readonly seconds: number;
}

export interface FramesOptions {
  /** The moment to draw, in seconds. */
  readonly t: number;
}

export class Frames implements Renderable, Measurable {
  /** Which frame is in progress when: the holds are the frames' seconds, in order. */
  readonly beat: Beat;
  /** The width every frame draws at: the widest frame's, in cells. */
  readonly width: number;
  readonly t: number;
  // Each frame as it draws: a line fragment padded to `width`, made once.
  private readonly _shown: readonly RichText[];

  constructor(frames: readonly Frame[], options: FramesOptions) {
    this.beat = beat(frames.map((frame) => frame.seconds));
    if (!Number.isFinite(options.t)) {
      throw new RangeError(`Frames needs a finite t, got ${options.t}`);
    }
    this.t = options.t;
    const texts = frames.map((frame) => setIntoLine(frame.text.copy()));
    this.width = Math.max(...texts.map((text) => text.cellLength));
    this._shown = texts.map((text) => text.padRight(this.width - text.cellLength));
  }

  /** The frame in progress at `t`, at `width` cells, ending no line: a copy, the caller's to change. */
  text(): RichText {
    return this._shown[this.beat.at(this.t)]!.copy();
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.text().render(options);
  }

  /**
   * One width both ways: a frame is one picture, never wrapped apart at a
   * space or narrowed as the frames turn. Fitting it to the room is
   * `Measurement.get`'s, as for every measurable.
   */
  measure(): { minimum: number; maximum: number } {
    return { minimum: this.width, maximum: this.width };
  }
}
