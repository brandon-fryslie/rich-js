/**
 * The census of code points that do not print: every one in Unicode's general
 * categories Cc, Cf, Zl and Zp, and the variation selectors, with what `RichText`
 * does when content carries it. [LAW:one-source-of-truth] The sanitizer
 * (`stripControlChars`), the wire (`wireText`) and the cell-width measure
 * (`cellLen`) all read this table, so whether content keeps a code point has one
 * statement. `docs/control-codes.md` is each family's use and harm, and what real
 * terminals were measured doing with it.
 *
 * A row does not carry a width. A kept code point takes the cells Rich's table
 * gives it (`cell-widths.ts`), and a second statement of them here would be one
 * that could drift.
 */

/**
 * What `RichText` does with a code point. `strip` deletes it from content. `keep`
 * holds it as a character. `line-break` is a line ending, so content holds an LF
 * in its place. `withheld` is held in content and measured as nothing, and
 * `wireText` decides from its neighbours whether it is written.
 */
export type Disposition = "strip" | "keep" | "line-break" | "withheld";

/** The code points `first` to `last`, inclusive, and what is done with each. */
export interface ControlCodeRow {
  readonly first: number;
  readonly last: number;
  readonly disposition: Disposition;
}

const strip = (first: number, last: number): ControlCodeRow => ({ first, last, disposition: "strip" });
const keep = (first: number, last: number): ControlCodeRow => ({ first, last, disposition: "keep" });
const lineBreak = (first: number, last: number): ControlCodeRow => ({ first, last, disposition: "line-break" });
const withheld = (first: number, last: number): ControlCodeRow => ({ first, last, disposition: "withheld" });

/**
 * Ascending and disjoint, every Cc, Cf, Zl, Zp and Variation_Selector code point
 * in exactly one row (`test/core/control-codes.test.ts`).
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
  // `TextInput` refuses them for the same reason.
  strip(0x7f, 0x9f),
  // SOFT HYPHEN: a place a word may break, drawn as a hyphen only where one does.
  // Terminals disagree on its cell, so it never reaches them.
  withheld(0xad, 0xad),
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
  // The Mongolian free variation selectors.
  withheld(0x180b, 0x180d),
  // MONGOLIAN VOWEL SEPARATOR, which shapes the vowel after it.
  keep(0x180e, 0x180e),
  withheld(0x180f, 0x180f),
  // ZWSP, a place a line may break (`wrap.ts`); ZWNJ, which Persian and Urdu spell
  // with; ZWJ, for emoji and conjuncts; and the bidi marks LRM and RLM, which hold
  // no state, so right-to-left text can use them. ZWJ's joining is Rich's width
  // rule, which `cells.ts` holds apart from this row.
  keep(0x200b, 0x200f),
  // LINE SEPARATOR and PARAGRAPH SEPARATOR.
  lineBreak(0x2028, 0x2029),
  // The bidi embeddings and overrides with their closer PDF, and the isolates
  // below. Content holds them; what reaches the wire is `sealed`'s to decide.
  keep(0x202a, 0x202e),
  // WORD JOINER, which only asks that nothing break here, and the invisible
  // mathematical operators.
  keep(0x2060, 0x2064),
  // The bidi isolates with their closer PDI.
  keep(0x2066, 0x2069),
  // The deprecated shaping and swapping switches. Each holds state to the end of
  // the text, Unicode deprecates them, and no terminal was found honouring one.
  strip(0x206a, 0x206f),
  // VARIATION SELECTOR-1 to 16: glyph variants, and text or emoji presentation.
  withheld(0xfe00, 0xfe0f),
  // ZERO WIDTH NO-BREAK SPACE, the byte order mark, as a word joiner.
  keep(0xfeff, 0xfeff),
  // Interlinear annotation. No terminal draws ruby, the annotating text stays
  // visible, and the anchors hold no state, so there is nothing to contain.
  keep(0xfff9, 0xfffb),
  // The Kaithi number signs, which draw a glyph.
  keep(0x110bd, 0x110bd),
  keep(0x110cd, 0x110cd),
  // Egyptian hieroglyph, shorthand and musical format controls.
  keep(0x13430, 0x1343f),
  keep(0x1bca0, 0x1bca3),
  keep(0x1d173, 0x1d17a),
  // LANGUAGE TAG, deprecated.
  strip(0xe0001, 0xe0001),
  // The tag characters: an emoji subdivision flag, or text no reader can see.
  withheld(0xe0020, 0xe007f),
  // The ideographic variation selectors: Japanese and Chinese glyph variants.
  withheld(0xe0100, 0xe01ef),
];

/** A regular expression class of the code points in rows `chosen` picks, for `u`. */
export function controlClass(chosen: (disposition: Disposition) => boolean): string {
  const hex = (codePoint: number): string => `\\u{${codePoint.toString(16)}}`;
  return `[${CONTROL_CODES.filter((row) => chosen(row.disposition)).map((row) => `${hex(row.first)}-${hex(row.last)}`).join("")}]`;
}

/**
 * UTS #51's subdivision flag, as a `u` source: the black flag, a CLDR subdivision
 * spelled in tag letters and digits, and CANCEL TAG. The one sequence tag
 * characters have a reader for.
 */
export const SUBDIVISION_FLAG = "\u{1f3f4}[\u{e0030}-\u{e0039}\u{e0061}-\u{e007a}]{3,6}\u{e007f}";

/** What happens to `codePoint`. One in no row is kept. */
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
