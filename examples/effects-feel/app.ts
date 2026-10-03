/**
 * effects-feel — the demo body: a powerline strip and a run of text under
 * each effect, redrawn at the frame rate the run was given.
 *
 * THIS IS A DEMO, built so the feel of each effect can be agreed before any
 * curve lands in `src/`. See `curves.ts`.
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
  POWERLINE_JOINER_GLYPHS,
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
  type Measurable,
  type Renderable,
  type RenderOptions,
  Segment,
  type TerminalTheme,
} from "../../src/index.js";
import { graphemes } from "../../src/core/cells.js";
import { App, hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import { dissolveOut, drift, fadeIn, onColors, pulse, settledAt, shares, shimmer, sparkle, type Loop, type Pair } from "./curves.js";
import { depthDrawn, type EffectName, type NamedCurve, type Settings } from "./settings.js";

/**
 * The bundled themes a run can be drawn in, in the order the theme keys walk
 * them. A run starts on the first of its ground.
 */
const THEMES: readonly TerminalTheme[] = [
  CATPPUCCIN_MOCHA, CATPPUCCIN_LATTE, CATPPUCCIN_MACCHIATO, CATPPUCCIN_FRAPPE,
  TOKYO_NIGHT, NORD, DRACULA, GRUVBOX, MONOKAI, ROSE_PINE, ROSE_PINE_MOON, ROSE_PINE_DAWN,
  SOLARIZED_DARK, SOLARIZED_LIGHT, ATOM_ONE_DARK, ATOM_ONE_LIGHT, FLEXOKI, CYBERPUNK,
];

/** The frame rates the fps keys step through, slowest first. */
const FPS_STEPS = [0.5, 1, 2, 5, 10, 15, 30] as const;

/**
 * How much of a loop's designed time one frame moves it at rate ×1. The
 * curves are tuned so that one designed second steps a colour by at most the
 * one-frame-a-second bar, and a frame that steps the whole bar reads as a
 * step; a quarter of it reads as motion. So the pace is set a frame at a
 * time — what a frame rate then sets is how fast those frames come — and the
 * rate keys scale it, ×2 a press, within `RATE_RANGE`.
 */
const SECONDS_A_FRAME = 0.25;
const RATE_RANGE = [1 / 8, 16] as const;

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

/** How far a shimmer's light reaches either side of its centre, in columns. */
export const SHIMMER_WIDTH = 24;

/**
 * How a looping effect's worst contrast is measured: over this many of its
 * periods — no loop repeats exactly, so one period is only a slice of the
 * states it reaches — at this many samples each.
 */
const CONTRAST = { periods: 8, samples: 60 } as const;

/** The lights the loops cast, warm as sunlight, breath and fireflies are. */
export const LIGHTS = {
  sun: new ColorRgba(255, 228, 176),
  firefly: new ColorRgba(222, 245, 140),
} as const satisfies Record<string, ColorRgba>;

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
 * theme resolving the rest, and which of the two the cell itself sets.
 */
function shown(cell: Cell, options: RenderOptions, theme: TerminalTheme): { fg: ColorRgba; bg: ColorRgba; set: ColorRgba[] } {
  const drawn = cell.style.drawnColors(options.colorSystem ?? undefined);
  const fg = (drawn.color ?? DEFAULT).getTruecolor(theme, true);
  const bg = (drawn.bgcolor ?? DEFAULT).getTruecolor(theme, false);
  return { fg, bg, set: [...(drawn.color === undefined ? [] : [fg]), ...(drawn.bgcolor === undefined ? [] : [bg])] };
}

/** The glyphs a joiner draws between cells: colour seams, not text. */
const SEAM_GLYPHS: ReadonlySet<string> = new Set(Object.values(POWERLINE_JOINER_GLYPHS));

export function drawnSubject(subject: Subject, drawnWith: RenderOptions, theme: TerminalTheme): DrawnSubject {
  const span = Measurement.get({ ...drawnWith, maxWidth: Number.MAX_SAFE_INTEGER }, subject.renderable).maximum;
  const options = { ...drawnWith, maxWidth: span };
  // A seam sits in the same cell whichever glyph a joiner draws it with, so
  // the cells are read where the glyphs are the ones `SEAM_GLYPHS` names.
  const text = new Set(
    cellsOf(subject.renderable.render({ ...options, asciiOnly: false }))
      .filter((cell) => cell.glyph.trim() !== "" && !SEAM_GLYPHS.has(cell.glyph))
      .map((cell) => cell.at),
  );
  // A colour the cell leaves to the terminal is no colour of the subject's.
  const drawn = cellsOf(subject.renderable.render(options))
    .filter((cell) => text.has(cell.at))
    .map((cell) => shown(cell, options, theme));
  const colors = new Set(drawn.flatMap(({ set }) => set.map((color) => color.hex)));
  const pairs = [...new Map(drawn.map(({ fg, bg }): [string, Pair] => [`${fg.hex}/${bg.hex}`, [fg, bg]])).values()];
  return { ...subject, options, span, colors, pairs, text };
}

/** A colour of the theme's palette by its name; a name the palette lacks is a bug here. */
function paletteRgba(theme: TerminalTheme, key: string): ColorRgba {
  const rgba = theme.palette.get(key);
  if (rgba === undefined) throw new Error(`theme ${theme.palette.name} has no palette colour ${key}`);
  return rgba;
}

/** A powerline strip of a dozen cells over the theme's palette. */
export function stripSubject(theme: TerminalTheme): Subject {
  const color = (key: string): ColorSpec => ColorSpec.fromRgba(paletteRgba(theme, key));
  const cells = STRIP_LABELS.map((label, i) => {
    const key = STRIP_KEYS[i % STRIP_KEYS.length]!;
    // The second lap round the palette takes each colour's muted shade, so a
    // dozen neighbours are a dozen colours.
    const lap = Math.floor(i / STRIP_KEYS.length);
    const style = lap === 0
      ? Style.fromColor(color(`on-${key}`), color(key))
      : Style.fromColor(color("foreground"), color(`${key}-muted`));
    return new RichText(` ${label} `, { style, end: "", noWrap: true });
  });
  return { name: "strip", renderable: new Strip(cells, new PowerlineJoiner()), z: 0 };
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

const LOOPS = ["shimmer", "pulse", "drift", "sparkle"] as const;
type LoopName = (typeof LOOPS)[number];

/**
 * `loop` on `subject`'s own colours, each at the share of it its cells can
 * spare. Shares are settled on the colours as the run's depth draws them:
 * at 256 colours a touched colour lands on the cube, and the contrast it
 * spends is the cube colour's.
 */
export function subjectUnder(subject: DrawnSubject, loop: Loop, theme: TerminalTheme): Effect {
  const depth = subject.options.colorSystem ?? ColorDepth.TRUECOLOR;
  const asDrawn = (color: ColorRgba, w: number): ColorRgba =>
    ColorSpec.fromRgba(loop.touch(color, w)).downgrade(depth).getTruecolor(theme);
  return onColors(shares(subject.pairs, subject.colors, asDrawn), loop);
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
}

function scene(theme: TerminalTheme, drawnWith: RenderOptions, curves: Settings["curves"]): Scene {
  const ink = ColorSpec.fromRgba(theme.foregroundColor);
  const paper = ColorSpec.fromRgba(theme.backgroundColor);
  const quiet = Style.fromColor(ColorSpec.fromRgba(paletteRgba(theme, "foreground-muted")));
  const heading = Style.fromColor(ink).add(Style.parse("bold"));
  const depth = drawnWith.colorSystem ?? ColorDepth.TRUECOLOR;
  const subjects = [stripSubject(theme), textSubject(theme, depth)].map((s) => drawnSubject(s, drawnWith, theme));

  const made: Record<LoopName, (subject: DrawnSubject) => Loop> = {
    shimmer: (s) => shimmer(curves.shimmer, s.span, SHIMMER_WIDTH, LIGHTS.sun, s.z),
    pulse: (s) => pulse(curves.pulse, s.span, LIGHTS.sun, s.z),
    drift: (s) => drift(curves.drift, s.z),
    sparkle: (s) => sparkle(curves.sparkle, s.span, LIGHTS.firefly, s.z),
  };
  const loops = Object.fromEntries(
    LOOPS.map((name) => {
      const built = new Map(subjects.map((s) => [s, subjectUnder(s, made[name](s), theme)]));
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
  return { theme, ink, paper, quiet, heading, subjects, loops, contrast, measure };
}

/**
 * The demo's own time: the clock's, from the last reset, at `perSecond`
 * demo seconds a clock second — so a change of pace bends the time from
 * that moment and never jumps it — and starting over once a `cycle` has run,
 * so what is seen is one full pass of every loop, then the same again, at
 * whatever pace.
 */
class Pace {
  private perSecond: number;
  // The demo time at the last change of pace, and the clock time then.
  private base = 0;
  private mark: number;

  constructor(clockNow: number, perSecond: number, private readonly cycle: number) {
    this.mark = clockNow;
    this.perSecond = perSecond;
  }

  /** The demo time at `clockNow`, and whether it just started over. */
  at(clockNow: number): { t: number; reset: boolean } {
    const t = this.base + (clockNow - this.mark) * this.perSecond;
    if (t < this.cycle) return { t, reset: false };
    this.base = 0;
    this.mark = clockNow;
    return { t: 0, reset: true };
  }

  /** `at(clockNow)` as a bare time. */
  now(clockNow: number): number {
    return this.at(clockNow).t;
  }

  /** From `clockNow` on, demo time runs at `perSecond` demo seconds a clock second. */
  set(clockNow: number, perSecond: number): void {
    this.base = this.now(clockNow);
    this.mark = clockNow;
    this.perSecond = perSecond;
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
  // its time; the pace turns it into the demo's, and a replay starts at the
  // demo time it was asked at. One cycle is the longest loop's period: by then
  // every loop has shown a full pass and both transitions have settled.
  const clock = systemClock();

  // The scene on show, its contrast measured between the frames: a frame is
  // never held for it, and a theme chosen while the last one was still being
  // measured stops that measurement where it was.
  let at = THEMES.findIndex((theme) => theme.palette.dark === (settings.ground === "dark"));
  let shown: Scene;
  let stopMeasuring: Unsubscribe = () => {};
  const show = (theme: TerminalTheme): void => {
    stopMeasuring();
    shown = scene(theme, drawnWith, curves);
    stopMeasuring = spread(shown.measure(), clock, MEASURE_SLICE);
  };
  show(THEMES[at]!);
  const cycle = Math.max(...LOOPS.map((loop) => curves[loop].seconds), settledAt(curves.fade, 0), settledAt(curves.dissolve, 0));
  let rate = 1;
  let fps: FrameRate = frameRate(settings.fps);
  const secondsAFrame = (): number => SECONDS_A_FRAME * rate;
  const pace = new Pace(clock.now(), secondsAFrame() * fps.perSecond, cycle);
  let fadeStart = 0;
  let dissolveStart = 0;

  const describe = (name: EffectName, curve: NamedCurve): string =>
    `${name.padEnd(9)} ${curve.seconds}s · ${curve.easeName} · swing ${curve.swing}`;

  const transitionStatus = (t: number, curve: NamedCurve, start: number, key: string): string =>
    t >= settledAt(curve, start) ? `done — ${key} replays` : "running";

  const row = (t: number, name: EffectName, status: string, effect: (subject: DrawnSubject) => Effect): Renderable[] => [
    new RichText(`${describe(name, curves[name])}   ${status}`, { style: shown.quiet, noWrap: true }),
    ...shown.subjects.map((s) => new Effected(s.renderable, effect(s), { t, key: seedKey(name, s), theme: shown.theme })),
    new RichText(""),
  ];

  const view = (clockNow: number): Renderable => {
    const { t, reset } = pace.at(clockNow);
    if (reset) fadeStart = dissolveStart = 0;
    const { theme, loops, contrast } = shown;
    return new Padding(
      new Group(
        new RichText(
          `effects feel · ${fps.perSecond} fps · rate ×${rate} (${secondsAFrame()}s a frame) · ${settings.depth} · ${theme.palette.name} (${theme.palette.dark ? "dark" : "light"}) · t=${t.toFixed(1)}s of ${cycle}s`,
          { style: shown.heading, noWrap: true },
        ),
        new RichText("f fade-in · d dissolve · n/p theme · </> fps · -/+ rate · q quits", { style: shown.quiet, noWrap: true }),
        new RichText(""),
        ...LOOPS.flatMap((loop) => row(t, loop, contrast[loop], loops[loop])),
        ...row(t, "fade", transitionStatus(t, curves.fade, fadeStart, "f"), (s) => fadeIn(curves.fade, fadeStart, s.z, theme.backgroundColor)),
        ...row(t, "dissolve", transitionStatus(t, curves.dissolve, dissolveStart, "d"), (s) => dissolveOut(curves.dissolve, dissolveStart, s.z, theme.backgroundColor)),
      ),
      [1, 2],
      { style: Style.fromColor(shown.ink, shown.paper) },
    );
  };

  const app = new App({ host, surface: "alternate", view, clock, rate: fps });
  // The loops never settle, so the demo animates for as long as it runs.
  app.animate();

  // [LAW:dataflow-not-control-flow] Each key is a row in this table; a key
  // not in it does nothing, so a mouse report repaints nothing.
  const replay = (): number => {
    app.refresh();
    return pace.now(clock.now());
  };
  const theme = (step: number): void => {
    at = (at + step + THEMES.length) % THEMES.length;
    show(THEMES[at]!);
    app.refresh();
  };
  const stepFps = (step: number): void => {
    const near = FPS_STEPS.findIndex((f) => f >= fps.perSecond);
    const i = Math.min(Math.max((near === -1 ? FPS_STEPS.length - 1 : near) + step, 0), FPS_STEPS.length - 1);
    fps = frameRate(FPS_STEPS[i]!);
    app.rate = fps;
    pace.set(clock.now(), secondsAFrame() * fps.perSecond);
    app.refresh();
  };
  const scaleRate = (by: number): void => {
    rate = Math.min(Math.max(rate * by, RATE_RANGE[0]), RATE_RANGE[1]);
    pace.set(clock.now(), secondsAFrame() * fps.perSecond);
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
