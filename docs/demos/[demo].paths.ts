/**
 * VitePress dynamic-route paths file: one page per demo, each handed its card
 * (docs/.vitepress/demo-card.ts) as a param.
 *
 * [LAW:one-source-of-truth] The demos are `demoNames()` (demo-entry.ts), the
 * list the sidebar and the Demos index read too.
 *
 * The card goes as JSON with every `<` escaped, and the page parses it.
 * VitePress writes a page's params into a `<script>` of the page's component
 * as they are (`injectPageDataCode`), so a `</script>` anywhere in a card —
 * a session claude-sessions shows, a file rich-explore browses — would end
 * that script mid-data and fail the build.
 */
import { demoCard } from "../.vitepress/demo-card.js";
import { demoNames } from "../.vitepress/demo-entry.js";

export default {
  async paths(): Promise<ReadonlyArray<{ params: { readonly demo: string; readonly card: string } }>> {
    return Promise.all(
      demoNames().map(async (demo) => ({ params: { demo, card: JSON.stringify(await demoCard(demo)).replaceAll("<", "\\u003c") } })),
    );
  },
};
