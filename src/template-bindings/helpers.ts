/**
 * Shared internal helpers for the rich-js template binding layer.
 *
 * [LAW:one-source-of-truth] `applyStyleToFragment` is the single implementation
 * of "apply a Style to an existing RichText fragment." Both the style-function
 * registrations and the palette-function registrations use this same operation;
 * keeping one copy prevents the two from drifting.
 */

import { Style, StyleSyntaxError } from "../core/style.js";
import { RichText } from "../core/text.js";

/**
 * Apply a style on top of an already-styled RichText fragment.
 *
 * [LAW:single-enforcer] Type validation lives here; callers trust the result.
 * The `"liftable"` arg type lifts string literals to `RichText` via the
 * engine's `fromString` before the body runs, so `child` is always a
 * `RichText` by the time this runs. The instanceof check exists because
 * `"liftable"` admits any non-primitive — the engine cannot prove the object
 * is the binding's own `T`. Misuse (`{{ red someMap }}`) fails loudly here
 * rather than producing a malformed fragment.
 *
 * Conflict resolution: `Style.add` — the outer (newly applied) style wins.
 */
export function applyStyleToFragment(child: unknown, style: Style): RichText {
  if (!(child instanceof RichText)) {
    throw new TypeError(
      `template function expected a RichText fragment, got ${typeof child === "object" ? Object.prototype.toString.call(child) : typeof child}`,
    );
  }
  const result = child.copy();
  result.style = baseStyleOf(child.style).add(style);
  return result;
}

/**
 * A fragment's base style as a `Style`. A string is parsed as a definition; a
 * name fails, because it resolves only against the theme of the render that
 * draws it, and a template runs before any render exists.
 */
function baseStyleOf(style: string | Style): Style {
  if (style instanceof Style) return style;
  try {
    return Style.parse(style);
  } catch (err) {
    if (!(err instanceof StyleSyntaxError)) throw err;
    throw new TypeError(
      `template function cannot style a fragment whose base style is the name "${style}": a style name resolves only against the theme of a render`,
    );
  }
}
