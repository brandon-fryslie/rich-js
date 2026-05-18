/**
 * Style-function registrations for the rich-js template binding.
 *
 * [LAW:one-source-of-truth] The function inventory below mirrors the
 * string-syntax style vocabulary documented in `spec/style.md` —
 * foreground colours (named, palette index, hex, RGB), background
 * (`on`), text attributes (positive + negated), and short aliases.
 * Each registration is a templating-time analogue of a piece of
 * `Style.parse`, so a template fragment composed by these functions
 * round-trips through `Style` without semantic drift.
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
import { ColorSpec, ANSI_COLOR_NAMES } from "../core/color.js";
import { applyStyleToFragment } from "./helpers.js";

function fgFunc(style: Style): TemplateFunc {
  return {
    fn: ((child: unknown) => applyStyleToFragment(child, style)) as TemplateFunc["fn"],
    argTypes: ["liftable"],
    returnType: "T",
  };
}

// --- Foreground colours: named ---

function namedColorFuncs(): FuncMap {
  const out: FuncMap = {};
  for (const name of Object.keys(ANSI_COLOR_NAMES)) {
    const colorSpec = ColorSpec.parse(name);
    out[name] = fgFunc(new Style({ color: colorSpec }));
  }
  return out;
}

// --- Foreground colours: generic forms ---

const colorPaletteFunc: TemplateFunc = {
  fn: ((index: number, child: unknown) => {
    if (!Number.isInteger(index) || index < 0 || index > 255) {
      throw new RangeError(`color index ${index} is out of range (0-255)`);
    }
    return applyStyleToFragment(child, new Style({ color: ColorSpec.fromAnsi(index) }));
  }) as TemplateFunc["fn"],
  argTypes: ["number", "liftable"],
  returnType: "T",
};

// [LAW:types-are-the-program] `hex` advertises a narrower domain than the
// general colour-spec parser — only `#RRGGBB` / `#RRGGBBAA` is admitted.
// Without this gate, `ColorSpec.parse` would silently accept any colour-spec
// string (named colours, `rgb(...)`, `color(N)`), letting `hex "red"` succeed
// and masking author mistakes.
const HEX_INPUT_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const colorHexFunc: TemplateFunc = {
  fn: ((hex: string, child: unknown) => {
    if (!HEX_INPUT_RE.test(hex)) {
      throw new RangeError(
        `hex expected #RRGGBB or #RRGGBBAA, got ${JSON.stringify(hex)}`,
      );
    }
    return applyStyleToFragment(child, new Style({ color: ColorSpec.parse(hex) }));
  }) as TemplateFunc["fn"],
  argTypes: ["string", "liftable"],
  returnType: "T",
};

const colorRgbFunc: TemplateFunc = {
  fn: ((r: number, g: number, b: number, child: unknown) => {
    return applyStyleToFragment(child, new Style({ color: ColorSpec.fromRgb(r, g, b) }));
  }) as TemplateFunc["fn"],
  argTypes: ["number", "number", "number", "liftable"],
  returnType: "T",
};

// --- Background ---

const onFunc: TemplateFunc = {
  fn: ((spec: string, child: unknown) => {
    return applyStyleToFragment(child, new Style({ bgcolor: ColorSpec.parse(spec) }));
  }) as TemplateFunc["fn"],
  argTypes: ["string", "liftable"],
  returnType: "T",
};

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
    out[name] = fgFunc(attrStyle(name, true));
    out[`not_${name}`] = fgFunc(attrStyle(name, false));
  }
  for (const [alias, canonical] of Object.entries(ATTRIBUTE_SHORT_ALIASES)) {
    out[alias] = fgFunc(attrStyle(canonical, true));
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
// Motivation: the per-attribute functions (`bold`, `underline`, `hex`, …)
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
// through any outer wrapping call, so `{{ red (link "u" "x") }}` and
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
 * The full binding registration set populated by the template-bindings
 * style epics — foreground colours (named + generic forms), background
 * (`on`), text attributes (canonical names, short aliases, and `not_*`
 * negations), and the hyperlink cell-splitter (`link`).
 *
 * Palette/theme/auto-contrast and per-position hue rotation are
 * deliberately absent — they ship in `rich-template-bindings-83q`.
 */
export function richTextStyleFuncs(): FuncMap {
  return {
    ...namedColorFuncs(),
    color: colorPaletteFunc,
    hex: colorHexFunc,
    rgb: colorRgbFunc,
    on: onFunc,
    ...attributeFuncs(),
    link: linkFunc,
    style: styleSpecFunc,
  };
}
