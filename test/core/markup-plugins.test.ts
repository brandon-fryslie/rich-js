import { describe, it, expect } from "vitest";
import {
  MarkupRegistry,
  renderMarkup,
  globalMarkupRegistry,
  MarkupError,
} from "../../src/core/markup.js";
import { RichText } from "../../src/core/text.js";
import { ColorDepth } from "../../src/core/color.js";
import { renderToString } from "../../src/core/render.js";
import type { MarkupTagContext } from "../../src/core/markup.js";

// [LAW:behavior-not-structure] Tests assert handler invocation, attribute
// parsing, and that the handler's Renderable shows up in the output stream —
// not the parser's internal token shape.

describe("MarkupRegistry", () => {
  it("calls a registered handler with parsed attrs and a child Renderable", () => {
    const registry = new MarkupRegistry();
    let received: MarkupTagContext | null = null;
    registry.register("click", (ctx) => {
      received = ctx;
      return ctx.children;
    });

    const out = renderMarkup("[click verb=open arg=foo]bar[/click]", { registry });
    expect(received).not.toBeNull();
    expect(received!.attrs).toEqual({ verb: "open", arg: "foo" });
    expect(received!.raw).toBe("bar");
    // Child renderable is the parsed inner content.
    const text = renderToString(out, { colorSystem: null });
    expect(text).toBe("bar");
  });

  it("splices the handler's Renderable into the output stream where the tag was", () => {
    const registry = new MarkupRegistry();
    registry.register("badge", () => new RichText("[BADGE]", { end: "" }));
    const out = renderMarkup("hello [badge]ignored[/badge] world", { registry });
    const text = renderToString(out, { colorSystem: null });
    expect(text).toBe("hello [BADGE] world");
  });

  it("supports nested built-in style tags inside a plugin tag", () => {
    const registry = new MarkupRegistry();
    let captured: string | null = null;
    registry.register("click", (ctx) => {
      captured = renderToString(ctx.children, { colorSystem: null });
      return ctx.children;
    });
    renderMarkup("[click verb=foo]plain [bold]important[/bold] tail[/click]", {
      registry,
    });
    expect(captured).toBe("plain important tail");
  });

  it("supports nested plugin tags", () => {
    const registry = new MarkupRegistry();
    registry.register("inner", () => new RichText("[I]", { end: "" }));
    registry.register("outer", (ctx) => {
      // Compose: prefix + inner-rendered children + suffix, into one RichText.
      return new RichText("<O:", { end: "" }).append(ctx.children).append(":O>");
    });
    const out = renderMarkup("[outer]a[inner]b[/inner]c[/outer]", { registry });
    const text = renderToString(out, { colorSystem: null });
    expect(text).toBe("<O:a[I]c:O>");
  });

  it("falls back to literal/style behavior when a tag is unregistered", () => {
    const registry = new MarkupRegistry();
    registry.register("click", () => new RichText("HANDLED", { end: "" }));
    const before = renderMarkup("[click]x[/click]", { registry });
    expect(renderToString(before, { colorSystem: null })).toBe("HANDLED");
    registry.unregister("click");
    const after = renderMarkup("[click]x[/click]", { registry });
    // With no handler, falls back to legacy parse: "click" is not a known
    // style, but the parser still treats it as a span style and Style.parse
    // gracefully degrades to no styling. Either way, the visible plain text
    // is "x".
    expect(renderToString(after, { colorSystem: null })).toBe("x");
  });

  it("rejects registering over a built-in style name", () => {
    const registry = new MarkupRegistry();
    expect(() => registry.register("bold", () => new RichText(""))).toThrow(MarkupError);
    expect(() => registry.register("red", () => new RichText(""))).toThrow(MarkupError);
  });

  it("a registered short name leaves longer dotted built-in styles alone", () => {
    // `table` registered must not swallow `table.header`: the tag text does not
    // end at the registered name, so it belongs to the built-in dialect.
    const markup = "[table.header]x[/table.header]";
    const bare = renderToString(renderMarkup(markup, { registry: new MarkupRegistry() }), {
      colorSystem: ColorDepth.STANDARD,
    });

    const registry = new MarkupRegistry();
    registry.register("table", () => new RichText("HANDLED", { end: "" }));
    const withPlugin = renderToString(renderMarkup(markup, { registry }), {
      colorSystem: ColorDepth.STANDARD,
    });

    expect(withPlugin).toBe(bare);
    expect(withPlugin).toContain("x");
    expect(withPlugin).not.toContain("HANDLED");
  });

  it("a registered name still fires when the tag text ends there or continues with attributes", () => {
    const registry = new MarkupRegistry();
    let attrs: Record<string, string> | null = null;
    registry.register("table", (ctx) => {
      attrs = ctx.attrs;
      return new RichText("HANDLED", { end: "" });
    });

    expect(renderToString(renderMarkup("[table]x[/table]", { registry }), { colorSystem: null }))
      .toBe("HANDLED");
    expect(attrs).toEqual({});

    expect(
      renderToString(renderMarkup("[table rows=2]x[/table]", { registry }), { colorSystem: null }),
    ).toBe("HANDLED");
    expect(attrs).toEqual({ rows: "2" });
  });

  it("does not fire a registered handler for a `name=value` tag", () => {
    // `[table=x]` is the built-in dialect's parameter form, not a plugin tag —
    // firing the handler here would silently discard the `=x`.
    const registry = new MarkupRegistry();
    let fired = false;
    registry.register("table", () => {
      fired = true;
      return new RichText("HANDLED", { end: "" });
    });
    renderMarkup("[table=x]y[/table=x]", { registry });
    expect(fired).toBe(false);
  });

  it("rejects registering a name markup could never address", () => {
    const registry = new MarkupRegistry();
    const handler = () => new RichText("");
    // A dot: the tag scan stops before it, so `[a.b]` could never reach here.
    expect(() => registry.register("a.b", handler)).toThrow(MarkupError);
    expect(() => registry.register("a b", handler)).toThrow(MarkupError);
    expect(() => registry.register("1abc", handler)).toThrow(MarkupError);
    expect(() => registry.register("", handler)).toThrow(MarkupError);
    expect(registry.has("a.b")).toBe(false);
  });

  it("instance-scoped registry does not leak into the global registry", () => {
    const registry = new MarkupRegistry();
    registry.register("scoped", () => new RichText("SCOPED", { end: "" }));
    expect(globalMarkupRegistry.has("scoped")).toBe(false);
  });

  it("renderMarkup falls back to the global registry when given none", () => {
    globalMarkupRegistry.register("greet", () => new RichText("HI", { end: "" }));
    try {
      const out = renderMarkup("[greet]ignored[/greet]");
      expect(renderToString(out, { colorSystem: null })).toBe("HI");
    } finally {
      globalMarkupRegistry.unregister("greet");
    }
    expect(globalMarkupRegistry.has("greet")).toBe(false);
  });

  it("parses quoted attribute values containing spaces", () => {
    const registry = new MarkupRegistry();
    let attrs: Record<string, string> = {};
    registry.register("click", (ctx) => {
      attrs = ctx.attrs;
      return ctx.children;
    });
    renderMarkup(`[click verb="open vscode" arg='hello world']x[/click]`, { registry });
    expect(attrs).toEqual({ verb: "open vscode", arg: "hello world" });
  });

  it("plugin tag's children Renderable carries spans from inner built-in styles", () => {
    const registry = new MarkupRegistry();
    let captured: string | null = null;
    registry.register("click", (ctx) => {
      captured = renderToString(ctx.children, { colorSystem: ColorDepth.STANDARD });
      return ctx.children;
    });
    renderMarkup("[click verb=foo][bold red]hot[/bold red][/click]", { registry });
    expect(captured).toContain("hot");
    expect(captured).toMatch(/\x1b\[/); // some ANSI present from bold/red
  });
});
