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
 * added to it — and the program each playground opens on. It also relays
 * what the page does to terminals playing beside it (mirror.ts).
 */

import type { ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { LIVE_RUNTIME_MODULE, bundleLiveRuntime, libraryModule, liveLibraryOnce } from "./docs/.vitepress/example-runner.js";
import { CONTROL_DEFAULTS } from "./examples/effects-playground/controls.js";
import { KIT_MODULE } from "./examples/effects-playground/edits.js";
import { EVENTS_PATH, LIBRARY_PATH, SAID_EVENT, concerns, type Said } from "./examples/effects-playground/mirror.js";
import { CURVES_FILE, KIT_FILE, effectPrograms } from "./examples/effects-playground/programs.js";
import { EFFECTS, type EffectName } from "./examples/effects-feel/vocabulary.js";

const PLAYGROUND_MODULE = "virtual:effects-playground";

/** The live library with the kit added, and every file it was made from. */
async function playgroundLibrary(): Promise<{ readonly script: string; readonly modules: readonly string[] }> {
  const [shared, kit] = await Promise.all([liveLibraryOnce()(), libraryModule(KIT_MODULE, KIT_FILE)]);
  return { script: shared.script + kit.code, modules: kit.modules };
}

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
        const library = await playgroundLibrary();
        [CURVES_FILE, ...library.modules].forEach((file) => this.addWatchFile(file));
        return `export const library = ${JSON.stringify(library.script)};\nexport const programs = ${JSON.stringify(effectPrograms())};`;
      }
      return null;
    },
    configureServer(server) {
      // The latest the page has said: the run controls, and each effect's program.
      let controls = CONTROL_DEFAULTS;
      const sources: Partial<Record<EffectName, string>> = {};
      const followers = new Set<{ readonly effects: readonly EffectName[]; readonly response: ServerResponse }>();
      const tell = (response: ServerResponse, said: Said): void => void response.write(`data: ${JSON.stringify(said)}\n\n`);

      server.ws.on(SAID_EVENT, (said: Said) => {
        if (said.kind === "controls") controls = said.controls;
        if (said.kind === "source" || said.kind === "restart") sources[said.effect] = said.source;
        for (const follower of followers) if (concerns(said, follower.effects)) tell(follower.response, said);
      });

      server.middlewares.use(EVENTS_PATH, (request, response) => {
        const asked = new URL(request.url ?? "", "http://server").searchParams.getAll("effect");
        const unknown = asked.filter((name) => !EFFECTS.some((e) => e === name));
        if (unknown.length > 0) {
          response.statusCode = 400;
          response.end(`?effect= must be one of ${EFFECTS.join(", ")}; got ${unknown.map((name) => JSON.stringify(name)).join(", ")}`);
          return;
        }
        // In the panels' order, every effect when none is named.
        const effects = EFFECTS.filter((e) => asked.length === 0 || asked.includes(e));
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
        // The state first, so a terminal that joins late plays what the panels play now.
        tell(response, { kind: "controls", controls });
        for (const effect of effects) tell(response, { kind: "source", effect, source: sources[effect] ?? effectPrograms()[effect] });
        const follower = { effects, response };
        followers.add(follower);
        request.on("close", () => followers.delete(follower));
      });

      server.middlewares.use(LIBRARY_PATH, (_request, response, next) => {
        playgroundLibrary().then(
          (library) => response.end(library.script),
          (error: unknown) => next(error),
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [effectsPlayground()],
  server: { host: "0.0.0.0", port: 5199, allowedHosts: true, open: "/examples/effects-playground/" },
});
