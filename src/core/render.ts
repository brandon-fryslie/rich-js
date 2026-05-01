/**
 * `renderToString` — stateless one-shot emission of a `Renderable` to a string
 * of ANSI-encoded text. Pure function: same inputs produce byte-identical
 * output. Does not write to `process.stdout` and does not require a `Console`
 * instance.
 *
 * Note on `colorSystem: "auto"`: the `"auto"` spec resolves via
 * `detectColorSystem`, which reads `process.env` and `process.stdout?.isTTY`
 * by default. Callers that want a fully deterministic render must either pass
 * an explicit `ColorDepth` enum / non-`"auto"` spec, or supply `env` and
 * `isTTY` in the options so detection does not consult ambient process state.
 *
 * [LAW:single-enforcer] The Segment-to-ANSI conversion lives in `segmentsToString`
 * and is the single way segments become wire bytes. `Console._renderSegment`
 * delegates here, so terminal output and string export agree by construction.
 *
 * [LAW:dataflow-not-control-flow] The same loop runs every render: walk the
 * generator, drop control segments, encode each remaining segment with the
 * configured color system. `colorSystem === null` is data — it makes
 * `Style.render` skip codes — not a separate code path.
 */

import { ColorDepth, resolveColorSystem } from "./color.js";
import type { ColorSystemSpec, DetectColorOptions } from "./color.js";
import type { Segment } from "./segment.js";
import type { Renderable, RenderOptions } from "./protocol.js";

export interface RenderToStringOptions {
  /** Cell width to render into. Default 80. */
  width?: number;
  /**
   * Color encoding to emit. Accepts a `ColorSystemSpec` string (`"auto"`,
   * `"truecolor"`, `"256"`, `"ansi"`, `"none"`), a `ColorDepth` enum value,
   * or `null` to strip all color codes. Default truecolor.
   */
  colorSystem?: ColorSystemSpec | ColorDepth | null;
  /**
   * Environment to consult when `colorSystem` is `"auto"`. Defaults to
   * `process.env`. Pass an explicit value to keep rendering deterministic.
   */
  env?: NodeJS.ProcessEnv;
  /**
   * Whether output is going to a TTY when `colorSystem` is `"auto"`. Defaults
   * to `process.stdout?.isTTY`. Pass an explicit value to keep rendering
   * deterministic.
   */
  isTTY?: boolean;
  /** When true, forces `colorSystem` to `null` regardless of the explicit value. */
  noColor?: boolean;
}

const DEFAULT_WIDTH = 80;

export function segmentToString(
  segment: Segment,
  colorSystem: ColorDepth | null,
): string {
  if (segment.isControl) return "";
  if (!segment.style || colorSystem === null) return segment.text;
  return segment.style.render(segment.text, colorSystem);
}

export function segmentsToString(
  segments: Iterable<Segment>,
  colorSystem: ColorDepth | null,
): string {
  let out = "";
  for (const s of segments) out += segmentToString(s, colorSystem);
  return out;
}

export function renderToString(
  renderable: Renderable,
  options?: RenderToStringOptions,
): string {
  const width = options?.width ?? DEFAULT_WIDTH;
  // [LAW:dataflow-not-control-flow] Distinguish "explicit null" from the
  // defaulted case. `??` would collapse `null` into the default; `in` would
  // accept an explicit `undefined` value as authoritative. Only an explicit
  // `null` (or `noColor: true`) strips color; everything else — absent field,
  // explicit `undefined` — falls back to truecolor.
  // [LAW:single-enforcer] String specs route through `resolveColorSystem`;
  // enum/null pass through unchanged.
  const rawSpec = options?.colorSystem;
  // [LAW:dataflow-not-control-flow] Build the detect options unconditionally;
  // `resolveColorSystem` ignores them for non-`"auto"` specs.
  const detectOptions: DetectColorOptions = {};
  if (options?.env !== undefined) detectOptions.env = options.env;
  if (options?.isTTY !== undefined) detectOptions.isTTY = options.isTTY;
  const colorSystem = options?.noColor
    ? null
    : rawSpec === undefined
      ? ColorDepth.TRUECOLOR
      : typeof rawSpec === "string"
        ? resolveColorSystem(rawSpec, detectOptions)
        : rawSpec;
  const renderOptions: RenderOptions = {
    maxWidth: width,
    isTerminal: false,
    encoding: "utf-8",
    asciiOnly: false,
  };

  return segmentsToString(renderable.render(renderOptions), colorSystem);
}
