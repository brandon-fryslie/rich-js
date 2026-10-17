/**
 * Spinner — a named spinner, asked for its frame at a time, with an optional
 * label after it.
 *
 * A spinner is a `FrameSequence` (`./frames.ts`) over one entry of the named spinner
 * data (`core/spinnerData.ts`): each frame held for the spinner's interval,
 * looping, the frame in progress at `t` drawn. The data names the frames and
 * the interval; the beat, the width every frame draws at and which frame `t`
 * lands on are the frames primitive's, so a spinner is one more sequence on
 * it and not a second way of turning frames. Custom frames are a `FrameSequence`
 * directly. [LAW:one-source-of-truth]
 *
 * It is built once and asked for each frame, as Rich's `Spinner` is built
 * once and has `render(time)` called on it: the name is parsed and the
 * styled frames are prepared where the spinner is given, and `at(t)` is what
 * draws, so a `Status` or `SpinnerColumn` holding one pays for the name and
 * the styling once, and a bad name fails at the call that gave it.
 * [LAW:parse-dont-validate] What a `FrameSequence` makes of the frames —
 * the beat, the width, each frame padded to it — is made there too, so a
 * drawn frame costs only finding which one `t` lands on.
 *
 * [LAW:no-ambient-temporal-coupling] A Spinner draws nothing on its own:
 * only `at(t)` is a renderable, so a spinner cannot be drawn without being
 * handed its time, and nothing here reads a clock. Whoever draws frames
 * hands each one its time (`core/clock.ts`) — `SpinnerColumn` the task's
 * `time`, a `Live` the frame's time on its clock — as Rich's `Spinner.render`
 * is handed `console.get_time()` or `task.get_time()`. `t` is the clock's
 * time, as `App` and `Task.time` hand it, where Rich's spinner counts from
 * its first draw: here nothing is kept between frames, so the same `t` draws
 * the same bytes at one redraw a second or sixty, two spinners on one clock
 * agree at every `t`, a `Progress` on a hand-moved clock turns its spinners
 * on that clock, and a draw costs the same at `t = 0` and `t = 10⁶`. `speed` scales the time, as Rich's does:
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
import { FrameSequence } from "./frames.js";

/** A spinner's frames prepared to draw, each styled and held for the interval, and the glyphs they spend. */
interface Sequence {
  readonly frames: FrameSequence;
  readonly glyphs: string;
}

const sequence = (data: SpinnerData, style: string | Style): Sequence => ({
  frames: new FrameSequence(
    data.frames.map((frame) => ({
      text: new RichText("", { end: "" }).append(frame, style),
      seconds: data.interval / 1000,
    })),
  ),
  glyphs: data.frames.join(""),
});

const sequenceGlyphs = ({ glyphs }: Sequence): string => glyphs;

export interface SpinnerOptions {
  /** Multiplies the spinner's rate; negative runs it backwards. Defaults to 1. */
  speed?: number;
  style?: string | Style;
}

export class Spinner {
  readonly name: string;
  readonly speed: number;
  readonly style: string | Style;
  /**
   * The label drawn after the frame. It is read through `embed`'s one crossing
   * each time it is drawn, so a string is markup under the console that draws
   * it, as a string handed to `print` is — where Rich's `Spinner` parses it
   * whatever the console says — and a `RichText` changed in place draws as
   * changed, as the `Text` Rich keeps does. [LAW:single-enforcer]
   */
  text: string | RichText;
  private readonly _data: SpinnerData;
  // The named data's frames, and the `line` spinner's that stand in for them
  // on an ASCII-only output: prepared once, which is drawn chosen at `at`.
  private readonly _named: Sequence;
  private readonly _ascii: Sequence;

  constructor(name?: string, text: string | RichText = "", options?: SpinnerOptions) {
    const spinnerName = name ?? DEFAULT_SPINNER;
    const data = SPINNERS[spinnerName];
    if (!data) {
      throw new Error(`Unknown spinner: "${spinnerName}"`);
    }
    const speed = options?.speed ?? 1;
    if (!Number.isFinite(speed)) {
      throw new RangeError(`Spinner speed must be finite, got ${speed}`);
    }
    this.name = spinnerName;
    this.text = text;
    this.speed = speed;
    this.style = options?.style ?? NULL_STYLE;
    this._data = data;
    this._named = sequence(data, this.style);
    this._ascii = sequence(LINE_SPINNER, this.style);
  }

  get frames(): readonly string[] {
    return this._data.frames;
  }

  /** Milliseconds each frame is held, as the spinner data gives it. */
  get interval(): number {
    return this._data.interval;
  }

  /**
   * The frame in progress at `t` seconds and the label, as one renderable:
   * the line wrapped to the width and ended, as the reference's `Text` is —
   * printed, stacked in a `Group`, or laid out in a `Progress` cell alike.
   * The frames this output can draw are chosen where the output is known.
   */
  at(t: number): Renderable & Measurable {
    if (!Number.isFinite(t)) {
      throw new RangeError(`Spinner.at needs a finite t, got ${t}`);
    }
    const scaled = t * this.speed;
    const frames = (options: RenderOptions): FrameSequence =>
      drawable(options, this._named, this._ascii, sequenceGlyphs).frames;
    return {
      render: (options) => this._render(frames(options), scaled, options),
      // Measured at the frames' one width, the widest frame's, so a column
      // holding it never narrows as it turns, and never offered less than
      // that frame: a frame is one picture, which the reference's `Text`
      // measure would let wrap apart at its spaces.
      measure: (options) => {
        const drawn = frames(options);
        const { minimum, maximum } = this._line(drawn, scaled, options).measure(options);
        return { minimum: Math.max(minimum, Math.min(drawn.width, maximum)), maximum };
      },
    };
  }

  private *_render(frames: FrameSequence, t: number, options: RenderOptions): Iterable<Segment> {
    yield* this._line(frames, t, options).render(options);
    yield Segment.line();
  }

  /**
   * The frame in progress and the label as one text, as Rich's
   * `Text.assemble(frame, " ", text)`: a long label wraps as one line with its
   * frame. A label that draws nothing — the default `""`, or markup that
   * styles nothing — is no label, not a trailing space, as an empty `Text` is
   * falsy there.
   */
  private _line(frames: FrameSequence, t: number, options: RenderOptions): RichText {
    const line = new RichText("", { end: "" }).append(frames.text(t));
    // Unhighlighted: Rich's label is a `Text` from the moment it is handed over, and a `Text` is never highlighted.
    const label = new EmbeddedText(this.text).text({ ...options, highlight: false });
    if (label.plain !== "") line.append(" ").append(label);
    return line;
  }
}
