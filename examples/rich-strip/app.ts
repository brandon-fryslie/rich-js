/**
 * rich-strip's body: every built-in separator, each under its name, sized to
 * fit the docs card's terminal.
 *
 * [LAW:one-source-of-truth] It takes its whole environment from
 * `hostEnvironment(host)`, so the host is the one sink it writes to and the one
 * terminal it asks about size and color. No second path to `process`.
 */

import {
  Console,
  Strip,
  CellSeparator,
  SEPARATOR_STYLES,
  SEPARATORS,
  END_CAPS,
  separatorNamed,
  SEAM_MIN_DELTA_E,
  gradientSeam,
  Style,
  RichText,
  FlexStrip,
  type SeparatorSeam,
} from "@promptctl/rich-js";
import { hostEnvironment, type TerminalHost } from "@promptctl/rich-js/host";

export function runDemo(host: TerminalHost): void {
  const { cols } = host.size();
  const consoleOut = new Console({
    environment: hostEnvironment(host),
    width: cols,
  });

  const cells = [
    new RichText(" main ", { style: Style.parse("white on #1e3a8a"), end: "", noWrap: true }),
    new RichText(" claude.ai ", { style: Style.parse("white on #0e7490"), end: "", noWrap: true }),
    new RichText(" 3.4k tok ", { style: Style.parse("white on #15803d"), end: "", noWrap: true }),
    new RichText(" 12% ", { style: Style.parse("white on #b45309"), end: "", noWrap: true }),
  ];

  // Each strip under its name, with no blank line between them: the whole tour
  // fits one screen of the docs card's terminal, so none of it scrolls away.
  const showcase = (label: string, strip: Strip | FlexStrip): void => {
    consoleOut.print(new RichText(label, { style: "bold" }));
    consoleOut.print(strip);
  };

  // The table one separator a row, its name the row's first item: a name has no
  // ground, so each separator meets it as it meets the strip's start.
  consoleOut.print(new RichText("SEPARATOR_STYLES", { style: "bold" }));
  const width = Math.max(...Object.keys(SEPARATOR_STYLES).map((name) => name.length));
  for (const name of Object.keys(SEPARATOR_STYLES)) {
    consoleOut.print(new Strip([new RichText(` ${name.padEnd(width)} `, { end: "", noWrap: true }), ...cells], separatorNamed(name)));
  }
  // Neighbours whose backgrounds sit closer than SEAM_MIN_DELTA_E would hide the
  // arrow in their shared color, so the separator lifts the arrow's ink off it.
  const shared = ["one", "two", "three"].map(
    (t) => new RichText(` ${t} `, { style: Style.parse("white on #3a3f58"), end: "", noWrap: true }),
  );
  showcase(
    `SEPARATOR_STYLES.powerline, shared background (ink lifted to ΔE ${SEAM_MIN_DELTA_E})`,
    new Strip([...cells, ...shared], SEPARATOR_STYLES.powerline),
  );
  // The middle and the ends are picked apart: any seam ends in any caps.
  showcase("SEPARATORS.prism + END_CAPS.bubble", new Strip(cells, new CellSeparator(SEPARATORS.prism, END_CAPS.bubble)));
  // A seam is a value: one the table does not bundle, two arrows meeting
  // point to point, the right ground reaching back into the left.
  const meet: SeparatorSeam = {
    glyph: {
      seam: [
        { glyph: "\ue0b2", fg: { edge: "right", part: "bg" }, bg: { edge: "left", part: "bg" } },
        { glyph: "\ue0b0", fg: { edge: "left", part: "bg" }, bg: { edge: "right", part: "bg" } },
      ],
    },
    ascii: {
      seam: [{ glyph: "<>", fg: { edge: "left", part: "bg" }, bg: { edge: "right", part: "bg" } }],
    },
  };
  showcase("arrows meeting + END_CAPS.powerline", new Strip([...cells, ...shared], new CellSeparator(meet, END_CAPS.powerline)));

  // "Unbounded" gradient: fill the row between two anchor cells with as many
  // steps as the terminal can show.
  const LEFT_ANCHOR = new RichText(" #ff0066 ", { style: Style.parse("white on #ff0066"), end: "", noWrap: true });
  const RIGHT_ANCHOR = new RichText(" #00ccff ", { style: Style.parse("white on #00ccff"), end: "", noWrap: true });
  const anchorWidth = " #ff0066 ".length + " #00ccff ".length;
  const fillSteps = Math.max(1, consoleOut.width - anchorWidth);
  showcase(
    `gradientSeam(${fillSteps}) + END_CAPS.flat, full-width fill`,
    new Strip([LEFT_ANCHOR, RIGHT_ANCHOR], new CellSeparator(gradientSeam(fillSteps), END_CAPS.flat)),
  );

  const PALETTE = [
    "#1e3a8a", "#0e7490", "#15803d", "#b45309", "#7c2d12",
    "#6d28d9", "#be185d", "#0f766e", "#a16207", "#334155",
  ];
  const tags = [
    "rust", "typescript", "go", "python", "elixir", "haskell",
    "ocaml", "zig", "swift", "kotlin", "ruby", "lua", "clojure",
    "scala", "erlang", "nim",
  ];
  const tagCells = tags.map(
    (t, i) => new RichText(` ${t} `, { style: Style.parse(`white on ${PALETTE[i % PALETTE.length]!}`), end: "", noWrap: true }),
  );

  showcase("FlexStrip + SEPARATOR_STYLES.powerline (wrap-to-width)", new FlexStrip(tagCells, { separator: SEPARATOR_STYLES.powerline }));
  showcase("FlexStrip + gap (tag cloud)", new FlexStrip(tagCells, { gap: 1 }));
}
