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

import { Animation, CATPPUCCIN_MOCHA, ColorDepth, ColorSpec, Console, Effected, Group, Live, Padding, RichText, Style, frameRate, systemClock, type Effect } from "@promptctl/rich-js";
import { drawnSubject, stripSubject, textSubject, type DrawnSubject } from "../effects-feel/subjects.js";

export { pulsedOn, type DrawnSubject } from "../effects-feel/subjects.js";

/** The theme the subjects are drawn in: the effects-feel demo's first dark one. */
export const THEME = CATPPUCCIN_MOCHA;

/** A program's effect: what `subject` is drawn under, on the effect's own clock from 0. */
export type Make = (subject: DrawnSubject) => Effect;

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
 *
 * An edit of the card is run in place (`import.meta.hot`,
 * examples/_capabilities/hot-context.ts): the clock is carried into the new
 * version, which picks up at the frame and curve time the last one reached.
 */
export function play(make: Make, pace: Pace): void {
  const console = new Console();
  const drawnWith = console.options;
  const subjects = [stripSubject(THEME), textSubject(THEME, drawnWith.colorSystem ?? ColorDepth.TRUECOLOR)].map((s) => drawnSubject(s, drawnWith));
  const ink = ColorSpec.fromRgba(THEME.foregroundColor);
  const dim = Style.fromColor(ink).add(Style.parse("dim"));
  const paper = Style.fromColor(ink, ColorSpec.fromRgba(THEME.backgroundColor));

  // Made once: settling a loop's shares is costly, and every frame reads them.
  // A transition starting over is the same effect played again every turn.
  const replayed = (effect: Effect): Effect =>
    Number.isFinite(pace.every)
      ? (drawn) => {
          const once = effect(drawn);
          return Animation.repeat(pace.every, () => once);
        }
      : effect;
  const effects = subjects.map((s) => replayed(make(s)));

  const live = new Live(undefined, { console, altScreen: true, autoRefresh: false });
  // Carried as the last version left it; the first starts at 0.
  const carried = (import.meta.hot?.data["clock"] ?? { frame: 0, t: 0 }) as { frame: number; t: number };
  let { frame, t } = carried;
  import.meta.hot?.accept();
  import.meta.hot?.dispose((data) => {
    data["clock"] = { frame, t };
  });
  const draw = (): void => {
    const heading = new RichText(`frame ${frame} · curve time ${t.toFixed(2)} · ${pace.fps} fps`, { style: dim, noWrap: true });
    const drawn = subjects.map((s, n) => new Effected(s.renderable, effects[n]!, { key: s.name, theme: THEME }).at(t));
    live.update(new Padding(new Group(heading, new RichText(""), ...drawn), [1, 2], { style: paper }), { refresh: true });
    t += pace.step;
    frame += 1;
  };
  live.start();
  systemClock().every(frameRate(pace.fps), draw);
}
