/**
 * effects-kit — what a program in the effects playground imports besides the
 * library: the scene an effect is tried on and the clock it is played at,
 * both the effects-feel demo's own.
 *
 * The effects are not here. Each playground's program carries its effect's
 * code, cut from `src/renderables/effects.ts` and the noise it is built from
 * (programs.ts), so what a playground runs is the library's code and what is
 * edited there is that code.
 *
 * It runs in the live terminal's worker, bundled onto the live library
 * (`libraryModule` in docs/.vitepress/example-runner.ts), so it reaches
 * `src/` only through the package's entry points.
 *
 * A process has one stage, and every program run in it plays its scene on
 * that stage, by name, one under another: a browser panel's process plays
 * one, a terminal following every effect (terminal.ts) plays them all.
 */

import { computed, observable, runInAction, reaction, type IComputedValue, type IObservableValue } from "mobx";
import { ColorDepth, ColorSpec, Console, Effected, Group, Live, Padding, RichText, Style, type Effect, type TerminalTheme } from "../../src/index.js";
import {
  STEP,
  THEMES,
  drawnSubject,
  fills,
  magnified,
  pulsedOn,
  stripSubject,
  subjectUnder,
  textSubject,
  type DrawnSubject,
} from "../effects-feel/app.js";
import { depthDrawn } from "../effects-feel/vocabulary.js";
import { CONTROL_DEFAULTS, type Heard } from "./controls.js";

export { fills, magnified, pulsedOn, subjectUnder, type DrawnSubject };

/** The scene an effect is made for: the theme it is drawn in, when a transition starts, and how far a loop swings. */
export interface Moment {
  readonly theme: TerminalTheme;
  readonly start: number;
  /** The demo's magnitude: what a loop's swing is multiplied by (`magnified`). */
  readonly magnitude: number;
}

/** A program's effect: what `subject` is drawn under at `moment`. */
export type Make = (subject: DrawnSubject, moment: Moment) => Effect;

/** What a program plays: its effect, and how often a transition replays. */
interface Scene {
  readonly make: Make;
  readonly every: number;
}

/** A scene on the stage: what it plays, and a clock of its own. */
interface Playing {
  readonly scene: IObservableValue<Scene>;
  /**
   * Its frame; its curve time `t`, what a curve's `seconds` are measured in,
   * which every frame moves by `STEP` times the rate whatever the frame rate;
   * where its transition was last replayed from, in curve time (it starts
   * over every `every` after that); and the real seconds its frames took.
   */
  readonly clock: { t: number; frame: number; began: number; real: number };
  readonly start: IObservableValue<number>;
  readonly effects: IComputedValue<readonly Effect[]>;
}

/** What every scene is drawn with, and the frame that draws them all. */
interface Stage {
  readonly theme: IComputedValue<TerminalTheme>;
  readonly subjects: IComputedValue<readonly DrawnSubject[]>;
  draw(): void;
}

// [LAW:no-shared-mutable-globals] exception: the process is the playground's,
// and these are how what reaches it later — a program's code run again, a
// control from the page — reaches the stage its first program began.
/** The controls every scene plays under. */
const controls = observable.box(CONTROL_DEFAULTS, { deep: false });
/** Every scene playing, by name, in the order each began. */
const scenes = new Map<string, Playing>();
let stage: Stage | undefined;

/** Take in what the page told the program (edits.ts): a replay or a restart is the named scene's. */
export function hear(message: Heard): void {
  if (message.kind === "controls") return runInAction(() => controls.set(message.controls));
  const clock = scenes.get(message.scene)?.clock;
  if (clock === undefined) return;
  if (message.kind === "replay") clock.began = clock.t;
  else Object.assign(clock, { t: 0, frame: 0, began: 0, real: 0 });
}

/**
 * Play `make` as the scene `name`, on the demo's strip and status line,
 * paced as the demo paces: a frame `fps` times a second, each moving the
 * scene's time by `STEP` times the rate. Every `every` seconds of that time
 * a transition starts over; a loop is never made again. Played again under
 * the same name — the playground runs each edit of a program in the process
 * already playing it — it changes that scene in place: its clock and the
 * screen carry on.
 */
export function play(name: string, make: Make, every: number = Number.POSITIVE_INFINITY): void {
  const scene = { make, every };
  const playing = scenes.get(name);
  if (playing !== undefined) return runInAction(() => playing.scene.set(scene));
  const first = stage === undefined;
  stage ??= begin();
  const { theme, subjects } = stage;
  const box = observable.box(scene, { deep: false });
  const start = observable.box(0);
  // Made again only when what it is made from changes: settling a loop's
  // shares is costly, and every frame reads them.
  const effects = computed(
    () => subjects.get().map((s) => box.get().make(s, { theme: theme.get(), start: start.get(), magnitude: controls.get().magnitude })),
    { keepAlive: true },
  );
  scenes.set(name, { scene: box, clock: { t: 0, frame: 0, began: 0, real: 0 }, start, effects });
  if (first) stage.draw();
}

function begin(): Stage {
  const theme = computed(() => THEMES.find((t) => t.palette.name === controls.get().theme)!);
  const drawing = computed(() => new Console({ colorSystem: depthDrawn(controls.get().depth) }));
  const subjects = computed(() => {
    const drawnWith = drawing.get().options;
    return [stripSubject(theme.get()), textSubject(theme.get(), drawnWith.colorSystem ?? ColorDepth.TRUECOLOR)].map((s) => drawnSubject(s, drawnWith, theme.get()));
  });

  let live = new Live(undefined, { console: drawing.get(), altScreen: true, autoRefresh: false });
  reaction(
    () => drawing.get(),
    (next) => {
      live.stop();
      live = new Live(undefined, { console: next, altScreen: true, autoRefresh: false });
      live.start();
    },
  );

  const draw = (): void => {
    const { fps, rate, magnitude, depth } = controls.get();
    const shown = theme.get();
    const ink = ColorSpec.fromRgba(shown.foregroundColor);
    const dim = Style.fromColor(ink).add(Style.parse("dim"));
    const blocks = [...scenes].flatMap(([name, { scene, clock, start, effects }], i) => {
      const { every } = scene.get();
      runInAction(() => start.set(clock.began + (Number.isFinite(every) ? Math.floor((clock.t - clock.began) / every) * every : 0)));
      const heading = new RichText(
        `${name} · frame ${clock.frame} · curve time ${clock.t.toFixed(2)} · ${clock.real.toFixed(1)}s real · ${fps} fps · rate ×${rate} · magnitude ×${magnitude} · ${depth} · ${shown.palette.name} (${shown.palette.dark ? "dark" : "light"})`,
        { style: dim, noWrap: true },
      );
      const drawn = subjects.get().map((s, n) => new Effected(s.renderable, effects.get()[n]!, { t: clock.t, key: `${name}:${s.name}`, theme: shown }));
      clock.t += STEP * rate;
      clock.frame += 1;
      clock.real += 1 / fps;
      return [...(i > 0 ? [new RichText("")] : []), heading, new RichText(""), ...drawn];
    });
    const paper = Style.fromColor(ink, ColorSpec.fromRgba(shown.backgroundColor));
    live.update(new Padding(new Group(...blocks), [1, 2], { style: paper }), { refresh: true });
  };
  live.start();
  let timer = setInterval(draw, 1000 / controls.get().fps);
  reaction(
    () => controls.get().fps,
    (fps) => {
      clearInterval(timer);
      timer = setInterval(draw, 1000 / fps);
    },
  );
  return { theme, subjects, draw };
}
