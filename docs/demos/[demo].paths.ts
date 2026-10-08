/**
 * VitePress dynamic-route paths file.
 *
 * [LAW:one-source-of-truth] The demo list comes from the manifest written by
 * `vite.config.demos.ts` at demos:build. Adding/removing a demo updates this
 * page set automatically — no list to edit here. A demo that runs in a card
 * hands its page the card (docs/.vitepress/demo-card.ts) as a param.
 *
 * [LAW:dataflow-not-control-flow] No branch on "demos may not exist"; the
 * manifest is a precondition. If demos:build has not run, the read fails
 * loudly with a clear path — a verifiable build constraint, not a silent
 * empty result.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { demoCard, type DemoCard } from "../.vitepress/demo-card.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, "..", ".vitepress", "demos.json");

interface ManifestEntry {
  readonly name: string;
  readonly runs: "card" | "iframe";
}
interface Manifest {
  readonly demos: ReadonlyArray<ManifestEntry>;
}

/** A demo page's params: its name, and its card if it runs in one. */
type Params = { readonly demo: string } | { readonly demo: string; readonly card: DemoCard };

export default {
  async paths(): Promise<ReadonlyArray<{ params: Params }>> {
    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    return Promise.all(
      manifest.demos.map(async ({ name, runs }) => ({ params: runs === "card" ? { demo: name, card: await demoCard(name) } : { demo: name } })),
    );
  },
};
