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

import { isBidi, lineLevels, mirrored, openersAlong, paragraph, REMOVED, shaped, visualOrder, withoutExplicit, withoutMarks } from "./bidi.js";
import { graphemes } from "./cells.js";
import { Segment } from "./segment.js";
import { NULL_STYLE, type Style } from "./style.js";
import type { BidiStamp, ParagraphLevel, TextOrder } from "./text-order.js";

const plainOf = (line: readonly Segment[]): string => line.map((segment) => segment.text).join("");

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
  const text = plainOf(shown);
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

/** What `order` does with `line`, one logical line of drawn segments. */
export function directed(line: readonly Segment[], order: TextOrder): Directed {
  if (!isBidi(plainOf(line))) return UNTOUCHED(line);
  if (order === "plain") return UNTOUCHED(rewritten(line, withoutExplicit));

  const text = plainOf(line);
  const { level, levels } = paragraph(text);
  if (order === "logical") {
    const openersAt = openersAlong(text);
    return {
      line,
      oriented: true,
      orient: (shown, start) => withStamp(shown, { order: "logical", level, opens: openersAt(start) }),
    };
  }

  // X9's own step, ahead of wrapping, and the marks with it: they have done their
  // work once levels are resolved, and L2 would move a trailing one to a row's
  // first cell, where xterm.js advances for it.
  const consumed = rewritten(line, (piece) => withoutMarks(withoutExplicit(piece)));
  const kept = plainOf(consumed);
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
      const own = keptLevels.slice(start, start + source.length);
      return withStamp(displayed(shown, alignedLevels(plainOf(shown), source, own, level), level), VISUAL_STAMP);
    },
  };
}

/** `text` as `order` measures it: what `directed` removes ahead of wrapping is no word. */
export function measured(text: string, order: TextOrder): string {
  if (!isBidi(text) || order === "logical") return text;
  return order === "plain" ? withoutExplicit(text) : withoutMarks(withoutExplicit(text));
}

/** The offsets in `text`, one row, of the characters `order` shows at its left and right edges. */
export function edges(text: string, order: TextOrder): { readonly left: number; readonly right: number } {
  if (order === "plain" || !isBidi(text)) return { left: 0, right: text.length - 1 };
  const { level, levels } = paragraph(text);
  const shown = visualOrder(lineLevels(text, levels, level));
  return { left: shown[0] ?? 0, right: shown.at(-1) ?? 0 };
}

/**
 * A label set between `before` and `after`, which are frame and stay where they
 * are, for a row drawn with no `RichText`: only the label is oriented, or a
 * button's brackets would be mirrored around it. A label `directed` leaves alone
 * is one segment with its frame, as it always was.
 */
export function labelled(before: string, label: string, after: string, style: Style | undefined, order: TextOrder | undefined): Segment[] {
  const { line, oriented, orient } = directed([new Segment(label, style)], order ?? "plain");
  const text = plainOf(line);
  if (!oriented) return [new Segment(before + text + after, style)];
  return [new Segment(before, style), ...orient(line, 0, text), new Segment(after, style)].filter((segment) => segment.text !== "");
}
