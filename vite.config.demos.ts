/**
 * Browser bundle pipeline for demos (ticket rich-demo-site-pek.3).
 *
 * [LAW:single-enforcer] One pipeline produces every demo bundle that the docs
 * site consumes. There is no second build path: a demo is bundleable iff it
 * has a `wire.ts` exporting `mount(terminal): MountHandle` (the shape
 * established in rich-demo-site-pek.2's harness).
 *
 * [LAW:dataflow-not-control-flow] The set of demos is data, not code — the
 * config enumerates `examples/<name>/wire.ts` at build time. Adding a demo
 * is "create the directory and the wire.ts"; no list to edit here. Staging
 * runs in a plugin's `buildStart` hook, not at config-evaluation time, so
 * `vite preview` (and any tooling that just reads the config) doesn't trigger
 * filesystem writes — the discriminator "are we building right now?" is data
 * Vite exposes via the plugin lifecycle, not a branch the config has to make.
 *
 * [LAW:one-source-of-truth] The HTML shell + mount glue live as templates in
 * `examples/_browser-shell/`; per-demo staged copies under `.vite-demos/` are
 * derived. Edit the template, every demo gets the change.
 */

import { defineConfig, type Plugin } from "vite";
import {
  readdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = resolve(__dirname, "examples");
const compiledExamplesDir = resolve(__dirname, "dist-demo", "examples");
const stagingDir = resolve(__dirname, ".vite-demos");
const shellDir = resolve(examplesDir, "_browser-shell");

// ---- Demo discovery --------------------------------------------------------
//
// A demo is *any* directory under examples/ that has a wire.ts (the
// authoring source) AND a compiled wire.js under dist-demo/ (the bundler
// input). Vite bundles the already-tsc-compiled JS so the decorator-using
// modules (mobx accessors in src/widgets/) don't need a second TS toolchain
// inside the bundler — tsc is the single TypeScript compiler in this repo.
// [LAW:single-enforcer]
//
// If a demo has wire.ts but no matching wire.js, the discovery throws a
// precise error naming the missing compiled files. Silently excluding such
// demos would let a fresh `vite build --config vite.config.demos.ts`
// (skipping the tsc step that `npm run demos:build` chains) appear to
// succeed while quietly dropping new demos from the output. Loud failure
// instead. [LAW:verifiable-goals]
function discoverDemos(): readonly string[] {
  const candidates = readdirSync(examplesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name)
    .filter((name) => existsSync(resolve(examplesDir, name, "wire.ts")))
    .sort();

  const missing = candidates.filter(
    (name) => !existsSync(resolve(compiledExamplesDir, name, "wire.js")),
  );
  if (missing.length > 0) {
    const list = missing.map((n) => `  - examples/${n}/wire.ts`).join("\n");
    throw new Error(
      `vite.config.demos.ts: ${missing.length} demo(s) have wire.ts but no compiled wire.js:\n` +
        list +
        `\nRun \`npm run demos:build\` (which chains tsc first), or run ` +
        `\`tsc -p tsconfig.demo.json\` before invoking vite directly.`,
    );
  }

  return candidates;
}

// ---- Staging ---------------------------------------------------------------
//
// For each demo, materialise `.vite-demos/<name>/{index.html,mount.ts}` from
// the templates with `__DEMO_NAME__` / `__DEMO_WIRE__` substituted. The mount
// imports the compiled wire by *relative* path — uniform across platforms,
// unlike an absolute path which would become `C:/...` on Windows and reject
// as a module specifier in most resolvers.
function stageDemos(demos: readonly string[]): void {
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });

  const htmlTmpl = readFileSync(resolve(shellDir, "index.html.tmpl"), "utf-8");
  const mountTmpl = readFileSync(resolve(shellDir, "mount.ts.tmpl"), "utf-8");

  for (const name of demos) {
    const dir = resolve(stagingDir, name);
    mkdirSync(dir, { recursive: true });
    // Relative path from the staged mount.ts to the compiled wire.js,
    // forward-slashed for module-specifier consumption.
    const wirePath = relative(
      dir,
      resolve(compiledExamplesDir, name, "wire.js"),
    ).replace(/\\/g, "/");
    writeFileSync(
      resolve(dir, "index.html"),
      htmlTmpl.replaceAll("__DEMO_NAME__", name),
    );
    writeFileSync(
      resolve(dir, "mount.ts"),
      mountTmpl.replaceAll("__DEMO_WIRE__", wirePath),
    );
  }
}

// Vite plugin: stage at `buildStart`, scoped via `apply: "build"` so the
// plugin object itself is only active during `vite build`. Reading the
// config or running `vite preview` / `vite dev` skips this plugin entirely.
// [LAW:types-are-the-program] `apply` makes the build-only constraint a
// property of the plugin object, not a property of which hooks fire.
function stagingPlugin(demos: readonly string[]): Plugin {
  return {
    name: "rich-js-demo-staging",
    apply: "build",
    buildStart() {
      stageDemos(demos);
    },
  };
}

const demos = discoverDemos();

// HTML inputs declared at config time (so Rollup knows the entry set), but
// the files behind them are written at buildStart — Vite reads inputs only
// after `buildStart` resolves, so the files exist by the time it tries to.
const input: Record<string, string> = {};
for (const name of demos) {
  input[name] = resolve(stagingDir, name, "index.html");
}

// Boundary stubs for node-only modules the library happens to import at
// module top level: `fs` (Console.saveText/saveHtml) and `node:readline`
// (the prompt renderable). [LAW:locality-or-seam] These aliases mark the
// seam where a structural fix should land: the node-using methods should
// be extracted out so the type forbids them in browser environments.
const nodeStub = resolve(shellDir, "node-stub.js");
const browserStubs = {
  fs: nodeStub,
  "node:fs": nodeStub,
  readline: nodeStub,
  "node:readline": nodeStub,
};

export default defineConfig({
  root: stagingDir,
  base: "./",
  resolve: {
    alias: browserStubs,
  },
  plugins: [stagingPlugin(demos)],
  build: {
    outDir: resolve(__dirname, "dist-demos"),
    emptyOutDir: true,
    target: "es2022",
    rollupOptions: { input },
  },
  // xterm.js is loaded via CDN in the HTML shell, so the bundles don't need
  // it bundled. The global `Terminal` on `window` is the wire's input.
  // [LAW:locality-or-seam] The xterm.js dependency is anchored at exactly
  // one boundary (the HTML) so swapping xterm.js versions or replacing it
  // is a single-file change.
});
