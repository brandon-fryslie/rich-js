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
 * and is the single way segments become wire bytes. `Console._writeSegments`,
 * `Live.refresh`, and `segmentToString` all delegate here, so terminal output,
 * live frames, string export, and single-segment encoding agree by construction.
 *
 * [LAW:dataflow-not-control-flow] The same pipeline runs every render: collect
 * non-control non-empty pieces, partition by SGR-codes (SGR-runs), partition
 * each run by link (link-runs), emit one SGR open/close per run with link
 * open/close pairs sitting inside. `colorSystem === null` is data: every piece
 * is collected with empty SGR-codes *and* no link, so the same pipeline emits
 * plain text — no SGR wraps and no OSC 8 hyperlink wraps. NO_COLOR therefore
 * strips *all* ANSI escape emission, not just colors.
 *
 * [LAW:types-are-the-program] Adjacent same-style segments share an SGR wrap
 * because the SGR-codes string is the same group key for both — the
 * partitioning shape (data) encodes the byte structure; the emit walk is a
 * mechanical fold over it.
 */

import { ColorDepth, resolveColorSystem } from "./color.js";
import type { DetectColorOptions } from "./color.js";
import type { Segment } from "./segment.js";
import type { Renderable, RenderOptions } from "./protocol.js";
import { stripOscTerminators } from "./sanitize.js";

export interface RenderToStringOptions {
  /** Cell width to render into. Default 80. */
  width?: number;
  /**
   * Color encoding to emit. Accepts a string spec (`"auto"`, `"truecolor"`,
   * `"256"`, `"ansi"`, `"none"`), a `ColorDepth` enum value, or `null` to
   * strip *all* ANSI escape emission — SGR colors/attributes *and* OSC 8
   * hyperlinks. Default truecolor.
   */
  colorSystem?: string | ColorDepth | null;
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

interface Piece {
  readonly text: string;
  readonly sgrCodes: string;
  readonly link: string | undefined;
}

function segmentToPiece(
  segment: Segment,
  colorSystem: ColorDepth | null,
): Piece | undefined {
  if (segment.isControl) return undefined;
  if (segment.text.length === 0) return undefined;
  const style = segment.style;
  if (!style || style.isNull || colorSystem === null) {
    return { text: segment.text, sgrCodes: "", link: undefined };
  }
  return {
    text: segment.text,
    sgrCodes: style.toSgrCodes(colorSystem),
    link: style.link,
  };
}

/**
 * Encodes a single segment as ANSI bytes. Equivalent to
 * `segmentsToString([segment], colorSystem)` — same SGR / OSC 8 layout.
 */
export function segmentToString(
  segment: Segment,
  colorSystem: ColorDepth | null,
): string {
  return segmentsToString([segment], colorSystem);
}

/**
 * Encodes a sequence of segments as ANSI bytes, coalescing adjacent
 * same-SGR segments under a single SGR open/close pair, with OSC 8 link
 * pairs nested inside per same-link sub-run.
 */
export function segmentsToString(
  segments: Iterable<Segment>,
  colorSystem: ColorDepth | null,
): string {
  const pieces: Piece[] = [];
  for (const s of segments) {
    const p = segmentToPiece(s, colorSystem);
    if (p) pieces.push(p);
  }
  if (pieces.length === 0) return "";

  // [LAW:dataflow-not-control-flow] One linear chunk accumulator for the
  // entire output; SGR / OSC 8 boundaries and piece texts all push into it
  // in order. No per-link-run intermediate string, no quadratic `+=` chains.
  const parts: string[] = [];
  let i = 0;
  while (i < pieces.length) {
    const sgr = pieces[i]!.sgrCodes;
    let j = i + 1;
    while (j < pieces.length && pieces[j]!.sgrCodes === sgr) j++;
    if (sgr.length > 0) parts.push(`\x1b[${sgr}m`);
    let k = i;
    while (k < j) {
      const link = pieces[k]!.link;
      let l = k + 1;
      while (l < j && pieces[l]!.link === link) l++;
      if (link) {
        // [LAW:single-enforcer] Wire-byte trust boundary — sanitize the URL
        // at the one place it becomes an OSC 8 sequence, regardless of which
        // upstream API attached it to the Style. Defense-in-depth for the
        // RichText data-model boundary in text.ts; also covers Style paths
        // that don't go through RichText (Console.print({style: ...}), any
        // direct `Segment.applyStyle(... new Style({ link })) ...`).
        parts.push(`\x1b]8;;${stripOscTerminators(link)}\x1b\\`);
        for (let m = k; m < l; m++) parts.push(pieces[m]!.text);
        parts.push("\x1b]8;;\x1b\\");
      } else {
        for (let m = k; m < l; m++) parts.push(pieces[m]!.text);
      }
      k = l;
    }
    if (sgr.length > 0) parts.push("\x1b[0m");
    i = j;
  }
  return parts.join("");
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
