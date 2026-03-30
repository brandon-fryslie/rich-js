import { describe, it, expect } from "vitest";
import { Tree } from "../../src/renderables/tree.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
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

  describe("measurement", () => {
    it("minimum is greater than 0", () => {
      // [SPEC] Implements Measurable. minimum > 0
      const tree = new Tree("Root");
      const m = tree.measure({ maxWidth: 40 });
      expect(m.minimum).toBeGreaterThan(0);
    });
  });
});
