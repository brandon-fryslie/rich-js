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

import { advance, closersOf, mirroredCluster, opened, withoutExplicit, type Open } from "./bidi.js";
import { cellLen, EXTENDER, graphemes, wireText, ZWJ_CHARACTER } from "./cells.js";
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
  const held = contained(segments, order);
  for (const segment of order === "words" ? turnedBack(held) : held) {
    if (segment.isControl) {
      yield segment;
      continue;
    }
    const text = edged(segment.text, reaches);
    if (text !== "") reaches = !ENDS_CLUSTER.test(text);
    yield text === segment.text ? segment : new Segment(text, segment.style, segment.control);
  }
}

// HarfBuzz's right-to-left scripts (`hb_script_get_horizontal_direction`), as
// far as the engine's Unicode knows them: Garay and Sidetic are newer than
// Node 20's. A run's direction is the first of its characters whose script is
// not Common, Inherited or Unknown (`guess_segment_properties`).
const RIGHT_TO_LEFT_SCRIPT = pattern(
  new RegExp(
    `^[${[
      "Arabic", "Hebrew", "Syriac", "Thaana", "Cypriot", "Kharoshthi", "Phoenician", "Nko", "Lydian", "Avestan",
      "Imperial_Aramaic", "Inscriptional_Pahlavi", "Inscriptional_Parthian", "Old_South_Arabian", "Old_Turkic",
      "Samaritan", "Mandaic", "Meroitic_Cursive", "Meroitic_Hieroglyphs", "Manichaean", "Mende_Kikakui", "Nabataean",
      "Old_North_Arabian", "Palmyrene", "Psalter_Pahlavi", "Hatran", "Adlam", "Hanifi_Rohingya", "Old_Sogdian",
      "Sogdian", "Elymaic", "Chorasmian", "Yezidi", "Old_Uyghur",
    ]
      .map((script) => `\\p{Script=${script}}`)
      .join("")}]`,
    "u",
  ),
);
const UNSCRIPTED = pattern(/^[\p{Script=Common}\p{Script=Inherited}\p{Script=Unknown}]/u);
// What kitty draws in no font, so a run of shaped cells always ends at it.
const RUN_BREAK = pattern(/^[  \n]$/);

interface Cell {
  readonly text: string;
  readonly style: Segment["style"];
}

/** Whether HarfBuzz, guessing, shapes `run` right to left. */
function shapedRightToLeft(run: readonly Cell[]): boolean {
  for (const { text } of run) for (const character of text) if (!UNSCRIPTED.test(character)) return RIGHT_TO_LEFT_SCRIPT.test(character);
  return false;
}

/**
 * `segments` for a display that reverses each right-to-left run of non-space
 * cells (`words`): every such run laid out in visual order is written reversed,
 * each cluster mirrored, so the display's reversal and HarfBuzz's mirroring put
 * each cluster back in the cell visual order gave it. A cell never laid out in
 * visual order is left for the display to reverse as it would. A row is a
 * buffer's worth: what lies between line breaks and controls, which may move the
 * cursor.
 */
function* turnedBack(segments: Iterable<Segment>): Iterable<Segment> {
  let row: Cell[] = [];
  const flush = function* (): Iterable<Segment> {
    yield* joined(row);
    row = [];
  };
  for (const segment of segments) {
    if (segment.isControl) {
      yield* flush();
      yield segment;
      continue;
    }
    const visual = segment.style?.bidi?.order === "visual";
    for (const cluster of graphemes(segment.text)) {
      row.push({ text: cluster, style: segment.style });
      if (!visual || RUN_BREAK.test(cluster)) yield* flush();
    }
  }
  yield* flush();
}

/** `cells` as segments, a run of them first turned back when the display will reverse it. */
function* joined(cells: Cell[]): Iterable<Segment> {
  const last = cells.at(-1);
  const breaks = last !== undefined && (RUN_BREAK.test(last.text) || last.style?.bidi?.order !== "visual");
  const run = breaks ? cells.slice(0, -1) : cells;
  const written = shapedRightToLeft(run) ? run.map(({ text, style }) => ({ text: mirroredCluster(text), style })).reverse() : run;
  let text = "";
  let style: Segment["style"];
  for (const cell of breaks ? [...written, last!] : written) {
    if (text !== "" && cell.style !== style) {
      yield new Segment(text, style);
      text = "";
    }
    text += cell.text;
    style = cell.style;
  }
  if (text !== "") yield new Segment(text, style);
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
