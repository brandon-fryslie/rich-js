/**
 * attribute-effects — the catalogue's attribute effects, and a few made by
 * hand from `blink`, playing in a `Live` for twenty seconds.
 *
 * THIS IS A DEMO: the library's attribute effects
 * (`src/renderables/effects.ts`), for seeing them move. Each panel's content
 * is wrapped in an `Effected` drawn at the `Live`'s time, so what it shows at
 * a `t` is the same at any frame rate, and the `Live` wakes only when a beat
 * turns.
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

function view(t: number): Columns {
  return new Columns(
    PANELS.map(([title, effect]) =>
      new Panel(new Effected(new RichText("ready when you are", { style: "#89b4fa" }), effect, { t, key: title, theme: CATPPUCCIN_MOCHA }), { title, width: WIDTH }),
    ),
  );
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
