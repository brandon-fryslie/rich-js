/**
 * Measurement — min/max cell width calculation for renderables.
 */

import { isMeasurable, measuring, type Measurable, type Renderable, type RenderOptions } from "./protocol.js";

export class Measurement {
  readonly minimum: number;
  readonly maximum: number;

  constructor(minimum: number, maximum: number) {
    this.minimum = minimum;
    this.maximum = maximum;
  }

  get span(): number {
    return this.maximum - this.minimum;
  }

  /**
   * A range with no cell meaning becomes one with the nearest meaning there is:
   * negative floors to zero, an inverted pair collapses to its ceiling, and NaN
   * reads as zero cells the same way `cellCount` reads it.
   *
   * NaN and Infinity are not treated alike here, and the difference is the whole
   * point. `Infinity` is a maximum a renderable means — `Table` reports it when
   * a column asks for every cell there is, and `withBoundedWidth` throws on it
   * so a caller learns their offer was unanswerable. Flooring it to zero would
   * turn that loud failure into a table measured at no width at all.
   */
  normalize(): Measurement {
    const cells = (n: number): number => (Number.isNaN(n) ? 0 : n);
    const min = Math.max(0, Math.min(cells(this.minimum), cells(this.maximum)));
    const max = Math.max(0, cells(this.maximum));
    return new Measurement(min, max);
  }

  withMaximum(width: number): Measurement {
    return new Measurement(
      Math.min(this.minimum, width),
      Math.min(this.maximum, width),
    );
  }

  withMinimum(width: number): Measurement {
    const min = Math.max(this.minimum, width);
    const max = Math.max(this.maximum, min);
    return new Measurement(min, max);
  }

  clamp(minWidth: number, maxWidth: number): Measurement {
    return new Measurement(
      Math.min(Math.max(this.minimum, minWidth), maxWidth),
      Math.min(Math.max(this.maximum, minWidth), maxWidth),
    );
  }

  // [LAW:single-enforcer] Single entry point for measuring a renderable. One
  // that cannot measure itself asks for the whole offer, as the reference's
  // `Measurement.get` answers for it — so under an unbounded offer it asks for
  // `Infinity`, and `withBoundedWidth` refuses rather than guessing a width.
  static get(options: RenderOptions, renderable: Renderable | Measurable): Measurement {
    if (options.maxWidth < 1) return new Measurement(0, 0);
    if (!isMeasurable(renderable)) return new Measurement(0, options.maxWidth);
    const { minimum, maximum } = renderable.measure(measuring(options));
    return new Measurement(minimum, Math.min(maximum, options.maxWidth)).normalize();
  }
}

export function measureRenderables(
  options: RenderOptions,
  renderables: readonly (Renderable | Measurable)[],
): Measurement {
  if (renderables.length === 0) return new Measurement(0, 0);
  let minOfAll = 0;
  let maxOfAll = 0;
  for (const m of renderables) {
    const measurement = Measurement.get(options, m);
    minOfAll = Math.max(minOfAll, measurement.minimum);
    maxOfAll = Math.max(maxOfAll, measurement.maximum);
  }
  return new Measurement(minOfAll, maxOfAll);
}
