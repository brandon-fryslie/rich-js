/**
 * rich-js template bindings — public entry point.
 *
 * [LAW:one-source-of-truth] This module is the public entry point for
 * rich-js's styling vocabulary as `@promptctl/go-template-js` template
 * functions. Two complementary registrations are exported:
 *
 * - `richTextFuncs()` — foreground colours, background, text attributes, and
 *   `link`. Does not require configuration; safe to register unconditionally.
 * - `paletteFuncs(resolver)` — semantic palette, auto-contrast, and extended
 *   spec forms. Requires a `PaletteResolver` argument bound to the active
 *   theme; consumers merge it alongside `richTextFuncs()`.
 *
 * `createRichTextEngine()` is convenience sugar that wires up `richTextFuncs()`
 * only — it does not include `paletteFuncs`, because palette functions require
 * a resolver the factory cannot supply. Consumers that need palette access
 * call `paletteFuncs(resolver)` and merge it into their own engine config.
 * Nesting is plain function composition (`{{ red (bold "x") }}`), not a
 * second markup grammar.
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
import { richTextStyleFuncs } from "./style-funcs.js";

export { paletteFuncs } from "./palette-funcs.js";

/**
 * Funcs registered by the rich-js binding — style functions (foreground,
 * background, attributes) and the `link` cell-splitter. Exposed as a factory
 * so future registrations that need configuration have a place to receive
 * arguments. Palette/theme/auto-contrast functions ship separately via
 * `paletteFuncs(resolver)` and are merged at consumer side — they require a
 * `PaletteResolver` argument and so cannot be included in this generic call.
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
  return richTextStyleFuncs();
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
