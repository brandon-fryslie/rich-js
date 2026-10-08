/**
 * The effects playground page's cards (.vitepress/effect-cards.ts), made at
 * build time and handed to the page as data. Made again when the dev server
 * sees a file they are made from change: the library's effects and the noise
 * they reach, the kit and the demo's subjects, and the card's options.
 */
import { defineLoader } from "vitepress";
import { effectCards, type EffectCard } from "./.vitepress/effect-cards.js";

declare const data: readonly EffectCard[];
export { data };

export default defineLoader({
  watch: ["../src/renderables/effects.ts", "../src/core/noise.ts", "../examples/effects-playground/*", "../examples/effects-feel/*.ts"],
  load: effectCards,
});
