/*
 * Where `RichText` places a line inside its canvas, pinned against Python Rich.
 *
 * [LAW:one-source-of-truth] `text-justify.golden.txt` is a committed copy of
 * the reference implementation's own output, not of this port's — the same
 * rule, and for the same reason, as `text-wrap.golden.txt` next door. Placing
 * a line is where the port most recently disagreed with *itself*: `Table`
 * carried a second justifier that centred around a wrap's trailing whitespace
 * while `RichText._justifyLine` centred around the content, so a centred title
 * drifted half a space off true on every line that happened to end in one
 * (rich-table-6uy.7). Collapsing the two into one answer is only an
 * improvement if the surviving answer is the reference's, and nothing this
 * library can generate is evidence of that.
 *
 * Regenerating it therefore means re-deriving it from the reference, never
 * from this library. Python Rich is not installable from here (pypi is
 * TLS-intercepted) but GitHub is, and it runs from a bare checkout. This is
 * the command the committed fixture came out of, verified to reproduce it byte
 * for byte; run it from the repository root:
 *
 *     git clone --depth 1 https://github.com/Textualize/rich.git /tmp/rich-src
 *     PYTHONPATH=/tmp/rich-src python3 - > test/core/text-justify.golden.txt <<'PY'
 *     from rich.console import Console
 *     from rich.text import Text
 *     import sys
 *     TEXTS = [("sentence", "aaaa bbbb cccc dddd"),
 *              ("hanging-space", "aaaa      bbbb"),
 *              ("unbreakable", "aaaaaaaaaaaaaaaaaaaa"),
 *              ("multiline", "one\ntwo three four five"),
 *              ("trailing-space", "words then space   "),
 *              ("wide", "日本語のテキストです"),
 *              ("short", "hi")]
 *     WIDTHS = [8, 12, 20]
 *     JUSTIFY = [None, "left", "center", "right"]
 *     console = Console(no_color=True, force_terminal=False, legacy_windows=False)
 *     blocks = []
 *     for name, value in TEXTS:
 *         for width in WIDTHS:
 *             for justify in JUSTIFY:
 *                 options = console.options.update(max_width=width, justify=justify)
 *                 rendered = "".join(
 *                     s.text for s in console.render(Text(value), options)
 *                 ).rstrip("\n")
 *                 blocks.append("%s w%d %s\n%s" % (name, width, justify or "default", rendered))
 *     sys.stdout.write("\n\n".join(blocks) + "\n")
 *     PY
 *
 * It goes through `console.render` with the justify on the *options* for the
 * same reason the wrap fixture does: `Console.print` rebuilds its arguments,
 * so a policy set on the `Text` is silently dropped and every block comes out
 * rendered under the default. That fixture's header owns the full argument.
 *
 * A SECOND FIXTURE, NOT A FOURTH AXIS. `text-wrap.golden.txt` is already the
 * cross product of 11 texts x 5 widths x 3 overflow methods; adding justify to
 * it would multiply 165 blocks into 660, and the added 495 would almost all be
 * restating that justify and overflow do not interact. Two fixtures pinning
 * two different facts are not two sources of truth — that failure needs them
 * to pin the *same* fact, and neither of these can answer the other's
 * question. What decides the split is the question asked: that one asks where
 * a line is cut, this one asks where the pieces sit.
 *
 * WHY THIS CORPUS. Each text buys one arm of the placement that no other buys.
 * `sentence` wraps into lines that each end in the whitespace the break left
 * hanging — the case the two justifiers disagreed about, and the reason
 * `hangingWhitespace` exists. `hanging-space` makes that run long enough that
 * measuring it wrong is visible rather than a single cell. `unbreakable` never
 * wraps, so it pins placement of a line that fills or overruns the canvas with
 * no hanging whitespace at all. `multiline` gives one render lines of
 * differing widths, which is the only way to catch a gap computed once and
 * reused. `trailing-space` is the control for `hanging-space`: whitespace the
 * *author* wrote, not the wrap, and Rich treats the two the same on the line
 * that ends a paragraph — pinning that keeps a future fix for one from
 * quietly changing the other. `wide` makes the gap odd more often than not, so
 * a centre that splits it the wrong way shows up. `short` is the degenerate
 * case where the gap dwarfs the content.
 *
 * WIDTHS. 8 forces a wrap on every text, 12 wraps some and not others, 20
 * holds most of them whole — so each text is pinned wrapped, mixed, and
 * unwrapped without a width that only re-asks a neighbour's question.
 *
 * `full` IS DELIBERATELY ABSENT, and its own test below says why.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";

const GOLDEN = new URL("./text-justify.golden.txt", import.meta.url);

const TEXTS: readonly (readonly [string, string])[] = [
  ["sentence", "aaaa bbbb cccc dddd"],
  ["hanging-space", "aaaa      bbbb"],
  ["unbreakable", "aaaaaaaaaaaaaaaaaaaa"],
  ["multiline", "one\ntwo three four five"],
  ["trailing-space", "words then space   "],
  ["wide", "日本語のテキストです"],
  ["short", "hi"],
];
const WIDTHS: readonly number[] = [8, 12, 20];
const JUSTIFY: readonly RenderOptions["justify"][] = [undefined, "left", "center", "right"];

function placed(value: string, maxWidth: number, justify: RenderOptions["justify"]): string {
  return [...new RichText(value).render({ maxWidth, justify })]
    .map((segment) => segment.text)
    .join("")
    .replace(/\n+$/, "");
}

describe("RichText justification", () => {
  it("places lines where Python Rich places them", () => {
    const rendered =
      TEXTS.flatMap(([name, value]) =>
        WIDTHS.flatMap((width) =>
          JUSTIFY.map(
            (justify) =>
              `${name} w${width} ${justify ?? "default"}\n${placed(value, width, justify)}`,
          ),
        ),
      ).join("\n\n") + "\n";

    expect(rendered).toBe(readFileSync(GOLDEN, "utf8"));
  });

  /*
   * `full` is the one mode the fixture above cannot hold, because this port
   * does not yet agree with the reference on it and a golden that mixes the
   * two provenances is worth nothing.
   *
   * Rich distributes the gap *between* the words and leaves the paragraph's
   * final line alone; this port packs the gap on the right and pads every
   * line. The difference is structural rather than arithmetic: Rich's
   * `Lines.justify` holds every line of the render at once, which is what lets
   * it both widen the gaps between words and recognise the last line.
   * `_justifyLine` is handed one line and cannot know either. Closing it means
   * restructuring the render loop, which is its own change (rich-table-6uy.8).
   *
   * Pinned here rather than left uncovered so the divergence is a measured
   * fact with the reference's own answer beside it, and so the day someone
   * closes it this test fails and says what to do about it: move `full` into
   * the fixture and regenerate.
   */
  it("fills the canvas for full, where Rich distributes the gap between words", () => {
    // Generated by the header's command with JUSTIFY = ["full"].
    expect(placed("aaaa bbbb cccc dddd", 12, "full")).toBe("aaaa bbbb   \ncccc dddd   ");
    const reference = "aaaa    bbbb\ncccc dddd";
    expect(placed("aaaa bbbb cccc dddd", 12, "full")).not.toBe(reference);
  });

  /*
   * Styling never moves the text. A span carries no cells, so every styled
   * variant of a line has to place exactly where its plain twin places — and
   * the plain twin is pinned to the reference by the fixture above, which is
   * what makes this a check against Rich rather than against ourselves. One
   * property covers what a hand-written styled case cannot: the corpus, every
   * width, every mode, and a span at every offset, which is the only way to
   * land one inside each run of a wrap's whitespace.
   *
   * It is here because segmentation is invisible from the outside and was
   * therefore free to matter. `hangingWhitespace` used to walk back through
   * the segments and stop at the first one not ending in whitespace, which an
   * empty segment resembles — and cropping a line to its budget leaves one.
   * A styled line that had been cropped thus reported no hanging whitespace
   * and was centred as though its content ran to the edge, so a span anywhere
   * in a wrap's trailing spaces silently un-centred the line it closed. None
   * of the plain corpus could see it: one segment per line leaves the crop
   * nothing to leave behind.
   */
  it("places a styled line exactly where it places the same text unstyled", () => {
    const mismatches: string[] = [];
    for (const [, value] of TEXTS)
      for (const width of WIDTHS)
        for (const justify of [...JUSTIFY, "full"] as const) {
          const plain = placed(value, width, justify);
          for (let offset = 0; offset < value.length; offset += 1) {
            const styled = new RichText(value);
            styled.stylize("red", offset, offset + 1);
            const rendered = [...styled.render({ maxWidth: width, justify })]
              .map((segment) => segment.text)
              .join("")
              .replace(/\n+$/, "");
            if (rendered !== plain) {
              mismatches.push(
                `${JSON.stringify(value)} w${width} ${justify ?? "default"} span@${offset}: ` +
                  `${JSON.stringify(rendered)} != ${JSON.stringify(plain)}`,
              );
            }
          }
        }

    expect(mismatches.slice(0, 4)).toEqual([]);
    expect(mismatches).toHaveLength(0);
  });

  /*
   * An unbounded offer is a width every renderable is expected to be handed —
   * `withBoundedWidth` exists to resolve one — and `justify` is the only thing
   * in `RichText.render` that pads, so it is the only thing an unresolved one
   * could reach. It did: `" ".repeat(Infinity)` throws `RangeError`, at two
   * separate sites, for four of the five modes. Pinned across every mode
   * because the two sites were reached by different ones and a fix at either
   * alone would still leave a live crash.
   */
  it("resolves an unbounded offer against its own natural width", () => {
    for (const justify of [undefined, "left", "center", "right", "full"] as const) {
      const rendered = [...new RichText("aaaa bbbb").render({ maxWidth: Infinity, justify })];
      const width = Math.max(...Segment.splitLines(rendered).map(Segment.getLineLength));
      expect(width, `justify=${justify ?? "default"}`).toBe(9);
    }
  });
});
