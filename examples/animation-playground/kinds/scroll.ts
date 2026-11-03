/**
 * Scrolling: a window over content wider than the slot it sits in.
 *
 * Two idioms. `marquee(content, { width, step })` is content of any width
 * crossing a slot a cell every `step` seconds and coming round again; it moves
 * only on a step, so the host sleeps between them. `scroll(content, { width,
 * height, col, row })` is the window with its offset handed in as an
 * animation — here a tween to 0, a line sliding into its place.
 */
import { Animation, EASES, RichText, cyclic, marquee, scroll, tween } from "@promptctl/rich-js";
import { SLOT, kind, type Kind } from "./look.js";

const NEWS = "rich-js · tables, panels, trees and live displays · every motion is one Animation ·";

const sliding = Animation.repeat(
  4,
  cyclic([scroll(new RichText("arrived, and holding still", { style: "#a6e3a1" }), { width: SLOT, height: 1, col: tween(-SLOT, 0, { seconds: 1, ease: EASES["back-out"] }) })]),
);

export const SCROLLS: readonly Kind[] = [
  kind("marquee", marquee(new RichText(NEWS, { style: "bold #f9e2af" }), { width: SLOT, step: 0.12 })),
  kind("slide-in", sliding),
];
