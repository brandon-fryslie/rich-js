/**
 * Whitespace as Python reads it — `str.isspace`, `str.strip`, and `\s` in a
 * `str` pattern of `re`, which are one set. markdown-it-py, the markdown-it
 * Rich runs, reads whitespace through all three, and that set is not
 * JavaScript's: `\s` and `trim` take U+FEFF, which Python does not, and leave
 * U+001C–U+001F and U+0085, which Python takes.
 */

/** The set as a regex character class, every member of it a single UTF-16 unit, for composing into a pattern where markdown-it-py's has `\s`. */
export const PY_WHITESPACE = String.raw`[\t-\r\x1c-\x20\x85\xa0  -     　]`;
const PY_SPACE = new RegExp(`^${PY_WHITESPACE}$`);

/** Python's `str.strip`, a scan in from each end, so a run of interior whitespace costs one pass, as it does there. */
export function pyStrip(text: string): string {
  let start = 0;
  let end = text.length;
  while (start < end && PY_SPACE.test(text[start]!)) start++;
  while (end > start && PY_SPACE.test(text[end - 1]!)) end--;
  return text.slice(start, end);
}
