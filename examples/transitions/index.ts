/**
 * transitions — a build status changing state every three seconds, once
 * crossfaded and once wiped, playing in a `Live` for twenty seconds.
 *
 * THIS IS A DEMO: `crossfade` and `wipe` (`src/renderables/change.ts`), for
 * seeing them move. Each row draws the change into the state in progress at
 * the `Live`'s time, so what it shows at a `t` is the same at any frame rate,
 * and what sits beside it moves once, at the cut, never while it changes.
 */

import { CATPPUCCIN_MOCHA, EASES, Group, Live, Panel, RichText, Timeline, crossfade, frameAt, wipe, type Change, type Renderable, type Transition } from "../../src/index.js";

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

function view(t: number): Renderable {
  const k = Math.floor(t / EVERY);
  const to = STATES[k % STATES.length]!;
  // The first state is shown as it is: nothing came before it to change from.
  // Each change plays from its cut on the Live's clock, and `frameAt` stamps the frame on that clock.
  const shown = (change: Transition<Change>): Renderable =>
    k === 0 ? to : frameAt(Timeline.run(Timeline.play(k * EVERY), change.effect({ from: STATES[(k - 1) % STATES.length]!, to, theme: CATPPUCCIN_MOCHA })), t);
  return new Group(...CHANGES.map(([name, change]) => new Panel(shown(change), { title: name, width: 40, borderStyle: "#585b70" })));
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
