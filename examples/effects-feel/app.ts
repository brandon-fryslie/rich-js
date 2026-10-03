/**
 * effects-feel — the demo body: a powerline strip and a run of text under
 * each effect, redrawn at the frame rate the run was given.
 *
 * THIS IS A DEMO, built so the feel of each effect can be agreed before any
 * curve lands in `src/`. See `curves.ts`.
 *
 * [LAW:no-ambient-temporal-coupling] The `App` is the frame owner: it ticks
 * at the run's rate and hands each frame its `t`, and the view is a pure
 * function of that `t` and the two transition start times. Every effect below
 * is sampled at whatever `t` it is handed, so 30 frames a second and one every
 * two seconds run the same code.
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
  frameRate,
  systemClock,
  type Effect,
  type Renderable,
  type RenderOptions,
  type Segment,
  type TerminalTheme,
} from "../../src/index.js";
import { graphemes } from "../../src/core/cells.js";
import { App, hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import { dissolveOut, drift, fadeIn, onColors, pulse, settledAt, shimmer, sparkle } from "./curves.js";
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
 * A subject as a run draws it, measured once at startup and read by every
 * frame: whole, at its own width whatever the terminal's — a sweep crosses
 * the element, not the screen — and at the run's depth.
 */
export interface DrawnSubject extends Subject {
  readonly options: RenderOptions;
  /** Its width in columns, which a sweep crosses once a period. */
  readonly span: number;
  /** The colours it sets its slot to, by hex, as the screen shows them. */
  readonly colors: ReadonlySet<string>;
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

/** A cell's ink and ground as the wire draws them at `options`' depth, the theme resolving the rest. */
function shown(cell: Cell, options: RenderOptions, theme: TerminalTheme): { fg: ColorRgba; bg: ColorRgba } {
  const drawn = cell.style.drawnColors(options.colorSystem ?? undefined);
  return { fg: (drawn.color ?? DEFAULT).getTruecolor(theme, true), bg: (drawn.bgcolor ?? DEFAULT).getTruecolor(theme, false) };
}

/** The glyphs a joiner draws between cells: colour seams, not text. */
const SEAM_GLYPHS: ReadonlySet<string> = new Set(Object.values(POWERLINE_JOINER_GLYPHS));

export function drawnSubject(subject: Subject, drawnWith: RenderOptions, theme: TerminalTheme): DrawnSubject {
  const span = Measurement.get({ ...drawnWith, maxWidth: Number.MAX_SAFE_INTEGER }, subject.renderable).maximum;
  const options = { ...drawnWith, maxWidth: span };
  const foreground = subject.slot === "fg";
  const colors = new Set(
    cellsOf(subject.renderable.render(options)).flatMap((cell) => {
      const drawn = cell.style.drawnColors(options.colorSystem ?? undefined);
      const spec = foreground ? drawn.color : drawn.bgcolor;
      // A cell that sets none is drawn in the terminal's own colour, which is
      // no colour of the subject's.
      return spec === undefined ? [] : [spec.getTruecolor(theme, foreground).hex];
    }),
  );
  // A seam sits in the same cell whichever glyph a joiner draws it with, so
  // the cells are read where the glyphs are the ones `SEAM_GLYPHS` names.
  const text = new Set(
    cellsOf(subject.renderable.render({ ...options, asciiOnly: false }))
      .filter((cell) => cell.glyph.trim() !== "" && !SEAM_GLYPHS.has(cell.glyph))
      .map((cell) => cell.at),
  );
  return { ...subject, options, span, colors, text };
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

/** An effect's row on screen and the seeds its cells draw: one per effect, so rows twinkle apart. */
const seedKey = (effect: EffectName, subject: Subject): string => `${effect}:${subject.name}`;

/** `count` moments evenly across one period of `seconds`. */
function sampled(seconds: number, count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i / count) * seconds);
}

/**
 * The worst contrast between text and its ground over every frame `draw`
 * makes at each of `times`, read off the drawn cells as the wire writes them.
 */
function worstContrast(
  subjects: readonly DrawnSubject[],
  draw: (subject: DrawnSubject, t: number) => Iterable<Segment>,
  times: readonly number[],
  theme: TerminalTheme,
): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const subject of subjects) {
    for (const t of times) {
      for (const cell of cellsOf(draw(subject, t))) {
        const { fg, bg } = shown(cell, subject.options, theme);
        worst = subject.text.has(cell.at) ? Math.min(worst, contrastRatio(fg, bg)) : worst;
      }
    }
  }
  return worst;
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

  // What the frames are drawn with, asked of the host the app paints on.
  const drawnWith = new Console({ environment: hostEnvironment(host) }).options;
  const subjects = [stripSubject(theme), textSubject(theme)].map((s) => drawnSubject(s, drawnWith, theme));
  const highlight = dark ? new ColorRgba(255, 255, 255) : new ColorRgba(0, 0, 0);
  const { curves } = settings;

  const loops: Record<Loop, (subject: DrawnSubject) => Effect> = {
    shimmer: (s) => onColors(s.colors, shimmer(curves.shimmer, s.span, SHIMMER_WIDTH, highlight)),
    pulse: (s) => onColors(s.colors, pulse(curves.pulse, dark)),
    drift: (s) => onColors(s.colors, drift(curves.drift, s.span)),
    sparkle: (s) => onColors(s.colors, sparkle(curves.sparkle, dark)),
  };

  // With no colour drawn there is no contrast to read: every effect is the
  // identity, and every cell is the terminal's own ink on its own ground.
  const ratio = (r: number): string => `${r.toFixed(2)}:1`;
  const rest = ratio(worstContrast(subjects, (s) => s.renderable.render(s.options), [0], theme));
  const measured = (loop: Loop): string => {
    const under = (s: DrawnSubject, at: number) =>
      new Effected(s.renderable, loops[loop](s), { t: at, key: seedKey(loop, s), theme }).render(s.options);
    const worst = worstContrast(subjects, under, sampled(curves[loop].seconds, CONTRAST_SAMPLES), theme);
    return `worst contrast ${ratio(worst)} (at rest ${rest})`;
  };
  const contrast = Object.fromEntries(
    LOOPS.map((loop) => [loop, drawnWith.colorSystem === null ? "no colour drawn" : measured(loop)]),
  ) as Record<Loop, string>;

  // [LAW:no-ambient-temporal-coupling] The app owns the frames and hands each
  // its time; a replay starts at the time on that same clock.
  const clock = systemClock();
  const origin = clock.now();
  let fadeStart = origin;
  let dissolveStart = origin;

  const describe = (name: EffectName, curve: NamedCurve): string =>
    `${name.padEnd(9)} ${curve.seconds}s · ${curve.easeName} · swing ${curve.swing}`;

  const transitionStatus = (t: number, curve: NamedCurve, start: number, key: string): string =>
    t >= settledAt(curve, start) ? `done — ${key} replays` : "running";

  const row = (t: number, name: EffectName, status: string, effect: (subject: DrawnSubject) => Effect): Renderable[] => [
    new RichText(`${describe(name, curves[name])}   ${status}`, { style: quiet, noWrap: true }),
    ...subjects.map((s) => new Effected(s.renderable, effect(s), { t, key: seedKey(name, s), theme })),
    new RichText(""),
  ];

  const view = (t: number): Renderable =>
    new Padding(
      new Group(
        new RichText(
          `effects feel · ${settings.fps} fps · ${settings.depth} · ${settings.ground} (${theme.palette.name}) · t=${(t - origin).toFixed(1)}s`,
          { style: heading, noWrap: true },
        ),
        new RichText("f replays the fade-in · d replays the dissolve · q quits", { style: quiet, noWrap: true }),
        new RichText(""),
        ...LOOPS.flatMap((loop) => row(t, loop, contrast[loop], loops[loop])),
        ...row(t, "fade", transitionStatus(t, curves.fade, fadeStart, "f"), () => fadeIn(curves.fade, fadeStart)),
        ...row(t, "dissolve", transitionStatus(t, curves.dissolve, dissolveStart, "d"), () => dissolveOut(curves.dissolve, dissolveStart)),
      ),
      [1, 2],
      { style: Style.fromColor(ink, paper) },
    );

  const app = new App({ host, surface: "alternate", view, clock, rate: frameRate(settings.fps) });
  // The loops never settle, so the demo animates for as long as it runs.
  app.animate();

  // [LAW:dataflow-not-control-flow] Each key is a row in this table; a key
  // not in it does nothing, so a mouse report repaints nothing.
  const replay = (): number => {
    app.refresh();
    return clock.now();
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

  const done = app.run().finally(unsubscribe);
  return { done };
}
