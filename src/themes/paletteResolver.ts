import type { ColorRgba } from "../core/color.js";
import { Palette } from "./palette.js";
import { darken, alphaBlend, contrastFor } from "./colorMath.js";

const AUTO_NAME = "auto";

// Modifier matches the trailing "-darken-N" or "-lighten-N" of a name part.
// Anchored right (`.+` is greedy) because var names themselves contain
// hyphens — `"primary-background-darken-3"` must split into the var
// `primary-background` and the modifier `darken-3`, not `primary` /
// `background-darken-3`.
const MODIFIER_RE = /^(.+)-(darken|lighten)-(\d+)$/;
const ALPHA_RE = /^(\d+(?:\.\d+)?)%$/;

interface ParsedSpec {
  name: string;
  // Signed: positive darkens, negative lightens, 0 is identity.
  darkenLevels: number;
  // null = opaque; 0..1 = composite over `against`.
  alpha: number | null;
}

function parse(spec: string): ParsedSpec | null {
  const trimmed = spec.trim();
  if (trimmed === "") return null;

  const [namePart, alphaPart, ...rest] = trimmed.split(/\s+/);
  if (namePart === undefined || rest.length > 0) return null;

  let alpha: number | null = null;
  if (alphaPart !== undefined) {
    const m = ALPHA_RE.exec(alphaPart);
    if (m === null) return null;
    const pct = parseFloat(m[1]!);
    if (pct < 0 || pct > 100) return null;
    alpha = pct / 100;
  }

  const mod = MODIFIER_RE.exec(namePart);
  if (mod !== null) {
    const levels = parseInt(mod[3]!, 10);
    return {
      name: mod[1]!,
      darkenLevels: mod[2] === "darken" ? levels : -levels,
      alpha,
    };
  }
  return { name: namePart, darkenLevels: 0, alpha };
}

export interface ResolveContext {
  /**
   * The background the result will be painted on. Required for specs whose
   * meaning depends on a target: alpha (`primary 50%`) and auto-contrast
   * (`auto`, `auto 33%`). Bare names and modifiers do not need it.
   */
  against?: ColorRgba;
}

/**
 * Resolves Textual-style spec strings against a Palette into ColorTriplets.
 *
 * Spec grammar:
 *   spec      = name ("-darken-" N | "-lighten-" N)? (" " NN "%")?
 *   name      = "auto" | <palette var name>
 *
 * Examples (against gruvbox):
 *   "primary"                  → palette["primary"]
 *   "primary-background"       → palette["primary-background"] (name has hyphens)
 *   "primary-darken-3"         → darken(palette["primary"], 3)
 *   "primary 50%"              → alphaBlend(palette["primary"], against, 0.5)
 *   "auto 33%"                 → alphaBlend(contrastFor(against), against, 0.33)
 *   "primary-darken-3 50%"     → alphaBlend(darken(palette["primary"], 3), against, 0.5)
 *
 * Returns null on: invalid syntax, missing var, or missing required `against`.
 * Pure: same inputs always yield the same output, no internal state.
 */
export class PaletteResolver {
  constructor(readonly palette: Palette) {}

  resolve(spec: string, ctx?: ResolveContext): ColorRgba | null {
    const parsed = parse(spec);
    if (parsed === null) return null;

    // [LAW:one-type-per-behavior] `auto` is a synthetic var whose "lookup"
    // depends on ctx; named vars look up in the palette. Both produce a
    // ColorRgba | null, so the pipeline downstream is identical.
    const base = this.lookupBase(parsed.name, ctx);
    if (base === null) return null;

    // [LAW:dataflow-not-control-flow] darken at level 0 is a no-op (modulo
    // ±1 RGB roundtrip); we always run it and let the data (levels) decide
    // the magnitude. Negative levels lighten — same op, different value.
    const modified = darken(base, parsed.darkenLevels);

    if (parsed.alpha === null) return modified;
    if (!ctx?.against) return null;
    return alphaBlend(modified, ctx.against, parsed.alpha);
  }

  private lookupBase(
    name: string,
    ctx: ResolveContext | undefined,
  ): ColorRgba | null {
    if (name === AUTO_NAME) {
      return ctx?.against ? contrastFor(ctx.against) : null;
    }
    return this.palette.get(name) ?? null;
  }
}
