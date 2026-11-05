/**
 * The Unicode Bidirectional Algorithm (UAX #9): the embedding level of every
 * character of a paragraph, and the visual order of a line of them.
 *
 * Levels are resolved over a whole paragraph and reordered a line at a time,
 * because rules L1 and L2 run after line breaking (UAX #9 section 3.4). So a
 * caller resolves first, cuts however it cuts, and asks for each piece's order
 * with the levels it took along. Rule numbers below are the standard's.
 *
 * Levels index UTF-16 code units, as every offset into a JavaScript string does;
 * both units of a surrogate pair carry one level. `REMOVED` is rule X9: a
 * character the algorithm takes out of the text, which has no level.
 */

import { BIDI_CLASSES, BRACKET_PAIRS, CLASS_RANGES, JOINING_RANGES, JOINING_TYPES, MIRRORS, PRESENTATION_FORMS } from "./bidi-data.js";
import { replaceZeroWidth } from "./cells.js";
import { pattern } from "./pattern.js";
import type { ParagraphLevel } from "./text-order.js";

export type { ParagraphLevel } from "./text-order.js";

type BidiClass = (typeof BIDI_CLASSES)[number] | "L";

/** The level of a character rule X9 removes. */
export const REMOVED = -1;

export interface Paragraph {
  readonly level: ParagraphLevel;
  /** One level per code unit of the text, `REMOVED` for what X9 removes. */
  readonly levels: readonly number[];
}

/** BD2: the deepest embedding the algorithm represents. */
const MAX_DEPTH = 125;
/** BD16: the bracket pairs one isolating run sequence may hold open. */
const MAX_OPEN_BRACKETS = 63;

/** The value `ranges`, ascending and disjoint, give `codePoint`. */
function inRanges(ranges: readonly (readonly [number, number, number])[], codePoint: number): number | undefined {
  let low = 0;
  let high = ranges.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [first, last, index] = ranges[mid]!;
    if (codePoint < first) high = mid - 1;
    else if (codePoint > last) low = mid + 1;
    else return index;
  }
  return undefined;
}

function classOf(codePoint: number): BidiClass {
  const index = inRanges(CLASS_RANGES, codePoint);
  return index === undefined ? "L" : BIDI_CLASSES[index as 0]!;
}

const CLOSING_OF: ReadonlyMap<number, number> = new Map(BRACKET_PAIRS);
const OPENING_OF: ReadonlyMap<number, number> = new Map(BRACKET_PAIRS.map(([open, close]) => [close, open]));
/** BD16: the angle brackets U+2329 and U+232A are canonically U+3008 and U+3009. */
const CANONICAL_BRACKET: ReadonlyMap<number, number> = new Map([[0x2329, 0x3008], [0x232a, 0x3009]]);
const MIRROR_OF: ReadonlyMap<number, number> = new Map(MIRRORS);

/** `codePoint`'s Bidi_Mirroring_Glyph, or itself. */
export function mirrored(codePoint: number): number {
  return MIRROR_OF.get(codePoint) ?? codePoint;
}

/** `cluster` with its base mirrored (L4), its marks kept. */
export function mirroredCluster(cluster: string): string {
  const base = cluster.codePointAt(0)!;
  return String.fromCodePoint(mirrored(base)) + cluster.slice(base > 0xffff ? 2 : 1);
}

const hex = (codePoint: number): string => `\\u{${codePoint.toString(16)}}`;

/**
 * What can raise a level in a left-to-right paragraph or that the algorithm
 * works on: R, AL, AN and the explicit formatting characters, closers included.
 * A line holding none is level 0 throughout, which is every line most programs
 * ever draw, so one match answers for it.
 */
const ACTIVE_CLASSES: ReadonlySet<BidiClass> = new Set<BidiClass>(
  ["R", "AL", "AN", "LRE", "RLE", "LRO", "RLO", "PDF", "LRI", "RLI", "FSI", "PDI"],
);
const ACTIVE = pattern(
  new RegExp(
    `[${CLASS_RANGES.filter(([, , index]) => ACTIVE_CLASSES.has(BIDI_CLASSES[index as 0]!))
      .map(([first, last]) => `${hex(first)}-${hex(last)}`)
      .join("")}]`,
    "u",
  ),
);

// LRE, RLE, PDF, LRO, RLO, LRI, RLI, FSI, PDI.
export const EXPLICIT = pattern(/[\u202a-\u202e\u2066-\u2069]/);
const MARKS = pattern(/[\u200e\u200f\u061c]/);

/** `text` with every explicit formatting character gone. */
export function withoutExplicit(text: string): string {
  return text.match(EXPLICIT) === null ? text : text.replace(new RegExp(EXPLICIT.source, "g"), "");
}

/** `text` as data on show: what the wire would drop, and every explicit control, spelled by `escape`. */
export function escaped(text: string, escape: (character: string) => string): string {
  return replaceZeroWidth(text, escape).replace(new RegExp(EXPLICIT.source, "gu"), escape);
}

/** `text` with LRM, RLM and ALM gone. */
export function withoutMarks(text: string): string {
  return text.match(MARKS) === null ? text : text.replace(new RegExp(MARKS.source, "g"), "");
}

const isIsolateOpener = (opener: string): boolean => isIsolateInitiator(classOf(opener.codePointAt(0)!));

/** The openers in force, outermost first, and how many are isolates, so an unmatched PDI costs no scan of them. */
export interface Open {
  readonly stack: string[];
  isolates: number;
}

/** `openers` in force, as a row's start states them. */
export function opened(openers = ""): Open {
  const open: Open = { stack: [], isolates: 0 };
  for (const character of openers) advance(open, character);
  return open;
}

/**
 * `character` applied to `open`, the openers in force, outermost first: an
 * opener joins them, a closer takes what it closes, and a line feed ends them
 * all, as X8 does at a paragraph's end. A line is the paragraph here, so U+2029
 * ends nothing: `paragraph` resolves it inside the line that holds it. False for
 * a closer that matches nothing, which closes nothing: PDF closes an embedding
 * opened since the innermost isolate, and PDI the innermost isolate with every
 * embedding inside it.
 */
export function advance(open: Open, character: string): boolean {
  const { stack } = open;
  const type = classOf(character.codePointAt(0)!);
  if (character === "\n") {
    stack.length = 0;
    open.isolates = 0;
  } else if (type === "LRE" || type === "RLE" || type === "LRO" || type === "RLO") stack.push(character);
  else if (isIsolateInitiator(type)) {
    stack.push(character);
    open.isolates += 1;
  } else if (type === "PDF") {
    if (stack.length === 0 || isIsolateOpener(stack.at(-1)!)) return false;
    stack.pop();
  } else if (type === "PDI") {
    if (open.isolates === 0) return false;
    while (!isIsolateOpener(stack.pop()!));
    open.isolates -= 1;
  }
  return true;
}

/** The openers `text` leaves open at its end, outermost first. */
export function openersOf(text: string): string {
  const open = opened();
  for (const character of text) advance(open, character);
  return open.stack.join("");
}

/**
 * What reopens `text`'s state at an offset: read forwards, since rows ask in
 * order, and from the start again for one behind. An opener past `MAX_DEPTH` is
 * one the algorithm ignores, so no row repeats it, or a hostile line's every row
 * would carry them all. An explicit control is one code unit, so offsets need no
 * care for surrogates.
 */
export function openersAlong(text: string): (offset: number) => string {
  let open = opened();
  let read = 0;
  return (offset) => {
    if (offset < read) {
      open = opened();
      read = 0;
    }
    for (; read < offset; read += 1) advance(open, text[read]!);
    return open.stack.slice(0, MAX_DEPTH).join("");
  };
}

/** What closes `openers`, innermost first. */
export function closersOf(openers: string): string {
  return Array.from(openers, (opener) => (isIsolateOpener(opener) ? "\u2069" : "\u202c"))
    .reverse()
    .join("");
}

/** What closes the direction state `content` leaves open. */
export function closing(content: string): string {
  return isBidi(content) ? closersOf(openersOf(content)) : "";
}

/** `content` with the direction state it leaves open closed: separate content starts clean after it. */
export function closed(content: string): string {
  return content + closing(content);
}

/** Whether `text` needs the algorithm at all. */
export function isBidi(text: string): boolean {
  return text.match(ACTIVE) !== null;
}

const isIsolateInitiator = (type: BidiClass): boolean => type === "LRI" || type === "RLI" || type === "FSI";
const isRemoved = (type: BidiClass): boolean =>
  type === "LRE" || type === "RLE" || type === "LRO" || type === "RLO" || type === "PDF" || type === "BN";
const isNeutral = (type: BidiClass): boolean =>
  type === "B" || type === "S" || type === "WS" || type === "ON" || type === "FSI" || type === "LRI" || type === "RLI" || type === "PDI";

/** BD9: each isolate initiator's matching PDI, and each matched PDI's initiator. */
function matchIsolates(types: readonly BidiClass[]): { pdiOf: Map<number, number>; initiatorOf: Map<number, number> } {
  const pdiOf = new Map<number, number>();
  const initiatorOf = new Map<number, number>();
  const open: number[] = [];
  types.forEach((type, index) => {
    if (isIsolateInitiator(type)) open.push(index);
    else if (type === "PDI" && open.length > 0) {
      const initiator = open.pop()!;
      pdiOf.set(initiator, index);
      initiatorOf.set(index, initiator);
    }
  });
  return { pdiOf, initiatorOf };
}

/** P2 and P3: the level of the first strong character outside any isolate in `from`..`to`, 0 if none. */
function firstStrongLevel(
  types: readonly BidiClass[],
  pdiOf: ReadonlyMap<number, number>,
  from: number,
  to: number,
): ParagraphLevel {
  for (let index = from; index < to; index += 1) {
    const type = types[index]!;
    if (type === "L") return 0;
    if (type === "R" || type === "AL") return 1;
    if (isIsolateInitiator(type)) {
      const pdi = pdiOf.get(index);
      if (pdi === undefined) return 0;
      index = pdi;
    }
  }
  return 0;
}

interface Embedding {
  readonly level: number;
  readonly override: BidiClass | undefined;
  readonly isolate: boolean;
}

/** X1 to X8: the explicit level of each character, with overrides applied to `types`. */
function resolveExplicit(
  types: BidiClass[],
  paragraphLevel: ParagraphLevel,
  pdiOf: ReadonlyMap<number, number>,
  initiatorOf: ReadonlyMap<number, number>,
): number[] {
  const levels = new Array<number>(types.length).fill(paragraphLevel);
  const stack: Embedding[] = [{ level: paragraphLevel, override: undefined, isolate: false }];
  let overflowIsolates = 0;
  let overflowEmbeddings = 0;
  let validIsolates = 0;
  const top = (): Embedding => stack[stack.length - 1]!;
  const nextOdd = (level: number): number => (level + 1) | 1;
  const nextEven = (level: number): number => (level + 2) & ~1;
  const stamp = (index: number): void => {
    levels[index] = top().level;
    if (top().override !== undefined) types[index] = top().override!;
  };

  types.forEach((type, index) => {
    switch (type) {
      case "RLE":
      case "LRE":
      case "RLO":
      case "LRO": {
        levels[index] = top().level;
        const level = type === "RLE" || type === "RLO" ? nextOdd(top().level) : nextEven(top().level);
        if (level <= MAX_DEPTH && overflowIsolates === 0 && overflowEmbeddings === 0) {
          const override = type === "RLO" ? "R" : type === "LRO" ? "L" : undefined;
          stack.push({ level, override, isolate: false });
        } else if (overflowIsolates === 0) {
          overflowEmbeddings += 1;
        }
        break;
      }
      case "RLI":
      case "LRI":
      case "FSI": {
        stamp(index);
        const pdi = pdiOf.get(index) ?? types.length;
        const rtl = type === "RLI" || (type === "FSI" && firstStrongLevel(types, pdiOf, index + 1, pdi) === 1);
        const level = rtl ? nextOdd(top().level) : nextEven(top().level);
        if (level <= MAX_DEPTH && overflowIsolates === 0 && overflowEmbeddings === 0) {
          validIsolates += 1;
          stack.push({ level, override: undefined, isolate: true });
        } else {
          overflowIsolates += 1;
        }
        break;
      }
      case "PDI": {
        if (overflowIsolates > 0) overflowIsolates -= 1;
        else if (validIsolates > 0 && initiatorOf.has(index)) {
          overflowEmbeddings = 0;
          while (!top().isolate) stack.pop();
          stack.pop();
          validIsolates -= 1;
        }
        stamp(index);
        break;
      }
      case "PDF": {
        levels[index] = top().level;
        if (overflowIsolates > 0) break;
        if (overflowEmbeddings > 0) overflowEmbeddings -= 1;
        else if (!top().isolate && stack.length >= 2) stack.pop();
        break;
      }
      case "B":
        levels[index] = paragraphLevel;
        break;
      case "BN":
        levels[index] = top().level;
        break;
      default:
        stamp(index);
    }
  });
  return levels;
}

/** X10: the indexes of each isolating run sequence, in order, with X9's removals left out. */
function isolatingRunSequences(
  original: readonly BidiClass[],
  levels: readonly number[],
  pdiOf: ReadonlyMap<number, number>,
  initiatorOf: ReadonlyMap<number, number>,
): number[][] {
  const runs: number[][] = [];
  let previousLevel = -1;
  original.forEach((type, index) => {
    if (isRemoved(type)) return;
    if (levels[index] !== previousLevel) runs.push([]);
    runs[runs.length - 1]!.push(index);
    previousLevel = levels[index]!;
  });

  const runStartingAt = new Map(runs.map((run) => [run[0]!, run]));
  const sequences: number[][] = [];
  for (const run of runs) {
    const first = run[0]!;
    if (original[first] === "PDI" && initiatorOf.has(first)) continue;
    const sequence = [...run];
    for (;;) {
      const last = sequence[sequence.length - 1]!;
      const pdi = isIsolateInitiator(original[last]!) ? pdiOf.get(last) : undefined;
      const next = pdi === undefined ? undefined : runStartingAt.get(pdi);
      if (next === undefined) break;
      // One push at a time: a run can be longer than a call's arguments may be.
      for (const index of next) sequence.push(index);
    }
    sequences.push(sequence);
  }
  return sequences;
}

const directionOf = (level: number): "L" | "R" => (level & 1 ? "R" : "L");

/** W1 to W7, over one sequence's classes, in place. */
function resolveWeak(seq: BidiClass[], sos: BidiClass): void {
  // W1
  seq.forEach((type, at) => {
    if (type !== "NSM") return;
    const before = at === 0 ? sos : seq[at - 1]!;
    seq[at] = isIsolateInitiator(before) || before === "PDI" ? "ON" : before;
  });
  // W2
  let strong: BidiClass = sos;
  seq.forEach((type, at) => {
    if (type === "EN" && strong === "AL") seq[at] = "AN";
    if (type === "L" || type === "R" || type === "AL") strong = type;
  });
  // W3
  seq.forEach((type, at) => {
    if (type === "AL") seq[at] = "R";
  });
  // W4
  for (let at = 1; at < seq.length - 1; at += 1) {
    const before = seq[at - 1]!;
    const after = seq[at + 1]!;
    if (seq[at] === "ES" && before === "EN" && after === "EN") seq[at] = "EN";
    if (seq[at] === "CS" && before === after && (before === "EN" || before === "AN")) seq[at] = before;
  }
  // W5
  for (let at = 0; at < seq.length; at += 1) {
    if (seq[at] !== "ET") continue;
    let end = at;
    while (end < seq.length && seq[end] === "ET") end += 1;
    const touches = (at > 0 && seq[at - 1] === "EN") || (end < seq.length && seq[end] === "EN");
    for (let et = at; et < end; et += 1) if (touches) seq[et] = "EN";
    at = end - 1;
  }
  // W6
  seq.forEach((type, at) => {
    if (type === "ES" || type === "ET" || type === "CS") seq[at] = "ON";
  });
  // W7
  strong = sos;
  seq.forEach((type, at) => {
    if (type === "EN" && strong === "L") seq[at] = "L";
    if (type === "L" || type === "R") strong = type;
  });
}

/** BD16: the bracket pairs of one sequence, ascending by opening position. */
function bracketPairs(seq: readonly BidiClass[], codePoints: readonly number[]): [number, number][] {
  const open: { closing: number; at: number }[] = [];
  const pairs: [number, number][] = [];
  for (let at = 0; at < seq.length; at += 1) {
    if (seq[at] !== "ON") continue;
    const codePoint = codePoints[at]!;
    const closing = CLOSING_OF.get(codePoint);
    if (closing !== undefined) {
      if (open.length === MAX_OPEN_BRACKETS) return [];
      open.push({ closing: CANONICAL_BRACKET.get(closing) ?? closing, at });
      continue;
    }
    if (!OPENING_OF.has(codePoint)) continue;
    const canonical = CANONICAL_BRACKET.get(codePoint) ?? codePoint;
    for (let entry = open.length - 1; entry >= 0; entry -= 1) {
      if (open[entry]!.closing !== canonical) continue;
      pairs.push([open[entry]!.at, at]);
      open.length = entry;
      break;
    }
  }
  return pairs.sort(([a], [b]) => a - b);
}

/** N0: paired brackets take the direction of what they enclose. */
function resolveBrackets(
  seq: BidiClass[],
  originals: readonly BidiClass[],
  codePoints: readonly number[],
  embedding: "L" | "R",
  sos: BidiClass,
): void {
  // Under N0, EN and AN count as R.
  const strongOf = (type: BidiClass): "L" | "R" | undefined =>
    type === "L" ? "L" : type === "R" || type === "EN" || type === "AN" ? "R" : undefined;

  for (const [open, close] of bracketPairs(seq, codePoints)) {
    let inside: "L" | "R" | undefined;
    let matchesEmbedding = false;
    for (let at = open + 1; at < close; at += 1) {
      const strong = strongOf(seq[at]!);
      if (strong === undefined) continue;
      inside = strong;
      if (strong === embedding) matchesEmbedding = true;
    }
    if (inside === undefined) continue;
    let direction: "L" | "R" = embedding;
    if (!matchesEmbedding) {
      let before: "L" | "R" = strongOf(sos)!;
      for (let at = open - 1; at >= 0; at -= 1) {
        const strong = strongOf(seq[at]!);
        if (strong !== undefined) {
          before = strong;
          break;
        }
      }
      direction = before === embedding ? embedding : inside;
    }
    for (const bracket of [open, close]) {
      seq[bracket] = direction;
      for (let mark = bracket + 1; mark < seq.length && originals[mark] === "NSM"; mark += 1) seq[mark] = direction;
    }
  }
}

/** N1 and N2: each run of neutrals takes the direction around it, or the embedding's. */
function resolveNeutrals(seq: BidiClass[], sos: BidiClass, eos: BidiClass, embedding: "L" | "R"): void {
  const sideOf = (type: BidiClass): "L" | "R" => (type === "L" ? "L" : "R");
  for (let at = 0; at < seq.length; at += 1) {
    if (!isNeutral(seq[at]!)) continue;
    let end = at;
    while (end < seq.length && isNeutral(seq[end]!)) end += 1;
    const before = sideOf(at === 0 ? sos : seq[at - 1]!);
    const after = sideOf(end === seq.length ? eos : seq[end]!);
    seq.fill(before === after ? before : embedding, at, end);
    at = end - 1;
  }
}

/** The classes, levels, and paragraph level of one paragraph, its code points indexed from 0. */
function resolveParagraph(
  codePoints: readonly number[],
  direction: ParagraphLevel | undefined,
): { level: ParagraphLevel; levels: number[] } {
  const original = codePoints.map(classOf);
  const { pdiOf, initiatorOf } = matchIsolates(original);
  const level = direction ?? firstStrongLevel(original, pdiOf, 0, original.length);
  const types = [...original];
  const levels = resolveExplicit(types, level, pdiOf, initiatorOf);
  // Apart from `levels`: X10 reads a neighbouring run's explicit level, which I1 and I2 must not have moved.
  const resolved = [...levels];

  for (const sequence of isolatingRunSequences(original, levels, pdiOf, initiatorOf)) {
    const first = sequence[0]!;
    const last = sequence[sequence.length - 1]!;
    const sequenceLevel = levels[first]!;
    // X10: sos and eos compare this level with the one on the far side of the sequence.
    let before = first - 1;
    while (before >= 0 && isRemoved(original[before]!)) before -= 1;
    const sos = directionOf(Math.max(sequenceLevel, before < 0 ? level : levels[before]!));
    let after = last + 1;
    while (after < original.length && isRemoved(original[after]!)) after += 1;
    const unmatched = isIsolateInitiator(original[last]!) && !pdiOf.has(last);
    const eos = directionOf(Math.max(sequenceLevel, unmatched || after >= original.length ? level : levels[after]!));

    const seq = sequence.map((index) => types[index]!);
    const originals = sequence.map((index) => original[index]!);
    resolveWeak(seq, sos);
    const embedding = directionOf(sequenceLevel);
    resolveBrackets(seq, originals, sequence.map((index) => codePoints[index]!), embedding, sos);
    resolveNeutrals(seq, sos, eos, embedding);

    // I1 and I2.
    sequence.forEach((index, at) => {
      const type = seq[at]!;
      if (sequenceLevel & 1) resolved[index]! += type === "R" ? 0 : 1;
      else resolved[index]! += type === "L" ? 0 : type === "R" ? 1 : 2;
    });
  }
  return { level, levels: resolved.map((value, index) => (isRemoved(original[index]!) ? REMOVED : value)) };
}

/**
 * `text`, one paragraph, resolved to rule I2. `direction` is rule HL1: a
 * paragraph direction stated rather than found. Absent, P2 and P3 find it.
 */
/** P2 and P3 alone: `text`'s paragraph level, for a caller that resolves nothing else. */
export function paragraphLevel(text: string): ParagraphLevel {
  const types = Array.from(text, (character) => classOf(character.codePointAt(0)!));
  return firstStrongLevel(types, matchIsolates(types).pdiOf, 0, types.length);
}

export function paragraph(text: string, direction?: ParagraphLevel): Paragraph {
  const codePoints = Array.from(text, (character) => character.codePointAt(0)!);
  const { level, levels } = resolveParagraph(codePoints, direction);
  const units: number[] = [];
  codePoints.forEach((codePoint, index) => {
    units.push(levels[index]!);
    if (codePoint > 0xffff) units.push(levels[index]!);
  });
  return { level, levels: units };
}

/** L1: the levels of one line, its separators and trailing whitespace back at the paragraph level. */
export function lineLevels(line: string, levels: readonly number[], paragraphLevel: ParagraphLevel): number[] {
  const out = [...levels];
  const types = Array.from(line, (character) => classOf(character.codePointAt(0)!));
  const units = Array.from(line, (character) => character.length);
  let unit = line.length;
  let trailing = true;
  for (let index = types.length - 1; index >= 0; index -= 1) {
    const type = types[index]!;
    unit -= units[index]!;
    const whitespace = type === "WS" || isIsolateInitiator(type) || type === "PDI" || isRemoved(type);
    if (type === "B" || type === "S") {
      trailing = true;
    } else if (!whitespace) {
      trailing = false;
    }
    if (trailing && !isRemoved(type)) out.fill(paragraphLevel, unit, unit + units[index]!);
  }
  return out;
}

/** L2: the indexes of `levels` in visual order, what X9 removed left out. */
export function visualOrder(levels: readonly number[]): number[] {
  const order = levels.flatMap((level, index) => (level === REMOVED ? [] : [index]));
  const kept = order.map((index) => levels[index]!);
  const highest = kept.reduce((max, level) => Math.max(max, level), 0);
  const lowestOdd = kept.reduce((min, level) => (level & 1 ? Math.min(min, level) : min), Infinity);
  for (let level = highest; level >= lowestOdd; level -= 1) {
    for (let start = 0; start < kept.length; start += 1) {
      if (kept[start]! < level) continue;
      let end = start;
      while (end < kept.length && kept[end]! >= level) end += 1;
      reverse(order, start, end);
      reverse(kept, start, end);
      start = end;
    }
  }
  return order;
}

function reverse(items: number[], start: number, end: number): void {
  for (let left = start, right = end - 1; left < right; left += 1, right -= 1) {
    [items[left], items[right]] = [items[right]!, items[left]!];
  }
}

type JoiningType = (typeof JOINING_TYPES)[number] | "U";

function joiningTypeOf(codePoint: number): JoiningType {
  const index = inRanges(JOINING_RANGES, codePoint);
  return index === undefined ? "U" : JOINING_TYPES[index as 0]!;
}

const FORMS_OF: ReadonlyMap<number, readonly number[]> = new Map(PRESENTATION_FORMS.map(([letter, ...forms]) => [letter, forms]));
const ISOLATED = 0;
const FINAL = 1;
const INITIAL = 2;
const MEDIAL = 3;
const ZWNJ = "\u200c";
const ZWJ = "\u200d";

/** What of a cluster joining sees: whether it has forms, and which way it joins. */
interface Joining {
  readonly letter: boolean;
  readonly toPrevious: boolean;
  readonly toNext: boolean;
  /** It holds a ZWJ, which joins across it whatever its base is. */
  readonly separator: boolean;
}

const UNJOINED: Joining = { letter: false, toPrevious: false, toNext: false, separator: false };

function joiningOf(cluster: string): Joining {
  const base = cluster.codePointAt(0)!;
  const type = joiningTypeOf(base);
  const toNext = (type === "D" || type === "L" || type === "C") && !cluster.includes(ZWNJ);
  return { letter: FORMS_OF.has(base), toPrevious: type === "D" || type === "R" || type === "C", toNext, separator: cluster.includes(ZWJ) };
}

/**
 * Arabic joining on one row's grapheme clusters, in logical order and in place:
 * each letter takes the presentation form its neighbours call for, because a
 * terminal that does not reorder does not join either. A presentation form is
 * one cell, as the letter was, so no width moves. Lam-alef stays two forms rather
 * than the one-cell ligature, as VTE leaves it, since the ligature would narrow
 * a line after it was laid out. A letter Unicode encodes no such form for stays a
 * base letter. A joiner beside a shaped letter goes, its effect carried by the
 * form; any other joiner, an emoji sequence's among them, stays or `cellLen`
 * would change after the cut.
 */
export function shaped(clusters: readonly string[]): string[] {
  const joinings = clusters.map(joiningOf);
  // Marks and lone joiners are transparent: joining reads past them.
  const isTransparent = (at: number): boolean => joiningTypeOf(clusters[at]!.codePointAt(0)!) === "T";
  const neighbour = (at: number, step: 1 | -1): Joining => {
    let next = at + step;
    while (next >= 0 && next < clusters.length && isTransparent(next)) next += step;
    return joinings[next] ?? UNJOINED;
  };

  return clusters.map((text, at) => {
    const own = joinings[at]!;
    if (!own.letter) return text;
    const before = neighbour(at, -1);
    const joinsBefore = own.toPrevious && (before.toNext || before.separator);
    const joinsAfter = own.toNext && (own.separator || neighbour(at, 1).toPrevious);
    const forms = FORMS_OF.get(text.codePointAt(0)!)!;
    const wanted = joinsBefore ? (joinsAfter ? MEDIAL : FINAL) : joinsAfter ? INITIAL : ISOLATED;
    const form = forms[wanted] || text.codePointAt(0)!;
    return String.fromCodePoint(form) + text.slice(1).replaceAll(ZWNJ, "").replaceAll(ZWJ, "");
  });
}
