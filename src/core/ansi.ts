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
 * is two lines. Here a line ends only at `\n` (or `\r\n`), and the text after
 * a line's last `\r` replaces the text before it, as a progress bar redrawing
 * in place looks on a terminal; codes before the `\r` still style what follows.
 *
 * Everything else follows Rich: malformed SGR parameters are skipped rather
 * than refused, and every other escape is dropped. It is not a terminal
 * emulator — cursor movement is dropped, not performed.
 *
 * Tier 5 of `src/core/`: it builds `RichText`, so it sits above `text`, and
 * `RichText` cannot offer a `fromAnsi` static without importing upward.
 */

import { ColorSpec } from "./color.js";
import { osc8Sequences } from "./osc8.js";
import { NULL_STYLE, Style } from "./style.js";
import type { StyleOptions } from "./style.js";
import { RichText } from "./text.js";
import type { RichTextOptions } from "./text.js";

type Token =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "sgr"; readonly params: string }
  | { readonly kind: "link"; readonly uri: string }
  | { readonly kind: "return" };

/**
 * Every escape but OSC 8, which `osc8Sequences` reads before this runs. In
 * order: a carriage return; an SGR sequence (group 1, its parameters); any
 * other CSI sequence; any other OSC sequence, with the terminators OSC 8
 * accepts; a charset designation, which carries one more byte; any other
 * two-byte escape. Only the first two become tokens.
 */
const ESCAPE =
  /\r|\x1b\[([0-?]*)m|\x1b\[[0-?]*[ -/]*[@-~]|\x1b\][^\x07\x1b\x9c]*(?:\x07|\x1b\\|\x9c)|\x1b\([\s\S]?|\x1b[0-?@-Z\\-_]/g;

function* escapeTokens(bytes: string): Generator<Token> {
  let at = 0;
  for (const match of bytes.matchAll(ESCAPE)) {
    if (match.index > at) yield { kind: "text", text: bytes.slice(at, match.index) };
    if (match[0] === "\r") yield { kind: "return" };
    if (match[1] !== undefined) yield { kind: "sgr", params: match[1] };
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

const adding =
  (options: StyleOptions): SgrOp =>
  (style) =>
    style.add(new Style(options));

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
  [1, adding({ bold: true })],
  [2, adding({ dim: true })],
  [3, adding({ italic: true })],
  [4, adding({ underline: true })],
  [5, adding({ blink: true })],
  [6, adding({ blink2: true })],
  [7, adding({ reverse: true })],
  [8, adding({ conceal: true })],
  [9, adding({ strike: true })],
  [21, adding({ underline2: true })],
  [22, adding({ bold: false, dim: false })],
  [23, adding({ italic: false })],
  [24, adding({ underline: false })],
  [25, adding({ blink: false })],
  [26, adding({ blink2: false })],
  [27, adding({ reverse: false })],
  [28, adding({ conceal: false })],
  [29, adding({ strike: false })],
  [38, (style, rest) => style.add(new Style({ color: extendedColor(rest) }))],
  [39, adding({ color: ColorSpec.default() })],
  [48, (style, rest) => style.add(new Style({ bgcolor: extendedColor(rest) }))],
  [49, adding({ bgcolor: ColorSpec.default() })],
  [51, adding({ frame: true })],
  [52, adding({ encircle: true })],
  [53, adding({ overline: true })],
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
 * 255; one that is not a number — a colon sub-parameter, a private marker —
 * is skipped, as in Rich.
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

/**
 * A stateful decoder: the style an escape sets carries on across lines, and
 * across calls, as it does on a terminal. Use one decoder per stream, so
 * output read a line at a time decodes as it would have all at once.
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

  /** One line of output, holding no `\n`. */
  decodeLine(line: string): RichText {
    let pieces: [string, Style][] = [];
    for (const token of tokens(line)) {
      switch (token.kind) {
        case "text":
          pieces.push([token.text, this.sgr.withLink(this.link)]);
          break;
        case "return":
          pieces = [];
          break;
        case "sgr":
          this.sgr = applySgr(this.sgr, token.params);
          break;
        case "link":
          this.link = token.uri === "" ? undefined : token.uri;
          break;
      }
    }
    return RichText.assemble(pieces);
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
