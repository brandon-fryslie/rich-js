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
  ColorDepth,
  ColorRgba,
  ColorSpec,
  Console,
  ensureContrast,
  Effected,
  Group,
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
  Segment,
  type TerminalTheme,
} from "../../src/index.js";
import { graphemes } from "../../src/core/cells.js";
import { App, hostEnvironment, type TerminalHost } from "../../src/host/index.js";
import { dissolveOut, drift, fadeIn, onColors, pulse, settledAt, shares, shimmer, sparkle, type Loop, type Pair } from "./curves.js";
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

/** The status line's contrast against the ground: WCAG's AAA for body text. */
const STATUS_CONTRAST = 7;

/** How far a shimmer's light reaches either side of its centre, in columns. */
export const SHIMMER_WIDTH = 32;

/** Columns a subject is offered when its own width is read: wider than any subject here. */
const DRAW_BUDGET = 1024;

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
  readonly renderable: Renderable;
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
  /** Its width in columns, which a sweep crosses once a period. */
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
  // Read off what it draws, not `Measurement`: a `Strip` is not `Measurable`,
  // and an unmeasurable renderable measures as the whole budget it is offered.
  const span = Math.max(...Segment.splitLines(subject.renderable.render({ ...drawnWith, maxWidth: DRAW_BUDGET })).map(Segment.getLineLength));
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

export interface DemoHandle {
  /** Resolves once the demo has stopped and handed the terminal back. */
  readonly done: Promise<void>;
}

export function runDemo(host: TerminalHost, settings: Settings): DemoHandle {
  const theme = THEMES[settings.ground];
  const ink = ColorSpec.fromRgba(theme.foregroundColor);
  const paper = ColorSpec.fromRgba(theme.backgroundColor);
  const quiet = Style.fromColor(ColorSpec.fromRgba(paletteRgba(theme, "foreground-muted")));
  const heading = Style.fromColor(ink).add(Style.parse("bold"));

  // What the frames are drawn with, asked of the host the app paints on.
  const drawnWith = new Console({ environment: hostEnvironment(host) }).options;
  const depth = drawnWith.colorSystem ?? ColorDepth.TRUECOLOR;
  const subjects = [stripSubject(theme), textSubject(theme, depth)].map((s) => drawnSubject(s, drawnWith, theme));
  const { curves } = settings;

  const made: Record<LoopName, (subject: DrawnSubject) => Loop> = {
    shimmer: (s) => shimmer(curves.shimmer, s.span, SHIMMER_WIDTH, LIGHTS.sun, s.z),
    pulse: () => pulse(curves.pulse, LIGHTS.sun),
    drift: (s) => drift(curves.drift, s.span, s.z),
    sparkle: (s) => sparkle(curves.sparkle, s.span, LIGHTS.firefly, s.z),
  };
  const loops = Object.fromEntries(
    LOOPS.map((name) => [name, (s: DrawnSubject) => subjectUnder(s, made[name](s), theme)]),
  ) as Record<LoopName, (subject: DrawnSubject) => Effect>;

  // With no colour drawn there is no contrast to read: every effect is the
  // identity, and every cell is the terminal's own ink on its own ground.
  const ratio = (r: number): string => `${r.toFixed(2)}:1`;
  const rest = ratio(worstContrast(subjects, (s) => s.renderable.render(s.options), [0], theme));
  const measured = (loop: LoopName): string => {
    const under = (s: DrawnSubject, at: number) =>
      new Effected(s.renderable, loops[loop](s), { t: at, key: seedKey(loop, s), theme }).render(s.options);
    const worst = worstContrast(subjects, under, sampled(curves[loop].seconds), theme);
    return `worst contrast ${ratio(worst)} over ${CONTRAST.periods * curves[loop].seconds}s (at rest ${rest})`;
  };
  const contrast = Object.fromEntries(
    LOOPS.map((loop) => [loop, drawnWith.colorSystem === null ? "no colour drawn" : measured(loop)]),
  ) as Record<LoopName, string>;

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
        ...row(t, "fade", transitionStatus(t, curves.fade, fadeStart, "f"), (s) => fadeIn(curves.fade, fadeStart, s.z)),
        ...row(t, "dissolve", transitionStatus(t, curves.dissolve, dissolveStart, "d"), (s) => dissolveOut(curves.dissolve, dissolveStart, s.z)),
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
