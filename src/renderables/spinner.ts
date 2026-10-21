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
 * drawn through `Frames` directly. [LAW:one-source-of-truth]
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
 * on that clock, and a draw costs the same at `t = 0` and `t = 10⁶`.
 *
 * `speed` is a `Timeline` (`core/timeline.ts`) playing from `t = 0` at
 * that rate, as Rich scales the time, `t × speed` into the beat: the frames
 * are held for the interval the data gives, and the spinner is asked for the
 * frame at the time the timeline maps the host's to. [LAW:one-source-of-truth]
 * When the frame next changes (`Style.hold`) is a time on the host's
 * timeline, and the sequence answers on its own, so the timeline carries the
 * answer back. `at` hands over the frame alone, as every animation's does;
 * placed, a spinner draws at the frame's time and stamps its cells with that
 * answer for the frames the output draws (`drawnAt`). Backwards, the frames count down from the last at `t = 0`,
 * a negative time landing in the last frame of the pass before, where Rich's
 * `int()` truncation holds frame 0 for a first interval and then counts
 * down: a departure, made so a negative speed is the one timeline run
 * backwards and not a second rule about time. A speed of zero would hold a
 * frame forever, which a paused timeline is and a rate is not, and the
 * timeline refuses it.
 */

import { Animation, frameTimeOf, holdOf, shownAt, stampFrame } from "../core/animation.js";
import type { Hold } from "../core/style.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { RichText } from "../core/text.js";
import { SPINNERS, DEFAULT_SPINNER, LINE_SPINNER } from "../core/spinnerData.js";
import type { SpinnerData } from "../core/spinnerData.js";
import { Timeline } from "../core/timeline.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, render } from "../core/protocol.js";
import { EmbeddedText } from "./embed.js";
import { FrameSequence } from "./frames.js";
import { finiteTime } from "../core/easing.js";

/** A spinner's frames prepared to draw, each styled and held for the interval, run on the spinner's timeline, and the glyphs they spend. */
interface Sequence {
  readonly frames: FrameSequence;
  /** The frames on host time: the one asked for the frame at a host time, and when it turns on the host's clock. */
  readonly played: Animation<RichText>;
  readonly glyphs: string;
}

const sequence = (data: SpinnerData, style: string | Style, timeline: Timeline): Sequence => {
  const frames = new FrameSequence(
    data.frames.map((frame) => ({ text: new RichText("", { end: "" }).append(frame, style), seconds: data.interval / 1000 })),
  );
  return { frames, played: Timeline.run(timeline, frames), glyphs: data.frames.join("") };
};

const sequenceGlyphs = ({ glyphs }: Sequence): string => glyphs;

export interface SpinnerOptions {
  /** Multiplies the spinner's rate; negative runs it backwards; zero is refused. Defaults to 1. */
  speed?: number;
  style?: string | Style;
}

export class Spinner implements Animation<Renderable & Measurable> {
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
    // [LAW:single-enforcer] A rate is finite and not zero, and the timeline
    // refuses one that is not where it is built.
    const timeline = Timeline.play(0, speed);
    this.name = spinnerName;
    this.text = text;
    this.speed = speed;
    this.style = options?.style ?? NULL_STYLE;
    this._data = data;
    this._named = sequence(data, this.style, timeline);
    this._ascii = sequence(LINE_SPINNER, this.style, timeline);
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
   * The frame says nothing of when it turns — `t` may be a time a timeline
   * mapped — so placed, the spinner itself stamps it (`drawnAt`).
   */
  at(t: number): Renderable & Measurable {
    finiteTime("Spinner.at", t);
    return this._frame((played) => ({ value: played.at(t) }));
  }

  /** The spinner with its motion taken out: its first frame and the label, which never turn, so any time answers. */
  reduced(): Animation<Renderable & Measurable> {
    return Animation.constant(this._frame((played) => ({ value: played.reduced().at(0) })));
  }

  /**
   * The spinner drawn at host time `t`, its cells saying the hold it is in on
   * the host's clock (`stampFrame`) — exactly, for the frames the output
   * draws, where `nextChange` must answer for both. Under reduced motion it
   * is the spinner reduced, which never turns (`shownAt`). What it draws
   * placed, at the frame's time, and what a host drawing a spinner for a
   * time of its own — a `Status`, a `Progress` column — hands over.
   */
  drawnAt(t: number): Renderable & Measurable {
    finiteTime("Spinner.drawnAt", t);
    return this._frame((played, options) => {
      const shown = shownAt(played, t, options);
      return { value: shown.value, hold: holdOf(shown, t) };
    });
  }

  /** Placed: drawn at the frame's time, exactly (`drawnAt`). */
  render(options: RenderOptions): Iterable<Segment> {
    return render(this.drawnAt(frameTimeOf(options)), options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.drawnAt(frameTimeOf(options)).measure(options);
  }

  /** Nothing it is handed: the frame and the label are a line it builds. */
  *contents(): Iterable<Renderable> {}

  /** The frame `choose` picks from the frames the output can draw, and the label, saying the hold it is in if `choose` says. */
  private _frame(
    choose: (played: Animation<RichText>, options: RenderOptions) => { readonly value: RichText; readonly hold?: Hold },
  ): Renderable & Measurable {
    const drawn = (options: RenderOptions): Sequence => drawable(options, this._named, this._ascii, sequenceGlyphs);
    return {
      render: (options) => {
        const { value, hold } = choose(drawn(options).played, options);
        const segments = this._render(value, options);
        return hold === undefined ? segments : stampFrame(segments, hold);
      },
      // Measured at the frames' one width, the widest frame's, so a column
      // holding it never narrows as it turns, and never offered less than
      // that frame: a frame is one picture, which the reference's `Text`
      // measure would let wrap apart at its spaces.
      measure: (options) => {
        const { frames, played } = drawn(options);
        const { minimum, maximum } = this._line(choose(played, options).value, options).measure(options);
        return { minimum: Math.max(minimum, Math.min(frames.width, maximum)), maximum };
      },
    };
  }

  /**
   * When the spinner drawn at `t` next turns, on the host's clock: the
   * sooner of its two sequences' answers, since which one is drawn is the
   * output's to choose and the line spinner that stands in on an ASCII-only
   * output keeps its own interval. An early answer, on the output that draws
   * the other one, which the contract allows; the drawn cells carry the exact one.
   */
  nextChange(t: number): number {
    return Math.min(this._named.played.nextChange(t), this._ascii.played.nextChange(t));
  }

  /** When the spinner drawn at `t` began to be drawn: the later of its two sequences' answers, by the same argument. */
  lastChange(t: number): number {
    return Math.max(this._named.played.lastChange(t), this._ascii.played.lastChange(t));
  }

  private *_render(frame: RichText, options: RenderOptions): Iterable<Segment> {
    yield* render(this._line(frame, options), options);
    yield Segment.line();
  }

  /**
   * The frame in progress and the label as one text, as Rich's
   * `Text.assemble(frame, " ", text)`: a long label wraps as one line with its
   * frame. A label that draws nothing — the default `""`, or markup that
   * styles nothing — is no label, not a trailing space, as an empty `Text` is
   * falsy there.
   */
  private _line(frame: RichText, options: RenderOptions): RichText {
    // The frame alone, saying nothing of when it turns: `drawnAt` stamps it, for a spinner drawn at a host time.
    const line = new RichText("", { end: "" }).append(frame);
    // Unhighlighted: Rich's label is a `Text` from the moment it is handed over, and a `Text` is never highlighted.
    const label = new EmbeddedText(this.text).text({ ...options, highlight: false });
    if (label.plain !== "") line.append(" ").append(label);
    return line;
  }
}
