/**
 * transitions — a build status changing state every three seconds, once
 * crossfaded and once wiped, playing in a `Live` for twenty seconds.
 *
 * THIS IS A DEMO: `crossfade` and `wipe` (`src/renderables/change.ts`), for
 * seeing them move. Each row draws the change into the state in progress at
 * the `Live`'s time, so what it shows at a `t` is the same at any frame rate,
 * and what sits beside it moves once, at the cut, never while it changes.
 */

import { Animation, CATPPUCCIN_MOCHA, EASES, Group, Live, Panel, RichText, crossfade, frameAt, wipe, type Change, type Renderable, type Transition } from "../../src/index.js";

const EVERY = 3;
const STATES = [
  new RichText("queued", { style: "#a6adc8" }),
  new RichText("building the project…", { style: "bold #f9e2af" }),
  new RichText("running 1,204 tests", { style: "#89b4fa" }),
  new RichText("done ✓", { style: "bold #a6e3a1" }),
];
const CHANGES: readonly [string, Transition<Change>][] = [
  ["crossfade", crossfade({ seconds: 0.8, ease: EASES["ease-in-out"], swing: 1 })],
  ["wipe", wipe({ seconds: 0.8, ease: EASES["ease-in-out"], swing: 1 })],
];

/** Which of the states turn `n` shows, for a turn of either sign. */
const cycled = (n: number): number => ((n % STATES.length) + STATES.length) % STATES.length;

/**
 * `change` played into each state every `EVERY` seconds, from the one before,
 * each change made once. The first state is shown as it is: nothing came
 * before it to change from.
 */
const changing = (change: Transition<Change>): Animation<Renderable> => {
  const into = STATES.map((to, i) => change.effect({ from: STATES[cycled(i - 1)]!, to, theme: CATPPUCCIN_MOCHA }));
  const first = Animation.constant<Renderable>(STATES[0]!);
  return Animation.repeat(EVERY, (n) => (n === 0 ? first : into[cycled(n)]!));
};

const ROWS = CHANGES.map(([name, change]) => [name, changing(change)] as const);

// `frameAt` stamps each frame with when the change next moves, on the Live's clock.
function view(t: number): Renderable {
  return new Group(...ROWS.map(([name, changes]) => new Panel(frameAt(changes, t), { title: name, width: 40, borderStyle: "#585b70" })));
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
