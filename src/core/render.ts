/**
 * `renderToString` — stateless one-shot emission of a `Renderable` to a string
 * of ANSI-encoded text. Pure function: same inputs produce byte-identical
 * output. Does not touch `process.stdout`, does not query the terminal, does
 * not require a `Console` instance.
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

import { ColorSystem, resolveColorSystem } from "./color.js";
import type { ColorSystemSpec } from "./color.js";
import type { Segment } from "./segment.js";
import type { Renderable, RenderOptions } from "./protocol.js";

export interface RenderToStringOptions {
  /** Cell width to render into. Default 80. */
  width?: number;
  /**
   * Color encoding to emit. Accepts a `ColorSystemSpec` string (`"auto"`,
   * `"truecolor"`, `"256"`, `"ansi"`, `"none"`), a `ColorSystem` enum value,
   * or `null` to strip all color codes. Default truecolor.
   */
  colorSystem?: ColorSystemSpec | ColorSystem | null;
  /** When true, forces `colorSystem` to `null` regardless of the explicit value. */
  noColor?: boolean;
  /** Append a trailing newline if the rendered output does not already end with one. Default true. */
  endWithNewline?: boolean;
}

const DEFAULT_WIDTH = 80;

export function segmentToString(
  segment: Segment,
  colorSystem: ColorSystem | null,
): string {
  if (segment.isControl) return "";
  if (!segment.style || colorSystem === null) return segment.text;
  return segment.style.render(segment.text, colorSystem);
}

export function segmentsToString(
  segments: Iterable<Segment>,
  colorSystem: ColorSystem | null,
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
  const colorSystem = options?.noColor
    ? null
    : rawSpec === undefined
      ? ColorSystem.TRUECOLOR
      : typeof rawSpec === "string"
        ? resolveColorSystem(rawSpec)
        : rawSpec;
  const endWithNewline = options?.endWithNewline ?? true;

  const renderOptions: RenderOptions = {
    maxWidth: width,
    isTerminal: false,
    encoding: "utf-8",
    asciiOnly: false,
  };

  const out = segmentsToString(renderable.render(renderOptions), colorSystem);
  if (!endWithNewline) return out;
  return out.endsWith("\n") ? out : out + "\n";
}
