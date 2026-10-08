/**
 * A static example's output as the docs draw it: the bytes a program wrote,
 * decoded (`decodeAnsi`, each colour kept the kind it was emitted as) and
 * encoded as one HTML fragment per site colour mode.
 *
 * [LAW:one-source-of-truth] Two places draw output from bytes: the build,
 * which runs every example and writes what it printed under it
 * (example-runner.ts), and the editable card in the browser, which runs a
 * reader's edit (theme/RichExample.ts). Both call this, so one byte stream
 * cannot be drawn two ways. It reads nothing but the library and the example
 * terminal, and so runs in either.
 */
import { Segment, decodeAnsi } from "../../src/index.js";
import { encodeHtmlFragment } from "../../src/core/export-html.js";
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

export function drawOutput(bytes: string): Drawn {
  const text = decodeAnsi(bytes, { noWrap: true });
  const segments: Segment[] = [...text.render({ maxWidth: EXAMPLE_TERMINAL.columns, isTerminal: false, asciiOnly: false })];
  const [columns] = Segment.getShape(Segment.splitLines(segments));
  return { light: encodeHtmlFragment(segments, EXAMPLE_THEMES.light), dark: encodeHtmlFragment(segments, EXAMPLE_THEMES.dark), columns };
}
