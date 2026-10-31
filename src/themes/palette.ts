import type { ColorRgba } from "../core/color.js";

export type AccentRole = "primary" | "secondary" | "accent" | "success" | "warning" | "error";
export type BaseRole = AccentRole | "background" | "foreground";
export type ShadedRole = BaseRole | "panel" | "boost" | "surface" | "primary-background" | "secondary-background";
type Shade = `-${"darken" | "lighten"}-${1 | 2 | 3}`;

/**
 * Every role every palette has. [LAW:one-source-of-truth] This type is the one
 * statement of the set: `buildPalette`'s rules are a total map over it, so a
 * role added here does not compile until it can be derived, and the runtime
 * list is read off those rules.
 */
export type PaletteRole =
  | ShadedRole
  | `${ShadedRole}${Shade}`
  | `${AccentRole}-muted`
  | `text-${AccentRole}`
  | `on-${AccentRole}`
  | "background-muted"
  | "foreground-muted"
  | "foreground-disabled"
  | "surface-active"
  | "text"
  | "text-muted"
  | "text-disabled"
  | "border"
  | "border-blurred"
  | "block-cursor-background"
  | "block-cursor-foreground"
  | "block-cursor-blurred-background"
  | "block-cursor-blurred-foreground"
  | "block-hover-background"
  | "button-foreground"
  | "button-color-foreground"
  | "footer-background"
  | "footer-foreground"
  | "footer-description-background"
  | "footer-description-foreground"
  | "footer-item-background"
  | "footer-key-background"
  | "footer-key-foreground"
  | "input-cursor-background"
  | "input-cursor-foreground"
  | "input-selection-background"
  | "link-background"
  | "link-background-hover"
  | "link-color"
  | "link-color-hover"
  | `markdown-h${1 | 2 | 3 | 4 | 5 | 6}-${"background" | "color"}`
  | "scrollbar"
  | "scrollbar-active"
  | "scrollbar-hover"
  | "scrollbar-background"
  | "scrollbar-background-active"
  | "scrollbar-background-hover"
  | "scrollbar-corner-color";

/** A colour for each role: what proves a palette complete. */
export type PaletteRoles = Readonly<Record<PaletteRole, ColorRgba>>;

/**
 * A semantic palette: a named map from role → ColorRgba, holding every
 * `PaletteRole`.
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
 * @throws RangeError when `background` is translucent.
 */
export class Palette {
  readonly name: string;
  readonly dark: boolean;
  readonly vars: ReadonlyMap<PaletteRole, ColorRgba>;

  constructor(name: string, dark: boolean, roles: PaletteRoles) {
    this.name = name;
    this.dark = dark;
    // [LAW:single-enforcer] Every palette is built through here, so this is
    // where "a palette colour is opaque or draws nothing" holds.
    const draw = drawnOn(name, roles.background);
    this.vars = new Map(
      (Object.entries(roles) as [PaletteRole, ColorRgba][]).map(([role, colour]) => [role, draw(colour)]),
    );
  }

  get(role: PaletteRole): ColorRgba;
  get(role: string): ColorRgba | undefined;
  get(role: string): ColorRgba | undefined {
    return this.vars.get(role as PaletteRole);
  }

  /** This palette's roles, each put through `colour`: what a new palette is built from. */
  mapRoles(colour: (colour: ColorRgba, role: PaletteRole) => ColorRgba): PaletteRoles {
    return Object.fromEntries([...this.vars].map(([role, was]) => [role, colour(was, role)])) as PaletteRoles;
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
