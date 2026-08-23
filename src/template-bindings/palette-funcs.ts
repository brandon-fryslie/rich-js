/**
 * The one palette-dependent template function: `color`.
 *
 * ### Why exactly one
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
 * there is now exactly one, whose name does not depend on the palette's
 * contents. That was not true of the generated per-variable functions, which
 * is the second reason they are gone.
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import type { Palette } from "../themes/palette.js";
import { resolveColorRef } from "../themes/colorRef.js";

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
  return { color: colorFunc };
}
