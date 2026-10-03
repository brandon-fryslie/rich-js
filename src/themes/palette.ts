import type { ColorRgba } from "../core/color.js";

/**
 * A semantic palette: a named map from variable name → ColorRgba.
 *
 * Distinct from `ColorTable` (the integer-indexed quantization LUT used by
 * the downgrade pipeline). Palettes carry aesthetic intent — `primary`,
 * `accent`, `error`, etc. — and are the foundation of the theming system.
 *
 * Storage is uniformly ColorRgba; consumers that load from hex JSON
 * parse to ColorRgba at load time. `get` is a bare lookup — turning an
 * author-written *reference* (a name, or a `#RRGGBB` literal) into a colour
 * is `resolveColorRef`'s job in `colorRef.ts`, so a Palette never has to
 * know about the syntax callers write.
 *
 * Every colour a Palette hands out is opaque or fully transparent. A theme's translucent variable
 * (Textual's `boost`, a hover overlay) is a tint meant for that theme's own
 * background, and a colour leaving the palette no longer knows which
 * background that was: the SGR writer would composite it over the terminal's
 * black, which is not the theme's background, and draw a tint the theme never
 * meant.
 * So it is drawn onto `background` here, once, and the writer, the exporters
 * and the contrast choosers all read the colour it has there. On any other
 * surface it keeps that colour: the tint does not follow what is under it.
 * The exception is a fully transparent colour, Textual's "no background": it
 * draws nothing on any surface, so it needs none and is handed out as it is,
 * and a `Style` reads it as no background at all.
 *
 * @throws RangeError when `background` is translucent, or when a colour is
 * partly transparent and there is no `background` to draw it on.
 */
export class Palette {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: ReadonlyMap<string, ColorRgba>;

  constructor(
    name: string,
    dark: boolean,
    vars: ReadonlyMap<string, ColorRgba>,
  ) {
    this.name = name;
    this.dark = dark;
    // [LAW:single-enforcer] Every palette is built through here, so this is
    // where "a palette colour is opaque or draws nothing" holds. The fresh map is also the
    // defensive copy: ReadonlyMap is a compile-time aliasing constraint, not a
    // runtime one.
    const background = vars.get("background");
    const draw: (colour: ColorRgba, key: string) => ColorRgba =
      background === undefined ? opaqueOnly(name) : drawnOn(name, background);
    this.vars = new Map([...vars].map(([key, colour]) => [key, draw(colour, key)]));
  }

  get(key: string): ColorRgba | undefined {
    return this.vars.get(key);
  }
}

/**
 * A palette colour as it is drawn: composited onto the palette's own
 * `background`, which has nothing under it and so must itself be opaque.
 * [LAW:one-source-of-truth] The one statement of what a translucent palette
 * colour means; `buildPalette` draws its base colours through it before
 * deriving from them.
 */
export function drawnOn(name: string, background: ColorRgba): (colour: ColorRgba) => ColorRgba {
  if (background.alpha !== 1) {
    throw new RangeError(
      `palette ${JSON.stringify(name)}: background is the surface its translucent colours are drawn on, so it must be opaque; got ${background.hex}`,
    );
  }
  // A fully transparent colour is not a tint: it draws nothing on any surface.
  return (colour) => (colour.alpha === 0 ? colour : colour.compositeOver(background));
}

// A palette with no background has nothing to draw a translucent colour on.
function opaqueOnly(name: string): (colour: ColorRgba, key: string) => ColorRgba {
  return (colour, key) => {
    if (colour.alpha !== 1 && colour.alpha !== 0) {
      throw new RangeError(
        `palette ${JSON.stringify(name)}: ${key} is translucent (${colour.hex}) but the palette has no "background" to draw it on`,
      );
    }
    return colour;
  };
}
