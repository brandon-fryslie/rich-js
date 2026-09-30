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
  private readonly _data: SpinnerData;
  private _frameIndex: number;
  private _lastUpdate: number;
  // The label as it was handed over, and as it crosses `embed`'s one crossing,
  // so a string is markup under the console that draws it, as Rich's
  // `Text.from_markup(text)` makes it. [LAW:single-enforcer]
  private _label: { given: string | RichText; drawn: EmbeddedText };

  constructor(name?: string, text: string | RichText = "", options?: SpinnerOptions) {
    const spinnerName = name ?? DEFAULT_SPINNER;
    const data = SPINNERS[spinnerName];
    if (!data) {
      throw new Error(`Unknown spinner: "${spinnerName}"`);
    }
    this.name = spinnerName;
    this._label = { given: text, drawn: new EmbeddedText(text) };
    this.speed = options?.speed ?? 1;
    this.style = options?.style ?? NULL_STYLE;
    this._data = data;
    this._frameIndex = 0;
    this._lastUpdate = Date.now();
  }

  /** The label drawn after the frame, as it was handed over. */
  get text(): string | RichText {
    return this._label.given;
  }

  set text(value: string | RichText) {
    this._label = { given: value, drawn: new EmbeddedText(value) };
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
    const elapsed = now - this._lastUpdate;
    const effectiveInterval = this.interval / this.speed;
    if (elapsed >= effectiveInterval) {
      const steps = Math.floor(elapsed / effectiveInterval);
      this._frameIndex = (this._frameIndex + steps) % this._data.frames.length;
      this._lastUpdate = now;
    }
    return this._frameIndex;
  }

  /** The frames this output can draw: the `line` spinner stands in for any other on an ASCII-only one. */
  private _drawnFrames(options: RenderOptions): readonly string[] {
    return drawable(options, this._data, LINE_SPINNER, spinnerGlyphs).frames;
  }

  /**
   * The spinner's current frame and its text, with no line end: the
   * fragment a caller composes inside a line of its own, a `Progress` cell.
   * `render` is this line, ended, because a `Spinner`
   * printed or stacked in a `Group` is a line of its own, as the reference's
   * `Text` is.
   */
  *drawFrame(options: RenderOptions): Iterable<Segment> {
    const frames = this._drawnFrames(options);
    yield* this._line(frames[this._advance() % frames.length]!, options).render(options);
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
    const label = this._label.drawn.text({ ...options, highlighter: undefined });
    if (label.plain !== "") line.append(" ").append(label);
    return line;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this.drawFrame(options);
    yield Segment.line();
  }

  /** Measured at its widest frame, so a column holding it never narrows as it turns. */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const frames = this._drawnFrames(options);
    const widest = frames.reduce((a, b) => (cellLen(b) > cellLen(a) ? b : a));
    return this._line(widest, options).measure(options);
  }
}
