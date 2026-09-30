/**
 * fnv1a — FNV-1a, 32-bit, over a string's UTF-8 bytes, as 8 lowercase hex
 * digits: the short deterministic name this library derives wherever output
 * needs an identifier that is a function of what it names — an OSC 8 link id,
 * an SVG's class prefix — rather than of a counter or a clock.
 *
 * UTF-8 rather than UTF-16 code units, so any other runtime computing standard
 * FNV-1a over the same text gets the same digits.
 */

const utf8 = new TextEncoder();

export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (const byte of utf8.encode(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
