/**
 * [LAW:locality-or-seam] Make the seam between unit tests and the
 * headless-browser e2e gate explicit. Without this config, vitest's default
 * glob matches `**\/*.spec.ts` anywhere in the repo and would attempt to run
 * the Playwright suite in `e2e/` as if it were vitest — vitest discovers it,
 * doesn't recognise the `@playwright/test` API, and the file fails to load.
 *
 * [LAW:single-enforcer] One runner per concern: vitest owns unit-level
 * contract tests under `test/`; Playwright owns the headless-browser demo
 * gate under `e2e/`. Configuration encodes the partition rather than relying
 * on filename coincidence.
 */
import { defineConfig, type Plugin } from "vitest/config";
import ts from "typescript";

/**
 * [LAW:one-source-of-truth] The code under test is compiled by the same
 * compiler, with the same options, as the `dist/` a consumer receives.
 *
 * Vite 8 transforms TypeScript with oxc, which lowers only legacy decorators
 * and passes TC39 ones through verbatim — and no Node release parses them, so
 * every module declaring `@observable accessor` failed to load with a bare
 * `SyntaxError`. `tsc` is what builds the package, so it is what compiles a
 * project `.ts` file here too, reading `tsconfig.json` rather than restating
 * any of it. `module` is the one override: `transpileModule` sees no
 * `package.json`, and would otherwise emit CommonJS for a Node16 module file.
 */
function tscTransform(): Plugin {
  const configPath = ts.findConfigFile(import.meta.dirname, ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) throw new Error("vitest.config.ts: tsconfig.json not found");
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, import.meta.dirname);
  const compilerOptions: ts.CompilerOptions = {
    ...options,
    module: ts.ModuleKind.ESNext,
    sourceMap: true,
    inlineSourceMap: false,
    declaration: false,
    declarationMap: false,
  };

  return {
    name: "rich-js:tsc-transform",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".ts") || id.includes("/node_modules/")) return null;
      const out = ts.transpileModule(code, { compilerOptions, fileName: id });
      return { code: out.outputText, map: out.sourceMapText ?? null };
    },
  };
}

export default defineConfig({
  plugins: [tscTransform()],
  test: {
    include: ["test/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    exclude: ["node_modules", "dist", "dist-demo", "e2e"],
  },
});
