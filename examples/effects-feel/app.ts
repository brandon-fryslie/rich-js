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
  ColorSpec,
  Console,
  Effected,
  Group,
  Padding,
  RichText,
  Style,
  contrastRatio,
  frameRate,
  systemClock,
  type Clock,
  type FrameRate,
  type Unsubscribe,
  type Effect,
  type Renderable,
  type RenderOptions,
  Segment,
  type TerminalTheme,
  EFFECT_LIGHTS,
  SHIMMER_WIDTH,
  dissolveOut,
  fadeIn,
  pulse,
  shimmer,
  sparkle,
  wheel,
  type Curve,
  type Loop,
  type Transition,
} from "../../src/index.js";
import { App, hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import { STEP, depthDrawn, type EffectName } from "./vocabulary.js";
import type { NamedCurve, Settings } from "./settings.js";
import { cellsOf, drawnSubject, fills, paletteRgba, pulsedOn, shown, stripSubject, subjectUnder, textSubject, type DrawnSubject, type Subject } from "./subjects.js";

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

/** How far the rate keys scale `STEP`, ×2 a press. */
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

/**
 * How a looping effect's worst contrast is measured: over this many of its
 * periods — no loop repeats exactly, so one period is only a slice of the
 * states it reaches — at this many samples each.
 */
const CONTRAST = { periods: 8, samples: 60 } as const;

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
