/**
 * Spinner — animated terminal spinner with optional text label.
 */

import { cellLen } from "../core/cells.js";
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

const spinnerGlyphs = ({ frames }: SpinnerData): string => frames.join("");

export interface SpinnerOptions {
  speed?: number;
  style?: string | Style;
}

export class Spinner implements Renderable, Measurable {
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
  private _frameIndex: number;
  private _lastUpdate: number;

  constructor(name?: string, text: string | RichText = "", options?: SpinnerOptions) {
    const spinnerName = name ?? DEFAULT_SPINNER;
    const data = SPINNERS[spinnerName];
    if (!data) {
      throw new Error(`Unknown spinner: "${spinnerName}"`);
    }
    this.name = spinnerName;
    this.text = text;
    this.speed = options?.speed ?? 1;
    this.style = options?.style ?? NULL_STYLE;
    this._data = data;
    this._frameIndex = 0;
    this._lastUpdate = Date.now();
  }

  get frames(): readonly string[] {
    return this._data.frames;
  }

  get interval(): number {
    return this._data.interval;
  }

  /** Advance the frame count by the time elapsed, and return it. */
  private _advance(): number {
    const now = Date.now();
    // Whole frames passed at this speed; a negative speed steps backwards, as
    // Rich's does, so the index wraps with a modulo that is never negative.
    const steps = Math.trunc(((now - this._lastUpdate) * this.speed) / this.interval);
    if (steps !== 0) {
      const count = this._data.frames.length;
      this._frameIndex = (((this._frameIndex + steps) % count) + count) % count;
      this._lastUpdate = now;
    }
    return this._frameIndex;
  }

  /** The frames this output can draw: the `line` spinner stands in for any other on an ASCII-only one. */
  private _drawnFrames(options: RenderOptions): readonly string[] {
    return drawable(options, this._data, LINE_SPINNER, spinnerGlyphs).frames;
  }

  /**
   * The current frame and its label as one line wrapped to the width and
   * ended, as the reference's `Text` is — printed, stacked in a `Group`, or
   * laid out in a `Progress` cell alike.
   */
  *render(options: RenderOptions): Iterable<Segment> {
    yield* this._currentLine(options).render(options);
    yield Segment.line();
  }

  private _currentLine(options: RenderOptions): RichText {
    const frames = this._drawnFrames(options);
    return this._line(frames[this._advance() % frames.length]!, options);
  }

  /**
   * `frame` and the label as one text, as Rich's `Text.assemble(frame, " ",
   * text)`: a long label wraps as one line with its frame. A label that draws
   * nothing — the default `""`, or markup that styles nothing — is no label,
   * not a trailing space, as an empty `Text` is falsy there.
   */
  private _line(frame: string, options: RenderOptions): RichText {
    const line = new RichText("", { end: "" }).append(frame, this.style);
    // Unhighlighted: Rich's label is a `Text` from the moment it is handed over, and a `Text` is never highlighted.
    const label = new EmbeddedText(this.text).text({ ...options, highlight: false });
    if (label.plain !== "") line.append(" ").append(label);
    return line;
  }

  /**
   * Measured at its widest frame, so a column holding it never narrows as it
   * turns, and never offered less than that frame: a frame is one picture,
   * which the reference's `Text` measure would let wrap apart at its spaces.
   */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const frames = this._drawnFrames(options);
    const widths = frames.map((frame) => cellLen(frame));
    const frameWidth = Math.max(...widths);
    const { minimum, maximum } = this._line(frames[widths.indexOf(frameWidth)]!, options).measure(options);
    return { minimum: Math.max(minimum, Math.min(frameWidth, maximum)), maximum };
  }
}
