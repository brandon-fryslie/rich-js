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

import { isBidi, lineLevels, mirrored, openersAlong, paragraph, paragraphLevel, REMOVED, shaped, visualOrder, withoutExplicit, withoutMarks } from "./bidi.js";
import { cellLen, graphemes } from "./cells.js";
import { pattern } from "./pattern.js";
import { Segment } from "./segment.js";
import { NULL_STYLE, type Style } from "./style.js";
import type { BidiStamp, ParagraphLevel, TextOrder } from "./text-order.js";

const TRAILING_WHITESPACE_RE = pattern(/\s+$/);

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
 * anywhere in a wrap's whitespace un-centred the line it closed. A bidi control
 * after the whitespace is no content either, and `closed` writes one exactly
 * there.
 */
export function hangingWhitespace(line: Segment[]): number {
  return cellLen(TRAILING_WHITESPACE_RE.exec(withoutExplicit(Segment.plainOf(line)))?.[0] ?? "");
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
export interface Directed {
  /** The line to cut: X9's removals gone where the terminal will not need them. */
  readonly line: readonly Segment[];
  /** Whether a row's cells may not be merged with the padding beside them. */
  readonly oriented: boolean;
  /** A row of `source` at `start`: the segments it became, ready for padding. */
  orient(shown: readonly Segment[], start: number, source: string): Segment[];
}

const UNTOUCHED = (line: readonly Segment[]): Directed => ({ line, oriented: false, orient: (shown) => [...shown] });

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

/** L1, L2 and L4 on a row: its grapheme clusters in display order, each carrying its style. */
function displayed(shown: readonly Segment[], levels: readonly number[], paragraphLevel: ParagraphLevel): Segment[] {
  const text = Segment.plainOf(shown);
  const finished = lineLevels(text, levels, paragraphLevel);
  // Clusters are found in the whole row, because a span edge inside one is no
  // place to cut it: reversed apart, a mark lands on another letter.
  const styles = shown.flatMap((segment) => new Array<Style | undefined>(segment.text.length).fill(segment.style));
  const clusters: Cluster[] = [];
  let unit = 0;
  let previous: number = paragraphLevel;
  for (const cluster of graphemes(text)) {
    // A cluster of what X9 removes holds no level of its own, and stays where the text put it.
    const level = finished[unit] === REMOVED ? previous : finished[unit]!;
    previous = level;
    clusters.push({ text: cluster, style: styles[unit], level });
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

function mirroredCluster(cluster: string): string {
  const base = cluster.codePointAt(0)!;
  return String.fromCodePoint(mirrored(base)) + cluster.slice(base > 0xffff ? 2 : 1);
}

/**
 * What `order` takes out of a line ahead of wrapping, and so out of its
 * measure: what will not reach the wire. Under `visual` that is X9's own step
 * and the marks with it: they have done their work once levels are resolved, and
 * L2 would move a trailing one to a row's first cell, where xterm.js advances
 * for it.
 */
const REMOVALS: Readonly<Record<TextOrder, (text: string) => string>> = {
  plain: withoutExplicit,
  logical: (text) => text,
  visual: (text) => withoutMarks(withoutExplicit(text)),
};

/** What `order` does with `line`, one logical line of drawn segments. */
export function directed(line: readonly Segment[], order: TextOrder): Directed {
  if (!isBidi(Segment.plainOf(line))) return UNTOUCHED(line);
  if (order === "plain") return UNTOUCHED(rewritten(line, REMOVALS.plain));

  const text = Segment.plainOf(line);
  if (order === "logical") {
    const level = paragraphLevel(text);
    const openersAt = openersAlong(text);
    return {
      line,
      oriented: true,
      orient: (shown, start, source) =>
        withStamp(rowOf(shown, start + source.length === text.length), { order: "logical", level, opens: openersAt(start) }),
    };
  }

  const { level, levels } = paragraph(text);
  const consumed = rewritten(line, REMOVALS.visual);
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

/** The offsets in `text`, one row, of the characters `order` shows at its left and right edges: a control draws no cell. */
export function edges(text: string, order: TextOrder): { readonly left: number; readonly right: number } {
  const units = order === "plain" || !isBidi(text) ? Array.from({ length: text.length }, (_, unit) => unit) : ordered(text);
  const drawn = units.filter((unit) => REMOVALS.visual(text[unit]!) !== "");
  return { left: drawn[0] ?? 0, right: drawn.at(-1) ?? 0 };
}

function ordered(text: string): number[] {
  const { level, levels } = paragraph(text);
  return visualOrder(lineLevels(text, levels, level));
}

/**
 * A label set between `before` and `after`, which are frame and stay where they
 * are, for a row drawn with no `RichText`: only the label is oriented, or a
 * button's brackets would be mirrored around it. A label `directed` leaves alone
 * is one segment with its frame, as it always was.
 */
export function labelled(before: string, label: string, after: string, style: Style | undefined, order: TextOrder | undefined): Segment[] {
  const { line, oriented, orient } = directed([new Segment(label, style)], order ?? "plain");
  const text = Segment.plainOf(line);
  if (!oriented) return [new Segment(before + text + after, style)];
  return [new Segment(before, style), ...orient(line, 0, text), new Segment(after, style)].filter((segment) => segment.text !== "");
}
