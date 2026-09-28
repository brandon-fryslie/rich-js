import type { Plugin } from "vite";
import ts from "typescript";

/**
 * [LAW:one-source-of-truth] The code under test is compiled by the same
 * compiler, with the same options, as the `dist/` a consumer receives.
 *
 * Vite 8 transforms TypeScript with oxc, which lowers only legacy decorators
 * and passes TC39 ones through verbatim — and no Node release parses them, so
 * every module declaring `@observable accessor` failed to load with a bare
 * `SyntaxError`. The unit suite and the docs-example bundler both compile
 * `src/` through this. `tsc` is what builds the package, so it is what compiles a
 * project `.ts` file here too, reading `tsconfig.json` rather than restating
 * any of it. `module` is the one override: `transpileModule` sees no
 * `package.json`, and would otherwise emit CommonJS for a Node16 module file.
 */
export function tscTransform(root: string): Plugin {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists, "tsconfig.json");
  if (configPath === undefined) throw new Error(`tscTransform: no tsconfig.json at or above ${root}`);
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, root);
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
