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
 * Character sets are the fifth. Rich drops `\x1b(0`; it changes which glyph a
 * byte draws, so dropping it shows `qqq` where a terminal draws `───`. The
 * decoder holds G0 and G1 (`\x1b(F`, `\x1b)F`) and which SO and SI have shifted
 * in, across lines and calls as it holds the SGR style, and draws text in that
 * set (`CHARSETS`).
 *
 * CNL is the sixth. Rich drops `\x1b[E`, gluing the text after it to the line
 * before; here it ends the line, once whatever its count, since the decoder
 * holds no cursor row or screen height to count rows against (`CNL`). CPL goes
 * up to a line already decoded, so it stays dropped.
 *
 * Saving the cursor is the seventh. Rich drops `\x1b7` and `\x1b8` (and
 * `\x1b[s`, `\x1b[u`), which curses and `tput sc`/`rc` write, so text drawn
 * after a restore lands after what it overwrote. Here a save holds what a
 * terminal's does — the column, the SGR style and the sets — and a restore
 * brings them back (`CURSOR_SAVE`, `CURSOR_RESTORE`). The column comes back only on the line it
 * was saved on: on a later one it names a row the decoder no longer holds, as
 * CPL does.
 *
 * REP is the eighth. Rich drops `\x1b[3b`, which ncurses writes for a run of one
 * character, so a box's border comes out short. Here it draws the graphic
 * character just before it that many more times, up to the right margin as a
 * move forward stops there; after any control function, REP included, there is
 * no preceding graphic character and it draws nothing, as ECMA-48 reads it
 * (`repeatable`).
 *
 * Everything else follows Rich: malformed SGR parameters are skipped rather
 * than refused, and every other escape is dropped, with every control a terminal
 * draws nothing for. It is not a terminal emulator: movement along the line
 * (`MOTIONS`) moves the column as `\r` and a backspace do, since a redraw writes
 * `\x1b[2D` as readily as two backspaces, and the line editor's edits beside it
 * (`EDITS`) erase, delete and insert cells; every other cursor movement but
 * CNL's and a restore's is dropped, not performed. The right margin is the decoder's `width`.
 *
 * Tier 5 of `src/core/`: it builds `RichText`, so it sits above `text`, and
 * `RichText` cannot offer a `fromAnsi` static without importing upward.
 */

import { cellLen, graphemes } from "./cells.js";
import { ColorSpec } from "./color.js";
import { CONTROL_CODES, controlClass } from "./control-codes.js";
import { osc8Sequences, STRING_STOPS } from "./osc8.js";
import { pattern } from "./pattern.js";
import { ATTRIBUTE_NAMES, ATTRIBUTE_SGR, NULL_STYLE, Style } from "./style.js";
import type { StyleOptions } from "./style.js";
import { RichText } from "./text.js";
import type { RichTextOptions } from "./text.js";

type Token =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "sgr"; readonly params: string }
  | { readonly kind: "link"; readonly uri: string }
  | { readonly kind: "designate"; readonly set: 0 | 1; readonly charset: Charset }
  /** DECSTR (`soft`) resets the style and the sets; RIS also ends a link and clears the screen. */
  | { readonly kind: "reset"; readonly soft: boolean; readonly escape: string }
  | { readonly kind: "shift"; readonly set: 0 | 1 }
  | { readonly kind: "overstrike"; readonly character: string; readonly emphasis: Style }
  | { readonly kind: "move"; readonly motion: Motion; readonly count: number }
  | { readonly kind: "edit"; readonly edit: Edit; readonly count: number }
  | { readonly kind: "erase"; readonly mode: EraseMode }
  /** DECSC or SCOSC (`save`), DECRC or SCORC (not). */
  | { readonly kind: "cursor"; readonly save: boolean; readonly escape: string }
  /** REP: the graphic character drawn just before it, `count` more times. */
  | { readonly kind: "repeat"; readonly count: number; readonly escape: string }
  /** A control a terminal draws nothing for either; it still comes between a character and a REP. */
  | { readonly kind: "silent" }
  /** An escape a terminal performs and the decoder does not: a move off the line, a mode, a title, a C1 control. */
  | { readonly kind: "undrawn"; readonly escape: string };

/** `\x1b[K`'s parameter: 0 erases from the cursor on, 1 up to it, 2 the whole line. */
type EraseMode = "0" | "1" | "2";

const BOLD = new Style({ bold: true });
const UNDERLINED = new Style({ underline: true });
const BOLD_UNDERLINED = BOLD.add(UNDERLINED);

// A C1 introducer is its ESC form's final byte plus 0x40 (ECMA-48 §5.3), and a
// terminal that reads C1 reads it as that ESC form (`docs/control-codes.md`).
const hex = (codes: readonly number[]): string => codes.map((code) => `\\x${code.toString(16).padStart(2, "0")}`).join("");
/** ECMA-48's C1 set, U+0080 to U+009F. */
const isC1 = (code: number): boolean => code >= 0x80 && code <= 0x9f;
const finals = (introducers: string): number[] => [...introducers].map((final) => final.charCodeAt(0));
const either = (introducers: string): string => {
  const codes = finals(introducers);
  return `(?:\\x1b[${hex(codes)}]|[${hex(codes.map((code) => code + 0x40))}])`;
};
const CSI = either("[");
// OSC, DCS, APC, PM, SOS. As the VT500 parser C1-reading terminals follow, the
// payload ends at a terminator, which it takes, or before an ESC or any C1
// control, NEL among them, which then acts as itself, or before a CAN or SUB,
// which aborts it so what follows draws. The parser ignores the
// other C0 controls there, so a form feed stays in the payload; a line feed ends
// it, the cut a capture's line makes. A stray C1 byte that is windows-1252 read
// as Latin-1 decodes as such a terminal shows it; no rule local to the byte can
// tell the two apart, so repairing it is the caller's.
const STRING_ESCAPE = String.raw`${either("]P_^X")}[^${STRING_STOPS}\n]*(?:\x07|\x1b\\|\x9c)?`;

// The ESC form of each C1 control `CONTROL_CODES` breaks a line at: `ESC E`, NEL.
const ESC_LINE_BREAKS = hex(
  CONTROL_CODES.filter((row) => row.disposition === "line-break").flatMap((row) =>
    Array.from({ length: row.last - row.first + 1 }, (_, at) => row.first + at).filter(isC1),
  ).map((code) => code - 0x40),
);

const TAB_STOP = 8;

const tabStop = (index: number): number => index * TAB_STOP + 1;

/**
 * ECMA-48's moves along the line, by final byte, for a count of at least 1, as
 * an absent or zero parameter is: back (CUB, and HPB's `j`), forward (CUF, and
 * HPR's `a`), to a column (CHA, and HPA's backquote), and forward and back by
 * tab stops (CHT, CBT). Back stops at the first column and forward at the
 * decoder's right margin, or where the cursor already stands past it, so no
 * move turns into one the other way. `\r` is CHA 1 and a backspace CUB 1.
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

const moved = (column: number, motion: Motion, count: number, margin: number): number =>
  Math.min(Math.max(margin, column), Math.max(1, MOTIONS[motion](column, count)));

/**
 * ECMA-48's edits of the line at the cursor, by final byte, which a line editor
 * pairs with the moves: erase `count` cells to blanks (ECH), delete them and
 * pull the rest left (DCH), and insert blanks pushing the rest right (ICH).
 */
const EDITS = { X: eraseCells, P: deleteCells, "@": insertCells } as const satisfies Record<
  string,
  (cells: Cell[], column: number, count: number, margin: number) => void
>;

type Edit = keyof typeof EDITS;

/**
 * Save and restore the cursor: DECSC `\x1b7` and DECRC `\x1b8`, and SCOSC
 * `\x1b[s` and SCORC `\x1b[u`, each exactly — with parameters `s` is DECSLRM's
 * margins, and `u` with a parameter or a marker is kitty's keyboard protocol,
 * both left to the undrawn "any other CSI". `\x1b#8` carries an intermediate, so
 * it is not `\x1b8`.
 */
const CURSOR_SAVE = String.raw`\x1b7|${CSI}s`;
const CURSOR_RESTORE = String.raw`\x1b8|${CSI}u`;

const finalClass = (table: object): string => `[${hex(finals(Object.keys(table).join("")))}]`;

const REPEAT_FINAL = "b";

/**
 * Whether REP repeats `cluster`, the last one drawn before it with no control
 * function between: a graphic character, so one that takes a cell. A tab moves
 * the cursor, and a mark with nothing under it takes none.
 */
const repeatable = (cluster: string): boolean => cluster !== "\t" && !/\p{Cc}/u.test(cluster) && cellLen(cluster) > 0;

/**
 * Every escape but OSC 8, which `osc8Sequences` reads before this runs. In
 * order — each CSI and string escape in its `ESC` form or its C1 one — a
 * carriage return; a cursor save (`save`) or restore (`restore`), ahead of the
 * "any other" CSI and escape that would otherwise take them; a move along the line (`motion`) or an edit of it (`edit`),
 * or REP (`repeat`), each reading the first parameter (`count`) as a terminal does; an SGR sequence (`sgr`, its parameters — a private
 * marker such as the `>` of `\x1b[>4;2m` makes it some other CSI); erase in line
 * (`mode`); a soft reset, DECSTR, or a full reset, RIS (`reset`); a G0 or G1
 * designation (`designate`, its `charset`, such as `\x1b(B` or `\x1b)0`); the
 * undrawn escapes (`undrawn`) — any other CSI sequence, any other string escape
 * (OSC, DCS, APC, PM, SOS) run to a terminator or cut off where `STRING_ESCAPE`
 * says, and any other escape, ECMA-48's intermediates and one final byte
 * (`\x1b#8`, `\x1b(%5`); a character struck over itself (`struck`), over an
 * underscore first or not (`underscore`); a character struck over an underscore
 * alone (`underlined`); a backspace; SO or SI (`shift`); and every control a line
 * may not hold or a terminal draws nothing for (`control`): undrawn when it is an
 * ESC that starts no escape or a C1 control, which a terminal performs, and silent
 * otherwise.
 */
const ESCAPES = [
  String.raw`\r|(?<save>${CURSOR_SAVE})|(?<restore>${CURSOR_RESTORE})|${CSI}(?<count>[0-9]*)(?:;[0-9;]*)?(?:(?<motion>${finalClass(MOTIONS)})|(?<edit>${finalClass(EDITS)})|(?<repeat>${REPEAT_FINAL}))|${CSI}(?<sgr>[0-9;:]*)m|${CSI}(?<mode>[012]?)K|(?<reset>${CSI}!p|\x1bc)|\x1b(?<designate>[()])(?<charset>[0-~])|(?<undrawn>${CSI}[0-?]*[ -/]*[@-~]|${STRING_ESCAPE}|\x1b[ -/]*[0-~])|(?<shift>[\x0e\x0f])`,
  String.raw`(?<underscore>_\x08)?(?<struck>\P{Cc})(?:\x08\k<struck>)+|_\x08(?<underlined>\P{Cc})|\x08`,
  `(?<control>${controlClass((disposition) => disposition !== "keep" && disposition !== "zeroWidth")})`,
].join("|");

const escapes = (): RegExp => new RegExp(ESCAPES, "gu");

// CNL after its introducer. On a terminal it passes `count` rows, or none on
// the bottom row, where it does not scroll; the decoder holds no cursor row and
// no screen height, so no count has an answer it could give, and CNL decodes as
// NEL does: what follows is on a line of its own. Its count (`rows`) is read
// once, by the same match.
const CNL = "(?<rows>[0-9]*)(?:;[0-9;]*)?E";

/**
 * Everything `decode` ends a line at, `\n`, C1 forms and the census's
 * line-break controls (`census`) included.
 */
const LINE_ENDS = `\\n|${CSI}${CNL}|\\x1b[${ESC_LINE_BREAKS}]|(?<census>${controlClass((disposition) => disposition === "line-break")})`;

// A string escape goes first so a line break its payload holds stays in it.
const lineBreaks = (): RegExp => new RegExp(`(${STRING_ESCAPE})|${LINE_ENDS}`, "gu");

/**
 * An escape begun at the end of the bytes and not yet complete, cut from the
 * same pieces as `ESCAPES`: a CSI so far parameters and intermediates, a string
 * escape short of its terminator (an ESC at its end may be the first byte of
 * ST), or an ESC so far only intermediates.
 */
const OPEN_ESCAPE = pattern(new RegExp(String.raw`(?:${CSI}[0-?]*[ -/]*|${either("]P_^X")}[^${STRING_STOPS}\n]*\x1b?|\x1b[ -/]*)$`, "u"));

/**
 * Whether a terminal performs `control`, one `ESCAPES` matched alone, and
 * `next` the character after it: a C1 control, which some terminals do, and an
 * ESC no escape here begins. A VT500 parser stays in its escape state past such
 * an ESC, running a C0 control and ignoring DEL there, and takes a later byte as
 * the escape's final, which the decoder draws as text. Only the next ESC, CAN,
 * SUB or C1 control cancels it, and then a terminal drops it as the decoder does.
 */
const performed = (control: string, next: string): boolean =>
  isC1(control.charCodeAt(0)) || (control === "\x1b" && !/^[\x1b\x18\x1a]/.test(next) && !isC1(next.charCodeAt(0)));

/** `bytes`, and `following`, the character after them in their line, which an ESC at their end comes before. */
function* escapeTokens(bytes: string, following: string): Generator<Token> {
  let at = 0;
  for (const match of bytes.matchAll(escapes())) {
    const { save, restore, count, motion, edit, repeat, sgr, mode, reset, designate, charset, undrawn, control, shift, underscore, struck, underlined } = match.groups!;
    const escape = match[0];
    if (match.index > at) yield { kind: "text", text: bytes.slice(at, match.index) };
    const next = bytes[match.index + escape.length] ?? following;
    if (undrawn !== undefined || (control !== undefined && performed(control, next))) yield { kind: "undrawn", escape };
    else if (control !== undefined) yield { kind: "silent" };
    if (escape === "\r") yield { kind: "move", motion: "G", count: 1 };
    if (save !== undefined || restore !== undefined) yield { kind: "cursor", save: save !== undefined, escape };
    if (motion !== undefined) yield { kind: "move", motion: motion as Motion, count: Number(count) || 1 };
    if (edit !== undefined) yield { kind: "edit", edit: edit as Edit, count: Number(count) || 1 };
    if (repeat !== undefined) yield { kind: "repeat", count: Number(count) || 1, escape };
    if (sgr !== undefined) yield { kind: "sgr", params: sgr };
    if (reset !== undefined) yield { kind: "reset", soft: reset !== "\x1bc", escape };
    if (designate !== undefined) yield { kind: "designate", set: designate === "(" ? 0 : 1, charset: charsetOf(charset!) };
    if (shift !== undefined) yield { kind: "shift", set: shift === "\x0e" ? 1 : 0 };
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
/** `line`, and `following`, what comes after it in the bytes: the break that ends it, or nothing. */
function* tokens(line: string, following: string): Generator<Token> {
  let at = 0;
  for (const sequence of osc8Sequences(line)) {
    yield* escapeTokens(line.slice(at, sequence.index), line[sequence.index]!);
    yield { kind: "link", uri: sequence.uri };
    at = sequence.index + sequence.length;
  }
  yield* escapeTokens(line.slice(at), following.charAt(0));
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

/** ECH: `count` cells from the cursor go blank; reaching the line's end, they go. */
function eraseCells(cells: Cell[], column: number, count: number): void {
  splitWide(cells, column);
  splitWide(cells, column + count);
  if (column + count >= cells.length) cells.length = Math.min(column, cells.length);
  else cells.fill(BLANK, column, column + count);
}

/** DCH: `count` cells from the cursor go, and the rest of the line moves left. */
function deleteCells(cells: Cell[], column: number, count: number): void {
  splitWide(cells, column);
  splitWide(cells, column + count);
  cells.splice(column, count);
}

/**
 * ICH: `count` blanks at the cursor, the rest of the line moving right, and
 * what that pushes past the right margin lost, as on a terminal. A line drawn
 * past the margin already keeps what it had.
 */
function insertCells(cells: Cell[], column: number, count: number, margin: number): void {
  if (column >= cells.length) return;
  const end = Math.max(margin + 1, cells.length);
  splitWide(cells, column);
  cells.splice(column, 0, ...Array.from({ length: Math.min(count, end - column) }, () => BLANK));
  splitWide(cells, end);
  cells.length = Math.min(cells.length, end);
}

/**
 * The glyphs a 94-character set draws in place of ASCII, by its designation's
 * final byte: DEC Special Graphics (`0`), the line drawing tmux, ncurses and
 * dialog write, and the United Kingdom set (`A`), whose one change is `#` for
 * `£`. A final this does not name is ASCII, as `B` is, since every other set
 * is a national one no capture this decodes has been seen to use.
 */
const CHARSETS: { readonly [set in "B" | "0" | "A"]: ReadonlyMap<string, string> } = {
  B: new Map(),
  "0": new Map(
    [..."_`abcdefghijklmnopqrstuvwxyz{|}~"].map((ascii, at) => [
      ascii,
      " ◆▒␉␌␍␊°±␤␋┘┐┌└┼⎺⎻─⎼⎽├┤┴┬│≤≥π≠£·"[at]!,
    ]),
  ),
  A: new Map([["#", "£"]]),
};

type Charset = keyof typeof CHARSETS;

const charsetOf = (final: string): Charset => (Object.hasOwn(CHARSETS, final) ? (final as Charset) : "B");

/** `text` as the character set `charset` draws it. */
function drawnIn(charset: Charset, text: string): string {
  const glyphs = CHARSETS[charset];
  return glyphs.size === 0 ? text : text.replace(/[\x21-\x7e]/g, (ascii) => glyphs.get(ascii) ?? ascii);
}

/**
 * The right margin a decoder moves the cursor against when none is given: the
 * width `Console` falls back to when it cannot read a terminal's.
 */
const DEFAULT_WIDTH = 80;

/** What a cursor save holds of the stream beside its column: the style and the sets. */
interface Rendition {
  readonly sgr: Style;
  readonly sets: readonly [Charset, Charset];
  readonly shifted: 0 | 1;
}

/** What a restore with nothing saved brings back, and what a reset leaves saved. */
const DEFAULT_RENDITION: Rendition = { sgr: NULL_STYLE, sets: ["B", "B"], shifted: 0 };

/**
 * What a line holds for bytes written later on it: the cursor's column, the
 * column a save on it holds, and the graphic character drawn last with nothing
 * after it, which a REP repeats.
 */
export interface LineState {
  readonly column: number;
  readonly savedColumn: number | undefined;
  readonly last: readonly [string, Style] | undefined;
}

/** A line nothing has been written on. */
export const LINE_START: LineState = { column: 1, savedColumn: undefined, last: undefined };

/** A line drawn: its cells, what it holds for bytes written after it, and the first escape on it no terminal draws this way. */
interface DrawnLine {
  readonly cells: readonly Cell[];
  readonly end: LineState;
  readonly undrawn: string | undefined;
}

/** What a decoder knows of the terminal that drew its bytes. */
export interface AnsiDecoderOptions {
  /**
   * The terminal's width in cells, its right margin: a move forward stops there,
   * so `\x1b[999C` reaches the right edge as it does on a terminal. Text runs
   * past it, since a captured line has not been wrapped. A positive whole
   * number, since a REP draws up to it; default 80.
   */
  readonly width?: number;
}

/**
 * A stateful decoder: the style an escape sets carries on across lines, and
 * across calls, as it does on a terminal. Use one decoder per stream and hand
 * it whole lines, so output read a line at a time decodes as it would have
 * all at once. It buffers nothing: a chunk cut mid-line or mid-escape decodes
 * as the line it appears to be.
 */
export class AnsiDecoder {
  private readonly stream: Stream;

  constructor(options: AnsiDecoderOptions = {}) {
    this.stream = streamOf(options.width ?? DEFAULT_WIDTH);
  }

  /** One `RichText` per line of `ansi`; a final newline ends a line rather than starting one. */
  decode(ansi: string): RichText[] {
    const { ended, last } = linesOf(ansi);
    const lines = ended.map(({ line, end }) => drawLine(this.stream, line, LINE_START, end));
    if (last !== "") lines.push(drawLine(this.stream, last, LINE_START, ""));
    return lines.map(({ cells }) => assembled(cells));
  }

  /**
   * One line of output, holding no `\n`, written the way a terminal writes
   * it: `\r` returns to the first column, and text overwrites from there.
   */
  decodeLine(line: string): RichText {
    return assembled(drawLine(this.stream, line, LINE_START, "").cells);
  }
}

/** What a stream's escapes set that carries on across its lines, as it does on a terminal. */
interface Stream {
  sgr: Style;
  link: string | undefined;
  readonly width: number;
  /** G0 and G1, each a designation's final byte, and which of them SO and SI have shifted in. */
  readonly sets: [Charset, Charset];
  shifted: 0 | 1;
  /** The rendition a cursor save holds; its column is the line's own (`LineState`). */
  saved: Rendition;
}

function streamOf(width: number): Stream {
  if (!Number.isInteger(width) || width < 1) throw new RangeError(`AnsiDecoder width must be a positive whole number of cells, got ${width}`);
  return { sgr: NULL_STYLE, link: undefined, width, sets: ["B", "B"], shifted: 0, saved: DEFAULT_RENDITION };
}

/**
 * [LAW:one-source-of-truth] Each line of `ansi` as `decode` draws it and the
 * break that ends it, the last line ended by none; a break inside a string
 * escape's payload ends nothing. `decode` and `scanUndrawn` both split here.
 *
 * Each break also says whether a terminal performs it as the decoder does, CR
 * LF (`relocates`). LF does, as a terminal's output translation writes it,
 * and so do NEL, which is CR LF, and a CNL of one row. VT and FF go down a row
 * and keep the column, LS and PS move nothing, and a CNL of more rows passes
 * rows the decoder, ending its line once, never draws.
 */
function linesOf(ansi: string): { readonly ended: readonly EndedLine[]; readonly last: string } {
  const ended: EndedLine[] = [];
  let start = 0;
  for (const found of ansi.matchAll(lineBreaks())) {
    if (found[1] !== undefined) continue;
    const { census, rows } = found.groups!;
    const relocates = (census !== undefined && census !== "\x85") || Number(rows) > 1;
    ended.push({ line: ansi.slice(start, found.index), end: found[0], relocates });
    start = found.index + found[0].length;
  }
  return { ended, last: ansi.slice(start) };
}

/** A line and the break that ends it. */
interface EndedLine {
  readonly line: string;
  readonly end: string;
  /** Whether a terminal performs `end` other than as CR LF, where the decoder starts the next line. */
  readonly relocates: boolean;
}

/**
 * `line` drawn after `start`, what the same line held before it. The branches
 * that decide what the decoder does with a restore, a REP and RIS also say
 * whether a terminal does the same, so the gate that reads `undrawn` reads
 * the decoder's own rule (`scanUndrawn`).
 */
function drawLine(stream: Stream, line: string, start: LineState, following: string): DrawnLine {
  const cells: Cell[] = [ORIGIN];
  let column = start.column;
  // A column saved on this line; a save on another names a row this one is not.
  let savedColumn = start.savedColumn;
  // The graphic character drawn last and its style, while nothing has come
  // after it: ECMA-48's REP repeats "the preceding graphic character", and a
  // control function in between leaves it none.
  let last = start.last;
  let undrawn: string | undefined = undefined;
  const report = (escape: string): void => {
    undrawn ??= escape;
  };
  for (const token of tokens(line, following)) {
    const preceding = last;
    last = undefined;
    switch (token.kind) {
      case "text": {
        const style = stream.sgr.withLink(stream.link);
        const text = drawnIn(stream.sets[stream.shifted], token.text);
        const clusters = graphemes(text);
        for (const cluster of clusters) column += draw(cells, column, cluster, style);
        // Within the text the segmenter has joined all it can. A mark it joins
        // to the cluster an earlier write drew finishes that cluster; whatever
        // it does not join, a ZWSP or a variation selector after a space, is no
        // graphic character of its own.
        const final = clusters.at(-1)!;
        if (clusters.length === 1 && preceding !== undefined && cellLen(final) === 0 && graphemes(preceding[0] + final).length === 1) {
          last = [preceding[0] + final, preceding[1]];
        } else if (repeatable(final)) last = [final, style];
        break;
      }
      case "repeat": {
        if (preceding === undefined) {
          report(token.escape);
          break;
        }
        const width = cellLen(preceding[0]);
        // A terminal wraps what passes the right margin onto the next row; the
        // decoder holds one row, so the repeats stop at the margin, or where
        // the cursor already stands past it, as a move forward does, and the
        // cut is one no terminal makes.
        const room = Math.floor(Math.max(0, stream.width - (column - 1)) / width);
        if (token.count > room) report(token.escape);
        for (let at = 0; at < Math.min(token.count, room); at += 1) column += draw(cells, column, ...preceding);
        break;
      }
      case "overstrike": {
        // Overstrike is nroff's, and nroff writes ASCII; a glyph struck over
        // itself only overwrites the earlier, as on a terminal.
        const character = drawnIn(stream.sets[stream.shifted], token.character);
        const emphasis = character === token.character ? token.emphasis : NULL_STYLE;
        column += draw(cells, column, character, stream.sgr.add(emphasis).withLink(stream.link));
        // The emphasis is this decoder's reading of the overstrike; a terminal repeats the character in the SGR style.
        if (repeatable(character)) last = [character, stream.sgr.withLink(stream.link)];
        break;
      }
      case "reset":
        stream.sgr = NULL_STYLE;
        stream.sets.fill("B");
        stream.shifted = 0;
        stream.saved = DEFAULT_RENDITION;
        savedColumn = undefined;
        if (token.soft) break;
        // A terminal also clears its screen, which the decoder holds none of.
        report(token.escape);
        stream.link = undefined;
        cells.length = 1;
        cells[0] = ORIGIN;
        column = 1;
        break;
      case "designate":
        stream.sets[token.set] = token.charset;
        break;
      case "shift":
        stream.shifted = token.set;
        break;
      case "move":
        column = moved(column, token.motion, token.count, stream.width);
        // A mark waiting at the origin had nothing to sit on; moved away, it never will.
        if (column !== 1) cells[0] = ORIGIN;
        break;
      case "edit":
        EDITS[token.edit](cells, column, token.count, stream.width);
        break;
      case "erase":
        erase(cells, column, token.mode);
        break;
      case "cursor":
        if (token.save) {
          stream.saved = { sgr: stream.sgr, sets: [...stream.sets], shifted: stream.shifted };
          savedColumn = column;
          break;
        }
        // With nothing saved on this line a terminal homes the cursor or goes
        // up to the saved row, and the decoder holds no row to do either.
        if (savedColumn === undefined) report(token.escape);
        stream.sgr = stream.saved.sgr;
        stream.sets.splice(0, 2, ...stream.saved.sets);
        stream.shifted = stream.saved.shifted;
        column = savedColumn ?? column;
        if (column !== 1) cells[0] = ORIGIN;
        break;
      case "sgr":
        stream.sgr = applySgr(stream.sgr, token.params);
        break;
      case "link":
        stream.link = token.uri === "" ? undefined : token.uri;
        break;
      case "undrawn":
        report(token.escape);
        break;
      case "silent":
        break;
    }
  }
  return { cells, end: { column, savedColumn, last }, undrawn };
}

/** A line's cells as the text they show, a run per style. */
function assembled(cells: readonly Cell[]): RichText {
  const runs: [string, Style][] = [];
  for (const [char, style] of cells.filter(([char]) => char !== "")) {
    const run = runs.at(-1);
    if (run?.[1].equals(style)) run[0] += char;
    else runs.push([char, style]);
  }
  return RichText.assemble(runs);
}


/** Bytes a program wrote, read for the escapes a drawing of them performs as no terminal would. */
export interface UndrawnScan {
  /** The first escape the decoder draws other than a terminal does; null when there is none. */
  readonly undrawn: string | null;
  /** Where an escape starts that is not yet complete, to be read once the rest of it is written; the length of the bytes when none does. */
  readonly unread: number;
  /** What the line the bytes end on holds for the next write. */
  readonly after: LineState;
}

/**
 * [LAW:one-source-of-truth] The escapes in `bytes` the decoder does not
 * perform as a terminal does, read by the decoder itself: its own line breaks,
 * so one inside a string escape's payload ends nothing, and its own branches.
 * `before` is what the line held when an earlier write on it ended, so a stream
 * read write by write reads as it does whole; only the complete bytes are read.
 */
export function scanUndrawn(bytes: string, before: LineState = LINE_START, width: number = DEFAULT_WIDTH): UndrawnScan {
  const open = OPEN_ESCAPE.exec(bytes);
  const unread = open === null ? bytes.length : open.index;
  const complete = bytes.slice(0, unread);
  const stream = streamOf(width);
  let undrawn: string | undefined = undefined;
  let state = before;
  // The first line continues the one `before` ended on, and each after it starts fresh.
  const { ended, last } = linesOf(complete);
  for (const { line, end, relocates } of ended) {
    undrawn ??= drawLine(stream, line, state, end).undrawn;
    if (relocates) undrawn ??= end;
    state = LINE_START;
  }
  // What follows the last line is the escape left unread, if any.
  const drawn = drawLine(stream, last, state, bytes.slice(unread));
  return { undrawn: undrawn ?? drawn.undrawn ?? null, unread, after: drawn.end };
}

/**
 * `ansi` as one `RichText`, its lines joined by `\n` — Rich's
 * `Text.from_ansi`. `options` describe the result the way they describe any
 * `RichText`, and `width` is the decoder's (`AnsiDecoderOptions`).
 */
export function decodeAnsi(ansi: string, options: RichTextOptions & AnsiDecoderOptions = {}): RichText {
  const { width, ...textOptions } = options;
  const result = new RichText("", textOptions);
  new AnsiDecoder(width === undefined ? {} : { width }).decode(ansi).forEach((line, index) => {
    if (index > 0) result.append("\n");
    result.append(line);
  });
  return result;
}
