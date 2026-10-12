/**
 * The demo list (`demoNames`, demo-entry.ts) for the Demos index page, which
 * runs in the browser and so cannot read `examples/` itself: VitePress runs
 * this loader at build and hands its result to the page.
 */
import { DEMO_ENTRY, demoNames } from "./demo-entry.js";

export declare const data: readonly string[];

export default {
  watch: [`../../examples/*/${DEMO_ENTRY}`],
  load: (): readonly string[] => demoNames(),
};
