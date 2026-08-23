/**
 * Style-function registrations for the rich-js template binding.
 *
 * [LAW:one-source-of-truth] The function inventory below mirrors the
 * string-syntax style vocabulary documented in `spec/style.md` — the two
 * colour slots (`fg`/`bg`), text attributes (positive + negated), short
 * aliases, and the hyperlink. Each registration is a templating-time analogue
 * of a piece of `Style.parse`, so a template fragment composed by these
 * functions round-trips through `Style` without semantic drift.
 *
 * [LAW:dataflow-not-control-flow] Every function follows the same
 * shape: child `RichText` in, `RichText` out. The styling difference
 * lives in a captured `Style` value (or constructor closure), not in
 * branches inside a single dispatch. That is why this file is mostly
 * factories — the data (the colour, the attribute name) is the
 * variability; the operation is fixed.
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import {
  Style,
  ATTRIBUTE_NAMES,
  ATTRIBUTE_SHORT_ALIASES,
  type AttributeName,
} from "../core/style.js";
import { ColorSpec } from "../core/color.js";
import { applyStyleToFragment } from "./helpers.js";

function attrFunc(style: Style): TemplateFunc {
  return {
    fn: ((child: unknown) => applyStyleToFragment(child, style)) as TemplateFunc["fn"],
    argTypes: ["liftable"],
    returnType: "T",
  };
}

// --- Colour sinks ---
//
// `fg` and `bg` are the only two colour-applying functions, and they are the
// terminal step of the colour pipeline: `color` names a colour, the functions
// in `color-funcs.ts` transform it, these paint it onto text.
//
// [LAW:composability] They replace five separate families — one function per
// ANSI colour name (`red`, `bright_blue`, …), `hex`, `rgb`, `color` (256-index),
// and `on` (background). Every one of those encoded *which colour* in the
// function's identity, so the vocabulary could only grow by adding names, and
// a colour computed at render time could not be applied at all. Here the colour
// is an argument, so the sink admits every colour that exists and every colour
// that will ever exist. Two functions, unbounded reach.
//
// [LAW:types-are-the-program] The slot accepts the full `ColorSpec.parse`
// vocabulary, which is wider than the hex the colour math produces — and that
// width is deliberate, not laxity. `#7aa2f7` is a *concrete* colour; `"red"`
// and `"color(42)"` are *symbolic* ones the terminal resolves against its own
// theme. Only concrete colours can be darkened or blended, which is why the
// colour-math functions take hex alone; but both kinds can be painted, so the
// sink takes the union. The type of each slot is exactly the set of values that
// slot can mean something for.

function colorSinkFunc(slot: "color" | "bgcolor"): TemplateFunc {
  return {
    fn: ((spec: string, child: unknown) =>
      applyStyleToFragment(
        child,
        new Style({ [slot]: ColorSpec.parse(spec) }),
      )) as TemplateFunc["fn"],
    argTypes: ["string", "liftable"],
    returnType: "T",
  };
}

// --- Text attributes ---
//
// [LAW:one-source-of-truth] The attribute and short-alias inventories
// come from `core/style.ts`. This file derives the template registration
// set from the same data `Style.parse` consults — adding an attribute or
// alias in one place propagates here automatically.

function attrStyle(name: AttributeName, value: boolean): Style {
  return new Style({ [name]: value });
}

function attributeFuncs(): FuncMap {
  const out: FuncMap = {};
  for (const name of ATTRIBUTE_NAMES) {
    out[name] = attrFunc(attrStyle(name, true));
    out[`not_${name}`] = attrFunc(attrStyle(name, false));
  }
  for (const [alias, canonical] of Object.entries(ATTRIBUTE_SHORT_ALIASES)) {
    out[alias] = attrFunc(attrStyle(canonical, true));
  }
  return out;
}

// --- Style spec (multi-attribute one-shot) ---
//
// [LAW:one-source-of-truth] `style` accepts the same space-separated grammar
// `Style.parse` consults — i.e. the inside of `[...]` markup. There is no
// second parser: a spec that `Style.parse` accepts produces a fragment
// byte-equivalent to the same spec inside markup, and one that `Style.parse`
// rejects raises the same `StyleSyntaxError` surface.
//
// Motivation: the per-attribute functions (`bold`, `underline`, `fg`, …)
// compose by nesting. For "apply a fixed set of styles to this child" or
// "apply this named style set everywhere", nesting is awkward and the
// style description is fragmented across multiple call sites. `style`
// collapses that to a single call, and because the spec is a string it
// flows through Go-template `$vars` and through scope without further
// machinery:
//
//   {{ $alert := "bold underline #ff6b6b" }}
//   {{ style $alert "alarm!" }}
//   {{ style $alert .otherField }}
//
// [LAW:dataflow-not-control-flow] Same shape as every other style function:
// a `Style` value (here built by `Style.parse(spec)`) plus a child, in,
// styled child out. The variability is the spec string; the operation is
// fixed.

const styleSpecFunc: TemplateFunc = {
  fn: ((spec: string, child: unknown) => {
    return applyStyleToFragment(child, Style.parse(spec));
  }) as TemplateFunc["fn"],
  argTypes: ["string", "liftable"],
  returnType: "T",
};

// --- Hyperlink ---
//
// `link` is the cell-splitter for the multi-cell consumer contract.
// Implementation-wise it is the same shape as any other style function:
// it sets the `link` slot of `Style` exactly as the existing string-form
// `link URL` does, so a template-built fragment is byte-equivalent to
// `RichText("x", { style: Style.parse("link u") })`.
//
// The cell-boundary signal that consumers (cc-candybar et al.) walk is
// `fragment.style.link` being truthy. `Style.add` propagates `link`
// through any outer wrapping call, so `{{ fg "red" (link "u" "x") }}` and
// `{{ link "u" "x" }}` produce shapes that both qualify as cells from
// the consumer's perspective. Outer-wins on nested links comes for free
// from `Style.add`'s right-wins-on-conflict rule.
//
// [LAW:dataflow-not-control-flow] No special-case AST node, no
// `LinkFragment` subclass, no second emitter path — the variability is
// the value of `style.link`, not whether some control-flow branch ran.

const linkFunc: TemplateFunc = {
  fn: ((url: string, child: unknown) => {
    return applyStyleToFragment(child, new Style({ link: url }));
  }) as TemplateFunc["fn"],
  argTypes: ["string", "liftable"],
  returnType: "T",
};

// --- Public assembly ---

/**
 * Text-styling registrations: the two colour sinks (`fg`, `bg`), text
 * attributes (canonical names, short aliases, and `not_*` negations), the
 * hyperlink cell-splitter (`link`), and the multi-attribute `style` spec.
 *
 * Colours themselves come from elsewhere: `colorFuncs()` for the palette-free
 * math, `paletteFuncs()` for naming a theme colour. This module only paints.
 * [LAW:one-way-deps] — nothing here imports a palette.
 */
export function richTextStyleFuncs(): FuncMap {
  return {
    fg: colorSinkFunc("color"),
    bg: colorSinkFunc("bgcolor"),
    ...attributeFuncs(),
    link: linkFunc,
    style: styleSpecFunc,
  };
}
