/**
 * Tweens: a value eased from one number to another, mapped to what shows it.
 *
 * The idiom is `Animation.map(tween(from, to, timing), (v) => renderable)`:
 * the tween is the motion, and the map is the only place the value meets the
 * screen. Retargeting is one tween per target, played in turn by
 * `Animation.repeat(period, cyclic(turns))`, so a value moves to the next
 * target every few seconds, and back again when the timeline runs backwards.
 */
import { Animation, ColorRamp, ColorRgba, EASES, ProgressBar, RichText, cyclic, spring, tween } from "@promptctl/rich-js";
import { SLOT, kind, type Kind } from "./look.js";

const COUNTS = [120, 870, 430, 1204, 60, 655];
const RETARGET = 3;
const count = cyclic(COUNTS);

/** One tween per target, each from the target before it, made once. */
const retargeted = (timing: Parameters<typeof tween>[2]) => Animation.repeat(RETARGET, cyclic(COUNTS.map((to, i) => tween(count(i - 1), to, timing))));

const counting = retargeted(spring({ stiffness: 120, damping: 14 }));
const filling = retargeted({ seconds: 1.2, ease: EASES["ease-out"] });
const fading = Animation.repeat(
  RETARGET,
  cyclic([tween(0, 1, { seconds: 1.5, ease: EASES["ease-in-out"] }), tween(1, 0, { seconds: 1.5, ease: EASES["ease-in-out"] })]),
);
const fadeRamp = new ColorRamp(EASES.linear, [
  { at: 0, color: new ColorRgba(243, 139, 168) },
  { at: 1, color: new ColorRgba(166, 227, 161) },
]);

export const TWEENS: readonly Kind[] = [
  kind("tween · a counter", Animation.map(counting, (v) => new RichText(`${Math.round(v).toLocaleString("en-US").padStart(6)} files`, { style: "bold #f9e2af" }))),
  kind("tween · ProgressBar", Animation.map(filling, (v) => new ProgressBar({ total: 1204, completed: v, width: SLOT }))),
  kind("tween · a color", Animation.map(fading, (v) => new RichText(`██████  ${fadeRamp.at(v).hex}`, { style: fadeRamp.at(v).hex }))),
];
