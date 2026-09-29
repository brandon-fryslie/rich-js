/**
 * Every place a renderable takes caller content draws a string's markup the
 * way Rich does: as style, never as literal tags. Each site is checked through
 * what reaches the terminal, so a site that grows its own string handling again
 * goes red here. [LAW:behavior-not-structure]
 */
import { describe, expect, it } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import { renderToString } from "../../src/core/render.js";
import type { Renderable } from "../../src/core/protocol.js";
import { RichText } from "../../src/core/text.js";
import { Columns } from "../../src/renderables/columns.js";
import { Layout } from "../../src/renderables/layout.js";
import { Panel } from "../../src/renderables/panel.js";
import { Rule } from "../../src/renderables/rule.js";
import { Table } from "../../src/renderables/table.js";
import { Tree } from "../../src/renderables/tree.js";

const BOLD = "\x1b[1m";

const sites: [string, (content: string | RichText) => Renderable][] = [
  ["a panel's body", (content) => new Panel(content)],
  ["a panel's title", (content) => new Panel("body", { title: content })],
  ["a panel's subtitle", (content) => new Panel("body", { subtitle: content })],
  ["a rule's title", (content) => new Rule(content)],
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

  for (const [site, build] of sites) {
    it(`leaves a RichText's brackets and styles alone in ${site}, and the caller's object unchanged`, () => {
      const text = new RichText("[x] ").append("kept", "italic");
      const out = renderToString(build(text), { width: 30 });
      expect(out).toContain("[x] ");
      expect(out).toContain("\x1b[3mkept");
      expect(text.end).toBe("\n");
    });
  }

  const badlyStyled: [string, () => string | RichText][] = [
    ["markup", () => "[bold rd]Hello[/]"],
    ["a RichText span", () => new RichText("He").append("llo", "bold rd")],
  ];

  for (const [site, build] of sites) {
    for (const [form, content] of badlyStyled) {
      it(`draws a style it cannot parse in ${site}, written as ${form}, as plain text, and reports it once`, () => {
        const heard: string[] = [];
        const out = renderToString(build(content()), {
          width: 30,
          onStyleError: (_error, style) => void heard.push(style),
        });
        expect(out).toBe(renderToString(build("Hello"), { width: 30 }));
        expect(heard).toEqual(["bold rd"]);
      });
    }
  }

  it("draws the plain line for a title with no text, however it is spelled", () => {
    const plain = (r: Renderable) => renderToString(r, { width: 12 }).replace(/\x1b\[[0-9;]*m/g, "");
    for (const empty of ["", new RichText(""), "[bold][/bold]"]) {
      expect(plain(new Rule(empty))).toBe(plain(new Rule()));
      expect(plain(new Panel("x", { title: empty, subtitle: empty }))).toBe(plain(new Panel("x")));
    }
  });

  it("keeps both spaces around a label whose RichText is justified", () => {
    const top = renderToString(new Panel("hi", { title: new RichText("x", { justify: "right" }), width: 17 }), { width: 17 }).split("\n")[0]!;
    expect(top.replace(/\x1b\[[0-9;]*m/g, "")).toBe("╭────── x ──────╮");
  });

  it("draws a value that is not a string as it is written, without reading markup in it", () => {
    const out = renderToString(new Columns([{ a: 1 }, "[bold]b[/bold]"]), { width: 40 });
    expect(out).toContain("[object Object]");
    expect(out).toContain(`${BOLD}b`);
  });

  // The label is cut by cells, so a wide character never lands half inside
  // the border and pushes the corner out of line.
  it("cuts a title too wide for its border by cells, keeping the border square", () => {
    const lines = renderToString(new Panel("x", { title: "[bold]漢字漢字漢字漢字[/bold]", width: 10 }), { width: 10 }).split("\n");
    const widths = lines.filter((l) => l !== "").map((l) => cellLen(l.replace(/\x1b\[[0-9;]*m/g, "")));
    expect(new Set(widths)).toEqual(new Set([10]));
  });
});
