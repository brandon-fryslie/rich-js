/**
 * gradient-effects — a colour ramp laid across a rule and a panel's border,
 * scrolling, turning its hue, and settling, playing in a `Live` for twenty
 * seconds.
 *
 * THIS IS A DEMO: `ColorRamp.moving` and the `gradient` effect
 * (`src/themes/ramp.ts`, `src/renderables/effects.ts`), for seeing them move.
 * Each element is wrapped in an `Effected` drawn at the `Live`'s time, so what
 * it shows at a `t` is the same at any frame rate; on a sixteen-colour
 * terminal every ramp holds still.
 */

import {
  Animation,
  CATPPUCCIN_MOCHA,
  ColorRamp,
  ColorRgba,
  EASES,
  Effected,
  Group,
  Live,
  Panel,
  Phase,
  RichText,
  Rule,
  gradient,
  tween,
  type Renderable,
} from "../../src/index.js";

const LINE = "#a6e3a1";
const coral = new ColorRgba(255, 120, 100);
const sky = new ColorRgba(110, 190, 255);
const gold = new ColorRgba(249, 226, 175);
// First and last stops alike, so a scroll wraps without a seam.
const hues = new ColorRamp(EASES.linear, [
  { at: 0, color: coral },
  { at: 1 / 3, color: gold },
  { at: 2 / 3, color: sky },
  { at: 1, color: coral },
]);

const ELEMENTS: readonly [string, Animation<ColorRamp>][] = [
  ["scrolling once every four seconds", hues.moving({ scroll: Animation.continuous(Phase.loop(4)) })],
  ["its hues turning once every ten", hues.moving({ hue: Animation.continuous(Phase.loop(10)) })],
  ["swaying, and settling a quarter turn round", hues.moving({ scroll: Animation.continuous(Phase.pingPong(6)), hue: tween(0, 0.25, { seconds: 3, ease: EASES["ease-out"] }) })],
];

function view(t: number): Renderable {
  return new Group(
    ...ELEMENTS.flatMap(([title, ramp]) => [
      new Effected(new Rule(title, { style: LINE }), gradient(ramp, [LINE]), { t, key: `rule ${title}`, theme: CATPPUCCIN_MOCHA }),
      new Effected(new Panel(new RichText("the words keep their own colour", { style: "#cdd6f4" }), { borderStyle: LINE, width: 50 }), gradient(ramp, [LINE]), {
        t,
        key: `panel ${title}`,
        theme: CATPPUCCIN_MOCHA,
      }),
    ]),
  );
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
