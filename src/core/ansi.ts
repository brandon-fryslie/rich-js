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
 * holds no cursor row or screen height to count rows against (`completed`). CPL goes
 * up to a line already decoded, so it stays dropped.
 *
 * Saving the cursor is the seventh. Rich drops `\x1b7` and `\x1b8` (and
 * `\x1b[s`, `\x1b[u`), which curses and `tput sc`/`rc` write, so text drawn
 * after a restore lands after what it overwrote. Here a save holds what a
 * terminal's does — the column, the SGR style and the sets — and a restore
 * brings them back (`escapeToken`, `csiToken`). The column comes back only on the line it
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
import { CONTROL_CODES, controlClass, dispositionOf } from "./control-codes.js";
import { ABORTS, osc8Sequences, STRING_STOPS } from "./osc8.js";
import { pattern } from "./pattern.js";
import { ATTRIBUTE_NAMES, ATTRIBUTE_SGR, NULL_STYLE, Style, UNDERLINE, UNDERLINE_KINDS, type Underline } from "./style.js";
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
/** ECMA-48's C1 set, U+0080 to U+009F. */
const isC1 = (code: number): boolean => code >= 0x80 && code <= 0x9f;
const c1Of = (final: string): number => final.charCodeAt(0) + 0x40;
/** The final byte of each string escape's ESC form: OSC, DCS, APC, PM, SOS. */
const STRING_FINALS = "]P_^X";
const STRING_C1: ReadonlySet<number> = new Set([...STRING_FINALS].map(c1Of));
const CSI_C1 = c1Of("[");
const ST_C1 = c1Of("\\");
const ABORT = pattern(new RegExp(`[${ABORTS}]`, "u"));
// A run of a string escape's payload, to what ends it here: osc8's stops, and the line feed a capture cuts it at.
const PAYLOAD_RUN = pattern(new RegExp(`[^${STRING_STOPS}\\n]+`, "u"));
// A run of the bytes a sequence collects ahead of its final byte: a CSI's
// parameters and intermediates, below 0x40, and an escape's intermediates,
// below 0x30, each from 0x20, since a C0 control runs where it stands.
const INTERMEDIATE = String.raw`[\x20-\x2f]`;
const CSI_COLLECTS = pattern(/[\x20-\x3f]+/u);
const ESCAPE_COLLECTS = pattern(new RegExp(`${INTERMEDIATE}+`, "u"));
// A CSI's collected bytes: parameters, then intermediates, and no parameter after an intermediate.
const CSI_FIELDS = pattern(new RegExp(`^(?<params>${String.raw`[\x30-\x3f]`}*)(?<intermediates>${INTERMEDIATE}*)$`, "u"));

// The ESC form of each C1 control `CONTROL_CODES` breaks a line at: `ESC E`, NEL.
const ESC_LINE_BREAKS: ReadonlySet<string> = new Set(
  CONTROL_CODES.filter((row) => row.disposition === "line-break").flatMap((row) =>
    Array.from({ length: row.last - row.first + 1 }, (_, at) => row.first + at).filter(isC1),
  ).map((code) => String.fromCharCode(code - 0x40)),
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

const REPEAT_FINAL = "b";

/**
 * Whether REP repeats `cluster`, the last one drawn before it with no control
 * function between: a graphic character, so one that takes a cell. A tab moves
 * the cursor, and a mark with nothing under it takes none.
 */
const repeatable = (cluster: string): boolean => cluster !== "\t" && !/\p{Cc}/u.test(cluster) && cellLen(cluster) > 0;

/**
 * What text the lexer hands on does, in order: a carriage return; an ST with no
 * string to end, which a terminal does nothing with (`inert`); SO or SI
 * (`shift`); a character struck over itself (`struck`), over an underscore
 * first or not (`underscore`); a character struck over an underscore alone
 * (`underlined`); a backspace; and every control a line may not hold or a
 * terminal draws nothing for (`control`): undrawn when it is a C1 control,
 * which a terminal performs, and silent otherwise. No CSI or escape reaches it:
 * the lexer parsed each into its fields, and `csiToken` and `escapeToken` read them.
 */
const TEXT_EFFECTS = [
  String.raw`\r|(?<inert>\x9c)|(?<shift>[\x0e\x0f])`,
  String.raw`(?<underscore>_\x08)?(?<struck>\P{Cc})(?:\x08\k<struck>)+|_\x08(?<underlined>\P{Cc})|\x08`,
  `(?<control>${controlClass((disposition) => disposition !== "keep" && disposition !== "zeroWidth")})`,
].join("|");

/** Parameters a count is read from: digits and `;`, with no private marker and no sub-parameter. */
const COUNTED = pattern(/^[0-9;]*$/u);
/** SGR's parameters, `:` sub-parameters among them; a private marker such as the `>` of `\x1b[>4;2m` makes it some other CSI. */
const SGR_PARAMS = pattern(/^[0-9;:]*$/u);
const ERASE_PARAMS = pattern(/^[012]?$/u);

/**
 * A CSI's first parameter as the count a terminal reads, absent or zero being 1,
 * or undefined when its parameters are not a count's.
 */
function countOf(params: string): number | undefined {
  if (!COUNTED.test(params)) return undefined;
  const end = params.indexOf(";");
  return Number(end === -1 ? params : params.slice(0, end)) || 1;
}

/**
 * A CSI, in its `ESC [` form or its C1 one, whole, as the lexer parsed it: its
 * bytes (`escape`), its parameter bytes, 0x30 to 0x3F, the intermediates after
 * them, 0x20 to 0x2F, and its final byte.
 */
interface Csi {
  readonly kind: "csi";
  readonly escape: string;
  readonly params: string;
  readonly intermediates: string;
  readonly final: string;
}

/** An escape that is no CSI and no string escape, whole: its bytes, its intermediates and its final byte. */
interface Escape {
  readonly kind: "escape";
  readonly escape: string;
  readonly intermediates: string;
  readonly final: string;
}

/**
 * [LAW:single-enforcer] What an escape does, read off the fields the lexer
 * parsed it into, so the grammar has one definition: save and restore the
 * cursor, DECSC `\x1b7` and DECRC `\x1b8`, exactly, since `\x1b#8` carries an
 * intermediate and is not `\x1b8`; the full reset RIS (`\x1bc`); a G0 or G1
 * designation (`\x1b(B`, `\x1b)0`); and an ST with no string to end, which does
 * nothing. Any other escape (`\x1b#8`, `\x1b(%5`) is undrawn.
 */
function escapeToken({ escape, intermediates, final }: Escape): Token {
  if (intermediates === "(" || intermediates === ")") return { kind: "designate", set: intermediates === "(" ? 0 : 1, charset: charsetOf(final) };
  if (intermediates !== "") return { kind: "undrawn", escape };
  if (final === "7" || final === "8") return { kind: "cursor", save: final === "7", escape };
  if (final === "c") return { kind: "reset", soft: false, escape };
  return final === "\\" ? { kind: "silent" } : { kind: "undrawn", escape };
}

/**
 * [LAW:single-enforcer] What a CSI does, read off the fields the lexer parsed
 * it into. Save and restore the cursor are SCOSC `\x1b[s` and SCORC `\x1b[u`,
 * each exactly — with parameters `s` is DECSLRM's margins, and `u` with a
 * parameter or a marker is kitty's keyboard protocol, both undrawn. A move
 * along the line (`MOTIONS`), an edit of it (`EDITS`) and REP read the first
 * parameter as a count. Then SGR, erase in line and the soft reset DECSTR
 * (`\x1b[!p`). Any other CSI is undrawn.
 */
function csiToken({ escape, params, intermediates, final }: Csi): Token {
  const undrawn: Token = { kind: "undrawn", escape };
  if (intermediates !== "") return intermediates === "!" && params === "" && final === "p" ? { kind: "reset", soft: true, escape } : undrawn;
  if (params === "" && (final === "s" || final === "u")) return { kind: "cursor", save: final === "s", escape };
  if (final === "m") return SGR_PARAMS.test(params) ? { kind: "sgr", params } : undrawn;
  if (final === "K") return ERASE_PARAMS.test(params) ? { kind: "erase", mode: (params || "0") as EraseMode } : undrawn;
  const count = countOf(params);
  if (count === undefined) return undrawn;
  if (Object.hasOwn(MOTIONS, final)) return { kind: "move", motion: final as Motion, count };
  if (Object.hasOwn(EDITS, final)) return { kind: "edit", edit: final as Edit, count };
  return final === REPEAT_FINAL ? { kind: "repeat", count, escape } : undrawn;
}

/**
 * What the lexer reads bytes as, each a unit a terminal's parser acts on.
 * `text` is bytes a terminal draws or runs where they stand: a run outside any
 * sequence, or one control a CSI or an escape runs inside itself. `csi` and
 * `escape` are one whole, without the controls it ran, which come ahead of
 * it, or the DEL it ignored. `string` is a string escape, run to its terminator or cut
 * off where its payload ended. `break` ends a line, and says whether a terminal
 * performs it other than as CR LF, where the decoder starts the next line
 * (`relocates`). A sequence an abort or another sequence cancels is `silent`,
 * and one a byte outside its grammar ends, or the end of the bytes, `undrawn`,
 * as is a CSI with a parameter byte after an intermediate, which its grammar
 * has no place for.
 */
type Lexeme =
  | { readonly kind: "text"; readonly text: string }
  | Csi
  | Escape
  | { readonly kind: "string"; readonly escape: string }
  | { readonly kind: "break"; readonly end: string; readonly relocates: boolean }
  | Extract<Token, { readonly kind: "silent" | "undrawn" }>;

/**
 * Bytes lexed, and where an escape starts that the bytes end inside: its offset
 * in the bytes, their length when none does, and its lexeme, which stands where
 * it began, ahead of the controls it ran, the lexemes' length when none does.
 */
interface Lexed {
  readonly lexemes: readonly Lexeme[];
  readonly unread: number;
  readonly open: number;
}

/**
 * Where the lexer stands: outside any sequence, inside a CSI or an escape, or
 * inside a string escape's payload, which begins at `payload`, just after an
 * ESC there (`escaped`) or not. An escape in progress began at byte `start`,
 * and its lexeme stands at index `lexeme`, ahead of any control it runs.
 */
type LexState =
  | { readonly kind: "ground" }
  | { readonly kind: "sequence"; readonly start: number; readonly lexeme: number; readonly introducer: string; readonly csi: boolean; readonly collected: string }
  | { readonly kind: "string"; readonly start: number; readonly lexeme: number; readonly introducer: string; readonly payload: number; readonly escaped: boolean };

const GROUND: LexState = { kind: "ground" };

const sequenceAt = (start: number, lexeme: number, introducer: string, csi: boolean): LexState => ({ kind: "sequence", start, lexeme, introducer, csi, collected: "" });

// A run of ground text: everything but what begins an escape or breaks a line.
const GROUND_RUN = pattern(new RegExp(`(?:(?!${controlClass((disposition) => disposition === "line-break")})[^\\x1b\\x80-\\x9f\\n])+`, "u"));

/**
 * `char` as a line break, outside a sequence or run inside one: LF and the
 * census's line-break controls. LF and NEL are CR LF, as a terminal's output
 * translation writes LF, and so is a CNL of one row; VT and FF go down a row
 * and keep the column, LS and PS move nothing, and a CNL of more rows passes
 * rows the decoder, ending its line once, never draws.
 */
function breakOf(char: string): Extract<Lexeme, { readonly kind: "break" }> | undefined {
  if (char !== "\n" && dispositionOf(char.charCodeAt(0)) !== "line-break") return undefined;
  return { kind: "break", end: char, relocates: char !== "\n" && char !== "\x85" };
}

/**
 * A CSI or an escape completed by its final byte, its collected bytes split
 * into parameters and intermediates: a line break when it is one, undrawn when
 * a CSI's parameter byte follows an intermediate, which a VT500 parser ignores,
 * and a sequence otherwise.
 * The breaks are CNL and the ESC form of each C1 line break. On a terminal CNL
 * passes `count` rows, or none on the bottom row, where it does not scroll; the
 * decoder holds no cursor row and no screen height, so no count has an answer
 * it could give, and CNL decodes as NEL does: what follows is on a line of its
 * own.
 */
function completed(introducer: string, csi: boolean, collected: string, final: string): Lexeme {
  const escape = introducer + collected + final;
  if (!csi) {
    if (collected === "" && ESC_LINE_BREAKS.has(final)) return { kind: "break", end: escape, relocates: false };
    return { kind: "escape", escape, intermediates: collected, final };
  }
  const fields = CSI_FIELDS.exec(collected)?.groups;
  if (fields === undefined) return { kind: "undrawn", escape };
  const { params = "", intermediates = "" } = fields;
  const count = final === "E" && intermediates === "" ? countOf(params) : undefined;
  if (count !== undefined) return { kind: "break", end: escape, relocates: count > 1 };
  return { kind: "csi", escape, params, intermediates, final };
}

/**
 * [LAW:single-enforcer] `bytes` as a VT500 parser reads them: the one reading
 * of the bytes, which the line split, the link reader and every escape's
 * meaning all consume. A C0 control inside a CSI or an escape runs where it
 * stands and the sequence goes on past it, a line break among them, so a
 * sequence a break interrupts finishes on the next line; a DEL there does
 * nothing. The next ESC or any C1 control cancels a sequence, and CAN or SUB
 * aborts it, so what follows draws; a byte its grammar has no place for ends
 * it, undrawn. A string escape's payload ends at a terminator, which it takes,
 * or before an ESC that begins no ST or any C1 control, which then acts as
 * itself, or at a CAN or SUB, which aborts it. The parser ignores the other C0
 * controls there, so a form feed stays in the payload; a line feed ends it, the
 * cut a capture's line makes. A stray C1 byte that is windows-1252 read as
 * Latin-1 decodes as such a terminal shows it; no rule local to the byte can
 * tell the two apart, so repairing it is the caller's.
 *
 * [LAW:types-are-the-program] A string a sequence cuts off is a lexeme of its
 * own, so no control that sequence runs can reach the string's payload: no
 * rewriting of the bytes can say "this string was cancelled", and a lexeme
 * says it by existing.
 */
function lex(bytes: string): Lexed {
  const lexemes: Lexeme[] = [];
  let text = "";
  let state = GROUND;
  const flush = (): void => {
    if (text !== "") lexemes.push({ kind: "text", text });
    text = "";
  };
  const emit = (lexeme: Lexeme): void => {
    flush();
    lexemes.push(lexeme);
  };
  const run = new RegExp(GROUND_RUN.source, "uy");
  const csiRun = new RegExp(CSI_COLLECTS.source, "uy");
  const escapeRun = new RegExp(ESCAPE_COLLECTS.source, "uy");
  const payloadRun = new RegExp(PAYLOAD_RUN.source, "uy");
  // The length of the run `scan` matches at `at`, 0 where it matches none.
  const ran = (scan: RegExp, at: number): number => {
    scan.lastIndex = at;
    return scan.test(bytes) ? scan.lastIndex - at : 0;
  };
  // Reads from `at` in the current state, and says how many bytes it took; at
  // 0 the byte ended the state, and is read again from where it left.
  const step = (at: number): number => {
    const char = bytes[at]!;
    const code = char.charCodeAt(0);
    switch (state.kind) {
      case "ground": {
        const length = ran(run, at);
        if (length > 0) {
          text += bytes.slice(at, at + length);
          return length;
        }
        const lineBreak = breakOf(char);
        if (lineBreak !== undefined) emit(lineBreak);
        else if (char === "\x1b" || code === CSI_C1 || STRING_C1.has(code)) {
          flush();
          const lexeme = lexemes.length;
          state = STRING_C1.has(code) ? { kind: "string", start: at, lexeme, introducer: char, payload: at + 1, escaped: false } : sequenceAt(at, lexeme, char, code === CSI_C1);
        } else text += char;
        return 1;
      }
      case "sequence": {
        const { start, lexeme, introducer, csi, collected } = state;
        const collects = ran(csi ? csiRun : escapeRun, at);
        if (collects > 0) {
          state = { ...state, collected: collected + bytes.slice(at, at + collects) };
          return collects;
        }
        const cancelled = char === "\x1b" || isC1(code);
        if (cancelled || ABORT.test(char)) {
          emit({ kind: "silent" });
          state = GROUND;
          return cancelled ? 0 : 1;
        }
        if (code === 0x7f) return 1;
        if (code < 0x20) {
          emit(breakOf(char) ?? { kind: "text", text: char });
          return 1;
        }
        if (code > 0x7e) {
          emit({ kind: "undrawn", escape: introducer + collected });
          state = GROUND;
          return 0;
        }
        if (!csi && collected === "" && char === "[") state = sequenceAt(start, lexeme, introducer + char, true);
        else if (!csi && collected === "" && STRING_FINALS.includes(char)) state = { kind: "string", start, lexeme, introducer: introducer + char, payload: at + 1, escaped: false };
        else {
          emit(completed(introducer, csi, collected, char));
          state = GROUND;
        }
        return 1;
      }
      case "string": {
        const { introducer, payload, escaped } = state;
        if (!escaped) {
          const length = ran(payloadRun, at);
          if (length > 0) return length;
        }
        const terminated = (escaped && char === "\\") || (!escaped && (char === "\x07" || code === ST_C1));
        // Any other stop, but for an abort or the ESC that may begin ST, ends the payload before it.
        const cut = escaped || (char !== "\x1b" && !ABORT.test(char));
        if (terminated || cut) {
          emit({ kind: "string", escape: introducer + bytes.slice(payload, terminated ? at + 1 : escaped ? at - 1 : at) });
          // The ESC that cut the string off begins the sequence `char` goes on.
          state = !terminated && escaped ? sequenceAt(at - 1, lexemes.length, "\x1b", false) : GROUND;
          return terminated ? 1 : 0;
        }
        if (ABORT.test(char)) {
          emit({ kind: "silent" });
          state = GROUND;
        } else if (char === "\x1b") state = { ...state, escaped: true };
        return 1;
      }
    }
  };
  for (let at = 0; at < bytes.length; ) at += step(at);
  const open = state;
  if (open.kind === "ground") {
    flush();
    return { lexemes, unread: bytes.length, open: lexemes.length };
  }
  // An escape the bytes end inside began on the line it stands on, whatever breaks it ran after.
  const escape = open.kind === "sequence" ? open.introducer + open.collected : open.introducer + bytes.slice(open.payload);
  lexemes.splice(open.lexeme, 0, { kind: open.kind === "sequence" ? "undrawn" : "string", escape });
  return { lexemes, unread: open.start, open: open.lexeme };
}

/**
 * What hands `apply` what each part of a `text` the lexer handed on does, in
 * order.
 */
function textTokenizer(apply: (token: Token) => void): (bytes: string) => void {
  // Built once per tokenizer, since a line holds a text between every two
  // sequences, and held where nothing but the scan below can move its cursor.
  const effects = new RegExp(TEXT_EFFECTS, "gu");
  return (bytes) => {
    let at = 0;
    effects.lastIndex = 0;
    for (let match = effects.exec(bytes); match !== null; match = effects.exec(bytes)) {
      const { inert, control, shift, underscore, struck, underlined } = match.groups!;
      const escape = match[0];
      if (match.index > at) apply({ kind: "text", text: bytes.slice(at, match.index) });
      if (control !== undefined && isC1(control.charCodeAt(0))) apply({ kind: "undrawn", escape });
      else if (control !== undefined || inert !== undefined) apply({ kind: "silent" });
      if (escape === "\r") apply({ kind: "move", motion: "G", count: 1 });
      if (shift !== undefined) apply({ kind: "shift", set: shift === "\x0e" ? 1 : 0 });
      if (struck !== undefined) apply({ kind: "overstrike", character: struck, emphasis: underscore === undefined ? BOLD : BOLD_UNDERLINED });
      if (underlined !== undefined) apply({ kind: "overstrike", character: underlined, emphasis: UNDERLINED });
      if (escape === "\b") apply({ kind: "move", motion: "D", count: 1 });
      at = match.index + escape.length;
    }
    if (at < bytes.length) apply({ kind: "text", text: bytes.slice(at) });
  };
}

/**
 * What `lexeme`, any but text, does. A string escape that is one whole OSC 8
 * sequence opens or closes a link, and any other is undrawn; a line break
 * inside one line, which only `decodeLine` is handed, draws nothing.
 *
 * [LAW:one-source-of-truth] OSC 8 is read by the reader `osc8.ts` owns, so
 * the terminators a link may end with cannot differ between writing and
 * reading it back.
 */
function tokenOf(lexeme: Exclude<Lexeme, { readonly kind: "text" }>): Token {
  switch (lexeme.kind) {
    case "csi":
      return csiToken(lexeme);
    case "escape":
      return escapeToken(lexeme);
    case "string": {
      const [link] = osc8Sequences(lexeme.escape);
      return link?.length === lexeme.escape.length ? { kind: "link", uri: link.uri } : { kind: "undrawn", escape: lexeme.escape };
    }
    case "break":
      return { kind: "silent" };
    default:
      return lexeme;
  }
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
  // [LAW:one-source-of-truth] An underline kind's plain code is the one
  // `Style.toSgrCodes` writes; a style holds one kind, so each replaces another.
  ...UNDERLINE_KINDS.filter((kind) => !UNDERLINE[kind].sgr.includes(":")).map((kind): [number, SgrOp] => [Number(UNDERLINE[kind].sgr), adding({ underline: kind })]),
  [22, adding({ bold: false, dim: false })],
  [23, adding({ italic: false })],
  // ECMA-48: 24 is "neither singly nor doubly underlined", 25 "steady" at
  // either speed. Rich's table clears only the first of each pair.
  [24, adding({ underline: false })],
  [25, adding({ blink: false, rapidBlink: false })],
  [27, adding({ reverse: false })],
  [28, adding({ conceal: false })],
  [29, adding({ strike: false })],
  [38, (style, rest) => style.add(new Style({ color: extendedColor(rest) }))],
  [39, adding({ color: ColorSpec.default() })],
  [48, (style, rest) => style.add(new Style({ bgcolor: extendedColor(rest) }))],
  [49, adding({ bgcolor: ColorSpec.default() })],
  [58, (style, rest) => style.add(new Style({ underlineColor: extendedColor(rest) }))],
  // 59 is the glyph's color again, which the default color stands for.
  [59, adding({ underlineColor: ColorSpec.default() })],
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

// What `4:n` sets, by `n`: none, or a kind — `UNDERLINE`'s own codes for the
// styled ones, and 4:1 and 4:2 for the kinds 4 and 21 also spell.
const UNDERLINE_SUBS: readonly Underline[] = [false, "single", "double", ...UNDERLINE_KINDS.filter((kind) => UNDERLINE[kind].sgr.startsWith("4:")).sort((a, b) => UNDERLINE[a].sgr.localeCompare(UNDERLINE[b].sgr))];

/**
 * A code carrying colon sub-parameters, as the operation and arguments it
 * applies: its arguments are its own, so the codes after it are untouched.
 * `4:n` is an underline's kind. A code T.416 gives no sub-parameters is
 * skipped, as is a kind no terminal names.
 */
function subCode(code: number, subs: readonly string[]): readonly [SgrOp, number[]] | undefined {
  if (code === 38 || code === 48 || code === 58) return [SGR_OPS.get(code)!, colorArguments(subs)];
  if (code !== 4) return undefined;
  const underline = UNDERLINE_SUBS[parameter(subs[0] ?? "")];
  return underline === undefined ? undefined : [adding({ underline }), []];
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
    if (sub !== undefined) result = sub[0](result, sub[1].values());
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
    const { ended, last } = linesOf(lex(ansi).lexemes);
    const lines = ended.map(({ line }) => drawLine(this.stream, line, LINE_START));
    if (last.length > 0) lines.push(drawLine(this.stream, last, LINE_START));
    return lines.map(({ cells }) => assembled(cells));
  }

  /**
   * One line of output, holding no `\n`, written the way a terminal writes
   * it: `\r` returns to the first column, and text overwrites from there.
   */
  decodeLine(line: string): RichText {
    return assembled(drawLine(this.stream, lex(line).lexemes, LINE_START).cells);
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
 * [LAW:one-source-of-truth] Each line of `lexemes` as `decode` draws it and
 * the break that ends it, the last line ended by none. `decode` and
 * `scanUndrawn` both split here.
 */
function linesOf(lexemes: readonly Lexeme[]): { readonly ended: readonly EndedLine[]; readonly last: readonly Lexeme[] } {
  const ended: EndedLine[] = [];
  let line: Lexeme[] = [];
  for (const lexeme of lexemes) {
    if (lexeme.kind !== "break") line.push(lexeme);
    else {
      ended.push({ line, end: lexeme });
      line = [];
    }
  }
  return { ended, last: line };
}

/** A line and the break that ends it. */
interface EndedLine {
  readonly line: readonly Lexeme[];
  readonly end: Extract<Lexeme, { readonly kind: "break" }>;
}

/**
 * `line` drawn after `start`, what the same line held before it. The branches
 * that decide what the decoder does with a restore, a REP and RIS also say
 * whether a terminal does the same, so the gate that reads `undrawn` reads
 * the decoder's own rule (`scanUndrawn`).
 */
function drawLine(stream: Stream, line: readonly Lexeme[], start: LineState): DrawnLine {
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
  const apply = (token: Token): void => {
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
  };
  const textTokens = textTokenizer(apply);
  for (const lexeme of line) {
    if (lexeme.kind !== "text") apply(tokenOf(lexeme));
    else textTokens(lexeme.text);
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
  // An escape the bytes end inside is read once the rest of it is written, the
  // controls it has run so far with it, so no write runs them twice.
  const { lexemes, unread, open } = lex(bytes);
  const stream = streamOf(width);
  let undrawn: string | undefined = undefined;
  let state = before;
  // The first line continues the one `before` ended on, and each after it starts fresh.
  const { ended, last } = linesOf(lexemes.slice(0, open));
  for (const { line, end } of ended) {
    undrawn ??= drawLine(stream, line, state).undrawn;
    if (end.relocates) undrawn ??= end.end;
    state = LINE_START;
  }
  const drawn = drawLine(stream, last, state);
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
