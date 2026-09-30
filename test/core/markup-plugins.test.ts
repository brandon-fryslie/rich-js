import { describe, it, expect } from "vitest";
import {
  MarkupRegistry,
  renderMarkup,
  globalMarkupRegistry,
  MarkupError,
  MarkupSyntaxError,
} from "../../src/core/markup.js";
import { RichText } from "../../src/core/text.js";
import { Console } from "../../src/core/console.js";
import { Prompt } from "../../src/renderables/prompt.js";
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
    expect(text).toBe("bar\n");
  });

  // Selecting each pair's tokens by filtering the whole list took 12s here;
  // selecting them by position takes milliseconds.
  it("renders many plugin pairs in time proportional to the string", () => {
    const registry = new MarkupRegistry();
    registry.register("click", (ctx) => ctx.children);
    const began = performance.now();
    const out = renderMarkup("[click]a[/click]".repeat(20_000), { registry });
    expect(performance.now() - began).toBeLessThan(2000);
    expect(out.plain).toBe("a".repeat(20_000));
  });

  it("halves a backslash run on either side of a plugin pair's boundaries", () => {
    const registry = new MarkupRegistry();
    let received: MarkupTagContext | null = null;
    registry.register("click", (ctx) => {
      received = ctx;
      return ctx.children;
    });

    const out = renderMarkup("a\\\\[click]b\\\\[/click]c", { registry });
    expect(received!.raw).toBe("b\\\\");
    expect(received!.children.plain).toBe("b\\");
    expect(out.plain).toBe("a\\b\\c");
  });

  it("splices the handler's Renderable into the output stream where the tag was", () => {
    const registry = new MarkupRegistry();
    registry.register("badge", () => new RichText("[BADGE]", { end: "" }));
    const out = renderMarkup("hello [badge]ignored[/badge] world", { registry });
    const text = renderToString(out, { colorSystem: null });
    expect(text).toBe("hello [BADGE] world\n");
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
    expect(captured).toBe("plain important tail\n");
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
    expect(text).toBe("<O:a[I]c:O>\n");
  });

  it("falls back to literal/style behavior when a tag is unregistered", () => {
    const registry = new MarkupRegistry();
    registry.register("click", () => new RichText("HANDLED", { end: "" }));
    const before = renderMarkup("[click]x[/click]", { registry });
    expect(renderToString(before, { colorSystem: null })).toBe("HANDLED\n");
    registry.unregister("click");
    const after = renderMarkup("[click]x[/click]", { registry });
    // With no handler, falls back to legacy parse: "click" is not a known
    // style, but the parser still treats it as a span style and Style.parse
    // gracefully degrades to no styling. Either way, the visible plain text
    // is "x".
    expect(renderToString(after, { colorSystem: null })).toBe("x\n");
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
      .toBe("HANDLED\n");
    expect(attrs).toEqual({});

    expect(
      renderToString(renderMarkup("[table rows=2]x[/table]", { registry }), { colorSystem: null }),
    ).toBe("HANDLED\n");
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
    // An initial capital: the tag grammar opens on `a-z`, so `[Abc]` is literal
    // text and a handler registered under it could never fire. Nothing
    // lowercases the tag on the way in, which is what makes this unreachable
    // rather than merely unconventional.
    expect(() => registry.register("Abc", handler)).toThrow(MarkupError);
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
      expect(renderToString(out, { colorSystem: null })).toBe("HI\n");
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

// Every consumer that turns a markup string into a `RichText` goes through
// `renderMarkup`, so a tag on the global registry resolves wherever markup is
// accepted. `console.ts` and `prompt.ts` used to import the built-in parser
// under the name `renderMarkup`, which made the import line at all four call
// sites read identically while two of them silently ate the tag and printed
// the content unstyled (rich-markup-pcp). These pin the two that were wrong;
// they are the regression, not a demonstration of the feature.
// [LAW:single-enforcer]
describe("the global registry reaches every markup consumer", () => {
  // [LAW:no-ambient-temporal-coupling] `await body()` inside the try, not
  // `return body()`: the latter hands back a pending promise, so `finally`
  // unregisters while an async body is still mid-flight and the cleanup races
  // the work it is meant to follow.
  async function withGlobalShout<T>(body: () => T | Promise<T>): Promise<T> {
    globalMarkupRegistry.register("shout", (ctx) =>
      new RichText(ctx.children.plain.toUpperCase(), { end: "" }),
    );
    try {
      return await body();
    } finally {
      globalMarkupRegistry.unregister("shout");
    }
  }

  it("resolves a globally registered tag through console.print", async () => {
    await withGlobalShout(() => {
      const chunks: string[] = [];
      const stream = {
        write(data: string) {
          chunks.push(data);
          return true;
        },
      } as NodeJS.WritableStream;
      const c = new Console({ file: stream, width: 80, colorSystem: null });
      c.print("say [shout]hello[/shout] now");
      expect(chunks.join("")).toBe("say HELLO now\n");
    });
  });

  it("resolves a globally registered tag through Prompt.ask", async () => {
    // `Prompt` reads its text as markup, so a handler that rewrites text is
    // visible in the prompt the user is shown.
    const asked = await withGlobalShout(async () => {
      let seen = "";
      await Prompt.ask("pick [shout]one[/shout]", async (prompt) => {
        seen = prompt.plain;
        return "x";
      });
      return seen;
    });
    expect(asked).toBe("pick ONE: ");
  });
});

// A style span annotates and may overlap; a plugin pair replaces a region and
// so must nest. The top-level filter used to test only where a pair *opened*,
// which read "contained" and "overlapping" as one shape — so the overlapping
// pair was dropped and its closing tag orphaned into the trailing slice, where
// the built-in parser rejected it while naming the wrong tag. These pin the
// three shapes that comparison now has to tell apart.
describe("plugin pairs must nest", () => {
  function twoTags(): MarkupRegistry {
    const registry = new MarkupRegistry();
    registry.register("aa", (ctx) => new RichText(`<A>${ctx.children.plain}</A>`, { end: "" }));
    registry.register("bb", (ctx) => new RichText(`<B>${ctx.children.plain}</B>`, { end: "" }));
    return registry;
  }

  it("rejects an overlapping pair, naming both tags and the fix", () => {
    expect(() => renderMarkup("[aa]x[bb]y[/aa]z[/bb]", { registry: twoTags() })).toThrow(
      /Plugin tag \[bb\] overlaps \[aa\].*Close \[\/bb\] before \[\/aa\]/s,
    );
    expect(() => renderMarkup("[aa]x[bb]y[/aa]z[/bb]", { registry: twoTags() })).toThrow(MarkupError);
  });

  it("puts the overlap's caret under the outer pair's closing tag", () => {
    const err = rejectionOf("[aa]x[bb]y[/aa]z[/bb]", twoTags());
    expect(err.offset).toBe(10);
    expect(err.openTags).toEqual(["[aa]", "[bb]"]);
  });

  it("names every plugin pair open at the overlap's caret, and none that closed before it", () => {
    const registry = new MarkupRegistry();
    for (const name of ["pa", "pb", "pc", "pd"]) registry.register(name, (ctx) => ctx.children);
    const err = rejectionOf("[pa][pd]x[/pd][pb][pc][/pa][/pc][/pb]", registry);
    expect(err.offset).toBe(22);
    expect(err.openTags).toEqual(["[pa]", "[pb]", "[pc]"]);
  });

  it("renders an inner plugin tag that never closes, rather than rejecting it", () => {
    // No closer means no entry in `pairs` at all, so this shape never reaches
    // the overlap test. Pinned because the obvious alternative fix — rejecting
    // whenever a closing tag's match is not the top of the stack — breaks it.
    const out = renderMarkup("[aa]x[bb]y[/aa]", { registry: twoTags() });
    expect(renderToString(out, { colorSystem: null })).toBe("<A>xy</A>\n");
  });

  it("resolves a pair after a plugin tag that never closes", () => {
    const out = renderMarkup("[bb]x [aa]y[/aa]", { registry: twoTags() });
    expect(renderToString(out, { colorSystem: null })).toBe("x <A>y</A>\n");
  });

  it("resolves two sequential top-level pairs", () => {
    const out = renderMarkup("[aa]x[/aa] mid [bb]y[/bb]", { registry: twoTags() });
    expect(renderToString(out, { colorSystem: null })).toBe("<A>x</A> mid <B>y</B>\n");
  });

  it("leaves the built-in dialect's non-strict nesting alone", () => {
    const out = renderMarkup("[bold]a[italic]b[/bold]c[/italic]", { registry: twoTags() });
    expect(renderToString(out, { colorSystem: null })).toBe("abc\n");
  });
});

// `[/]` closes the most recent open tag, whatever kind it is — the built-in
// dialect's rule, and the one a reader of `[shout]one[/]` expects. It used to
// skip plugin tags, so that string fell back to the built-in parser, which read
// `[shout]` as an unknown style and dropped it without a word (rich-markup-gfr).
describe("an implicit close [/] closes a plugin tag like any other", () => {
  function twoTags(): MarkupRegistry {
    const registry = new MarkupRegistry();
    registry.register("aa", (ctx) => new RichText(`<A>${ctx.children.plain}</A>`, { end: "" }));
    registry.register("bb", (ctx) => new RichText(`<B>${ctx.children.plain}</B>`, { end: "" }));
    return registry;
  }
  const plain = (markup: string, registry: MarkupRegistry): string =>
    renderToString(renderMarkup(markup, { registry }), { colorSystem: null });

  it("fires the handler of the plugin tag it closes", () => {
    expect(plain("[aa]one[/] two", twoTags())).toBe("<A>one</A> two\n");
  });

  it("closes a style tag opened inside the plugin pair, not the plugin tag", () => {
    const registry = new MarkupRegistry();
    registry.register("aa", (ctx) => ctx.children);
    const styled = (markup: string, r: MarkupRegistry): string =>
      renderToString(renderMarkup(markup, { registry: r }), { colorSystem: ColorDepth.STANDARD });
    expect(styled("[aa][bold]x[/]y[/aa]", registry)).toBe(styled("[bold]x[/]y", new MarkupRegistry()));
  });

  it("closes the innermost of two plugin tags", () => {
    expect(plain("[aa]x[bb]y[/]z[/]", twoTags())).toBe("<A>x<B>y</B>z</A>\n");
  });
});

// A style tag around a plugin pair styles the handler's output and the text
// either side, as it would plain text. The walk used to parse the text between
// plugin pairs as separate strings, so every style tag closed at the first
// pair's boundary and its closing tag then matched nothing (rich-markup-cg6).
describe("a style tag spans a plugin pair it encloses", () => {
  function registry(): MarkupRegistry {
    const r = new MarkupRegistry();
    r.register("aa", (ctx) => ctx.children);
    r.register("click", (ctx) => ctx.children);
    r.register("shout", (ctx) => new RichText(`<${ctx.children.plain}>`, { end: "" }).stylize("red"));
    r.register("tint", () => new RichText("S", { style: "green", end: "" }));
    return r;
  }
  const spans = (markup: string, options: Parameters<typeof renderMarkup>[1] = {}): string[] =>
    renderMarkup(markup, { registry: registry(), ...options }).spans.map((s) => `${s.start}-${s.end} ${String(s.style)}`);
  const ansi = (markup: string, r: MarkupRegistry): string =>
    renderToString(renderMarkup(markup, { registry: r }), { colorSystem: ColorDepth.STANDARD });

  it("covers the text before, the handler's output, and the text after", () => {
    expect(spans("[bold]x[click]y[/click]z[/bold]")).toEqual(["0-3 bold"]);
  });

  it("stays open across a plugin pair that [/] closes", () => {
    expect(spans("[bold]a [aa]b[/] c")).toEqual(["0-5 bold"]);
    expect(spans("[bold][aa]x[/][/]")).toEqual(["0-1 bold"]);
  });

  it("lets the handler's own style repaint the enclosing one, as an inner tag would", () => {
    const plain = new MarkupRegistry();
    expect(ansi("[blue]x[shout]y[/shout]z[/blue]", registry())).toBe(
      ansi("[blue]x[red]<y>[/red]z[/blue]", plain),
    );
  });

  it("lets markup repaint a base style when a plugin pair is present", () => {
    expect(spans("[blue]x[/blue][aa]y[/aa]", { baseStyle: "red" })).toEqual(["0-2 red", "0-1 blue"]);
  });

  it("lets a handler's own style repaint the base style, once, as a style tag does", () => {
    expect(spans("[shout]x[/shout]", { baseStyle: "blue" })).toEqual(["0-3 blue", "0-3 red"]);
    expect(spans("[red]<x>[/red]", { baseStyle: "blue" })).toEqual(["0-3 blue", "0-3 red"]);
    expect(spans("[tint][/tint]", { baseStyle: "blue" })).toEqual(["0-1 blue", "0-1 green"]);
    expect(spans("[green]S[/green]", { baseStyle: "blue" })).toEqual(["0-1 blue", "0-1 green"]);
  });

  it("paints the base style under a tag enclosing a pair, not over it", () => {
    expect(spans("[blue][aa]x[/aa][/blue]", { baseStyle: "red" })).toEqual(["0-1 red", "0-1 blue"]);
  });

  it("puts styles on the cells they name when a control character precedes them", () => {
    expect(spans("a\x07b[shout]cd[/shout][bold]e[/bold]")).toEqual(["6-7 bold", "2-6 red"]);
  });

  it("keeps the base style of the RichText a handler returns", () => {
    const r = new MarkupRegistry();
    r.register("st", () => new RichText("S", { style: "green", end: "" }));
    expect(renderMarkup("a[st][/st]", { registry: r }).spans.map((s) => `${s.start}-${s.end} ${String(s.style)}`)).toEqual([
      "1-2 green",
    ]);
  });
});

describe("a style tag cannot cross a plugin pair's boundary", () => {
  function registry(): MarkupRegistry {
    const r = new MarkupRegistry();
    r.register("aa", (ctx) => ctx.children);
    r.register("bb", (ctx) => ctx.children);
    return r;
  }

  it("rejects a style opened outside the pair and closed inside it", () => {
    const markup = "[red on blue][aa]x[/red on blue][/]";
    const err = rejectionOf(markup, registry());
    expect(err.reason).toMatch(/^Closing tag \[\/red on blue\] closes \[red on blue\] across the boundary of plugin tag \[aa\]/);
    expect(err.offset).toBe(markup.indexOf("[/red on blue]"));
    expect(err.openTags).toEqual(["[red on blue]", "[aa]"]);
  });

  it("rejects a style opened inside the pair and closed after it", () => {
    const markup = "[aa][bold]x[/aa]y[/bold]";
    const err = rejectionOf(markup, registry());
    expect(err.reason).toMatch(/^Closing tag \[\/bold\] closes \[bold\] across the boundary of plugin tag \[aa\]/);
    expect(err.offset).toBe(markup.indexOf("[/bold]"));
    // The pair's end closed [bold]; nothing is open where [/bold] stands.
    expect(err.openTags).toEqual([]);
  });

  const spans = (markup: string): string[] =>
    renderMarkup(markup, { registry: registry() }).spans.map((s) => `${s.start}-${s.end} ${String(s.style)}`);

  it("accepts a style left open inside the pair, which the pair's end closes", () => {
    expect(spans("[aa][bold]x[/aa] y")).toEqual(["0-1 bold"]);
  });

  it("points a later [/] at the tag open outside the pair, not one the pair's end closed", () => {
    expect(spans("[red][aa][bold]x[/aa]y[/]")).toEqual(["0-2 red", "0-1 bold"]);
    expect(spans("[bb][aa][bold]x[/aa][/]")).toEqual(["0-1 bold"]);
  });

  it("says the same of the crossing whether it is written [/bold] or [/]", () => {
    const err = rejectionOf("[aa][bold]x[/aa][/]", registry());
    expect(err.reason).toMatch(/^Closing tag \[\/\] closes \[bold\] across the boundary of plugin tag \[aa\]/);
  });

  it("blames a stray closer on no pair when the tag it names last closed properly", () => {
    const err = rejectionOf("[aa][bold]x[/aa][bold]y[/bold][/bold]", registry());
    expect(err.reason).toMatch(/^Closing tag \[\/bold\] doesn't match any open tag/);
  });

  it("names enclosing style tags among those open at an overlap", () => {
    const err = rejectionOf("[bold][aa][bb]x[/aa][/bb][/bold]", registry());
    expect(err.openTags).toEqual(["[bold]", "[aa]", "[bb]"]);
  });
});

// The plugin walk parses the caller's string in slices — around each plugin
// pair, and inside it — so every offset below is one a slice-relative count
// would get wrong.
describe("a syntax error inside a plugin-tagged string is located in the caller's string", () => {
  function registry(): MarkupRegistry {
    const r = new MarkupRegistry();
    r.register("aa", (ctx) => ctx.children);
    r.register("bb", (ctx) => ctx.children);
    return r;
  }

  it("locates an error in the text after a plugin pair", () => {
    const err = rejectionOf("[aa]x[/aa] then [/nope]", registry());
    expect([err.offset, err.column]).toEqual([16, 17]);
    expect(err.markup).toBe("[aa]x[/aa] then [/nope]");
    expect(err.openTags).toEqual([]);
  });

  it("locates the named close left over once [/] has closed the plugin tag", () => {
    const err = rejectionOf("[aa][/][/aa]", registry());
    expect(err.reason).toBe("Closing tag [/aa] doesn't match any open tag");
    expect(err.offset).toBe(7);
    expect(err.openTags).toEqual([]);
  });

  it("locates an error nested two plugin pairs deep, naming the enclosing tags", () => {
    const markup = "head\n[aa]one [bb][i]two[/u][/bb][/aa]";
    const err = rejectionOf(markup, registry());
    expect(err.offset).toBe(markup.indexOf("[/u]"));
    expect([err.line, err.column]).toEqual([2, 19]);
    expect(err.openTags).toEqual(["[aa]", "[bb]", "[i]"]);
  });
});

function rejectionOf(markup: string, registry: MarkupRegistry): MarkupSyntaxError {
  try {
    renderMarkup(markup, { registry });
  } catch (err) {
    if (err instanceof MarkupSyntaxError) return err;
    throw err;
  }
  return expect.unreachable(`${JSON.stringify(markup)} parsed without error`);
}
