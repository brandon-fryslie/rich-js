/**
 * Every place a renderable takes caller content draws a string's markup the
 * way Rich does: as style, never as literal tags. Each site is checked through
 * what reaches the terminal, so a site that grows its own string handling again
 * goes red here. [LAW:behavior-not-structure]
 */
import { describe, expect, it } from "vitest";
import { renderToString } from "../../src/core/render.js";
import type { Renderable } from "../../src/core/protocol.js";
import { RichText } from "../../src/core/text.js";
import { Columns } from "../../src/renderables/columns.js";
import { Layout } from "../../src/renderables/layout.js";
import { Panel } from "../../src/renderables/panel.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";

const BOLD = "\x1b[1m";

const sites: [string, (content: string) => Renderable][] = [
  ["a panel's body", (content) => new Panel(content)],
  ["a tree label", (content) => new Tree(content)],
  ["a column item", (content) => new Columns([content])],
  ["a layout pane", (content) => new Layout(content)],
  [
    "a table cell",
    (content) => {
      const table = new Table();
      table.addColumn("h");
      table.addRow(content);
      return table;
    },
  ],
];

describe("content embedded in a renderable", () => {
  for (const [site, build] of sites) {
    it(`parses markup in ${site}`, () => {
      const out = renderToString(build("[bold]Hello[/bold]"), { width: 30 });
      expect(out).not.toContain("[bold]");
      expect(out).toContain(`${BOLD}Hello`);
    });
  }

  it("leaves a RichText's brackets alone, and the caller's object unchanged", () => {
    const text = new RichText("[bold]kept[/bold]");
    expect(renderToString(new Panel(text), { width: 30 })).toContain("[bold]kept[/bold]");
    expect(text.end).toBe("\n");
  });
});
