import { describe, it, expect } from "vitest";
import { Tree } from "../../src/renderables/tree.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { Table } from "../../src/renderables/table.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectLines(r: Renderable, opts: RenderOptions): string[] {
  const segs = [...r.render(opts)];
  return Segment.splitLines(segs).map((l) => l.map((s) => s.text).join(""));
}

function collectSegments(r: Renderable, opts: RenderOptions): Segment[] {
  return [...r.render(opts)];
}

describe("Tree", () => {
  describe("construction", () => {
    it("constructs with a string label", () => {
      const tree = new Tree("Root");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines[0]).toContain("Root");
    });

    it("constructs with a RichText label", () => {
      // [SPEC] Labels can be styled RichText
      const label = new RichText("Styled Root");
      const tree = new Tree(label);
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines[0]).toContain("Styled Root");
    });

    it("children array is initially empty", () => {
      // [SPEC] .children — Array of child Tree nodes. Initially empty.
      const tree = new Tree("Root");
      expect(tree.children).toHaveLength(0);
    });

    it("expanded defaults to true", () => {
      // [SPEC] expanded default: true
      const tree = new Tree("Root");
      expect(tree.expanded).toBe(true);
    });
  });

  describe("building", () => {
    it(".add returns the new child Tree for chaining", () => {
      // [SPEC] .add(label, options?) — Adds a child Tree node. Returns the new child.
      const tree = new Tree("Root");
      const child = tree.add("A");
      expect(child).toBeInstanceOf(Tree);
      expect(tree.children).toHaveLength(1);
    });

    it("supports deep chaining: tree.add('parent').add('grandchild')", () => {
      // [SPEC] Children can be nested: tree.add("parent").add("grandchild")
      const tree = new Tree("Root");
      tree.add("Parent").add("Grandchild");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines.some((l) => l.includes("Parent"))).toBe(true);
      expect(lines.some((l) => l.includes("Grandchild"))).toBe(true);
    });
  });

  describe("rendering", () => {
    it("renders root label", () => {
      // [SPEC] Simple tree — Root label + children with guide lines
      const tree = new Tree("Root");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines[0]).toContain("Root");
    });

    it("renders children with guide lines", () => {
      // [SPEC] Uses ├ (U+251C) for non-last children, └ (U+2514) for last child
      const tree = new Tree("Root");
      tree.add("Child A");
      tree.add("Child B");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines.some((l) => l.includes("\u251c"))).toBe(true);
      expect(lines.some((l) => l.includes("\u2514"))).toBe(true);
      expect(lines.some((l) => l.includes("Child A"))).toBe(true);
      expect(lines.some((l) => l.includes("Child B"))).toBe(true);
    });

    it("renders nested tree showing full hierarchy", () => {
      // [SPEC] Nested tree — Shows full hierarchy (root > parent > leaf)
      const tree = new Tree("Root");
      const parent = tree.add("Parent");
      parent.add("Leaf");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines.some((l) => l.includes("Root"))).toBe(true);
      expect(lines.some((l) => l.includes("Parent"))).toBe(true);
      expect(lines.some((l) => l.includes("Leaf"))).toBe(true);
    });

    it("uses ASCII guides when asciiOnly is true", () => {
      // [SPEC] asciiOnly: true — Uses +-- for guides
      const tree = new Tree("Root");
      tree.add("Child");
      const lines = collectLines(tree, { maxWidth: 40, asciiOnly: true });
      expect(lines.some((l) => l.includes("+--"))).toBe(true);
    });

    it("hides children when expanded is false", () => {
      // [SPEC] expanded: false — Children are hidden; only root label shown
      const tree = new Tree("Root", { expanded: false });
      tree.add("Hidden");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines.some((l) => l.includes("Root"))).toBe(true);
      expect(lines.some((l) => l.includes("Hidden"))).toBe(false);
    });

    it("hides root when hideRoot is true", () => {
      // [SPEC] hideRoot: true — Root label is hidden; children shown at top level
      const tree = new Tree("Root", { hideRoot: true });
      tree.add("Child");
      const lines = collectLines(tree, { maxWidth: 40 });
      expect(lines.some((l) => l.includes("Root"))).toBe(false);
      expect(lines.some((l) => l.includes("Child"))).toBe(true);
    });

    it("applies guide_style to guide segments", () => {
      // [SPEC] guide_style — Style for the guide lines
      const tree = new Tree("Root", { guide_style: "bold green" });
      tree.add("Child");
      const segs = collectSegments(tree, { maxWidth: 40 });
      // Guide segments (├── or └──) should have a non-null style
      const guideSegs = segs.filter(
        (s) => s.text.includes("\u251c") || s.text.includes("\u2514"),
      );
      expect(guideSegs.length).toBeGreaterThan(0);
      expect(guideSegs.some((s) => s.style !== undefined)).toBe(true);
    });
  });

  // A row's terminator is the tree's, not its label's: an empty label emits no
  // text and so no newline either, and the row that follows then renders its
  // guides onto the same line — `Root`, then `├── ├── after`.
  it("gives a label with nothing in it a row of its own", () => {
    const tree = new Tree("Root");
    tree.add("");
    tree.add("after");
    const lines = collectLines(tree, { maxWidth: 40 });
    expect(lines).toHaveLength(3);
    expect(lines[2]).toContain("after");
    expect(lines[2]!.match(/├|└/g)).toHaveLength(1);
  });

  it("leaves a space where a label's row edge cuts through a wide glyph", () => {
    // Python Rich 9d8f9a3 prints these two rows for the same tree at width 9.
    const label = (): RichText => new RichText("日本語日本語", { noWrap: true });
    const tree = new Tree(label());
    tree.add(label());
    expect(collectLines(tree, { maxWidth: 9 })).toEqual(["日本語日 ", "└── 日本 "]);
  });

  // Python Rich 9d8f9a3 draws this tree the same way. Rows below the first level
  // once carried only the continuation rail — `│   b` — and no guide style.
  it("draws a branch on every row, at every depth, in the guide style", () => {
    const tree = new Tree("root", { guide_style: "red" });
    const a = tree.add("a");
    a.add("b").add("c");
    a.add("d");
    tree.add("e");
    const segments = collectSegments(tree, { maxWidth: 40 });
    const lines = Segment.splitLines(segments);
    expect(lines.map((l) => l.map((s) => s.text).join(""))).toEqual([
      "root",
      "├── a",
      "│   ├── b",
      "│   │   └── c",
      "│   └── d",
      "└── e",
    ]);
    const red = Style.parse("red");
    for (const line of lines.slice(1)) {
      const guides = line.slice(0, -1);
      expect(guides.length).toBeGreaterThan(0);
      for (const guide of guides) expect(guide.style?.equals(red)).toBe(true);
    }
  });

  it("stacks a node's guide style onto its ancestors' for the guides it opens", () => {
    const tree = new Tree("root", { guide_style: "red" });
    tree.add("a", { guide_style: "bold" }).add("b");
    const lines = Segment.splitLines(collectSegments(tree, { maxWidth: 40 }));
    const [rail, branch] = lines[2]!;
    expect(rail!.text).toBe("    ");
    expect(rail!.style?.equals(Style.parse("red"))).toBe(true);
    expect(branch!.text).toBe("└── ");
    expect(branch!.style?.equals(Style.parse("red bold"))).toBe(true);
  });

  // A label taller than one line once printed its later lines at column 0 and
  // then a blank row, because the row's newline followed the label's own.
  it("leads every line of a multi-line label with the guides, and adds no blank rows", () => {
    const tree = new Tree("root");
    const grid = Table.grid();
    grid.addColumn();
    grid.addRow("one");
    grid.addRow("two");
    grid.addRow("three");
    tree.add(grid).add("leaf");
    tree.add("last");
    expect(collectLines(tree, { maxWidth: 40 }).map((l) => l.trimEnd())).toEqual([
      "root",
      "├── one",
      "│   two",
      "│   three",
      "│   └── leaf",
      "└── last",
    ]);
  });

  describe("measurement", () => {
    it("minimum is greater than 0", () => {
      // [SPEC] Implements Measurable. minimum > 0
      const tree = new Tree("Root");
      const m = tree.measure({ maxWidth: 40 });
      expect(m.minimum).toBeGreaterThan(0);
    });

    it("measures a guide style name no theme defines as it measures no guide style", () => {
      // Only a render's theme can resolve the name, and a width needs none.
      const named = new Tree("Root", { guide_style: "my.guide" });
      named.add("Child");
      const plain = new Tree("Root");
      plain.add("Child");
      expect(named.measure({ maxWidth: 40 })).toEqual(plain.measure({ maxWidth: 40 }));
    });
  });
});
