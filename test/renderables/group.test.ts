import { describe, it, expect } from "vitest";
import { Group } from "../../src/renderables/group.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

/** A renderable that records the maxWidth it was rendered with */
const trackingRenderable = (text: string): Renderable & { receivedMaxWidth: number | undefined } => {
  const tracker = {
    receivedMaxWidth: undefined as number | undefined,
    *render(options: RenderOptions): Iterable<Segment> {
      tracker.receivedMaxWidth = options.maxWidth;
      yield new Segment(text);
    },
  };
  return tracker;
};

const simpleRenderable = (text: string): Renderable => ({
  *render(_options: RenderOptions): Iterable<Segment> {
    yield new Segment(text);
  },
});

describe("Group", () => {
  // Spec: Group renders all its children in sequence
  it("renders children in sequence", () => {
    const a = simpleRenderable("Hello");
    const b = simpleRenderable(" World");
    const group = new Group(a, b);
    const text = collectText(group, { maxWidth: 80 });
    expect(text).toBe("Hello World");
  });

  // Spec: Group renders all its children in sequence (empty case)
  it("renders empty group with no output", () => {
    const group = new Group();
    const segs = [...group.render({ maxWidth: 80 })];
    expect(segs).toHaveLength(0);
  });

  // Spec: Group itself has no visual chrome — it's purely a container
  it("has no visual chrome", () => {
    const a = simpleRenderable("Only content");
    const group = new Group(a);
    const text = collectText(group, { maxWidth: 80 });
    expect(text).toBe("Only content");
  });

  // Spec: Each child is rendered at the full available width
  it("each child is rendered at the full available width", () => {
    const a = trackingRenderable("Hello");
    const b = trackingRenderable("World");
    const group = new Group(a, b);
    [...group.render({ maxWidth: 42 })]; // consume the iterator
    expect(a.receivedMaxWidth).toBe(42);
    expect(b.receivedMaxWidth).toBe(42);
  });

  // Spec: Construction — variadic constructor with spread from generator
  it("accepts spread from a generator (dynamic construction)", () => {
    function* getPanels(): Iterable<Renderable> {
      yield simpleRenderable("A");
      yield simpleRenderable("B");
      yield simpleRenderable("C");
    }
    const group = new Group(...getPanels());
    const text = collectText(group, { maxWidth: 80 });
    expect(text).toBe("ABC");
  });
});
