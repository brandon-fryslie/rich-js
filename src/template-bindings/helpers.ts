/**
 * Shared internal helpers for the rich-js template binding layer.
 *
 * [LAW:one-source-of-truth] `applyStyleToFragment` is the single implementation
 * of "apply a Style to an existing RichText fragment." Both the style-function
 * registrations and the palette-function registrations use this same operation;
 * keeping one copy prevents the two from drifting.
 */

import { Style } from "../core/style.js";
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
      `style function expected a RichText fragment, got ${typeof child === "object" ? Object.prototype.toString.call(child) : typeof child}`,
    );
  }
  const result = child.copy();
  result.style = child.style.add(style);
  return result;
}
