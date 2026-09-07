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
 *              ("uneven", "a  bb cccc dddd"),
 *              ("hanging-space", "aaaa      bbbb"),
 *              ("unbreakable", "aaaaaaaaaaaaaaaaaaaa"),
 *              ("multiline", "one\ntwo three four five"),
 *              ("trailing-space", "words then space   "),
 *              ("wide", "日本語のテキストです"),
 *              ("short", "hi")]
 *     WIDTHS = [8, 12, 20]
 *     JUSTIFY = [None, "left", "center", "right", "full"]
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
 * `hangingWhitespace` exists. `uneven` fills a line whose slack will not
 * divide evenly across its three gaps, two of which are one run of spaces the
 * author wrote — buying the two arms `full` has and no other mode does: which
 * gap takes the odd cell, and that a run of n spaces is n gaps rather than
 * one. Every other text fills a line holding at most a single gap, where
 * every way of spreading a remainder agrees. `hanging-space` makes that run
 * long enough that measuring it wrong is visible rather than a single cell.
 * `unbreakable` never wraps, so it pins placement of a line that fills or
 * overruns the canvas with no hanging whitespace at all. `multiline` gives one render lines of
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
 * `full` IS THE ONE MODE THAT READS MORE THAN THE LINE IN HAND. The
 * reference widens the gaps of every line of a paragraph but the last, and
 * leaves that last one ragged — so its blocks pin two facts together: where
 * the slack goes, and which line gets none. `hanging-space` and
 * `trailing-space` are what hold them apart, both ending in whitespace and
 * only the second of them doing so on a line that ends a paragraph.
 *
 * What the fixture cannot pin is the style on the spaces `full` inserts,
 * because it is generated with `no_color` and every gap in it comes out
 * unstyled. The last test in this file covers that separately.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";

const GOLDEN = new URL("./text-justify.golden.txt", import.meta.url);

const TEXTS: readonly (readonly [string, string])[] = [
  ["sentence", "aaaa bbbb cccc dddd"],
  ["uneven", "a  bb cccc dddd"],
  ["hanging-space", "aaaa      bbbb"],
  ["unbreakable", "aaaaaaaaaaaaaaaaaaaa"],
  ["multiline", "one\ntwo three four five"],
  ["trailing-space", "words then space   "],
  ["wide", "日本語のテキストです"],
  ["short", "hi"],
];
const WIDTHS: readonly number[] = [8, 12, 20];
const JUSTIFY: readonly RenderOptions["justify"][] = [
  undefined,
  "left",
  "center",
  "right",
  "full",
];

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
        for (const justify of JUSTIFY) {
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
   * The style on the spaces `full` inserts, which the fixture cannot reach:
   * it is generated with `no_color`, so every gap in it is unstyled.
   *
   * Rich builds each widened gap fresh rather than stretching the separator
   * it replaces, and gives it the style the characters either side turn
   * towards it — theirs where the two agree, the line's own where they do
   * not. Dropping the separator's own style is the part that surprises: a
   * span covering nothing but the space it sat on survives in every other
   * mode and vanishes in this one. Generated from the reference:
   *
   *     PYTHONPATH=/tmp/rich-src python3 - <<'PY'
   *     from rich.console import Console
   *     from rich.text import Text
   *     console = Console(no_color=True, force_terminal=False, legacy_windows=False)
   *     for spans in ([(0, 9, "red")], [(0, 4, "red"), (5, 9, "red")],
   *                   [(0, 4, "red")], [(0, 4, "red"), (5, 9, "blue")],
   *                   [(4, 5, "red")]):
   *         text = Text("aaaa bbbb cccc dddd")
   *         for start, end, style in spans: text.stylize(style, start, end)
   *         options = console.options.update(max_width=12, justify="full")
   *         print(spans, [(s.text, str(s.style)) for s in console.render(text, options)][:3])
   *     PY
   */
  it("styles an inserted gap from the words it separates", () => {
    const gapStyle = (...spans: (readonly [number, number, string])[]): string => {
      const text = new RichText("aaaa bbbb cccc dddd");
      for (const [start, end, style] of spans) text.stylize(style, start, end);
      // The run of spaces `full` inserted is the only all-whitespace segment:
      // every other one carries a word, and the gap is built as its own.
      return (
        [...text.render({ maxWidth: 12, justify: "full" })]
          .find((segment) => /^ +$/.test(segment.text))
          ?.style?.toString() ?? "none"
      );
    };

    expect(gapStyle([0, 9, "red"])).toBe("red");
    expect(gapStyle([0, 4, "red"], [5, 9, "red"])).toBe("red");
    expect(gapStyle([0, 4, "red"])).toBe("none");
    expect(gapStyle([0, 4, "red"], [5, 9, "blue"])).toBe("none");
    expect(gapStyle([4, 5, "red"])).toBe("none");
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
