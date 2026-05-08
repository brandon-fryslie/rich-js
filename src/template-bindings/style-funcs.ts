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
import { Style } from "../core/style.js";
import { ColorSpec, ANSI_COLOR_NAMES } from "../core/color.js";
import { RichText } from "../core/text.js";

// --- Helpers ---

/**
 * Apply a style on top of an already-styled RichText fragment.
 *
 * The engine's `"liftable"` arg type lifts string literals to
 * `RichText` via the binding's `fromString` *before* the body runs,
 * so by the time we get here, `child` is always a `RichText`. The
 * defensive instanceof check exists because `"liftable"` admits any
 * non-primitive value — the engine cannot prove the object is the
 * binding's own `T`. A misuse (`{{ red someMap }}`) lands here and
 * fails loudly rather than producing a malformed fragment.
 *
 * Conflict resolution follows `Style.add`: the outer (newly applied)
 * style wins. `red (bold "x")` → bold + red; `red (red "x")` → red.
 * Spans inside the inner fragment are preserved as-is — their styles
 * compose with the new wrapper at render time via the segment
 * pipeline's existing additive semantics.
 */
function applyStyleToFragment(child: unknown, style: Style): RichText {
  if (!(child instanceof RichText)) {
    throw new TypeError(
      `style function expected a RichText fragment, got ${typeof child === "object" ? Object.prototype.toString.call(child) : typeof child}`,
    );
  }
  const result = child.copy();
  result.style = child.style.add(style);
  return result;
}

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

const colorHexFunc: TemplateFunc = {
  fn: ((hex: string, child: unknown) => {
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

const ATTRIBUTE_NAMES = [
  "bold",
  "dim",
  "italic",
  "underline",
  "blink",
  "blink2",
  "reverse",
  "conceal",
  "strike",
  "underline2",
  "frame",
  "encircle",
  "overline",
] as const;
type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

const ATTRIBUTE_ALIASES: Record<string, AttributeName> = {
  b: "bold",
  d: "dim",
  i: "italic",
  u: "underline",
  s: "strike",
  r: "reverse",
  o: "overline",
  uu: "underline2",
};

function attrStyle(name: AttributeName, value: boolean): Style {
  return new Style({ [name]: value });
}

function attributeFuncs(): FuncMap {
  const out: FuncMap = {};
  for (const name of ATTRIBUTE_NAMES) {
    out[name] = fgFunc(attrStyle(name, true));
    out[`not_${name}`] = fgFunc(attrStyle(name, false));
  }
  for (const [alias, canonical] of Object.entries(ATTRIBUTE_ALIASES)) {
    out[alias] = fgFunc(attrStyle(canonical, true));
  }
  return out;
}

// --- Public assembly ---

/**
 * The full binding registration set produced by this epic — foreground
 * colours (named + generic forms), background (`on`), and text
 * attributes (canonical names, short aliases, and `not_*` negations).
 *
 * `link`, palette/theme/auto-contrast, and per-position hue rotation
 * are deliberately absent — they ship in the follow-up epics on the
 * same `template-bindings` topic.
 */
export function richTextStyleFuncs(): FuncMap {
  return {
    ...namedColorFuncs(),
    color: colorPaletteFunc,
    hex: colorHexFunc,
    rgb: colorRgbFunc,
    on: onFunc,
    ...attributeFuncs(),
  };
}
