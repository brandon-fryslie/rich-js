import { describe, it, expect } from "vitest";
import { createRichTextEngine, richTextFuncs } from "../../src/template-bindings/index.js";
import { Style } from "../../src/core/style.js";
import { ColorSpec } from "../../src/core/color.js";
import { RichText } from "../../src/core/text.js";

// [LAW:behavior-not-structure] Tests assert the binding contract — fragments
// produced by template evaluation are equivalent to fragments produced by
// directly constructing the corresponding Style chain. The "round-trip
// through Style without semantic drift" criterion in the ticket.

const engine = createRichTextEngine();

function evalOne(template: string): RichText {
  const result = engine.parse(template).evaluate({});
  expect(result.length).toBe(1);
  return result[0]!;
}

describe("richTextFuncs() inventory", () => {
  it("registers every named color from ANSI_COLOR_NAMES", () => {
    const funcs = richTextFuncs();
    expect(funcs.red).toBeDefined();
    expect(funcs.blue).toBeDefined();
    expect(funcs.bright_red).toBeDefined();
    expect(funcs.deep_pink4).toBeDefined();
    // grey/gray aliases both registered (color.ts mirrors them)
    expect(funcs.grey0).toBeDefined();
    expect(funcs.gray0).toBeDefined();
  });

  it("registers the four generic foreground / background forms", () => {
    const funcs = richTextFuncs();
    expect(funcs.color).toBeDefined();
    expect(funcs.hex).toBeDefined();
    expect(funcs.rgb).toBeDefined();
    expect(funcs.on).toBeDefined();
  });

  it("registers every text attribute and its negation", () => {
    const funcs = richTextFuncs();
    for (const name of [
      "bold", "dim", "italic", "underline", "blink", "blink2",
      "reverse", "conceal", "strike", "underline2", "frame", "encircle", "overline",
    ]) {
      expect(funcs[name]).toBeDefined();
      expect(funcs[`not_${name}`]).toBeDefined();
    }
  });

  it("registers short attribute aliases", () => {
    const funcs = richTextFuncs();
    for (const alias of ["b", "d", "i", "u", "s", "r", "o", "uu"]) {
      expect(funcs[alias]).toBeDefined();
    }
  });
});

describe("named foreground colors", () => {
  it("red wraps a string literal with foreground red", () => {
    const rt = evalOne(`{{ red "x" }}`);
    expect(rt.plain).toBe("x");
    expect(rt.style.color?.name).toBe("red");
  });

  it("bright_blue wraps with the bright_blue color spec", () => {
    const rt = evalOne(`{{ bright_blue "y" }}`);
    expect(rt.style.color?.name).toBe("bright_blue");
  });

  it("matches Style.parse semantics for the same color name", () => {
    const rt = evalOne(`{{ magenta "z" }}`);
    const direct = Style.parse("magenta");
    expect(rt.style.color?.name).toBe(direct.color?.name);
  });
});

describe("text attributes", () => {
  it("bold sets the bold flag", () => {
    const rt = evalOne(`{{ bold "x" }}`);
    expect(rt.style.bold).toBe(true);
  });

  it("italic alias 'i' produces the same style as canonical 'italic'", () => {
    const a = evalOne(`{{ italic "x" }}`);
    const b = evalOne(`{{ i "x" }}`);
    expect(b.style.italic).toBe(a.style.italic);
    expect(b.style.italic).toBe(true);
  });

  it("not_bold sets bold to false", () => {
    const rt = evalOne(`{{ not_bold "x" }}`);
    expect(rt.style.bold).toBe(false);
  });
});

describe("generic foreground / background forms", () => {
  it("color N applies palette index N", () => {
    const rt = evalOne(`{{ color 196 "x" }}`);
    const expected = ColorSpec.fromAnsi(196);
    expect(rt.style.color?.name).toBe(expected.name);
  });

  it("hex parses #af00ff as truecolor", () => {
    const rt = evalOne(`{{ hex "#af00ff" "x" }}`);
    expect(rt.style.color?.name).toBe("#af00ff");
  });

  it("hex accepts the eight-digit RGBA form", () => {
    const rt = evalOne(`{{ hex "#af00ff80" "x" }}`);
    expect(rt.style.color?.getTruecolor().hex).toBe("#af00ff80");
  });

  it("hex rejects non-hex colour-spec strings", () => {
    // [LAW:types-are-the-program] hex advertises a narrower domain than
    // ColorSpec.parse; named colours, rgb(...), color(N) must not slip through.
    expect(() => evalOne(`{{ hex "red" "x" }}`)).toThrow(/hex expected/);
    expect(() => evalOne(`{{ hex "rgb(1,2,3)" "x" }}`)).toThrow(/hex expected/);
    expect(() => evalOne(`{{ hex "color(42)" "x" }}`)).toThrow(/hex expected/);
    expect(() => evalOne(`{{ hex "af00ff" "x" }}`)).toThrow(/hex expected/);
    expect(() => evalOne(`{{ hex "#af00f" "x" }}`)).toThrow(/hex expected/);
  });

  it("rgb 175 0 255 produces the same color as hex #af00ff", () => {
    const rgb = evalOne(`{{ rgb 175 0 255 "x" }}`);
    const hex = evalOne(`{{ hex "#af00ff" "x" }}`);
    expect(rgb.style.color?.getTruecolor().hex).toBe(
      hex.style.color?.getTruecolor().hex,
    );
  });

  it("on parses any color spec for the background slot", () => {
    const rt = evalOne(`{{ on "white" "x" }}`);
    expect(rt.style.bgcolor?.name).toBe("white");
    expect(rt.style.color).toBeUndefined();
  });

  it("on accepts hex / rgb / palette strings via Color.parse", () => {
    expect(evalOne(`{{ on "#112233" "x" }}`).style.bgcolor?.name).toBe("#112233");
    expect(evalOne(`{{ on "rgb(10,20,30)" "x" }}`).style.bgcolor?.name).toBe("rgb(10,20,30)");
    expect(evalOne(`{{ on "color(42)" "x" }}`).style.bgcolor?.name).toBe("color(42)");
  });
});

describe("composition: outer wraps inner additively (Style.add semantics)", () => {
  it("red (bold \"x\") combines bold + red", () => {
    const rt = evalOne(`{{ red (bold "x") }}`);
    expect(rt.plain).toBe("x");
    expect(rt.style.bold).toBe(true);
    expect(rt.style.color?.name).toBe("red");
  });

  it("bold (red \"x\") produces the same combined style as red (bold \"x\")", () => {
    const a = evalOne(`{{ red (bold "x") }}`);
    const b = evalOne(`{{ bold (red "x") }}`);
    expect(b.style.bold).toBe(a.style.bold);
    expect(b.style.color?.name).toBe(a.style.color?.name);
  });

  it("on \"white\" (red \"x\") combines fg + bg", () => {
    const rt = evalOne(`{{ on "white" (red "x") }}`);
    expect(rt.style.color?.name).toBe("red");
    expect(rt.style.bgcolor?.name).toBe("white");
  });

  it("conflicts: outer wins (red over blue)", () => {
    const rt = evalOne(`{{ red (blue "x") }}`);
    expect(rt.style.color?.name).toBe("red");
  });

  it("template-built fragment equals the directly-constructed Style chain", () => {
    const rt = evalOne(`{{ on "white" (bold (red "hello")) }}`);
    const expected = Style.combine([
      Style.parse("red"),
      Style.parse("bold"),
      Style.parse("on white"),
    ]);
    expect(rt.style.color?.name).toBe(expected.color?.name);
    expect(rt.style.bgcolor?.name).toBe(expected.bgcolor?.name);
    expect(rt.style.bold).toBe(expected.bold);
  });
});

describe("string lifting via the engine's fromString bridge", () => {
  it("a string literal is accepted and lifted to RichText", () => {
    const rt = evalOne(`{{ red "literal" }}`);
    expect(rt).toBeInstanceOf(RichText);
    expect(rt.plain).toBe("literal");
  });

  it("a scope field that resolves to a string is lifted the same way", () => {
    const rt = engine.parse(`{{ red .name }}`).evaluate({ name: "Brandon" });
    expect(rt[0]!.plain).toBe("Brandon");
    expect(rt[0]!.style.color?.name).toBe("red");
  });
});

describe("error surface", () => {
  it("arity / type errors raise from the engine, not from the body", () => {
    // First arg of `on` is declared "string" — passing a non-string is a
    // TypeMismatchError before the body runs.
    expect(() => engine.parse(`{{ on 5 "x" }}`).evaluate({})).toThrowError(
      /TypeMismatch|expected/i,
    );
  });

  it("a number passed where a fragment is expected fails the liftable gate", () => {
    expect(() => engine.parse(`{{ red 5 }}`).evaluate({})).toThrowError();
  });

  it("an unknown function name is a FuncNotFoundError", () => {
    expect(() => engine.parse(`{{ neonpurple "x" }}`).evaluate({})).toThrowError(
      /neonpurple|FuncNotFound/,
    );
  });
});

describe("multi-fragment templates", () => {
  it("two top-level expressions emit two separate RichText fragments", () => {
    const out = engine.parse(`{{ red "a" }}{{ blue "b" }}`).evaluate({});
    expect(out.length).toBe(2);
    expect(out[0]!.plain).toBe("a");
    expect(out[0]!.style.color?.name).toBe("red");
    expect(out[1]!.plain).toBe("b");
    expect(out[1]!.style.color?.name).toBe("blue");
  });
});

describe("link function (cell-splitter contract)", () => {
  it("link wraps a string literal with the link slot set", () => {
    const rt = evalOne(`{{ link "https://example.com" "label" }}`);
    expect(rt.plain).toBe("label");
    expect(rt.style.link).toBe("https://example.com");
  });

  it("equivalent to Style.parse(\"link URL\") for the same URL", () => {
    const rt = evalOne(`{{ link "https://example.com" "x" }}`);
    expect(rt.style.link).toBe(Style.parse("link https://example.com").link);
  });

  it("nested links collapse with the outer winning", () => {
    const rt = evalOne(`{{ link "outer" (link "inner" "x") }}`);
    expect(rt.style.link).toBe("outer");
  });

  it("link inside a non-link style preserves both", () => {
    // `{{ bold (link "u" "x") }}` — outer is bold, inner sets link.
    // Style.add propagates link from inner to outer fragment.
    const rt = evalOne(`{{ bold (link "u" "x") }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.link).toBe("u");
  });

  it("non-link style inside a link preserves both", () => {
    // `{{ link "u" (bold "x") }}` — outer is link, inner is bold.
    const rt = evalOne(`{{ link "u" (bold "x") }}`);
    expect(rt.style.bold).toBe(true);
    expect(rt.style.link).toBe("u");
  });

  it("link composes with foreground / background colour", () => {
    const rt = evalOne(`{{ link "u" (red (on "white" "x")) }}`);
    expect(rt.style.link).toBe("u");
    expect(rt.style.color?.name).toBe("red");
    expect(rt.style.bgcolor?.name).toBe("white");
  });

  it("a link-bearing fragment's Style equals the directly-constructed equivalent", () => {
    const rt = evalOne(`{{ red (link "u" (bold "hello")) }}`);
    const expected = Style.combine([
      Style.parse("bold"),
      Style.parse("link u"),
      Style.parse("red"),
    ]);
    expect(rt.style.color?.name).toBe(expected.color?.name);
    expect(rt.style.bold).toBe(expected.bold);
    expect(rt.style.link).toBe(expected.link);
  });
});

describe("multi-cell contract (consumer-side cell splitting)", () => {
  // Test renderer implementing the contract described in
  // spec/template-bindings.md → "Cell-splitting algorithm (consumer side)".
  // Consumers (cc-candybar et al.) build their own equivalent — this
  // verifies the binding produces fragments the contract can interpret.
  function splitCells(fragments: readonly RichText[]): {
    cells: { fragment: RichText; before: RichText[] }[];
    trailing: RichText[];
  } {
    const cells: { fragment: RichText; before: RichText[] }[] = [];
    let pending: RichText[] = [];
    for (const f of fragments) {
      if (f.style.link) {
        cells.push({ fragment: f, before: pending });
        pending = [];
      } else {
        pending.push(f);
      }
    }
    return { cells, trailing: pending };
  }

  it("a single top-level link is one cell with no joiner", () => {
    const out = engine.parse(`{{ link "u" "a" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.fragment.plain).toBe("a");
    expect(cells[0]!.fragment.style.link).toBe("u");
    expect(cells[0]!.before).toEqual([]);
    expect(trailing).toEqual([]);
  });

  it("two top-level links separated by literal text split into two cells with the literal as joiner", () => {
    const out = engine.parse(`{{ link "u1" "a" }} {{ link "u2" "b" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(2);

    // First cell: link u1, no joiner before.
    expect(cells[0]!.fragment.plain).toBe("a");
    expect(cells[0]!.fragment.style.link).toBe("u1");
    expect(cells[0]!.before).toEqual([]);

    // Second cell: link u2, joined by " ".
    expect(cells[1]!.fragment.plain).toBe("b");
    expect(cells[1]!.fragment.style.link).toBe("u2");
    expect(cells[1]!.before.length).toBe(1);
    expect(cells[1]!.before[0]!.plain).toBe(" ");
    expect(cells[1]!.before[0]!.style.link).toBeUndefined();

    expect(trailing).toEqual([]);
  });

  it("nested links produce a single cell with the outer link applied", () => {
    const out = engine.parse(`{{ link "outer" (link "inner" "x") }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.fragment.style.link).toBe("outer");
    expect(trailing).toEqual([]);
  });

  it("link wrapped by bold yields one cell with both styles", () => {
    const out = engine.parse(`{{ bold (link "u" "x") }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.fragment.style.bold).toBe(true);
    expect(cells[0]!.fragment.style.link).toBe("u");
    expect(trailing).toEqual([]);
  });

  it("a link-free template yields no cells; everything is trailing joiner content", () => {
    const out = engine.parse(`{{ red "hello" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(0);
    expect(trailing.length).toBe(1);
    expect(trailing[0]!.plain).toBe("hello");
    expect(trailing[0]!.style.color?.name).toBe("red");
  });

  it("leading literal before a link becomes the cell's joiner", () => {
    const out = engine.parse(`prefix {{ link "u" "a" }}`).evaluate({});
    const { cells, trailing } = splitCells(out);
    expect(cells.length).toBe(1);
    expect(cells[0]!.before.length).toBe(1);
    expect(cells[0]!.before[0]!.plain).toBe("prefix ");
    expect(trailing).toEqual([]);
  });
});
