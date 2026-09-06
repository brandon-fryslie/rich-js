/**
 * Color *values* for the rich-js template binding.
 *
 * ### Why colors are values
 *
 * Every other function in this binding layer takes a child fragment and
 * returns a styled fragment. These do not: they take colors and return a
 * color. That is the whole point. Before this module existed, a color could
 * not survive between two operations — every color function resolved and
 * applied in one breath — so composing two color operations had to be spelled
 * as a *string grammar* (`"primary-darken-3 50%"`), a second language
 * reimplementing function application inside a string literal. Every new color
 * operation meant a new grammar production. [LAW:no-mode-explosion]
 *
 * With colors as values the surface is one shape that grows by nesting:
 *
 * ```
 * {{ fg (color "primary") .branch }}
 * {{ fg (darken (color "primary") 2) .branch }}
 * {{ fg (mix (color "foreground") (color "surface") 65) .label }}
 * ```
 *
 * The simple case is a literal prefix of the composed case — an author adding
 * a `darken` to working code wraps it, rather than rewriting it into an
 * unfamiliar form. [LAW:composability]
 *
 * ### The carrier is a hex string, deliberately
 *
 * A color crosses the template seam as `#RRGGBB`, not as an opaque object,
 * for three reasons:
 *
 * 1. **The type separates.** `"string"` is the strictest arg slot the template
 *    engine has — it *refuses* typed `T`. So a color slot cannot silently
 *    accept a text fragment. An opaque object would land in `"T"`/`"liftable"`,
 *    both of which admit any non-primitive, and `{{ bold (color "primary") }}`
 *    would type-check its way into nonsense. [LAW:types-are-the-program]
 * 2. **It flows through the language.** `{{ $muted := mix … }}` holds it,
 *    `printf` prints it, `eq` compares it — no engine changes required. Naming
 *    a color once and using it ten times is the ergonomic payoff.
 * 3. **Misuse is visible.** A color that lands in text position renders as
 *    `#7aa2f7` — wrong in a way an author immediately sees, never a silently
 *    dropped style. [LAW:no-silent-failure]
 *
 * No precision is given up: `darken`, `blendRgb`, and `contrastFor` already
 * take and return 8-bit `ColorRgba`. The one caveat is OKLCH: each of the
 * axis functions below round-trips sRGB→OKLCH→sRGB, so chaining three or more
 * of them quantizes visibly. Compose two, or reach for `transposePalette` when
 * a whole palette needs adapting — the same caveat that already applies to
 * chained transpositions.
 *
 * ### Palette-free on purpose
 *
 * Nothing here knows what a palette is. `color` and `ramp` (the two
 * palette-dependent functions, in `palette-funcs.ts`) turn names into hex;
 * from that point on the math is pure. A consumer with no theme system at all still gets
 * the full color vocabulary by feeding it hex literals. [LAW:one-way-deps]
 */

import type { FuncMap, TemplateFunc } from "@promptctl/go-template-js";
import { blendRgb, type ColorRgba } from "../core/color.js";
import { Oklch, IDENTITY } from "../core/oklch.js";
import type { ThemeKey } from "../core/oklch.js";
import { HEX_COLOR_RE, parseHexColor } from "../themes/colorRef.js";
import { darken, contrastFor, ensureContrast } from "../themes/colorMath.js";

/**
 * The gate every color argument crosses. [LAW:parse-dont-validate] — the
 * function bodies below receive `ColorRgba` and never re-check.
 *
 * Parsing itself is `parseHexColor`'s job; this wrapper exists only to replace
 * its error *wording*, because the mistake it catches is almost always the
 * same one — a palette name passed where a color belongs (`darken "primary" 2`)
 * — and an author who reads "wrap it: darken (color "primary")" is corrected in
 * one step, where "expected #RRGGBB" leaves them guessing.
 * [LAW:no-silent-failure]
 */
function asColor(value: string, func: string): ColorRgba {
  if (!HEX_COLOR_RE.test(value.trim())) {
    throw new TypeError(
      `${func} expected a color (#RRGGBB or #RRGGBBAA), got ${JSON.stringify(value)}` +
        ` — to use a palette name here, wrap it: ${func} (color ${JSON.stringify(value)}) …`,
    );
  }
  return parseHexColor(value);
}

function colorFunc(argTypes: TemplateFunc["argTypes"], fn: TemplateFunc["fn"]): TemplateFunc {
  return { fn, argTypes, returnType: "string" };
}

/**
 * The gate every *numeric* argument crosses, with an optional inclusive range.
 *
 * [LAW:single-enforcer] One check for the whole family. The template engine
 * treats a trailing slot as variadic, so an under-supplied call
 * (`{{ darken "#102030" }}`) reaches the body with `undefined` rather than
 * failing at the gate. Without this, that `undefined` propagated into the color
 * math and surfaced as `ColorRgba.red must be an integer in [0, 255]; got NaN`
 * — loud, but pointing at a channel the author never wrote, three layers from
 * the missing argument. An error that does not locate its cause is barely
 * better than a silent one. [LAW:no-silent-failure]
 */
function asAmount(
  value: number,
  func: string,
  param: string,
  range?: { min: number; max: number; note: string },
): number {
  const inRange =
    range === undefined || (value >= range.min && value <= range.max);
  if (!Number.isFinite(value) || !inRange) {
    const bound =
      range === undefined
        ? "a finite number"
        : `within ${range.min}..${range.max} (${range.note})`;
    throw new RangeError(
      `${func}'s ${param} must be ${bound}, got ${value}` +
        (value === undefined ? ` — ${func} takes it as its last argument` : ""),
    );
  }
  return value;
}

// --- HSL lightness ---
//
// `lighten` is `darken` with the sign flipped — the same operation, not a
// second one (colorMath's `lighten` is literally `darken(c, -levels)`). Both
// names ship because "lighten by 2" and "darken by -2" are not equally
// readable at a call site, and the operation is genuinely bidirectional.

const darkenFunc = colorFunc(["string", "int"], ((hex: string, levels: number) =>
  darken(asColor(hex, "darken"), asAmount(levels, "darken", "levels")).hex) as TemplateFunc["fn"]);

const lightenFunc = colorFunc(["string", "int"], ((hex: string, levels: number) =>
  darken(asColor(hex, "lighten"), -asAmount(levels, "lighten", "levels")).hex) as TemplateFunc["fn"]);

// --- Blending ---
//
// [LAW:one-type-per-behavior] There is no separate `alphaBlend` binding.
// `alphaBlend(fg, bg, a)` in colorMath is *defined* as `blendRgb(bg, fg, a)` —
// one operation wearing two names. Compositing a translucent color over a
// background and mixing two colors by a percentage are the same arithmetic,
// so they get one function. Terminals have no alpha channel, which is also why
// no function here *produces* a translucent color: it could not be rendered,
// and a color that silently does nothing in the sink is worse than no
// function at all.

const MIX_PCT_MAX = 100;
const MIX_RANGE = { min: 0, max: MIX_PCT_MAX, note: "0 = from, 100 = toward" };

const mixFunc = colorFunc(["string", "string", "float"], ((
  fromHex: string,
  towardHex: string,
  pct: number,
) =>
  blendRgb(
    asColor(fromHex, "mix"),
    asColor(towardHex, "mix"),
    asAmount(pct, "mix", "percentage", MIX_RANGE) / MIX_PCT_MAX,
  ).hex) as TemplateFunc["fn"]);

// --- Readability ---
//
// Two different questions, so two functions rather than one with a flag:
// `contrastOn` asks "what is maximally readable here" (black or white, WCAG
// relative-luminance cutoff); `readableOn` asks "keep this color recognizably
// itself, but guarantee it clears `ratio`" — it slides OKLCH lightness and
// preserves hue, so a blue on dark blue becomes a lighter blue rather than
// white.
//
// [LAW:no-silent-failure] `ratio` is required, not defaulted to WCAG AA's 4.5.
// The threshold is the whole decision this function makes, and the right value
// genuinely differs by intent — 4.5 for body text, 3.0 for large or
// deliberately recessive text. A hidden default would silently govern an
// accessibility outcome the author never saw, and would quietly over-correct a
// caller whose *point* was to be quiet: de-emphasized text floored at 4.5 is no
// longer de-emphasized.

// WCAG 2.x contrast ratios live in [1, 21] — 1 is a color on itself.
const RATIO_RANGE = {
  min: 1,
  max: 21,
  note: "4.5 = AA body text, 3 = AA large text",
};

const contrastOnFunc = colorFunc(["string"], ((bgHex: string) =>
  contrastFor(asColor(bgHex, "contrastOn")).hex) as TemplateFunc["fn"]);

const readableOnFunc = colorFunc(["string", "string", "float"], ((
  fgHex: string,
  bgHex: string,
  ratio: number,
) =>
  ensureContrast(
    asColor(fgHex, "readableOn"),
    asColor(bgHex, "readableOn"),
    asAmount(ratio, "readableOn", "ratio", RATIO_RANGE),
  ).hex) as TemplateFunc["fn"]);

// --- OKLCH axes ---
//
// [LAW:one-source-of-truth] One function per `ThemeKey` axis, and the table is
// keyed BY the axis so the compiler proves it total: add a field to `ThemeKey`
// and this object stops satisfying `Record<keyof ThemeKey, string>` until a
// binding name is chosen for it. The same derive-registrations-from-the-real-
// inventory trick `attributeFuncs()` uses over `ATTRIBUTE_NAMES`.
//
// Naming follows the axis semantics rather than the field spelling: `shift`
// for the additive axes, `scale` for the multiplicative ones, so a reader can
// tell from the call site whether `1` means "no change" or "one unit".
const OKLCH_AXIS_FUNCS = {
  hueShift: "shiftHue",
  chromaScale: "scaleChroma",
  lightnessScale: "scaleLightness",
  lightnessShift: "shiftLightness",
} satisfies Record<keyof ThemeKey, string>;

function oklchAxisFuncs(): FuncMap {
  const out: FuncMap = {};
  for (const [axis, funcName] of Object.entries(OKLCH_AXIS_FUNCS)) {
    // [LAW:dataflow-not-control-flow] Every axis takes the identical path —
    // splice one value into the identity key and apply it. The axis is data.
    const key = axis as keyof ThemeKey;
    out[funcName] = colorFunc(["string", "float"], ((hex: string, amount: number) => {
      const themeKey: ThemeKey = {
        ...IDENTITY,
        [key]: asAmount(amount, funcName, "amount"),
      };
      return Oklch.fromRgba(asColor(hex, funcName)).applyKey(themeKey).toRgba().hex;
    }) as TemplateFunc["fn"]);
  }
  return out;
}

/**
 * The palette-free color vocabulary: every function takes colors and returns a
 * color, so they compose by nesting.
 *
 * | function | meaning |
 * |---|---|
 * | `darken c n` / `lighten c n` | slide HSL lightness by N 10% levels |
 * | `mix a b pct` | blend `a` toward `b` by `pct`% (0 → `a`, 100 → `b`) |
 * | `contrastOn bg` | black or white, whichever is readable on `bg` |
 * | `readableOn fg bg ratio` | `fg` nudged in OKLCH lightness until it clears `ratio` on `bg`, hue preserved |
 * | `shiftHue c deg` | rotate hue in OKLCH |
 * | `scaleChroma c f` | multiply chroma (0 → gray, 1 → identity) |
 * | `scaleLightness c f` | multiply lightness (1 → identity, -1 → invert) |
 * | `shiftLightness c d` | add to lightness, after any scale |
 *
 * Pair with `paletteFuncs()` to name colors from a theme, and with
 * `richTextStyleFuncs()`'s `fg`/`bg` to paint them onto text.
 */
export function colorFuncs(): FuncMap {
  return {
    darken: darkenFunc,
    lighten: lightenFunc,
    mix: mixFunc,
    contrastOn: contrastOnFunc,
    readableOn: readableOnFunc,
    ...oklchAxisFuncs(),
  };
}
