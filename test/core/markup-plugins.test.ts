import { describe, it, expect } from "vitest";
import {
  MarkupRegistry,
  renderMarkup,
  registerMarkupTag,
  unregisterMarkupTag,
  globalMarkupRegistry,
  MarkupError,
} from "../../src/core/markup.js";
import { RichText } from "../../src/core/text.js";
import { Group } from "../../src/renderables/group.js";
import { ColorSystem } from "../../src/core/color.js";
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
    const text = renderToString(out, { colorSystem: null, endWithNewline: false });
    expect(text).toBe("bar");
  });

  it("splices the handler's Renderable into the output stream where the tag was", () => {
    const registry = new MarkupRegistry();
    registry.register("badge", () => new RichText("[BADGE]", { end: "" }));
    const out = renderMarkup("hello [badge]ignored[/badge] world", { registry });
    const text = renderToString(out, { colorSystem: null, endWithNewline: false });
    expect(text).toBe("hello [BADGE] world");
  });

  it("supports nested built-in style tags inside a plugin tag", () => {
    const registry = new MarkupRegistry();
    let captured: string | null = null;
    registry.register("click", (ctx) => {
      captured = renderToString(ctx.children, {
        colorSystem: null,
        endWithNewline: false,
      });
      return ctx.children;
    });
    renderMarkup("[click verb=foo]plain [bold]important[/bold] tail[/click]", {
      registry,
    });
    expect(captured).toBe("plain important tail");
  });

  it("supports nested plugin tags", () => {
    const registry = new MarkupRegistry();
    registry.register("outer", (ctx) => new RichText("<O:", { end: "" }) /* unused: ctx */);
    registry.register("inner", () => new RichText("[I]", { end: "" }));
    // The outer handler ignores its children — replace ctx with a richer test.
    registry.unregister("outer");
    registry.register("outer", (ctx) => {
      // Compose: prefix + inner-rendered children + suffix.
      return new Group(
        new RichText("<O:", { end: "" }),
        ctx.children,
        new RichText(":O>", { end: "" }),
      );
    });
    const out = renderMarkup("[outer]a[inner]b[/inner]c[/outer]", { registry });
    const text = renderToString(out, { colorSystem: null, endWithNewline: false });
    expect(text).toBe("<O:a[I]c:O>");
  });

  it("falls back to literal/style behavior when a tag is unregistered", () => {
    const registry = new MarkupRegistry();
    registry.register("click", () => new RichText("HANDLED", { end: "" }));
    const before = renderMarkup("[click]x[/click]", { registry });
    expect(renderToString(before, { colorSystem: null, endWithNewline: false }))
      .toBe("HANDLED");
    registry.unregister("click");
    const after = renderMarkup("[click]x[/click]", { registry });
    // With no handler, falls back to legacy parse: "click" is not a known
    // style, but the parser still treats it as a span style and Style.parse
    // gracefully degrades to no styling. Either way, the visible plain text
    // is "x".
    expect(renderToString(after, { colorSystem: null, endWithNewline: false }))
      .toBe("x");
  });

  it("rejects registering over a built-in style name", () => {
    const registry = new MarkupRegistry();
    expect(() => registry.register("bold", () => new RichText(""))).toThrow(MarkupError);
    expect(() => registry.register("red", () => new RichText(""))).toThrow(MarkupError);
  });

  it("instance-scoped registry does not leak into the global registry", () => {
    const registry = new MarkupRegistry();
    registry.register("scoped", () => new RichText("SCOPED", { end: "" }));
    expect(globalMarkupRegistry.has("scoped")).toBe(false);
  });

  it("global registerMarkupTag / unregisterMarkupTag round-trip", () => {
    registerMarkupTag("greet", () => new RichText("HI", { end: "" }));
    try {
      const out = renderMarkup("[greet]ignored[/greet]");
      expect(renderToString(out, { colorSystem: null, endWithNewline: false }))
        .toBe("HI");
    } finally {
      unregisterMarkupTag("greet");
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
      captured = renderToString(ctx.children, {
        colorSystem: ColorSystem.STANDARD,
        endWithNewline: false,
      });
      return ctx.children;
    });
    renderMarkup("[click verb=foo][bold red]hot[/bold red][/click]", { registry });
    expect(captured).toContain("hot");
    expect(captured).toMatch(/\x1b\[/); // some ANSI present from bold/red
  });
});
