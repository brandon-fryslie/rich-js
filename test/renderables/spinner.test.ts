import { describe, it, expect } from "vitest";
import { Spinner } from "../../src/renderables/spinner.js";
import { Segment } from "../../src/core/segment.js";
import { Group } from "../../src/renderables/group.js";
import { RichText } from "../../src/core/text.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectSegments(r: Renderable, opts: RenderOptions): Segment[] {
  return [...r.render(opts)];
}

describe("Spinner", () => {
  describe("construction", () => {
    it("constructs with a known spinner name", () => {
      // [SPEC] new Spinner(name, text?, options?) — name is a spinner name from cli-spinners
      const s = new Spinner("dots");
      expect(s.name).toBe("dots");
    });

    it("throws for unknown spinner name", () => {
      // [SPEC] Throws if name is not a known spinner
      expect(() => new Spinner("nonexistent_spinner_xyz")).toThrow();
    });
  });

  describe("properties", () => {
    it(".frames has length > 0", () => {
      // [SPEC] .frames — Array of animation frame strings. Length > 0.
      const s = new Spinner("dots");
      expect(s.frames.length).toBeGreaterThan(0);
    });

    it(".interval is > 0", () => {
      // [SPEC] .interval — Milliseconds between frames. > 0.
      const s = new Spinner("dots");
      expect(s.interval).toBeGreaterThan(0);
    });

    it(".speed defaults to 1.0", () => {
      // [SPEC] speed default: 1.0
      const s = new Spinner("dots");
      expect(s.speed).toBe(1);
    });

    it(".speed can be set via options", () => {
      // [SPEC] speed option
      const s = new Spinner("dots", undefined, { speed: 2 });
      expect(s.speed).toBe(2);
    });
  });

  describe("rendering", () => {
    // The reference's Spinner is a `Text`, so it ends its own line and a
    // `Group` stacks what follows it below rather than beside it.
    it("stacks below itself in a Group", () => {
      const group = new Group(new Spinner("dots", "hi"), new RichText("after"));
      const lines = Segment.splitLines([...group.render({ maxWidth: 80 })]).map((line) =>
        line.map((segment) => segment.text).join(""),
      );
      expect(lines).toEqual(["⠋ hi", "after"]);
    });

    it("renders a single spinner frame without text", () => {
      // [SPEC] No text — Renders a single spinner frame
      const s = new Spinner("dots");
      const text = collectText(s, { maxWidth: 80 });
      expect(text.length).toBeGreaterThan(0);
      // With no text, the output is one frame, on a line of its own
      expect(s.frames).toContain(text.slice(0, -1));
      expect(text.endsWith("\n")).toBe(true);
    });

    it("renders spinner frame + text when text is provided", () => {
      // [SPEC] With text — Renders spinner frame + text (e.g., "⠋ Loading...")
      const s = new Spinner("dots", "Loading...");
      const text = collectText(s, { maxWidth: 80 });
      expect(text).toContain("Loading...");
      // Should contain a frame followed by the text
      expect(text.length).toBeGreaterThan("Loading...".length);
    });

    it("applies style option to spinner frame segments", () => {
      // [SPEC] style option — string | Style
      const s = new Spinner("dots", undefined, { style: "bold red" });
      const segs = collectSegments(s, { maxWidth: 80 });
      // The frame segment should have a non-null style
      expect(segs.length).toBeGreaterThan(0);
      expect(segs[0]!.style).toBeDefined();
    });
  });

  describe("measurement", () => {
    it("minimum > 0", () => {
      // [SPEC] Implements Measurable. minimum > 0.
      const s = new Spinner("dots");
      const m = s.measure({ maxWidth: 80 });
      expect(m.minimum).toBeGreaterThan(0);
    });

    it("minimum > 0 with text", () => {
      // [SPEC] Implements Measurable. minimum > 0.
      const s = new Spinner("dots", "Loading...");
      const m = s.measure({ maxWidth: 80 });
      expect(m.minimum).toBeGreaterThan(0);
    });
  });
});
