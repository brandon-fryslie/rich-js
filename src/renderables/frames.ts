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
 * [LAW:no-ambient-temporal-coupling] `t` is the frame's time or an
 * argument, never a clock read: whoever draws frames hands each one its time
 * (`RenderOptions.frame`), so the same `t` draws the same bytes at one
 * redraw a second or sixty. The host's rate is the host's. At sixty a frame
 * shows for exactly its hold; at one a second a hold shorter than a second is
 * skipped and a period of whole seconds freezes on one frame, and nothing
 * here adapts to that — the beat is `core/easing.ts`'s, the one timing
 * vocabulary, and a draw costs the same at `t = 0` and `t = 10⁶`.
 *
 * The sequence and the moment are two values, because only one of them
 * changes from frame to frame. A `FrameSequence` is the frames prepared once
 * — the beat, the one width, each frame set into a line and padded — and an
 * `Animation` of the frame shown (`core/animation.ts`); a `Frames` is that
 * sequence at a `t`, whose work is one frame's — finding which, and copying
 * it: a host holds the sequence and asks it for a frame, as `Spinner` holds
 * its two, so a draw costs the same over ninety frames as over one. The
 * sequence is a value the host keeps, not a memo here: nothing is looked up
 * by key.
 *
 * The frame drawn is drawn until the next begins, and its cells say so: a
 * placed sequence stamps them with its hold (`Style.hold`,
 * `placedRender` in `core/animation.ts`), which rides up
 * through every container to whoever holds the composed frame
 * (`Segment.nextChange`), so a host drawing at `t` knows when to draw again,
 * and one drawing slower than the frames turn can see that it is skipping
 * them. Nothing an animation's `at` returns carries a stamp of its own: the
 * stamp is put on where the frame's time is known.
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

import { Animation, holdOf, placedMeasure, placedRender, shownAt, stamp } from "../core/animation.js";
import type { Hold } from "../core/style.js";
import { beat, finiteTime, type Beat } from "../core/easing.js";
import { Measurement } from "../core/measure.js";
import type { Measurable, Motion, Renderable, RenderOptions } from "../core/protocol.js";
import { render } from "../core/protocol.js";
import type { Segment } from "../core/segment.js";
import { layerStyle } from "../core/style.js";
import { RichText } from "../core/text.js";
import { setIntoLine } from "./embed.js";

/** One frame: what it shows, and how long it is held, in seconds. */
export interface Frame {
  readonly text: RichText;
  readonly seconds: number;
}

/** A sequence of frames prepared to be drawn: built once, asked for the frame at a time. */
export class FrameSequence implements Animation<RichText> {
  /** Which frame is in progress when: the holds are the frames' seconds, in order. */
  readonly beat: Beat;
  /** The width every frame draws at: the widest frame's, in cells. */
  readonly width: number;
  // Each frame as it draws: a line fragment padded to `width`, made once.
  private readonly _shown: readonly RichText[];

  constructor(frames: readonly Frame[]) {
    this.beat = beat(frames.map((frame) => frame.seconds));
    const texts = frames.map((frame) => setIntoLine(frame.text.copy()));
    const widths = texts.map((text) => text.cellLength);
    this.width = Math.max(...widths);
    this._shown = texts.map((text, i) => {
      // One picture: a slot narrower than the frame crops it, never folds
      // or wraps it onto a second line, which `Frames.measure` says it cannot take.
      text.noWrap = true;
      text.overflow = "crop";
      return text.padRight(this.width - widths[i]!);
    });
  }

  /**
   * The frame in progress at `t`, at `width` cells, ending no line: a copy,
   * the caller's to change, carrying no word on when it changes — that is
   * `frameAt`'s, stamped by whoever draws it at a host time. `beat.at`
   * refuses a `t` that is not finite.
   */
  at(t: number): RichText {
    return this._shown[this.beat.at(t)]!.copy();
  }

  /** When the frame in progress at `t` gives way to the next: the beat's answer, its holds being the frames'. */
  nextChange(t: number): number {
    return this.beat.nextChange(t);
  }

  /** When the frame in progress at `t` began: the beat's answer. */
  lastChange(t: number): number {
    return this.beat.lastChange(t);
  }

  /** The frames with their motion taken out: the beat's first frame, held, a copy as `at`'s is. */
  reduced(): Animation<RichText> {
    return Animation.map(this.beat.reduced(), (i) => this._shown[i]!.copy());
  }

  render(options: RenderOptions): Iterable<Segment> {
    return placedRender(this, options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return placedMeasure(this, options);
  }
}

/**
 * The frame `animation` shows at a time `t` it names itself, rather than the
 * frame's: a placed animation drawn as if every frame were drawn for `t`, its
 * every cell — padding included, so a blank frame among drawn ones still
 * turns — stamped with the hold it is in there. A `RichText` is a stamped
 * copy, so it can still be appended into a line, the caller's to change: an
 * animation may hand back the one `RichText` it holds, as
 * `Animation.constant` does, and a stamp on that would outlive the draw it
 * was true for. A text frame cannot wait for the render options — it is
 * spliced into a line before any exist — so it is the frame at `t`, as
 * `animation.at(t)` is, and moves under reduced motion too; `Frames` and
 * `textFrameAt` are the text frames that know the preference. Any other
 * renderable is the animation placed in a frame drawn for `t` (`Stamped`).
 */
export function frameAt(animation: Animation<RichText>, t: number): RichText;
export function frameAt(animation: Animation<Renderable>, t: number): Renderable;
export function frameAt(animation: Animation<Renderable>, t: number): Renderable {
  const frame = animation.at(t);
  return frame instanceof RichText ? stampedText(frame, { lastChange: animation.lastChange(t), nextChange: animation.nextChange(t) }) : new Stamped(animation, t);
}

/** `text` copied, its every cell saying it is in `hold`: on the base style, which an empty text still draws as its one piece of no width. */
function stampedText(text: RichText, hold: Hold): RichText {
  const stamped = text.copy();
  stamped.style = layerStyle(stamped.style, stamp(hold));
  return stamped;
}

/**
 * The text frame `animation` shows at host time `t` under `motion`
 * (`shownAt`), stamped: what a caller that knows the reader's preference
 * before any render — a `Frames`, the template `frames` function — splices
 * into a line.
 */
export function textFrameAt(animation: Animation<RichText>, t: number, motion: Motion): RichText {
  const shown = shownAt(animation, t, motion);
  return stampedText(shown.value, holdOf(shown, t));
}

/**
 * An animation drawn as if its frame were drawn for `t`: `frameAt`'s
 * renderable. [LAW:one-source-of-truth] It is the animation placed, with
 * the frame's time named — so it stamps what its own face stamps (an
 * `Effected` its effect's exact hold), and every animation inside its value
 * draws at `t` too. The frame is drawn by no host but this: a renderable
 * that refuses any frame but its own host's — a `Progress` — refuses it.
 */
class Stamped implements Renderable, Measurable {
  constructor(
    readonly animation: Animation<Renderable>,
    readonly t: number,
  ) {}

  private atT(options: RenderOptions): RenderOptions {
    return { ...options, frame: { time: this.t, host: { frameTime: this.t } } };
  }

  render(options: RenderOptions): Iterable<Segment> {
    return render(this.animation, this.atT(options));
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return Measurement.get(this.atT(options), this.animation);
  }
}

export interface FramesOptions {
  /** The moment to draw, in seconds. */
  readonly t: number;
}

/** A sequence's frame in progress at one moment, as a renderable. */
export class Frames implements Renderable, Measurable {
  readonly sequence: FrameSequence;
  readonly t: number;

  constructor(sequence: FrameSequence, options: FramesOptions) {
    this.sequence = sequence;
    this.t = finiteTime("Frames", options.t);
  }

  render(options: RenderOptions): Iterable<Segment> {
    return render(textFrameAt(this.sequence, this.t, options), options);
  }

  /**
   * One width both ways: a frame is one picture, never wrapped apart at a
   * space or narrowed as the frames turn. Fitting it to the room is
   * `Measurement.get`'s, as for every measurable.
   */
  measure(): { minimum: number; maximum: number } {
    return { minimum: this.sequence.width, maximum: this.sequence.width };
  }
}
