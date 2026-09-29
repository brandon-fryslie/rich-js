import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// @ts-expect-error — plain ESM script, typed by JSDoc under tsconfig.scripts.json
import { entryPoints } from "../../scripts/verify-entry-points.mjs";

describe("verify-entry-points — the files a publish must carry", () => {
  it("collects main, types and every nested exports target", () => {
    expect(
      entryPoints({
        main: "dist/index.js",
        types: "dist/index.d.ts",
        exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" }, "./x": "./dist/x.js" },
      }),
    ).toEqual(["dist/index.js", "dist/index.d.ts", "./dist/index.d.ts", "./dist/index.js", "./dist/x.js"]);
  });

  it("covers every subpath this package declares", () => {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
    const points: string[] = entryPoints(manifest);
    for (const subpath of Object.keys(manifest.exports)) {
      expect(points).toContain(manifest.exports[subpath].import);
    }
  });
});
