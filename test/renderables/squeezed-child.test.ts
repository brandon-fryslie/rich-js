/*
 * Each container at a width that leaves its child no column, pinned against
 * Python Rich (rich-unfiled-791c.wyrk). Rich draws every child through
 * `Console.render`, which draws nothing under one column; here every child is
 * drawn through `render` in src/core/protocol.ts, and this is what holds that
 * the containers around it draw what Rich's do. `Table` has its own sweep,
 * test/renderables/table-squeeze.test.ts.
 *
 * `squeezed-child.golden.json` is the reference's own output, never this
 * library's. It came out of this command, run from the repository root:
 *
 *     uv run --with "rich==15.*" python - \
 *       > test/renderables/squeezed-child.golden.json <<'PY'
 *     from rich.console import Console
 *     from rich.text import Text
 *     from rich.padding import Padding
 *     from rich.panel import Panel
 *     from rich.constrain import Constrain
 *     from rich.tree import Tree
 *     from rich.layout import Layout
 *     from rich.markdown import Markdown
 *     import json, sys
 *     def tree():
 *         t = Tree("root"); t.add("leaf"); return t
 *     def layout():
 *         l = Layout(); l.split_row(Layout(Text("ab")), Layout(Text("cd"))); return l
 *     CASES = [
 *         ("padding", lambda: Padding(Text("ab"), 1), 2, None),
 *         ("panel", lambda: Panel(Text("ab"), padding=(0, 1)), 4, None),
 *         ("panel-padded", lambda: Panel(Text("ab"), padding=1), 4, None),
 *         ("constrain", lambda: Constrain(Text("ab"), width=0), 10, None),
 *         ("tree", tree, 4, None),
 *         ("layout", layout, 1, 2),
 *         ("markdown-quote", lambda: Markdown("> ab"), 4, None),
 *         ("markdown-list", lambda: Markdown("- ab"), 3, None),
 *     ]
 *     c = Console(width=80, no_color=True, force_terminal=False, legacy_windows=False)
 *     rows = []
 *     for name, make, width, height in CASES:
 *         lines = c.render_lines(make(), c.options.update(width=width, height=height), pad=False)
 *         rows.append([name, width, height, ["".join(s.text for s in line) for line in lines]])
 *     sys.stdout.write("[\n" + ",\n".join("  " + json.dumps(r, ensure_ascii=False) for r in rows) + "\n]\n")
 *     PY
 *
 * JSON rather than joined text because no rows and one empty row are
 * different answers here, and joined they read the same.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { render, type Renderable } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Constrain } from "../../src/renderables/constrain.js";
import { Layout } from "../../src/renderables/layout.js";
import { Markdown } from "../../src/renderables/markdown.js";
import { Padding } from "../../src/renderables/padding.js";
import { Panel } from "../../src/renderables/panel.js";
import { Tree } from "../../src/renderables/tree.js";

type Case = [name: string, width: number, height: number | null, lines: string[]];
const GOLDEN = JSON.parse(readFileSync(new URL("./squeezed-child.golden.json", import.meta.url), "utf8")) as Case[];

// [LAW:one-source-of-truth] The generator's cases, by the names it gives them.
const MAKE: Record<string, () => Renderable> = {
  padding: () => new Padding(new RichText("ab"), 1),
  panel: () => new Panel(new RichText("ab"), { padding: [0, 1] }),
  "panel-padded": () => new Panel(new RichText("ab"), { padding: 1 }),
  constrain: () => new Constrain(new RichText("ab"), 0),
  tree: () => {
    const tree = new Tree("root");
    tree.add("leaf");
    return tree;
  },
  layout: () => {
    const layout = new Layout();
    layout.splitRow(new Layout(new RichText("ab")), new Layout(new RichText("cd")));
    return layout;
  },
  "markdown-quote": () => new Markdown("> ab"),
  "markdown-list": () => new Markdown("- ab"),
};

describe("a container that leaves its child no column", () => {
  it("covers every case the generator does", () => {
    expect(Object.keys(MAKE)).toEqual(GOLDEN.map(([name]) => name));
  });

  for (const [name, width, height, lines] of GOLDEN) {
    it(`${name} at ${width} draws the rows Python Rich draws`, () => {
      const options = { maxWidth: width, height: height === null ? undefined : { rows: height, exact: true } };
      const drawn = Segment.splitLines([...render(MAKE[name]!(), options)]).map((line) =>
        line.map((segment) => segment.text).join(""),
      );
      expect(drawn).toEqual(lines);
    });
  }
});
