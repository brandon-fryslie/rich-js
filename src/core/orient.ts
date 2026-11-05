/**
 * Orienting a drawn line for its destination's `TextOrder`.
 *
 * Levels are resolved over the whole logical line and a row is ordered alone,
 * because UAX #9 runs L1 and L2 after line breaking. So `directed` runs ahead of
 * wrapping and each row's `orient` after it, and cuts fall on logical offsets in
 * every order: what survives a cut is a logical prefix of the sentence, which is
 * what a reader of either direction expects.
 *
 * [LAW:dataflow-not-control-flow] The order chooses values and never steps: a
 * `plain` line passes through both.
 */

import { isBidi, lineLevels, mirroredCluster, openersAlong, paragraph, paragraphLevel, REMOVED, shaped, visualOrder, withoutExplicit, withoutMarks } from "./bidi.js";
import { cellLen, graphemes } from "./cells.js";
import { pattern } from "./pattern.js";
import { Segment } from "./segment.js";
import { caretMark, NULL_STYLE, type Style } from "./style.js";
import type { BidiStamp, ParagraphLevel, TextOrder } from "./text-order.js";

const TRAILING_WHITESPACE_RE = pattern(/\s+$/);
// From the front, greedily: anchored at the end, a scan restarts at each format
// character of a run, and that is quadratic on content anyone can send.
const THROUGH_CONTENT = pattern(/^[^]*[^\s\p{Cf}]/u);

/**
 * The cells that end `text` and are no content: its whitespace, once what draws no
 * cell among it is gone. A mark drawn on a space is not in it, because that space
 * is a cell with something on it.
 */
export function drawnTail(text: string): string {
  const tail = text.slice(THROUGH_CONTENT.exec(text)?.[0].length ?? 0);
  return Array.from(tail).filter((character) => cellLen(character) > 0).join("");
}

/**
 * The cells of trailing whitespace on a wrapped line.
 *
 * A wrap cuts before a word, so the line it closes ends with the whitespace
 * that followed *its* last word — padding the break created, not content the
 * author wrote. Measuring it is what lets the overflow method tell "this line
 * was cut" from "this line ends in spaces" and stamp an ellipsis only on the
 * first, and what keeps a centred line from drifting half a space off true.
 *
 * Asked of the line's text rather than walked back through its segments,
 * because where a line ends is a fact about the characters and not about how
 * they were split. Walking the segments made it a fact about both: it read a
 * segment with no trailing whitespace as content and stopped there, which an
 * empty segment also looks like — and a crop leaves one behind. A styled line
 * whose last cells were cropped therefore reported no hanging whitespace at
 * all and was centred as though it were content to the edge, so a span landing
 * anywhere in a wrap's whitespace un-centred the line it closed. What draws no
 * cell after the whitespace is no content either: `closed` writes a bidi control
 * exactly there, and a cut leaves a zero-width code point that opened the next
 * word on the row before it.
 */
export function hangingWhitespace(line: Segment[]): number {
  return hangingCells(Segment.plainOf(line));
}

/** `hangingWhitespace` of a line's text. */
export function hangingCells(text: string): number {
  return cellLen(TRAILING_WHITESPACE_RE.exec(drawnTail(text))?.[0] ?? "");
}

/**
 * A row ready to order: one a wrap closed loses the whitespace it left hanging,
 * which rule L1 would otherwise stand at a right-to-left row's left edge. The
 * last row keeps what the author wrote.
 */
function rowOf(shown: readonly Segment[], last: boolean): Segment[] {
  const row = [...shown];
  return last ? row : Segment.adjustLineLength(row, Segment.getLineLength(row) - hangingWhitespace(row), undefined, false);
}

/** `line` with `keep` applied to each segment's text. */
function rewritten(line: readonly Segment[], keep: (text: string) => string): Segment[] {
  return line.map((segment) => {
    const text = keep(segment.text);
    return text === segment.text ? segment : new Segment(text, segment.style, segment.control);
  });
}

/** What a row of a directed line is, given the text it started as and its offset in the line. */
export interface ReorderedLine {
  /** The line to cut: X9's removals gone where the terminal will not need them. */
  readonly line: readonly Segment[];
  /** Whether a row's cells may not be merged with the padding beside them. */
  readonly oriented: boolean;
  /** A row of `source` at `start`: the segments it became, ready for padding. */
  orient(shown: readonly Segment[], start: number, source: string): Segment[];
}

const UNTOUCHED = (line: readonly Segment[]): ReorderedLine => ({ line, oriented: false, orient: (shown) => [...shown] });

const VISUAL_STAMP: BidiStamp = { order: "visual" };

function withStamp(line: readonly Segment[], bidi: BidiStamp): Segment[] {
  return line.map((segment) => new Segment(segment.text, (segment.style ?? NULL_STYLE).withBidi(bidi), segment.control));
}

/**
 * `levels` of `source` carried onto `shown`, which `source` became by losing a
 * tail and gaining a marker or wider gaps: each character that survived keeps
 * its level, and one that did not exist takes the level before it, the
 * paragraph's when nothing precedes.
 */
function alignedLevels(shown: string, source: string, levels: readonly number[], paragraphLevel: ParagraphLevel): number[] {
  const out: number[] = [];
  let at = 0;
  for (let unit = 0; unit < shown.length; unit += 1) {
    if (shown[unit] === source[at]) {
      out.push(levels[at]!);
      at += 1;
    } else {
      out.push(at === source.length || at === 0 ? paragraphLevel : levels[at - 1]!);
    }
  }
  return out;
}

interface Cluster {
  readonly text: string;
  readonly style: Style | undefined;
  readonly level: number;
}

/**
 * `style` with its caret, if it marks one, standing on the side of its cell the
 * insertion point is on at `level`: the glyph's leading edge, its right in a
 * right-to-left run. [LAW:one-source-of-truth] Set where the row's levels are
 * finished, so the side is read off the levels the row is ordered by, from the
 * text it shows, and never derived beside them.
 */
function sided(style: Style | undefined, level: number): Style | undefined {
  const mark = style?.caret;
  if (mark === undefined) return style;
  const side = level & 1 ? "right" : "left";
  return mark.side === side ? style : style!.withCaret(caretMark(mark.shape, side));
}

/** L1, L2 and L4 on a row: its grapheme clusters in display order, each carrying its style. */
function displayed(shown: readonly Segment[], levels: readonly number[], paragraphLevel: ParagraphLevel): Segment[] {
  const text = Segment.plainOf(shown);
  const finished = lineLevels(text, levels, paragraphLevel);
  // Clusters are found in the whole row, because a span edge inside one is no
  // place to cut it: reversed apart, a mark lands on another letter.
  const styles = shown.flatMap((segment) => new Array<Style | undefined>(segment.text.length).fill(segment.style));
  const glyphs = graphemes(text);
  const levelOf = clusterLevels(glyphs, finished, paragraphLevel);
  const clusters: Cluster[] = [];
  let unit = 0;
  for (const [index, cluster] of glyphs.entries()) {
    clusters.push({ text: cluster, style: sided(styles[unit], levelOf[index]!), level: levelOf[index]! });
    unit += cluster.length;
  }
  const forms = shaped(clusters.map((cluster) => cluster.text));
  const order = visualOrder(clusters.map((cluster) => cluster.level));
  const out: Segment[] = [];
  let run = "";
  let style: Style | undefined;
  const flush = (): void => {
    if (run !== "") out.push(new Segment(run, style));
    run = "";
  };
  for (const index of order) {
    const cluster = clusters[index]!;
    if (cluster.style !== style) flush();
    style = cluster.style;
    run += cluster.level & 1 ? mirroredCluster(forms[index]!) : forms[index]!;
  }
  flush();
  return out;
}

/**
 * The level each of `clusters` is shown at, given its text's finished levels: its
 * first unit's. A cluster of what X9 removes holds no level of its own, and stays
 * where the text put it, at the level before it.
 */
function clusterLevels(clusters: readonly string[], finished: readonly number[], paragraphLevel: ParagraphLevel): number[] {
  const out: number[] = [];
  let unit = 0;
  let previous: number = paragraphLevel;
  for (const cluster of clusters) {
    previous = finished[unit] === REMOVED ? previous : finished[unit]!;
    out.push(previous);
    unit += cluster.length;
  }
  return out;
}

/**
 * What `order` takes out of a line ahead of wrapping, and so out of its
 * measure: what will not reach the wire. Under `visual` that is X9's own step
 * and the marks with it: they have done their work once levels are resolved, and
 * L2 would move a trailing one to a row's first cell, where xterm.js advances
 * for it.
 */
const shownRemovals = (text: string): string => withoutMarks(withoutExplicit(text));

const REMOVALS: Readonly<Record<TextOrder, (text: string) => string>> = {
  plain: withoutExplicit,
  logical: (text) => text,
  visual: shownRemovals,
  words: shownRemovals,
};

/** Whether `order` takes `character` out of a line ahead of wrapping, as `REMOVALS` does. */
export function removes(order: TextOrder, character: string): boolean {
  return REMOVALS[order](character) === "";
}

/**
 * The paragraph level of `text`: `direction` when one is stated, UAX #9's P3,
 * and P2's first strong character otherwise. [LAW:one-source-of-truth] The one
 * reader of either, so where a row is placed and how it is ordered never read
 * two levels.
 */
export function paragraphLevelOf(text: string, direction: ParagraphLevel | undefined): ParagraphLevel {
  return direction ?? paragraphLevel(text);
}

/**
 * What `order` does with `line`, one logical line of drawn segments, whose
 * paragraph is `direction` when one is stated. A stated direction directs the
 * line even when nothing in it is bidi: it is a row of a paragraph that was.
 */
export function reorder(line: readonly Segment[], order: TextOrder, direction?: ParagraphLevel): ReorderedLine {
  if (direction === undefined && !isBidi(Segment.plainOf(line))) return UNTOUCHED(line);
  if (order === "plain") return UNTOUCHED(rewritten(line, REMOVALS.plain));

  const text = Segment.plainOf(line);
  if (order === "logical") {
    const level = paragraphLevelOf(text, direction);
    const openersAt = openersAlong(text);
    return {
      line,
      oriented: true,
      orient: (shown, start, source) =>
        withStamp(rowOf(shown, start + source.length === text.length), { order: "logical", level, opens: openersAt(start) }),
    };
  }

  const { level, levels } = paragraph(text, direction);
  const consumed = rewritten(line, REMOVALS[order]);
  const kept = Segment.plainOf(consumed);
  const keptLevels: number[] = [];
  let at = 0;
  for (let unit = 0; unit < text.length; unit += 1) {
    if (text[unit] === kept[at]) {
      keptLevels.push(levels[unit]!);
      at += 1;
    }
  }
  return {
    line: consumed,
    oriented: true,
    orient: (shown, start, source) => {
      const row = rowOf(shown, start + source.length === kept.length);
      const own = keptLevels.slice(start, start + source.length);
      return withStamp(displayed(row, alignedLevels(Segment.plainOf(row), source, own, level), level), VISUAL_STAMP);
    },
  };
}

/** `text` as `order` measures it: what `directed` removes ahead of wrapping is no word. */
export function measured(text: string, order: TextOrder): string {
  return isBidi(text) ? REMOVALS[order](text) : text;
}

/** The offsets in `text` of the code points that take a cell: a tab does, once expanded. */
function drawnOffsets(text: string): Set<number> {
  const drawn = new Set<number>();
  let unit = 0;
  for (const character of text) {
    if (character === "\t" || cellLen(character) > 0) drawn.add(unit);
    unit += character.length;
  }
  return drawn;
}

/** The offsets in `text`, one row, of the characters `order` shows at its left and right edges. */
export function edges(text: string, order: TextOrder, direction?: ParagraphLevel): { readonly left: number; readonly right: number } {
  // [LAW:one-source-of-truth] Directed exactly when `reorder` directs it.
  const units = order === "plain" || (direction === undefined && !isBidi(text)) ? Array.from({ length: text.length }, (_, unit) => unit) : ordered(text, direction);
  const offsets = drawnOffsets(text);
  const drawn = units.filter((unit) => offsets.has(unit));
  return { left: drawn[0] ?? 0, right: drawn.at(-1) ?? 0 };
}

/**
 * `glyphs`, one row whose paragraph is `direction` when one is stated, in the
 * order `order` shows them left to right, each as its index: what a column on the
 * screen maps back through. Directed exactly when `reorder` directs it, so under
 * `plain` it is the glyphs' own order. The glyphs are taken as given, so a caller
 * that draws each as a cell of its own keeps each.
 */
export function shownOrder(glyphs: readonly string[], order: TextOrder, direction?: ParagraphLevel): number[] {
  const text = glyphs.join("");
  if (order === "plain" || (direction === undefined && !isBidi(text))) return glyphs.map((_, index) => index);
  const { level, levels } = paragraph(text, direction);
  return visualOrder(clusterLevels(glyphs, lineLevels(text, levels, level), level));
}

function ordered(text: string, direction: ParagraphLevel | undefined): number[] {
  const { level, levels } = paragraph(text, direction);
  return visualOrder(lineLevels(text, levels, level));
}

/**
 * A label set between `before` and `after`, which are frame and stay where they
 * are, for a row drawn with no `RichText`: only the label is oriented, or a
 * button's brackets would be mirrored around it. A label `directed` leaves alone
 * is one segment with its frame, as it always was.
 */
export function labeled(before: string, label: string, after: string, style: Style | undefined, order: TextOrder | undefined): Segment[] {
  const { line, oriented, orient } = reorder([new Segment(label, style)], order ?? "plain");
  const text = Segment.plainOf(line);
  if (!oriented) return [new Segment(before + text + after, style)];
  return [new Segment(before, style), ...orient(line, 0, text), new Segment(after, style)].filter((segment) => segment.text !== "");
}
