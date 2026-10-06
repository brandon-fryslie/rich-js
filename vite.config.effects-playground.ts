/**
 * Dev server for examples/effects-playground: served from the repository
 * root, so the page reaches the docs' code font, the docs' live terminal and
 * `src/` by relative path. It answers on every interface and to any host
 * name, so the playground can be opened from another machine on the network
 * (by its mDNS name, say).
 *
 * Its plugin serves what the docs' playground is served, made the way the
 * docs build makes it (docs/.vitepress/example-runner.ts): the live
 * terminal's worker, and the live library — here with the playground's kit
 * added to it — and the program each playground opens on.
 */

import { defineConfig, type Plugin } from "vite";
import { LIVE_RUNTIME_MODULE, bundleLiveRuntime, libraryModule, liveLibraryOnce } from "./docs/.vitepress/example-runner.js";
import { KIT_MODULE } from "./examples/effects-playground/edits.js";
import { CURVES_FILE, KIT_FILE, effectPrograms } from "./examples/effects-playground/programs.js";

const PLAYGROUND_MODULE = "virtual:effects-playground";

function effectsPlayground(): Plugin {
  return {
    name: "rich-effects-playground",
    resolveId: (id) => (id === PLAYGROUND_MODULE || id === LIVE_RUNTIME_MODULE ? `\0${id}` : null),
    async load(id) {
      if (id === `\0${LIVE_RUNTIME_MODULE}`) {
        const runtime = await bundleLiveRuntime();
        runtime.modules.forEach((file) => this.addWatchFile(file));
        return `export default ${JSON.stringify(runtime.code)};`;
      }
      if (id === `\0${PLAYGROUND_MODULE}`) {
        // Made afresh each load: the watches below are what ask for one, an
        // edit to curves.ts or to anything the kit is built from.
        const [shared, kit] = await Promise.all([liveLibraryOnce()(), libraryModule(KIT_MODULE, KIT_FILE)]);
        [CURVES_FILE, ...kit.modules].forEach((file) => this.addWatchFile(file));
        return `export const library = ${JSON.stringify(shared.script + kit.code)};\nexport const programs = ${JSON.stringify(effectPrograms())};`;
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [effectsPlayground()],
  server: { host: "0.0.0.0", port: 5199, allowedHosts: true, open: "/examples/effects-playground/" },
});
