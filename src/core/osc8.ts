/**
 * The OSC 8 hyperlink wire grammar — how a link becomes bytes, and how bytes
 * are read back as a link.
 *
 * [LAW:one-source-of-truth] Every producer (`segmentsToString`,
 * `Style.render`) opens a link through `osc8Open` and closes it with
 * `OSC8_CLOSE`; every consumer that reads rendered bytes (a width measure, a
 * test extracting URLs) matches them with `OSC8`. The grammar is spelled once.
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
 * no construction-order dependence. Because terminals key on the (id, URI)
 * PAIR, a hash collision between two different URIs merges nothing — the
 * URIs still differ — so a 32-bit hash is exact, not approximate.
 */

import { stripOscTerminators } from "./sanitize.js";

/** FNV-1a, 32-bit, as 8 lowercase hex digits — a legal `id=` value (no `:`/`;`). */
function linkId(url: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
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
 * Matches one OSC 8 sequence — an open or a close — terminated by ST or BEL.
 * Group 1 is the params (`id=…`, empty on a close), group 2 the URI (empty on
 * a close). Not global: build `new RegExp(OSC8.source, "g")` to scan.
 */
export const OSC8 = /\x1b\]8;([^;\x07\x1b]*);([^\x07\x1b]*)(?:\x1b\\|\x07)/;
