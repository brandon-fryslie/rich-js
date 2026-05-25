/**
 * VitePress dynamic-route paths file.
 *
 * [LAW:one-source-of-truth] The demo list comes from the manifest written by
 * `vite.config.demos.ts` at demos:build. Adding/removing a demo updates this
 * page set automatically — no list to edit here.
 *
 * [LAW:dataflow-not-control-flow] No branch on "demos may not exist"; the
 * manifest is a precondition. If demos:build has not run, the read fails
 * loudly with a clear path — a verifiable build constraint, not a silent
 * empty result.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(__dirname, "..", ".vitepress", "demos.json");

interface ManifestEntry {
  readonly name: string;
}
interface Manifest {
  readonly demos: ReadonlyArray<ManifestEntry>;
}

export default {
  paths(): ReadonlyArray<{ params: { demo: string } }> {
    const raw = readFileSync(manifestPath, "utf-8");
    const manifest = JSON.parse(raw) as Manifest;
    return manifest.demos.map((d) => ({ params: { demo: d.name } }));
  },
};
