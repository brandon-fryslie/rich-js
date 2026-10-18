/*
 * A padded table at every width from the one that holds its frame to the one
 * that holds its content, pinned against Python Rich (rich-unfiled-791c.gxf4).
 *
 * A squeezed cell pays its padding before its content, as the reference's
 * `Padding` does, so a cell narrower than its padding is drawn blank. This
 * sweep is what holds that, along with which column the reference hands the
 * odd cell when it collapses them.
 *
 * `table-squeeze.golden.txt` is the reference's own output, never this
 * library's: regenerating it from here would launder a regression into the
 * fixture. It came out of this command, run from the repository root:
 *
 *     uv run --with "rich==15.*" python - \
 *       > test/renderables/table-squeeze.golden.txt <<'PY'
 *     from rich.console import Console
 *     from rich.table import Table
 *     import sys
 *     CASES = [
 *         ("one-column", dict(padding=(0, 1)), [["ab"]]),
 *         ("two-columns", dict(padding=(0, 1)), [["ab", "cd"]]),
 *         ("two-columns-header", dict(padding=(0, 1), show_header=True), [["ab", "cd"]]),
 *         ("three-columns-uneven", dict(padding=(0, 2)), [["alpha", "b", "gamma ray"]]),
 *         ("padded-all-sides", dict(padding=1), [["ab", "cd"]]),
 *     ]
 *     c = Console(width=80, no_color=True, force_terminal=False, legacy_windows=False)
 *     blocks = []
 *     for name, opts, rows in CASES:
 *         opts = {"show_header": False, **opts}
 *         columns = len(rows[0])
 *         def table():
 *             t = Table(**opts)
 *             for i in range(columns): t.add_column(f"h{i}")
 *             for row in rows: t.add_row(*row)
 *             return t
 *         frame = 2 + (columns - 1)
 *         natural = c.measure(table(), options=c.options.update(width=80)).maximum
 *         for width in range(frame, natural + 1):
 *             lines = c.render_lines(table(), c.options.update(width=width), pad=False)
 *             blocks.append(f"{name} {width}\n" + "\n".join("".join(s.text for s in line) for line in lines))
 *     sys.stdout.write("\n\n".join(blocks) + "\n")
 *     PY
 *
 * `render_lines(..., pad=False)` and not `Console.print`: it crops each line
 * to the width, as this library's renderables do, where `print` would let a
 * reference row past it. Trailing spaces are significant; do not trim the file.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { Segment } from "../../src/core/segment.js";
import { Table, type TableOptions } from "../../src/renderables/table.js";

const GOLDEN = new URL("./table-squeeze.golden.txt", import.meta.url);

// [LAW:one-source-of-truth] The same cases as the generator, in its order.
const CASES: readonly (readonly [string, TableOptions, readonly string[]])[] = [
  ["one-column", { padding: [0, 1] }, ["ab"]],
  ["two-columns", { padding: [0, 1] }, ["ab", "cd"]],
  ["two-columns-header", { padding: [0, 1], showHeader: true }, ["ab", "cd"]],
  ["three-columns-uneven", { padding: [0, 2] }, ["alpha", "b", "gamma ray"]],
  ["padded-all-sides", { padding: 1 }, ["ab", "cd"]],
];

function table(options: TableOptions, row: readonly string[]): Table {
  const t = new Table({ showHeader: false, ...options });
  row.forEach((_, index) => t.addColumn(`h${index}`));
  t.addRow(...row);
  return t;
}

describe("a squeezed padded table", () => {
  it("draws the rows Python Rich draws at every width from its frame to its content", () => {
    const rendered = CASES.flatMap(([name, options, row]) => {
      const frame = 2 + (row.length - 1);
      const natural = table(options, row).measure({ maxWidth: 80 }).maximum;
      return Array.from({ length: natural - frame + 1 }, (_, offset) => {
        const width = frame + offset;
        const lines = Segment.splitLines([...table(options, row).render({ maxWidth: width })])
          .map((line) => line.map((segment) => segment.text).join(""));
        return `${name} ${width}\n${lines.join("\n")}`;
      });
    }).join("\n\n") + "\n";

    expect(rendered).toBe(readFileSync(GOLDEN, "utf8"));
  });
});
