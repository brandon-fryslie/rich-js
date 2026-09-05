import { describe, it, expect } from "vitest";
import { Pretty } from "../../src/core/pretty.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { Highlighter } from "../../src/core/highlighter.js";
import type { RichText } from "../../src/core/text.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

describe("Pretty", () => {
  // --- Plain Values ---

  it("formats primitive values", () => {
    expect(collectText(new Pretty(42), { maxWidth: 80 })).toContain("42");
    expect(collectText(new Pretty("hello"), { maxWidth: 80 })).toContain('"hello"');
    expect(collectText(new Pretty(true), { maxWidth: 80 })).toContain("true");
    expect(collectText(new Pretty(null), { maxWidth: 80 })).toContain("null");
    expect(collectText(new Pretty(undefined), { maxWidth: 80 })).toContain("undefined");
  });

  // --- Arrays ---

  it("formats arrays", () => {
    const text = collectText(new Pretty([1, 2, 3]), { maxWidth: 80 });
    expect(text).toContain("1");
    expect(text).toContain("2");
    expect(text).toContain("3");
  });

  it("formats empty arrays", () => {
    const text = collectText(new Pretty([]), { maxWidth: 80 });
    expect(text).toContain("[]");
  });

  // --- Objects ---

  it("formats objects", () => {
    const text = collectText(new Pretty({ name: "Alice" }), { maxWidth: 80 });
    expect(text).toContain("name");
    expect(text).toContain("Alice");
  });

  it("formats empty objects", () => {
    const text = collectText(new Pretty({}), { maxWidth: 80 });
    expect(text).toContain("{}");
  });

  // --- Maps ---

  it("formats Maps", () => {
    const map = new Map([["key", "value"]]);
    const text = collectText(new Pretty(map), { maxWidth: 80 });
    expect(text).toContain("Map");
    expect(text).toContain("key");
    expect(text).toContain("value");
  });

  it("formats empty Maps", () => {
    const text = collectText(new Pretty(new Map()), { maxWidth: 80 });
    expect(text).toContain("Map {}");
  });

  // --- Sets ---

  it("formats Sets", () => {
    const set = new Set([1, 2, 3]);
    const text = collectText(new Pretty(set), { maxWidth: 80 });
    expect(text).toContain("Set");
    expect(text).toContain("1");
  });

  it("formats empty Sets", () => {
    const text = collectText(new Pretty(new Set()), { maxWidth: 80 });
    expect(text).toContain("Set {}");
  });

  // --- Compact Mode (default) ---

  it("fits content on one line when it fits within width", () => {
    const text = collectText(new Pretty([1, 2, 3]), { maxWidth: 80 });
    // Short array should be compact on one line
    expect(text).toContain("[");
    expect(text).not.toContain("\n["); // no expansion needed
  });

  it("expands when content exceeds available width", () => {
    const data = { longKeyName: "a long value that takes space", anotherKey: "more content here" };
    const text = collectText(new Pretty(data), { maxWidth: 30 });
    // Should expand to multiple lines when narrow
    expect(text).toContain("\n");
  });

  // --- Expand All Mode ---

  it("expandAll forces expansion of all containers", () => {
    const text = collectText(new Pretty({ a: 1 }, { expandAll: true }), { maxWidth: 80 });
    expect(text).toContain("\n");
  });

  it("expandAll expands arrays one element per line", () => {
    const text = collectText(new Pretty([1, 2], { expandAll: true }), { maxWidth: 80 });
    expect(text).toContain("\n");
  });

  // --- Truncation: maxLength ---

  it("truncates arrays with maxLength", () => {
    const text = collectText(new Pretty([1, 2, 3, 4, 5], { maxLength: 2 }), { maxWidth: 80 });
    expect(text).toContain("1");
    expect(text).toContain("2");
    expect(text).toContain("+3");
  });

  it("truncates objects with maxLength", () => {
    const obj = { a: 1, b: 2, c: 3, d: 4 };
    const text = collectText(new Pretty(obj, { maxLength: 2 }), { maxWidth: 80 });
    expect(text).toContain("+2");
  });

  // --- Truncation: maxString ---

  it("truncates strings with maxString and shows hidden count", () => {
    const long = "a".repeat(100);
    const text = collectText(new Pretty(long, { maxString: 10 }), { maxWidth: 80 });
    expect(text).toContain("+90");
  });

  // --- Indent ---

  it("accepts indent option to control indentation width", () => {
    // With a narrow width to force expansion and indent of 2
    const text = collectText(new Pretty({ a: 1, b: 2 }, { expandAll: true, indent: 2 }), { maxWidth: 80 });
    expect(text).toContain("\n");
  });

  // --- Indent Guides ---

  it("indent guides are enabled by default", () => {
    // indentGuides defaults to true per spec
    const p = new Pretty({ a: [1, 2] }, { expandAll: true });
    const text = collectText(p, { maxWidth: 40 });
    // Should render without error; guides are visual
    expect(text).toContain("a");
  });

  it("indent guides can be disabled", () => {
    const p = new Pretty({ a: [1, 2] }, { expandAll: true, indentGuides: false });
    const text = collectText(p, { maxWidth: 40 });
    expect(text).toContain("a");
  });

  // An object either carries its own string form or it does not, and the two
  // populations want opposite treatment: reflecting on a Date throws its answer
  // away (`Object.keys(new Date())` is empty, so it renders `{}`), while a plain
  // object's own `toString` is the non-answer `[object Object]`, leaving the
  // keys as the only information present. These pin both sides and the two
  // edges — a plain object that defines `toString`, and one with no prototype
  // and so no `toString` at all.
  describe("self-describing values keep their own string form", () => {
    it("renders a Date as its date, not as an empty object", () => {
      // Compared against the Date's own string form rather than a literal:
      // that form is the contract, and a literal would only pin the machine's
      // time zone.
      const date = new Date(0);
      expect(collectText(new Pretty(date), { maxWidth: 120 }))
        .toContain(date.toString());
    });

    it("renders an Error and a RegExp as themselves", () => {
      expect(collectText(new Pretty(new Error("boom")), { maxWidth: 80 }))
        .toContain("Error: boom");
      expect(collectText(new Pretty(/ab+c/g), { maxWidth: 80 }))
        .toContain("/ab+c/g");
    });

    it("uses an own toString on an otherwise plain object", () => {
      const value = { hidden: 1, toString: () => "CUSTOM" };
      expect(collectText(new Pretty(value), { maxWidth: 80 })).toContain("CUSTOM");
    });

    it("reflects on a class instance, which inherits the non-answer", () => {
      class Point {
        x = 1;
        y = 2;
      }
      const text = collectText(new Pretty(new Point()), { maxWidth: 80 });
      expect(text).toContain("x");
      expect(text).not.toContain("[object");
    });

    it("reflects on a null-prototype object rather than calling a missing toString", () => {
      const bare = Object.create(null) as Record<string, unknown>;
      bare["k"] = 1;
      expect(collectText(new Pretty(bare), { maxWidth: 80 })).toContain("k");
    });

    it("keeps the structural form for arrays, which also override toString", () => {
      // Array.prototype.toString would answer "1,2,3" — self-description is
      // only consulted after the arms that know a richer form.
      expect(collectText(new Pretty([1, 2, 3]), { maxWidth: 80 })).toContain("[1, 2, 3]");
    });
  });

  // A cycle and a DAG look identical to a set that only ever grows: both revisit
  // an object already seen. Only the pair pins that `open` empties on the way
  // back up, so both cases are here and neither is meaningful alone.
  describe("self-referential data", () => {
    it("renders a cycle instead of exhausting the stack", () => {
      const a: Record<string, unknown> = {};
      a["self"] = a;
      expect(collectText(new Pretty(a), { maxWidth: 80 })).toContain("[Circular]");
    });

    it("renders a shared child twice, since sharing is not a cycle", () => {
      const shared = { v: 1 };
      const text = collectText(new Pretty({ a: shared, b: shared }), { maxWidth: 80 });
      expect(text).not.toContain("[Circular]");
      expect(text).toBe("{ a: { v: 1 }, b: { v: 1 } }");
    });
  });

  it("formats a typed array as the sequence it is", () => {
    // Its own `toString` would answer a bare "1,2,3" — no brackets, and nothing
    // for the highlighter to colour per element.
    expect(collectText(new Pretty(new Int8Array([1, 2, 3])), { maxWidth: 80 }))
      .toBe("[1, 2, 3]");
  });

  it("takes its highlighter from the caller", () => {
    // `Console.print` depends on this to carry its `highlight` flag and any
    // custom highlighter through to a formatted value.
    const seen: string[] = [];
    class Recorder extends Highlighter {
      highlight(text: RichText): void {
        seen.push(text.plain);
      }
    }
    collectText(new Pretty({ a: 1 }, { highlighter: new Recorder() }), { maxWidth: 80 });
    expect(seen).toEqual(["{ a: 1 }"]);
  });

  describe("bounds", () => {
    it("elides past maxDepth, naming the container it stopped in", () => {
      expect(collectText(new Pretty({ a: { b: { c: 1 } } }, { maxDepth: 2 }), { maxWidth: 80 }))
        .toBe("{ a: { b: {...} } }");
      expect(collectText(new Pretty([[[1]]], { maxDepth: 2 }), { maxWidth: 80 }))
        .toBe("[[[...]]]");
    });

    it("says how many entries maxLength dropped from a Map or Set", () => {
      // Arrays and objects already marked their remainder; Map and Set dropped
      // theirs with no sign at all, which is only tolerable while nothing
      // truncates by default. `print` now does.
      expect(collectText(new Pretty(new Map([["a", 1], ["b", 2], ["c", 3]]), { maxLength: 1 }), { maxWidth: 80 }))
        .toContain("... +2");
      expect(collectText(new Pretty(new Set([1, 2, 3]), { maxLength: 1 }), { maxWidth: 80 }))
        .toContain("... +2");
    });

    it("is unbounded by default", () => {
      let deep: unknown = 1;
      for (let i = 0; i < 30; i++) deep = { n: deep };
      expect(collectText(new Pretty(deep), { maxWidth: 200 })).not.toContain("{...}");
    });
  });

  // --- Measurement ---

  it("measurement returns valid values", () => {
    const p = new Pretty({ a: 1, b: [1, 2] });
    const m = p.measure({ maxWidth: 80 });
    expect(m.minimum).toBeGreaterThan(0);
    expect(m.maximum).toBeLessThanOrEqual(80);
  });
});
