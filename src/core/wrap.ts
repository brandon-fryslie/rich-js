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
 */

import { cellLen, chopCells, asCellCol, type CellCol } from "./cells.js";

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
  const re = /\s*\S+\s*/y;
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    yield match[0];
  }
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
 * The cell offsets `text` should be cut at to wrap it into lines of at most
 * `width` cells, for `Segment.divide` to apply to the styled line.
 *
 * `fold` decides what happens to a word that fits on no line at all: folded,
 * it is chopped across as many lines as it needs; unfolded, it is left whole
 * on its own line for the caller's overflow method to cut. Only the `fold`
 * overflow method folds — `crop` and `ellipsis` want the word intact so they
 * can truncate it, which is what makes an unbreakable word ellipsize while the
 * sentence around it merely wraps.
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
): CellCol[] {
  if (width <= 0) return [];

  const cuts: CellCol[] = [];
  // A cut at the start of the text is not a cut: it would open the line with
  // an empty piece. [LAW:single-enforcer] for that rule, so neither arm below
  // has to restate it.
  const cutAt = (cell: number): void => {
    if (cell > 0) cuts.push(asCellCol(cell));
  };

  let used = 0; // cells already committed to the line being filled
  let wordStart = 0; // absolute cell offset where the current word begins

  for (const word of words(text)) {
    // Measured without its trailing whitespace: a word is allowed to end the
    // line with its spaces hanging past the edge, and the caller crops them.
    const wordWidth = cellLen(word.trimEnd());

    if (width - used >= wordWidth) {
      used += cellLen(word);
    } else if (options.fold && wordWidth > width) {
      // No line, however empty, can hold this word whole, and folding is
      // allowed — so it is chopped across as many lines as it needs. Unfolded,
      // it takes the arm below and is left whole for the overflow method.
      const pieces = foldWord(word, width);
      let pieceStart = wordStart;
      for (let index = 0; index < pieces.length; index += 1) {
        cutAt(pieceStart);
        const piece = pieces[index]!;
        // The last piece is what the *next* word finds already on the line;
        // the rest are whole lines of their own.
        if (index === pieces.length - 1) used = cellLen(piece);
        else pieceStart += cellLen(piece);
      }
    } else {
      // It does not fit here. Either it fits on a line of its own, or nothing
      // can hold it and the caller's overflow method will cut it there.
      cutAt(wordStart);
      used = cellLen(word);
    }

    wordStart += cellLen(word);
  }

  return cuts;
}
