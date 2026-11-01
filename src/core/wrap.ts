/**
 * Word wrapping: the offsets one logical line is cut at so its pieces fit a
 * cell budget.
 *
 * This is deliberately not in `cells.ts` next door. That module answers
 * geometry — how wide is this, where does cell column N fall — and knows
 * nothing about language. This one answers where a line may *break*, which is
 * a fact about words, and the only thing it borrows from geometry is how to
 * measure one.
 *
 * It returns offsets rather than pieces because the caller holds styled
 * `Segment[]`, not a string: cutting the text here would drop every span
 * attached to it. Offsets are the one representation both sides can act on —
 * `Segment.divide` cuts the styled line at exactly the places this function
 * found in the plain one.
 *
 * Wrapping is the *first* step, and overflow is the last resort applied to a
 * line still too wide once wrapping is done. That order is the whole reason a
 * long sentence in a table cell grows the row while an unbreakable word in the
 * same cell still ellipsizes.
 *
 * Rich breaks only at whitespace, and that is what happens to any word holding
 * nothing below: `test/core/text-wrap.golden.txt` pins it. Past that, a word
 * breaks where its text says it may (UAX #14): after ZWSP, at a soft hyphen, and
 * between the words of a script written without spaces. U+2060 and U+FEFF forbid
 * a break, which here needs nothing but not being one.
 */

import { asCellCol, asCodePoint, cellLen, chopCells, type CellCol, type CodePoint } from "./cells.js";
import { pattern } from "./pattern.js";

const SOFT_HYPHEN = "\u00ad";
const ZWSP = "\u200b";

// The scripts UAX #14 sends to a dictionary (line break class SA) and ICU has one
// for. Which words it finds varies by ICU, and a dictionary cannot be vendored as
// the width table is; a word it misses is folded like any other.
const UNSPACED = "[\\p{Script_Extensions=Thai}\\p{Script_Extensions=Lao}\\p{Script_Extensions=Khmer}\\p{Script_Extensions=Myanmar}]+";
const BREAKABLE = pattern(new RegExp(`[${SOFT_HYPHEN}${ZWSP}]|${UNSPACED}`, "u"));
const WORD_SEGMENTER = new Intl.Segmenter(undefined, { granularity: "word" });
// A word's opening: no text in it yet, so nothing to break away from or to hyphenate.
const OPENING = pattern(new RegExp(`^[\\s${SOFT_HYPHEN}${ZWSP}]*`, "u"));

/** One place a line of text was cut. */
export interface LineBreak {
  /** Where the line is cut, in cells. */
  readonly cell: CellCol;
  /** The soft hyphen this break draws as `-`. Absent at any other break, and where no hyphen fits. */
  readonly hyphen: CodePoint | undefined;
}

/** What wraps as one: a word, or the part of one up to a place it may break. */
interface Piece {
  readonly text: string;
  /** The cells it needs on a line. */
  readonly cells: number;
  /** It ends in a soft hyphen the word goes on after, so a break here needs one more cell. */
  readonly hyphenates: boolean;
}

/**
 * Each word of `text` in order, where a "word" carries its own trailing
 * whitespace — the run of spaces that follows it belongs to it, because that
 * is the whitespace a break at the *next* word leaves hanging past the edge.
 *
 * The matches tile the text: each begins exactly where the last ended, so a
 * caller can track absolute offsets by accumulating widths alone. Text with no
 * non-whitespace character yields nothing, which is the honest answer — there
 * is nowhere to break.
 */
function* words(text: string): Iterable<string> {
  // Constructed per call rather than hoisted: a sticky regex carries its
  // `lastIndex` as mutable state, and a shared one would corrupt any two
  // interleaved walks. [LAW:no-shared-mutable-globals]
  // U+FEFF is outside it, as it is outside Python's `\s` and Rich's words: it is a
  // no-break space that JavaScript's `\s` counts as a space.
  const re = /[^\S\ufeff]*[\S\ufeff]+[^\S\ufeff]*/y;
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    yield match[0];
  }
}

/**
 * The cells a word needs on a line: all of it but its trailing whitespace,
 * which may hang past the edge for the caller to crop. Its leading whitespace
 * counts — that is a line's indent, and it is not a place to break.
 */
function widthOf(word: string): number {
  return cellLen(word.trimEnd());
}

/** The offsets inside `word`, ascending, that it may break at: never before its first glyph's end or past its last glyph. */
function breaksIn(word: string): number[] {
  if (word.match(BREAKABLE) === null) return [];
  const found = new Set<number>();
  for (const { 0: mark, index } of word.matchAll(new RegExp(`[${SOFT_HYPHEN}${ZWSP}]`, "gu"))) found.add(index + mark.length);
  for (const { 0: run, index } of word.matchAll(new RegExp(UNSPACED, "gu"))) {
    // A run's start is where the segmenter's input began, not a boundary it found:
    // UAX #14 has these scripts break as letters do against what comes before them.
    for (const { index: at } of WORD_SEGMENTER.segment(run)) if (at > 0) found.add(index + at);
  }
  const start = OPENING.exec(word)![0].length;
  const end = word.trimEnd().length;
  return [...found].filter((at) => at > start && at < end).sort((a, b) => a - b);
}

/** `text` as what wraps: its words, tiled further wherever one may break. */
function* piecesOf(text: string): Iterable<Piece> {
  for (const word of words(text)) {
    let start = 0;
    for (const at of breaksIn(word)) {
      const piece = word.slice(start, at);
      yield { text: piece, cells: widthOf(piece), hyphenates: piece.endsWith(SOFT_HYPHEN) };
      start = at;
    }
    const last = word.slice(start);
    yield { text: last, cells: widthOf(last), hyphenates: false };
  }
}

/**
 * The cells each piece of `text` needs, in order — the widest is the narrowest
 * width `divideLine` can wrap it to without cutting a word.
 */
export function wordWidths(text: string): number[] {
  return Array.from(piecesOf(text), (piece) => piece.cells + (piece.hyphenates ? 1 : 0));
}

/**
 * A word chopped into pieces of at most `width` cells, as the reference chops
 * it.
 *
 * `chopCells` next door and Rich's `chop_cells` disagree in exactly one place.
 * Rich opens a new line for any glyph that does not fit and emits whatever line
 * it was already on, so a word beginning with a glyph wider than the entire
 * canvas folds with an empty piece in front of it — and that piece reaches the
 * output as a blank line. `chopCells` force-takes the glyph instead and never
 * returns an empty piece.
 *
 * Restoring the blank is what keeps `test/core/text-wrap.golden.txt`
 * regenerable from the reference. A fixture is only an oracle while the command
 * in its header reproduces it byte for byte; smoothing away one byte the
 * reference emits costs that, everywhere, to tidy a blank line reachable only
 * by folding a two-cell glyph onto a one-cell canvas.
 */
function foldWord(word: string, width: CellCol): string[] {
  const pieces = chopCells(word, width);
  // `chopCells` overshoots the budget only when it force-takes one glyph, so an
  // over-wide first piece is exactly the case Rich opens a blank line for.
  return cellLen(pieces[0]!) > width ? ["", ...pieces] : pieces;
}

/**
 * The breaks that wrap `text` into lines of at most `width` cells, for
 * `Segment.divide` to apply to the styled line.
 *
 * `fold` decides what happens to a word that fits on no line at all: folded,
 * it is chopped across as many lines as it needs; unfolded, it is left whole
 * on its own line for the caller's overflow method to cut. Only the `fold`
 * overflow method folds — `crop` and `ellipsis` want the word intact so they
 * can truncate it, which is what makes an unbreakable word ellipsize while the
 * sentence around it merely wraps.
 *
 * A piece that ends in a soft hyphen stays on a line only with room for the
 * hyphen, so a line it closes holds it, and a word that fits whole needs none. A
 * piece as wide as the line breaks with no hyphen rather than lose a letter to one.
 *
 * Requires `width >= 1`. A zero-cell canvas gets no cuts, because "no cut
 * fits" and "no cell fits" are different facts and only one of them is a list
 * of offsets — the caller answers the second one by cropping the single
 * uncut piece to nothing, which is what every overflow method does there.
 */
export function divideLine(
  text: string,
  width: CellCol,
  options: { fold: boolean },
): LineBreak[] {
  if (width <= 0) return [];

  const breaks: LineBreak[] = [];
  // A cut at the start of the text is not a cut: it would open the line with
  // an empty piece. [LAW:single-enforcer] for that rule, so neither arm below
  // has to restate it.
  const cutAt = (cell: number): void => {
    if (cell > 0) breaks.push({ cell: asCellCol(cell), hyphen: width - used > 0 ? softHyphen : undefined });
  };

  let used = 0; // cells already committed to the line being filled
  let wordStart = 0; // absolute cell offset where the current word begins
  let offset = 0; // code units before the current word
  let softHyphen: CodePoint | undefined; // the one the line being filled ends in

  for (const piece of piecesOf(text)) {
    const word = piece.text;
    const wordWidth = piece.cells;

    if (width - used >= wordWidth + (piece.hyphenates ? 1 : 0)) {
      used += cellLen(word);
    } else if (options.fold && wordWidth > width) {
      // No line, however empty, can hold this word whole, and folding is
      // allowed — so it is chopped across as many lines as it needs. Unfolded,
      // it takes the arm below and is left whole for the overflow method.
      const pieces = foldWord(word, width);
      let pieceStart = wordStart;
      for (let index = 0; index < pieces.length; index += 1) {
        cutAt(pieceStart);
        softHyphen = undefined;
        const fold = pieces[index]!;
        // The last piece is what the *next* word finds already on the line;
        // the rest are whole lines of their own.
        if (index === pieces.length - 1) used = cellLen(fold);
        else pieceStart += cellLen(fold);
      }
    } else {
      // It does not fit here. Either it fits on a line of its own, or nothing
      // can hold it and the caller's overflow method will cut it there.
      cutAt(wordStart);
      used = cellLen(word);
    }

    wordStart += cellLen(word);
    offset += word.length;
    softHyphen = piece.hyphenates ? asCodePoint(offset - 1) : undefined;
  }

  return breaks;
}
