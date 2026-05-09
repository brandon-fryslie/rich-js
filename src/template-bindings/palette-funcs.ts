/**
 * Palette / theme / auto-contrast function registrations for the rich-js
 * template binding.
 *
 * [LAW:one-source-of-truth] All palette resolution flows through the existing
 * `PaletteResolver.resolve(spec, ctx)` API — this module adds no resolution
 * logic of its own. The template functions here are thin adaptors that translate
 * function call arguments into a `(spec, ctx)` call and wrap the resulting
 * `ColorRgba` as a `Style` applied to the child fragment.
 *
 * [LAW:dataflow-not-control-flow] Every function follows the same shape:
 * resolve spec → apply as foreground color → return styled fragment. The
 * variability is in the spec string and the optional against context; the
 * operation is fixed.
 *
 * ### Surface design rationale
 *
 * Three layers of ergonomics:
 *
 * 1. **Semantic-name functions** — one function per palette variable whose
 *    name is a valid Go template identifier (no hyphens). `{{ primary child }}`,
 *    `{{ accent child }}`, etc. The happy path: common semantic names read
 *    cleanly in templates. Hyphenated names (`primary-muted`, `text-primary`)
 *    cannot be Go template identifiers and are accessed via `palette`.
 *
 * 2. **`palette "spec" child`** — the general-purpose function for any spec
 *    that does not need a background context (bare names and darken/lighten
 *    modifiers). Covers hyphenated names and modifier chains.
 *
 * 3. **`paletteOver "spec" "#bgHex" child`** — for specs that require a
 *    background context: alpha compositing (`"primary 50%"`) and auto-contrast
 *    (`"auto"`, `"auto 33%"`). The bg color is threaded as an explicit hex
 *    argument rather than via a scope side-channel — no mutable state, no
 *    closure magic; the data flows through the function call.
 *
 * 4. **`auto "#bgHex" child`** — syntactic sugar for
 *    `{{ paletteOver "auto" "#bgHex" child }}`, the common auto-contrast case.
 *
 * ### Theme switching
 *
 * `paletteFuncs(resolver)` captures `resolver` at construction time. Consumers
 * that need runtime theme switching create a new `paletteFuncs()` from the new
 * theme's resolver and rebuild their engine (or merge into a fresh `FuncMap`).
 * The same template *source* produces different colors because the functions in
 * the engine changed — the template text is the same, the resolver differs.
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import { ColorSpec, ColorRgba } from "../core/color.js";
import { Style } from "../core/style.js";
import { RichText } from "../core/text.js";
import { PaletteResolver } from "../themes/paletteResolver.js";
import { applyStyleToFragment } from "./helpers.js";

// Regex for validating hex bg strings accepted by `paletteOver` and `auto`.
// Accepts #RRGGBB and #RRGGBBAA — same gate as the `hex` style function.
const HEX_BG_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/**
 * Convert a hex string to `ColorRgba`. Only #RRGGBB / #RRGGBBAA accepted.
 * Throws `RangeError` on invalid input — surfaces as an `EvalError` in the
 * template engine, giving the author a precise failure message.
 */
function hexToColorRgba(hex: string): ColorRgba {
  if (!HEX_BG_RE.test(hex)) {
    throw new RangeError(
      `palette background expected #RRGGBB or #RRGGBBAA, got ${JSON.stringify(hex)}`,
    );
  }
  // ColorSpec.parse("#RRGGBB") → TRUECOLOR spec; getTruecolor() returns value directly.
  return ColorSpec.parse(hex).getTruecolor();
}

/**
 * Resolve `spec` against the resolver (with optional background context) and
 * apply the resulting color as a foreground `Style` on `child`.
 *
 * Throws on resolution failure with a contextual message — including a hint to
 * use `paletteOver` when the spec needs a background but none was provided.
 */
function resolveAndApply(
  resolver: PaletteResolver,
  spec: string,
  against: ColorRgba | undefined,
  child: unknown,
): RichText {
  const color = resolver.resolve(spec, against !== undefined ? { against } : undefined);
  if (color === null) {
    const hint =
      against === undefined
        ? "; for specs with alpha or auto-contrast, use paletteOver"
        : "";
    throw new Error(
      `palette spec ${JSON.stringify(spec)} did not resolve — check the spec string is valid and the variable exists${hint}`,
    );
  }
  return applyStyleToFragment(child, new Style({ color: ColorSpec.fromRgba(color) }));
}

// [LAW:types-are-the-program] Only palette var names that are valid Go template
// identifiers (letter/underscore start, alphanumeric/underscore body) get
// individual functions. Hyphenated names like "primary-muted" parse as subtraction
// in Go template syntax and cannot be function names.
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function semanticNameFuncs(resolver: PaletteResolver): FuncMap {
  const out: FuncMap = {};
  for (const name of resolver.palette.vars.keys()) {
    if (!IDENTIFIER_RE.test(name)) continue;
    // [LAW:dataflow-not-control-flow] Capture name; same fn shape for every entry.
    const captured = name;
    out[captured] = {
      fn: ((child: unknown) =>
        resolveAndApply(resolver, captured, undefined, child)) as TemplateFunc["fn"],
      argTypes: ["liftable"],
      returnType: "T",
    };
  }
  return out;
}

function makePaletteFunc(resolver: PaletteResolver): TemplateFunc {
  return {
    fn: ((spec: string, child: unknown) =>
      resolveAndApply(resolver, spec, undefined, child)) as TemplateFunc["fn"],
    argTypes: ["string", "liftable"],
    returnType: "T",
  };
}

function makePaletteOverFunc(resolver: PaletteResolver): TemplateFunc {
  return {
    fn: ((spec: string, bgHex: string, child: unknown) =>
      resolveAndApply(resolver, spec, hexToColorRgba(bgHex), child)) as TemplateFunc["fn"],
    argTypes: ["string", "string", "liftable"],
    returnType: "T",
  };
}

function makeAutoFunc(resolver: PaletteResolver): TemplateFunc {
  return {
    fn: ((bgHex: string, child: unknown) =>
      resolveAndApply(resolver, "auto", hexToColorRgba(bgHex), child)) as TemplateFunc["fn"],
    argTypes: ["string", "liftable"],
    returnType: "T",
  };
}

/**
 * Build a `FuncMap` exposing the semantic palette of `resolver` as template
 * functions. Merge into `richTextFuncs()` (or pass to `createEngine`) to make
 * palette colors available in templates.
 *
 * Registered functions:
 * - One function per palette variable whose name is a valid Go template
 *   identifier: `{{ primary child }}`, `{{ accent child }}`, etc.
 * - `palette "spec" child` — any spec without background context.
 * - `paletteOver "spec" "#bgHex" child` — any spec needing a background (alpha,
 *   auto-contrast).
 * - `auto "#bgHex" child` — sugar for `paletteOver "auto" bgHex child`.
 *
 * @example
 * ```ts
 * import { createEngine } from "@promptctl/go-template-js";
 * import { GRUVBOX, PaletteResolver, RichText } from "rich-js";
 * import { richTextFuncs, paletteFuncs } from "rich-js/template-bindings";
 *
 * const engine = createEngine({
 *   fromString: (s) => new RichText(s),
 *   toString: (rt) => rt.plain,
 *   funcs: { ...richTextFuncs(), ...paletteFuncs(new PaletteResolver(GRUVBOX.palette)) },
 * });
 * ```
 */
export function paletteFuncs(resolver: PaletteResolver): FuncMap {
  return {
    ...semanticNameFuncs(resolver),
    palette: makePaletteFunc(resolver),
    paletteOver: makePaletteOverFunc(resolver),
    auto: makeAutoFunc(resolver),
  };
}
