import { ColorDepth } from "../../src/core/color.js";
import { Oklch } from "../../src/core/oklch.js";
import { SEAM_MIN_DELTA_E } from "../../src/core/strip.js";
import type { Style } from "../../src/core/style.js";

/**
 * Whether a join cell's ink stands off its ground as `depth` draws them: the
 * oracle the lift's tests read, written apart from the joiner's own measure.
 * Two colours with an RGB the depth fixes are at least `SEAM_MIN_DELTA_E` apart
 * in ΔE_OK. A slot, or a mix the terminal's theme draws, has no RGB here, so
 * it stands off only by being another slot or another mix — at sixteen
 * colours, a different slot.
 */
export function standsOffAsDrawn(style: Style, depth: ColorDepth = ColorDepth.TRUECOLOR): boolean {
  const { color, bgcolor } = style.drawnColors(depth);
  if (color === undefined || bgcolor === undefined) throw new Error(`a measured cell has ink and ground; got ${style.toString()}`);
  const [ink, ground] = [color.fixedValue, bgcolor.fixedValue];
  if (ink !== undefined && ground !== undefined) return Oklch.fromRgba(ink).deltaE(Oklch.fromRgba(ground)) >= SEAM_MIN_DELTA_E;
  return color.number !== undefined ? color.number !== bgcolor.number : color.name !== bgcolor.name;
}
