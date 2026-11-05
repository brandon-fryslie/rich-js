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
import { cellLen, EXTENDER, wireText, ZWJ_CHARACTER } from "./cells.js";
import { pattern } from "./pattern.js";
import { Segment } from "./segment.js";
import type { LogicalStamp, TextOrder } from "./text-order.js";

const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";

const STARTS_EXTENDED = pattern(new RegExp(`^${EXTENDER}`, "u"));
const AN_EXTENDER = pattern(new RegExp(`^${EXTENDER}$`, "u"));
const TRAILING_JOINERS = pattern(new RegExp(`${ZWJ_CHARACTER}+$`, "u"));
// What ends a cluster for whatever follows it (UAX #29 GB4): a control, a line
// or paragraph separator, a format character — a bidi control included.
const ENDS_CLUSTER = pattern(/[\p{Cc}\p{Zl}\p{Zp}\p{Cf}]$/u);

/**
 * `text`, written after a glyph it could reach when `reaches`, without what
 * would reach across its edges into a neighbour's glyph. An extender of no cells
 * that opens it would extend that glyph — a mark restyles it, a selector changes
 * its presentation, a VS16 widens it, a ZWJ joins it to this one — and a
 * trailing ZWJ would join its last glyph to the next one's first. Alone, where
 * each was measured, each takes no cell, so dropping it changes no width. An
 * extender that takes a cell alone (the halfwidth sound marks) was measured as
 * one and stays, and so does one with no glyph before it on the row.
 */
function edged(text: string, reaches: boolean): string {
  const opens = reaches && STARTS_EXTENDED.test(text);
  if (!opens && !text.endsWith(ZWJ_CHARACTER)) return text;
  let opening = 0;
  for (const character of opens ? text : "") {
    if (!AN_EXTENDER.test(character) || cellLen(character) > 0) break;
    opening += character.length;
  }
  return text.slice(opening).replace(TRAILING_JOINERS, "");
}

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

/**
 * `segments` as the wire may hold them for `order`. The edges are judged last,
 * on the text as it is written, so a control the order removes cannot hide a
 * joiner from them.
 */
export function* sealed(segments: Iterable<Segment>, order: TextOrder): Iterable<Segment> {
  let reaches = false;
  for (const segment of contained(segments, order)) {
    if (segment.isControl) {
      yield segment;
      continue;
    }
    const text = edged(segment.text, reaches);
    if (text !== "") reaches = !ENDS_CLUSTER.test(text);
    yield text === segment.text ? segment : new Segment(text, segment.style, segment.control);
  }
}

/** `segments` with what the census withholds gone and the order's bidi controls written. */
function* contained(segments: Iterable<Segment>, order: TextOrder): Iterable<Segment> {
  let run: Segment[] = [];
  let stamp: LogicalStamp | undefined;
  const flush = function* (): Iterable<Segment> {
    if (stamp !== undefined) yield* isolated(run, stamp);
    run = [];
    stamp = undefined;
  };
  for (const raw of segments) {
    const drawn = wireText(raw.text);
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
