/**
 * Every place a renderable takes caller content draws a string's markup the
 * way Rich does: as style, never as literal tags. Each site is checked through
 * what reaches the terminal, so a site that grows its own string handling again
 * goes red here. [LAW:behavior-not-structure]
 */
import { describe, expect, it } from "vitest";
import { cellLen } from "../../src/core/cells.js";
import { Console, type ConsoleOptions, type PrintOptions } from "../../src/core/console.js";
import { Highlighter } from "../../src/core/highlighter.js";
import { renderToString } from "../../src/core/render.js";
import type { Renderable } from "../../src/core/protocol.js";
import { RichText } from "../../src/core/text.js";
import { Columns } from "../../src/renderables/columns.js";
import { Layout } from "../../src/renderables/layout.js";
import { Padding } from "../../src/renderables/padding.js";
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
  ["a padding's body", (content) => new Padding(content, 1)],
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

  // Markup that styles nothing is a label of two spaces, as Rich's is — pinned
  // in panel.test.ts and rule.test.ts against the reference.
  it("draws the plain line for an empty title, string or RichText", () => {
    const plain = (r: Renderable) => renderToString(r, { width: 12 }).replace(/\x1b\[[0-9;]*m/g, "");
    for (const empty of ["", new RichText("")]) {
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

/**
 * A console's own settings decide how a string embedded in a renderable is
 * read, as Rich's `render_str` has them decide. Which sites highlight is
 * Rich's per-site choice, pinned here site by site: `Panel`, `Table` and
 * `Tree` draw their strings plain, and a panel's title and subtitle are markup
 * whatever the console says.
 */
describe("a console's markup and highlight settings, in content embedded in a renderable", () => {
  const UNDERLINE = "\x1b[4m";

  /** Underlines everything it is handed, so its reach is one escape to find. */
  class Underliner extends Highlighter {
    highlight(text: RichText): void {
      text.stylize("underline");
    }
  }

  // Print options are passed only when there are some: a trailing `{}` is data
  // to `print`, not options, and would be printed.
  function printed(renderable: Renderable, settings: ConsoleOptions = {}, ...print: [PrintOptions?]): string {
    const chunks: string[] = [];
    const file = { write: (data: string) => void chunks.push(data) };
    const console = new Console({ file, width: 40, colorSystem: "ansi", ...settings });
    console.print(renderable, ...print);
    return chunks.join("");
  }

  function table(slot: "cell" | "header" | "footer" | "title" | "caption") {
    return (content: string): Renderable => {
      const t = new Table({
        showFooter: slot === "footer",
        ...(slot === "title" ? { title: content } : {}),
        ...(slot === "caption" ? { caption: content } : {}),
      });
      t.addColumn(slot === "header" ? content : "a header wider than any content", slot === "footer" ? { footer: content } : {});
      t.addRow(slot === "cell" ? content : "x");
      return t;
    };
  }

  const highlighted: [string, (content: string) => Renderable][] = [
    ["a rule's title", (content) => new Rule(content)],
    ["a column item", (content) => new Columns([content])],
    ["a layout pane", (content) => new Layout(content)],
    ["a padding's body", (content) => new Padding(content, 1)],
  ];
  const plain: [string, (content: string) => Renderable][] = [
    ["a panel's body", (content) => new Panel(content)],
    ["a tree label", (content) => new Tree(content)],
    ["a table cell", table("cell")],
    ["a table header", table("header")],
    ["a table footer", table("footer")],
    ["a table title", table("title")],
    ["a table caption", table("caption")],
  ];
  const alwaysMarkup: [string, (content: string) => Renderable][] = [
    ["a panel's title", (content) => new Panel("body", { title: content })],
    ["a panel's subtitle", (content) => new Panel("body", { subtitle: content })],
  ];

  for (const [site, build] of [...highlighted, ...plain]) {
    it(`draws the tags in ${site} under a console with markup off`, () => {
      expect(printed(build("[bold]Hello[/bold]"), { markup: false })).toContain("[bold]Hello[/bold]");
    });

    it(`draws the tags in ${site} printed with markup off`, () => {
      expect(printed(build("[bold]Hello[/bold]"), {}, { markup: false })).toContain("[bold]Hello[/bold]");
    });
  }

  for (const [site, build] of alwaysMarkup) {
    it(`reads ${site} as markup under a console with markup off, as Rich's Panel does`, () => {
      const out = printed(build("[bold]Hello[/bold]"), { markup: false });
      expect(out).not.toContain("[bold]");
      expect(out).toContain(`${BOLD}Hello`);
    });
  }

  for (const [site, build] of highlighted) {
    it(`highlights ${site} with the console's highlighter`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner() })).toContain(UNDERLINE);
    });

    it(`does not highlight ${site} under a console with highlight off`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner(), highlight: false })).not.toContain(UNDERLINE);
    });

    it(`does not highlight ${site} printed with highlight off`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner() }, { highlight: false })).not.toContain(UNDERLINE);
    });
  }

  for (const [site, build] of [...plain, ...alwaysMarkup]) {
    it(`draws ${site} unhighlighted, as Rich does`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner() })).not.toContain(UNDERLINE);
    });
  }

  // Rich's `Table(highlight=)` and `Column(highlight=)`: the column's setting
  // is the cell's `options.update(highlight=column.highlight)`, so it decides
  // over the console's `highlight` and print's, with the console's highlighter.
  function highlightTable(slot: "cell" | "header" | "footer", own: "table" | "column") {
    return (content: string): Renderable => {
      const t = new Table({ showFooter: slot === "footer", highlight: own === "table" });
      t.addColumn(slot === "header" ? content : "a header wider than any content", {
        ...(slot === "footer" ? { footer: content } : {}),
        ...(own === "column" ? { highlight: true } : {}),
      });
      t.addRow(slot === "cell" ? content : "x");
      return t;
    };
  }
  const highlightedTable: [string, (content: string) => Renderable][] = [
    ["a highlight table's cell", highlightTable("cell", "table")],
    ["a highlight table's header", highlightTable("header", "table")],
    ["a highlight table's footer", highlightTable("footer", "table")],
    ["a highlight column's cell", highlightTable("cell", "column")],
    ["a highlight column's header", highlightTable("header", "column")],
    ["a highlight column's footer", highlightTable("footer", "column")],
  ];

  for (const [site, build] of highlightedTable) {
    it(`highlights ${site} with the console's highlighter`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner() })).toContain(UNDERLINE);
    });

    it(`highlights ${site} under a console with highlight off, as Rich's column setting outranks it`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner(), highlight: false })).toContain(UNDERLINE);
    });

    it(`highlights ${site} printed with highlight off`, () => {
      expect(printed(build("Hello"), { highlighter: new Underliner() }, { highlight: false })).toContain(UNDERLINE);
    });
  }

  it("highlights a highlight column under renderToString with the highlighter it is handed, and plain strings stay plain", () => {
    const t = new Table({ highlight: true, showHeader: false });
    t.addColumn();
    t.addRow("Hello");
    expect(renderToString(t, { highlighter: new Underliner() })).toContain(UNDERLINE);
    expect(renderToString(new Columns(["Hello"]), { highlighter: new Underliner(), highlight: false })).not.toContain(UNDERLINE);
  });

  it("draws a highlight table's highlight: false column, title and caption plain", () => {
    const t = new Table({ highlight: true, title: "Hello", caption: "Hello" });
    t.addColumn("Hello", { highlight: false });
    t.addRow("Hello");
    expect(printed(t, { highlighter: new Underliner() })).not.toContain(UNDERLINE);
  });

  it("leaves a RichText cell in a highlight column as it was styled, as Rich highlights only strings", () => {
    const t = new Table({ highlight: true, showHeader: false });
    t.addColumn();
    t.addRow(new RichText("Hello"));
    expect(printed(t, { highlighter: new Underliner() })).not.toContain(UNDERLINE);
  });

  it("repr-highlights column items under a default console, as print does", () => {
    const cyan = "\x1b[36m1";
    expect(printed(new Columns(["1", "True"]))).toContain(cyan);
  });

  for (const [site, build] of [...highlighted, ...plain]) {
    it(`replaces emoji codes in ${site} under a console with markup off, as Rich's render_str does`, () => {
      expect(printed(build("[b]:smile:"), { markup: false })).toContain("[b]😄");
    });
  }

  it("replaces emoji codes in a string printed with markup off, as Rich's render_str does", () => {
    const chunks: string[] = [];
    new Console({ file: { write: (data: string) => void chunks.push(data) }, markup: false }).print("[b]:smile:");
    expect(chunks.join("")).toBe("[b]😄\n");
  });

  it("reads one renderable's strings afresh under each console that draws it", () => {
    const panel = new Panel("[bold]Hello[/bold]");
    expect(printed(panel)).toContain(`${BOLD}Hello`);
    expect(printed(panel, { markup: false })).toContain("[bold]Hello[/bold]");
    expect(printed(panel)).toContain(`${BOLD}Hello`);
  });

  it("takes back a column's header or footer read off another column", () => {
    const t = new Table({ showFooter: true });
    t.addColumn("[bold]left[/bold]", { footer: "[bold]total[/bold]" });
    t.addColumn("right");
    t.columns[1]!.header = t.columns[0]!.header;
    t.columns[1]!.footer = t.columns[0]!.footer;
    const out = printed(t, { colorSystem: null });
    expect(out.match(/left/g)).toHaveLength(2);
    expect(out.match(/total/g)).toHaveLength(2);
    expect(out).not.toContain("[bold]");
  });

  it("raises an unmatched closing tag from the print that draws it, not from the constructor", () => {
    const panel = new Panel("[/bold]");
    expect(() => printed(panel)).toThrow(/Closing tag/);
    expect(printed(panel, { markup: false })).toContain("[/bold]");
  });
});
