/**
 * Transitions: from what was shown to what is shown now.
 *
 * The idiom is `crossfade(timing).effect({ from, to })` — or `wipe` — an
 * animation that draws `from` turning into `to` and then holds `to`. A status
 * line that changes every few seconds is one transition per change, each from
 * the status before it, played in turn by `Animation.repeat`.
 */
import { Animation, RichText, crossfade, cyclic, wipe } from "@promptctl/rich-js";
import { CHANGE, STAY, kind, type Kind } from "./look.js";

const STATUSES = [
  new RichText("● building the project", { style: "#f9e2af" }),
  new RichText("✔ 1,204 tests passed", { style: "#a6e3a1" }),
  new RichText("▲ publishing the docs", { style: "#89b4fa" }),
];
const status = cyclic(STATUSES);

/** Each status arriving from the one before it through `change`, a status every `STAY` seconds. */
const changing = (change: typeof crossfade) => Animation.repeat(STAY, cyclic(STATUSES.map((to, i) => change(CHANGE).effect({ from: status(i - 1), to }))));

export const TRANSITIONS: readonly Kind[] = [kind("crossfade", changing(crossfade)), kind("wipe", changing(wipe))];
