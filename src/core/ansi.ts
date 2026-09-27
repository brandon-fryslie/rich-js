/**
 * ANSI bytes back into styled text — a port of Rich's `AnsiDecoder`
 * (rich/ansi.py) and `Text.from_ansi`.
 *
 * The rendering pipeline runs one way, `Style` → SGR bytes; this runs it
 * backwards, for output some program already wrote: a capture of an example's
 * own `new Console()`, a CLI's output shown inside a Panel, a log replayed into
 * a Table cell.
 *
 * [LAW:types-are-the-program] Every colour decodes to the `ColorSpec` its
 * escape names — `31` the standard colour 1, `38;5;n` palette index n,
 * `38;2;r;g;b` that truecolor — and none is resolved to RGB here. A standard
 * colour is a slot in whatever theme draws it, so one captured run exports
 * correctly under a light theme and a dark one; resolved here, dark mode would
 * show light mode's colours. Resolution belongs to `export-lines`.
 *
 * [LAW:types-are-the-program] The link is decoder state of its own, beside
 * the SGR style, not a field of it: a terminal ends a hyperlink only at an OSC
 * 8 close, and an SGR reset inside the link leaves it open. Rich keeps the
 * link in the SGR style, so its reset drops it.
 *
 * Carriage returns are the other departure, and the same argument. Rich splits
 * lines with Python's `splitlines`, which also breaks at `\r`, so its `a\rb`
 * is two lines. Here a line ends only at `\n`, and `\r` returns to the first
 * column, so later text overwrites earlier text character by character:
 * `50%\r100%` is `100%`, `Downloading\rDone` is `Doneloading`, and `done\r`
 * is still `done`. Columns are counted in characters, not cells, so a wide
 * character overwritten by a narrow one is where this and a terminal differ.
 * Erase in line (`\x1b[K`) is honoured for the same reason, because a redraw
 * is usually `\r\x1b[K` and the old text must not show through a shorter new
 * one.
 *
 * Everything else follows Rich: malformed SGR parameters are skipped rather
 * than refused, and every other escape is dropped. It is not a terminal
 * emulator — any other cursor movement is dropped, not performed.
 *
 * Tier 5 of `src/core/`: it builds `RichText`, so it sits above `text`, and
 * `RichText` cannot offer a `fromAnsi` static without importing upward.
 */

import { ColorSpec } from "./color.js";
import { osc8Sequences } from "./osc8.js";
import { ATTRIBUTE_NAMES, ATTRIBUTE_SGR, NULL_STYLE, Style } from "./style.js";
import type { StyleOptions } from "./style.js";
import { RichText } from "./text.js";
import type { RichTextOptions } from "./text.js";

type Token =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "sgr"; readonly params: string }
  | { readonly kind: "link"; readonly uri: string }
  | { readonly kind: "return" }
  | { readonly kind: "erase"; readonly mode: EraseMode };

/** `\x1b[K`'s parameter: 0 erases from the cursor on, 1 up to it, 2 the whole line. */
type EraseMode = "0" | "1" | "2";

/**
 * Every escape but OSC 8, which `osc8Sequences` reads before this runs. In
 * order: a carriage return; an SGR sequence (group 1, its parameters — a
 * private marker such as the `>` of `\x1b[>4;2m` makes it some other CSI);
 * erase in line (group 2, its mode); any other CSI sequence; any other string
 * escape — OSC, DCS, APC, PM, SOS — run to the terminators OSC 8 accepts or
 * cut off by the end of the line; any other escape, ECMA-48's intermediates
 * and one final byte (`\x1b(B`, `\x1b)0`, `\x1b#8`, `\x1bc`). Only the first
 * three become tokens.
 */
const ESCAPE =
  /\r|\x1b\[([0-9;:]*)m|\x1b\[([012]?)K|\x1b\[[0-?]*[ -/]*[@-~]|\x1b[\]P_^X][\s\S]*?(?:\x07|\x1b\\|\x9c|$)|\x1b[ -/]*[0-~]/g;

function* escapeTokens(bytes: string): Generator<Token> {
  let at = 0;
  for (const match of bytes.matchAll(ESCAPE)) {
    if (match.index > at) yield { kind: "text", text: bytes.slice(at, match.index) };
    if (match[0] === "\r") yield { kind: "return" };
    if (match[1] !== undefined) yield { kind: "sgr", params: match[1] };
    if (match[2] !== undefined) yield { kind: "erase", mode: (match[2] || "0") as EraseMode };
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
 * extended colour takes its arguments from there.
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
 * names no colour, and the codes it did consume are spent, as in Rich.
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
  [22, adding({ bold: false, dim: false })],
  [23, adding({ italic: false })],
  // ECMA-48: 24 is "neither singly nor doubly underlined", 25 "steady" at
  // either speed. Rich's table clears only the first of each pair.
  [24, adding({ underline: false, underline2: false })],
  [25, adding({ blink: false, blink2: false })],
  [27, adding({ reverse: false })],
  [28, adding({ conceal: false })],
  [29, adding({ strike: false })],
  [38, (style, rest) => style.add(new Style({ color: extendedColor(rest) }))],
  [39, adding({ color: ColorSpec.default() })],
  [48, (style, rest) => style.add(new Style({ bgcolor: extendedColor(rest) }))],
  [49, adding({ bgcolor: ColorSpec.default() })],
  // Underline colour has no field on Style; its arguments are still spent, or
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

/**
 * `params` applied to `style`. An empty parameter is 0 and one above 255 is
 * 255; one that is not a number — a colon sub-parameter — is skipped, as in
 * Rich.
 */
function applySgr(style: Style, params: string): Style {
  const codes = params
    .split(";")
    .filter((code) => /^\d*$/.test(code))
    .map((code) => Math.min(255, Number(code)))
    .values();
  let result = style;
  for (const code of codes) result = (SGR_OPS.get(code) ?? identity)(result, codes);
  return result;
}

const BLANK: [string, Style] = [" ", NULL_STYLE];

/** Erase in line: the cells before the cursor go blank, the ones from it on go. */
function erase(cells: [string, Style][], column: number, mode: EraseMode): void {
  if (mode !== "0") cells.fill(BLANK, 0, Math.min(column + 1, cells.length));
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
    return (ansi.match(/[^\n]*\n|[^\n]+/g) ?? []).map((line) =>
      this.decodeLine(line.replace(/\r?\n$/, "")),
    );
  }

  /**
   * One line of output, holding no `\n`, written the way a terminal writes
   * it: `\r` returns to the first column, and text overwrites from there.
   */
  decodeLine(line: string): RichText {
    const cells: [string, Style][] = [];
    let column = 0;
    for (const token of tokens(line)) {
      switch (token.kind) {
        case "text": {
          const style = this.sgr.withLink(this.link);
          for (const char of token.text) cells[column++] = [char, style];
          break;
        }
        case "return":
          column = 0;
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
    for (const [char, style] of cells) {
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
