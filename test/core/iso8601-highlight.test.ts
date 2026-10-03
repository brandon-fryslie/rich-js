/*
 * `ISO8601Highlighter` and the `iso8601.*` styles, pinned against Python Rich.
 *
 * [LAW:one-source-of-truth] `iso8601-highlight.golden.json` is the reference's
 * own output: for each text, the spans Rich's `ISO8601Highlighter` lays on it
 * and the bytes a truecolor `Console.print` with that highlighter draws for it.
 * Regenerate it from Rich alone. The corpus is every string in Rich's own
 * `iso8601_highlight_tests`, imported rather than copied, plus three of ours: a
 * value followed by other text, which Rich leaves unhighlighted; a value ending
 * in a newline, which Python's `$` still matches; and a dateTime carrying both
 * fractional seconds and an offset. This is the command the committed fixture
 * came out of; run it from the repository root:
 *
 *     git clone -q --depth 1 --branch v15.0.0 https://github.com/Textualize/rich /tmp/rich-src
 *     PYTHONPATH=/tmp/rich-src:/tmp/rich-src/tests uv run --with pytest python - \
 *       > test/core/iso8601-highlight.golden.json <<'PY'
 *     import io, json, sys
 *     from rich.console import Console
 *     from rich.highlighter import ISO8601Highlighter
 *     from test_highlighter import iso8601_highlight_tests
 *     EXTRA = ["2008-08-30 17:21:59 tail", "2008-08-30\n", "2008-08-30T01:45:36.123+07:00"]
 *     cases = []
 *     for text in [t for t, _ in iso8601_highlight_tests] + EXTRA:
 *         hl = ISO8601Highlighter()(text)
 *         out = io.StringIO()
 *         Console(file=out, color_system="truecolor", force_terminal=True, width=200, legacy_windows=False, highlighter=ISO8601Highlighter()).print(text, markup=False)
 *         cases.append({"text": text, "spans": [[s.start, s.end, s.style] for s in hl.spans], "ansi": out.getvalue()})
 *     json.dump(cases, sys.stdout, indent=1, ensure_ascii=False)
 *     sys.stdout.write("\n")
 *     PY
 *
 * Span order is asserted, not just the set: a later span lands on top, so
 * order is part of what Rich draws.
 */

import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import { ISO8601Highlighter } from "../../src/core/highlighter.js";

interface Case {
  text: string;
  spans: [number, number, string][];
  ansi: string;
}

const CASES = JSON.parse(
  readFileSync(new URL("./iso8601-highlight.golden.json", import.meta.url), "utf8"),
) as Case[];

function printed(text: string): string {
  const chunks: string[] = [];
  const console = new Console({
    file: { write: (chunk) => void chunks.push(String(chunk)) },
    width: 200,
    colorSystem: "truecolor",
    markup: false,
    highlighter: new ISO8601Highlighter(),
  });
  console.print(text);
  return chunks.join("");
}

describe("ISO8601Highlighter against Python Rich", () => {
  it.each(CASES)("lays Rich's spans on $text", ({ text, spans }) => {
    const highlighted = new ISO8601Highlighter().call(text);
    expect(highlighted.spans.map((s) => [s.start, s.end, s.style])).toEqual(spans);
  });

  it.each(CASES)("prints Rich's bytes for $text", ({ text, ansi }) => {
    expect(JSON.stringify(printed(text))).toBe(JSON.stringify(ansi));
  });
});
