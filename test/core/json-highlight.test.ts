/*
 * `JSONHighlighter` and the `json.*` styles, pinned against Python Rich.
 *
 * [LAW:one-source-of-truth] `json-highlight.golden.json` is the reference's
 * own output: for each text, the spans Rich's `JSONHighlighter` lays on it and
 * the bytes a truecolor `Console.print` with that highlighter draws for it.
 * Regenerate it from Rich alone. Rich's own JSON tests write their inputs
 * inline, so the corpus repeats those three, then adds ours: escaped quotes,
 * every scalar, a value string followed by a key, tokens inside a string, word
 * characters outside ASCII — where Python's `\w`, `\b` and `\d` on a `str`
 * differ from JavaScript's, one of them astral — and line and paragraph
 * separators (U+2028, U+2029) inside a string, which Python's `.` matches and
 * JavaScript's does not. This is the command the
 * committed fixture came out of; run it from the repository root:
 *
 *     git clone -q --depth 1 --branch v15.0.0 https://github.com/Textualize/rich /tmp/rich-src
 *     PYTHONPATH=/tmp/rich-src uv run python - > test/core/json-highlight.golden.json <<'PY'
 *     import io, json, sys
 *     from rich.console import Console
 *     from rich.highlighter import JSONHighlighter
 *     TEXTS = [
 *         json.dumps({"name": "apple", "count": 1}, indent=4), '"abc"', '""',
 *         '{"k": ["a", "b \\"q\\" c"]}', '{"n": 1.5, "t": true, "f": false, "z": null}',
 *         '{"a": "b", "c": 1}', '{"s": "true 12 [x]"}',
 *         'é"x"', 'étrue', 'trueé', 'é12', '12é', '1e٣', '{"café": "naïve", "n": -3.5e2}',
 *         '\U0001D400true', '"a\u2028b": 1', '"a\u2029b": 1',
 *     ]
 *     cases = []
 *     for text in TEXTS:
 *         hl = JSONHighlighter()(text)
 *         out = io.StringIO()
 *         Console(file=out, color_system="truecolor", force_terminal=True, width=200, legacy_windows=False, highlighter=JSONHighlighter()).print(text, markup=False)
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
import { JSONHighlighter } from "../../src/core/highlighter.js";

interface Case {
  text: string;
  spans: [number, number, string][];
  ansi: string;
}

const CASES = JSON.parse(
  readFileSync(new URL("./json-highlight.golden.json", import.meta.url), "utf8"),
) as Case[];

function printed(text: string): string {
  const chunks: string[] = [];
  const console = new Console({
    file: { write: (chunk) => void chunks.push(String(chunk)) },
    width: 200,
    colorSystem: "truecolor",
    markup: false,
    highlighter: new JSONHighlighter(),
  });
  console.print(text);
  return chunks.join("");
}

describe("JSONHighlighter against Python Rich", () => {
  it.each(CASES)("lays Rich's spans on $text", ({ text, spans }) => {
    const highlighted = new JSONHighlighter().call(text);
    expect(highlighted.spans.map((s) => [s.start, s.end, s.style])).toEqual(spans);
  });

  it.each(CASES)("prints Rich's bytes for $text", ({ text, ansi }) => {
    expect(JSON.stringify(printed(text))).toBe(JSON.stringify(ansi));
  });
});
