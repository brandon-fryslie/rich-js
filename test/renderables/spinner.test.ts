import { afterEach, describe, it, expect, vi } from "vitest";
import { Spinner } from "../../src/renderables/spinner.js";
import { Segment } from "../../src/core/segment.js";
import { Group } from "../../src/renderables/group.js";
import { RichText } from "../../src/core/text.js";
import { ReprHighlighter } from "../../src/core/highlighter.js";
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
      const s = new Spinner("dots", "", { speed: 2 });
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
      const s = new Spinner("dots", "", { style: "bold red" });
      const segs = collectSegments(s, { maxWidth: 80 });
      // The frame segment should have a non-null style
      expect(segs.length).toBeGreaterThan(0);
      expect(segs[0]!.style).toBeDefined();
    });
  });

  describe("label", () => {
    it("draws a string label's markup as styles, as Rich's Text.from_markup does", () => {
      const segs = collectSegments(new Spinner("dots", "[bold]hi[/]"), { maxWidth: 80 });
      expect(segs.map((s) => s.text).join("")).toBe("⠋ hi\n");
      expect(segs.find((s) => s.text === "hi")?.style?.bold).toBe(true);
    });

    it("draws a string label's brackets when the options turn markup off", () => {
      expect(collectText(new Spinner("dots", "[bold]hi[/]"), { maxWidth: 80, markup: false })).toBe("⠋ [bold]hi[/]\n");
    });

    it("leaves the label unhighlighted, as Rich's Text label is", () => {
      const segs = collectSegments(new Spinner("dots", "3 files"), { maxWidth: 80, highlighter: new ReprHighlighter() });
      expect(segs.every((s) => s.style === undefined || s.text.startsWith("⠋"))).toBe(true);
    });

    it("keeps the frame's style off the label", () => {
      const segs = collectSegments(new Spinner("dots", "hi", { style: "red" }), { maxWidth: 80 });
      expect(segs.find((s) => s.text.includes("hi"))?.style?.color).toBeUndefined();
    });

    it("draws a label that draws nothing as no label, with no trailing space", () => {
      expect(collectText(new Spinner("dots", "[bold][/]"), { maxWidth: 80 })).toBe("⠋\n");
    });

    it("draws a label assigned after construction", () => {
      const s = new Spinner("dots", "before");
      s.text = new RichText("after");
      expect(collectText(s, { maxWidth: 80 })).toBe("⠋ after\n");
    });

    it("draws a RichText label changed in place as changed, as Rich's kept Text does", () => {
      const label = new RichText("hello");
      const s = new Spinner("dots", label);
      label.append(" world");
      expect(collectText(s, { maxWidth: 80 })).toBe("⠋ hello world\n");
    });

    it("wraps a long label with its frame when drawn as a line of its own", () => {
      expect(collectText(new Spinner("dots", "a very long label"), { maxWidth: 10 })).toBe("⠋ a very \nlong label\n");
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

    it("never offers a column less than its widest frame, spaces inside it or not", () => {
      const s = new Spinner("bouncingBall", "a b");
      const widest = Math.max(...s.frames.map((frame) => [...frame].length));
      expect(s.measure({ maxWidth: 80 }).minimum).toBe(widest);
    });
  });
});

describe("Spinner speed", () => {
  afterEach(() => vi.useRealTimers());

  it("steps backwards at a negative speed, wrapping to the last frame as Rich's does", () => {
    vi.useFakeTimers({ now: 0 });
    const spinner = new Spinner("dots", "", { speed: -1 });
    const frame = () => collectText(spinner, { maxWidth: 80 }).trim();
    expect(frame()).toBe(spinner.frames[0]);
    vi.setSystemTime(spinner.interval);
    expect(frame()).toBe(spinner.frames[spinner.frames.length - 1]);
    vi.setSystemTime(spinner.interval * 2);
    expect(frame()).toBe(spinner.frames[spinner.frames.length - 2]);
  });
});
