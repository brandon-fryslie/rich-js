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

import { advance, closersOf, lineLevels, mirroredCluster, opened, paragraph, visualOrder, withoutExplicit, type Open } from "./bidi.js";
import { cellLen, endedPrepends, endsOnPrepend, EXTENDER, wireText, ZWJ_CHARACTER } from "./cells.js";
import { pattern } from "./pattern.js";
import { rowClusters, Segment } from "./segment.js";
import type { LogicalStamp, TextOrder } from "./text-order.js";

const LRI = "\u2066";
const RLI = "\u2067";
const PDI = "\u2069";

const STARTS_EXTENDED = pattern(new RegExp(`^${EXTENDER}`, "u"));
const AN_EXTENDER = pattern(new RegExp(`^${EXTENDER}$`, "u"));
const TRAILING_JOINERS = pattern(new RegExp(`${ZWJ_CHARACTER}+$`, "u"));
// What ends a cluster for whatever follows it (UAX #29 GB4): a control, a line
// or paragraph separator, a format character — a bidi control included. A
// Prepend is beside it (`endsOnPrepend`): a mark after one sits on it, one cell
// with it to Rich and to a terminal, so it is kept whatever its category.
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
export function sealed(segments: Iterable<Segment>, order: TextOrder, terminal: boolean): Iterable<Segment> {
  const edges = withEdges(contained(segments, order));
  const written = order === "words" ? turnedBack(edges) : edges;
  return terminal ? prependsEnded(written) : written;
}

/**
 * `segments` with each Prepend character's cluster ended on the wire where the
 * library ends it (`endedPrepends`), for a terminal, which may cluster what it
 * is sent. It runs last, on the bytes in the order they are written, because a
 * terminal clusters what it is sent before it reorders.
 */
function* prependsEnded(segments: Iterable<Segment>): Iterable<Segment> {
  // The last segment with text, held until the text after it is known, and the
  // empty ones and controls after it, which write no character. A control may
  // leave the cursor where it is (hiding it, a bell, a title), so the text after
  // it may continue the line, and a mark there still sits on the Prepend.
  let last: Segment | undefined;
  let between: Segment[] = [];
  const release = (after: string | undefined): Segment[] => {
    const text = last === undefined ? "" : endedPrepends(last.text, after);
    const out = last === undefined ? between : [text === last.text ? last : new Segment(text, last.style, last.control), ...between];
    last = undefined;
    between = [];
    return out;
  };
  for (const segment of segments) {
    if (segment.isControl || segment.text === "") {
      if (last === undefined) yield segment;
      else between.push(segment);
    } else {
      yield* release(String.fromCodePoint(segment.text.codePointAt(0)!));
      last = segment;
    }
  }
  // The next write may continue this line.
  yield* release(undefined);
}

/**
 * The segments of `line`, one row of a frame, in the order a terminal that
 * orders what it is written (`logical`) shows them left to right, each as its
 * index. [LAW:one-source-of-truth] The row is ordered as `sealed` writes it,
 * isolates and all, inside the terminal's left-to-right paragraph, so how a row
 * is written has one answer. What `line` holds past a row is part of the line
 * the terminal orders: where only whitespace follows a row, L1 sets the
 * whitespace ending it at the terminal's level, so a caller passes what is
 * drawn after the row it asks about.
 */
export function shownWritten(line: readonly Segment[]): number[] {
  const owners = line.map(() => ({}));
  const written = [...sealed(line.map((segment, index) => Segment.anchorLines([[segment]], owners[index]!)[0]![0]!), "logical", false)];
  const indexOf = new Map(owners.map((owner, index) => [owner, index]));
  const units: (number | undefined)[] = [];
  for (const segment of written) {
    let anchor = segment.style?.anchor;
    while (anchor !== undefined && !indexOf.has(anchor.owner)) anchor = anchor.inner;
    const index = anchor === undefined ? undefined : indexOf.get(anchor.owner);
    for (let unit = 0; unit < segment.text.length; unit++) units.push(index);
  }
  const text = written.map((segment) => segment.text).join("");
  const { level, levels } = paragraph(text, 0);
  const shown = new Set<number>();
  for (const unit of visualOrder(lineLevels(text, levels, level))) {
    const index = units[unit];
    if (index !== undefined) shown.add(index);
  }
  return [...shown];
}

/** `segments` with each one's edges judged on the text as laid out (`edged`). */
function* withEdges(segments: Iterable<Segment>): Iterable<Segment> {
  let reaches = false;
  for (const segment of segments) {
    if (segment.isControl) {
      yield segment;
      continue;
    }
    const text = edged(segment.text, reaches);
    if (text !== "") reaches = !ENDS_CLUSTER.test(text) && !endsOnPrepend(text);
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
// The cells kitty draws in no shaped font (`font_for_cell`, kitty/fonts.c): a
// blank, a tab, and what its box font draws — box drawing, blocks, braille,
// powerline and legacy computing — and an emoji, drawn from its own font. A
// shaped run always ends at one.
const RUN_BREAKS = String.raw`[\p{Emoji_Presentation}\0\t \n\u2002\u2500-\u259f\u25c9\u25cb\u25cf\u25d6\u25d7\u25dc-\u25e5\u2800-\u28ff\ue0b0-\ue0bf\ue0d6\ue0d7\uee00-\uee0b\uf5d0-\uf60d\u{1fb00}-\u{1fbae}\u{1fbce}-\u{1fbef}\u{1cd00}-\u{1cde5}\u{1cc1b}-\u{1cc3f}\u{1ce16}-\u{1ce19}\u{1ce51}-\u{1ceaf}]`;

const SPLIT_AT_BREAKS = pattern(new RegExp(`(${RUN_BREAKS})`, "u"));

interface Piece {
  readonly text: string;
  readonly style: Segment["style"];
  /** The segment it came from: only pieces of one segment are written as one again. */
  readonly source: Segment;
}

/** Whether HarfBuzz, guessing, shapes `run` right to left. */
function shapedRightToLeft(run: readonly Piece[]): boolean {
  for (const { text } of run) for (const character of text) if (!UNSCRIPTED.test(character)) return RIGHT_TO_LEFT_SCRIPT.test(character);
  return false;
}

/** The face kitty draws `style` in: bold and italic each choose a font, so a run ends where either changes. */
const faceOf = (style: Segment["style"]): string => `${style?.bold === true}${style?.italic === true}`;

/**
 * The bytes that make kitty show `run`, one of its shaped runs, as its cells lie.
 * kitty draws a run it guesses right to left reversed and mirrored, so such a
 * run is written reversed and mirrored. Where neither form shows the cells — the
 * run starts with right-to-left script and ends with left-to-right — nothing can,
 * and it is written as it lies.
 */
function shownAsLaid(run: readonly Piece[]): readonly Piece[] {
  if (!shapedRightToLeft(run)) return run;
  // Clusters are found in the whole run, because a style edge inside one is no
  // place to cut it: reversed apart, a mark lands on another letter.
  const owners = run.flatMap((piece) => new Array<Piece>(piece.text.length).fill(piece));
  const clusters: string[] = [];
  const cells: Piece[] = [];
  let unit = 0;
  for (const cluster of rowClusters(run)) {
    clusters.push(cluster);
    for (let cell = cellLen(cluster); cell > 0; cell--) cells.push(owners[unit]!);
    unit += cluster.length;
  }
  // A style belongs to a cell, which the display does not move: each turned
  // cluster takes the style of the cell it is written into.
  const turned: Piece[] = [];
  let cell = 0;
  for (const cluster of clusters.reverse()) {
    const { style, source } = cells[cell] ?? owners[owners.length - 1]!;
    turned.push({ text: mirroredCluster(cluster), style, source });
    cell += cellLen(cluster);
  }
  return shapedRightToLeft(turned) ? turned : run;
}

/**
 * `segments` for a display that reverses each run it shapes right to left
 * (`words`): every run holding a cell laid out in visual order is written so
 * the display's reversal and HarfBuzz's mirroring put each cluster back in the
 * cell it was laid out in (`shownAsLaid`). A run with no such cell is left for
 * the display to reverse as it would. Runs end where kitty's do, but for a font
 * the user configured, which no program can see.
 */
function* turnedBack(segments: Iterable<Segment>): Iterable<Segment> {
  let run: Piece[] = [];
  let laid = false;
  let pending: Piece[] = [];
  const flush = (): void => {
    pending.push(...(laid ? shownAsLaid(run) : run));
    run = [];
    laid = false;
  };
  for (const segment of segments) {
    if (segment.isControl) {
      flush();
      yield* joined(pending);
      pending = [];
      yield segment;
      continue;
    }
    const visual = segment.style?.bidi?.order === "visual";
    for (const [index, text] of segment.text.split(SPLIT_AT_BREAKS).entries()) {
      if (text === "") continue;
      const isBreak = index % 2 === 1;
      if (isBreak || (run.length > 0 && faceOf(run[0]!.style) !== faceOf(segment.style))) flush();
      if (isBreak) {
        pending.push({ text, style: segment.style, source: segment });
        // A line ends every run, so what precedes it is final.
        if (text === "\n") {
          yield* joined(pending);
          pending = [];
        }
      } else {
        run.push({ text, style: segment.style, source: segment });
        laid ||= visual;
      }
    }
  }
  flush();
  yield* joined(pending);
}

/**
 * `pieces` as segments, neighbours from one segment written as one again, so a
 * segment edge stays where it was and the edges are judged as before.
 */
function* joined(pieces: readonly Piece[]): Iterable<Segment> {
  let text = "";
  let from: Piece | undefined;
  const written = (piece: Piece): Segment => (text === piece.source.text && piece.style === piece.source.style ? piece.source : new Segment(text, piece.style));
  for (const piece of pieces) {
    if (from !== undefined && text !== "" && (piece.source !== from.source || piece.style !== from.style)) {
      yield written(from);
      text = "";
    }
    text += piece.text;
    from = piece;
  }
  if (from !== undefined && text !== "") yield written(from);
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
