/**
 * effects-feel — the demo body: a powerline strip and a run of text under
 * each effect, redrawn at the frame rate the run was given.
 *
 * THIS IS A DEMO: the library's effects (`src/renderables/effects.ts`) at
 * any frame rate, colour depth and theme, for judging how they feel.
 *
 * [LAW:no-ambient-temporal-coupling] The `App` is the frame owner: it ticks
 * at the run's frame rate and hands each frame its `t`; a `Pace` turns that
 * into the demo's own time, which runs at a rate the keys set and starts over
 * after one cycle of every loop; and the view is a function of that time, the
 * scene the keys chose, and the two transition start times. Every effect
 * below is sampled at whatever time it is handed, so 30 frames a second and
 * one every two seconds run the same code.
 *
 * [LAW:dataflow-not-control-flow] The host is a value: the demo never asks
 * which terminal it is on, and the colour depth it is judged at arrives as
 * that host's environment.
 */

import {
  ATOM_ONE_DARK,
  ATOM_ONE_LIGHT,
  CATPPUCCIN_FRAPPE,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MACCHIATO,
  CATPPUCCIN_MOCHA,
  CYBERPUNK,
  ColorDepth,
  DRACULA,
  FLEXOKI,
  GRUVBOX,
  MONOKAI,
  NORD,
  ROSE_PINE,
  ROSE_PINE_DAWN,
  ROSE_PINE_MOON,
  SOLARIZED_DARK,
  SOLARIZED_LIGHT,
  TOKYO_NIGHT,
  ColorRgba,
  ColorSpec,
  Console,
  ensureContrast,
  Effected,
  Group,
  Measurement,
  Padding,
  PowerlineJoiner,
  cellLen,
  RichText,
  Strip,
  Style,
  contrastRatio,
  frameRate,
  systemClock,
  type Clock,
  type FrameRate,
  type Unsubscribe,
  type Effect,
  type Joiner,
  type Measurable,
  type StyledRenderable,
  type Renderable,
  type RenderOptions,
  Segment,
  graphemes,
  type TerminalTheme,
  EFFECT_LIGHTS,
  SHIMMER_WIDTH,
  dissolveOut,
  fadeIn,
  onColors,
  pulse,
  shares,
  shimmer,
  sparkle,
  wheel,
  type Curve,
  type Loop,
  type Pair,
  type Transition,
} from "../../src/index.js";
import { App, hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import { depthDrawn, type EffectName } from "./vocabulary.js";
import type { NamedCurve, Settings } from "./settings.js";

/**
 * The bundled themes a run can be drawn in, in the order the theme keys walk
 * them. A run starts on the first of its ground.
 */
export const THEMES: readonly TerminalTheme[] = [
  CATPPUCCIN_MOCHA, CATPPUCCIN_LATTE, CATPPUCCIN_MACCHIATO, CATPPUCCIN_FRAPPE,
  TOKYO_NIGHT, NORD, DRACULA, GRUVBOX, MONOKAI, ROSE_PINE, ROSE_PINE_MOON, ROSE_PINE_DAWN,
  SOLARIZED_DARK, SOLARIZED_LIGHT, ATOM_ONE_DARK, ATOM_ONE_LIGHT, FLEXOKI, CYBERPUNK,
];

const LOOPS = ["shimmer", "pulse", "sparkle", "wheel"] as const;
type LoopName = (typeof LOOPS)[number];

/** The frame rates the fps keys step through, slowest first. */
const FPS_STEPS = [0.5, 1, 2, 5, 10, 15, 30] as const;

/**
 * How much of a loop's designed time one frame moves it at rate ×1. A frame
 * is the unit of change: every frame moves every loop by this, whatever the
 * frame rate, which only sets how often a frame comes. The curves are tuned
 * so that one designed second steps a colour by at most the one-frame-a-
 * second bar, and a frame that steps the whole bar reads as a step; a
 * quarter of it reads as motion. The rate keys scale it, ×2 a press, within
 * `RATE_RANGE`.
 */
export const STEP = 0.25;
const RATE_RANGE = [1 / 8, 16] as const;

/**
 * How far the magnitude keys scale every loop's swing — the flags' swing is
 * ×1 — a quarter a press, within these. A swing that is a mix toward a light
 * stops at 1, the light itself.
 */
const MAGNITUDE = { step: 0.25, range: [0.25, 4] } as const;

/** A loop's `curve` with its swing at `magnitude` times its own. */
export function magnified<C extends Curve>(curve: C, magnitude: number): C {
  return { ...curve, swing: Math.min(1, curve.swing * magnitude) };
}

/** `curves` with every loop's swing at `magnitude` times the flags'. */
function magnifiedLoops(curves: Settings["curves"], magnitude: number): Settings["curves"] {
  return { ...curves, ...Object.fromEntries(LOOPS.map((loop) => [loop, magnified(curves[loop], magnitude)])) };
}

/** How long a slice of contrast measuring may hold the event loop, in seconds: well inside a frame at 30 fps. */
const MEASURE_SLICE = 0.008;

const STRIP_LABELS = [
  "main", "+3 ~2", "claude.ai", "opus", "3.4k tok", "12%",
  "$0.42", "ctx 61%", "rich-js", "effects", "14:02", "ok",
];
const STRIP_KEYS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;

const TEXT = "Thinking about how a band of light should cross these words at one frame a second…";

/** The status line's contrast against the ground: WCAG's AAA for body text. */
const STATUS_CONTRAST = 7;

/**
 * How a looping effect's worst contrast is measured: over this many of its
 * periods — no loop repeats exactly, so one period is only a slice of the
 * states it reaches — at this many samples each.
 */
const CONTRAST = { periods: 8, samples: 60 } as const;

/**
 * A thing the effects are tried on: a powerline strip, which sets its cells'
 * fill and lettering, or a run of text, which sets only its ink.
 */
export interface Subject {
  readonly name: string;
  readonly renderable: Renderable & Measurable;
  /** Where it sits in the noise, so two subjects under one effect never move in lockstep. */
  readonly z: number;
}

/**
 * A subject as a run draws it, measured once at startup and read by every
 * frame: whole, at its own width whatever the terminal's — a sweep crosses
 * the element, not the screen — and at the run's depth.
 */
export interface DrawnSubject extends Subject {
  readonly options: RenderOptions;
  /** Its width in columns. */
  readonly span: number;
  /** The colours it sets in the cells it draws text in, by hex, as the screen shows them. */
  readonly colors: ReadonlySet<string>;
  /** Every distinct ink and ground of a cell it draws text in, as the screen shows them. */
  readonly pairs: readonly Pair[];
  /** `row:col` of every cell it draws text in. */
  readonly text: ReadonlySet<string>;
}

/** A cell of finished output: where it is, its glyph, and the style it is drawn with. */
interface Cell {
  readonly at: string;
  readonly glyph: string;
  readonly style: Style;
}

/**
 * Finished output cell by cell. [LAW:one-source-of-truth] It walks graphemes
 * by `graphemes()`, as `Effected` does, so a position here is the one an
 * effect was handed.
 */
function cellsOf(segments: Iterable<Segment>): Cell[] {
  const cells: Cell[] = [];
  let row = 0;
  let col = 0;
  for (const segment of segments) {
    if (segment.isControl) continue;
    for (const glyph of graphemes(segment.text)) {
      if (glyph === "\n") {
        row++;
        col = 0;
        continue;
      }
      cells.push({ at: `${row}:${col}`, glyph, style: segment.style ?? Style.null() });
      col += cellLen(glyph);
    }
  }
  return cells;
}

const DEFAULT = ColorSpec.default();

/**
 * A cell's ink and ground as the wire draws them at `options`' depth, the
 * theme resolving the rest, and which of the two are the terminal's.
 */
function shown(cell: Cell, options: RenderOptions, theme: TerminalTheme): Pair {
  const drawn = cell.style.drawnColors(options.colorSystem ?? undefined);
  return {
    fg: (drawn.color ?? DEFAULT).getTruecolor(theme, true),
    bg: (drawn.bgcolor ?? DEFAULT).getTruecolor(theme, false),
    terminal: { fg: drawn.color?.isDefault ?? true, bg: drawn.bgcolor?.isDefault ?? true },
  };
}

/**
 * The owner stamped on every cell a joiner draws between a strip's cells: a
 * colour seam, not text. A seam is told by what drew it, not by its glyph — an
 * ASCII joiner draws other glyphs, and its lead draws none, so every cell
 * after it sits a column left of where a glyph render has it.
 */
const SEAM = Object.freeze({ name: "seam" });

/** `joiner`, every seam it draws stamped as `SEAM`'s. */
function seamed<T extends StyledRenderable>(joiner: Joiner<T>): Joiner<T> {
  return {
    join(left, right) {
      const seam = joiner.join(left, right);
      return { render: (options) => Segment.anchorLines([[...seam.render(options)]], SEAM)[0]! };
    },
  };
}

/** Whether `owner` drew the cell, at any depth of its nesting. */
function drawnBy(cell: Cell, owner: object): boolean {
  for (let anchor = cell.style.anchor; anchor; anchor = anchor.inner) if (anchor.owner === owner) return true;
  return false;
}

export function drawnSubject(subject: Subject, drawnWith: RenderOptions, theme: TerminalTheme): DrawnSubject {
  const span = Measurement.get({ ...drawnWith, maxWidth: Number.MAX_SAFE_INTEGER }, subject.renderable).maximum;
  const options = { ...drawnWith, maxWidth: span };
  const lettered = cellsOf(subject.renderable.render(options)).filter((cell) => cell.glyph.trim() !== "" && !drawnBy(cell, SEAM));
  const text = new Set(lettered.map((cell) => cell.at));
  // A colour the cell leaves to the terminal is no colour of the subject's.
  const drawn = lettered.map((cell) => shown(cell, options, theme));
  const colors = new Set(drawn.flatMap(({ fg, bg, terminal }) => [...(terminal.fg ? [] : [fg.hex]), ...(terminal.bg ? [] : [bg.hex])]));
  const pairs = [...new Map(drawn.map((pair): [string, Pair] => [`${pair.fg.hex}/${pair.bg.hex}/${pair.terminal.fg}/${pair.terminal.bg}`, pair])).values()];
  return { ...subject, options, span, colors, pairs, text };
}

/** A colour of the theme's palette by its name; a name the palette lacks is a bug here. */
function paletteRgba(theme: TerminalTheme, key: string): ColorRgba {
  const rgba = theme.palette.get(key);
  if (rgba === undefined) throw new Error(`theme ${theme.palette.name} has no palette colour ${key}`);
  return rgba;
}

/**
 * The style of the strip's `i`th cell. The second lap round the palette takes
 * each colour's muted shade, so a dozen neighbours are a dozen colours.
 */
function stripStyle(theme: TerminalTheme, i: number): Style {
  const color = (key: string): ColorSpec => ColorSpec.fromRgba(paletteRgba(theme, key));
  const key = STRIP_KEYS[i % STRIP_KEYS.length]!;
  return Math.floor(i / STRIP_KEYS.length) === 0
    ? Style.fromColor(color(`on-${key}`), color(key))
    : Style.fromColor(color("foreground"), color(`${key}-muted`));
}

/**
 * The elements the pulse is for, by the subject they are in and the labels of
 * the cells they are: the rest of the screen does not breathe.
 */
const PULSED: Readonly<Record<string, readonly string[]>> = { strip: ["ctx 61%", "ok"] };

/** A powerline strip of a dozen cells over the theme's palette. */
export function stripSubject(theme: TerminalTheme): Subject {
  const cells = STRIP_LABELS.map((label, i) => new RichText(` ${label} `, { style: stripStyle(theme, i), end: "", noWrap: true }));
  return { name: "strip", renderable: new Strip(cells, seamed(new PowerlineJoiner())), z: 0 };
}

/**
 * A status line, drawn dim as a "thinking" line is — the theme's muted ink,
 * lifted only as far as it must to read at `STATUS_CONTRAST` at `depth` —
 * which on a dark ground leaves the light room to lift it.
 */
export function textSubject(theme: TerminalTheme, depth: ColorDepth): Subject {
  const ink = ensureContrast(paletteRgba(theme, "foreground-muted"), theme.backgroundColor, STATUS_CONTRAST, depth, undefined, theme);
  const style = Style.fromColor(ColorSpec.fromRgba(ink));
  return { name: "text", renderable: new RichText(TEXT, { style, noWrap: true }), z: 11.3 };
}

/** An element's name for `Effected`. No curve here reads a cell's seed: a subject's `z` keeps it apart. */
const seedKey = (effect: EffectName, subject: Subject): string => `${effect}:${subject.name}`;

/** `CONTRAST.samples` moments a period, evenly across `CONTRAST.periods` periods of `seconds`. */
function sampled(seconds: number): number[] {
  return Array.from({ length: CONTRAST.periods * CONTRAST.samples }, (_, i) => (i / CONTRAST.samples) * seconds);
}

/**
 * The worst contrast between text and its ground over every frame `draw`
 * makes at each of `times`, read off the drawn cells as the wire writes them.
 * Yields after each frame, so a caller can spread the hundreds of frames a
 * loop is measured over across its own frames instead of holding one.
 */
function* worstContrast(
  subjects: readonly DrawnSubject[],
  draw: (subject: DrawnSubject, t: number) => Iterable<Segment>,
  times: readonly number[],
  theme: TerminalTheme,
): Generator<void, number> {
  let worst = Number.POSITIVE_INFINITY;
  for (const subject of subjects) {
    for (const t of times) {
      for (const cell of cellsOf(draw(subject, t))) {
        const { fg, bg } = shown(cell, subject.options, theme);
        worst = subject.text.has(cell.at) ? Math.min(worst, contrastRatio(fg, bg)) : worst;
      }
      yield;
    }
  }
  return worst;
}

/** `steps` run to its end, a slice of `budget` seconds on `clock` at a time, between the frames. */
function spread(steps: Generator<void>, clock: Clock, budget: number): Unsubscribe {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const slice = (): void => {
    const until = clock.now() + budget;
    while (clock.now() < until) if (steps.next().done) return;
    timer = setTimeout(slice);
  };
  slice();
  return () => clearTimeout(timer);
}

/**
 * `loop` on `subject`'s own colours, each at the share of it its cells can
 * spare. Shares are settled on the colours as the run's depth draws them:
 * at 256 colours a touched colour lands on the cube, and the contrast it
 * spends is the cube colour's. Only `colors` — the subject's own, unless an
 * element of it is chosen — are touched.
 */
export function subjectUnder(subject: DrawnSubject, loop: Loop, theme: TerminalTheme, colors: ReadonlySet<string> = subject.colors): Effect {
  const depth = subject.options.colorSystem ?? ColorDepth.TRUECOLOR;
  const asDrawn = (color: ColorRgba, w: number): ColorRgba =>
    ColorSpec.fromRgba(loop.touch(color, w)).downgrade(depth).getTruecolor(theme);
  return onColors(shares(subject.pairs, colors, asDrawn), loop);
}

/** The fills of `subject`: the colours it sets that are the ground of a cell it draws text in. */
export function fills(subject: DrawnSubject): ReadonlySet<string> {
  return new Set(subject.pairs.flatMap(({ bg, terminal }) => (terminal.bg ? [] : [bg.hex])));
}

/**
 * A pulse breathing the elements chosen for `subject` (`PULSED`), each its
 * own `pulseAt(z)`, at a `z` of its own so each keeps a time of its own, on
 * the fill the screen draws them with; a subject with none chosen is left be.
 */
export function pulsedOn(subject: DrawnSubject, pulseAt: (z: number) => Loop, theme: TerminalTheme): Effect {
  const effects = (PULSED[subject.name] ?? []).map((label, n) => {
    const fill = stripStyle(theme, STRIP_LABELS.indexOf(label)).drawnColors(subject.options.colorSystem ?? undefined).bgcolor!;
    return subjectUnder(subject, pulseAt(subject.z + 3.7 * (n + 1)), theme, new Set([fill.getTruecolor(theme, false).hex]));
  });
  return (colors, cell, t) => effects.reduce((moved, effect) => effect(moved, cell, t), colors);
}

/**
 * Everything a theme decides: the subjects drawn in it, each loop settled on
 * their colours, the contrast each loop was measured at, and the styles of
 * the lines around them. Built once per theme, since settling the shares is
 * costly, and read by every frame until the keys choose another theme.
 * Measuring the contrast costs more still — hundreds of frames a loop — so
 * `contrast` says it is being measured until `measure`, run between the
 * frames, has filled each loop's line in.
 */
interface Scene {
  readonly theme: TerminalTheme;
  readonly ink: ColorSpec;
  readonly paper: ColorSpec;
  readonly quiet: Style;
  readonly heading: Style;
  readonly subjects: readonly DrawnSubject[];
  readonly loops: Record<LoopName, (subject: DrawnSubject) => Effect>;
  readonly contrast: Record<LoopName, string>;
  readonly measure: () => Generator<void>;
  /** The curves it was built with: the flags', at the magnitude on show. */
  readonly curves: Settings["curves"];
}

function scene(theme: TerminalTheme, drawnWith: RenderOptions, curves: Settings["curves"]): Scene {
  const ink = ColorSpec.fromRgba(theme.foregroundColor);
  const paper = ColorSpec.fromRgba(theme.backgroundColor);
  const quiet = Style.fromColor(ColorSpec.fromRgba(paletteRgba(theme, "foreground-muted")));
  const heading = Style.fromColor(ink).add(Style.parse("bold"));
  const depth = drawnWith.colorSystem ?? ColorDepth.TRUECOLOR;
  const subjects = [stripSubject(theme), textSubject(theme, depth)].map((s) => drawnSubject(s, drawnWith, theme));

  // A loop that lights is settled on the subject's colours at the share each
  // can spare; the wheel keeps lightness and chroma, so it is tried as it is.
  const lit = (s: DrawnSubject, loop: Loop): Effect => subjectUnder(s, loop, theme);
  const made: Record<LoopName, (subject: DrawnSubject) => Effect> = {
    shimmer: (s) => lit(s, shimmer(curves.shimmer, s.span, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, s.z)),
    pulse: (s) => pulsedOn(s, (z) => pulse(curves.pulse, EFFECT_LIGHTS.sun, z), theme),
    sparkle: (s) => lit(s, sparkle(curves.sparkle, s.span, EFFECT_LIGHTS.firefly, s.z)),
    wheel: (s) => wheel(curves.wheel, s.colors, fills(s), s.z),
  };
  const loops = Object.fromEntries(
    LOOPS.map((name) => {
      const built = new Map(subjects.map((s) => [s, made[name](s)]));
      return [name, (s: DrawnSubject) => built.get(s)!];
    }),
  ) as Record<LoopName, (subject: DrawnSubject) => Effect>;

  // With no colour drawn there is no contrast to read: every effect is the
  // identity, and every cell is the terminal's own ink on its own ground.
  const none = drawnWith.colorSystem === null;
  const contrast = Object.fromEntries(LOOPS.map((loop) => [loop, none ? "no colour drawn" : "measuring contrast…"])) as Record<LoopName, string>;
  const ratio = (r: number): string => `${r.toFixed(2)}:1`;
  function* measure(): Generator<void> {
    if (none) return;
    const rest = ratio(yield* worstContrast(subjects, (s) => s.renderable.render(s.options), [0], theme));
    for (const loop of LOOPS) {
      const under = (s: DrawnSubject, at: number) =>
        new Effected(s.renderable, loops[loop](s), { t: at, key: seedKey(loop, s), theme }).render(s.options);
      const worst = yield* worstContrast(subjects, under, sampled(curves[loop].seconds), theme);
      contrast[loop] = `worst contrast ${ratio(worst)} over ${CONTRAST.periods * curves[loop].seconds}s (at rest ${rest})`;
    }
  }
  return { theme, ink, paper, quiet, heading, subjects, loops, contrast, measure, curves };
}

/**
 * A clock that counts frames: `now()` is how many ticks have fired, so a
 * view handed it is handed its frame number, and a repaint between ticks —
 * a key's — is handed the same one again. The ticks come from `clock`.
 */
function frameClock(clock: Clock): Clock {
  let frames = 0;
  return {
    now: () => frames,
    every: (rate, tick) =>
      clock.every(rate, () => {
        frames += 1;
        tick();
      }),
  };
}

/**
 * The demo's own time: `step` designed seconds a frame — so a change of
 * step bends the time from that frame and never jumps it — running on
 * without end, since no loop ever comes back round and a time wound back
 * would jump every one of them. What comes round is the `cycle`: one full
 * pass of every loop, counted so the transitions can replay at each.
 */
class Pace {
  private step: number;
  // The demo time at the last change of step, and the frame then.
  private base = 0;
  private mark: number;
  // Every step the pace has had, so the frame a cycle began on is known even
  // when the step has changed since.
  private readonly past: { base: number; mark: number; step: number }[] = [];

  constructor(frame: number, step: number, private readonly cycle: number) {
    this.mark = frame;
    this.step = step;
  }

  /** The frames since the cycle `at(frame)` is in began, whatever steps it was run at. */
  framesIn(frame: number): number {
    const { began } = this.at(frame);
    const segments = [...this.past, { base: this.base, mark: this.mark, step: this.step }];
    const into = [...segments].reverse().find((s) => s.base <= began) ?? segments[0]!;
    return frame - Math.round(into.mark + (began - into.base) / into.step);
  }

  /** The demo time at `frame`, which cycle it is in (from 0), and when that cycle began. */
  at(frame: number): { t: number; cycle: number; began: number } {
    const t = this.base + (frame - this.mark) * this.step;
    const cycle = Math.floor(t / this.cycle);
    return { t, cycle, began: cycle * this.cycle };
  }

  /** `at(frame)` as a bare time. */
  now(frame: number): number {
    return this.at(frame).t;
  }

  /** How many frames one cycle takes at the current step. */
  get frames(): number {
    return Math.ceil(this.cycle / this.step);
  }

  /** From `frame` on, each frame moves demo time by `step`. */
  set(frame: number, step: number): void {
    this.past.push({ base: this.base, mark: this.mark, step: this.step });
    this.base = this.now(frame);
    this.mark = frame;
    this.step = step;
  }
}

export interface DemoHandle {
  /** Resolves once the demo has stopped and handed the terminal back. */
  readonly done: Promise<void>;
}

export function runDemo(host: TerminalHost, settings: Settings): DemoHandle {
  // What the frames are drawn with, asked of the host the app paints on.
  const drawnWith = new Console({ environment: hostEnvironment(host) }).options;
  // [LAW:no-silent-failure] A run judged at one depth and drawn at another is
  // a run judged on nothing; the heading names `settings.depth` because this
  // is what makes it true. (The first sign-off ran at 16 colours this way.)
  const resolved = drawnWith.colorSystem;
  if (resolved !== depthDrawn(settings.depth)) {
    const name = resolved === null ? "none" : resolved === undefined ? "nothing" : ColorDepth[resolved];
    throw new Error(`asked for ${settings.depth} but the terminal resolved ${name}`);
  }
  const { curves } = settings;

  // [LAW:no-ambient-temporal-coupling] The app owns the frames and hands each
  // its number; the pace turns it into the demo's time, and a replay starts
  // at the demo time it was asked at. One cycle is the longest loop's period:
  // by then every loop has shown a full pass and both transitions have
  // settled. The system clock is read for one thing only: how long a slice
  // of contrast measuring has held the event loop.
  const clock = systemClock();
  const frames = frameClock(clock);

  // The scene on show — a theme at a magnitude — its contrast measured
  // between the frames: a frame is never held for it, and a scene chosen
  // while the last one was still being measured stops that measurement
  // where it was.
  let at = THEMES.findIndex((theme) => theme.palette.dark === (settings.ground === "dark"));
  let magnitude = 1;
  let shown: Scene;
  let stopMeasuring: Unsubscribe = () => {};
  const show = (): void => {
    stopMeasuring();
    shown = scene(THEMES[at]!, drawnWith, magnifiedLoops(curves, magnitude));
    stopMeasuring = spread(shown.measure(), clock, MEASURE_SLICE);
  };
  show();
  const cycle = Math.max(...LOOPS.map((loop) => curves[loop].seconds), curves.fade.seconds, curves.dissolve.seconds);
  let rate = 1;
  let fps: FrameRate = frameRate(settings.fps);
  const pace = new Pace(frames.now(), STEP * rate, cycle);
  let fadeStart = 0;
  let dissolveStart = 0;

  const describe = (name: EffectName, curve: NamedCurve): string =>
    `${name.padEnd(9)} ${curve.seconds}s · ${curve.easeName} · swing ${curve.swing}`;

  const row = (t: number, name: EffectName, status: string, effect: (subject: DrawnSubject) => Effect): Renderable[] => [
    new RichText(`${describe(name, shown.curves[name])}   ${status}`, { style: shown.quiet, noWrap: true }),
    ...shown.subjects.map((s) => new Effected(s.renderable, effect(s), { t, key: seedKey(name, s), theme: shown.theme })),
    new RichText(""),
  ];

  /** A transition's row: each subject under its own, running until every one of them is done. */
  const transitionRow = (t: number, name: EffectName, key: string, make: (subject: DrawnSubject) => Transition): Renderable[] => {
    const made = new Map(shown.subjects.map((s) => [s, make(s)]));
    const status = [...made.values()].every((transition) => transition.done(t)) ? `done — ${key} replays` : "running";
    return row(t, name, status, (s) => made.get(s)!.effect);
  };

  let replayed = 0;
  const view = (frame: number): Renderable => {
    const { t, cycle: nth, began } = pace.at(frame);
    // A new cycle: both transitions run again from its start.
    if (began > replayed) fadeStart = dissolveStart = replayed = began;
    const { theme, loops, contrast } = shown;
    return new Padding(
      new Group(
        new RichText(
          `effects feel · ${fps.perSecond} fps · rate ×${rate} · magnitude ×${magnitude} · ${settings.depth} · ${theme.palette.name} (${theme.palette.dark ? "dark" : "light"}) · cycle ${nth + 1} · frame ${pace.framesIn(frame)} of ${pace.frames}`,
          { style: shown.heading, noWrap: true },
        ),
        new RichText("f fade-in · d dissolve · n/p theme · </> fps · -/+ rate · [/] magnitude · q quits", { style: shown.quiet, noWrap: true }),
        new RichText(""),
        ...LOOPS.flatMap((loop) => row(t, loop, contrast[loop], loops[loop])),
        ...transitionRow(t, "fade", "f", (s) => fadeIn(curves.fade, fadeStart, s.z, theme.backgroundColor)),
        ...transitionRow(t, "dissolve", "d", (s) => dissolveOut(curves.dissolve, dissolveStart, s.z, theme.backgroundColor)),
      ),
      [1, 2],
      { style: Style.fromColor(shown.ink, shown.paper) },
    );
  };

  const app = new App({ host, surface: "alternate", view, clock: frames, rate: fps });
  // The loops never settle, so the demo animates for as long as it runs.
  app.animate();

  // [LAW:dataflow-not-control-flow] Each key is a row in this table; a key
  // not in it does nothing, so a mouse report repaints nothing.
  const replay = (): number => {
    app.refresh();
    return pace.now(frames.now());
  };
  const theme = (step: number): void => {
    at = (at + step + THEMES.length) % THEMES.length;
    show();
    app.refresh();
  };
  const magnify = (step: number): void => {
    const next = Math.min(Math.max(magnitude + step * MAGNITUDE.step, MAGNITUDE.range[0]), MAGNITUDE.range[1]);
    if (next === magnitude) return;
    magnitude = next;
    show();
    app.refresh();
  };
  const stepFps = (step: number): void => {
    // The next step beyond the current rate in the direction pressed, so a
    // rate between two steps reaches both of its neighbours.
    const beyond = step > 0 ? FPS_STEPS.find((f) => f > fps.perSecond) : [...FPS_STEPS].reverse().find((f) => f < fps.perSecond);
    if (beyond === undefined) return;
    fps = frameRate(beyond);
    app.rate = fps;
    app.refresh();
  };
  const scaleRate = (by: number): void => {
    rate = Math.min(Math.max(rate * by, RATE_RANGE[0]), RATE_RANGE[1]);
    pace.set(frames.now(), STEP * rate);
    app.refresh();
  };
  const keys: Record<string, () => void> = {
    f: () => (fadeStart = replay()),
    d: () => (dissolveStart = replay()),
    n: () => theme(1),
    p: () => theme(-1),
    ">": () => stepFps(1),
    ".": () => stepFps(1),
    "<": () => stepFps(-1),
    ",": () => stepFps(-1),
    "+": () => scaleRate(2),
    "=": () => scaleRate(2),
    "-": () => scaleRate(0.5),
    "]": () => magnify(1),
    "[": () => magnify(-1),
    q: () => app.stop(),
    "\x03": () => app.stop(),
  };
  const decoder = new TextDecoder();
  const unsubscribe = host.onData((chunk) => {
    try {
      const text = typeof chunk === "string" ? chunk : decoder.decode(chunk);
      for (const key of text) keys[key]?.();
    } catch (error) {
      app.fail(error);
    }
  });

  const done = app.run().finally(() => {
    unsubscribe();
    stopMeasuring();
  });
  return { done };
}
