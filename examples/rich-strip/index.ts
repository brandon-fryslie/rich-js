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
