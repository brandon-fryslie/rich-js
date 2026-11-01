/**
 * The census of code points that do not print: every one in Unicode's general
 * categories Cc, Cf, Zl and Zp, with what `RichText` does when content carries
 * it. [LAW:one-source-of-truth] The sanitizer (`stripControlChars`) and the
 * cell-width measure (`cellLen`) both read this table, so whether content keeps
 * a code point has one statement.
 *
 * A row does not carry a width. A kept code point takes the cells Rich's table
 * gives it (`cell-widths.ts`), and a second statement of them here would be one
 * that could drift.
 */

/** What `RichText` does with a code point: deletes it from content, or holds it as a character. */
export type Disposition = "strip" | "keep";

/** The code points `first` to `last`, inclusive, and what is done with each. */
export interface ControlCodeRow {
  readonly first: number;
  readonly last: number;
  readonly disposition: Disposition;
}

const strip = (first: number, last: number): ControlCodeRow => ({ first, last, disposition: "strip" });
const keep = (first: number, last: number): ControlCodeRow => ({ first, last, disposition: "keep" });

/**
 * Ascending and disjoint, every Cc, Cf, Zl and Zp code point in exactly one row
 * (`test/core/control-codes.test.ts`).
 *
 * Rich's `Text` strips only `STRIP_CONTROL_CODES` (BEL, BS, VT, FF, CR); the
 * other stripped rows are the port's extension. Everything else here is kept
 * as Rich keeps it.
 */
export const CONTROL_CODES: readonly ControlCodeRow[] = [
  // C0 and DEL but TAB and LF, so no byte of content can start an escape
  // sequence or move the cursor on the wire.
  strip(0x00, 0x08),
  keep(0x09, 0x0a),
  strip(0x0b, 0x1f),
  // DEL and the C1 controls: a terminal reads U+009B as CSI and U+009D as OSC.
  strip(0x7f, 0x9f),
  // SOFT HYPHEN.
  keep(0xad, 0xad),
  // The Arabic and Syriac number signs and other prepended concatenation marks,
  // which draw a glyph.
  keep(0x600, 0x605),
  // ARABIC LETTER MARK, a bidi mark like LRM and RLM below: it holds no state,
  // so right-to-left text can use it.
  keep(0x61c, 0x61c),
  // More prepended concatenation marks.
  keep(0x6dd, 0x6dd),
  keep(0x70f, 0x70f),
  keep(0x890, 0x891),
  keep(0x8e2, 0x8e2),
  // MONGOLIAN VOWEL SEPARATOR.
  keep(0x180e, 0x180e),
  // ZWSP, ZWNJ and ZWJ, and the bidi marks LRM and RLM, which hold no state, so
  // right-to-left text can use them. ZWJ's joining is Rich's width rule, which
  // `cells.ts` holds apart from this row.
  keep(0x200b, 0x200f),
  // LINE SEPARATOR and PARAGRAPH SEPARATOR.
  keep(0x2028, 0x2029),
  // The bidi embeddings and overrides with their closer PDF. These hold state
  // past the text: an opener left unclosed in content reverses whatever is
  // drawn after it on the line, and a closer whose opener is gone closes
  // nothing of the text's own.
  strip(0x202a, 0x202e),
  // WORD JOINER and the invisible mathematical operators.
  keep(0x2060, 0x2064),
  // The bidi isolates with their closer PDI, stripped as the embeddings are,
  // and the deprecated shaping and swapping switches.
  strip(0x2066, 0x206f),
  // ZERO WIDTH NO-BREAK SPACE, the byte order mark.
  keep(0xfeff, 0xfeff),
  // Interlinear annotation.
  keep(0xfff9, 0xfffb),
  // The Kaithi number signs, which draw a glyph.
  keep(0x110bd, 0x110bd),
  keep(0x110cd, 0x110cd),
  // Egyptian hieroglyph, shorthand and musical format controls.
  keep(0x13430, 0x1343f),
  keep(0x1bca0, 0x1bca3),
  keep(0x1d173, 0x1d17a),
  // LANGUAGE TAG and the tag characters.
  keep(0xe0001, 0xe0001),
  keep(0xe0020, 0xe007f),
];

/** What happens to `codePoint`. One in no row is a printing character, and is kept. */
export function dispositionOf(codePoint: number): Disposition {
  let low = 0;
  let high = CONTROL_CODES.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const { first, last, disposition } = CONTROL_CODES[mid]!;
    if (codePoint < first) high = mid - 1;
    else if (codePoint > last) low = mid + 1;
    else return disposition;
  }
  return "keep";
}
