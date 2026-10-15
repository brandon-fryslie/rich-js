/**
 * effects-feel — what the effects are tried on: a powerline strip and a run
 * of text, drawn in a theme, and which elements of them a pulse breathes. The
 * demo's screen (app.ts) shows them, and so does each card on the docs'
 * effects playground page (examples/effects-playground/kit.ts), which runs
 * this file as one of its program's files.
 *
 * So it imports the library by its published names, as a card's file does
 * (docs/.vitepress/demo-card.ts), and nothing from node.
 */

import {
  ColorDepth,
  ColorRgba,
  ColorSpec,
  Measurement,
  JOINERS,
  RichText,
  Strip,
  Style,
  confined,
  ensureContrast,
  onColors,
  type Effect,
  type Loop,
  type Measurable,
  type Renderable,
  type RenderOptions,
  type TerminalTheme,
} from "@promptctl/rich-js";

const STRIP_LABELS = [
  "main", "+3 ~2", "claude.ai", "opus", "3.4k tok", "12%",
  "$0.42", "ctx 61%", "rich-js", "effects", "14:02", "ok",
];
const STRIP_KEYS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;

const TEXT = "Thinking about how a band of light should cross these words at one frame a second…";

/** The status line's contrast against the ground: WCAG's AAA for body text. */
const STATUS_CONTRAST = 7;

/**
 * A thing the effects are tried on: a powerline strip, which sets its cells'
 * fill and lettering, or a run of text, which sets only its ink.
 */
export interface Subject {
  readonly name: string;
  readonly renderable: Renderable & Measurable;
  /** Where it sits in the noise, so two subjects under one effect never move in lockstep. */
  readonly z: number;
  /** The elements of it a pulse breathes, told apart by who drew each cell, never by its colour. */
  readonly pulsed: readonly object[];
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
}

export function drawnSubject(subject: Subject, drawnWith: RenderOptions): DrawnSubject {
  const span = Measurement.get({ ...drawnWith, maxWidth: Number.MAX_SAFE_INTEGER }, subject.renderable).maximum;
  return { ...subject, options: { ...drawnWith, maxWidth: span }, span };
}

/** A colour of the theme's palette by its name; a name the palette lacks is a bug here. */
export function paletteRgba(theme: TerminalTheme, key: string): ColorRgba {
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

/** The labels of the strip's cells a pulse breathes: the rest of the screen does not. */
const PULSED: readonly string[] = ["ctx 61%", "ok"];

/** A powerline strip of a dozen cells over the theme's palette. */
export function stripSubject(theme: TerminalTheme): Subject {
  const cells = STRIP_LABELS.map((label, i) => new RichText(` ${label} `, { style: stripStyle(theme, i), end: "", noWrap: true }));
  const pulsed = cells.filter((_, i) => PULSED.includes(STRIP_LABELS[i]!));
  return { name: "strip", renderable: new Strip(cells, JOINERS.powerline), z: 0, pulsed };
}

/**
 * A status line, drawn dim as a "thinking" line is — the theme's muted ink,
 * lifted only as far as it must to read at `STATUS_CONTRAST` at `depth` —
 * which on a dark ground leaves the light room to lift it.
 */
export function textSubject(theme: TerminalTheme, depth: ColorDepth): Subject {
  const ink = ensureContrast(paletteRgba(theme, "foreground-muted"), theme.backgroundColor, STATUS_CONTRAST, depth, undefined, theme);
  const style = Style.fromColor(ColorSpec.fromRgba(ink));
  return { name: "text", renderable: new RichText(TEXT, { style, noWrap: true }), z: 11.3, pulsed: [] };
}

/**
 * A pulse breathing each of `subject`'s pulsed elements, and its side of the
 * arrows either side of it, with a `pulseAt(z)` of its own at a `z` of its
 * own, so each keeps a time of its own; a subject with none is left be.
 */
export function pulsedOn(subject: DrawnSubject, pulseAt: (z: number) => Loop): Effect {
  const effects = subject.pulsed.map((element, n) => confined(onColors(pulseAt(subject.z + 3.7 * (n + 1))), element));
  return (t, drawn) => {
    const frames = effects.map((effect) => effect(t, drawn));
    return (colors, cell) => frames.reduce((moved, frame) => frame(moved, cell), colors);
  };
}
