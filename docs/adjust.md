---
exampleContext: |
  const someColor = new ColorRgba(214, 93, 14);
  const surface = new ColorRgba(40, 44, 52);
  const primary = new ColorRgba(97, 175, 239);
---

# Theme Adjustment

Treat a color theme like a piece of music. A melody can be **adjusted** to a different key — every note shifts by the same interval, so the tune is preserved but its tonal center moves. rich-js can do the same to a palette: rotate every color by a fixed amount in a perceptually-uniform space and you get the *same theme* in a different key. Adjust the built-in themes and you have effectively unlimited themes that still feel coherent.

The machinery has three layers: the **OKLCH** color space (the substrate), the **`ColorAdjustment`** transform (the "key signature"), and **`adjustPalette`** (applying a key to a whole palette). A musical helper, **`adjustmentForRoot`**, lets you pick a destination color instead of an interval.

## OKLCH — the perceptual substrate

Hue rotation only "feels even" if equal numerical steps look like equal perceptual steps. In HSL they don't — a 60° turn through green looks nothing like 60° through blue. [OKLCH](https://bottosson.github.io/posts/oklab/) (the polar form of OKLab) is built for exactly this: lightness `L ∈ [0,1]`, chroma `C ≥ 0`, hue `H ∈ [0,360)`, and equal deltas are perceptually even.

```typescript
import { Oklch, ColorRgba } from "@promptctl/rich-js";

const blue = Oklch.fromRgba(new ColorRgba(60, 90, 200));
const { l, c, h } = blue; // lightness, chroma, hue in degrees
console.print(`lightness ${l.toFixed(2)}  chroma ${c.toFixed(2)}  hue ${h.toFixed(0)}°`);

// ...manipulate, then convert back to sRGB
const back = blue.toRgba(); // ColorRgba
console.print(`[on ${back.hex}]        [/] ${back.hex}`);
```

`Oklch` is immutable. `toRgba()` is the normalization boundary: it clamps lightness into `[0,1]`, clamps chroma to `≥ 0`, and reduces chroma by bisection to land inside the sRGB gamut — so a vivid hue desaturates near black/white rather than producing an invalid color, with hue preserved wherever the color is chromatic. (At zero chroma, or at the lightness extremes where everything collapses to black/white, hue is moot and pinned to 0.)

## ColorAdjustment — the key signature

A `ColorAdjustment` is the transform applied to each color. It is **data**, not code:

```typescript shape
interface ColorAdjustment {
  hueShift: number;        // degrees to rotate hue
  chromaScale: number;     // multiply chroma: 0 = grayscale, 1 = identity, >1 = more saturated
  lightnessScale: number;  // multiply lightness: 1 = identity (negative values flip the axis)
  lightnessShift: number;  // add to lightness, after the scale
}
```

Lightness is `L' = clamp01(L * lightnessScale + lightnessShift)`, which makes "invert" expressible without a boolean flag — note that inversion needs *both* axes: `lightnessScale: -1` with `lightnessShift: 1` gives `L' = 1 - L` (a `-1` scale alone would clamp everything to black). Two keys ship built-in:

```typescript
import { IDENTITY, INVERT_LIGHTNESS, isIdentityKey } from "@promptctl/rich-js";

console.print(IDENTITY);
console.print(INVERT_LIGHTNESS); // flips L→1-L; turns a dark theme into its light "octave"

console.print(isIdentityKey(IDENTITY));
console.print(isIdentityKey({ ...IDENTITY, hueShift: 360 })); // a whole turn is a no-op
```

Apply a key to a single color with `Oklch.applyKey`:

```typescript
const rotated = Oklch.fromRgba(someColor).applyKey({
  hueShift: 120, chromaScale: 1, lightnessScale: 1, lightnessShift: 0,
}).toRgba();

console.print(`[on ${someColor.hex}]      [/] ${someColor.hex}  →  [on ${rotated.hex}]      [/] ${rotated.hex}`);
```

## Mixing two colors

`a.mix(b, t)` is the color `t` of the way from `a` toward `b` in OKLCH: every axis moves by the same `t`, hue along the shorter arc, and a grey endpoint adopts the other's hue instead of rotating from 0°.

When the axes should move by different amounts, `mixAxes` takes one weight per axis, each in [0, 1] and all four required:

```ts
// Most of the hue's color, little of its lightness, the hue's own angle,
// the surface's opacity: a tint that stays near the surface it decorates.
const tint = Oklch.fromRgba(surface)
  .mixAxes(Oklch.fromRgba(primary), { l: 0.2, c: 0.8, h: 1, alpha: 0 })
  .toRgba();

console.print(`[on ${surface.hex}]      [/] surface  [on ${tint.hex}]      [/] tint  [on ${primary.hex}]      [/] primary`);
```

`mix(b, t)` is `mixAxes(b, { l: t, c: t, h: t, alpha: t })`. A weak `h` beside a strong `c` keeps the starting color's hue at high chroma. Only a truly achromatic start adopts the target's hue, so to land on the target's hue from a near-grey, pass `h: 1`.

`a.deltaE(b)` is the perceptual distance between two colors, ΔE_OK: Euclidean distance in OKLab. Around 0.02 is the smallest difference the eye resolves.

## Stepping lightness in HSL — `darken`, `lighten`, `rgbToHsl`, `hslToRgb`

`darken(c, n)` lowers a color's HSL lightness by `0.1` per level, clamped to black, and `lighten(c, n)` is `darken(c, -n)`. They work in HSL, not OKLCH, and `rgbToHsl` and `hslToRgb` are that conversion. An `Hsl` holds `h` in degrees and `s` and `l` in [0, 1]. `rgbToHsl` returns a hue in [0, 360) and drops alpha. `hslToRgb` returns an opaque color. A hue is an angle, so `hslToRgb` takes any finite `h` mod 360. An `s` or `l` outside [0, 1], or a hue that is not finite, throws a `RangeError`.

```ts
import { rgbToHsl, hslToRgb, ColorRgba } from "@promptctl/rich-js";

const base = new ColorRgba(200, 50, 50);
const hsl = rgbToHsl(base);
for (const turn of [0, 120, 240]) {
  const c = hslToRgb({ ...hsl, h: hsl.h + turn });
  console.print(`[on ${c.hex}]      [/] ${c.hex}  h=${Math.round((hsl.h + turn) % 360)}`);
}
```

## Every palette has every role

A palette holds the same roles whichever way it was made: a bundled theme from `getThemePalette`, the palette of a terminal theme, a `buildPalette` of your own, or an adjustment of any of them. `PaletteRole` is the type naming them, and `get` on one is a color, never `undefined`. Any other string, a misspelt role or one only known at run time, reads `ColorRgba | undefined`, so the compiler refuses it where a color is required.

`buildPalette` needs the eight base colors and derives the rest with Textual's formulas. Any other role you state keeps its color, and what is derived from it follows. A stated `text-*` is the exception: it is moved as far as it must go to read on its `*-muted`.

```ts silent
import { buildPalette, parseRgbHex } from "@promptctl/rich-js";

const palette = buildPalette("indigo-night", true, {
  primary: parseRgbHex("4f46e5"),
  secondary: parseRgbHex("0ea5e9"),
  accent: parseRgbHex("eab308"),
  success: parseRgbHex("16a34a"),
  warning: parseRgbHex("d97706"),
  error: parseRgbHex("dc2626"),
  background: parseRgbHex("0f172a"),
  foreground: parseRgbHex("e2e8f0"),
  panel: parseRgbHex("1e293b"),
});

palette.get("footer-background"); // the stated panel
palette.get("surface-lighten-2"); // derived
```

`new Palette(name, dark, roles)` takes a color for every role, so a palette with one missing does not compile; `palette.mapRoles` makes such a record from an existing palette.

## adjustPalette — a whole theme at once

`adjustPalette(palette, key, name?)` returns a new `Palette` with every color adjusted. It is pure, and `IDENTITY` is byte-exact (no lossy round-trip):

```typescript
import { getThemePalette, adjustPalette } from "@promptctl/rich-js";

const gruvbox = getThemePalette("gruvbox")!;

// the same theme, rotated 120° around the hue wheel
const shifted = adjustPalette(
  gruvbox,
  { hueShift: 120, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 },
  "gruvbox +120°",
);

// a free light variant of a dark theme
const light = adjustPalette(gruvbox, INVERT_LIGHTNESS, "gruvbox-light");

const roles = ["background", "surface", "primary", "secondary", "accent", "error", "success", "warning"];
for (const palette of [gruvbox, shifted, light]) {
  const swatches = roles.map((role) => `[on ${palette.get(role)!.hex}]   [/]`).join("");
  console.print(`${swatches}  ${palette.name}  dark: ${palette.dark}`);
}
```

The resulting palette's `dark` flag is derived from the **actual lightness of the adjusted background** (`background` var's OKLCH `L < 0.5`), not from the key — so it is honest under any transform.

## Semantic anchors — meaning that survives adjustment

Rotating *every* hue would make a UI lie: an error message must look red, success green, warning amber, no matter the key. Those roles are **hue-locked** — their hue is fixed while lightness and chroma still transform (so they still invert correctly and respond to chroma scaling). The family goes with them: `error-muted`, and the `text-error` drawn on it.

```typescript
import { isHueLocked, HUE_LOCKED_ROOTS } from "@promptctl/rich-js";

console.print(HUE_LOCKED_ROOTS);                // a ReadonlySet
console.print(isHueLocked("error"));
console.print(isHueLocked("error-darken-1")); // variants of a hue-locked root lock too
console.print(isHueLocked("text-error"));     // so does what is drawn on one
console.print(isHueLocked("primary"));        // decorative, free to rotate
```

This is what lets you spin the decorative palette through every key while the status colors stay meaningful.

## adjustmentForRoot — choose a destination, not an interval

Thinking in raw `hueShift` degrees is like adjusting by counting semitones. Usually you'd rather say "play this in the key of teal." `adjustmentForRoot(palette, tonicVar, targetHueDeg)` builds the `ColorAdjustment` that lands a chosen **tonic** var on a target hue:

```typescript
import { getThemePalette, adjustmentForRoot, adjustPalette } from "@promptctl/rich-js";

const gruvbox = getThemePalette("gruvbox")!;

// rotate so the theme's `primary` color sits at 200° (a teal), everything else
// following by the same interval; error/success/warning still hold
const key = adjustmentForRoot(gruvbox, "primary", 200);
const teal = adjustPalette(gruvbox, key, "gruvbox in teal");

console.print(key);
for (const palette of [gruvbox, teal]) {
  const swatches = roles.map((role) => `[on ${palette.get(role)!.hex}]   [/]`).join("");
  console.print(`${swatches}  ${palette.name}`);
}
```

It returns a hue-only key (chroma and lightness untouched) — spread your own chroma/lightness over it if you want those axes too. A non-finite `targetHueDeg`, or a missing `tonicVar`, throws at the boundary with a clear message.

## The interactive explorer

The repo ships a terminal explorer for all of this. Run it from a checkout:

```bash
just oklsh
```

A full-height theme list runs down the left; the right pane shows a live preview recolored from the adjusted palette. Controls (root-hue offset, chroma, lightness, minimum contrast) compose into a `ColorAdjustment`, and the **root-hue offset is relative to whatever theme is selected** — hold an offset and page through every theme to see each one adjusted by the same interval. Press `v` to toggle between a dense single-page showcase (which exercises ~125 of a theme's ~150 vars) and a focused app-dashboard mock.
