/**
 * An example's output as the docs draw it: the bytes a program wrote,
 * decoded (`decodeAnsi`, each color kept the kind it was emitted as) and
 * encoded as one HTML fragment per site color mode.
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
import { LINE_START, scanUndrawn } from "../../src/core/ansi.js";
import type { LineState } from "../../src/core/ansi.js";
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
  /** Where an escape starts that is not yet complete; the length of the bytes when none does. */
  readonly unread: number;
  /** What the line the bytes end on holds for the next write. */
  readonly after: LineState;
}

/**
 * [LAW:one-source-of-truth] Whether bytes written so far are ones
 * `drawOutput` draws whole, as the decoder that draws them reports it
 * (`scanUndrawn`); an escape still open past any a terminal takes is dropped
 * too. The page's static run reads each write by this as it comes
 * (theme/static-run.ts), `before` what the last one left the line holding;
 * `undrawnEscape` reads a program's whole output by it.
 */
export function scanEscapes(bytes: string, before: LineState = LINE_START): EscapeScan {
  // At the width the card draws them at, so a rule that reads the margin agrees with the drawing.
  const { undrawn, unread, after } = scanUndrawn(bytes, before, EXAMPLE_TERMINAL.columns);
  const open = bytes.slice(unread);
  return { dropped: undrawn ?? (open.length > LONGEST_OPEN_ESCAPE ? open : null), unread, after };
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
export function drawOutput(bytes: string, columns: number = EXAMPLE_TERMINAL.columns): Drawn | null {
  if (bytes === "") return null;
  const text = decodeAnsi(bytes, { noWrap: true, width: columns });
  const segments: Segment[] = [...text.render({ maxWidth: columns, isTerminal: false, asciiOnly: false })];
  const [widest] = Segment.getShape(Segment.splitLines(segments));
  return { light: encodeHtmlFragment(segments, EXAMPLE_THEMES.light), dark: encodeHtmlFragment(segments, EXAMPLE_THEMES.dark), columns: widest };
}
