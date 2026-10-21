# Effects

An effect changes how a renderable's cells look over time: a highlight sweeping through text, a pulse that brightens and dims, a fade, a word that blinks. It is an [animation](/animation): given what the whole element draws in a frame, it returns an `Animation` whose value at a time `t` in seconds is a function from each cell's look and where the cell is to the cell's new look. A look is the cell's colours as the screen shows them, `fg` and `bg`, and its text attributes, `attributes` — bold, dim, italic, underline and the rest, each on, off or unset as the cell's style has it:

```typescript shape
import type { Animation, CellLook, Drawn, EffectCell } from "@promptctl/rich-js";

type EffectFrame = (look: CellLook, cell: EffectCell) => CellLook;
type Effect = (drawn: Drawn) => Animation<EffectFrame>;
```

`Effected` makes the animation and asks it for the frame at `t` once a frame, then calls that frame once for each cell, so whatever holds for the whole frame, such as where a band of light stands at `t`, is worked out once rather than once a cell. The animation's `nextChange` is when the frame next changes, and since the animation is made from what the element draws, a loop that holds every cell still on a sixteen-colour terminal can say its frame never changes there. A loop that moves every frame is `Animation.continuous`:

```typescript
import { Animation, CATPPUCCIN_MOCHA, ColorRgba, Effected, RichText, type Effect } from "@promptctl/rich-js";

// The ink brightens toward white across one second, then starts again.
const brighten: Effect = () =>
  Animation.continuous((t) => (look) => {
    const w = t % 1;
    const toward = (c: number): number => Math.round(c + (255 - c) * w);
    return { ...look, fg: new ColorRgba(toward(look.fg.red), toward(look.fg.green), toward(look.fg.blue)) };
  });

for (const t of [0, 0.5, 0.9]) {
  console.print(new Effected(new RichText("brightening", { style: "#5f87d7" }), brighten, { key: "brighten", theme: CATPPUCCIN_MOCHA }).at(t));
}
```

## Ready-made effects

The library ships six, and one [signal](#a-signal-steps). Four loop for as long as they are drawn, and two run once:

| Effect | What it looks like |
| --- | --- |
| `shimmer` | sunlight moving across water: a soft band of light crosses the element, glittering where ripples cross |
| `pulse` | a slow glow on an element, warming into the light and settling back, the way an indicator breathes |
| `sparkle` | fireflies: short glowing strokes, each a few cells long, flashing and gone |
| `wheel` | the colour of daylight going round: every hue turns once a period, far too slowly to see moving |
| `fadeIn` | ink blooming in water: patches of the element surface first and the rest follows |
| `dissolveOut` | mist lifting: the element thins in drifting patches until nothing is left |

Each takes a `Curve`: `seconds` (a loop's period, or a transition's duration), an `ease`, and a `swing`, how far the move goes at full strength. `EFFECT_CURVES` holds the curves each effect was tuned to by eye, at 30 frames a second and at one. They are slow on purpose. At one frame a second, no cell's colour moves more than a barely noticeable step from one frame to the next, so the motion reads as drift rather than as ticks.

`EFFECT_CATALOGUE` makes each of them by its name in `EFFECT_CURVES`, all the same way, with the curve and the light it was tuned with. `EFFECT_CATALOGUE.loops` holds the four loops, each made into an `Effect`, and `EFFECT_CATALOGUE.transitions` holds `fade` and `dissolve`, each made into a `Transition`. Every entry takes the element it is for, as an `EffectTarget`: its `z`, which places it in the noise the effect is drawn from, so two elements given different values do not move in lockstep. How wide the element is, an effect reads off what it draws in each frame, so a shimmer crosses a padded, wrapped or confined element where it shows. An entry also takes an optional curve to use in place of the tuned one. To offer a choice of effects, list `Object.keys(EFFECT_CATALOGUE.loops)`; `LoopName` is the type of that choice. An effect added to the library then appears in the list without any change to your code.

Here is a status line under a shimmer, drawn at three moments:

```typescript
import { CATPPUCCIN_MOCHA, ColorSpec, EFFECT_CATALOGUE, Effected, RichText, Style } from "@promptctl/rich-js";

const theme = CATPPUCCIN_MOCHA;
const ink = theme.foregroundColor;
const words = "Thinking about how light should cross these words";
const line = new RichText(words, { style: Style.fromColor(ColorSpec.fromRgba(ink), ColorSpec.fromRgba(theme.backgroundColor)) });

const lit = EFFECT_CATALOGUE.loops.shimmer({ z: 0 });

for (const t of [0, 60, 100]) {
  console.print(new Effected(line, lit, { key: "status", theme }).at(t));
}
```

Every effect runs on its own clock from `t = 0`: draw it at the time since it began.

### A loop lights the element's own colours

`shimmer`, `pulse` and `sparkle` return a `Loop`: what the light does to one colour, and how strongly it acts on each cell at each moment. `onColors` turns a loop into an `Effect` on the colours the element sets itself, each at its own share of the light, and that is how the catalogue makes them. The terminal's own colours are left alone, even where one has the hex of a colour the element sets. Call the functions yourself to light with another colour than the catalogue's (`EFFECT_LIGHTS`); a `shimmer` made that way also takes how many columns its light reaches either side of its centre, which the catalogue's entry chooses for you. Or call them to light only some of the element's colours, passed by hex as a second argument: `onColors(loop, new Set([fill.hex]))`.

The shares keep the words readable. `Effected` measures every ink and ground pair the element draws its words in, and hands that measurement to the effect as `drawn`. Each colour gets the largest share at which every pair it appears in still reads at its resting contrast, or at WCAG AA (4.5:1) if it rested above that, in the colours the output's depth writes it in. Below truecolor that is the colour `Effected` writes for the cell's glyph or ground slot, so the promise holds at 256 colours as it does in truecolor. At 16 colours a loop holds still, as [What an effect cannot change](#what-an-effect-cannot-change) says, so it takes no contrast away. A colour with contrast to spare glows brightly; one with none barely moves. Settling the shares is costly, so make the effect once and draw it in every frame: a frame that draws the colours an earlier frame drew reuses that frame's shares.

`wheel` turns hue rather than lighting a colour, so it takes no shares; it keeps the same promise another way. Each colour turns at its own relative luminance, and WCAG contrast is a ratio of luminances, so a turn costs a pair no contrast; its chroma is kept where the gamut has it. Writing the turned colour rounds it, to 8 bits in truecolor and to a colour the depth has an index for at 256, and the rounding is held to the light's floor: a colour is written as whichever looks nearest its turn of the colour it rested at and those whose luminance keeps every pair of words it is drawn in at its resting contrast, or at AA if it rested above that. A colour drawn between a lighter colour and a darker one, with less than about 3% of contrast to spare between them, has no room for that rounding at every hue, so it holds still rather than snap between its turn and its rest. It reads which colours are the element's, and which of them are fills, from the same measurement.

### What a frame knows

`drawn` is the same for every cell of a frame.

- `cells()` lists every cell the element shows something in, a glyph, a ground other than the terminal's or a line its style draws, each with its `row`, `col` and `anchor`, listed before any cell is handed. A blank cell on the terminal's ground that draws no line is still handed to the effect, but not listed. Under `confined` it is only the cells the owners drew. A transition uses it to spread its order over the cells that can be seen to move.

The rest describes the cells the element draws words in: those whose glyph is not blank and that a strip's joiner did not draw, since a powerline seam's ink is the fill beside it, not words.

- `pairs` is every distinct ink and ground of those cells as the screen shows them, each with the `terminal` flags a cell carries and `reverse`, whether its style writes the ink in the ground's slot.
- `colors` is the colours the element sets itself in those cells, by hex. `fills` is those of them that are a cell's ground.
- `depth` and `theme` are what the frame is written at and drawn on.

`drawnOf(segments, depth, theme)` takes the same measurement of any rendered output. Measure an element under an effect to read the contrast its words are left at.

### One element of many

`confined(effect, ...owners)` applies `effect` only to the colours any of `owners` drew, and leaves every other colour exactly as it was. It goes by who drew each cell, not by its colour, so it can single out one of several items that share a fill. An owner is whatever stamps the cells it draws (`Segment.anchorLines`): every widget, every `Viewport`, and every item of a `Strip` or `FlexStrip`, however the strip wraps. Confined to anything that draws without stamping, such as the `Strip` itself, an effect moves nothing. A seam cell can show two items at once — a powerline arrow is inked in the fill it points out of, over the fill it points into — so its ink moves with one item and its ground with the other:

```typescript
import { CATPPUCCIN_MOCHA, EFFECT_CURVES, EFFECT_LIGHTS, Effected, JOINERS, RichText, Strip, Style, confined, onColors, pulse } from "@promptctl/rich-js";

const fill = Style.parse("#1e1e2e on #89b4fa");
const items = ["main", "ctx 61%", "ok"].map((label) => new RichText(` ${label} `, { style: fill, end: "", noWrap: true }));
const strip = new Strip(items, JOINERS.powerline);

// Only "ctx 61%" and the arrow after it breathe; the other two items keep their fill.
const breathing = confined(onColors(pulse(EFFECT_CURVES.pulse, EFFECT_LIGHTS.sun, 0)), items[1]!);

for (const t of [0, 10, 20]) {
  console.print(new Effected(strip, breathing, { key: "status", theme: CATPPUCCIN_MOCHA }).at(t));
}
```

A colour mixed from the two neighbours, such as the middle of a `prism` or a `gradientSeam` ramp, belongs to neither item, and `confined` leaves it alone.

To move every item but one, name all the others in one call: `confined(onColors(shimmer(…)), items[0]!, items[2]!)` moves the colours either of them drew. One confined effect per item does not add up to that. `confined` nested in `confined` moves only the colours both owners drew, none for two separate items, and an `Effected` wrapped around another measures the inner one's output, so `onColors` settles different shares. The effect is handed only the cells one of its owners drew, so it costs one call a cell however many owners it has.

### A transition says when it is done

`fadeIn` and `dissolveOut` return a `Transition`: the `effect` to draw, its `schedule` — an [animation](/animation) of when its frame next changes, whatever the element draws — and `done(t)`, read off that schedule: true from the moment it never changes again, when every cell has arrived or gone, its curve's `seconds` after it began. The order is spread over the cells the element shows something in, so on any element, and under `confined` on one item of many, the first cell starts at 0 and the last settles at `seconds`. A cell's start is settled in the first frame that lists it, so make one transition for each element: if an element gains cells as it moves, only the new ones are spread over the order it has then, and a cell that has gone never comes back. A caller stops drawing an element that has dissolved, or drops the effect from one that has faded in, when `done` says so:

```typescript
import { EFFECT_CATALOGUE } from "@promptctl/rich-js";

const leaving = EFFECT_CATALOGUE.transitions.dissolve({ z: 0 });
console.print([10, 29.9, 30].map((t) => `${t}s: ${leaving.done(t) ? "gone" : "leaving"}`).join(" · "));
```

Both blend toward the background of the `theme` given to `Effected`, the terminal the frame is drawn on: the library never asks the terminal what that is.

A transition's frame [changes](/frames#when-the-frame-next-changes) every frame until it is done and never after: the [animation](/animation) its effect returns answers `nextChange` with `t` before `done` and `Infinity` from it, so a host drawing the element can stop waking for it without asking `done` itself.

The bytes can stop changing a little before `done`. Near its end, an ease that flattens out, such as the default `ease-in-out`, moves a cell by less than one step of a colour channel, so nothing new is written. In truecolor that is within about a second on an element of several cells. An element of one cell takes the whole duration over its change, so its flat tail is longer. Below truecolor a colour is written as the nearest one the depth has, and the last change lands when the curve passes halfway between the last two of them. That depends on the colours, and at 256 colours a fade can finish visibly several seconds early. `done` is when the curve ends, not when the bytes stop.

### A signal steps

The loops are ambience, and nothing in them jumps. `steppedInk` is a signal, and jumps on purpose: every cell's ink steps through a sequence of colours on a beat, one colour a hold, looping, for the time it is handed, the way a gauge at its limit shows bright changing colours. Each step is a `ColorStep`, a colour and its hold in seconds, and the holds are a `Beat` as [frames](/frames) are, so one sequence plays at one redraw a second and at sixty.

The ground stays as the cell draws it, and the words stay readable on it. Each step's ink is written as the colour nearest the step's that the output's depth can draw and that reads on the cell's ground at the floor every loop here keeps: the cell's resting contrast, or WCAG AA if it rested above that, measured on the colours the terminal is sent. In truecolor that is the step itself, or its hue at the lightness nearest it that clears the floor. Below truecolor it is the nearest colour the depth has an index for, so on a sixteen-colour terminal the ink steps from slot to slot, where the loops hold still. The search runs once for each ink, ground and step, so every frame inside a step costs what any frame does, and the frame says it [next changes](/frames#when-the-frame-next-changes) when the step ends.

```typescript live
import { CATPPUCCIN_MOCHA, ColorRgba, Effected, FrameSequence, Live, RichText, Style, steppedInk } from "@promptctl/rich-js";

const theme = CATPPUCCIN_MOCHA;
const chevrons = new FrameSequence(["›", "››", "›››"].map((glyphs) => ({ text: new RichText(glyphs, { style: Style.parse("bold on #313244") }), seconds: 1 })));
const signal = steppedInk([
  { color: new ColorRgba(255, 85, 85), seconds: 1 },
  { color: new ColorRgba(241, 250, 140), seconds: 1 },
  { color: new ColorRgba(80, 250, 123), seconds: 1 },
]);

const live = new Live(new Effected(chevrons, signal, { key: "effort", theme }), { console });
live.start();
try {
  await new Promise((resolve) => setTimeout(resolve, 6000));
} finally {
  live.stop();
}
```

### A ramp across an element

`gradient(ramp, colors?)` lays a [`ColorRamp`](/easing#in-a-color-ramp) across the element: each lit cell's ink is the ramp's colour at the cell's column, the leftmost cell reading the first stop and the rightmost the last. The ramp is an [animation](/animation#a-ramp-that-moves) of a ramp, so `ramp.moving(…)` scrolls it along the element and turns its hues, and a still gradient is `Animation.constant(ramp)`. The frame changes when the ramp does: every frame for a loop, never again once a tween settles it.

Lit cells are those whose ink is one of `colors`, named as a style names them and matched as the screen shows them at the output's depth, or by default every colour the element sets itself. A named colour must be opaque, and a misspelt or translucent one is refused when the gradient is made. Below truecolor, every ink that lands on the same palette colour as a named one is lit with it. A terminal-supplied ink is never lit. Naming a rule's line colour paints the line and leaves its title, and naming a panel's border colour paints the border and leaves its body. A ramp colour that would not read on the cell's ground is written as the nearest colour that does, the same check `steppedInk` makes. On a sixteen-colour terminal, or with no colour, a gradient holds every cell as drawn, as the loops do.

```typescript
import { Animation, CATPPUCCIN_MOCHA, ColorRamp, ColorRgba, EASES, Effected, Panel, Phase, RichText, gradient } from "@promptctl/rich-js";

const hues = new ColorRamp(EASES.linear, [
  { at: 0, color: new ColorRgba(255, 120, 100) },
  { at: 0.5, color: new ColorRgba(110, 190, 255) },
  { at: 1, color: new ColorRgba(255, 120, 100) },
]);
const flowing = gradient(hues.moving({ scroll: Animation.continuous(Phase.loop(4)) }), ["#a6e3a1"]);
const panel = new Panel(new RichText("the words keep their own colour", { style: "#cdd6f4" }), { borderStyle: "#a6e3a1", width: 40 });

for (const t of [0, 1, 2]) {
  console.print(new Effected(panel, flowing, { key: "status", theme: CATPPUCCIN_MOCHA }).at(t));
}
```

To watch a gradient move on a rule and a panel border, run `npm run gradient-effects` in a checkout of this repository.

### Sampled on a beat

`onBeat(effect, beat)` samples any effect once a hold: within a hold it draws the frame at the hold's start, and at each hold's start it moves on. A `wheel` given a short curve and sampled once a second becomes a hue walk that turns a step at a time; sampled sixty times a second it still turns once a second, since the beat is seconds. At one redraw a second a hold shorter than a second is skipped, as a frame is. The frame [next changes](/frames#when-the-frame-next-changes) at a hold's start, the first one the sampled effect has moved by: an effect that moves every frame turns the beat at the end of this hold, one whose next step falls two holds on turns it there, and one that is done and says never leaves the beat saying never.

`onBeat(transition, beat)` steps a transition the same way, its schedule with it: `onBeat(fadeIn(curve, 0), beat([0.25]))` fades in a quarter of a second at a time and is done at the first hold that starts once the fade is, so an element [arriving](/animation#enter-and-exit-an-element-arriving-staying-and-leaving) through it wakes its host on the quarters, not every frame.

```typescript
import { CATPPUCCIN_MOCHA, EASES, EFFECT_CATALOGUE, Effected, RichText, Style, beat, onBeat } from "@promptctl/rich-js";

const theme = CATPPUCCIN_MOCHA;
const label = new RichText(" rich-js ", { style: Style.parse("#1e1e2e on #89b4fa") });
const walk = onBeat(EFFECT_CATALOGUE.loops.wheel({ z: 0 }, { seconds: 6, ease: EASES.linear, swing: 0 }), beat([1]));

for (const t of [0, 0.5, 1, 2.5]) {
  console.print(new Effected(label, walk, { key: "brand", theme }).at(t));
}
```

To edit and tune each effect's code while it runs, open the [effects playground](/effects-playground). To watch every effect at any frame rate, colour depth and theme, run `npm run effects-feel` in a checkout of this repository.

An effect changes colours and attributes, never glyphs. To type, scramble or rain on what an element draws, use a [glyph effect](/animation#a-glyph-effect-text-typed-scrambled-and-rained-on), which works the same way and nests with an effect over the same element.

### An attribute on a beat

An effect moves a cell's attributes the way it moves its colours, by returning a look with them changed. `blink` is the one ready-made shape: given an attribute and two holds in seconds, `off` then `on`, it leaves every cell as drawn for `off` and sets the attribute for `on`, round and round. Off, its frame is the identity, so those frames are byte for byte what the element drew; it changes only when its beat does, so a host draws it twice a pass and rests between. `ATTRIBUTE_DEFAULTS` holds its two specs, and `EFFECT_CATALOGUE.attributes` makes them by name: `blink`, the words hidden (`conceal`) half of each second as a terminal's own blink does, and `boldPulse`, bold for the last three tenths of each second.

```typescript
import { ColorDepth, DEFAULT_TERMINAL_THEME, EFFECT_CATALOGUE, Effected, RichText, renderToString } from "@promptctl/rich-js";

const pulsing = EFFECT_CATALOGUE.attributes.boldPulse({ z: 0 });
const word = new RichText("ready");

for (const t of [0, 0.69, 0.7, 0.99, 1]) {
  const drawn = renderToString(new Effected(word, pulsing, { key: "ready", theme: DEFAULT_TERMINAL_THEME }).at(t), { colorSystem: ColorDepth.TRUECOLOR });
  console.print(`t=${t}s  ${drawn.includes("\x1b[1m") ? "bold" : "as drawn"}`);
}
```

Under `confined`, a cell's attributes go with its ink: a seam cell between two items is bold when the item that drew its glyph is. To watch them blink, run `npm run attribute-effects` in a checkout of this repository.

## Writing an effect

`Effected` is any renderable under an effect over time: an [animation](/animation#placing-one) whose value at `t` is the element with its cells' looks — colours and attributes — passed through the effect at that moment. Placed in a view, it draws at the frame's time and stamps its cells with exactly when the effect's frame next changes at the output's depth, so a loop that cannot move at sixteen colours lets the host sleep. Here it is drawn at one moment, `.at(t)`:

```typescript
import { Animation, ColorRgba, ColorRamp, DEFAULT_TERMINAL_THEME, EASES, Effected, Phase, RichText, type Effect } from "@promptctl/rich-js";

const highlight = new ColorRgba(255, 214, 102);
const sweep = Phase.loop(1.5);
const label = "  thinking about colour  ";

const shimmer: Effect = () =>
  Animation.continuous((t) => {
    const centre = sweep(t) * label.length;
    return (look, cell) => {
      const weight = Math.max(0, 1 - Math.abs(cell.col - centre) / 4);
      const toward = new ColorRamp(EASES.linear, [
        { at: 0, color: look.fg },
        { at: 1, color: highlight },
      ]);
      return { ...look, fg: toward.at(weight) };
    };
  });

for (const t of [0, 0.5, 1]) {
  console.print(new Effected(new RichText(label), shimmer, { key: "thinking", theme: DEFAULT_TERMINAL_THEME }).at(t));
}
```

## Time is an argument

Nothing in an effect reads a clock. Whoever draws frames builds the view for each frame's `t`, so the same `t` always draws the same output, at 30 frames a second or one every two seconds. How far along an effect is comes from the [easing and phase vocabulary](/easing): `ease(phase(t))`.

## What a cell knows

- `row` and `col` count from the top-left of what the wrapped renderable drew, so a sweep crosses the element, not the screen. A wide glyph is one cell to the effect, at the column of its first half, and is never cut.
- `seed` is a number in `[0, 1)` that stays the same for that cell on every frame, for effects that vary cell by cell. It is derived from the `key` option and the cell's position, so two elements showing the same text under different keys do not move in lockstep.
- The look's `fg` and `bg` are what the screen shows: the glyph's colour and the colour behind it, so under `reverse` they are the style's two colours swapped. A cell that sets no colour of its own, or names one of the sixteen ANSI colours, is handed that colour from the `theme` option, a `TerminalTheme`. The terminal's real palette is never queried, so the caller supplies it.
- `terminal` says, for `fg` and `bg` as the screen shows them, whether that colour is the terminal's own: one the style leaves unset or sets to `default`. Resolved through the theme, it can have the same hex as a colour the element wrote; `terminal` is what tells the two apart. `onColors` and `wheel` never move a colour the terminal supplies.
- `reverse` says whether the cell's style swaps its two slots, so the ink is written in the ground's slot. With the look's colours and `terminal` it is the cell's `Pair`, the shape `drawn.pairs` lists.
- The look's `attributes` are the cell's text attributes as its style sets them: each `true`, `false` or `undefined`, and an unset one lets a style laid beneath show through, as it does with no effect. `reverse` is not among them: whether the two colours are swapped is what decides which one the screen shows as ink, so an effect swaps them by moving the colours.
- `anchor` is who drew the cell, and where it sits in their output, as `Segment.anchorAt` reads it off a frame, or `undefined` for a cell no owner stamped. `confined` reads it.

## What an effect cannot change

An effect changes how cells look, never which cells exist or who drew them. Text, links, and the anchors that let a click or Tab reach a widget all pass through, so a button under an effect still takes clicks. A cell whose look comes back unchanged is drawn exactly as before: the identity effect, `() => Animation.constant((look) => look)`, produces byte-identical output. Neighbouring cells of one segment that the terminal is sent alike stay one segment: below truecolor, two colours that land on one palette index are one run, and a cell moved too little for the depth to show keeps the colour it was written in, none included. Cells from two segments stay two, as the wrapped renderable drew them.

With no colour output at all, an effect has nothing to change, and the wrapped renderable draws as it would without it.

A colour an effect moves is written as the nearest colour the output's depth can draw on the `theme` terminal: the RGB value itself in truecolor; otherwise the nearest of the terminal's default colour, the theme's sixteen and, at 256 colours, the cube and grey ramp. A translucent colour is laid on what is beneath it first, as every translucent colour the library writes is: the ground on black, since a terminal cannot say what lies under its cells, and the glyph on that ground. So below truecolor a colour moved a little off an ANSI slot or the default colour is still drawn as that one. On a sixteen-colour terminal a move that does show is a jump to another slot, so there a loop — `wheel`, and any lit by `onColors`, every one in the catalogue among them — holds every cell still rather than flickering between slots. A transition still runs, from slot to slot, since it moves once and is done, and so does `steppedInk`, since stepping is what a signal is for.

Effects stack by nesting: `new Effected(new Effected(child, a, options), b, options)` draws each cell in the colours that applying `a` and then `b` gives it. The bytes can differ from one effect that calls `a` then `b`: the outer layer sees the inner layer's output as written, so a colour the inner layer changed reaches the outer one already rounded to the output's depth, and stays written as that even where the outer one moves it back. The outer layer's `drawn` is measured on the inner layer's output too, so a loop lit by `onColors` on the outside settles its shares against colours that move every frame.
