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
 *         ("one-column", "table", dict(padding=(0, 1)), [{}], ["ab"]),
 *         ("two-columns", "table", dict(padding=(0, 1)), [{}, {}], ["ab", "cd"]),
 *         ("two-columns-header", "table", dict(padding=(0, 1), show_header=True), [{}, {}], ["ab", "cd"]),
 *         ("three-columns-uneven", "table", dict(padding=(0, 2)), [{}, {}, {}], ["alpha", "b", "gamma ray"]),
 *         ("padded-all-sides", "table", dict(padding=1), [{}, {}], ["ab", "cd"]),
 *         ("declared-width", "table", dict(padding=(0, 1)), [{}, dict(width=4)], ["abc def", "ghijkl"]),
 *         ("two-declared-widths", "table", dict(padding=(0, 1), show_header=True), [dict(width=4), dict(width=6)], ["x", "y"]),
 *         ("no-wrap", "table", dict(padding=(0, 1)), [dict(no_wrap=True), {}], ["abc def", "gh ij"]),
 *         ("collapse-padding", "table", dict(padding=(0, 2), collapse_padding=True), [{}, {}, {}], ["ab", "cd", "ef"]),
 *         ("no-pad-edge", "table", dict(padding=(0, 1), pad_edge=False), [{}, {}], ["ab", "cd"]),
 *         ("grid", "grid", dict(padding=(0, 1)), [{}, {}, {}], ["ab", "cd", "ef"]),
 *         ("grid-no-wrap", "grid", dict(padding=0), [dict(no_wrap=True)] * 3, ["xxxx", "yy", "zz"]),
 *         ("no-wrap-beside-declared-width", "table", dict(padding=(0, 1)), [dict(no_wrap=True), dict(width=4)], ["abcdef", "x"]),
 *     ]
 *     c = Console(width=80, no_color=True, force_terminal=False, legacy_windows=False)
 *     blocks = []
 *     for name, kind, opts, columns, row in CASES:
 *         def table():
 *             t = Table.grid(**opts) if kind == "grid" else Table(**{"show_header": False, **opts})
 *             for i, column in enumerate(columns): t.add_column(f"h{i}", **column)
 *             t.add_row(*row)
 *             return t
 *         frame = max(1, 0 if kind == "grid" else 2 + (len(columns) - 1))
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
import { Table, type ColumnOptions, type TableOptions } from "../../src/renderables/table.js";

const GOLDEN = new URL("./table-squeeze.golden.txt", import.meta.url);

// [LAW:one-source-of-truth] The same cases as the generator, in its order.
const CASES: readonly (readonly [string, "table" | "grid", TableOptions, readonly ColumnOptions[], readonly string[]])[] = [
  ["one-column", "table", { padding: [0, 1] }, [{}], ["ab"]],
  ["two-columns", "table", { padding: [0, 1] }, [{}, {}], ["ab", "cd"]],
  ["two-columns-header", "table", { padding: [0, 1], showHeader: true }, [{}, {}], ["ab", "cd"]],
  ["three-columns-uneven", "table", { padding: [0, 2] }, [{}, {}, {}], ["alpha", "b", "gamma ray"]],
  ["padded-all-sides", "table", { padding: 1 }, [{}, {}], ["ab", "cd"]],
  ["declared-width", "table", { padding: [0, 1] }, [{}, { width: 4 }], ["abc def", "ghijkl"]],
  ["two-declared-widths", "table", { padding: [0, 1], showHeader: true }, [{ width: 4 }, { width: 6 }], ["x", "y"]],
  ["no-wrap", "table", { padding: [0, 1] }, [{ noWrap: true }, {}], ["abc def", "gh ij"]],
  ["collapse-padding", "table", { padding: [0, 2], collapsePadding: true }, [{}, {}, {}], ["ab", "cd", "ef"]],
  ["no-pad-edge", "table", { padding: [0, 1], padEdge: false }, [{}, {}], ["ab", "cd"]],
  ["grid", "grid", { padding: [0, 1] }, [{}, {}, {}], ["ab", "cd", "ef"]],
  ["grid-no-wrap", "grid", { padding: 0 }, [{ noWrap: true }, { noWrap: true }, { noWrap: true }], ["xxxx", "yy", "zz"]],
  ["no-wrap-beside-declared-width", "table", { padding: [0, 1] }, [{ noWrap: true }, { width: 4 }], ["abcdef", "x"]],
];

function table(
  kind: "table" | "grid",
  options: TableOptions,
  columns: readonly ColumnOptions[],
  row: readonly string[],
): Table {
  const t = kind === "grid" ? Table.grid(options) : new Table({ showHeader: false, ...options });
  columns.forEach((column, index) => t.addColumn(`h${index}`, column));
  t.addRow(...row);
  return t;
}

describe("a squeezed padded table", () => {
  it("draws the rows Python Rich draws at every width from its frame to its content", () => {
    const rendered = CASES.flatMap(([name, kind, options, columns, row]) => {
      const make = (): Table => table(kind, options, columns, row);
      const frame = Math.max(1, kind === "grid" ? 0 : 2 + (columns.length - 1));
      const natural = make().measure({ maxWidth: 80 }).maximum;
      return Array.from({ length: natural - frame + 1 }, (_, offset) => {
        const width = frame + offset;
        const lines = Segment.splitLines([...make().render({ maxWidth: width })])
          .map((line) => line.map((segment) => segment.text).join(""));
        return `${name} ${width}\n${lines.join("\n")}`;
      });
    }).join("\n\n") + "\n";

    expect(rendered).toBe(readFileSync(GOLDEN, "utf8"));
  });
});
