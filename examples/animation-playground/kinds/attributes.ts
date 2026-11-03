/**
 * Attribute effects: a cell's bold, dim or blink moving with time.
 *
 * The idiom is the color effect's, `new Effected(element, effect, { key })`,
 * with an effect that moves an attribute rather than a color. `blink` here is
 * drawn by the library, on the timeline, so it pauses, reverses and stops
 * under reduced motion as every other kind does — not the terminal's own
 * blink, which nothing can pause.
 */
import { ATTRIBUTE_DEFAULTS, Effected, RichText, blink } from "@promptctl/rich-js";
import { kind, type Kind } from "./look.js";

export const ATTRIBUTES: readonly Kind[] = [
  kind("blink", new Effected(new RichText("● recording", { style: "#f38ba8" }), blink(ATTRIBUTE_DEFAULTS.blink), { key: "blink" })),
  kind("bold pulse", new Effected(new RichText("♥ a bold heartbeat", { style: "#f38ba8" }), blink(ATTRIBUTE_DEFAULTS.boldPulse), { key: "pulse" })),
];
