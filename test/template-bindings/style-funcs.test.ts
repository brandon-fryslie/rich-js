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
