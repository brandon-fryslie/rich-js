"""Build src/core/grapheme-data.ts.

    uv run scripts/grapheme-data.py

The code points UAX #29 classes as Prepend, from the Unicode Character Database
at the version scripts/cell-widths.py pins, so where a Prepend's cluster ends is
the same on every Node and answers from the Unicode a width does. Moving to a
newer one is a change to this constant and those scripts' and a re-run of all.
"""

import urllib.request
from pathlib import Path

UNICODE = "17.0.0"
OUT = Path(__file__).resolve().parent.parent / "src/core/grapheme-data.ts"
WIDTH = 120
URL = f"https://www.unicode.org/Public/{UNICODE}/ucd/auxiliary/GraphemeBreakProperty.txt"

HEADER = f"""\
/**
 * The code points UAX #29 classes as Grapheme_Cluster_Break=Prepend. Generated
 * by scripts/grapheme-data.py from the Unicode {UNICODE} Character Database;
 * regenerate rather than edit.
 */

// Every range of Prepend code points as [first, last]: ascending, disjoint.
export const PREPEND_RANGES: readonly (readonly [number, number])[] = [
"""


def main() -> None:
    with urllib.request.urlopen(URL) as response:
        lines = response.read().decode("utf-8").splitlines()
    spans: list[list[int]] = []
    for line in lines:
        row = [field.strip() for field in line.split("#")[0].split(";")]
        if len(row) != 2 or row[1] != "Prepend":
            continue
        first, _, last = row[0].partition("..")
        a, b = int(first, 16), int(last or first, 16)
        spans.append([a, b])
    spans.sort()
    merged: list[list[int]] = []
    for a, b in spans:
        if merged and merged[-1][1] >= a:
            raise SystemExit(f"{a:#x} overlaps the range before it")
        if merged and merged[-1][1] + 1 == a:
            merged[-1][1] = b
        else:
            merged.append([a, b])

    out, line = [], "  "
    for a, b in merged:
        entry = f"[0x{a:x}, 0x{b:x}],"
        if len(line) + len(entry) + 1 > WIDTH:
            out.append(line.rstrip())
            line = "  "
        line += entry + " "
    out.append(line.rstrip())
    OUT.write_text(HEADER + "\n".join(out) + "\n];\n")
    print(f"{OUT}: {len(merged)} Prepend ranges")


if __name__ == "__main__":
    main()
