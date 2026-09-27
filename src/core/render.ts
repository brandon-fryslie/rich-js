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
 * `Live.refresh`, `Screen`'s frame paint, `renderToString`, and
 * `segmentToString` all delegate here, so terminal output, live frames, widget
 * frames, string export, and single-segment encoding agree by construction.
 *
 * [LAW:one-source-of-truth] What the encoding needs from where it writes
 * arrives as one `Destination` value. Each caller resolves its destination
 * once — spec, detection, and its own overrides — and hands it through whole,
 * so a depth is never paired with a link setting taken from somewhere else.
 *
 * [LAW:dataflow-not-control-flow] The same pipeline runs every render: collect
 * non-control non-empty pieces, partition by SGR-codes (SGR-runs), partition
 * each run by link (link-runs), emit one SGR open/close per run with link
 * open/close pairs sitting inside. Colour and hyperlinks are two facts about
 * the destination: `colorSystem === null` empties every piece's SGR-codes, and
 * `hyperlinks === false` empties every piece's link. A colour depth never
 * removes a link — a hyperlink is not a colour, and a NO_COLOR terminal still
 * follows OSC 8.
 *
 * [LAW:types-are-the-program] Adjacent same-style segments share an SGR wrap
 * because the SGR-codes string is the same group key for both — the
 * partitioning shape (data) encodes the byte structure; the emit walk is a
 * mechanical fold over it.
 */

import { ColorDepth, resolveDestination } from "./color.js";
import type { DetectColorOptions, Destination } from "./color.js";
import type { Segment } from "./segment.js";
import type { Renderable, RenderOptions } from "./protocol.js";
import { OSC8_CLOSE, osc8Open } from "./osc8.js";

export interface RenderToStringOptions {
  /** Cell width to render into. Default 80. */
  width?: number;
  /**
   * Color encoding to emit. Accepts a string spec (`"auto"`, `"truecolor"`,
   * `"256"`, `"ansi"`, `"none"`), a `ColorDepth` enum value, or `null` to
   * strip SGR colors/attributes. Hyperlinks are `hyperlinks`' concern. Default
   * truecolor.
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
  /**
   * Whether OSC 8 hyperlinks are emitted. Independent of `colorSystem`: a
   * null colour system strips SGR and keeps links. Default: what the
   * destination takes — true for an explicit depth, detected under `"auto"`
   * (no TTY or TERM=dumb: false). `false` with `colorSystem: null` is plain text.
   */
  hyperlinks?: boolean;
}

const DEFAULT_WIDTH = 80;

interface Piece {
  readonly text: string;
  readonly sgrCodes: string;
  readonly link: string | undefined;
}

function segmentToPiece(segment: Segment, destination: Destination): Piece | undefined {
  if (segment.isControl) return undefined;
  if (segment.text.length === 0) return undefined;
  const style = segment.style;
  if (!style || style.isNull) {
    return { text: segment.text, sgrCodes: "", link: undefined };
  }
  // [LAW:one-type-per-behavior] Colour depth governs SGR only; hyperlinks are
  // their own fact. Coupling them let a colour setting delete every control.
  return {
    text: segment.text,
    sgrCodes: destination.colorSystem === null ? "" : style.toSgrCodes(destination.colorSystem),
    link: destination.hyperlinks ? style.link : undefined,
  };
}

/**
 * Encodes a single segment as ANSI bytes for `destination`. Equivalent to
 * `segmentsToString([segment], destination)` — same SGR / OSC 8 layout.
 */
export function segmentToString(segment: Segment, destination: Destination): string {
  return segmentsToString([segment], destination);
}

/**
 * Encodes a sequence of segments as ANSI bytes for `destination`, coalescing
 * adjacent same-SGR segments under a single SGR open/close pair, with OSC 8
 * link pairs nested inside per same-link sub-run.
 */
export function segmentsToString(segments: Iterable<Segment>, destination: Destination): string {
  const pieces: Piece[] = [];
  for (const s of segments) {
    const p = segmentToPiece(s, destination);
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
        parts.push(osc8Open(link));
        for (let m = k; m < l; m++) parts.push(pieces[m]!.text);
        parts.push(OSC8_CLOSE);
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
  // [LAW:dataflow-not-control-flow] An absent spec is truecolor; an explicit
  // `null` stays null (`??` would collapse it).
  // [LAW:single-enforcer] Specs resolve through `resolveDestination`.
  const detectOptions: DetectColorOptions = {};
  if (options?.env !== undefined) detectOptions.env = options.env;
  if (options?.isTTY !== undefined) detectOptions.isTTY = options.isTTY;
  const rawSpec = options?.colorSystem;
  const resolved = resolveDestination(
    rawSpec === undefined ? ColorDepth.TRUECOLOR : rawSpec,
    detectOptions,
  );
  // [LAW:single-enforcer] This call's overrides are applied here, once, to
  // make the one destination everything below is drawn for. `noColor` is a
  // colour choice, so it overrides the depth and leaves hyperlinks to the
  // destination; an explicit `hyperlinks` overrides what the destination takes.
  const destination: Destination = {
    colorSystem: options?.noColor ? null : resolved.colorSystem,
    hyperlinks: options?.hyperlinks ?? resolved.hyperlinks,
  };
  const renderOptions: RenderOptions = {
    maxWidth: width,
    isTerminal: false,
    encoding: "utf-8",
    asciiOnly: false,
    // [LAW:one-source-of-truth] The depth the segments below are encoded at,
    // so a renderable measures what this very call will draw.
    colorSystem: destination.colorSystem,
  };

  return segmentsToString(renderable.render(renderOptions), destination);
}
