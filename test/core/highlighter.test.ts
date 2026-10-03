import { describe, it, expect } from "vitest";
import {
  NullHighlighter,
  RegexHighlighter,
  ReprHighlighter,
  JSONHighlighter,
  ISO8601Highlighter,
} from "../../src/core/highlighter.js";
import { DEFAULT_STYLES } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

/**
 * Plain-text slices covered by spans carrying a given style name. A highlighter
 * tags text with names, as the reference does; what a name looks like belongs to
 * the theme of whatever render draws it.
 */
function matchedTexts(text: RichText, styleName: string): string[] {
  return text.spans
    .filter((s) => s.style === styleName)
    .map((s) => text.plain.slice(s.start, s.end));
}

// --- The default theme ---

// A name the default theme lacks reaches the render's `onStyleError`, which a
// strict handler rethrows, so every style a built-in can lay must be named.
describe("built-in highlighters under the default theme", () => {
  it.each([ReprHighlighter, JSONHighlighter, ISO8601Highlighter])("%o lays only names the theme defines", (ctor) => {
    const groups = ctor.highlights.flatMap((p) => [
      ...(p instanceof RegExp ? p.source : p).matchAll(/\(\?<([A-Za-z_]\w*)>/g),
    ]);
    const missing = [...new Set(groups.map((m) => `${ctor.baseStyle}${m[1]}`))].filter((name) => !(name in DEFAULT_STYLES));
    expect(missing).toEqual([]);
  });
});

// --- NullHighlighter ---

describe("NullHighlighter", () => {
  it("highlight does not modify text spans", () => {
    const h = new NullHighlighter();
    const text = new RichText("hello 42 true");
    h.highlight(text);
    expect(text.spans).toHaveLength(0);
  });

  it("call returns RichText with no spans", () => {
    const h = new NullHighlighter();
    const result = h.call("hello 42");
    expect(result.plain).toBe("hello 42");
    expect(result.spans).toHaveLength(0);
  });
});

// --- RegexHighlighter (custom subclass) ---

describe("RegexHighlighter", () => {
  it("named capture groups produce baseStyle + groupName style applied to matching text", () => {
    // Use repr.number which exists in DEFAULT_STYLES, with baseStyle "repr."
    class TestHighlighter extends RegexHighlighter {
      static override highlights = ["(?<number>\\d+)"];
      static override baseStyle = "repr.";
    }
    const h = new TestHighlighter();
    const text = new RichText("value is 42");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.number");
    expect(matched).toContain("42");
  });

  it("call creates a new RichText with spans applied", () => {
    class TestHighlighter extends RegexHighlighter {
      static override highlights = [/(?<number>\d+)/g];
      static override baseStyle = "repr.";
    }
    const h = new TestHighlighter();
    const result = h.call("count = 99");
    expect(result.plain).toBe("count = 99");
    const matched = matchedTexts(result, "repr.number");
    expect(matched).toContain("99");
  });

  it("supports RegExp patterns with named groups", () => {
    // Use repr.str which is a valid DEFAULT_STYLES key
    class QuoteHighlighter extends RegexHighlighter {
      static override baseStyle = "repr.";
      static override highlights = [/(?<str>'[^']*')/g];
    }
    const h = new QuoteHighlighter();
    const text = new RichText("say 'hello' now");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.str");
    expect(matched).toContain("'hello'");
  });

  it("multiple named groups in one pattern each get their own style", () => {
    class MultiHighlighter extends RegexHighlighter {
      static override highlights = [/(?<number>\d+)\s+(?<bool>true|false)/g];
      static override baseStyle = "repr.";
    }
    const h = new MultiHighlighter();
    const text = new RichText("42 true");
    h.highlight(text);
    const numbers = matchedTexts(text, "repr.number");
    const bools = matchedTexts(text, "repr.bool");
    expect(numbers).toContain("42");
    expect(bools).toContain("true");
  });
});

// --- ReprHighlighter ---

describe("ReprHighlighter", () => {
  it("highlights integer numbers", () => {
    const h = new ReprHighlighter();
    const text = new RichText("value is 42");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.number");
    expect(matched).toContain("42");
  });

  it("highlights float numbers", () => {
    const h = new ReprHighlighter();
    const text = new RichText("pi is 3.14");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.number");
    expect(matched).toContain("3.14");
  });

  it("highlights double-quoted strings", () => {
    const h = new ReprHighlighter();
    const text = new RichText('name is "hello"');
    h.highlight(text);
    const matched = matchedTexts(text, "repr.str");
    expect(matched).toContain('"hello"');
  });

  it("highlights single-quoted strings", () => {
    const h = new ReprHighlighter();
    const text = new RichText("name is 'hello'");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.str");
    expect(matched).toContain("'hello'");
  });

  it("highlights booleans true and false", () => {
    const h = new ReprHighlighter();
    const text = new RichText("flag is true and false");
    h.highlight(text);
    expect(matchedTexts(text, "repr.bool_true")).toEqual(["true"]);
    expect(matchedTexts(text, "repr.bool_false")).toEqual(["false"]);
  });

  it("highlights null", () => {
    const h = new ReprHighlighter();
    const text = new RichText("value is null");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.none");
    expect(matched).toContain("null");
  });

  it("highlights undefined", () => {
    const h = new ReprHighlighter();
    const text = new RichText("value is undefined");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.none");
    expect(matched).toContain("undefined");
  });

  it("highlights None", () => {
    const h = new ReprHighlighter();
    const text = new RichText("value is None");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.none");
    expect(matched).toContain("None");
  });

  it("highlights URLs", () => {
    const h = new ReprHighlighter();
    const text = new RichText("visit https://example.com today");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.url");
    expect(matched).toContain("https://example.com");
  });

  it("highlights UUIDs", () => {
    const h = new ReprHighlighter();
    const text = new RichText("id: 550e8400-e29b-41d4-a716-446655440000");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.uuid");
    expect(matched).toContain("550e8400-e29b-41d4-a716-446655440000");
  });

  it("call creates highlighted RichText from string", () => {
    const h = new ReprHighlighter();
    const result = h.call("value = 42");
    expect(result.plain).toBe("value = 42");
    expect(result.spans.length).toBeGreaterThan(0);
  });
});

// --- Cost on long runs ---

// Each text is one long run that no pattern can match whole. A pattern that
// rescans the run from each of its characters costs seconds here (100k cells:
// ~5s for the letters, ~70s for the digits); one pass costs milliseconds, so
// the bound only separates linear from quadratic.
describe("highlighting a long run takes one pass over it", () => {
  const N = 100_000;
  it.each([
    ["letters with no ( after them", "a".repeat(N)],
    ["digits ending in a letter", "1".repeat(N) + "a"],
    ["a negative number's digits", "-" + "1".repeat(N)],
    ["dots", ".".repeat(N)],
    ["< with no > after it", "<".repeat(N)],
  ])("%s", (_name, input) => {
    for (const ctor of [ReprHighlighter, JSONHighlighter]) {
      const started = performance.now();
      new ctor().call(input);
      expect(performance.now() - started, ctor.name).toBeLessThan(1000);
    }
  });
});

describe("ReprHighlighter departs from Rich on a call name that starts mid-word", () => {
  it("leaves unstyled a name glued to the end of another match, which Rich styles", () => {
    const text = new ReprHighlighter().call("aa-bb-cc-dd-ee-fffoo(");
    expect(matchedTexts(text, "repr.eui48")).toEqual(["aa-bb-cc-dd-ee-ff"]);
    expect(matchedTexts(text, "repr.call")).toEqual([]);
  });

  it("still styles a call name that starts its word", () => {
    expect(matchedTexts(new ReprHighlighter().call("x aa.bb(1)"), "repr.call")).toEqual(["aa.bb"]);
  });
});
