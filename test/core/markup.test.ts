import { describe, it, expect } from "vitest";
import { Tag, MarkupError, escape, render } from "../../src/core/markup.js";
import { Style } from "../../src/core/style.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts, not implementation details

// --- Tag ---

describe("Tag", () => {
  it("constructs with name only", () => {
    const tag = new Tag("bold");
    expect(tag.name).toBe("bold");
    expect(tag.parameters).toBeUndefined();
  });

  it("constructs with name and parameters", () => {
    const tag = new Tag("link", "https://example.com");
    expect(tag.name).toBe("link");
    expect(tag.parameters).toBe("https://example.com");
  });

  it("toString without parameters returns name", () => {
    expect(new Tag("bold").toString()).toBe("bold");
  });

  it("toString with parameters returns 'name parameters'", () => {
    expect(new Tag("link", "https://example.com").toString()).toBe(
      "link https://example.com",
    );
  });

  it("markup property without parameters returns [name]", () => {
    expect(new Tag("bold").markup).toBe("[bold]");
  });

  it("markup property with parameters returns [name=parameters]", () => {
    expect(new Tag("link", "https://example.com").markup).toBe(
      "[link=https://example.com]",
    );
  });
});

// --- escape ---

describe("escape()", () => {
  it("escapes brackets so markup is not interpreted", () => {
    const result = escape("[bold]hello[/bold]");
    expect(result).toBe("\\[bold]hello\\[/bold]");
  });

  it("leaves plain text unchanged", () => {
    expect(escape("hello world")).toBe("hello world");
  });

  it("double escaping produces longer output", () => {
    const first = escape("[bold]");
    const second = escape(first);
    expect(second.length).toBeGreaterThan(first.length);
  });
});

// --- render: basic ---

describe("render basic", () => {
  it("renders plain text with no tags", () => {
    const t = render("hello world");
    expect(t.plain).toBe("hello world");
    expect(t.spans).toHaveLength(0);
  });

  it("renders bold tag", () => {
    const t = render("[bold]hello[/bold]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });

  it("renders nested tags with both spans", () => {
    const t = render("[bold][italic]hello[/italic][/bold]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThanOrEqual(2);
  });

  it("renders color tag", () => {
    const t = render("[red]hello[/red]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });

  it("renders combined style in single tag", () => {
    const t = render("[bold red]hello[/bold red]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });
});

// --- render: closing tags ---

describe("render closing tags", () => {
  it("implicit close [/] closes the most recent open tag", () => {
    const t = render("[bold]hello[/]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });

  it("unclosed tags auto-close at end of text", () => {
    const t = render("[bold]hello");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });

  it("mismatched close tag throws MarkupError", () => {
    expect(() => render("[bold]hello[/italic]")).toThrow(MarkupError);
  });

  it("implicit close with nothing open throws MarkupError", () => {
    expect(() => render("[/]")).toThrow(MarkupError);
  });

  it("implicit close with preceding text and nothing open throws MarkupError", () => {
    expect(() => render("no tags[/]")).toThrow(MarkupError);
  });
});

// --- render: non-strict nesting (overlapping tags) ---

describe("render non-strict nesting", () => {
  it("allows overlapping tags", () => {
    const t = render("[bold]Bold[italic] bold and italic [/bold]italic[/italic]");
    expect(t.plain).toBe("Bold bold and italic italic");
    // Both bold and italic spans should be present
    expect(t.spans.length).toBeGreaterThanOrEqual(2);
  });

  it("overlapping tags produce correct span boundaries", () => {
    // [bold]Bold[italic] bold and italic [/bold]italic[/italic]
    // plain: "Bold bold and italic italic"
    //         0123456789012345678901234567
    // bold covers 0..21 ("Bold bold and italic ")
    // italic covers 4..27 (" bold and italic italic")
    const t = render("[bold]Bold[italic] bold and italic [/bold]italic[/italic]");
    const boldSpan = t.spans.find((s) => {
      const style = typeof s.style === "string" ? s.style : s.style.toString();
      return style === "bold";
    });
    const italicSpan = t.spans.find((s) => {
      const style = typeof s.style === "string" ? s.style : s.style.toString();
      return style === "italic";
    });
    expect(boldSpan).toBeDefined();
    expect(italicSpan).toBeDefined();
    // Bold starts at beginning and ends before "italic"-only section
    expect(boldSpan!.start).toBe(0);
    expect(boldSpan!.end).toBe(21);
    // Italic starts after "Bold" and covers the rest
    expect(italicSpan!.start).toBe(4);
    expect(italicSpan!.end).toBe(27);
  });
});

// --- render: background colors ---

describe("render background colors", () => {
  it("parses 'on' syntax for foreground and background", () => {
    const t = render("[red on blue]hello[/red on blue]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });
});

// --- render: multiple sections ---

describe("render multiple sections", () => {
  it("produces separate spans for separate styled regions", () => {
    const t = render("[bold]hello[/bold] [italic]world[/italic]");
    expect(t.plain).toBe("hello world");
    expect(t.spans.length).toBeGreaterThanOrEqual(2);
  });
});

// --- render: escaped brackets ---

describe("render escaped brackets", () => {
  it("treats \\[ as literal bracket in output", () => {
    const t = render("\\[bold]hello");
    expect(t.plain).toBe("[bold]hello");
    expect(t.spans).toHaveLength(0);
  });
});

// --- render: emoji ---

describe("render emoji", () => {
  it("replaces emoji shortcodes by default", () => {
    const t = render(":thumbs_up:");
    expect(t.plain).not.toBe(":thumbs_up:");
    expect(t.plain.length).toBeGreaterThan(0);
  });

  it("keeps shortcodes literal when emoji:false", () => {
    const t = render(":thumbs_up:", undefined, { emoji: false });
    expect(t.plain).toBe(":thumbs_up:");
  });

  it("emoji variant -emoji appends emoji variant selector", () => {
    // :thumbs_up-emoji: should add U+FE0F emoji variant selector
    const t = render(":thumbs_up-emoji:", undefined);
    expect(t.plain).toContain("\uFE0F");
  });

  it("emoji variant -text appends text variant selector", () => {
    // :thumbs_up-text: should add U+FE0E text variant selector
    const t = render(":thumbs_up-text:", undefined);
    expect(t.plain).toContain("\uFE0E");
  });
});

// --- render: fast path ---

describe("render fast path", () => {
  it("text without [ skips parsing and returns plain text", () => {
    const t = render("no tags here");
    expect(t.plain).toBe("no tags here");
    expect(t.spans).toHaveLength(0);
  });
});

// --- render: advanced tags ---

describe("render advanced tags", () => {
  it("handles hex color tags", () => {
    const t = render("[#ff0000]hello[/#ff0000]");
    expect(t.plain).toBe("hello");
    expect(t.spans.length).toBeGreaterThan(0);
  });

  it("handles link tags with parameters", () => {
    const t = render("[link=https://example.com]click[/link]");
    expect(t.plain).toBe("click");
    expect(t.spans.length).toBeGreaterThan(0);
  });
});

// --- render: base style ---

describe("render with base style", () => {
  it("applies base style string to entire text", () => {
    const t = render("hello", "bold");
    expect(t.spans.length).toBeGreaterThan(0);
  });
});
