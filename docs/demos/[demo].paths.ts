/**
 * VitePress dynamic-route paths file: one page per demo, each handed its card
 * (docs/.vitepress/demo-card.ts) as a param.
 *
 * [LAW:one-source-of-truth] The demos are `demoNames()` (demo-entry.ts), the
 * list the sidebar and the Demos index read too.
 */
import { demoCard, type DemoCard } from "../.vitepress/demo-card.js";
import { demoNames } from "../.vitepress/demo-entry.js";

export default {
  async paths(): Promise<ReadonlyArray<{ params: { readonly demo: string; readonly card: DemoCard } }>> {
    return Promise.all(demoNames().map(async (demo) => ({ params: { demo, card: await demoCard(demo) } })));
  },
};
