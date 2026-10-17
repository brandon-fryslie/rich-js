/**
 * Spinner — a named spinner's frame for the time it is handed, with an
 * optional label after it.
 *
 * A spinner is `Frames` (`./frames.ts`) over one entry of the named spinner
 * data (`core/spinnerData.ts`): each frame held for the spinner's interval,
 * looping, the frame in progress at `t` drawn. The data names the frames and
 * the interval; the beat, the width every frame draws at and which frame `t`
 * lands on are the frames primitive's, so a spinner is one more sequence on
 * it and not a second way of turning frames. Custom frames are `Frames`
 * directly. [LAW:one-source-of-truth]
 *
 * [LAW:no-ambient-temporal-coupling] `t` is a constructor argument, as
 * `Frames`'s and `Effected`'s are, never a clock read: whoever draws frames
 * hands each one its time (`core/clock.ts`) — `SpinnerColumn` the task's
 * `time`, a `Live` the frame's time on its clock — as Rich's `Spinner.render`
 * is handed `console.get_time()` or `task.get_time()`. So the same `t` draws
 * the same bytes at one redraw a second or sixty, a `Progress` on a
 * hand-moved clock turns its spinners on that clock, and a draw costs the
 * same at `t = 0` and `t = 10⁶`. `speed` scales the time, as Rich's does:
 * the frame at `t` is the frame the beat has at `t × speed`, so a negative
 * speed runs the sequence backwards, through the beat's wrap before zero.
 */

import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import { SPINNERS, DEFAULT_SPINNER, LINE_SPINNER } from "../core/spinnerData.js";
import type { SpinnerData } from "../core/spinnerData.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable } from "../core/protocol.js";
import { EmbeddedText } from "./embed.js";
import { Frames } from "./frames.js";

const spinnerGlyphs = ({ frames }: SpinnerData): string => frames.join("");

export interface SpinnerOptions {
  /** The moment to draw, in seconds. */
  t: number;
  /** Multiplies the spinner's rate; negative runs it backwards. Defaults to 1. */
  speed?: number;
  style?: string | Style;
}

export class Spinner implements Renderable, Measurable {
  readonly name: string;
  readonly t: number;
  readonly speed: number;
  readonly style: string | Style;
  /**
   * The label drawn after the frame. It is read through `embed`'s one crossing
   * each time it is drawn, so a string is markup under the console that draws
   * it, as a string handed to `print` is — where Rich's `Spinner` parses it
   * whatever the console says — and a `RichText` changed in place draws as
   * changed, as the `Text` Rich keeps does. [LAW:single-enforcer]
   */
  readonly text: string | RichText;
  private readonly _data: SpinnerData;

  constructor(name: string | undefined, text: string | RichText, options: SpinnerOptions) {
    const spinnerName = name ?? DEFAULT_SPINNER;
    const data = SPINNERS[spinnerName];
    if (!data) {
      throw new Error(`Unknown spinner: "${spinnerName}"`);
    }
    this.name = spinnerName;
    this.text = text;
    this.t = options.t;
    this.speed = options.speed ?? 1;
    this.style = options.style ?? NULL_STYLE;
    this._data = data;
  }

  get frames(): readonly string[] {
    return this._data.frames;
  }

  /** Milliseconds each frame is held, as the spinner data gives it. */
  get interval(): number {
    return this._data.interval;
  }

  /**
   * The frames this output can draw, at `t`: the `line` spinner stands in for
   * any other on an ASCII-only one, so the data is chosen where the output is
   * known and the frames are built from it here.
   */
  private _frames(options: RenderOptions): Frames {
    const { frames, interval } = drawable(options, this._data, LINE_SPINNER, spinnerGlyphs);
    const seconds = interval / 1000;
    return new Frames(
      frames.map((frame) => ({ text: new RichText("", { end: "" }).append(frame, this.style), seconds })),
      { t: this.t * this.speed },
    );
  }

  /**
   * The frame and its label as one line wrapped to the width and ended, as
   * the reference's `Text` is — printed, stacked in a `Group`, or laid out in
   * a `Progress` cell alike.
   */
  *render(options: RenderOptions): Iterable<Segment> {
    yield* this._line(this._frames(options), options).render(options);
    yield Segment.line();
  }

  /**
   * The frame in progress and the label as one text, as Rich's
   * `Text.assemble(frame, " ", text)`: a long label wraps as one line with its
   * frame. A label that draws nothing — the default `""`, or markup that
   * styles nothing — is no label, not a trailing space, as an empty `Text` is
   * falsy there.
   */
  private _line(frames: Frames, options: RenderOptions): RichText {
    const line = new RichText("", { end: "" }).append(frames.text());
    // Unhighlighted: Rich's label is a `Text` from the moment it is handed over, and a `Text` is never highlighted.
    const label = new EmbeddedText(this.text).text({ ...options, highlight: false });
    if (label.plain !== "") line.append(" ").append(label);
    return line;
  }

  /**
   * Measured at the frames' one width, the widest frame's, so a column
   * holding it never narrows as it turns, and never offered less than that
   * frame: a frame is one picture, which the reference's `Text` measure would
   * let wrap apart at its spaces.
   */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const frames = this._frames(options);
    const { minimum, maximum } = this._line(frames, options).measure(options);
    return { minimum: Math.max(minimum, Math.min(frames.width, maximum)), maximum };
  }
}
