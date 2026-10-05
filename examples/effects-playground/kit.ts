/**
 * effects-kit — what a program in the effects playground imports besides the
 * library: the scene an effect is tried on and the clock it is played at,
 * both the effects-feel demo's own, and the noise its curves are built from.
 *
 * The curves are not here. Each playground's program carries its effect's
 * code, cut from `../effects-feel/curves.ts` (programs.ts), so what a
 * playground runs is the demo's code and what is edited there is that code.
 *
 * It runs in the live terminal's worker, bundled onto the live library
 * (`libraryModule` in docs/.vitepress/example-runner.ts), so it reaches
 * `src/` only through the package's entry points.
 */

import { ColorDepth, ColorSpec, Console, Effected, Group, Live, Padding, RichText, Style, type Effect, type TerminalTheme } from "../../src/index.js";
import { LIGHTS, SHIMMER_WIDTH, STEP, THEMES, drawnSubject, fills, pulsedOn, stripSubject, subjectUnder, textSubject, type DrawnSubject } from "../effects-feel/app.js";
import { RUN_DEFAULTS } from "../effects-feel/vocabulary.js";

export * from "../effects-feel/noise.js";
export { LIGHTS, SHIMMER_WIDTH, fills, pulsedOn, subjectUnder, type DrawnSubject };

/** The scene an effect is made for: the theme it is drawn in, and when a transition starts. */
export interface Moment {
  readonly theme: TerminalTheme;
  readonly start: number;
}

/** A program's effect: what `subject` is drawn under at `moment`. */
export type Make = (subject: DrawnSubject, moment: Moment) => Effect;

/**
 * Play `make` on the demo's strip and status line, in the theme the demo
 * starts in, paced as the demo paces at rate ×1: a frame `RUN_DEFAULTS.fps`
 * times a second, each moving the demo's time by `STEP` seconds. Every
 * `every` seconds of that time it starts over, so a transition replays; a
 * loop is never made again.
 */
export function play(name: string, make: Make, every: number = Number.POSITIVE_INFINITY): void {
  const theme = THEMES.find((t) => t.palette.dark === (RUN_DEFAULTS.ground === "dark"))!;
  const drawnWith = new Console().options;
  const subjects = [stripSubject(theme), textSubject(theme, drawnWith.colorSystem ?? ColorDepth.TRUECOLOR)].map((s) => drawnSubject(s, drawnWith, theme));
  const ink = ColorSpec.fromRgba(theme.foregroundColor);
  const paper = Style.fromColor(ink, ColorSpec.fromRgba(theme.backgroundColor));
  // An effect is made once per start: settling a loop's shares is costly, and a frame reads it.
  let made = { start: Number.NaN, effects: [] as Effect[] };
  const effectsAt = (start: number): Effect[] =>
    made.start === start ? made.effects : (made = { start, effects: subjects.map((s) => make(s, { theme, start })) }).effects;

  let frame = 0;
  const live = new Live(undefined, { altScreen: true, autoRefresh: false });
  const draw = (): void => {
    const t = frame * STEP;
    const effects = effectsAt(Number.isFinite(every) ? Math.floor(t / every) * every : 0);
    const heading = new RichText(`${name} · ${t.toFixed(1)}s · frame ${frame}`, { style: Style.fromColor(ink).add(Style.parse("dim")), noWrap: true });
    const drawn = subjects.map((s, i) => new Effected(s.renderable, effects[i]!, { t, key: `${name}:${s.name}`, theme }));
    live.update(new Padding(new Group(heading, new RichText(""), ...drawn), [1, 2], { style: paper }), { refresh: true });
    frame += 1;
  };
  live.start();
  draw();
  setInterval(draw, 1000 / RUN_DEFAULTS.fps);
}
