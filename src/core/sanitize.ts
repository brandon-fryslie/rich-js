/**
 * OSC-terminator sanitization — one rule, one source.
 *
 * [LAW:one-source-of-truth] The single definition of "bytes that prematurely
 * terminate an OSC 8 hyperlink wrap": ESC (`\x1b`), BEL (`\x07`), ST (`\x9c`).
 * Both the data-model boundary (RichText, in text.ts) and the wire-byte
 * boundaries (`segmentsToString` in render.ts; `Style.render` in style.ts)
 * import this helper — the rule lives once and is applied wherever a URL
 * crosses into territory it could break out of.
 *
 * [LAW:locality-or-seam] This module depends on nothing; every consumer
 * imports downward. No dep cycle, no re-import friction, no temptation to
 * inline a second copy of the regex.
 */

const OSC_TERMINATOR_RE = /[\x1b\x07\x9c]/g;

export function stripOscTerminators(url: string): string {
  return url.replace(OSC_TERMINATOR_RE, "");
}
