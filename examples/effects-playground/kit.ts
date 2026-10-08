/**
 * effects-kit — what an effect's program on the docs' effects playground page
 * imports besides the library: the effects-feel demo's subjects, drawn in its
 * theme, and a frame clock to play an effect on them at.
 *
 * The effects are not here. Each program carries its effect's code, cut from
 * `src/renderables/effects.ts` and the noise it is built from (programs.ts),
 * so what a card runs is the library's code and what is edited there is that
 * code. This file is one of each card's files, as the demo's subjects are
 * (../effects-feel/subjects.ts), so it imports the library by its published
 * names.
 */

import { CATPPUCCIN_MOCHA, ColorDepth, ColorSpec, Console, Effected, Group, Live, Padding, RichText, Style, frameRate, systemClock, type Effect } from "@promptctl/rich-js";
import { drawnSubject, stripSubject, textSubject, type DrawnSubject } from "../effects-feel/subjects.js";

export { fills, pulsedOn, subjectUnder, type DrawnSubject } from "../effects-feel/subjects.js";

/** The theme the subjects are drawn in: the effects-feel demo's first dark one. */
export const THEME = CATPPUCCIN_MOCHA;

/** A program's effect: what `subject` is drawn under for a transition that started at curve time `start`. */
export type Make = (subject: DrawnSubject, start: number) => Effect;

/** How a program plays: frames a second, how far each moves curve time, and how often a transition starts over. */
export interface Pace {
  readonly fps: number;
  /** Curve time a frame moves, whatever the frame rate: what a curve's `seconds` are measured in. */
  readonly step: number;
  /** Curve time between a transition's starts; a loop never starts over. */
  readonly every: number;
}

/**
 * Play `make` on the demo's strip and status line, a frame `pace.fps` times a
 * second, each moving curve time by `pace.step`. Every `pace.every` of curve
 * time a transition starts over. It plays until the terminal is taken away.
 */
export function play(make: Make, pace: Pace): void {
  const console = new Console();
  const drawnWith = console.options;
  const subjects = [stripSubject(THEME), textSubject(THEME, drawnWith.colorSystem ?? ColorDepth.TRUECOLOR)].map((s) => drawnSubject(s, drawnWith, THEME));
  const ink = ColorSpec.fromRgba(THEME.foregroundColor);
  const dim = Style.fromColor(ink).add(Style.parse("dim"));
  const paper = Style.fromColor(ink, ColorSpec.fromRgba(THEME.backgroundColor));

  // Made again only when a transition starts over: settling a loop's shares
  // is costly, and every frame reads them.
  let made: { readonly start: number; readonly effects: readonly Effect[] } | undefined;
  const effectsFrom = (start: number): readonly Effect[] =>
    (made = made?.start === start ? made : { start, effects: subjects.map((s) => make(s, start)) }).effects;

  const live = new Live(undefined, { console, altScreen: true, autoRefresh: false });
  let frame = 0;
  let t = 0;
  const draw = (): void => {
    const start = Number.isFinite(pace.every) ? Math.floor(t / pace.every) * pace.every : 0;
    const effects = effectsFrom(start);
    const heading = new RichText(`frame ${frame} · curve time ${t.toFixed(2)} · ${pace.fps} fps`, { style: dim, noWrap: true });
    const drawn = subjects.map((s, n) => new Effected(s.renderable, effects[n]!, { t, key: s.name, theme: THEME }));
    live.update(new Padding(new Group(heading, new RichText(""), ...drawn), [1, 2], { style: paper }), { refresh: true });
    t += pace.step;
    frame += 1;
  };
  live.start();
  systemClock().every(frameRate(pace.fps), draw);
}
