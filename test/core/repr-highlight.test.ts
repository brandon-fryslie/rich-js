/*
 * `ReprHighlighter` and the `repr.*` styles, pinned against Python Rich.
 *
 * [LAW:one-source-of-truth] `repr-highlight.golden.json` is the reference's
 * own output: for each text, the spans Rich's `ReprHighlighter` lays on it
 * and the bytes a truecolor `Console.print` draws for it. A golden generated
 * from this library could only notice a change, never that it was wrong, so
 * regenerate it from Rich alone. The corpus is every string in Rich's own
 * `highlight_tests`, imported rather than copied, plus three of ours: the
 * repro from rich-highlighter-nct1, non-ASCII word characters, and a call
 * repr. This is the command the committed fixture came out of; run it from
 * the repository root:
 *
 *     git clone -q --depth 1 --branch v15.0.0 https://github.com/Textualize/rich /tmp/rich-src
 *     PYTHONPATH=/tmp/rich-src:/tmp/rich-src/tests uv run --with pytest python - \
 *       > test/core/repr-highlight.golden.json <<'PY'
 *     import io, json, sys
 *     from rich.console import Console
 *     from rich.highlighter import ReprHighlighter
 *     from test_highlighter import highlight_tests
 *     EXTRA = ["x=12 True foo(a=1)", "café=1 naïve=True ünï(1)", "Foo(bar=None, baz=[1, 2.5, -3e4], ok=False)"]
 *     cases = []
 *     for text in [t for t, _ in highlight_tests] + EXTRA:
 *         hl = ReprHighlighter()(text)
 *         out = io.StringIO()
 *         Console(file=out, color_system="truecolor", force_terminal=True, width=200, legacy_windows=False).print(text, markup=False, emoji=False)
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
import { ReprHighlighter } from "../../src/core/highlighter.js";

interface Case {
  text: string;
  spans: [number, number, string][];
  ansi: string;
}

const CASES = JSON.parse(
  readFileSync(new URL("./repr-highlight.golden.json", import.meta.url), "utf8"),
) as Case[];

function printed(text: string): string {
  const chunks: string[] = [];
  const console = new Console({
    file: { write: (chunk) => void chunks.push(String(chunk)) },
    width: 200,
    colorSystem: "truecolor",
    markup: false,
  });
  console.print(text);
  return chunks.join("");
}

describe("ReprHighlighter against Python Rich", () => {
  it.each(CASES)("lays Rich's spans on $text", ({ text, spans }) => {
    const highlighted = new ReprHighlighter().call(text);
    expect(highlighted.spans.map((s) => [s.start, s.end, s.style])).toEqual(spans);
  });

  it.each(CASES)("prints Rich's bytes for $text", ({ text, ansi }) => {
    expect(JSON.stringify(printed(text))).toBe(JSON.stringify(ansi));
  });
});
