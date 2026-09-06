/**
 * The palette-dependent template functions: `color`, and `ramp` whose stops
 * are color references.
 *
 * ### Why `color` is the one name resolver
 *
 * This module used to register four kinds of thing: one function per
 * identifier-safe palette variable (`{{ primary child }}`, `{{ accent child }}`,
 * …), a general `palette "spec" child`, a `paletteOver "spec" "#bg" child` for
 * specs needing a background, and an `auto "#bg" child` sugar. That surface had
 * two defects worth recording, because both are easy to reintroduce.
 *
 * **The name family could not cover its own domain.** A themed palette carries
 * ~150 variables; roughly 14 of them are legal Go-template identifiers. So the
 * generated functions reached under a tenth of the palette, and the other nine
 * tenths needed `palette "text-primary" child` — a *different expression shape*
 * for the same intent. An author who learned `{{ primary x }}` and reasonably
 * tried `{{ text_primary x }}` got a FuncNotFound. [LAW:composability] — the
 * `filterByStatus`/`filterByOwner` shape: names cannot enumerate a domain, and
 * the N+1 case always needs a form you have to learn separately.
 *
 * **Resolution and application were fused.** Every one of those functions
 * consumed its color instantly into a styled fragment, so a color could never
 * be held or passed. Composition therefore had to happen inside the spec
 * *string* — hence the old `name-darken-N alpha%` grammar. See
 * `color-funcs.ts` for the full argument; the short version is that a string
 * grammar is function application with the function calls spelled as
 * punctuation, and it grows a new production for every operation.
 *
 * What replaces all of it: `color "name-or-hex"` produces a color value, the
 * functions in `color-funcs.ts` transform colors, and `fg`/`bg` in
 * `style-funcs.ts` paint them. One shape, total over the palette, open to
 * arbitrary composition. [LAW:one-type-per-behavior]
 *
 * ### Why `ramp` lives here and not with the color math
 *
 * `ramp` is the one function whose input is a *number*, and its stops are
 * spelled as color references — `ramp .pct "step" 0 "panel" 50 "warning" 80
 * "error"` — resolved through the same `resolveColorRef` that `color` crosses.
 * Requiring `(color "panel")` around every stop would put the boilerplate
 * back that this binding exists to remove, and an author who writes a hex
 * literal loses nothing: the resolver is idempotent on hex. The arithmetic
 * itself is `ColorRamp` in `themes/ramp.ts`, palette-free; only the
 * reference resolution is here. [LAW:one-way-deps]
 *
 * ### Why a getter, not a palette
 *
 * `paletteFuncs` takes `() => Palette` rather than a `Palette`. A consumer
 * whose theme can change at runtime (a live preview, a theme picker, a
 * status-line that recolors on click) would otherwise be frozen to whichever
 * palette happened to be current when the engine was constructed — and since
 * templates are parsed once and evaluated many times, that freeze outlives
 * every subsequent theme change while the *rest* of the consumer's colors move
 * on. Two palettes, one render: [LAW:one-source-of-truth] violated by a
 * captured reference.
 *
 * The getter costs nothing structurally. `FuncMap` entries are data in the
 * engine and their bodies run at *evaluate* time, so reading the palette
 * through a getter leaves parse-once/evaluate-many completely intact. What the
 * getter must not change is *which functions exist* — and it cannot, because
 * the two names here do not depend on the palette's contents. That was not
 * true of the generated per-variable functions, which is the second reason
 * they are gone.
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import type { Palette } from "../themes/palette.js";
import { resolveColorRef } from "../themes/colorRef.js";
import { ColorRamp, parseRampEasing, type ColorStop } from "../themes/ramp.js";

/**
 * The `(position, color-ref)` pairs a `ramp` call's tail spells, as stops.
 *
 * The engine's `alternating` gate has already typed every even slot as a
 * float and every odd slot as a string; what it cannot see is the *pairing*
 * — a trailing position with no color — nor that the string is a color
 * reference. Both are settled here, once, and `ColorRamp` receives resolved
 * stops it never re-checks. [LAW:parse-dont-validate]
 *
 * Each reference resolves against the palette of *this* evaluation, so a
 * ramp over palette names follows the theme exactly as `color` does.
 */
function colorStops(tail: readonly unknown[], palette: Palette): ColorStop[] {
  if (tail.length === 0) {
    throw new RangeError(
      `ramp needs at least one stop after the easing: ramp <value> <easing> <position> <color> …`,
    );
  }
  if (tail.length % 2 !== 0) {
    throw new RangeError(
      `ramp's last stop (position ${String(tail[tail.length - 1])}) has no color — ` +
        `stops are <position> <color> pairs`,
    );
  }
  const stops: ColorStop[] = [];
  for (let i = 0; i < tail.length; i += 2) {
    stops.push({
      at: tail[i] as number,
      color: resolveColorRef(palette, tail[i + 1] as string),
    });
  }
  return stops;
}

/**
 * Register `color "name-or-hex"` against a live palette.
 *
 * `color` resolves a palette variable name to a `#RRGGBB` string, and passes
 * an already-literal color through unchanged. That second half is not a
 * convenience — it makes `color` **idempotent**, which is what lets consumers
 * apply it unconditionally to any author-written color string without first
 * asking whether it is a name or already a color. [LAW:dataflow-not-control-flow]
 *
 * An unknown name throws, carrying near-miss suggestions from the live
 * palette. In a template that surfaces as an evaluation error at the exact
 * call site, which is the signal an author (or an agent editing a config) needs
 * to fix it. [LAW:no-silent-failure]
 *
 * @example
 * ```ts
 * const engine = createEngine({
 *   fromString: (s) => new RichText(s),
 *   toString: (rt) => rt.plain,
 *   funcs: {
 *     ...richTextFuncs(),
 *     ...colorFuncs(),
 *     ...paletteFuncs(() => currentTheme.palette),
 *   },
 * });
 * ```
 */
export function paletteFuncs(getPalette: () => Palette): FuncMap {
  const colorFunc: TemplateFunc = {
    fn: ((ref: string) => resolveColorRef(getPalette(), ref).hex) as TemplateFunc["fn"],
    argTypes: ["string"],
    returnType: "string",
  };
  // `ramp <value> <easing> <position> <color> …` — the argument list is one
  // float/string cycle end to end (value, easing, then each stop's position
  // and color), so the engine's `alternating` gate types every slot; the
  // pairing and the references are parsed in `colorStops`.
  // [LAW:types-are-the-program]
  const rampFunc: TemplateFunc = {
    fn: ((value: number, easing: string, ...tail: unknown[]) => {
      const palette = getPalette();
      if (easing === undefined) {
        throw new RangeError(
          `ramp needs an easing after the value: ramp <value> "linear"|"step" <position> <color> …`,
        );
      }
      return new ColorRamp(parseRampEasing(easing), colorStops(tail, palette)).at(value).hex;
    }) as TemplateFunc["fn"],
    argTypes: ["float", "string"],
    argTypePattern: "alternating",
    returnType: "string",
  };
  return { color: colorFunc, ramp: rampFunc };
}
