/**
 * rich-strip's body: every built-in `Joiner`, each under its name, sized to
 * fit the docs card's terminal.
 *
 * [LAW:one-source-of-truth] It takes its whole environment from
 * `hostEnvironment(host)`, so the host is the one sink it writes to and the one
 * terminal it asks about size and colour. No second path to `process`.
 */

import {
  Console,
  Strip,
  PowerlineJoiner,
  SEAM_MIN_DELTA_E,
  POWERLINE_JOINER_GLYPHS,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
  Style,
  RichText,
  FlexStrip,
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

  showcase("PowerlineJoiner", new Strip(cells, new PowerlineJoiner()));
  // Neighbours whose backgrounds sit closer than SEAM_MIN_DELTA_E would hide the
  // arrow in their shared colour, so the joiner draws the thin divider there.
  const shared = ["one", "two", "three"].map(
    (t) => new RichText(` ${t} `, { style: Style.parse("white on #3a3f58"), end: "", noWrap: true }),
  );
  showcase(
    `PowerlineJoiner, shared background (divider below ΔE ${SEAM_MIN_DELTA_E})`,
    new Strip(shared, new PowerlineJoiner()),
  );
  // The arrow, its divider and the two caps are one vocabulary, replaced
  // together: here the default set spelled out, then the ASCII set a terminal
  // without a powerline font would take.
  showcase(
    `PowerlineJoiner(${JSON.stringify(POWERLINE_JOINER_GLYPHS)})`,
    new Strip([...cells, ...shared], new PowerlineJoiner(POWERLINE_JOINER_GLYPHS)),
  );
  showcase(
    "PowerlineJoiner, ASCII set",
    new Strip([...cells, ...shared], new PowerlineJoiner({ glyph: ">", divider: "|", lead: "<", tail: ">" })),
  );
  showcase("CapsuleJoiner", new Strip(cells, new CapsuleJoiner()));
  showcase("PlainJoiner", new Strip(cells, new PlainJoiner()));
  showcase("GradientJoiner (steps=6)", new Strip(cells, new GradientJoiner({ steps: 6 })));

  // "Unbounded" gradient: fill the row between two anchor cells with as many
  // steps as the terminal can show.
  const LEFT_ANCHOR = new RichText(" #ff0066 ", { style: Style.parse("white on #ff0066"), end: "", noWrap: true });
  const RIGHT_ANCHOR = new RichText(" #00ccff ", { style: Style.parse("white on #00ccff"), end: "", noWrap: true });
  const anchorWidth = " #ff0066 ".length + " #00ccff ".length;
  const fillSteps = Math.max(1, consoleOut.width - anchorWidth);
  showcase(
    `GradientJoiner (steps=${fillSteps}, full-width fill)`,
    new Strip([LEFT_ANCHOR, RIGHT_ANCHOR], new GradientJoiner({ steps: fillSteps })),
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

  showcase("FlexStrip + PowerlineJoiner (wrap-to-width)", new FlexStrip(tagCells, { joiner: new PowerlineJoiner() }));
  showcase("FlexStrip + gap (tag cloud)", new FlexStrip(tagCells, { gap: 1 }));
}
