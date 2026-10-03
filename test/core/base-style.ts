import { Style } from "../../src/core/style.js";
import type { RichText } from "../../src/core/text.js";

/**
 * A RichText's base style narrowed to a `Style`, failing on one a render has
 * yet to resolve.
 * `String.prototype`'s legacy HTML wrappers (`bold`, `link`, …) let
 * `rt.style.bold` type-check against the name arm of `TextStyle` and
 * compare a function to `true`; an attribute read through here cannot.
 */
export function baseStyleOf(rt: RichText): Style {
  if (rt.style instanceof Style) return rt.style;
  throw new Error(`expected a base Style, got ${JSON.stringify(rt.style)}, resolved only at render`);
}
