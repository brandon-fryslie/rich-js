/**
 * lifecycle — a build log whose lines type themselves in as they are appended
 * and leave four seconds later, dissolved, backspaced or scrambled away in
 * turn, playing in a `Live` for twenty seconds.
 *
 * THIS IS A DEMO: `lifecycle` (`src/renderables/lifecycle.ts`), for seeing an
 * element arrive, stay, leave, and be dropped. Each line is appended at a time
 * on the `Live`'s timeline and told to leave at another, both handed in; the
 * log keeps a line only until it is gone, so a line that has left costs
 * nothing from then on.
 */

import { CATPPUCCIN_MOCHA, EASES, Group, Live, Panel, RichText, backspace, dissolveOut, lifecycle, scrambleOut, throughColors, throughGlyphs, typewriter, type Lifecycle, type Renderable } from "../../src/index.js";

const EVERY = 1.2;
const STAYS = 4;
const MESSAGES = [
  ["resolving dependencies", "#a6adc8"],
  ["compiling 214 modules", "#89b4fa"],
  ["bundling the browser build", "#89b4fa"],
  ["running 1,204 tests", "#f9e2af"],
  ["writing coverage report", "#cba6f7"],
  ["publishing the docs site", "#94e2d5"],
  ["done ✓", "bold #a6e3a1"],
] as const;
const ENTER = { seconds: 0.8, ease: EASES["ease-out"] };
const EXIT = { seconds: 1.2, ease: EASES["ease-in"], swing: 1 };

/** The `i`th line appended to the log at time `at`, told to leave `STAYS` seconds later. */
function appended(i: number, at: number): Lifecycle {
  const [message, style] = MESSAGES[i % MESSAGES.length]!;
  const line = new RichText(`${String(i + 1).padStart(3)}  ${message}`, { style });
  // Each line its own transitions: a transition is made for one element.
  const key = `line-${i}`;
  const exits = [throughColors(dissolveOut(EXIT, i), CATPPUCCIN_MOCHA), throughGlyphs(backspace(EXIT)), throughGlyphs(scrambleOut(EXIT, i))];
  return lifecycle(line, { enter: throughGlyphs(typewriter(ENTER)), exit: exits[i % exits.length]!, key }, at).leave(at + STAYS);
}

let log: Lifecycle[] = [];
let next = 0;

function view(t: number): Renderable {
  // Append every line due by `t`, and drop every line gone by it.
  for (; next * EVERY <= t; next++) log.push(appended(next, next * EVERY));
  log = log.filter((line) => !line.gone(t));
  return new Panel(new Group(...log), { title: `build log · ${log.length} shown`, width: 44, borderStyle: "#585b70" });
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
