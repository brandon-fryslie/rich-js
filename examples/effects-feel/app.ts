/**
 * effects-feel — the demo body: a powerline strip and a run of text under
 * each effect, redrawn at the frame rate the run was given.
 *
 * THIS IS A DEMO, built so the feel of each effect can be agreed before any
 * curve lands in `src/`. See `curves.ts`.
 *
 * [LAW:no-ambient-temporal-coupling] This file is the frame owner, and the
 * only reader of the clock: a timer reads it once a frame and stores the
 * frame's `t`, and the view is a pure function of that `t` and the two
 * transition start times. Every effect below is sampled at whatever `t` it is
 * handed, so 30 frames a second and one every two seconds run the same code.
 *
 * [LAW:dataflow-not-control-flow] The host is a value: the demo never asks
 * which terminal it is on, and the colour depth it is judged at arrives as
 * that host's environment.
 */

import {
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MOCHA,
  ColorRgba,
  ColorSpec,
  Console,
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
  type Effect,
  type Renderable,
  type RenderOptions,
  type TerminalTheme,
} from "../../src/index.js";
import { graphemes } from "../../src/core/cells.js";
import { App, hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import {
  dissolveOut,
  drift,
  fadeIn,
  onColors,
  pulse,
  settledAt,
  shimmer,
  sparkle,
  type ColorMove,
} from "./curves.js";
import type { EffectName, NamedCurve, Settings } from "./settings.js";

/** The bundled theme each ground is drawn in: one family, so only the ground differs. */
const THEMES: Record<Settings["ground"], TerminalTheme> = {
  dark: CATPPUCCIN_MOCHA,
  light: CATPPUCCIN_LATTE,
};

const STRIP_LABELS = [
  "main", "+3 ~2", "claude.ai", "opus", "3.4k tok", "12%",
  "$0.42", "ctx 61%", "rich-js", "effects", "14:02", "ok",
];
const STRIP_KEYS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;

const TEXT = "Thinking about how a band of light should cross these words at one frame a second…";

/** How wide a shimmer's band is, in columns. */
const SHIMMER_WIDTH = 8;

/** Samples per period when measuring a looping effect's worst contrast. */
const CONTRAST_SAMPLES = 240;

/**
 * A thing the effects are tried on, and the slot it shows its colour in: a
 * powerline strip in the ground of its cells, a run of text in its ink.
 */
export interface Subject {
  readonly name: string;
  readonly renderable: Renderable;
  readonly slot: "fg" | "bg";
}

/**
 * The colours `subject` sets its slot to, by hex, as the screen shows them at
 * the run's depth. A cell that sets none is drawn in the terminal's own
 * colour, which is no colour of the subject's.
 */
function colorsOf(subject: Subject, options: RenderOptions, theme: TerminalTheme): ReadonlySet<string> {
  const foreground = subject.slot === "fg";
  return new Set(
    [...subject.renderable.render(options)].flatMap((segment) => {
      const drawn = (segment.style ?? Style.null()).drawnColors(options.colorSystem ?? undefined);
      const spec = foreground ? drawn.color : drawn.bgcolor;
      return spec === undefined ? [] : [spec.getTruecolor(theme, foreground).hex];
    }),
  );
}

/** `move` on whatever cells show `subject`'s colour. */
export function onSubject(subject: Subject, move: ColorMove, options: RenderOptions, theme: TerminalTheme): Effect {
  return onColors(colorsOf(subject, options, theme), move);
}

/** A colour of the theme's palette by its name; a name the palette lacks is a bug here. */
function paletteColor(theme: TerminalTheme, key: string): ColorSpec {
  const rgba = theme.palette.get(key);
  if (rgba === undefined) throw new Error(`theme ${theme.palette.name} has no palette colour ${key}`);
  return ColorSpec.fromRgba(rgba);
}

/** A powerline strip of a dozen cells over the theme's palette. */
export function stripSubject(theme: TerminalTheme): Subject {
  const color = (key: string): ColorSpec => paletteColor(theme, key);
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
  return { name: "strip", renderable: new Strip(cells, new PowerlineJoiner()), slot: "bg" };
}

function textSubject(theme: TerminalTheme): Subject {
  const style = Style.fromColor(ColorSpec.fromRgba(theme.foregroundColor));
  return { name: "text", renderable: new RichText(TEXT, { style, noWrap: true }), slot: "fg" };
}

/** The glyphs a joiner draws between cells: colour seams, not text. */
const SEAM_GLYPHS: ReadonlySet<string> = new Set(Object.values(POWERLINE_JOINER_GLYPHS));

/**
 * Where a subject draws text — `row:col` of every glyph that is neither a
 * space nor a joiner's seam — which are the cells whose ink must be read
 * against their ground.
 */
function textCells(subject: Subject, options: RenderOptions): ReadonlySet<string> {
  const cells = new Set<string>();
  let row = 0;
  let col = 0;
  for (const segment of subject.renderable.render(options)) {
    if (segment.isControl) continue;
    // [LAW:one-source-of-truth] The walk `Effected` keys its cells by.
    for (const glyph of graphemes(segment.text)) {
      if (glyph === "\n") {
        row++;
        col = 0;
        continue;
      }
      if (glyph.trim() !== "" && !SEAM_GLYPHS.has(glyph)) cells.add(`${row}:${col}`);
      col += cellLen(glyph);
    }
  }
  return cells;
}

/** `count` moments evenly across one period of `seconds`. */
function sampled(seconds: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i / count) * seconds);
}

/**
 * The worst contrast between text and its ground at each of `times` under
 * `effect`, as the screen shows it at the run's depth; `undefined` when
 * nothing is drawn in colour, which is when no effect runs at all.
 */
function worstContrast(
  subjects: readonly Subject[],
  effect: (subject: Subject) => Effect,
  times: readonly number[],
  optionsFor: (subject: Subject) => RenderOptions,
  theme: TerminalTheme,
): number | undefined {
  let worst = Number.POSITIVE_INFINITY;
  for (const subject of subjects) {
    const options = optionsFor(subject);
    const depth = options.colorSystem;
    const shown = (color: ColorRgba, foreground: boolean): ColorRgba =>
      depth === null || depth === undefined
        ? color
        : ColorSpec.fromRgba(color).downgrade(depth).getTruecolor(theme, foreground);
    const inner = effect(subject);
    const text = textCells(subject, options);
    const recorded: Effect = (colors, cell, t) => {
      const out = inner(colors, cell, t);
      if (text.has(`${cell.row}:${cell.col}`)) {
        worst = Math.min(worst, contrastRatio(shown(out.fg, true), shown(out.bg, false)));
      }
      return out;
    };
    for (const t of times) {
      [...new Effected(subject.renderable, recorded, { t, key: subject.name, theme }).render(options)];
    }
  }
  return Number.isFinite(worst) ? worst : undefined;
}

const LOOPS = ["shimmer", "pulse", "drift", "sparkle"] as const;
type Loop = (typeof LOOPS)[number];

export interface DemoHandle {
  /** Resolves once the demo has stopped and handed the terminal back. */
  readonly done: Promise<void>;
}

export function runDemo(host: TerminalHost, settings: Settings): DemoHandle {
  const theme = THEMES[settings.ground];
  const dark = settings.ground === "dark";
  const ink = ColorSpec.fromRgba(theme.foregroundColor);
  const paper = ColorSpec.fromRgba(theme.backgroundColor);
  const quiet = Style.fromColor(paletteColor(theme, "foreground-muted"));
  const heading = Style.fromColor(ink).add(Style.parse("bold"));
  const subjects = [stripSubject(theme), textSubject(theme)];

  // What the frames are drawn with, asked of the host the app paints on.
  const drawnWith = new Console({ environment: hostEnvironment(host) }).options;
  // Each subject whole, at its own width, whatever the terminal's: a sweep
  // crosses the element, not the screen, so neither its span nor the contrast
  // it reaches depends on how much of it a terminal shows, and nothing here is
  // measured again on a resize.
  const span = (subject: Subject): number =>
    Measurement.get({ ...drawnWith, maxWidth: Number.MAX_SAFE_INTEGER }, subject.renderable).maximum;
  const whole = (subject: Subject): RenderOptions => ({ ...drawnWith, maxWidth: span(subject) });
  const highlight = dark ? new ColorRgba(255, 255, 255) : new ColorRgba(0, 0, 0);
  const { curves } = settings;

  const on = (subject: Subject, move: ColorMove): Effect => onSubject(subject, move, drawnWith, theme);
  const loops: Record<Loop, (subject: Subject) => Effect> = {
    shimmer: (s) => on(s, shimmer(curves.shimmer, span(s), SHIMMER_WIDTH, highlight)),
    pulse: (s) => on(s, pulse(curves.pulse, dark)),
    drift: (s) => on(s, drift(curves.drift, span(s))),
    sparkle: (s) => on(s, sparkle(curves.sparkle, dark)),
  };

  const ratio = (r: number | undefined): string => (r === undefined ? "—" : `${r.toFixed(2)}:1`);
  // Identity contrast: what the cells read at before any effect moves them.
  const rest = ratio(worstContrast(subjects, () => (colors) => colors, [0], whole, theme));
  const contrast = Object.fromEntries(
    LOOPS.map((loop) => {
      const worst = worstContrast(subjects, loops[loop], sampled(curves[loop].seconds, CONTRAST_SAMPLES), whole, theme);
      return [loop, worst === undefined ? "no colour drawn" : `worst contrast ${ratio(worst)} (at rest ${rest})`];
    }),
  ) as Record<Loop, string>;

  // [LAW:no-ambient-temporal-coupling] The clock, read here and nowhere else.
  const origin = performance.now();
  const clock = (): number => (performance.now() - origin) / 1000;
  let t = 0;
  let fadeStart = 0;
  let dissolveStart = 0;

  const describe = (name: EffectName, curve: NamedCurve): string =>
    `${name.padEnd(9)} ${curve.seconds}s · ${curve.easeName} · swing ${curve.swing}`;

  const transitionStatus = (curve: NamedCurve, start: number, key: string): string =>
    t >= settledAt(curve, start) ? `done — ${key} replays` : "running";

  const row = (label: string, effect: (subject: Subject) => Effect): Renderable[] => [
    new RichText(label, { style: quiet, noWrap: true }),
    ...subjects.map((s) => new Effected(s.renderable, effect(s), { t, key: s.name, theme })),
    new RichText(""),
  ];

  const view = (): Renderable =>
    new Padding(
      new Group(
        new RichText(
          `effects feel · ${settings.fps} fps · ${settings.depth} · ${settings.ground} (${theme.palette.name}) · t=${t.toFixed(1)}s`,
          { style: heading, noWrap: true },
        ),
        new RichText("f replays the fade-in · d replays the dissolve · q quits", { style: quiet, noWrap: true }),
        new RichText(""),
        ...LOOPS.flatMap((loop) => row(`${describe(loop, curves[loop])}   ${contrast[loop]}`, loops[loop])),
        ...row(
          `${describe("fade", curves.fade)}   ${transitionStatus(curves.fade, fadeStart, "f")}`,
          () => fadeIn(curves.fade, fadeStart),
        ),
        ...row(
          `${describe("dissolve", curves.dissolve)}   ${transitionStatus(curves.dissolve, dissolveStart, "d")}`,
          () => dissolveOut(curves.dissolve, dissolveStart),
        ),
      ),
      [1, 2],
      { style: Style.fromColor(ink, paper) },
    );

  const app = new App({ host, surface: "alternate", view });

  const tick = setInterval(() => {
    t = clock();
    app.refresh();
  }, 1000 / settings.fps);

  // [LAW:dataflow-not-control-flow] Each key is a row in this table; a key
  // not in it does nothing, so a mouse report repaints nothing.
  const replay = (): number => {
    t = clock();
    app.refresh();
    return t;
  };
  const keys: Record<string, () => void> = {
    f: () => (fadeStart = replay()),
    d: () => (dissolveStart = replay()),
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
    clearInterval(tick);
    unsubscribe();
  });
  return { done };
}
