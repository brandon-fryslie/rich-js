import { describe, it, expect } from "vitest";
import {
  NullHighlighter,
  RegexHighlighter,
  ReprHighlighter,
  JSONHighlighter,
  ISO8601Highlighter,
} from "../../src/core/highlighter.js";
import { RichText } from "../../src/core/text.js";
import { Style } from "../../src/core/style.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

/** Resolve a semantic style name (e.g. "repr.number") to its Style object for comparison. */
function resolveStyle(name: string): Style {
  return Style.parse(name);
}

/** Extract plain-text slices covered by spans matching a given resolved style. */
function matchedTexts(text: RichText, styleName: string): string[] {
  const expected = resolveStyle(styleName);
  return text.spans
    .filter((s) => s.style === expected)
    .map((s) => text.plain.slice(s.start, s.end));
}

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
      static highlights = ["(?<number>\\d+)"];
      static baseStyle = "repr.";
    }
    const h = new TestHighlighter();
    const text = new RichText("value is 42");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.number");
    expect(matched).toContain("42");
  });

  it("call creates a new RichText with spans applied", () => {
    class TestHighlighter extends RegexHighlighter {
      static highlights = [/(?<number>\d+)/g];
      static baseStyle = "repr.";
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
      static baseStyle = "repr.";
      static highlights = [/(?<str>'[^']*')/g];
    }
    const h = new QuoteHighlighter();
    const text = new RichText("say 'hello' now");
    h.highlight(text);
    const matched = matchedTexts(text, "repr.str");
    expect(matched).toContain("'hello'");
  });

  it("multiple named groups in one pattern each get their own style", () => {
    class MultiHighlighter extends RegexHighlighter {
      static highlights = [/(?<number>\d+)\s+(?<bool>true|false)/g];
      static baseStyle = "repr.";
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
    const matched = matchedTexts(text, "repr.bool");
    expect(matched).toContain("true");
    expect(matched).toContain("false");
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

// --- JSONHighlighter ---

describe("JSONHighlighter", () => {
  it("highlights JSON keys", () => {
    const h = new JSONHighlighter();
    const text = new RichText('{"name": "value"}');
    h.highlight(text);
    const matched = matchedTexts(text, "json.key");
    expect(matched).toContain('"name"');
  });

  it("highlights JSON booleans", () => {
    const h = new JSONHighlighter();
    const text = new RichText('{"flag": true}');
    h.highlight(text);
    const matched = matchedTexts(text, "json.bool");
    expect(matched).toContain("true");
  });

  it("highlights JSON null", () => {
    const h = new JSONHighlighter();
    const text = new RichText('{"value": null}');
    h.highlight(text);
    const matched = matchedTexts(text, "json.null");
    expect(matched).toContain("null");
  });

  it("call creates highlighted RichText from string", () => {
    const h = new JSONHighlighter();
    const result = h.call('{"key": true}');
    expect(result.plain).toBe('{"key": true}');
    expect(result.spans.length).toBeGreaterThan(0);
  });
});

// --- ISO8601Highlighter ---

describe("ISO8601Highlighter", () => {
  it("call creates highlighted RichText from string", () => {
    const h = new ISO8601Highlighter();
    const result = h.call("2023-01-15T14:30:00Z");
    expect(result.plain).toBe("2023-01-15T14:30:00Z");
    expect(result.spans.length).toBeGreaterThan(0);
  });

  it("highlights dates", () => {
    const h = new ISO8601Highlighter();
    const text = new RichText("date: 2023-01-15");
    h.highlight(text);
    const matched = matchedTexts(text, "iso8601.date");
    expect(matched).toContain("2023-01-15");
  });

  it("highlights times", () => {
    const h = new ISO8601Highlighter();
    const text = new RichText("time: 14:30:00");
    h.highlight(text);
    const matched = matchedTexts(text, "iso8601.time");
    expect(matched).toContain("14:30:00");
  });

  it("highlights datetime with timezone", () => {
    const h = new ISO8601Highlighter();
    const text = new RichText("2023-01-15T14:30:00+05:00");
    h.highlight(text);
    const dates = matchedTexts(text, "iso8601.date");
    const times = matchedTexts(text, "iso8601.time");
    const tzs = matchedTexts(text, "iso8601.timezone");
    expect(dates).toContain("2023-01-15");
    expect(times).toContain("14:30:00");
    expect(tzs).toContain("+05:00");
  });
});
