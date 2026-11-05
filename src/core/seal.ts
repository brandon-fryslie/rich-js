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
 * one may not reshape the glyph in its neighbour. A ZWJ at an edge and a VS16
 * opening a segment are the reaches that would change a width (`edged`), and the
 * wire drops them. `RichText` puts no span edge inside a grapheme cluster, so a
 * sequence its own styling cuts is never split here.
 *
 * This runs on the way out, below every cut, because a row is cut after it is
 * drawn: `scroll` divides it, `mergeHorizontal` and a viewport crop it, an
 * overlay splices into it. Controls written at drawing time would be cut with
 * it. `Style.bidi` is a fact on the cells instead, so what survives still names
 * its stamp, and the controls are written around the survivors.
 */

import { advance, closersOf, opened, withoutExplicit, type Open } from "./bidi.js";
import { wireText } from "./cells.js";
import { pattern } from "./pattern.js";
import { Segment } from "./segment.js";
import type { LogicalStamp, TextOrder } from "./text-order.js";

const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";

/**
 * `text` without the reaches across a segment edge that change a width. What
 * opens a segment before its first glyph extends the glyph that ends the one
 * before it on the wire: a ZWJ there would join that glyph to this one's, and a
 * VS16 would widen it, so both go and its marks stay. A trailing ZWJ would join
 * this segment's last glyph to the next one's first, so it goes too. Each was
 * measured alone, where it joins nothing and widens nothing, so none takes a cell.
 */
function edged(text: string): string {
  const opening = text.match(OPENING_EXTENDERS)![0];
  const marks = Array.from(opening, (character) => (character === ZWJ || character === VS16 ? "" : character)).join("");
  return marks + text.slice(opening.length).replace(TRAILING_JOINERS, "");
}

const ZWJ = "‍";
const VS16 = "️";
const OPENING_EXTENDERS = pattern(/^[\p{Grapheme_Extend}\p{Emoji_Modifier}‍]*/u);
const TRAILING_JOINERS = pattern(/‍+$/u);

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
