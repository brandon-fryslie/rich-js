/**
 * rich-js template bindings — public entry point.
 *
 * [LAW:one-source-of-truth] This module is the public entry point for
 * rich-js's styling vocabulary as `@promptctl/go-template-js` template
 * functions. The split between the two exported registrations is exactly the
 * split between what needs a theme and what does not:
 *
 * - `richTextFuncs()` — the colour sinks (`fg`/`bg`), the palette-free colour
 *   math (`darken`, `mix`, `contrastOn`, the OKLCH axes …), text attributes,
 *   and `link`. Needs no configuration; safe to register unconditionally. A
 *   consumer with no theme system still gets the complete colour vocabulary by
 *   feeding it hex literals.
 * - `paletteFuncs(getPalette)` — `color` and `ramp`, the two functions that
 *   resolve a palette name. This is the *only* registration that knows a
 *   palette exists, which is why it is the only one that takes an argument.
 *   [LAW:one-way-deps]
 *
 * `createRichTextEngine()` wires up `richTextFuncs()` only — it cannot supply a
 * palette. Consumers that name theme colours call `paletteFuncs(getPalette)`
 * and merge it into their own engine config.
 *
 * Colours compose by nesting, like every other function:
 * `{{ fg (darken (color "primary") 2) (bold "x") }}`. There is no second
 * markup grammar and no colour-spec mini-language — the template *is* the
 * composition mechanism.
 *
 * Fragment type: `RichText`. Chosen because it is the library's primary
 * text type (implements `Renderable` + `Measurable`), composes via
 * `append`, and flows directly into the existing render pipeline with no
 * adapter. Top-level template expressions emit as `RichText[]` — natural
 * for cases where a single template produces multiple independently
 * addressable fragments (e.g. multiple top-level `link` calls, each
 * carrying its own URL).
 */

import { createEngine, type Engine, type FuncMap } from "@promptctl/go-template-js";
import { RichText } from "../core/text.js";
import { Style } from "../core/style.js";
import { Segment } from "../core/segment.js";
import { richTextStyleFuncs } from "./style-funcs.js";
import { colorFuncs } from "./color-funcs.js";

export { paletteFuncs } from "./palette-funcs.js";
export { colorFuncs } from "./color-funcs.js";

/**
 * Funcs registered by the rich-js binding — the colour sinks, the palette-free
 * colour math, text attributes, and the `link` cell-splitter. Everything here
 * is configuration-free by construction; the one function that needs a theme
 * (`color`) ships separately via `paletteFuncs(getPalette)` and is merged
 * consumer-side.
 *
 * `FuncMap` is not parameterised over `T` in `@promptctl/go-template-js` — the engine's
 * `T` lives on the `Engine`/`EngineConfig`, and per-function input/output
 * types are carried as runtime `argTypes` on each `TemplateFunc`. The map
 * therefore *type-checks* against any `EngineConfig<T>.funcs`, but the
 * functions returned here are only *runtime-compatible* with
 * `Engine<RichText>`: each style function returns a `RichText` and
 * requires its lifted child to be a `RichText` (enforced by an
 * `instanceof` check that throws on misuse). Consumers merging this map
 * into a wider engine must keep `T = RichText`; merging into an engine
 * whose `T` is something else will compile but fail at evaluation time.
 */
export function richTextFuncs(): FuncMap {
  return { ...richTextStyleFuncs(), ...colorFuncs() };
}

/**
 * Construct an `Engine<RichText>` with the rich-js style-function set
 * registered. Consumers that already manage their own engine should call
 * `richTextFuncs()` and merge the result into their own `createEngine`
 * configuration; consumers that just want rich-js styling can use this
 * factory directly.
 *
 * `fromString` lifts text literals into `RichText`. `toString` flattens a
 * `RichText` to its plain text — the engine's no-silent-flatten guard uses
 * this only for `printf "%s"` / `"%q"` and `print*` slots, where ANSI is
 * not desired anyway.
 */
export function createRichTextEngine(): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: richTextFuncs(),
  });
}

/**
 * Compile a template source against `engine` and render the result to a
 * flat `Segment[]`. The 90%-case convenience over chaining `engine.compile`,
 * `RichText.fromFragments`, and `.render` by hand:
 *
 * - Runs `engine.compile(source)(scope)` to get the engine's `RichText[]`.
 * - Flattens that fragment list into a single styled `RichText` via
 *   `RichText.fromFragments` so every fragment's wrapping style survives.
 * - Renders to a `Segment[]` at the requested `maxWidth`.
 * - Wraps the whole flow in a try/catch — on parse/evaluate failure,
 *   emits a single dim styled `[error: <message>]` segment the caller can
 *   drop into their layout. No bespoke fallback wiring required at every
 *   call site.
 *
 * [LAW:single-enforcer] One place owns "render a template to segments,
 * degrade gracefully on errors" — every consumer that wants this exact
 * shape reads from here rather than re-implementing the same try/catch +
 * error-formatting glue.
 *
 * For the 10% — custom error UX, intermediate access to the `RichText`,
 * pre-compiled templates re-used many times — call the engine directly
 * and use `RichText.fromFragments` to flatten. This helper is sugar for
 * the live-render case (e.g. a preview pane), not a replacement for the
 * compile-once-evaluate-many pattern.
 *
 * @param maxWidth defaults to 400 — large enough that downstream `splitLines`
 * / `adjustLineLength` clipping decides actual width, matching the typical
 * "render wide, fit on output" pipeline.
 * @param errorStyle is a `Style.parse` spec (default `"red dim"`).
 */
export function renderTemplate(
  engine: Engine<RichText>,
  source: string,
  scope: unknown = {},
  options?: { maxWidth?: number; errorStyle?: string },
): Segment[] {
  try {
    const frags = engine.compile(source)(scope);
    const rt = RichText.fromFragments(frags);
    return Array.from(rt.render({
      maxWidth: options?.maxWidth ?? 400,
      isTerminal: true,
      encoding: "utf-8",
    }));
  } catch (e) {
    return [new Segment(`[error: ${String(e).slice(0, 80)}]`, safeErrorStyle(options?.errorStyle))];
  }
}

// [LAW:single-enforcer] The error-path Style must not itself throw, or
// the whole "degrade gracefully" promise of renderTemplate is broken. A
// bogus user-supplied `errorStyle` spec falls back to a hard-coded safe
// Style — never propagates the parse failure to the caller.
const FALLBACK_ERROR_STYLE = new Style({ color: "red", dim: true });
function safeErrorStyle(spec: string | undefined): Style {
  if (spec === undefined) return FALLBACK_ERROR_STYLE;
  try {
    return Style.parse(spec);
  } catch {
    return FALLBACK_ERROR_STYLE;
  }
}
