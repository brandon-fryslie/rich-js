/**
 * The effect catalogue: shimmer, pulse, sparkle and wheel, which loop for as
 * long as they are drawn, fade-in and dissolve-out, which run once and are
 * done, a blink and a bold pulse, which move an attribute on a beat, and a
 * gradient, which lays a colour ramp across an element and may move it. Each is an `Effect` for `Effected` (`./effect.ts`); the defaults
 * in `EFFECT_CURVES` are the ones signed off by eye in the effects-feel demo
 * (`npm run effects-feel`), at 30 fps and at one frame a second, and
 * `EFFECT_CATALOGUE` makes every one of them at those, by name, one way.
 *
 * Each effect is something a first-time observer already knows from life —
 * a slow glow, sunlight moving on water, the colours of daylight, fireflies, ink
 * blooming in water, mist lifting — because a motion the eye recognises
 * reads as calm and alive, where a motion it has to learn reads as a widget.
 * One effect here is not ambience but a signal, and keeps none of this on
 * purpose: `steppedInk` steps its ink through colours on a beat, the news
 * that something is at its limit, and jumps from slot to slot where the
 * loops hold still. Nor is `gradient` a light: it paints an ink rather than
 * lighting it, so it may darken one, and a ramp scrolled across it jumps
 * where the ramp wraps unless its ends are one colour. Of the list below it
 * keeps the words. What makes the loops' motions familiar is what every
 * curve of theirs keeps:
 *
 * - Nothing jumps. Every curve is continuous in time, built from smooth
 *   noise (`core/noise.ts`) and smooth waveforms, so at one frame a second a cell
 *   moves a little and at thirty it glides.
 * - Nothing repeats exactly. Rhythms are perturbed by slow noise, and each
 *   breath, firefly's flash and pass of light is an event of its own, with
 *   its own strength and moment, the way no breath or gust is the last one
 *   again. A weaker event is a shorter one, so its strength costs nothing
 *   in smoothness.
 * - Neighbours move together. Variation is spatially coherent — patches,
 *   filaments, fronts — never per-cell static.
 * - Light only ever lights, and never takes the words away. Ink and the
 *   fill under it both move toward the light and never darken, each by its
 *   own share: the share a colour can take while every cell it is drawn in
 *   still reads at its resting contrast or WCAG AA, whichever is lower. A
 *   cell with contrast to spare glows brightly; one with none barely moves.
 * - Elements are apart. Each sits at its own `z` in the noise, so two
 *   elements under one effect do not move in lockstep.
 *
 * Colour moves are in OKLCH, where equal steps look equal. A curve's `ease`
 * maps its intensity in [0, 1] — how strongly the effect acts on a cell at a
 * moment — onto its swing, for the loops and the transitions alike.
 *
 * [LAW:no-ambient-temporal-coupling] No curve reads a clock; `t` is the
 * effect's argument, so the frame owner decides when to sample.
 *
 * Every import below names something the package exports, but for `noise`
 * and `Memo`, which the docs' effects playground page supplies itself: each of its
 * cards runs this file's own declarations as the program a visitor edits
 * (`examples/effects-playground/programs.ts`), on the published library.
 */

import { Animation } from "../core/animation.js";
import { ColorDepth, ColorRgba, ColorSpec, contrastRatio, relativeLuminance, type TerminalTheme } from "../core/color.js";
import { EASES, Phase, beat, type Beat, type Timing } from "../core/easing.js";
import { fbm, hash, noise, smoothstep } from "../core/noise.js";
import { Memo, WeakMemo } from "../core/memo.js";
import { Oklch } from "../core/oklch.js";
import { Style } from "../core/style.js";
import { ensureContrast } from "../themes/colorMath.js";
import type { ColorRamp } from "../themes/ramp.js";
import { Effected, type CellAttributes, type CellLook, type Drawn, type Effect, type EffectCell, type EffectFrame, type Pair, type Placed } from "./effect.js";

/** What a loop does to one colour at strength `w` in [0, 1]: at 0, nothing. */
export type Touch = (color: ColorRgba, w: number) => ColorRgba;

/**
 * How strongly a loop acts at a moment `t` on each cell of a frame drawing
 * what `Drawn` says, in [0, 1]; `onColors` holds a field outside it to it.
 * Staged as `Effect` is: what holds for the whole moment is worked out once,
 * then every cell is asked.
 */
export type Field = (t: number, drawn: Drawn) => (cell: EffectCell) => number;

/** A looping effect: what it does to a colour, and where and when, how strongly. */
export interface Loop {
  readonly touch: Touch;
  readonly field: Field;
}

/** The contrast no touch takes a cell below, unless it rested below it: WCAG AA for body text. */
const LEGIBLE = 4.5;

/**
 * The strengths a cell is drawn at: a field is snapped to one of these, and
 * a share is checked at every one, so every strength drawn was checked. A
 * 256-colour cube colour changes in jumps between strengths, and no check of
 * a continuous strength between two of them could see every jump. A step is
 * a 48th of a swing, well under a just-noticeable difference.
 */
const LEVELS = 48;
const STRENGTHS: readonly number[] = Array.from({ length: LEVELS }, (_, i) => (i + 1) / LEVELS);

/** What 8-bit rounding of an OKLCH round trip can cost a contrast ratio. */
const ROUNDING = 0.01;

/**
 * The contrast no loop draws `pair` below at `depth`: its resting contrast or
 * `LEGIBLE`, whichever is lower, less what truecolor's rounding can cost.
 * Below truecolor every colour written is one the depth holds exactly, so
 * there is nothing to forgive. [LAW:one-source-of-truth] The floor `shares`
 * settles the light against and `wheel` writes its turn above.
 */
function floorOf(pair: Pair, depth: ColorDepth): number {
  return Math.min(contrastRatio(pair.fg, pair.bg), LEGIBLE) - (depth === ColorDepth.TRUECOLOR ? ROUNDING : 0);
}

/** A pair's two sides, glyph and ground. */
type Side = "fg" | "bg";
const SIDES: readonly Side[] = ["fg", "bg"];

/**
 * How much of `touch` each of `colors` (hex) can take: the largest share in
 * [0, 1] at which every pair `drawn` shows it in, touched at the same
 * strength, still reads at its resting contrast or `LEGIBLE`, whichever is
 * lower, in the colours `Effected` writes it in at `drawn`'s depth and theme.
 * A colour in a pair but not in `colors` takes none, and so does one
 * the terminal supplies, whatever its hex, as in `onColors`. One of `colors`
 * no pair writes has nothing to be measured against, and takes it all.
 *
 * Colours are settled lightest first, each against every partner: one
 * already settled at its share, one not yet settled as it is. So the lighter
 * colour of a cell takes the light first and its darker partner spends
 * whatever contrast is left — pale lettering lifting off a dark fill gives
 * the fill room to glow — and a darker colour left as it is always holds,
 * because its lighter partner was settled against exactly that.
 */
export function shares({ pairs, depth, theme }: Drawn, colors: ReadonlySet<string>, touch: Touch): Map<string, number> {
  // [LAW:one-source-of-truth] A slot shows a subject colour, by hex, only
  // where the element writes it: the reading `onColors` lights by.
  const own = (pair: Pair, side: Side): string | undefined => (pair.terminal[side] ? undefined : pair[side].hex);
  const rgba = new Map(pairs.flatMap((pair) => SIDES.flatMap((side): [string, ColorRgba][] => {
    const hex = own(pair, side);
    return hex === undefined ? [] : [[hex, pair[side]]];
  })));
  // A colour no pair writes keeps no word legible, so nothing bounds its share:
  // a frame drawing a lit colour only under blanks and seams, or not at all,
  // is a frame like any other.
  const settled = new Map([...colors].filter((hex) => !rgba.has(hex)).map((hex): [string, number] => [hex, 1]));
  const lightness = (hex: string): number => Oklch.fromRgba(rgba.get(hex)!).l;
  for (const hex of [...colors].filter((hex) => rgba.has(hex)).sort((a, b) => lightness(b) - lightness(a))) {
    // Each pair showing the colour, with the side it shows it on and the share its partner takes.
    const facing = pairs.flatMap((pair): [Pair, Side, number][] => {
      const mine = SIDES.find((side) => own(pair, side) === hex);
      if (mine === undefined) return [];
      const partner = own(pair, mine === "fg" ? "bg" : "fg");
      return [[pair, mine, partner === undefined ? 0 : (settled.get(partner) ?? 0)]];
    });
    // [LAW:one-source-of-truth] A pair reads in the colours `Effected` writes it in, touched at each side's share.
    const holds = (share: number): boolean =>
      facing.every(([pair, mine, theirs]) => {
        const floor = floorOf(pair, depth);
        const at = (side: Side, w: number): ColorRgba => touchedAt(touch, pair[side], (side === mine ? share : theirs) * w);
        return STRENGTHS.every((w) => {
          const shown = Effected.shows(pair, { fg: at("fg", w), bg: at("bg", w) }, depth, theme);
          return contrastRatio(shown.fg, shown.bg) >= floor;
        });
      });
    let [lo, hi] = holds(1) ? [1, 1] : [0, 1];
    for (let i = 0; i < 20 && hi - lo > 1e-3; i++) {
      const mid = (lo + hi) / 2;
      [lo, hi] = holds(mid) ? [mid, hi] : [lo, mid];
    }
    settled.set(hex, lo);
  }
  return settled;
}

/**
 * A loop as an `Effect` on the element's own colours, by hex, wherever a cell
 * shows them, each touched at its share of the cell's strength: the share
 * `shares` settles for it against the pairs the element draws its words in
 * (`Drawn`), touched as `Effected` writes them at the frame's depth — at 256
 * colours a touched colour lands on a colour the slot can write, and the
 * contrast it spends is that colour's; on a sixteen-colour terminal nothing
 * moves (`stillOnSlots`). `colors` are the ones lit, by default every colour the element
 * sets itself. A powerline strip's fill is the ground of its cells and the
 * ink of the seam glyphs between them, so the arrow moves with the cell it
 * points out of. A colour the terminal supplies (`EffectCell.terminal`) is
 * not the element's, whatever its hex, and takes no share.
 *
 * Settling shares is costly, so it is done once for each set of colours an
 * element draws: make the effect once and draw it in every frame, and a frame
 * drawing what an earlier one drew costs no settling.
 */
export function onColors(loop: Loop, colors?: ReadonlySet<string>): Effect {
  const settled = new WeakMemo<Memo<ReadonlyMap<string, number>>, TerminalTheme>();
  const settle = (drawn: Drawn): ReadonlyMap<string, number> => {
    const lit = colors ?? drawn.colors;
    const key = [drawnKey(drawn), "|", ...lit].join(" ");
    return settled.get(drawn.theme, () => new Memo()).get(key, () => shares(drawn, lit, loop.touch));
  };
  return stillOnSlots(atShares(loop, settle));
}

/** What a frame draws, as a key: its depth and its pairs, which its `colors` and `fills` are read off. */
function drawnKey({ depth, pairs }: Drawn): string {
  return [depth, ...pairs.map(pairKey)].join(" ");
}

/**
 * A pair as a key: two pairs the screen shows alike, from slots alike, are
 * one — the spelling `Drawn.pairs` is made distinct by (`./effect.ts`), and
 * what every memo here over a frame's pairs is keyed on. Spelled here rather
 * than imported: a playground card runs this file on the published library
 * (header), and a name this file imports from `./effect.js` is one the
 * package exports.
 */
function pairKey({ fg, bg, terminal, reverse }: Pair): string {
  return `${fg.hex}/${bg.hex}/${terminal.fg}/${terminal.bg}/${reverse}`;
}

/**
 * A ramp laid across the element: each lit cell's ink is the colour `ramp`
 * shows at `t` at the cell's column, the element's leftmost cell reading
 * the ramp's first stop and its rightmost its last, each at its cell's
 * centre — or, where that colour would not read on the cell's ground, the
 * nearest that does (`legibleInks`, as `steppedInk` writes its steps). A
 * ramp that moves (`ColorRamp.moving`) scrolls along the element and turns
 * its hues, and the frame changes when the ramp does — every frame for a
 * loop, never again once a tween settles; a still one is
 * `Animation.constant(ramp)`. Lit cells are those whose ink is one of
 * `colors`, named as a style names them (`"#a6e3a1"`, `"bright_green"`),
 * opaque, and matched as the screen shows them at the frame's depth — so
 * below truecolor every ink that lands on the same palette colour is lit —
 * by default every colour the element sets itself — never an ink the terminal supplies: a
 * rule's line by its colour and not its title, a panel's border and not its
 * body. The element is where its frame lists
 * cells, as the fireflies read it, so a padded or confined element has the
 * ramp across what it shows. On a sixteen-colour terminal nothing moves
 * (`stillOnSlots`): a gradient there is jumps between slots, and the cells
 * hold as drawn.
 */
export function gradient(ramp: Animation<ColorRamp>, colors?: readonly string[]): Effect {
  const legible = legibleInks();
  // [LAW:parse-dont-validate] Parsed at the call, so a misspelt colour fails
  // where it was written and not on some later frame.
  const named = colors?.map(opaqueInk);
  // [LAW:one-source-of-truth] A colour named as a style spells it is lit
  // wherever a cell shows it, so it is resolved as `Effected` resolves a
  // cell's ink: drawn at the frame's depth, then read on its terminal.
  const shown = (spec: ColorSpec, { depth, theme }: Drawn): string =>
    (Style.fromColor(spec).drawnColors(depth).color ?? ColorSpec.default()).getTruecolor(theme, true).hex;
  return stillOnSlots((drawn) => {
    const lit = named === undefined ? drawn.colors : new Set(named.map((spec) => shown(spec, drawn)));
    const inkOn = legible(drawn);
    const [left, right] = extent(drawn.cells().map((cell) => cell.col));
    return Animation.map(ramp, (now): EffectFrame => {
      const first = now.stops[0]!.at;
      const span = now.stops[now.stops.length - 1]!.at - first;
      const along = (col: number): ColorRgba => now.at(first + (span * (col - left + 0.5)) / (right - left + 1));
      return (look, cell) => (cell.terminal.fg || !lit.has(look.fg.hex) ? look : { ...look, fg: inkOn(along(cell.col), look, cell) });
    });
  });
}

/**
 * `spec` parsed as an ink `gradient` lights. Opaque only: a translucent ink
 * is drawn over the ground of each cell it is in, so it shows as no one
 * colour to match, and naming one is refused here.
 */
function opaqueInk(spec: string): ColorSpec {
  const parsed = ColorSpec.parse(spec);
  if (parsed.value !== undefined && parsed.value.alpha < 1) throw new RangeError(`gradient lights opaque colours, and ${spec} is translucent`);
  return parsed;
}

/**
 * A loop as an `Effect` on colours by hex, each touched at the share
 * `share` gives it of the cell's strength in a frame drawing what `Drawn`
 * says; a colour it gives none, and one the terminal supplies, stays as it is.
 */
export function atShares(loop: Loop, share: (drawn: Drawn) => ReadonlyMap<string, number>): Effect {
  return (drawn) => {
    const shared = share(drawn);
    return Animation.continuous((t): EffectFrame => {
      const field = loop.field(t, drawn);
      return (look, cell) => {
        const w = Math.round(clamp01(field(cell)) * LEVELS) / LEVELS;
        const moved = (color: ColorRgba, terminal: boolean): ColorRgba =>
          touchedAt(loop.touch, color, (terminal ? 0 : (shared.get(color.hex) ?? 0)) * w);
        return { ...look, fg: moved(look.fg, cell.terminal.fg), bg: moved(look.bg, cell.terminal.bg) };
      };
    });
  };
}

/**
 * `loop` as drawn at the frame's depth: where the depth writes only the
 * sixteen ANSI slots, or no colour, a move that shows at all is a jump to
 * another slot, and a light on an element never jumps — so there it
 * holds every cell still, and anywhere else it moves. [LAW:single-enforcer]
 * `onColors`, `wheel` and `gradient` draw through this, so every loop in the catalogue
 * meets the sixteen-colour terminal here. `atShares` does not: a progress
 * bar's pulse is the news that work is going on, and flashes a slot as
 * Rich's does; nor does `steppedInk`, a signal, which steps slot to slot.
 * A frame held still never changes, and says so, so a host drawing the
 * loop on such a terminal draws it once.
 */
function stillOnSlots(loop: Effect): Effect {
  return (drawn) => (onlySlots(drawn.depth) ? Animation.constant<EffectFrame>((look) => look) : loop(drawn));
}

/** Whether `depth` writes nothing between the slots it has: the sixteen, at either sixteen-colour depth, or none. */
function onlySlots(depth: ColorDepth): boolean {
  switch (depth) {
    case ColorDepth.DEFAULT:
    case ColorDepth.STANDARD:
    case ColorDepth.WINDOWS:
      return true;
    case ColorDepth.EIGHT_BIT:
    case ColorDepth.TRUECOLOR:
      return false;
  }
}

/**
 * `color` under `touch` at strength `w`, and at strength 0 the colour itself,
 * exactly: an OKLCH round trip can land a step off, and at 16 colours a step
 * off is another slot.
 */
function touchedAt(touch: Touch, color: ColorRgba, w: number): ColorRgba {
  return w === 0 ? color : touch(color, w);
}

/**
 * How the curves below are tuned: a `Timing` — seconds, a looping effect's
 * period or a transition's duration, and an ease, intensity in [0, 1] to
 * the fraction of `swing` applied; one that overshoots, as a CSS
 * `cubic-bezier` may, saturates, since an effect never acts past its swing —
 * and the swing itself.
 */
export interface Curve extends Timing {
  /** How far the move goes at full intensity, in [0, 1]; what 1 means is the effect's. */
  readonly swing: number;
}

/** Throws, naming the field, unless `curve` has a positive, finite `seconds` and a `swing` in [0, 1]. */
export function requireCurve(curve: Curve): void {
  if (!(Number.isFinite(curve.seconds) && curve.seconds > 0)) throw new RangeError(`curve: seconds must be a positive number of seconds, got ${curve.seconds}`);
  if (!(curve.swing >= 0 && curve.swing <= 1)) throw new RangeError(`curve: swing must be in [0, 1], got ${curve.swing}`);
}

/**
 * Throws, naming `what`, unless `z` is a finite place in the noise. Noise at
 * a place that is not a number is not a number, which no effect could tell
 * from a dim cell or an empty sky. [LAW:no-silent-failure]
 */
export function requireZ(what: string, z: number): void {
  if (!Number.isFinite(z)) throw new RangeError(`${what} z must be a finite place in the noise, got ${z}`);
}

/**
 * Each effect's curve as it was signed off. Every loop's period is a prime
 * number of seconds, so no two loops come back into step within a sitting.
 * The periods are long on purpose: at one frame a second a loop's colour
 * moves by no more than a just-noticeable step from one frame to the next.
 */
export const EFFECT_CURVES = {
  shimmer: { seconds: 109, ease: EASES.linear, swing: 0.9 },
  pulse: { seconds: 43, ease: EASES.linear, swing: 0.85 },
  sparkle: { seconds: 139, ease: EASES.linear, swing: 0.95 },
  wheel: { seconds: 907, ease: EASES.linear, swing: 1 },
  fade: { seconds: 20, ease: EASES["ease-in-out"], swing: 1 },
  dissolve: { seconds: 30, ease: EASES["ease-in-out"], swing: 1 },
} as const satisfies Record<LoopName | TransitionName, Curve>;

/** The lights the loops were signed off casting, warm as sunlight and fireflies are. */
export const EFFECT_LIGHTS = {
  sun: new ColorRgba(255, 228, 176),
  firefly: new ColorRgba(222, 245, 140),
} as const satisfies Record<string, ColorRgba>;

/** How far a shimmer's light reaches either side of its centre, in columns, as signed off. */
export const SHIMMER_WIDTH = 24;

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

/**
 * `w` of the way from `from` to `to` along a straight line in OKLab. Light
 * falling on a colour, or a colour thinning into its ground, moves straight
 * toward the other colour; `Oklch.mix` goes round the hue circle instead, so
 * blue lit by gold would pass through cyan on the way.
 */
function blend(from: Oklch, to: Oklch, w: number): Oklch {
  if (!(w >= 0 && w <= 1)) throw new RangeError(`blend: w must be in [0, 1]; got ${w}`);
  const rad = Math.PI / 180;
  const a = (1 - w) * from.c * Math.cos(from.h * rad) + w * to.c * Math.cos(to.h * rad);
  const b = (1 - w) * from.c * Math.sin(from.h * rad) + w * to.c * Math.sin(to.h * rad);
  return new Oklch((1 - w) * from.l + w * to.l, Math.hypot(a, b), Math.atan2(b, a) / rad, from.alpha);
}

/**
 * A colour under `glow`: the one way every light here falls. It moves `w` of
 * the way toward the light's colour, and never below its own lightness —
 * light can warm a colour and lift it, never darken it. A colour already
 * lighter than the light only warms, and white, which has no warmer shade at
 * its lightness, stays white.
 */
export function light(glow: ColorRgba): Touch {
  const to = Oklch.fromRgba(glow);
  return (color, w) => {
    const from = Oklch.fromRgba(color);
    return blend(from, new Oklch(Math.max(from.l, to.l), to.c, to.h, to.alpha), w).toRgba();
  };
}

/**
 * How a swell rises and falls: the levels the strongest one passes through,
 * each at its moment in turns of its cycle, from 0 at the start of its turn
 * and back to 0 at its last knot.
 */
type SwellShape = readonly (readonly [turn: number, level: number])[];

/** How long a swell `k` strong lasts, in turns. */
const lasts = (shape: SwellShape, k: number): number => k * shape[shape.length - 1]![0];

/**
 * A swell — a breath, a firefly's glow — `k` strong, in [0, 1], `s` after it
 * began: a raised cosine from each knot to the next, 0 before and after, zero
 * slope at every knot. A weaker swell is a shorter one in proportion, so it
 * climbs no more steeply than the strongest: however strong, its steepest
 * moment is the same, and only the strongest need be checked against the
 * step a frame may take. A swell of strength 0 is no swell at all: 0
 * throughout, its own start included.
 */
function swell(shape: SwellShape, s: number, k: number): number {
  const p = s / k;
  const to = shape.findIndex(([turn]) => p < turn);
  if (!(p > 0) || to < 0) return 0;
  const [t0, l0] = to === 0 ? [0, 0] : shape[to - 1]!;
  const [t1, l1] = shape[to]!;
  return k * (l0 + ((l1 - l0) * (1 - Math.cos((Math.PI * (p - t0)) / (t1 - t0)))) / 2);
}

/**
 * How much of a swell's light has been given by `s`, in [0, 1]: `swell`'s own
 * running integral over its whole, by the midpoint rule, so the two cannot
 * disagree. Paced by it, a motion is quickest at the swell's height and still
 * at both its ends. `k` is above 0.
 */
function given(shape: SwellShape, s: number, k: number): number {
  const whole = lasts(shape, k);
  const area = (to: number): number => {
    let sum = 0;
    for (let i = 0; i < 24; i++) sum += swell(shape, ((i + 0.5) / 24) * to, k);
    return sum * to;
  };
  return area(Math.min(Math.max(s, 0), whole)) / area(whole);
}

/** A firefly's brightest flash, in turns: it kindles quicker than it fades, and the rest of its turn is dark. */
const FLASH: SwellShape = [[0.24, 1], [0.6, 0]];

/**
 * Pulse, as a gentle glow on one element of a screen: the colours handed to
 * it, an element's own, warm into `light` and settle back, over and over, the
 * way an indicator breathes while something is waiting. Swing: how far into
 * the light it goes at the top of a beat, 0–1. The element glows as one —
 * every cell it is drawn in at once — and the colours not handed to it, the
 * rest of the screen, stay as they are, so what pulses is what was chosen.
 * Each element keeps a time of its own, a little quicker or slower than
 * another's by `z`, and no beat is quite the last: the rhythm wanders ahead
 * and behind its metronome and each beat goes a little deeper or shallower
 * than the one before. A beat starts and ends in rest, so `t = 0` draws the
 * element untouched.
 */
export function pulse(curve: Curve, glow: ColorRgba, z: number): Loop {
  requireCurve(curve);
  requireZ("pulse", z);
  // How much quicker or slower than `curve.seconds` this element beats.
  const rate = 0.9 + 0.2 * hash(z, 3.1);
  // How far, in beats, the rhythm wanders ahead and behind its metronome. Noise's
  // slope stays within ±2.3 over its 3-beat length, so the wander never turns
  // the beat back.
  const WANDER = 0.1;
  const wander = (t: number): number => WANDER * noise(t / (3 * curve.seconds), 0.5, 0.5 + z);
  const start = wander(0);
  const field: Field = (t) => {
    const beats = (rate * t) / curve.seconds + wander(t) - start;
    const n = Math.floor(beats);
    // Each beat's own depth, 70% to the whole of the swing; it changes where
    // the beat is at rest, so nothing jumps.
    const depth = 0.7 + 0.3 * smoothstep(-0.5, 0.5, noise(n * 0.37, 2.1, z));
    const beat = 0.5 - 0.5 * Math.cos(2 * Math.PI * (beats - n));
    const level = curve.swing * curve.ease(depth * beat);
    return () => level;
  };
  return { touch: light(glow), field };
}

/**
 * How many columns a passing light crosses in its period: its pace.
 * Sunlight moves at a speed, not in a time set by how long the row is,
 * so a wider element is crossed for longer, never faster, and no cell's colour
 * changes quicker on it from one frame to the next.
 */
const STRIDE = 80;

/** A soft, compact bump: 1 at `d = 0`, 0 from `|d| ≥ 1`, smooth throughout. */
const bump = (d: number): number => (Math.abs(d) >= 1 ? 0 : (1 - d * d) ** 3);

/**
 * Shimmer, as sunlight moving across water. Swing: how far into `light` the
 * brightest glint goes, 0–1. A soft band of light, `width` columns either
 * side of its centre, crosses the element from the first column a frame
 * lists (`Drawn.cells`) to the last, entering and leaving fully off it,
 * `STRIDE` columns in about three quarters of a period. Its passes
 * come the way light comes and goes on water as clouds move: while the sun
 * is out they are bright and follow close on one another, one sometimes
 * catching the last; under cloud they thin to faint ones with the row still
 * for a while between, and the light is never gone for long. Each crosses at its own unhurried pace, drifting a little ahead
 * and behind as it goes. Inside a band the light is a faint glow broken
 * into a glitter path — bright filaments where two ripples cross — carried
 * on a slow current and re-forming as they go, so the glints dance while
 * the band glides. Before the first pass enters, the row is untouched.
 */
export function shimmer(curve: Curve, width: number, glow: ColorRgba, z: number): Loop {
  requireCurve(curve);
  requireZ("shimmer", z);
  const P = curve.seconds;
  // Passes are events on slots of half a period. Whether slot `j` holds one,
  // and how bright, is the sky's: slow noise over the slots, so sunny and
  // cloudy spells each last a few periods, and a pass is likelier and
  // brighter the clearer the sky.
  const SLOT = P / 2;
  const sky = (j: number): number => smoothstep(-0.4, 0.4, noise(j / 7, 3.3, 5.5 + z));
  // Pass `j` at `t`, over a crossing `across` columns long — the element's
  // and the band's either side: how bright its band is and where its centre
  // stands from the element's first column, off the element before it sets
  // off and once it is done. It sets off somewhere in the first `SETS_OFF`
  // of its slot and carries its centre `STRIDE` columns in `LEAST` to
  // `LEAST + SPREAD` periods, give or take its drift, so a pass's centre moves
  // at the same pace however long the crossing.
  const SETS_OFF = 0.7;
  const LEAST = 0.51;
  const SPREAD = 0.4;
  const pass = (j: number, t: number, across: number): { strength: number; centre: number } => {
    const clear = sky(j);
    // Even under cloud about one slot in three holds a pass, a faint one, so a
    // still spell lasts a period or so, the way a cloud's shadow does, and
    // never long enough to read as the light gone out.
    const present = hash(j, 7.5 + z) < 0.35 + 0.6 * clear ? 1 : 0;
    const strength = present * (0.3 + 0.7 * clear * (0.6 + 0.4 * hash(j, 8.5 + z)));
    const crossing = ((P * across) / STRIDE) * (LEAST + SPREAD * hash(j, 5.5 + z));
    const q = clamp01((t - (j + SETS_OFF * hash(j, 6.5 + z)) * SLOT) / crossing);
    // It drifts ahead and behind on slow noise, by nothing at either edge of
    // the element and never enough to turn it back.
    const centre = q * across - width + 0.06 * across * Math.sin(Math.PI * q) * noise(q, 2.7, j + z);
    return { strength, centre };
  };
  // The passes on the element at `t`, every one off it `up` slots after its
  // own began; the first slot is 0, so before it there are none.
  const passing = (t: number, across: number): { strength: number; centre: number }[] => {
    const up = SETS_OFF + ((LEAST + SPREAD) * P * across) / STRIDE / SLOT;
    const last = Math.floor(t / SLOT);
    const passes = [];
    for (let j = Math.max(0, Math.ceil(last - up)); j <= last; j++) passes.push(pass(j, t, across));
    return passes;
  };
  // A ripple's crest: a Gaussian ridge, 1 where the field crosses zero and in
  // (0, 1] for any noise, smooth throughout, so a crest sliding through a cell
  // lights it smoothly.
  const ripple = (a: number, b: number, c: number): number => Math.exp(-((noise(a, b, c) / 0.8) ** 2));
  const field: Field = (t, drawn) => {
    // [LAW:one-source-of-truth] The element is as wide as the cells its frame
    // lists, never as a width its caller states: a padded, wrapped or
    // confined element is crossed where it shows.
    const [left, right] = extent(drawn.cells().map((cell) => cell.col));
    const passes = passing(t, right - left + 1 + 2 * width);
    return (cell) => {
      // Where two passes overlap the brighter wins, so light never doubles up.
      let lit = 0;
      for (const { strength, centre } of passes) lit = Math.max(lit, strength * bump((cell.col - left - centre) / width));
      const row = cell.row + z;
      const current = 0.8 * noise(cell.col * 0.05, row * 0.3 + 1.3, t * 0.02);
      const caustic =
        (ripple(cell.col * 0.21 + current, row * 0.9, t * 0.022) * ripple(cell.col * 0.33 + 9.1 - current, row * 0.7, t * 0.018 + 4.2)) **
        2;
      return curve.swing * curve.ease(lit * (0.1 + 0.6 * caustic));
    };
  };
  return { touch: light(glow), field };
}

/**
 * Sparkle, as fireflies. Swing: how far into the firefly's `light` a glow
 * goes at its brightest, 0–1. Fireflies keep to a lattice laid from the
 * element's first column and top row as a frame lists its cells
 * (`Drawn.cells`): one every `PER` columns along a row of the lattice, a row
 * of the lattice every `ROWS` rows, each firefly near a home of its own.
 * The lattice does not hang on how wide or deep the element is, so one that
 * grows or shrinks at its last column or bottom row moves no firefly; one
 * whose first column moves, as centred words that change length do, carries
 * its fireflies with it. A firefly flashes — kindles,
 * drifts a few cells glowing, slowing as it fades — then flies on in the
 * dark and flashes again somewhere a few cells off, the way fireflies at
 * dusk are seen: a short lit stroke, then gone, each time a little
 * elsewhere. Each keeps its own irregular time, now and then letting a turn
 * pass dark, so most moments a few are lit, at different brightnesses. Its
 * light is a soft halo several cells wide, brightest where it is, so as it
 * drifts the glow slides between cells rather than hopping. `seconds` is a firefly's
 * turn: its brightest flash, rise and fall, takes `FLASH` of it, and a
 * dimmer one less.
 */
export function sparkle(curve: Curve, glow: ColorRgba, z: number): Loop {
  requireCurve(curve);
  requireZ("sparkle", z);
  // The columns a firefly has to itself along a row of the lattice, and the
  // rows between two rows of it: more than a halo's reach, so a one-row
  // element is lit by one row of fireflies.
  const PER = 8;
  const ROWS = 3;
  const HALO = 5;
  // How far from home a flash may begin, and how far the brightest drifts while lit.
  const HOP = 5;
  const GLIDE = 5;
  const TURN = curve.seconds;
  // How far from its slot's middle a firefly's light can reach a cell: its
  // home's jitter, a hop, a glide, its wander, and its halo; across rows,
  // its wander and its halo, which counts a row as two columns.
  const REACH = 0.7 * PER + HOP + GLIDE + 1.5 + HALO;
  const REACH_ROWS = 0.6 + HALO / 2;
  // The firefly of slot `i` along lattice row `k` at `t`, from the element's
  // first column and top row: where it is, and how bright. Flash `n` is one
  // event: whether it comes, how bright, when in its turn and where are its
  // own. Between flashes the firefly is dark, so where it moves to is never
  // seen moving.
  const firefly = (i: number, k: number, t: number, left: number, top: number): { x: number; y: number; glow: number } => {
    const id = i * 4.9 + k * 31.7 + 0.3 + z;
    const home = i + 0.5 + 0.7 * noise(i * 1.7 + 0.2, 0.3 + k * 2.9, 0.5 + z);
    // Out of step with every other firefly from the first moment.
    const u = t + hash(i + k * 1013, 0.7 + z) * TURN;
    const n = Math.floor(u / TURN);
    // A dark turn is a flash with no light: it keeps its length, so
    // every flash is timed alike.
    const lit = hash(n, id + 1) < 0.15 ? 0 : 1;
    const strength = 0.5 + 0.5 * hash(n, id + 2);
    const at = hash(n, id + 3) * (1 - lasts(FLASH, strength));
    const s = u / TURN - n - at;
    // While it glows it drifts a few cells one way or the other, as
    // fast as it is bright: quickest at its height, slowing as it
    // fades — the lit stroke a firefly draws on the dusk. A brighter
    // flash lasts longer and draws a longer stroke at the same pace.
    return {
      x:
        left +
        home * PER +
        HOP * (2 * hash(n, id + 4) - 1) +
        GLIDE * strength * (2 * hash(n, id + 5) - 1) * given(FLASH, s, strength) +
        1.5 * noise(id, 0.1, t * 0.035),
      y: top + k * ROWS + 0.6 * noise(id, 2.2, t * 0.035),
      glow: lit * swell(FLASH, s, strength),
    };
  };
  const field: Field = (t, drawn) => {
    // [LAW:one-source-of-truth] The element is where its frame lists cells,
    // never a width its caller states: a padded, wrapped or confined element
    // has its fireflies over it. Its extent only bounds which slots are
    // worked out; where each firefly is never depends on it.
    const cells = drawn.cells();
    const [left, right] = extent(cells.map((cell) => cell.col));
    const [top, bottom] = extent(cells.map((cell) => cell.row));
    const slot = (col: number): number => (col - left) / PER - 0.5;
    const band = (row: number): number => (row - top) / ROWS;
    const [i0, i1] = [Math.ceil(slot(left - REACH)), Math.floor(slot(right + REACH))];
    const [k0, k1] = [Math.ceil(band(top - REACH_ROWS)), Math.floor(band(bottom + REACH_ROWS))];
    const flies = Array.from({ length: k1 - k0 + 1 }, (_, k) => Array.from({ length: i1 - i0 + 1 }, (_, i) => firefly(i0 + i, k0 + k, t, left, top)));
    return (cell) => {
      // A cell is asked only of the fireflies whose light can reach it, and
      // where two halos overlap the brighter wins, so light never doubles up.
      let shine = 0;
      const [ia, ib] = [Math.max(i0, Math.ceil(slot(cell.col - REACH))), Math.min(i1, Math.floor(slot(cell.col + REACH)))];
      const [ka, kb] = [Math.max(k0, Math.ceil(band(cell.row - REACH_ROWS))), Math.min(k1, Math.floor(band(cell.row + REACH_ROWS)))];
      for (let k = ka; k <= kb; k++)
        for (let i = ia; i <= ib; i++) {
          const fly = flies[k - k0]![i - i0]!;
          shine = Math.max(shine, fly.glow * bump(Math.hypot(cell.col - fly.x, 2 * (cell.row - fly.y)) / HALO));
        }
      return curve.swing * curve.ease(shine);
    };
  };
  return { touch: light(glow), field };
}

/**
 * How much of each cell shows at `t` in a frame drawing what `Drawn` says: 1
 * is the cell as drawn, 0 is the cell gone to the terminal's ground. Read per
 * cell, so cells can arrive or leave apart, and staged as `Effect` is. One
 * outside [0, 1] is held to it.
 */
export type Visibility = (t: number, drawn: Drawn) => (cell: EffectCell) => number;

/**
 * A cell mixed toward the ground of the terminal the frame is drawn on
 * (`Drawn.theme`) by how hidden it is: its fill toward the ground, and its ink
 * toward that fill, so an element with fills of its own — a powerline strip —
 * arrives and leaves whole, fill and words together, never as bare coloured
 * blocks. Invisible is ink and fill equal to the ground. `swing` scales the
 * hiding — 1 reaches fully invisible. A cell wholly shown is returned as it was.
 */
export function veiled(visibility: Visibility, swing: number): Effect {
  return (drawn) => {
    // [LAW:one-source-of-truth] The ground is the terminal `Effected` draws on, never a second one handed here.
    const ground = Oklch.fromRgba(drawn.theme.backgroundColor);
    return Animation.continuous((t): EffectFrame => {
      const shows = visibility(t, drawn);
      return (look, cell) => {
        const hidden = swing * (1 - clamp01(shows(cell)));
        if (hidden === 0) return look;
        const bg = blend(Oklch.fromRgba(look.bg), ground, hidden);
        return { ...look, fg: blend(Oklch.fromRgba(look.fg), bg, hidden).toRgba(), bg: bg.toRgba() };
      };
    });
  };
}

/**
 * Where each cell falls in a transition's order, in [0, 1]: smooth noise over
 * the element, so neighbouring cells arrive or leave together, in patches
 * with soft edges, as ink spreads or mist thins. `z` places the element in
 * the noise.
 */
function order(z: number): (cell: Placed) => number {
  // The noise is read through slower noise, so the patches reach out in
  // curling tendrils rather than sitting as round blots.
  return (cell) => clamp01(0.5 + 1.1 * fbm(cell.col * 0.09 + 1.4 * noise(cell.col * 0.035, cell.row * 0.2 + 2.6, z + 0.5), cell.row * 0.45, z, 3));
}

/**
 * An effect that runs once: a fade-in or a dissolve-out over its curve's
 * `seconds` from `t = 0`, its own clock as every effect's is — the caller
 * draws it at the time since it began. `done(t)` is true from the moment
 * every cell has arrived or gone, so the caller knows when to stop drawing an
 * element that is leaving, or to drop the effect from one that has arrived.
 *
 * `schedule` is when its frame next changes on that clock, whatever the
 * element draws: what a caller drawing the transition inside an animation —
 * a lifecycle — says its frame does, since the frame it hands over carries
 * no word of its own (`stampFrame`, `../core/animation.ts`). Until done it changes
 * every frame, or on each hold of a beat (`onBeat`), and from then never.
 * [LAW:one-source-of-truth] `done` is that schedule read as a fact — done
 * from the first moment it never changes again — so no transition carries
 * two answers to when it is over.
 */
export class Transition<E = Effect> {
  constructor(
    readonly effect: E,
    readonly schedule: Animation<unknown>,
  ) {}

  done(t: number): boolean {
    return this.schedule.nextChange(t) === Number.POSITIVE_INFINITY;
  }
}

/**
 * `effect` run once over `seconds` as a `Transition`: what it draws until it
 * is done, then held. [LAW:single-enforcer] The one rule for when a
 * transition is done and what it answers after, for a colour effect and a
 * glyph effect (`./glyph-effects.ts`) alike.
 */
export function transition<D, F>(seconds: number, effect: (drawn: D) => Animation<F>): Transition<(drawn: D) => Animation<F>> {
  // Moving every frame until `seconds`, then never: the sequence carries the switch.
  const schedule = Animation.sequence(Animation.continuous(() => undefined), seconds, Animation.constant(undefined));
  const ran: Transition<(drawn: D) => Animation<F>> = new Transition(
    (drawn) => {
      const moving = effect(drawn);
      return Animation.of({
        at: (t: number) => moving.at(t),
        nextChange: (t: number): number => (ran.done(t) ? Number.POSITIVE_INFINITY : moving.nextChange(t)),
        // Done, the frame settled when the transition did; until then it is the effect's.
        lastChange: (t: number) => (ran.done(t) ? schedule.lastChange(t) : moving.lastChange(t)),
        // A one-shot, reduced, cuts from its start to its end, whatever the effect it runs would hold as a loop.
        reduced: () => Animation.cut(moving.at(0), moving.at(seconds)),
      });
    },
    schedule,
  );
  return ran;
}

/**
 * `effect` sampled and held on `beat`: drawn at the moment the hold in
 * progress began (`Beat.lastChange`), so within a hold every frame is the frame
 * at its start, and at each hold's start it moves on. A continuous effect
 * given a short curve becomes one that steps — a `wheel` turning a sixth of
 * a turn once a second — and at one redraw a second a hold shorter than a
 * second is skipped, as frames are. [LAW:no-ambient-temporal-coupling] The
 * held time is a function of `t`, so the same `t` draws the same bytes at
 * any rate. The frame next changes at a hold's start, and only one the
 * sampled effect has moved by (`Animation.onBeat`): an effect that moves
 * every frame turns the beat at the end of this hold, and one that is done
 * and says never leaves the beat saying never too.
 *
 * A transition steps the same way, its schedule with it, so a fade-in on a
 * beat arrives a hold at a time and is done at the first hold that starts
 * after it was: an element arriving through it wakes its host on the beats.
 */
export function onBeat(effect: Effect, beat: Beat): Effect;
export function onBeat<E extends (drawn: never) => Animation<unknown>>(transition: Transition<E>, beat: Beat): Transition<E>;
export function onBeat(stepped: Effect | Transition<(drawn: never) => Animation<unknown>>, beat: Beat): Effect | Transition<(drawn: never) => Animation<unknown>> {
  // [LAW:types-are-the-program] An effect is a function and a transition an object: the representation is the discriminator.
  if (typeof stepped === "function") return (drawn) => Animation.onBeat(stepped(drawn), beat);
  const { effect, schedule } = stepped;
  return new Transition((drawn: never) => Animation.onBeat(effect(drawn), beat), Animation.onBeat(schedule, beat));
}

/**
 * Of a transition's `seconds`, how long each cell's own change takes. Under
 * 1, so the last cell to start is done by the transition's end.
 */
const OWN = 0.45;

/**
 * A cell's own change in a transition's frame: how far along the element's
 * order it starts, in [0, 1], and how far through the change it is then, in
 * [0, 1].
 */
interface CellChange {
  readonly along: number;
  readonly progress: number;
}

/**
 * Each cell's own change in a transition, in the frame at `t` listing `cells`: a cell
 * starts as far through the time the others leave it as its `place` falls
 * between the element's first and last, so on any element, however little of
 * the order its cells span, the first starts at 0 and the last settles at
 * `seconds`. [LAW:one-source-of-truth] That is what lets `done` read
 * `seconds` alone. An element whose cells all share one place has no order to
 * stagger, and its change takes the whole of `seconds`.
 *
 * [LAW:no-ambient-temporal-coupling] Worked out from the frame alone, so
 * the same `t` over the same cells draws the same bytes whatever was drawn
 * before — after a seek, in reverse, at any rate — and one transition is
 * safe on any number of elements. An element that gains cells as it moves is
 * spread over the order it has in each frame, so a cell already moving may
 * move its start — back to unmoved, if a new cell comes first. Nothing
 * steadier is there to spread over: the order's whole range would start a
 * small element late and end it early, and the cells a frame hands reach
 * across a wide frame's blank margin.
 */
function ownChange(curve: Curve, place: (cell: Placed) => number): (t: number, cells: readonly Placed[]) => (cell: Placed) => CellChange {
  return (t, cells) => {
    const [first, last] = extent(cells.map(place));
    const stagger = (last > first ? 1 - OWN : 0) * curve.seconds;
    // One phase a frame, shifted per cell, so no cell builds its own.
    const change = Phase.once(0, curve.seconds - stagger);
    // A share of the way from the first place to the last, held to the order for a cell the frame does not list.
    return (cell) => {
      const along = last > first ? clamp01((place(cell) - first) / (last - first)) : 0;
      return { along, progress: change(t - along * stagger) };
    };
  };
}

/** The least and greatest of `values`; of none, a frame with no cell to place, both 0. */
function extent(values: readonly number[]): readonly [number, number] {
  let lo = values[0] ?? 0;
  let hi = lo;
  for (const v of values) {
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  return [lo, hi];
}

/**
 * Fade-in, as ink blooming in water: patches of the element surface first
 * and the rest follows outward from them, each cell rising smoothly over its
 * own part of the duration. Whole at `seconds`.
 */
export function fadeIn(curve: Curve, z: number): Transition {
  requireCurve(curve);
  requireZ("fadeIn", z);
  const risen = ownChange(curve, order(1.7 + z));
  return transition(
    curve.seconds,
    veiled((t, drawn) => {
      const of = risen(t, drawn.cells());
      return (cell) => curve.ease(of(cell).progress);
    }, curve.swing),
  );
}

/**
 * The rebound of a dissolve, every constant that makes it feel as it does —
 * patches of what is left rising back before they go: `depth` (the most, as a
 * share of whole, a cell rises again), `from` and `to` (where in its own
 * fade, as a share of it gone, the rising begins and is done), `maskFrom` and
 * `maskTo` (which cells rebound: those whose eddy noise is past `maskFrom`,
 * all of them past `maskTo`) and `late` (how much likelier the later a cell
 * goes: 0 is no more likely, 1 is nothing for the first to go).
 */
const DISSOLVE_SHAPE = { depth: 0.4, from: 0.5, to: 0.95, maskFrom: 0.35, maskTo: 0.75, late: 0.6 } as const;

/**
 * Dissolve-out, as mist lifting: the element thins in drifting patches, each
 * cell fading smoothly over its own part of the duration, until nothing is
 * left at `seconds`. Mist does not lift
 * in one breath: towards the end, patches of what is left — the later a cell
 * goes, the likelier — rise back part way, as the last of it eddies, before
 * they thin away for good.
 */
export function dissolveOut(curve: Curve, z: number): Transition {
  requireCurve(curve);
  requireZ("dissolveOut", z);
  const eddy = order(9.3 + z);
  const faded = ownChange(curve, order(4.2 + z));
  const { depth, from, to, maskFrom, maskTo, late } = DISSOLVE_SHAPE;
  return transition(
    curve.seconds,
    veiled((t, drawn) => {
      const of = faded(t, drawn.cells());
      return (cell) => {
        const { along, progress } = of(cell);
        const gone = curve.ease(progress);
        const q = clamp01((gone - from) / (to - from));
        const back = depth * smoothstep(maskFrom, maskTo, eddy(cell)) * (1 - late + late * along) * Math.sin(Math.PI * q) ** 2;
        return 1 - gone + back;
      };
    }, curve.swing),
  );
}

/**
 * The periods, in seconds, of the two noises a segment's stray from the
 * wheel's shared turn rides on. Primes, as every loop's default period is,
 * and none a multiple of another's: a session's loops never come back round
 * to a state they have shown, within any sitting — the first return of the
 * wheel alone is after the product of its three periods.
 */
const STRAY_PERIODS = [211, 337] as const;

/** How far a segment may stray from the shared turn at swing 1, in degrees: half a turn — fully apart. */
const STRAY = 180;

/**
 * Wheel, as the colour of daylight going round: every hue turning the whole
 * way round once a period — far too slowly to be seen moving, so a glance
 * sees a steady palette and an hour's absence a different one — each
 * segment of the element at its own pace. Swing: how far the segments stray
 * from one another, 0–1, 1 being half a turn apart. A segment is a fill of
 * the element's own — one of `fills`, the colours it draws as a ground — and
 * it turns at its own pace wherever it is drawn: as the ground of its cells,
 * and as the ink of the seam glyph pointing out of it into the next, so a
 * powerline cap keeps the colour of the cell it caps. An ink that is no fill
 * turns with the ground it sits on, so a cell's words and fill turn
 * together; on the terminal's ground, a run of text's ink is a segment of
 * its own. A segment's stray is slow noise of its own, at `STRAY_PERIODS`,
 * so no two keep step, and the row never shows one spread of hues twice.
 * A colour keeps its luminance as it turns (`hueTurned`), so every pair of
 * words reads at the contrast it rested at; at 256 colours a turned colour
 * lands on a colour the depth writes, one that keeps every pair of words it
 * is drawn in at its floor (`floorOf`) — its resting contrast or WCAG AA,
 * whichever is lower — as `shares` keeps the light's (`turnedBounds`). The
 * turn only happens to the element's own colours (`Drawn.colors`), never the
 * terminal's. On a sixteen-colour terminal nothing turns (`stillOnSlots`).
 */
export function wheel(curve: Curve, z: number): Effect {
  requireCurve(curve);
  requireZ("wheel", z);
  const P = curve.seconds;
  // A segment's seed, from the colour it is.
  const seed = (hex: string): number => hash(Number.parseInt(hex.slice(1), 16) * 1e-4, 17.3 + z);
  const stray = (s: number, t: number): number =>
    noise(t / STRAY_PERIODS[0], 5.9 + 97 * s, z) + 0.5 * noise(t / STRAY_PERIODS[1], 2.3 + 89 * s, z + 7.1);
  // Measured from where it stood at the start, as pulse's wander is, so the
  // first frame turns nothing and the second has turned only a frame's worth.
  const turned = (hex: string, t: number): number => {
    const s = seed(hex);
    return (360 * t) / P + curve.swing * STRAY * ((stray(s, t) - stray(s, 0)) / 1.5);
  };
  // A turned colour's bounds rest on what a frame draws, never on `t`: settled once for each.
  const settled = new WeakMemo<Memo<ReadonlyMap<string, Bounds>>, TerminalTheme>();
  return stillOnSlots((drawn) => {
    const { colors, fills, depth, theme } = drawn;
    // Whether a slot shows one of the element's colours: never the terminal's, whatever its hex.
    const own = (terminal: boolean, color: ColorRgba): boolean => !terminal && colors.has(color.hex);
    // The segment an own colour turns with: itself if a fill or beside no own colour, else the one beside it.
    const segmentOf = (color: ColorRgba, other: ColorRgba, theirs: boolean): string => (fills.has(color.hex) || !theirs ? color.hex : other.hex);
    // A colour as it turns with a segment: written one way wherever it is drawn in a frame.
    const keyOf = (color: ColorRgba, segment: string): string => `${color.hex} ${segment}`;
    const bounds = settled.get(theme, () => new Memo()).get(drawnKey(drawn), () =>
      turnedBounds(drawn.pairs, depth, (pair, side) => {
        const other = side === "fg" ? "bg" : "fg";
        return own(pair.terminal[side], pair[side]) ? keyOf(pair[side], segmentOf(pair[side], pair[other], own(pair.terminal[other], pair[other]))) : undefined;
      }),
    );
    // 256 colours writes a turned colour as one it has an index for; truecolor
    // as one of the two either side of its luminance.
    const indexed = measuredIndexed(depth, theme);
    return Animation.continuous((t): EffectFrame => {
      const written = new Map<string, ColorRgba>();
      const choose = (color: ColorRgba, segment: string): ColorRgba => {
        const turn = hueTurned(color, turned(segment, t));
        return nearestWithin(turn.looks, color, depth === ColorDepth.TRUECOLOR ? turn.either.map(measured) : indexed, bounds.get(keyOf(color, segment)) ?? UNBOUNDED);
      };
      const write = (color: ColorRgba, segment: string): ColorRgba => {
        const found = written.get(keyOf(color, segment)) ?? choose(color, segment);
        written.set(keyOf(color, segment), found);
        return found;
      };
      return (shown, cell) => {
        const mine = { fg: own(cell.terminal.fg, shown.fg), bg: own(cell.terminal.bg, shown.bg) };
        const turn = (color: ColorRgba, ours: boolean, other: ColorRgba, theirs: boolean): ColorRgba => (ours ? write(color, segmentOf(color, other, theirs)) : color);
        return { ...shown, fg: turn(shown.fg, mine.fg, shown.bg, mine.bg), bg: turn(shown.bg, mine.bg, shown.fg, mine.fg) };
      };
    });
  });
}

/** A colour turned round the hue circle at its luminance (`hueTurned`). */
interface Turned {
  /** The turned colour, the nearest written stands in for. */
  readonly looks: ColorRgba;
  /** The 8-bit colours of the turned hue either side of the luminance, darker first. */
  readonly either: readonly ColorRgba[];
}

/**
 * `color` turned `degrees` round the hue circle at its own relative
 * luminance, and at its own chroma where the gamut has it. WCAG contrast is
 * a ratio of luminances, so a pair of colours each turned this way reads at
 * the contrast it did; one turned at its OKLCH lightness instead does not,
 * since equal lightness is not equal luminance across hues. The lightness
 * is found by bisection, as `ensureContrastToward` finds one, and 8-bit
 * rounding lands the luminance between two colours, so both are kept. At 0
 * degrees the colour itself, exactly: an OKLCH round trip can land a step
 * off (`touchedAt`).
 */
function hueTurned(color: ColorRgba, degrees: number): Turned {
  if (degrees === 0) return { looks: color, either: [color] };
  const from = Oklch.fromRgba(color);
  const luminance = relativeLuminance(color);
  const at = (l: number): ColorRgba => new Oklch(l, from.c, from.h + degrees, from.alpha).toRgba();
  let [dim, bright] = [0, 1];
  for (let i = 0; i < 24; i++) {
    const mid = (dim + bright) / 2;
    [dim, bright] = relativeLuminance(at(mid)) < luminance ? [mid, bright] : [dim, mid];
  }
  return { looks: at(bright), either: [at(dim), at(bright)] };
}

/**
 * Where a colour sits on WCAG's contrast scale: the log of its contrast with
 * black. Two colours' contrast ratio is `exp` of the gap between their
 * stops, so a contrast to keep is a distance a colour may move.
 */
const stop = (color: ColorRgba): number => Math.log(contrastRatio(color, new ColorRgba(0, 0, 0)));

/** Where a colour's luminance may land, as `stop`: none is bounded until a pair bounds it. */
interface Bounds {
  readonly lo: number;
  readonly hi: number;
}
const UNBOUNDED: Bounds = { lo: -Infinity, hi: Infinity };
/** Bounds that admit no turn: the colour is written as it rests. */
const STILL: Bounds = { lo: Infinity, hi: -Infinity };

/**
 * The widest 8-bit rounding parts `hueTurned`'s two colours, in stops. They
 * are one point of the hue rounded two ways, so they differ by at most a
 * step in each channel, and a channel of a colour that dark or light can
 * take a step only so large: worst near a luminance of 0.05, at 3.03% of
 * contrast. Bounds at least this wide admit one of the two whatever the
 * hue; narrower, a colour would turn at some hues and snap back to rest at
 * the next, so it holds still.
 */
const ROUNDING_GAP = Math.log(1.031);

/**
 * How far each turned colour's luminance may land from the one it rests at,
 * keyed as `turnedAs` keys each side of a pair — none for a side that holds
 * still — so that every pair of `pairs` reads at its floor (`floorOf`) at
 * `depth` however each of its colours lands within its bounds. Bounds
 * narrower than `ROUNDING_GAP` are `STILL`.
 *
 * A pair's contrast to spare above its floor, as a gap between stops, is
 * shared out evenly between its sides that turn: the lighter may land that
 * much darker, the darker that much lighter, and never further. So a colour
 * written once for every pair it is drawn in is bounded by each of them at
 * once, and a frame writes it one way wherever it falls. A pair whose floor
 * is 1:1 holds however it is drawn, and bounds nothing.
 */
function turnedBounds(pairs: readonly Pair[], depth: ColorDepth, turnedAs: (pair: Pair, side: Side) => string | undefined): ReadonlyMap<string, Bounds> {
  const bounds = new Map<string, Bounds>();
  for (const pair of pairs.filter((pair) => floorOf(pair, depth) > 1)) {
    const spare = Math.log(contrastRatio(pair.fg, pair.bg)) - Math.log(floorOf(pair, depth));
    const share = spare / SIDES.filter((side) => turnedAs(pair, side) !== undefined).length;
    for (const side of SIDES) {
      const key = turnedAs(pair, side);
      if (key === undefined) continue;
      const [mine, theirs] = [stop(pair[side]), stop(pair[side === "fg" ? "bg" : "fg"])];
      const { lo, hi } = bounds.get(key) ?? UNBOUNDED;
      bounds.set(key, mine >= theirs ? { lo: Math.max(lo, mine - share), hi } : { lo, hi: Math.min(hi, mine + share) });
    }
  }
  return new Map([...bounds].map(([key, { lo, hi }]) => [key, hi - lo < ROUNDING_GAP ? STILL : { lo, hi }]));
}

/** A colour a turn may be written as, with what `nearestWithin` reads of it. */
interface Measured {
  readonly color: ColorRgba;
  readonly looks: Oklch;
  readonly stop: number;
}
const measured = (color: ColorRgba): Measured => ({ color, looks: Oklch.fromRgba(color), stop: stop(color) });

/** `ColorSpec.indexed`'s colours, measured once for each theme and depth. */
const measuredMemo = new WeakMemo<readonly Measured[], readonly (readonly [ColorSpec, ColorRgba])[]>();
function measuredIndexed(depth: ColorDepth, theme: TerminalTheme): readonly Measured[] {
  return measuredMemo.get(ColorSpec.indexed(depth, theme), (indexed) => indexed.map(([, color]) => measured(color)));
}

/**
 * The colour that looks nearest `color` (OKLab's ΔE): `rest`, or one of
 * `candidates` whose luminance is within `bounds`. `rest` is what the bounds
 * are measured from, so it is always offered; ties go to it, then to the
 * earlier.
 */
function nearestWithin(color: ColorRgba, rest: ColorRgba, candidates: readonly Measured[], { lo, hi }: Bounds): ColorRgba {
  return nearestOf(color, [measured(rest), ...candidates.filter(({ stop }) => stop >= lo && stop <= hi)])!.color;
}

/** Of `offered`, the one that looks nearest `color` (OKLab's ΔE), ties to the earlier; none when nothing is offered. */
function nearestOf(color: ColorRgba, offered: readonly Measured[]): Measured | undefined {
  const looks = Oklch.fromRgba(color);
  let best: [Measured, number] | undefined;
  for (const candidate of offered) {
    const apart = looks.deltaE(candidate.looks);
    if (best === undefined || apart < best[1]) best = [candidate, apart];
  }
  return best?.[0];
}

/** One step of a signal: the ink it draws, and how long it is held, in seconds. */
export interface ColorStep {
  readonly color: ColorRgba;
  readonly seconds: number;
}

/**
 * A signal: every cell's ink stepping through `steps`' colours on a beat,
 * one colour a hold, looping, for the time it is handed — a gauge's
 * chevrons in bright changing colours. The ground is left as the cell draws
 * it, and the words stay legible on it: each step's ink is written as the
 * colour nearest the step's (OKLab's ΔE) that the depth draws and that
 * reads on the cell's ground, as `Effected` writes it, at the cell's floor
 * (`floorOf`) — its resting contrast or `LEGIBLE`, whichever is lower, the
 * floor every loop here keeps. In truecolor that is the step itself, or its
 * hue and chroma at the lightness nearest it that reaches the floor
 * (`ensureContrast`, the one slide a template's `readableOn` makes too);
 * below truecolor, the nearest of the colours the depth has an index for, so on a
 * sixteen-colour terminal it steps from slot to slot, the one effect here
 * that does (`stillOnSlots`). A cell whose ground no offered colour reads
 * on keeps the ink it rested in.
 *
 * The search is settled once for each ground and step — below truecolor,
 * which colours read on a ground once for that ground — so a frame
 * inside a step redoes none, and nor does a later pass of the beat: at sixty
 * frames a second a one-second step is sixty identical frames, and the
 * frame changes when the beat does: the signal is the beat mapped to inks.
 * [LAW:no-ambient-temporal-coupling] The beat is `core/easing.ts`'s, and
 * nothing here reads a clock.
 */
export function steppedInk(steps: readonly ColorStep[]): Effect {
  const rhythm = beat(steps.map((step) => step.seconds));
  // A copy, as `beat` keeps of the holds: what the signal plays stays what
  // `steps` said whatever the caller does to its array.
  const inks = steps.map((step) => step.color);
  const legible = legibleInks();
  return (drawn) => {
    const inkOn = legible(drawn);
    return Animation.map(rhythm, (i): EffectFrame => {
      const step = inks[i]!;
      return (look, cell) => ({ ...look, fg: inkOn(step, look, cell) });
    });
  };
}

/**
 * `legibleInk` for the frame `Drawn` describes, of an ink on a cell's look:
 * settled once for each terminal, depth, pair and ink, so a frame drawing
 * what an earlier one drew redoes no search. [LAW:single-enforcer] Every
 * effect that writes an ink of the caller's choosing writes it through
 * here — `steppedInk`'s steps and `gradient`'s ramp alike — so none of them
 * leaves a word unreadable. Below truecolor which of the depth's colours
 * read on a pair does not depend on the ink, so it is settled once for each
 * pair: a ramp, whose every frame offers inks no frame offered before,
 * then costs a nearest-colour scan a cell, not a contrast test of the whole
 * palette.
 */
function legibleInks(): (drawn: Drawn) => (ink: ColorRgba, look: CellLook, cell: EffectCell) => ColorRgba {
  const settled = new WeakMemo<{ readonly inks: Memo<ColorRgba>; readonly readable: Memo<readonly Measured[]> }, TerminalTheme>();
  return ({ depth, theme }) => {
    const memo = settled.get(theme, () => ({ inks: new Memo(), readable: new Memo() }));
    return (ink, look, cell) => {
      const pair: Pair = { fg: look.fg, bg: look.bg, terminal: cell.terminal, reverse: cell.reverse };
      const key = `${depth} ${pairKey(pair)}`;
      const legibleOf = (offered: readonly Measured[]): readonly Measured[] => legibleAmong(pair, offered, depth, theme);
      return memo.inks.get(`${key} ${ink.hex}`, () => {
        const offered =
          depth === ColorDepth.TRUECOLOR
            ? legibleOf([ink, ensureContrast(ink, pair.bg, floorOf(pair, depth))].map(measured))
            : memo.readable.get(key, () => legibleOf(measuredIndexed(depth, theme)));
        return nearestOf(ink, offered)?.color ?? pair.fg;
      });
    };
  };
}

/**
 * Of `offered`, the colours that read on `pair`'s ground at `pair`'s floor,
 * as `Effected` writes them (`shows`). [LAW:one-source-of-truth] Measured the
 * way `shares` and `wheel` measure: the written colours, at the catalogue's
 * floor. An ink none of them is nearest stays `pair`'s own.
 */
function legibleAmong(pair: Pair, offered: readonly Measured[], depth: ColorDepth, theme: TerminalTheme): readonly Measured[] {
  const floor = floorOf(pair, depth);
  return offered.filter(({ color }) => {
    const shown = Effected.shows(pair, { fg: color, bg: pair.bg }, depth, theme);
    return contrastRatio(shown.fg, shown.bg) >= floor;
  });
}

/**
 * A text attribute turned on and off on a beat: each pass, the cell as its
 * element drew it for `off` seconds, then with `attribute` on for `on`.
 */
export interface Blink {
  readonly attribute: keyof CellAttributes;
  readonly off: number;
  readonly on: number;
}

/**
 * `spec.attribute` blinking: off, the cell as drawn, so that hold's frame is
 * the identity and writes the element's own bytes; on, the attribute set.
 * It changes when its beat does, at a hold's end, and never between.
 * A blink and a bold pulse are this one function at two specs
 * (`ATTRIBUTE_DEFAULTS`) [LAW:one-type-per-behavior].
 */
export function blink({ attribute, off, on }: Blink): Effect {
  const rhythm = beat([off, on]);
  const frames: readonly EffectFrame[] = [(look) => look, (look) => ({ ...look, attributes: { ...look.attributes, [attribute]: true } })];
  return () => Animation.map(rhythm, (i) => frames[i]!);
}

/** The names of the effects that move an attribute. */
export type AttributeLoopName = "blink" | "boldPulse";

/**
 * Each attribute effect's spec: a blink hides the words for half of each
 * second, as a terminal's own blink does, and a bold pulse holds them bold
 * for the last three tenths of each second.
 */
export const ATTRIBUTE_DEFAULTS = {
  blink: { attribute: "conceal", off: 0.5, on: 0.5 },
  boldPulse: { attribute: "bold", off: 0.7, on: 0.3 },
} as const satisfies Readonly<Record<AttributeLoopName, Blink>>;

/**
 * What a catalogue effect is made for: the element it is drawn on, at `z` in
 * the noise, so two elements under one effect drawn from noise do not move in
 * lockstep. An effect on a beat alone (a blink) draws no noise, and keeps
 * every element in step, as a terminal's own blink does. How
 * wide the element is, the effect reads off each frame (`Drawn.cells`).
 */
export interface EffectTarget {
  readonly z: number;
}

/** The names of the effects that loop. */
export type LoopName = "shimmer" | "pulse" | "sparkle" | "wheel";

/** The names of the effects that run once. */
export type TransitionName = "fade" | "dissolve";

/**
 * Every effect in the catalogue by its name in `EFFECT_CURVES`, each made the
 * one way: for an element, at its signed-off curve unless handed another,
 * with the light and the width it was signed off with. A loop comes lit on
 * the element's own colours (`onColors`); a transition comes as itself, to
 * be told when it is done. [LAW:types-are-the-program] Keyed by the two
 * name types, which `EFFECT_CURVES` is held to as well: a curve signed off
 * does not compile until it is named a loop or a transition, and then not
 * until it has an entry here making one. A picker walking a section's names
 * offers an effect added here with no change of its own.
 */
export const EFFECT_CATALOGUE: {
  readonly loops: Readonly<Record<LoopName, (element: EffectTarget, curve?: Curve) => Effect>>;
  readonly transitions: Readonly<Record<TransitionName, (element: EffectTarget, curve?: Curve) => Transition>>;
  readonly attributes: Readonly<Record<AttributeLoopName, (element: EffectTarget) => Effect>>;
} = {
  loops: {
    shimmer: (element, curve = EFFECT_CURVES.shimmer) => onColors(shimmer(curve, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, element.z)),
    pulse: (element, curve = EFFECT_CURVES.pulse) => onColors(pulse(curve, EFFECT_LIGHTS.sun, element.z)),
    sparkle: (element, curve = EFFECT_CURVES.sparkle) => onColors(sparkle(curve, EFFECT_LIGHTS.firefly, element.z)),
    wheel: (element, curve = EFFECT_CURVES.wheel) => wheel(curve, element.z),
  },
  transitions: {
    fade: (element, curve = EFFECT_CURVES.fade) => fadeIn(curve, element.z),
    dissolve: (element, curve = EFFECT_CURVES.dissolve) => dissolveOut(curve, element.z),
  },
  attributes: {
    blink: () => blink(ATTRIBUTE_DEFAULTS.blink),
    boldPulse: () => blink(ATTRIBUTE_DEFAULTS.boldPulse),
  },
};
