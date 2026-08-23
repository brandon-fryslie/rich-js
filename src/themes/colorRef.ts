import { ColorRgba, parseRgbHex, parseRgbaHex } from "../core/color.js";
import type { Palette } from "./palette.js";

/**
 * A **color reference** is the one string form an author uses to name a
 * concrete color: a palette variable name (`"primary"`, `"surface-active"`,
 * `"text-primary"`) or a literal `#RRGGBB` / `#RRGGBBAA`.
 *
 * [LAW:parse-dont-validate] `resolveColorRef` is the single checkpoint that
 * turns an untrusted reference string into a `ColorRgba`. Everything
 * downstream — color math, `Style` construction, serialization — takes
 * `ColorRgba` and therefore cannot ask again whether the name existed. There
 * is no `isValidColorRef` companion, deliberately: a validator would hand back
 * the same `string` it was given and every consumer would re-check.
 *
 * [LAW:no-silent-failure] A miss throws. An unknown palette name is a broken
 * config, and the author needs to see which name and what was available — not
 * a silently substituted default that makes the bar merely look wrong.
 */
export class ColorRefError extends Error {
  constructor(
    readonly ref: string,
    detail: string,
  ) {
    super(`color reference ${JSON.stringify(ref)} did not resolve — ${detail}`);
    this.name = "ColorRefError";
  }
}

// A reference *shaped* like hex is resolved as hex; anything else is a palette
// name. This is a lexical distinction with no overlap — palette variable names
// never begin with `#` — so it is a parse, not a mode. A `#`-leading string
// that is malformed hex fails loudly here rather than falling through to a
// palette lookup that would report a confusing "unknown name" instead of
// "malformed hex".
const HEX_LEAD = "#";

/**
 * The literal-color shape, exported so the template bindings gate on the same
 * pattern this module parses. [LAW:one-source-of-truth] — one regex, one
 * parser body; the bindings add only their own error wording.
 */
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

const OPAQUE_HEX_LENGTH = 7; // "#RRGGBB"

/**
 * Parse a `#RRGGBB` / `#RRGGBBAA` literal. The hex arm of
 * {@link resolveColorRef}, separated so callers that accept *only* literal
 * colors (color math, which cannot meaningfully operate on a palette name)
 * share the one implementation instead of re-deriving it.
 *
 * @throws {ColorRefError} when `hex` is not a well-formed literal.
 */
export function parseHexColor(hex: string): ColorRgba {
  const trimmed = hex.trim();
  if (!HEX_COLOR_RE.test(trimmed)) {
    throw new ColorRefError(hex, "expected #RRGGBB or #RRGGBBAA");
  }
  // Both parsers take the digits without the leading `#`.
  const digits = trimmed.slice(1);
  return trimmed.length > OPAQUE_HEX_LENGTH
    ? parseRgbaHex(digits)
    : parseRgbHex(digits);
}

// Cap the "did you mean" list. Palettes carry ~150 variables; dumping all of
// them buries the message. Nearby names are what a mistyped reference needs.
const SUGGESTION_LIMIT = 8;

/**
 * Resolve a color reference against `palette`.
 *
 * Accepting hex alongside names is what makes this **idempotent**:
 * `resolveColorRef(p, resolveColorRef(p, r).hex)` equals
 * `resolveColorRef(p, r)` for every `r` this function accepts. Callers
 * therefore never branch on "is this a palette name or already a color" —
 * they call it unconditionally on whatever the author wrote, whether that is
 * `"surface-active"` or the output of a chain of color math.
 * [LAW:dataflow-not-control-flow]
 *
 * @throws {ColorRefError} on malformed hex or an unknown palette name.
 */
export function resolveColorRef(palette: Palette, ref: string): ColorRgba {
  const trimmed = ref.trim();

  if (trimmed.startsWith(HEX_LEAD)) return parseHexColor(trimmed);

  const hit = palette.get(trimmed);
  if (hit === undefined) {
    throw new ColorRefError(
      ref,
      `no such variable in palette ${JSON.stringify(palette.name)}` +
        suggest(palette, trimmed),
    );
  }
  return hit;
}

// Names sharing a prefix or suffix with the miss — enough to catch the two
// mistakes that actually happen (a wrong qualifier, `surface-active` vs
// `surface-lighten`; a wrong root, `text-primary` vs `primary-text`) without
// printing the whole palette.
function suggest(palette: Palette, miss: string): string {
  const parts = miss.split("-");
  const near = [...palette.vars.keys()]
    .filter((name) => parts.some((part) => part !== "" && name.includes(part)))
    .slice(0, SUGGESTION_LIMIT);
  return near.length === 0 ? "" : `; did you mean: ${near.join(", ")}`;
}
