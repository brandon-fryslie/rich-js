/**
 * rich-strip demo body — every built-in `Joiner` printed side-by-side.
 *
 * [LAW:dataflow-not-control-flow] `runDemo` takes a `TerminalHost` as a value
 * and never branches on environment. Node bootstraps with `NodeTerminalHost`,
 * browser bootstraps with `BrowserTerminalHost`; the demo code path is identical.
 *
 * [LAW:one-source-of-truth] The Console-using demos route their output through
 * `hostStream(host)` so there is exactly one sink the demo writes to — the host.
 * No second path to `process.stdout`.
 */

import {
  Console,
  Strip,

  PowerlineJoiner,
  CapsuleJoiner,
  PlainJoiner,
  GradientJoiner,
  Style,
  RichText,
  FlexStrip,
  hostStream,
  type TerminalHost,
} from "../../src/index.js";

export interface DemoHandle {
  /** Detach any resources the demo holds. One-shot demos have nothing to do. */
  stop(): void;
}

export function runDemo(host: TerminalHost): DemoHandle {
  const { cols } = host.size();
  const consoleOut = new Console({
    forceTerminal: true,
    // [LAW:locality-or-seam] hostStream returns the narrow ConsoleSink shape
    // (just `.write`) — exactly what Console + Live touch on `_file`.
    file: hostStream(host),
    width: cols,
  });

  const cells = [
    new RichText(" main ", { style: Style.parse("white on #1e3a8a"), end: "", noWrap: true }),
    new RichText(" claude.ai ", { style: Style.parse("white on #0e7490"), end: "", noWrap: true }),
    new RichText(" 3.4k tok ", { style: Style.parse("white on #15803d"), end: "", noWrap: true }),
    new RichText(" 12% ", { style: Style.parse("white on #b45309"), end: "", noWrap: true }),
  ];

  const showcase = (label: string, strip: Strip): void => {
    consoleOut.print(new RichText(label, { style: "bold" }));
    consoleOut.print(strip);
    consoleOut.print(new RichText(""));
  };

  showcase("PowerlineJoiner", new Strip(cells, new PowerlineJoiner()));
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
    "scala", "erlang", "nim", "crystal", "rescript", "purescript",
  ];
  const tagCells = tags.map(
    (t, i) => new RichText(` ${t} `, { style: Style.parse(`white on ${PALETTE[i % PALETTE.length]!}`), end: "", noWrap: true }),
  );

  consoleOut.print(new RichText("FlexStrip + PowerlineJoiner (wrap-to-width)", { style: "bold" }));
  consoleOut.print(new FlexStrip(tagCells, { joiner: new PowerlineJoiner() }));
  consoleOut.print(new RichText(""));

  consoleOut.print(new RichText("FlexStrip + gap (tag cloud)", { style: "bold" }));
  consoleOut.print(new FlexStrip(tagCells, { gap: 1 }));
  consoleOut.print(new RichText(""));

  return {
    stop(): void {
      // one-shot demo — nothing to detach
    },
  };
}
