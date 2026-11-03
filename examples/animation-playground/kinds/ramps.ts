/**
 * Moving ramps: a color effect over an element that is not itself animated.
 *
 * The idiom is `new Effected(element, effect, { key })`: the element is any
 * renderable, drawn as it always is, and the effect moves only its colors —
 * here a ramp that scrolls along it and turns its hue. Put around a panel,
 * the effect is on the panel, so it is the border that moves.
 */
import { Animation, ColorRamp, ColorRgba, EASES, Effected, RichText, Rule, WrapMode, gradient } from "@promptctl/rich-js";
import { BORDER, TEXT, kind, panel, type Kind } from "./look.js";

const HUES = new ColorRamp(EASES.linear, [
  { at: 0, color: new ColorRgba(255, 120, 100) },
  { at: 1 / 3, color: new ColorRgba(249, 226, 175) },
  { at: 2 / 3, color: new ColorRgba(110, 190, 255) },
  { at: 1, color: new ColorRgba(255, 120, 100) },
]);
// Each loop is a phase of its own seconds; reduced, each holds at 0, the ramp unmoved.
const flowing = HUES.moving({ scroll: Animation.continuous(WrapMode.loop(4)), hue: Animation.continuous(WrapMode.loop(12)) });

const BORDERED = "moving ramp · border";

export const RAMPS: readonly Kind[] = [
  kind("moving ramp · Rule", new Effected(new Rule("scrolls and turns", { style: BORDER }), gradient(flowing, [BORDER]), { key: "rule" })),
  { name: BORDERED, view: new Effected(panel(BORDERED)(new RichText("the border is the ramp", { style: TEXT })), gradient(flowing, [BORDER]), { key: "border" }) },
];
