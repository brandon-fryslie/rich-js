/**
 * rich-js template bindings — public entry point.
 *
 * [LAW:one-source-of-truth] This module is the single place where rich-js's
 * styling vocabulary is exposed as `@promptctl/go-template-js` template
 * functions. The current registration set covers foreground colour
 * (named, palette index, hex, RGB), background (`on`), and text
 * attributes (canonical names, short aliases, `not_*` negations) — all
 * registered via `richTextStyleFuncs`. `link`, palette / theme /
 * auto-contrast helpers, and per-position hue rotation ship in follow-up
 * epics on the same `template-bindings` topic and merge into this same
 * map. Consumers compose templates against the Engine returned here;
 * nesting is plain function composition (`{{ red (bold "x") }}`), not a
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

/**
 * Funcs registered by the rich-js binding. Style functions
 * (foreground / attribute / background) are populated by
 * `richTextStyleFuncs`; subsequent epics on the `template-bindings`
 * topic merge `link`, palette/theme/auto-contrast, and per-position
 * hue rotation into the same map. Exposed as a factory (not a const)
 * so future registrations that need configuration (e.g. a palette
 * resolver bound at construction time) have a place to receive
 * arguments without breaking the public shape.
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
