/**
 * ANSI bytes back into styled text — a port of Rich's `AnsiDecoder`
 * (rich/ansi.py) and `Text.from_ansi`.
 *
 * The rendering pipeline runs one way, `Style` → SGR bytes; this runs it
 * backwards, for output some program already wrote: a capture of an example's
 * own `new Console()`, a CLI's output shown inside a Panel, a log replayed into
 * a Table cell.
 *
 * [LAW:types-are-the-program] Every color decodes to the `ColorSpec` its
 * escape names — `31` the standard color 1, `38;5;n` palette index n,
 * `38;2;r;g;b` that truecolor — and none is resolved to RGB here. A standard
 * color is a slot in whatever theme draws it, so one captured run exports
 * correctly under a light theme and a dark one; resolved here, dark mode would
 * show light mode's colors. Resolution belongs to `export-lines`.
 *
 * [LAW:types-are-the-program] The link is decoder state of its own, beside
 * the SGR style, not a field of it: a terminal ends a hyperlink only at an OSC
 * 8 close, and an SGR reset inside the link leaves it open. Rich keeps the
 * link in the SGR style, so its reset drops it.
 *
 * Carriage returns are the other departure, and the same argument. Rich splits
 * lines with Python's `splitlines`, which also breaks at `\r`, so its `a\rb`
 * is two lines. Here a line ends at `\n` and the census's other line breaks, and
 * `\r` returns to the first column, so later text overwrites earlier text cell by
 * cell: `50%\r100%` is `100%`, `Downloading\rDone` is `Doneloading`, and `done\r`
 * is still `done`. Columns are a terminal's cells: a wide character takes two, a
 * combining mark none, a tab moves to the next stop over what is there, and a wide
 * character or a tab half overwritten leaves blanks. Erase in line (`\x1b[K`) is honoured for the same reason, because a redraw
 * is usually `\r\x1b[K` and the old text must not show through a shorter new
 * one.
 *
 * Backspace is the third. Rich drops it; here it is nroff's overstrike, the
 * adjacent `x BS x` bold and `_ BS x` underline that `man` writes, and a bare one
 * moves back a column, so `12%\b\b\b13%` is the redraw it looks like. The bytes
 * alone cannot tell `1\b1` the redraw from `1\b1` the bold, and `less` reads them
 * as overstrike with no other evidence, so this does.
 *
 * Colon sub-parameters are the fourth. Rich skips `4:3` and `38:2::r:g:b`; they
 * are T.416's own form, neovim writes `4:3` for undercurl, and every terminal
 * that reads them draws the underline and the color, so this reads them too.
 *
 * Everything else follows Rich: malformed SGR parameters are skipped rather
 * than refused, and every other escape is dropped, with every control a terminal
 * draws nothing for. It is not a terminal emulator: movement along the line —
 * CUB, CUF, CHA, CHT, CBT, and ECMA-48's HPB, HPR and HPA — moves the column as `\r` and a
 * backspace do, since a redraw writes `\x1b[2D` as readily as two backspaces,
 * and every other cursor movement is dropped, not performed.
 *
 * Tier 5 of `src/core/`: it builds `RichText`, so it sits above `text`, and
 * `RichText` cannot offer a `fromAnsi` static without importing upward.
 */

import { cellLen, graphemes } from "./cells.js";
import { ColorSpec } from "./color.js";
import { CONTROL_CODES, controlClass } from "./control-codes.js";
import { osc8Sequences, STRING_STOPS } from "./osc8.js";
import { ATTRIBUTE_NAMES, ATTRIBUTE_SGR, NULL_STYLE, Style } from "./style.js";
import type { StyleOptions } from "./style.js";
import { RichText } from "./text.js";
import type { RichTextOptions } from "./text.js";

type Token =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "sgr"; readonly params: string }
  | { readonly kind: "link"; readonly uri: string }
  | { readonly kind: "overstrike"; readonly character: string; readonly emphasis: Style }
  | { readonly kind: "move"; readonly motion: Motion; readonly count: number }
  | { readonly kind: "erase"; readonly mode: EraseMode };

/** `\x1b[K`'s parameter: 0 erases from the cursor on, 1 up to it, 2 the whole line. */
type EraseMode = "0" | "1" | "2";

const BOLD = new Style({ bold: true });
const UNDERLINED = new Style({ underline: true });
const BOLD_UNDERLINED = BOLD.add(UNDERLINED);

// A C1 introducer is its ESC form's final byte plus 0x40 (ECMA-48 §5.3), and a
// terminal that reads C1 reads it as that ESC form (`docs/control-codes.md`).
const hex = (codes: readonly number[]): string => codes.map((code) => `\\x${code.toString(16).padStart(2, "0")}`).join("");
const finals = (introducers: string): number[] => [...introducers].map((final) => final.charCodeAt(0));
const either = (introducers: string): string => {
  const codes = finals(introducers);
  return `(?:\\x1b[${hex(codes)}]|[${hex(codes.map((code) => code + 0x40))}])`;
};
const CSI = either("[");
// OSC, DCS, APC, PM, SOS. As the VT500 parser C1-reading terminals follow, the
// payload ends at a terminator, which it takes, or before an ESC or any C1
// control, NEL among them, which then acts as itself. The parser ignores the
// other C0 controls there, so a form feed stays in the payload; a line feed ends
// it, the cut a capture's line makes. A stray C1 byte that is windows-1252 read
// as Latin-1 decodes as such a terminal shows it; no rule local to the byte can
// tell the two apart, so repairing it is the caller's.
const STRING_ESCAPE = String.raw`${either("]P_^X")}[^${STRING_STOPS}\n]*(?:\x07|\x1b\\|\x9c)?`;

// The ESC form of each C1 control `CONTROL_CODES` breaks a line at: `ESC E`, NEL.
const ESC_LINE_BREAKS = hex(
  CONTROL_CODES.filter((row) => row.disposition === "line-break").flatMap((row) =>
    Array.from({ length: row.last - row.first + 1 }, (_, at) => row.first + at).filter((code) => code >= 0x80 && code <= 0x9f),
  ).map((code) => code - 0x40),
);

/**
 * Every escape but OSC 8, which `osc8Sequences` reads before this runs. In
 * order — each CSI and string escape in its `ESC` form or its C1 one — a
 * carriage return; a cursor motion along the line (`motion`, its `count`); an SGR sequence (`sgr`, its parameters — a private
 * marker such as the `>` of `\x1b[>4;2m` makes it some other CSI); erase in line
 * (`mode`); any other CSI sequence; any other string escape — OSC, DCS, APC, PM,
 * SOS — run to a terminator or cut off where `STRING_ESCAPE` says;
 * any other escape, ECMA-48's intermediates and one final byte (`\x1b(B`,
 * `\x1b)0`, `\x1b#8`, `\x1bc`); a character struck over itself (`struck`), over an
 * underscore first or not (`underscore`); a character struck over an underscore
 * alone (`underlined`); a backspace; and every control a line may not hold or a
 * terminal draws nothing for. The silent ones are the two "any other" escapes and
 * that last class.
 */
const ESCAPES = [
  String.raw`\r|${CSI}(?<count>[0-9]*)(?:;[0-9;]*)?(?<motion>[CDGIZaj\x60])|${CSI}(?<sgr>[0-9;:]*)m|${CSI}(?<mode>[012]?)K|${CSI}[0-?]*[ -/]*[@-~]|${STRING_ESCAPE}|\x1b[ -/]*[0-~]`,
  String.raw`(?<underscore>_\x08)?(?<struck>\P{Cc})(?:\x08\k<struck>)+|_\x08(?<underlined>\P{Cc})|\x08`,
  controlClass((disposition) => disposition !== "keep" && disposition !== "zeroWidth"),
].join("|");

const escapes = (): RegExp => new RegExp(ESCAPES, "gu");

// A string escape goes first so a line break its payload holds stays in it.
const lineBreaks = (): RegExp =>
  new RegExp(`(${STRING_ESCAPE})|\\x1b[${ESC_LINE_BREAKS}]|${controlClass((disposition) => disposition === "line-break")}`, "gu");

/**
 * The last column a move reaches. A captured line has no right margin, so this
 * is DEC's parameter ceiling, 9999: a 15-byte `\x1b[4294967295C` then pads a
 * line by ten thousand cells, not four billion.
 */
const LAST_COLUMN = 9999;

const tabStop = (index: number): number => index * TAB_STOP + 1;

/**
 * ECMA-48's moves along the line, by final byte, for a count of at least 1, as
 * an absent or zero parameter is: back (CUB, and HPB's `j`), forward (CUF, and
 * HPR's `a`), to a column (CHA, and HPA's backquote), and forward and back by
 * tab stops (CHT, CBT). Back stops at the first column, as on a terminal, and
 * a move past `LAST_COLUMN` stops there, or where the cursor already stands
 * beyond it, so no move turns into one the other way. `\r` is CHA 1 and a
 * backspace CUB 1.
 */
type Move = (column: number, count: number) => number;
const back: Move = (column, count) => column - count;
const forward: Move = (column, count) => column + count;
const to: Move = (_column, count) => count;

const MOTIONS = {
  D: back,
  j: back,
  C: forward,
  a: forward,
  G: to,
  "`": to,
  I: (column, count) => tabStop(Math.floor((column - 1) / TAB_STOP) + count),
  Z: (column, count) => tabStop(Math.ceil((column - 1) / TAB_STOP) - count),
} as const satisfies Record<string, Move>;

type Motion = keyof typeof MOTIONS;

const moved = (column: number, motion: Motion, count: number): number =>
  Math.min(Math.max(LAST_COLUMN, column), Math.max(1, MOTIONS[motion](column, count)));

function* escapeTokens(bytes: string): Generator<Token> {
  let at = 0;
  for (const match of bytes.matchAll(escapes())) {
    const { count, motion, sgr, mode, underscore, struck, underlined } = match.groups!;
    if (match.index > at) yield { kind: "text", text: bytes.slice(at, match.index) };
    if (match[0] === "\r") yield { kind: "move", motion: "G", count: 1 };
    if (motion !== undefined) {
      yield { kind: "move", motion: motion as Motion, count: Number(count) || 1 };
    }
    if (sgr !== undefined) yield { kind: "sgr", params: sgr };
    if (mode !== undefined) yield { kind: "erase", mode: (mode || "0") as EraseMode };
    if (struck !== undefined) yield { kind: "overstrike", character: struck, emphasis: underscore === undefined ? BOLD : BOLD_UNDERLINED };
    if (underlined !== undefined) yield { kind: "overstrike", character: underlined, emphasis: UNDERLINED };
    if (match[0] === "\b") yield { kind: "move", motion: "D", count: 1 };
    at = match.index + match[0].length;
  }
  if (at < bytes.length) yield { kind: "text", text: bytes.slice(at) };
}

// [LAW:one-source-of-truth] OSC 8 is read by the reader `osc8.ts` owns, so
// the terminators a link may end with cannot differ between writing and
// reading it back.
function* tokens(line: string): Generator<Token> {
  let at = 0;
  for (const sequence of osc8Sequences(line)) {
    yield* escapeTokens(line.slice(at, sequence.index));
    yield { kind: "link", uri: sequence.uri };
    at = sequence.index + sequence.length;
  }
  yield* escapeTokens(line.slice(at));
}

/**
 * What one SGR code does to the style. `rest` is the parameters after it; an
 * extended color takes its arguments from there.
 */
type SgrOp = (style: Style, rest: Iterator<number>) => Style;

function adding(options: StyleOptions): SgrOp {
  const added = new Style(options);
  return (style) => style.add(added);
}

function next(rest: Iterator<number>): number | undefined {
  const step = rest.next();
  return step.done ? undefined : step.value;
}

/**
 * `5;n` or `2;r;g;b`, the arguments of `38` and `48`. A sequence cut short
 * names no color, and the codes it did consume are spent, as in Rich.
 */
function extendedColor(rest: Iterator<number>): ColorSpec | undefined {
  const kind = next(rest);
  if (kind === 5) {
    const n = next(rest);
    return n === undefined ? undefined : ColorSpec.fromAnsi(n);
  }
  if (kind === 2) {
    const [r, g, b] = [next(rest), next(rest), next(rest)];
    return b === undefined ? undefined : ColorSpec.fromRgb(r!, g!, b);
  }
  return undefined;
}

// [LAW:dataflow-not-control-flow] Every code is an operation on the style,
// reset included; a code this table does not name is the identity.
const SGR_OPS: ReadonlyMap<number, SgrOp> = new Map<number, SgrOp>([
  [0, () => NULL_STYLE],
  // [LAW:one-source-of-truth] The codes that turn an attribute on are the
  // ones `Style.toSgrCodes` writes; only the codes that turn one off are ours.
  ...ATTRIBUTE_NAMES.map((name): [number, SgrOp] => [ATTRIBUTE_SGR[name], adding({ [name]: true })]),
  // A terminal draws one underline kind, so a single and a double underline
  // each replace the other; Rich's table adds them. Later entries win.
  [ATTRIBUTE_SGR.underline, adding({ underline: true, doubleUnderline: false })],
  [ATTRIBUTE_SGR.doubleUnderline, adding({ underline: false, doubleUnderline: true })],
  [22, adding({ bold: false, dim: false })],
  [23, adding({ italic: false })],
  // ECMA-48: 24 is "neither singly nor doubly underlined", 25 "steady" at
  // either speed. Rich's table clears only the first of each pair.
  [24, adding({ underline: false, doubleUnderline: false })],
  [25, adding({ blink: false, rapidBlink: false })],
  [27, adding({ reverse: false })],
  [28, adding({ conceal: false })],
  [29, adding({ strike: false })],
  [38, (style, rest) => style.add(new Style({ color: extendedColor(rest) }))],
  [39, adding({ color: ColorSpec.default() })],
  [48, (style, rest) => style.add(new Style({ bgcolor: extendedColor(rest) }))],
  [49, adding({ bgcolor: ColorSpec.default() })],
  // Underline color has no field on Style; its arguments are still spent, or
  // `58;2;1;2;3` would read on as bold, dim and italic.
  [58, (style, rest) => (extendedColor(rest), style)],
  [54, adding({ frame: false, encircle: false })],
  [55, adding({ overline: false })],
  ...Array.from({ length: 8 }, (_, n): [number, SgrOp][] => [
    [30 + n, adding({ color: ColorSpec.fromAnsi(n) })],
    [40 + n, adding({ bgcolor: ColorSpec.fromAnsi(n) })],
    [90 + n, adding({ color: ColorSpec.fromAnsi(n + 8) })],
    [100 + n, adding({ bgcolor: ColorSpec.fromAnsi(n + 8) })],
  ]).flat(),
]);

const identity: SgrOp = (style) => style;

const parameter = (code: string): number => Math.min(255, Number(code));

/**
 * The T.416 colon form of an extended color as the `;` arguments `SGR_OPS`
 * reads: `5:n`, `2:r:g:b`, or `2:cs:r:g:b`, whose colour-space slot, empty or
 * not, names no color a terminal draws. The slot is told by count, trailing
 * empty arguments aside since they carry no channel, or by being empty, so it
 * is read before an empty argument becomes 0.
 */
function colorArguments([kind = "", ...args]: readonly string[]): number[] {
  let end = args.length;
  while (end > 0 && args[end - 1] === "") end -= 1;
  const slot = parameter(kind) === 2 && (end > 3 || args[0] === "");
  return [kind, ...args.slice(slot ? 1 : 0, end)].map(parameter);
}

/**
 * A code carrying colon sub-parameters, as the plain code and arguments
 * `SGR_OPS` applies: its arguments are its own, so the codes after it are
 * untouched. `4:n` is an underline's kind; a curly, dotted or dashed one (3–5)
 * is the underline `Style` can hold. A code T.416 gives no sub-parameters is
 * skipped, as is a kind past 5.
 */
function subCode(code: number, subs: readonly string[]): readonly [number, number[]] | undefined {
  if (code === 38 || code === 48 || code === 58) return [code, colorArguments(subs)];
  if (code !== 4) return undefined;
  const kind = parameter(subs[0] ?? "");
  return kind > 5 ? undefined : [kind === 0 ? 24 : kind === 2 ? 21 : 4, []];
}

/**
 * `params` applied to `style`. An empty parameter is 0 and one above 255 is
 * 255. A `;` group with `:` sub-parameters (`4:3`, `38:2::r:g:b`) is one code
 * with its arguments inside it, as T.416 writes it and terminals read it; Rich
 * skips the group. The `;` arguments of `38` stop at such a group.
 */
function applySgr(style: Style, params: string): Style {
  const groups = params.split(";").map((group) => group.split(":"));
  let at = 0;
  // The next group, while it is a plain code; a colon group ends the run.
  const plain = (): IteratorResult<number> => {
    const group = groups[at];
    if (group === undefined || group.length > 1) return { done: true, value: undefined };
    at += 1;
    return { done: false, value: parameter(group[0]!) };
  };
  const rest: Iterator<number> = { next: plain };
  let result = style;
  while (at < groups.length) {
    const [code = "", ...subs] = groups[at++]!;
    if (subs.length === 0) {
      result = (SGR_OPS.get(parameter(code)) ?? identity)(result, rest);
      continue;
    }
    const sub = subCode(parameter(code), subs);
    if (sub !== undefined) result = (SGR_OPS.get(sub[0]) ?? identity)(result, sub[1].values());
  }
  return result;
}

/**
 * What a column holds: a grapheme cluster and its style, or `""` for a further
 * column of a wide one or a tab. Columns count from 1. Index 0 is `ORIGIN`, ahead
 * of the first column, where what has no width and nothing before it to sit on
 * waits for the next cell drawn.
 */
type Cell = readonly [string, Style];

const ORIGIN: Cell = ["", NULL_STYLE];
const BLANK: Cell = [" ", NULL_STYLE];
const TAB_STOP = 8;

/** The column holding the cluster drawn across `column`. */
function leadOf(cells: readonly Cell[], column: number): number {
  let at = column;
  while (at > 0 && cells[at]![0] === "") at -= 1;
  return at;
}

/** A cluster across the edge before `column` goes blank, as on a terminal. */
function splitWide(cells: Cell[], column: number): void {
  if (cells[column]?.[0] !== "") return;
  const lead = leadOf(cells, column);
  for (let at = lead; at === lead || cells[at]?.[0] === ""; at += 1) cells[at] = BLANK;
}

/** `cluster` drawn at `column`, and the columns the cursor moves. */
function draw(cells: Cell[], column: number, cluster: string, style: Style): number {
  // A cursor moved past the drawn end leaves blank cells behind it, and a mark
  // drawn there sits on the blank before it, in that blank's style, as on a
  // terminal.
  while (cells.length < column) cells.push(BLANK);
  const width = cluster === "\t" ? TAB_STOP - ((column - 1) % TAB_STOP) : cellLen(cluster);
  if (width === 0) {
    const lead = leadOf(cells, column - 1);
    cells[lead] = [cells[lead]![0] + cluster, cells[lead]![1]];
    return 0;
  }
  if (cluster === "\t" && column < cells.length) {
    while (cells.length < column + width) cells.push(BLANK);
    return width;
  }
  splitWide(cells, column);
  splitWide(cells, column + width);
  cells[column] = [cells[0]![0] + cluster, style];
  cells[0] = ORIGIN;
  for (let at = 1; at < width; at += 1) cells[column + at] = ["", style];
  return width;
}

/** Erase in line: the cells before the cursor go blank, the ones from it on go. */
function erase(cells: Cell[], column: number, mode: EraseMode): void {
  splitWide(cells, column);
  splitWide(cells, column + 1);
  cells[0] = ORIGIN;
  if (mode !== "0") cells.fill(BLANK, 1, Math.min(column + 1, cells.length));
  if (mode !== "1") cells.length = Math.min(column, cells.length);
}

/**
 * A stateful decoder: the style an escape sets carries on across lines, and
 * across calls, as it does on a terminal. Use one decoder per stream and hand
 * it whole lines, so output read a line at a time decodes as it would have
 * all at once. It buffers nothing: a chunk cut mid-line or mid-escape decodes
 * as the line it appears to be.
 */
export class AnsiDecoder {
  private sgr: Style = NULL_STYLE;
  private link: string | undefined = undefined;

  /** One `RichText` per line of `ansi`; a final newline ends a line rather than starting one. */
  decode(ansi: string): RichText[] {
    const lined = ansi.replace(lineBreaks(), (_found, escape?: string) => escape ?? "\n");
    return (lined.match(/[^\n]*\n|[^\n]+/g) ?? []).map((line) =>
      this.decodeLine(line.replace(/\r?\n$/, "")),
    );
  }

  /**
   * One line of output, holding no `\n`, written the way a terminal writes
   * it: `\r` returns to the first column, and text overwrites from there.
   */
  decodeLine(line: string): RichText {
    const cells: Cell[] = [ORIGIN];
    let column = 1;
    for (const token of tokens(line)) {
      switch (token.kind) {
        case "text": {
          const style = this.sgr.withLink(this.link);
          for (const cluster of graphemes(token.text)) column += draw(cells, column, cluster, style);
          break;
        }
        case "overstrike":
          column += draw(cells, column, token.character, this.sgr.add(token.emphasis).withLink(this.link));
          break;
        case "move":
          column = moved(column, token.motion, token.count);
          break;
        case "erase":
          erase(cells, column, token.mode);
          break;
        case "sgr":
          this.sgr = applySgr(this.sgr, token.params);
          break;
        case "link":
          this.link = token.uri === "" ? undefined : token.uri;
          break;
      }
    }
    const runs: [string, Style][] = [];
    for (const [char, style] of cells.filter(([char]) => char !== "")) {
      const last = runs.at(-1);
      if (last?.[1].equals(style)) last[0] += char;
      else runs.push([char, style]);
    }
    return RichText.assemble(runs);
  }
}

/**
 * `ansi` as one `RichText`, its lines joined by `\n` — Rich's
 * `Text.from_ansi`. `options` describe the result the way they describe any
 * `RichText`.
 */
export function decodeAnsi(ansi: string, options?: RichTextOptions): RichText {
  const result = new RichText("", options);
  new AnsiDecoder().decode(ansi).forEach((line, index) => {
    if (index > 0) result.append("\n");
    result.append(line);
  });
  return result;
}
