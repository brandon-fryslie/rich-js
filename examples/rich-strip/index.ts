/**
 * rich-strip — a one-shot demo of every built-in `Joiner`.
 *
 * Prints the same `Strip` of cells through PowerlineJoiner, CapsuleJoiner,
 * PlainJoiner, and GradientJoiner so the visual differences between
 * joiners are obvious side-by-side. Non-interactive: just `npm run strip`.
 */

import {
  Console,
  Strip,
  StripCell,
  PowerlineJoiner,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
  Style,
  RichText,
} from "../../src/index.js";

const consoleOut = new Console({ forceTerminal: true });

const cells = [
  new StripCell(" main ", Style.parse("white on #1e3a8a")),
  new StripCell(" claude.ai ", Style.parse("white on #0e7490")),
  new StripCell(" 3.4k tok ", Style.parse("white on #15803d")),
  new StripCell(" 12% ", Style.parse("white on #b45309")),
];

function showcase(label: string, strip: Strip): void {
  consoleOut.print(new RichText(label, { style: "bold" }));
  consoleOut.print(strip);
  consoleOut.print(new RichText(""));
}

showcase("PowerlineJoiner", new Strip(cells, new PowerlineJoiner()));
showcase("CapsuleJoiner", new Strip(cells, new CapsuleJoiner()));
showcase("PlainJoiner", new Strip(cells, new PlainJoiner()));
showcase("GradientJoiner (steps=6)", new Strip(cells, new GradientJoiner({ steps: 6 })));

// "Unbounded" gradient: fill the row between two anchor cells with as many
// steps as the terminal can show. The gradient self-limits visually — beyond
// the largest channel delta (~255 in truecolor) adjacent cells collapse to
// identical RGB values, so this also demonstrates that ceiling.
const LEFT_ANCHOR = new StripCell(" #ff0066 ", Style.parse("white on #ff0066"));
const RIGHT_ANCHOR = new StripCell(" #00ccff ", Style.parse("white on #00ccff"));
const anchorWidth = " #ff0066 ".length + " #00ccff ".length;
const fillSteps = Math.max(1, consoleOut.width - anchorWidth);
showcase(
  `GradientJoiner (steps=${fillSteps}, full-width fill)`,
  new Strip([LEFT_ANCHOR, RIGHT_ANCHOR], new GradientJoiner({ steps: fillSteps })),
);
