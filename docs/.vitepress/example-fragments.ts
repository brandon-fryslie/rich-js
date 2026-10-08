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

/** Bytes a program wrote, read for what `drawOutput` cannot show. */
export interface EscapeScan {
  /**
   * The first escape `drawOutput` drops: a program moving the cursor,
   * clearing the screen or switching modes, which only a terminal shows.
   * Null when there is none.
   */
  readonly dropped: string | null;
  /** Where an escape starts that is not yet complete, and so not yet read; the length of the bytes when none is. */
  readonly unread: number;
}

/**
 * [LAW:one-source-of-truth] Whether bytes are ones `drawOutput` draws whole:
 * the build refuses a static block whose bytes are not (example-runner.ts),
 * and the page's static run ends a program whose bytes are not
 * (theme/static-run.ts), by this one reading.
 */
export function scanEscapes(bytes: string): EscapeScan {
  let read = 0;
  for (const match of bytes.matchAll(ESCAPE)) {
    if (!DRAWN.test(match[0])) return { dropped: match[0], unread: match.index };
    read = match.index + match[0].length;
  }
  const open = bytes.indexOf("\x1b", read);
  return { dropped: null, unread: open === -1 ? bytes.length : open };
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
