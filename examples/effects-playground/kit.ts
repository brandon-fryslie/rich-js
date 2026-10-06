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

import { computed, observable, reaction, runInAction, type IObservableValue } from "mobx";
import { ColorDepth, ColorSpec, Console, Effected, Group, Live, Padding, RichText, Style, type Effect, type TerminalTheme } from "../../src/index.js";
import {
  LIGHTS,
  SHIMMER_WIDTH,
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

export * from "../effects-feel/noise.js";
export { LIGHTS, SHIMMER_WIDTH, fills, magnified, pulsedOn, subjectUnder, type DrawnSubject };

/** The scene an effect is made for: the theme it is drawn in, when a transition starts, and how far a loop swings. */
export interface Moment {
  readonly theme: TerminalTheme;
  readonly start: number;
  /** The demo's magnitude: what a loop's swing is multiplied by (`magnified`). */
  readonly magnitude: number;
}

/** A program's effect: what `subject` is drawn under at `moment`. */
export type Make = (subject: DrawnSubject, moment: Moment) => Effect;

/** What a program plays: its name, its effect, and how often a transition replays. */
interface Scene {
  readonly name: string;
  readonly make: Make;
  readonly every: number;
}

// [LAW:no-shared-mutable-globals] exception: the process is one program's, and
// these are how what reaches it later — an edit of its code run again, a
// control from the page — reaches the stage its first run began.
/** The controls the program plays under. */
const controls = observable.box(CONTROL_DEFAULTS, { deep: false });
/** How many replays have been asked for. */
const replays = observable.box(0);
/** The scene playing, once `play` has begun. */
let playing: IObservableValue<Scene> | undefined;

/** Take in what the page told the program (edits.ts). */
export function hear(message: Heard): void {
  runInAction(() => (message.kind === "controls" ? controls.set(message.controls) : replays.set(replays.get() + 1)));
}

/**
 * Play `make` on the demo's strip and status line, paced as the demo paces:
 * a frame `fps` times a second, each moving the demo's time by `STEP` times
 * the rate. Every `every` seconds of that time a transition starts over; a
 * loop is never made again. Played again in the same process — the
 * playground runs each edit of a program in the one already playing it — it
 * changes the scene in place: the clock and the screen carry on.
 */
export function play(name: string, make: Make, every: number = Number.POSITIVE_INFINITY): void {
  const scene = { name, make, every };
  if (playing === undefined) begin((playing = observable.box(scene, { deep: false })));
  else runInAction(() => playing!.set(scene));
}

function begin(scene: IObservableValue<Scene>): void {
  // Each is made again only when what it is made from changes: settling a
  // loop's shares is costly, and every frame reads them.
  const theme = computed(() => THEMES.find((t) => t.palette.name === controls.get().theme)!);
  const drawing = computed(() => new Console({ colorSystem: depthDrawn(controls.get().depth) }));
  const subjects = computed(() => {
    const drawnWith = drawing.get().options;
    return [stripSubject(theme.get()), textSubject(theme.get(), drawnWith.colorSystem ?? ColorDepth.TRUECOLOR)].map((s) => drawnSubject(s, drawnWith, theme.get()));
  });
  const start = observable.box(0);
  const moment = computed((): Moment => ({ theme: theme.get(), start: start.get(), magnitude: controls.get().magnitude }));
  const effects = computed(() => subjects.get().map((s) => scene.get().make(s, moment.get())), { keepAlive: true });

  let t = 0;
  let frame = 0;
  // Where the transitions were last replayed from; they start over every `every` seconds after it.
  let began = 0;
  reaction(
    () => replays.get(),
    () => (began = t),
  );

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
    const { name, every } = scene.get();
    const { fps, rate, magnitude, depth } = controls.get();
    const shown = theme.get();
    runInAction(() => start.set(began + (Number.isFinite(every) ? Math.floor((t - began) / every) * every : 0)));
    const ink = ColorSpec.fromRgba(shown.foregroundColor);
    const heading = new RichText(
      `${name} · ${t.toFixed(1)}s · frame ${frame} · ${fps} fps · rate ×${rate} · magnitude ×${magnitude} · ${depth} · ${shown.palette.name} (${shown.palette.dark ? "dark" : "light"})`,
      { style: Style.fromColor(ink).add(Style.parse("dim")), noWrap: true },
    );
    const drawn = subjects.get().map((s, i) => new Effected(s.renderable, effects.get()[i]!, { t, key: `${name}:${s.name}`, theme: shown }));
    const paper = Style.fromColor(ink, ColorSpec.fromRgba(shown.backgroundColor));
    live.update(new Padding(new Group(heading, new RichText(""), ...drawn), [1, 2], { style: paper }), { refresh: true });
    t += STEP * rate;
    frame += 1;
  };
  live.start();
  draw();
  let timer = setInterval(draw, 1000 / controls.get().fps);
  reaction(
    () => controls.get().fps,
    (fps) => {
      clearInterval(timer);
      timer = setInterval(draw, 1000 / fps);
    },
  );
}
