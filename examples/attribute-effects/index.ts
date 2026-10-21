/**
 * attribute-effects — the catalogue's attribute effects, and a few made by
 * hand from `blink`, playing in a `Live` for twenty seconds.
 *
 * THIS IS A DEMO: the library's attribute effects
 * (`src/renderables/effects.ts`), for seeing them move. Each panel's content
 * is wrapped in an `Effected` placed in the view and drawn at the `Live`'s
 * time, so what it shows at a `t` is the same at any frame rate, and a beat
 * turns on the moment its cells say.
 */

import {
  ATTRIBUTE_DEFAULTS,
  CATPPUCCIN_MOCHA,
  Columns,
  EFFECT_CATALOGUE,
  Effected,
  Live,
  Panel,
  RichText,
  blink,
  type Effect,
} from "../../src/index.js";

const WIDTH = 30;
const z = 0.4;
const PANELS: readonly [string, Effect][] = [
  ["blink", EFFECT_CATALOGUE.attributes.blink({ z })],
  ["bold pulse", EFFECT_CATALOGUE.attributes.boldPulse({ z })],
  ["underline, slow", blink({ attribute: "underline", off: 1, on: 1 })],
  ["italic, as bold pulses", blink({ ...ATTRIBUTE_DEFAULTS.boldPulse, attribute: "italic" })],
];

const view: Columns = new Columns(
  PANELS.map(([title, effect]) =>
    new Panel(new Effected(new RichText("ready when you are", { style: "#89b4fa" }), effect, { key: title, theme: CATPPUCCIN_MOCHA }), { title, width: WIDTH }),
  ),
);

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
