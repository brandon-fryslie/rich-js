# Contrast & Accessibility

When you place text on a colored background, it has to stay readable. rich-js exposes a small **WCAG contrast toolkit** for measuring and fixing contrast — useful any time you compute colors at runtime (themes, transposition, user-supplied palettes) and can't eyeball every combination.

All four functions operate on `ColorRgba` and are pure.

## Measuring contrast

`relativeLuminance(color)` is the WCAG relative luminance in `[0, 1]`. `contrastRatio(a, b)` is the WCAG contrast ratio in `[1, 21]` — symmetric, so argument order doesn't matter.

```typescript
import { relativeLuminance, contrastRatio, ColorRgba } from "@promptctl/rich-js";

const white = new ColorRgba(255, 255, 255);
const black = new ColorRgba(0, 0, 0);

relativeLuminance(white);        // 1
contrastRatio(black, white);     // ~21  (the maximum)
contrastRatio(white, white);     // 1    (the minimum)
```

`4.5:1` is the WCAG AA threshold for normal text; `3:1` for large text. `contrastRatio` and `relativeLuminance` measure the colours they are given and assume **opaque** inputs — the displayed contrast of a translucent color depends on what it composites over, so flatten first (`c.compositeOver(new ColorRgba(0, 0, 0))` for a terminal cell, which draws translucency over black). The pickers, `contrastFor` and `ensureContrast`, flatten a translucent background themselves, so check their answer against the flattened background too.

## Picking a readable color from scratch

`contrastFor(bg)` returns pure black or white — whichever reads better on `bg` — using the perceptual luminance cutoff (`0.179`) where the two are equally legible. Use it when you have no color to preserve and just need *a* readable foreground.

```typescript
import { contrastFor, ColorRgba } from "@promptctl/rich-js";

contrastFor(new ColorRgba(240, 240, 240)); // black  → ColorRgba(0,0,0)
contrastFor(new ColorRgba(30, 30, 30));    // white  → ColorRgba(255,255,255)
```

## Making a themed color readable — `ensureContrast`

Flipping text to black/white is a cop-out: it throws away the theme. `ensureContrast(fg, bg, minRatio = 4.5)` instead keeps the foreground **recognizably itself** — it slides only the OKLCH *lightness* toward the contrast-raising pole (holding hue, and chroma where it stays in gamut) until the ratio is met. A blue link on a dark-blue panel becomes a *lighter blue*, not white.

```typescript
import { ensureContrast, contrastRatio, ColorRgba } from "@promptctl/rich-js";

const panel = new ColorRgba(20, 30, 70);   // dark blue
const link  = new ColorRgba(60, 90, 200);  // blue — too low contrast as-is

const readable = ensureContrast(link, panel);   // defaults to AA (4.5:1)
contrastRatio(readable, panel);                 // >= 4.5
// `readable` is still blue — same hue, lighter.
```

Key properties:

- **Already passing?** The (flattened) foreground is returned as-is, opaque. An opaque `fg` that already clears the ratio comes back unchanged.
- **Minimal change.** It bisects for the lightness *nearest the original* that clears the floor — the smallest perceptual adjustment that achieves accessibility, the way professional tone systems (Radix, Material) do it.
- **Translucent input is flattened.** A `#FFFFFF60` text-disabled color is composited over `bg` first, so the guarantee reflects what the eye actually sees; the result is opaque.
- **Honest fallback.** Against a mid-toned background where *no* lightness of that hue can reach the target (e.g. asking for `7:1` over mid-grey, which tops out around `5.3:1`), it falls back to `contrastFor`'s pure black/white — the true maximum.

```typescript
// raise the bar to AAA (7:1)
const strong = ensureContrast(link, panel, 7);
```

### Measured where it is drawn — `drawnAt`

`ensureContrast(fg, bg, minRatio, drawnAt = ColorDepth.TRUECOLOR)` takes a fourth argument: the depth the terminal will draw at. At truecolor the colours are drawn as computed. At 256 colours the terminal rounds text and background to its palette **independently**, and two roundings can meet in the middle — a pair that read at 4.5:1 can draw at 2:1. So at `ColorDepth.EIGHT_BIT` the answer is measured on the drawn pair: a colour that still clears the floor once rounded is returned unchanged, and one that does not is replaced by the nearest 256-colour entry (indices 16–255, never the terminal-defined ANSI 0–15) that clears it — or, when no entry can clear it on that background, by the entry with the most contrast, the same honest fallback as truecolor's black/white. At `STANDARD` the terminal chooses its own colours, so no ratio exists and the truecolor answer stands.

```typescript
const drawn = ensureContrast(link, panel, 4.5, ColorDepth.EIGHT_BIT);
```

A translucent background is measured as drawn, composited over the surface beneath it: a fifth argument, `substrate`, defaulting to black, which is what the terminal writer composites over. A caller choosing text for another surface (an export flattens over its canvas, `exportCanvas(theme).background`) passes that surface; it must be opaque. `contrastFor(bg, substrate)` takes the same surface.

In templates, `readableOn` measures at the depth `richTextFuncs(drawnAt)` / `colorFuncs(drawnAt)` were given — see [Template Bindings](/template-bindings).

## How transposition uses it

The theme explorer routes **every** text cell through `ensureContrast` against its actual background, with a live "minimum contrast" control as the `minRatio`. That's why a transposed or lightness-shifted theme never renders dark-on-dark — readability is enforced at one boundary rather than hoped for per call. See [Theme Transposition](/transpose) for the full picture.
