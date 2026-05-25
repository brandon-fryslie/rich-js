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
  StripCell,
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
    file: hostStream(host),
    width: cols,
  });

  const cells = [
    new StripCell(" main ", Style.parse("white on #1e3a8a")),
    new StripCell(" claude.ai ", Style.parse("white on #0e7490")),
    new StripCell(" 3.4k tok ", Style.parse("white on #15803d")),
    new StripCell(" 12% ", Style.parse("white on #b45309")),
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
  const LEFT_ANCHOR = new StripCell(" #ff0066 ", Style.parse("white on #ff0066"));
  const RIGHT_ANCHOR = new StripCell(" #00ccff ", Style.parse("white on #00ccff"));
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
    (t, i) => new StripCell(` ${t} `, Style.parse(`white on ${PALETTE[i % PALETTE.length]!}`)),
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
