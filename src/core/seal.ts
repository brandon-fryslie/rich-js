/**
 * `sealed` — the one total enforcer of what the wire holds.
 *
 * [LAW:single-enforcer] An explicit bidi control reaches the bytes only inside
 * an isolate that accounts for it. The rule has no list of who wrote what: in a
 * segment with no logical stamp every explicit control is deleted, in every
 * order, so a raw `new Segment(text)` is contained and merely shows no effect.
 * What the census withholds goes here too (`wireText`), a segment at a time, on
 * text nothing cuts again, which is why a rule that reads neighbours can live here
 * and not in the sanitizer. A segment edge is therefore where that reading stops,
 * and where a glyph stops too: each segment was measured alone, so content in
 * one may not reshape the glyph in its neighbour: the wire drops what would
 * reach across (`edged`). `RichText` puts no span edge inside a grapheme cluster, so a
 * sequence its own styling cuts is never split here.
 *
 * This runs on the way out, below every cut, because a row is cut after it is
 * drawn: `scroll` divides it, `mergeHorizontal` and a viewport crop it, an
 * overlay splices into it. Controls written at drawing time would be cut with
 * it. `Style.bidi` is a fact on the cells instead, so what survives still names
 * its stamp, and the controls are written around the survivors.
 */

import { advance, closersOf, opened, withoutExplicit, type Open } from "./bidi.js";
import { EXTENDER, wireText, ZWJ_CHARACTER } from "./cells.js";
import { pattern } from "./pattern.js";
import { Segment } from "./segment.js";
import type { LogicalStamp, TextOrder } from "./text-order.js";

const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";

/**
 * `text` without what would reach across a segment edge into a neighbour's
 * glyph. What opens a segment before its first glyph would extend the glyph
 * that ends the one before it on the wire — a mark restyles it, a selector
 * changes its presentation, a VS16 widens it, a ZWJ joins it to this one — and a
 * trailing ZWJ would join this segment's last glyph to the next one's first.
 * Alone, where each was measured, each extends nothing and takes no cell, so
 * dropping it changes no width.
 */
function edged(text: string): string {
  const opening = OPENING_EXTENDERS.exec(text)![0].length;
  if (opening === 0 && !text.endsWith(ZWJ_CHARACTER)) return text;
  return text.slice(opening).replace(TRAILING_JOINERS, "");
}

const OPENING_EXTENDERS = pattern(new RegExp(`^${EXTENDER}*`, "u"));
const TRAILING_JOINERS = pattern(new RegExp(`${ZWJ_CHARACTER}+$`, "u"));

/** `text` with closers that match nothing in `open` dropped, so content cannot end the isolate around it. */
function balanced(text: string, open: Open): string {
  return Array.from(text, (character) => (advance(open, character) ? character : "")).join("");
}

/**
 * One row's run of one stamp in its isolate. The initiator is stated from the
 * whole line's direction rather than FSI, so a wrapped row does not re-detect
 * it. Embeddings close by PDF ahead of the PDI because VTE discards a zero-width
 * character at column 0, initiator included, and a PDI matching nothing there
 * closes nothing.
 */
function* isolated(run: readonly Segment[], { level, opens }: LogicalStamp): Iterable<Segment> {
  const open = opened(opens);
  yield new Segment((level === 1 ? RLI : LRI) + opens);
  for (const segment of run) {
    const text = balanced(segment.text, open);
    yield text === segment.text ? segment : new Segment(text, segment.style, segment.control);
  }
  yield new Segment(closersOf(open.stack.join("")) + PDI);
}

/** `segments` as the wire may hold them for `order`. */
export function* sealed(segments: Iterable<Segment>, order: TextOrder): Iterable<Segment> {
  let run: Segment[] = [];
  let stamp: LogicalStamp | undefined;
  const flush = function* (): Iterable<Segment> {
    if (stamp !== undefined) yield* isolated(run, stamp);
    run = [];
    stamp = undefined;
  };
  for (const raw of segments) {
    const drawn = raw.isControl ? raw.text : edged(wireText(raw.text));
    const segment = drawn === raw.text ? raw : new Segment(drawn, raw.style, raw.control);
    const own = order === "logical" && !segment.isControl ? segment.style?.bidi : undefined;
    if (own?.order === "logical") {
      if (own !== stamp) yield* flush();
      stamp = own;
      run.push(segment);
      continue;
    }
    yield* flush();
    const text = withoutExplicit(segment.text);
    yield text === segment.text ? segment : new Segment(text, segment.style, segment.control);
  }
  yield* flush();
}
