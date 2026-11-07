# Text on a Ground

A theme's colors come in two kinds, and Textual, whose themes rich-js bundles, keeps them apart. An accent such as `primary`, `secondary` or `error` is a fill or a border. Text is drawn in a text color: `foreground` and its muted and disabled forms, an accent's own `text-primary`, or Textual's `text`, which is not a color at all but a rule — a slightly translucent black or white, whichever reads on the ground the text sits on.

`textOn(palette, intent, ground)` is the color a theme's text draws in on any ground. Text that reads there is drawn exactly as the theme names it; text that does not is handed to a **fit**, which decides what it becomes.

```typescript
import { getThemePalette, textOn } from "@promptctl/rich-js";

const palette = getThemePalette("dracula");
for (const role of ["primary", "secondary", "accent", "error"] as const) {
  const fill = palette.get(role);
  const muted = palette.get(`${role}-muted`);
  const label = textOn(palette, "text", fill);
  const tinted = textOn(palette, `text-${role}`, muted);
  console.print(`[${label.hex} on ${fill.hex}] ${role.padEnd(9)} [/] [${tinted.hex} on ${muted.hex}] ${role} on its muted [/]`);
}
```

## Intents

| intent | what it is | floor |
|---|---|---|
| `foreground` | the theme's text color | 4.5:1 |
| `foreground-muted` | the theme's de-emphasized text | 3:1 |
| `foreground-disabled` | the theme's disabled text | none |
| `text` | black or white at 87%, whichever reads on the ground | 4.5:1 |
| `text-muted` | the same at 60% | 3:1 |
| `text-disabled` | the same at 38% | none |
| `text-primary`, `text-secondary`, `text-accent`, `text-success`, `text-warning`, `text-error` | the accent's own text color | 4.5:1 |

A bare accent is not an intent, so text in `primary` cannot be asked for. The floors are WCAG's: AA for body text, AA-large for text meant to recede, and none for disabled text, which must look unavailable.

Every palette holds its fixed text colors where Textual promises they read: each `text-*` on `background`, `surface`, `panel` and its own `*-muted`, and `foreground-muted` on the first three. On those grounds `textOn` returns the theme's color untouched. Everywhere else — a ladder rung, another accent's muted form, a color you computed — it measures.

## Fits

A fit is what text becomes on a ground it does not read on. Three ship:

- `TEXT_FITS.slide` (the default) moves the color's lightness until it clears the floor, keeping its hue: a red stays a red, lighter or darker.
- `TEXT_FITS.named` takes the first color the theme itself names for the intent that clears the floor — the role's text, then its ladder, nearest rungs first — or the one standing furthest off the ground where none does. The text is always one of the theme's own colors, at the cost of the floor on a ground none of them reads on.
- `TEXT_FITS.tinted` runs Textual's own `text-*` recipe on this ground: the ground's black or white, tinted with the accent at the largest share, up to Textual's 66%, that clears the floor.

A fit is any function from a `TextRequest` — the candidate that missed, the ground, the floor, where it is drawn, the color it is tinted toward, and the shades the theme names for it — to a color. Here are the three, and one written in place, on the shades of Dracula's `primary` with an error's text:

```typescript
import { contrastFor, getThemePalette, textOn, TEXT_FITS, type TextFit } from "@promptctl/rich-js";

const palette = getThemePalette("dracula");
const pole: TextFit = ({ ground }) => contrastFor(ground);
const shades = ["primary-darken-3", "primary-darken-1", "primary", "primary-lighten-1", "primary-lighten-3", "primary-muted"] as const;

for (const [name, fit] of [...Object.entries(TEXT_FITS), ["yours", pole] as const]) {
  const cells = shades.map((role) => {
    const ground = palette.get(role);
    return `[${textOn(palette, "text-error", ground, { fit }).hex} on ${ground.hex}] error [/]`;
  });
  console.print(`${name.padEnd(7)}${cells.join("")}`);
}
```

The [Themes & Color Studio](/demos/themes-and-color-studio) draws every bundled theme this way, across every shade of its three decorative roles.

## Where the text is drawn

A floor is measured on the pair the terminal draws. Below truecolor a pair is written as two colors of the table the terminal shows, so `textOn` takes the same `drawnAt` that [`ensureContrast`](/contrast) does — the depth and the terminal, the VGA sixteen where none is named — and returns the color the terminal shows for the text's slot. The ground is the slot that stands for it, never the terminal's default and never a hue a grey ground lacks; text is never its ground's color, and is held to its floor among the table's colors through the fit, or is the most legible one where none reads. Muted text recedes: a slot that stands off its ground less than its body text and is neither that text's color nor the default — at sixteen colors the terminal's stated `mutedSlot` first. Every slot is the one the writer's own downgrade rounds to — RGB distance with a cost for hue the color lacks, so a dark grey ground is black, never maroon or navy — so a caller that rounds `textOn`'s color itself lands on the same slot. Widgets write these same slots, and the template `textOn` returns the color each shows. A widget's muted text with no slot to recede in is drawn as its body text with SGR dim; that attribute is the widget path's alone, and `textOn` returns the body text's color there.

```typescript
import { ColorDepth, getThemePalette, textOn } from "@promptctl/rich-js";

const palette = getThemePalette("nord");
const ground = palette.get("secondary-lighten-2");
const drawnAt = { depth: ColorDepth.EIGHT_BIT };
const text = textOn(palette, "text-error", ground, { drawnAt });
console.print(`text-error at 256 colors is shown as ${text.hex}`);
```

## In a template

`paletteFuncs` registers `textOn "intent" ground`. Which fit it uses and where its text is drawn are the consumer's, passed as getters beside the palette's, so a setting that changes at runtime reaches every template without rebuilding the engine:

```typescript
import { createEngine } from "@promptctl/go-template-js";
import { Console, RichText, NORD, TEXT_FITS } from "@promptctl/rich-js";
import { richTextFuncs, paletteFuncs } from "@promptctl/rich-js/template-bindings";

const console = new Console();
let fit: keyof typeof TEXT_FITS = "tinted";

const engine = createEngine<RichText>({
  fromString: (s) => new RichText(s),
  isT: (v) => v instanceof RichText,
  toString: (rt) => rt.plain,
  funcs: { ...richTextFuncs(), ...paletteFuncs(() => NORD.palette, { fit: () => TEXT_FITS[fit] }) },
});

const source = `{{- $cell := color "secondary-lighten-2" -}}
{{ " ✖ build failed " | fg (textOn "text-error" $cell) | bg $cell }}`;

console.print(RichText.fromFragments(engine.compile(source)({})));
fit = "named";
console.print(RichText.fromFragments(engine.compile(source)({})));
```

The [widgets](/widgets) draw through the same call: a flat Button is its accent's `text-*` on the accent's muted form, and a hovered one is `text` on the full accent.
