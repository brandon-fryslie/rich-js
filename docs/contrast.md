# Contrast & Accessibility

When you place text on a colored background, it has to stay readable. rich-js exposes a small **WCAG contrast toolkit** for measuring and fixing contrast — useful any time you compute colors at runtime (themes, transposition, user-supplied palettes) and can't eyeball every combination.

All four functions operate on `ColorRgba` and are pure.

## Measuring contrast

`relativeLuminance(color)` is the WCAG relative luminance in `[0, 1]`. `contrastRatio(a, b)` is the WCAG contrast ratio in `[1, 21]` — symmetric, so argument order doesn't matter.

```typescript
import { relativeLuminance, contrastRatio, ColorRgba } from "@promptctl/rich-js";

const white = new ColorRgba(255, 255, 255);
const black = new ColorRgba(0, 0, 0);

console.print(`luminance of white: ${relativeLuminance(white)}`);
console.print(`[${black.hex} on ${white.hex}] black on white [/]  ${contrastRatio(black, white)}:1, the maximum`);
console.print(`[${white.hex} on ${white.hex}] white on white [/]  ${contrastRatio(white, white)}:1, the minimum`);
```

`4.5:1` is the WCAG AA threshold for normal text; `3:1` for large text. `contrastRatio` and `relativeLuminance` measure the colours they are given and assume **opaque** inputs — the displayed contrast of a translucent color depends on what it composites over, so flatten first (`c.compositeOver(new ColorRgba(0, 0, 0))` for a terminal cell, which draws translucency over black). The pickers, `contrastFor` and `ensureContrast`, flatten a translucent background themselves, so check their answer against the flattened background too.

## Picking a readable color from scratch

`contrastFor(bg)` returns pure black or white — whichever reads better on `bg` — using the perceptual luminance cutoff (`0.179`) where the two are equally legible. Use it when you have no color to preserve and just need *a* readable foreground.

```typescript
import { contrastFor, ColorRgba } from "@promptctl/rich-js";

for (const bg of [new ColorRgba(240, 240, 240), new ColorRgba(30, 30, 30)]) {
  const fg = contrastFor(bg); // black on the light grey, white on the dark one
  console.print(`[${fg.hex} on ${bg.hex}] text on ${bg.hex} [/]  contrastFor gives ${fg.hex}`);
}
```

## Making a themed color readable — `ensureContrast`

Flipping text to black/white is a cop-out: it throws away the theme. `ensureContrast(fg, bg, minRatio = 4.5)` instead keeps the foreground **recognizably itself** — it slides only the OKLCH *lightness* toward the contrast-raising pole (holding hue, and chroma where it stays in gamut) until the ratio is met. A blue link on a dark-blue panel becomes a *lighter blue*, not white.

```typescript
import { ensureContrast, contrastRatio, ColorRgba } from "@promptctl/rich-js";

const panel = new ColorRgba(20, 30, 70);   // dark blue
const link  = new ColorRgba(60, 90, 200);  // blue — too low contrast as-is

const readable = ensureContrast(link, panel);   // defaults to AA (4.5:1)

console.print(`[${link.hex} on ${panel.hex}] link, as chosen  [/]  ${contrastRatio(link, panel).toFixed(2)}:1`);
console.print(`[${readable.hex} on ${panel.hex}] link, readable   [/]  ${contrastRatio(readable, panel).toFixed(2)}:1`);
```

`readable` is still blue — same hue, lighter.

Key properties:

- **Already passing?** The (flattened) foreground is returned as-is, opaque. An opaque `fg` that already clears the ratio comes back unchanged.
- **Minimal change.** It bisects for the lightness *nearest the original* that clears the floor — the smallest perceptual adjustment that achieves accessibility, the way professional tone systems (Radix, Material) do it.
- **Translucent input is flattened.** A hand-written `#FFFFFF60` is composited over `bg` first (a palette's translucent colours are drawn on its own background already), so the guarantee reflects what the eye actually sees; the result is opaque.
- **Honest fallback.** Against a mid-toned background where *no* lightness of that hue can reach the target (e.g. asking for `7:1` over mid-grey, which tops out around `5.3:1`), it falls back to `contrastFor`'s pure black/white — the true maximum.

```typescript
// raise the bar to AAA (7:1)
const strong = ensureContrast(link, panel, 7);
console.print(`[${strong.hex} on ${panel.hex}] link, AAA  [/]  ${contrastRatio(strong, panel).toFixed(2)}:1`);
```

### Measured where it is drawn — `drawnAt`

`ensureContrast(fg, bg, minRatio, drawnAt = ColorDepth.TRUECOLOR)` takes a fourth argument: the depth the terminal will draw at. At truecolor the colours are drawn as computed. At 256 colours the terminal rounds text and background to its palette **independently**, and two roundings can meet in the middle — a pair that read at 4.5:1 can draw at 2:1. So at `ColorDepth.EIGHT_BIT` the answer is measured on the drawn pair: a colour that still clears the floor once rounded is returned unchanged, and one that does not is replaced by the nearest 256-colour entry (indices 16–255, never the terminal-defined ANSI 0–15) that clears it — or, when no entry can clear it on that background, by the entry with the most contrast, the same honest fallback as truecolor's black/white. At `STANDARD` the writer picks one of the sixteen ANSI indices and the terminal draws each in its own theme's colour, so the pair is measured in the colours of the terminal you name (see `terminal` below). A truecolor answer whose drawn pair clears the floor stands; one that does not is replaced by the colour the writer emits as the nearest index that clears it, or the one with the most contrast. Text on its background's own index measures 1:1, so it is always replaced.

```typescript
const drawn = ensureContrast(link, panel, 4.5, ColorDepth.EIGHT_BIT);
console.print(`[${drawn.hex} on ${panel.hex}] link, for 256 colours  [/]  ${drawn.hex} (truecolor gave ${readable.hex})`);
```

Here the truecolor answer still clears 4.5:1 once both colours are rounded to the 256-colour palette, so it comes back unchanged.

A translucent background is measured as drawn, composited over the surface beneath it: a fifth argument, `substrate`, defaulting to black, which is what the terminal writer composites over. A caller choosing text for another surface passes that surface; it must be opaque. `contrastFor(bg, substrate)` takes the same surface.

The sixth argument, `terminal`, is the `TerminalTheme` whose sixteen `ansiColors` the terminal draws at `STANDARD`. Themes disagree about more than hue: Rosé Pine Dawn's black is `#F2E9E1` and its white `#575279`, so the side of a background that text belongs on flips. With no `terminal` named, the pair is measured in the VGA colours `DEFAULT_TERMINAL_THEME` draws. `fg` and `bg` are still the colours you write — a cell styled `on black` is passed as nominal black, `#000000` — and the terminal's own shades are only what they are measured in.

```typescript
import { ColorDepth, ColorRgba, ROSE_PINE_DAWN, contrastRatio, drawnColour, ensureContrast } from "@promptctl/rich-js";

const navy = new ColorRgba(0, 0, 128);
const paper = new ColorRgba(255, 255, 255);
const shown = (c: ColorRgba) => drawnColour(c, ColorDepth.STANDARD, undefined, ROSE_PINE_DAWN);

for (const terminal of [undefined, ROSE_PINE_DAWN]) {
  const text = ensureContrast(navy, paper, 4.5, ColorDepth.STANDARD, undefined, terminal);
  const ratio = contrastRatio(shown(text), shown(paper)).toFixed(2);
  console.print(`[${shown(text).hex} on ${shown(paper).hex}] ${terminal ? "measured in Rosé Pine Dawn" : "measured in VGA"} [/]  drawn by Rosé Pine Dawn at ${ratio}:1`);
}
```

Both lines are drawn as a Rosé Pine Dawn terminal draws them. Measured in VGA, navy on white clears the floor and stands, and that terminal draws it teal on dusk; measured in the terminal's own colours it is replaced.

In templates, `readableOn` measures where `richTextFuncs(drawnAt)` / `colorFuncs(drawnAt)` say the text lands: `drawnAt` returns a `DrawnAt`, `{ depth, terminal? }`, and at `STANDARD` the pair is measured in that `terminal`'s sixteen colours, or the VGA colours when it names none — see [Template Bindings](/template-bindings).

### A floor that is not text — `ensureDrawn`

Some floors are not text on a background. Examples are a selected cell that must stand off every unselected one, or two nested panels that must not merge. `ensureDrawn(chosen, drawnAt, accept)` is the same repair with the floor stated by you. `accept(candidate, drawn)` is shown the candidate as drawn, plus `drawn`, the same rounding for any colour it compares against. When the chosen colour as drawn is accepted, it comes back composited over the substrate (black unless you pass another), so a translucent colour returns opaque. When it is refused, the colour the writer emits as the nearest accepted entry of the table the depth draws from comes back instead: the 256-colour cube and grey ramp, which draw as themselves, or at `STANDARD` the sixteen ANSI indices, shown to `accept` in the colours of `terminal` (a fifth argument after `substrate`) as `ensureContrast` measures them. Truecolor draws from no table, so a colour refused there has no replacement. The result is `undefined` when nothing is accepted.

`drawnColour(colour, drawnAt, substrate?, terminal?)` is that same rounding on its own, for a floor measured outside `accept`.

```typescript
import { ColorDepth, ColorRgba, drawnColour, ensureDrawn, Oklch, Panel } from "@promptctl/rich-js";

// A nested panel that must stay visibly apart from the one around it.
const outer = new ColorRgba(30, 42, 58);
const panelOk = ensureDrawn(panel, ColorDepth.EIGHT_BIT, (candidate, drawn) =>
  Oklch.fromRgba(candidate).deltaE(Oklch.fromRgba(drawn(outer))) >= 0.05,
);

if (panelOk !== undefined) {
  const inner = new Panel(`nested: ${panel.hex} → ${panelOk.hex}`, { style: `on ${panelOk.hex}`, expand: false });
  // Both panels drawn as a 256-colour terminal draws them.
  const outerDrawn = drawnColour(outer, ColorDepth.EIGHT_BIT);
  console.print(new Panel(inner, { title: `outer: ${outerDrawn.hex}`, style: `on ${outerDrawn.hex}`, expand: false }));
}
```

Rounded to the 256-colour palette, the dark blue lands too close to the outer panel's colour, so the nearest entry that stands apart from it comes back instead.

## Where the library holds the floor itself

A palette's `text-*` is its foreground for a `*-muted` ground, and every bundled theme holds that pair to 4.5:1, with `text-*` also reading at 4.5:1 on the palette's `background`. The palette `buildPalette` derives for each terminal theme and the authored palettes `getThemePalette` returns both pass their tinted text through the same rule: held to the floor on the muted colour, moving toward the palette's own text side. The variant Buttons and Toggles draw their labels in exactly this pair, in its full colours; at sixteen colours each colour becomes an ANSI slot the terminal paints in its own theme's colour, and the floor is a fact about the palette, not about those slots.

The built-in styles that paint their own ground — `syntax.line_number.highlight` and `markdown.code` — clear 4.5:1 on every bundled theme at full depth. At sixteen colours they cannot: their fixed colours become ANSI slots, and no pair of slots reads in every theme. So there `Syntax` and `Markdown` draw them without their colours, on the terminal's own foreground and background, as Rich does for a highlighted line number below 256 colours. Their attributes, bold for both, still set them apart. A style you give them in the terminal's own colours — `white on blue` as a theme entry, `bold magenta` as Markdown's `inlineCodeStyle` — was chosen for those slots and is drawn as written.

## How transposition uses it

The theme explorer routes **every** text cell through `ensureContrast` against its actual background, with a live "minimum contrast" control as the `minRatio`. That's why a transposed or lightness-shifted theme never renders dark-on-dark — readability is enforced at one boundary rather than hoped for per call. See [Theme Transposition](/transpose) for the full picture.
