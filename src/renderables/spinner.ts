/**
 * Spinner — animated terminal spinner with optional text label.
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { SPINNERS, DEFAULT_SPINNER, LINE_SPINNER } from "../core/spinnerData.js";
import type { SpinnerData } from "../core/spinnerData.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle } from "../core/protocol.js";

const spinnerGlyphs = ({ frames }: SpinnerData): string => frames.join("");

export interface SpinnerOptions {
  speed?: number;
  style?: string | Style;
}

export class Spinner implements Renderable, Measurable {
  readonly name: string;
  readonly text: string | undefined;
  readonly speed: number;
  readonly style: string | Style;
  private readonly _data: SpinnerData;
  private _frameIndex: number;
  private _lastUpdate: number;

  constructor(name?: string, text?: string, options?: SpinnerOptions) {
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

  *render(options: RenderOptions): Iterable<Segment> {
    const frames = this._drawnFrames(options);
    const frame = frames[this._advance() % frames.length]!;
    const style = getStyle(options, this.style);
    const spinStyle = style.isNull ? undefined : style;
    yield new Segment(frame, spinStyle);
    if (this.text) {
      yield new Segment(` ${this.text}`);
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const frameWidth = Math.max(...this._drawnFrames(options).map((f) => cellLen(f)));
    const textWidth = this.text ? cellLen(this.text) + 1 : 0;
    const total = frameWidth + textWidth;
    return { minimum: frameWidth, maximum: total };
  }
}
