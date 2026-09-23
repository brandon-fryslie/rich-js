/**
 * The OSC 8 hyperlink wire grammar — which bytes may not appear inside a
 * link, how a link becomes bytes, and how bytes are read back as a link.
 *
 * [LAW:one-source-of-truth] Every producer (`segmentsToString`,
 * `Style.render`) opens a link through `osc8Open` and closes it with
 * `OSC8_CLOSE`; every consumer that reads rendered bytes (a width measure, a
 * test extracting URLs) matches them with `OSC8`; the data-model boundary
 * (RichText) cleans URLs with `stripOscTerminators`. All four read the one
 * terminator set below, so the bytes a sanitizer removes and the bytes a
 * reader stops at cannot disagree.
 *
 * [LAW:locality-or-seam] This module depends on nothing; every consumer
 * imports downward.
 *
 * The `id=` parameter is what makes one link hover as one link. A terminal
 * treats cells as the same hyperlink when they share BOTH the URI and the id
 * (the OSC 8 spec, and VTE / iTerm2 / kitty / WezTerm alike); without an id,
 * each open sequence is its own link. The coalescer can only share one OSC 8
 * pair across a run of identical SGR, so a link whose text changes style
 * mid-span — a bold glyph beside plain text, a padded cell — is emitted as
 * several pairs, and would highlight piecewise on hover.
 *
 * [LAW:types-are-the-program] The id is a pure function of the URI, so the
 * byte stream stays a pure function of (style, text, colorSystem): no counter,
 * no construction-order dependence. The consequence is deliberate: two spans
 * with the same URI hover as one link wherever they sit on screen, adjacent
 * or not — a click on either does the same thing, so they ARE one link.
 * Because terminals key on the (id, URI) PAIR, a hash collision between two
 * different URIs merges nothing — the URIs still differ — so a 32-bit hash is
 * exact, not approximate.
 */

/**
 * The bytes that prematurely terminate an OSC 8 sequence: ESC (`\x1b`, which
 * begins ST `ESC \`), BEL (`\x07`), and the 8-bit ST (`\x9c`).
 */
const TERMINATORS = "\\x1b\\x07\\x9c";

const TERMINATOR_RE = new RegExp(`[${TERMINATORS}]`, "g");

/** Remove every byte that could break a URL out of its OSC 8 wrap. */
export function stripOscTerminators(url: string): string {
  return url.replace(TERMINATOR_RE, "");
}

const utf8 = new TextEncoder();

/**
 * FNV-1a, 32-bit, over the URL's UTF-8 bytes, as 8 lowercase hex digits — a
 * legal `id=` value (no `:`/`;`). UTF-8 rather than UTF-16 code units, so any
 * other runtime computing standard FNV-1a over the same URL gets the same id.
 */
function linkId(url: string): string {
  let h = 0x811c9dc5;
  for (const byte of utf8.encode(url)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/**
 * The bytes that open a hyperlink to `url`.
 *
 * [LAW:single-enforcer] Wire-byte trust boundary — the URL is sanitized at
 * the one place it becomes an OSC 8 sequence, whichever upstream API attached
 * it to the Style (RichText sanitizes at its data-model boundary too; a Style
 * built directly with `new Style({ link })` reaches here unsanitized).
 */
export function osc8Open(url: string): string {
  const clean = stripOscTerminators(url);
  return `\x1b]8;id=${linkId(clean)};${clean}\x1b\\`;
}

/** The bytes that close the current hyperlink. */
export const OSC8_CLOSE = "\x1b]8;;\x1b\\";

/**
 * Matches one OSC 8 sequence — an open or a close — terminated by `ESC \`,
 * BEL, or the 8-bit ST. Group 1 is the params, group 2 the URI; both are empty
 * on a close. To read bytes back use `osc8Sequences`; this pattern is exported
 * for composing into a larger one (a width measure's zero-width alternation).
 */
export const OSC8 = new RegExp(
  `\\x1b\\]8;([^;${TERMINATORS}]*);([^${TERMINATORS}]*)(?:\\x1b\\\\|\\x07|\\x9c)`,
);

/** One OSC 8 sequence found in rendered bytes. A close has `uri === ""`. */
export interface Osc8Sequence {
  /** Offset of the sequence in the scanned string. */
  readonly index: number;
  /** Length of the whole sequence, terminator included. */
  readonly length: number;
  /** The params field (`id=…`); empty on a close. */
  readonly params: string;
  /** The URI; empty on a close. */
  readonly uri: string;
}

const OSC8_SCAN = new RegExp(OSC8.source, "g");

/**
 * Every OSC 8 sequence in `text`, in order — the typed way to read rendered
 * bytes back.
 */
export function osc8Sequences(text: string): Osc8Sequence[] {
  return [...text.matchAll(OSC8_SCAN)].map((m) => ({
    index: m.index,
    length: m[0].length,
    params: m[1]!,
    uri: m[2]!,
  }));
}
