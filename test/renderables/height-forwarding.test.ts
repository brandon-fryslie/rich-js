import { describe, it, expect } from "vitest";
import { Columns } from "../../src/renderables/columns.js";
import { Group } from "../../src/renderables/group.js";
import { Layout } from "../../src/renderables/layout.js";
import { Padding } from "../../src/renderables/padding.js";
import { Panel } from "../../src/renderables/panel.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import type { Height, Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] What a child is handed, and what the frame
// around it keeps, under the `Height` contract in src/core/protocol.ts.

class Probe implements Renderable {
  seen: (Height | undefined)[] = [];
  render(options: RenderOptions): Iterable<Segment> {
    this.seen.push(options.height);
    return [new Segment("p"), Segment.line()];
  }
}

const region: RenderOptions = { maxWidth: 20, height: { rows: 8, exact: true } };

describe("a container filling its space with one child forwards the budget less its own rows", () => {
  it("Panel: two border rows and its vertical padding", () => {
    const probe = new Probe();
    [...new Panel(probe, { padding: [1, 1, 2, 1] }).render(region)];
    expect(probe.seen).toEqual([{ rows: 3, exact: true }]);
  });

  it("Padding: its top and bottom", () => {
    const probe = new Probe();
    [...new Padding(probe, [1, 0, 2, 0]).render(region)];
    expect(probe.seen).toEqual([{ rows: 5, exact: true }]);
  });

  it("rows that parse to no count hand on none", () => {
    const probe = new Probe();
    [...new Panel(probe).render({ maxWidth: 20, height: { rows: NaN, exact: true } })];
    expect(probe.seen).toEqual([{ rows: 0, exact: true }]);
  });

  it("a ceiling stays a ceiling", () => {
    const probe = new Probe();
    [...new Panel(probe).render({ maxWidth: 20, height: { rows: 8, exact: false } })];
    expect(probe.seen).toEqual([{ rows: 6, exact: false }]);
  });
});

describe("a container stacking several children hands each the rows as a ceiling", () => {
  const ceiling = { rows: 8, exact: false };

  it("Group", () => {
    const [a, b] = [new Probe(), new Probe()];
    [...new Group(a, b).render(region)];
    expect([...a.seen, ...b.seen]).toEqual([ceiling, ceiling]);
  });

  it("Columns", () => {
    const [a, b] = [new Probe(), new Probe()];
    [...new Columns([a, b]).render(region)];
    expect([...a.seen, ...b.seen]).toEqual([ceiling, ceiling]);
  });

  it("Table", () => {
    const [a, b] = [new Probe(), new Probe()];
    const table = Table.grid();
    table.addRow(a);
    table.addRow(b);
    [...table.render(region)];
    expect([...a.seen, ...b.seen]).toEqual([ceiling, ceiling]);
  });

  it("Tree", () => {
    const [a, b] = [new Probe(), new Probe()];
    const tree = new Tree(a);
    tree.add(b);
    [...tree.render(region)];
    expect([...a.seen, ...b.seen]).toEqual([ceiling, ceiling]);
  });
});

describe("a panel shapes the region it hands its content", () => {
  const rowsOf = (content: string, opts: RenderOptions): string[] =>
    [...new Panel(new RichText(content)).render(opts)]
      .map((s) => s.text).join("").split("\n").slice(0, -1);

  it("stretching its frame down a region its content leaves short", () => {
    const rows = rowsOf("a", { maxWidth: 10, height: { rows: 5, exact: true } });
    expect(rows).toHaveLength(5);
    expect(rows[4]).toMatch(/^╰─+╯$/);
  });

  it("cropping content that overflows it, above the bottom border", () => {
    const rows = rowsOf("1\n2\n3\n4\n5", { maxWidth: 10, height: { rows: 4, exact: true } });
    expect(rows.map((r) => r.trimEnd())).toEqual(["╭────────╮", "│ 1      │", "│ 2      │", "╰────────╯"]);
  });

  it("and under a ceiling, drawing at its content's height", () => {
    expect(rowsOf("a", { maxWidth: 10, height: { rows: 5, exact: false } })).toHaveLength(3);
  });
});

it("a panel around a layout in a layout pane keeps its bottom border", () => {
  const inner = new Layout();
  inner.splitColumn(new Layout("top"), new Layout("bottom"));
  const outer = new Layout();
  outer.splitColumn(new Layout(new Panel(inner)), new Layout("footer", { size: 1 }));

  const nine = { maxWidth: 20, height: { rows: 9, exact: true } };
  const rows = [...outer.render(nine)].map((s) => s.text).join("").split("\n").slice(0, -1);
  expect(rows).toHaveLength(9);
  expect(rows[7]).toMatch(/^╰─+╯$/);
  expect(rows[8]!.trimEnd()).toBe("footer");
});
