/**
 * An example's output as the docs draw it: the bytes a program wrote,
 * decoded (`decodeAnsi`, each colour kept the kind it was emitted as) and
 * encoded as one HTML fragment per site colour mode.
 *
 * [LAW:one-source-of-truth] Two places draw output from bytes: the build,
 * which runs every example and hands what it printed to its card
 * (example-runner.ts), and the card in the browser, which runs a
 * reader's edit (theme/RichExample.ts). Both call this, so one byte stream
 * cannot be drawn two ways. It reads nothing but the library and the example
 * terminal, and so runs in either.
 */
import { Segment, decodeAnsi } from "../../src/index.js";
import { encodeHtmlFragment } from "../../src/core/export-html.js";
import { OSC8 } from "../../src/core/osc8.js";
import { EXAMPLE_TERMINAL, EXAMPLE_THEMES } from "./example-terminal.js";

/**
 * Output drawn: a light and a dark fragment, and how many cells its widest
 * row takes, which custom.css shrinks the fragments' font by where the card is
 * narrower than that.
 */
export interface Drawn {
  readonly light: string;
  readonly dark: string;
  readonly columns: number;
}

/**
 * Every complete escape sequence, cut as `decodeAnsi` (src/core/ansi.ts) cuts
 * them: a CSI; a string escape (OSC, DCS, APC, PM, SOS) run to its
 * terminator; any other escape, ECMA-48's intermediates and one final byte.
 */
const ESCAPE = /\x1b(?:\[[0-?]*[ -/]*[@-~]|[\]P_^X][\s\S]*?(?:\x07|\x1b\\|\x9c)|[ -/]*[0-OQ-WYZ\\`-~])/g;

/** The escapes `decodeAnsi` draws: SGR, erase in line, and an OSC 8 link. It drops every other. */
const DRAWN = new RegExp(`^(?:\\x1b\\[[0-9;:]*m|\\x1b\\[[012]?K|${OSC8.source})$`);

/**
 * The start of an escape `DRAWN` may yet match once the rest of it is written:
 * a CSI so far all parameters, or an OSC 8 link short of its terminator. The
 * link's parts exclude `OSC8`'s terminators (src/core/osc8.ts).
 */
const DRAWN_START = /^\x1b(?:\[[0-9;:]*|\]8?|\]8;[^;\x1b\x07\x9c]*(?:;[^\x1b\x07\x9c]*\x1b?)?)?$/;

/**
 * The most an escape may hold before it is complete. VTE takes a link's URI up
 * to 2083 bytes (the OSC 8 spec); one still open at twice that is no link a
 * terminal draws, and holding it bounds what each later write re-reads.
 */
const LONGEST_OPEN_ESCAPE = 4096;

/** Bytes a program wrote, read for what `drawOutput` cannot show. */
export interface EscapeScan {
  /**
   * The first escape `drawOutput` drops: a program moving the cursor,
   * clearing the screen or switching modes, which only a terminal shows.
   * Null when there is none.
   */
  readonly dropped: string | null;
  /** Where an escape starts that may yet be drawn once the rest of it is written; the length of the bytes when none does. */
  readonly unread: number;
}

/**
 * [LAW:one-source-of-truth] Whether bytes written so far are ones
 * `drawOutput` draws whole: an escape it drops, or one begun that can no
 * longer become one it draws, is dropped. The page's static run reads each
 * write by this as it comes (theme/static-run.ts); `undrawnEscape` reads a
 * program's whole output by it.
 */
export function scanEscapes(bytes: string): EscapeScan {
  let read = 0;
  for (const match of bytes.matchAll(ESCAPE)) {
    // An escape begun before this one and never finished: an escape inside it ends any chance of drawing it.
    const open = bytes.indexOf("\x1b", read);
    if (open < match.index) return { dropped: bytes.slice(open, match.index), unread: open };
    if (!DRAWN.test(match[0])) return { dropped: match[0], unread: match.index };
    read = match.index + match[0].length;
  }
  const open = bytes.indexOf("\x1b", read);
  if (open === -1) return { dropped: null, unread: bytes.length };
  const rest = bytes.slice(open);
  return DRAWN_START.test(rest) && rest.length <= LONGEST_OPEN_ESCAPE ? { dropped: null, unread: open } : { dropped: rest, unread: open };
}

/**
 * The first escape in a program's whole output that a drawing of it drops,
 * one left unfinished at the end included; null when there is none. The
 * build holds a static block to this (example-runner.ts), and the page's
 * static run a program that has ended (theme/static-run.ts).
 */
export function undrawnEscape(output: string): string | null {
  const { dropped, unread } = scanEscapes(output);
  return dropped ?? (unread < output.length ? output.slice(unread) : null);
}

/**
 * `bytes` drawn, or null when there are none: a program that printed nothing
 * draws as one that printed a blank line, so the bytes, not the drawing, say
 * which it was.
 */
export function drawOutput(bytes: string): Drawn | null {
  if (bytes === "") return null;
  const text = decodeAnsi(bytes, { noWrap: true });
  const segments: Segment[] = [...text.render({ maxWidth: EXAMPLE_TERMINAL.columns, isTerminal: false, asciiOnly: false })];
  const [columns] = Segment.getShape(Segment.splitLines(segments));
  return { light: encodeHtmlFragment(segments, EXAMPLE_THEMES.light), dark: encodeHtmlFragment(segments, EXAMPLE_THEMES.dark), columns };
}
