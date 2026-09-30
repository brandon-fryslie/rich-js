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
 * [LAW:single-enforcer] The Segment-to-ANSI conversion lives in `segmentToString`
 * and is the single way a segment becomes wire bytes. `segmentsToString` is
 * that encoding joined, and `Console._writeSegments`, `Painter` (every `Live`
 * and `App` frame) and `renderToString` all go through it, so terminal output,
 * live and app frames and string export agree by construction.
 *
 * [LAW:one-source-of-truth] What the encoding needs from where it writes
 * arrives as one `Destination` value. Each caller resolves its destination
 * once — spec, detection, and its own overrides — and hands it through whole,
 * so a depth is never paired with a link setting taken from somewhere else.
 *
 * Every segment is written alone, exactly as Python Rich 9d8f9a3 writes it
 * (`Console._render_buffer` calls `Style.render` per segment): its SGR codes
 * open, its text, a reset, and an OSC 8 pair around all three when it carries
 * a link. Two adjacent segments with equal codes are two runs, not one. That
 * costs a reset and a reopen the terminal draws identically, and it is what
 * lets a fixture generated from the reference hold any sequence of segments,
 * rather than only those in which no two neighbours happen to share a style
 * (rich-render-g5g8). The price of that is that where a renderable cuts its
 * segments is now in the bytes, so a renderable pinned against the reference
 * has to cut where the reference cuts, as `Box`'s rules and `Table`'s blank
 * cell lines do. A link split across segments still hovers as one link,
 * because every pair it becomes carries the id `osc8Open` derives from the URL.
 *
 * Colour and hyperlinks are two facts about the destination:
 * `colorSystem === null` empties every segment's SGR codes, and
 * `hyperlinks === false` drops every segment's link. A colour depth never
 * removes a link — a hyperlink is not a colour, and a NO_COLOR terminal still
 * follows OSC 8. This is where the port departs from the reference, whose
 * `Style.render` returns bare text for a null colour system.
 */

import { ColorDepth, resolveDestination } from "./color.js";
import type { DetectColorOptions, Destination } from "./color.js";
import type { Env } from "./env.js";
import type { Segment } from "./segment.js";
import type { Renderable, RenderOptions } from "./protocol.js";
import { OSC8_CLOSE, osc8Open } from "./osc8.js";

// [LAW:one-source-of-truth] Handed to the render unchanged, so their contract is
// `RenderOptions`' and is not restated here.
export interface RenderToStringOptions extends Pick<RenderOptions, "asciiOnly" | "onStyleError"> {
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
  env?: Env;
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

/**
 * Encodes one segment as ANSI bytes for `destination`: the reference's
 * `Style.render` for that segment, and nothing for a control segment.
 */
export function segmentToString(segment: Segment, destination: Destination): string {
  // [LAW:one-type-per-behavior] Colour depth governs SGR only; hyperlinks are
  // their own fact. Coupling them let a colour setting delete every control.
  if (segment.isControl) return "";
  const { text, style } = segment;
  // As the reference's `if not text` and `if style:` — no pair around nothing.
  if (text.length === 0 || style === undefined) return text;
  const codes = destination.colorSystem === null ? "" : style.toSgrCodes(destination.colorSystem);
  const styled = codes.length > 0 ? `\x1b[${codes}m${text}\x1b[0m` : text;
  const link = destination.hyperlinks ? style.link : undefined;
  return link === undefined ? styled : `${osc8Open(link)}${styled}${OSC8_CLOSE}`;
}

/** Encodes a sequence of segments as ANSI bytes for `destination`, one segment at a time. */
export function segmentsToString(segments: Iterable<Segment>, destination: Destination): string {
  const parts: string[] = [];
  for (const segment of segments) parts.push(segmentToString(segment, destination));
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
    asciiOnly: options?.asciiOnly ?? false,
    onStyleError: options?.onStyleError,
    // [LAW:one-source-of-truth] The depth the segments below are encoded at,
    // so a renderable measures what this very call will draw.
    colorSystem: destination.colorSystem,
  };

  return segmentsToString(renderable.render(renderOptions), destination);
}
