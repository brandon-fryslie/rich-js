# Theme Transposition

Treat a color theme like a piece of music. A melody can be **transposed** to a different key — every note shifts by the same interval, so the tune is preserved but its tonal center moves. rich-js can do the same to a palette: rotate every color by a fixed amount in a perceptually-uniform space and you get the *same theme* in a different key. Transpose all 22 built-in themes and you have effectively unlimited themes that still feel coherent.

The machinery has three layers: the **OKLCH** color space (the substrate), the **`ThemeKey`** transform (the "key signature"), and **`transposePalette`** (applying a key to a whole palette). A musical helper, **`themeKeyForRoot`**, lets you pick a destination color instead of an interval.

## OKLCH — the perceptual substrate

Hue rotation only "feels even" if equal numerical steps look like equal perceptual steps. In HSL they don't — a 60° turn through green looks nothing like 60° through blue. [OKLCH](https://bottosson.github.io/posts/oklab/) (the polar form of OKLab) is built for exactly this: lightness `L ∈ [0,1]`, chroma `C ≥ 0`, hue `H ∈ [0,360)`, and equal deltas are perceptually even.

```typescript
import { Oklch, ColorRgba } from "@promptctl/rich-js";

const blue = Oklch.fromRgba(new ColorRgba(60, 90, 200));
blue.l; // ~0.51  lightness
blue.c; // ~0.16  chroma
blue.h; // ~265   hue degrees

// ...manipulate, then convert back to sRGB
const back = blue.toRgba(); // ColorRgba
```

`Oklch` is immutable. `toRgba()` is the normalization boundary: it clamps lightness into `[0,1]`, clamps chroma to `≥ 0`, and reduces chroma by bisection to land inside the sRGB gamut — so a vivid hue desaturates near black/white rather than producing an invalid color, and the hue is always preserved.

## ThemeKey — the key signature

A `ThemeKey` is the transform applied to each color. It is **data**, not code:

```typescript
interface ThemeKey {
  hueShift: number;        // degrees to rotate hue
  chromaScale: number;     // multiply chroma: 0 = grayscale, 1 = identity, >1 = more saturated
  lightnessScale: number;  // multiply lightness: 1 = identity, -1 = invert around the L axis
  lightnessShift: number;  // add to lightness, after the scale
}
```

Lightness is `L' = clamp01(L * lightnessScale + lightnessShift)`, which makes "invert" expressible without a boolean flag. Two keys ship built-in:

```typescript
import { IDENTITY, INVERT_LIGHTNESS, isIdentityKey } from "@promptctl/rich-js";

IDENTITY;          // { hueShift: 0, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 }
INVERT_LIGHTNESS;  // flips L→1-L; turns a dark theme into its light "octave"

isIdentityKey(IDENTITY);                       // true
isIdentityKey({ ...IDENTITY, hueShift: 360 }); // true — a whole turn is a no-op
```

Apply a key to a single color with `Oklch.applyKey`:

```typescript
const rotated = Oklch.fromRgba(someColor).applyKey({
  hueShift: 120, chromaScale: 1, lightnessScale: 1, lightnessShift: 0,
}).toRgba();
```

## transposePalette — a whole theme at once

`transposePalette(palette, key, name?)` returns a new `Palette` with every color transposed. It is pure, and `IDENTITY` is byte-exact (no lossy round-trip):

```typescript
import { getThemePalette, transposePalette } from "@promptctl/rich-js";

const gruvbox = getThemePalette("gruvbox")!;

// the same theme, rotated 120° around the hue wheel
const shifted = transposePalette(
  gruvbox,
  { hueShift: 120, chromaScale: 1, lightnessScale: 1, lightnessShift: 0 },
  "gruvbox +120°",
);

// a free light variant of a dark theme
const light = transposePalette(gruvbox, INVERT_LIGHTNESS, "gruvbox-light");
```

The resulting palette's `dark` flag is derived from the **actual lightness of the transposed background** (`background` var's OKLCH `L < 0.5`), not from the key — so it is honest under any transform. A palette with no `background` var throws on the transposing path (the identity fast-path is exempt, since it preserves the source flag verbatim).

## Semantic anchors — meaning that survives transposition

Rotating *every* hue would make a UI lie: an error message must look red, success green, warning amber, no matter the key. Those roles are **anchored** — their hue is held while lightness and chroma still transform (so they still invert correctly and respond to chroma scaling).

```typescript
import { isAnchored, ANCHORED_ROOTS } from "@promptctl/rich-js";

ANCHORED_ROOTS;                 // ReadonlySet { "error", "success", "warning" }
isAnchored("error");            // true
isAnchored("error-darken-1");   // true — variants of an anchored root anchor too
isAnchored("primary");          // false — decorative, free to rotate
```

The classification is by hyphen-prefix, so the whole `error-*` / `success-*` / `warning-*` family is covered by the three roots. This is what lets you spin the decorative palette through every key while the status colors stay meaningful.

## themeKeyForRoot — choose a destination, not an interval

Thinking in raw `hueShift` degrees is like transposing by counting semitones. Usually you'd rather say "play this in the key of teal." `themeKeyForRoot(palette, tonicVar, targetHueDeg)` builds the `ThemeKey` that lands a chosen **tonic** var on a target hue:

```typescript
import { getThemePalette, themeKeyForRoot, transposePalette } from "@promptctl/rich-js";

const gruvbox = getThemePalette("gruvbox")!;

// rotate so the theme's `primary` color sits at 200° (a teal), everything else
// following by the same interval; error/success/warning still hold
const key = themeKeyForRoot(gruvbox, "primary", 200);
const teal = transposePalette(gruvbox, key);
```

It returns a hue-only key (chroma and lightness untouched) — spread your own chroma/lightness over it if you want those axes too. A non-finite `targetHueDeg`, or a missing `tonicVar`, throws at the boundary with a clear message.

## The interactive explorer

The repo ships a terminal explorer for all of this. Run it from a checkout:

```bash
just oklsh
```

A full-height theme list runs down the left; the right pane shows a live preview recolored from the transposed palette. Controls (root-hue offset, chroma, lightness, minimum contrast) compose into a `ThemeKey`, and the **root-hue offset is relative to whatever theme is selected** — hold an offset and page through every theme to see each one transposed by the same interval. Press `v` to toggle between a dense single-page showcase (which exercises ~125 of a theme's ~150 vars) and a focused app-dashboard mock.
